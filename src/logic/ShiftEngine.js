import * as XLSX from 'xlsx';

/**
 * Main class for generating shifts based on business logic.
 */
export class ShiftEngine {
    constructor(data, targetYm, monthlySettings = {}) {
        this.data = data; // { 'マスタ': [], '希望': [], '要員数': [], '月設定': [], ... }
        this.targetYm = targetYm; // "2025-10"

        // Extract monthly settings for this target month
        this.monthlySettings = monthlySettings[targetYm] || {}; // { monthlyHoliday: 9 }

        this.logs = []; // Execution logs

        // The main shift table data
        // Array of staff objects: { name: "", shifts: { "2025/10/01": "日", ... }, ...otherProps }
        this.shiftTable = [];
        this.dates = []; // Array of "YYYY/MM/DD" strings
        this.dayOfWeeks = []; // Array of "日", "月"... corresponding to dates
        this.holidays = {}; // Map of holidays if needed

        // Calculate dates immediately
        const [yearStr, monthStr] = this.targetYm.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1; // 0-indexed
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            this.dates.push(this.formatDate(date));
            this.dayOfWeeks.push(weekdays[date.getDay()]);
        }
    }

    // Helper to format date as YYYY/MM/DD
    formatDate(date) {
        const y = date.getFullYear();
        const m = ('0' + (date.getMonth() + 1)).slice(-2);
        const d = ('0' + date.getDate()).slice(-2);
        return `${y}/${m}/${d}`;
    }

    // Helper to normalize date string from various formats (e.g. "2025-10-01", "10/1", or serial) to "YYYY/MM/DD"
    normalizeDateStr(s) {
        if (s === undefined || s === null) return null;

        // Handle Excel Serial Date (e.g. 45123)
        if (typeof s === 'number') {
            const utc_days = Math.floor(s - 25569);
            const utc_value = utc_days * 86400;
            const date_info = new Date(utc_value * 1000);
            return this.formatDate(date_info);
        }

        const str = s.toString().trim();
        // Try standard format YYYY/MM/DD or YYYY-MM-DD
        let m = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
        if (m) {
            const y = m[1];
            const mo = ("0" + m[2]).slice(-2);
            const d = ("0" + m[3]).slice(-2);
            return `${y}/${mo}/${d}`;
        }

        // Try MD format (10/1) - Assume target year
        m = str.match(/^(\d{1,2})[/-](\d{1,2})$/);
        if (m) {
            const [targetY] = this.targetYm.split('-');
            const mo = ("0" + m[1]).slice(-2);
            const d = ("0" + m[2]).slice(-2);
            return `${targetY}/${mo}/${d}`;
        }

        return null;
    }

    // Helper to find matching column/row key for a given date
    findKeyForDate(row, dateStr) {
        // dateStr: "2025/10/01"
        const keys = Object.keys(row);
        for (const key of keys) {
            // 1. Direct match
            if (key === dateStr) return key;

            // 2. Normalized match
            // Check if key looks like a date/number
            const normalized = this.normalizeDateStr(key);
            if (normalized === dateStr) return key;

            // 3. Short match (e.g. key is "1日" or "10/1")
            // This is risky but needed for some manual headers.
            // If key is "1" or "1日" and dateStr is 1st of month...
            // Let's rely on standard logic first.
        }
        return null;
    }


    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.logs.push(`[${timestamp}] ${message}`);
        console.log(`[ShiftEngine] ${message}`);
    }

    getLogs() {
        return this.logs;
    }

    isTruthyMark(value) {
        return value === true || value === 1 || value === '1' || value === 'TRUE' || value === '〇';
    }

    isUnavailableShift(value) {
        return value === '__UNAVAILABLE__';
    }

    normalizeOptionalDate(value) {
        if (!value) return null;
        return this.normalizeDateStr(value);
    }

    hasTrainingPeriod(staff) {
        return Boolean(this.normalizeOptionalDate(staff['研修開始日']) || this.normalizeOptionalDate(staff['研修終了日']));
    }

    isTraineeStaff(staff) {
        return this.isTruthyMark(staff['研修生']);
    }

    isTrainingDate(staff, dateStr) {
        if (!this.isTraineeStaff(staff)) return false;

        const start = this.normalizeOptionalDate(staff['研修開始日']);
        const end = this.normalizeOptionalDate(staff['研修終了日']);

        // Backward-compatible behavior: a trainee without dates is trainee for the full month.
        if (!start && !end) return true;
        if (start && dateStr < start) return false;
        if (end && dateStr > end) return false;
        return true;
    }

    isBeforeEmployment(staff, dateStr) {
        const start = this.normalizeOptionalDate(staff['入職日']);
        return Boolean(start && dateStr < start);
    }

    getAvailableDates(staff) {
        return this.dates.filter(date => !this.isBeforeEmployment(staff, date));
    }

    /**
     * その月に必要な公休数を返す。
     * 月途中入職者（入職日あり）は在籍日数で日割り按分（四捨五入）。
     * 入職日が無ければ基準値（公休数 or 月公休 or 9）をそのまま返す。
     * すべての公休調整ステップはこの値を使い、按分のズレを防ぐ。
     */
    getRequiredRest(staff) {
        const base = parseInt(staff['公休数'], 10) || this.monthlySettings.monthlyHoliday || 9;
        const total = this.dates.length;
        if (!total || !this.normalizeOptionalDate(staff['入職日'])) return base;
        const availableDays = this.getAvailableDates(staff).length;
        return Math.round(base * (availableDays / total));
    }

    isNightTrainingPending(staff) {
        const status = String(staff['夜勤研修'] || '').trim();
        return status === '未';
    }

    isNightTrainingDone(staff) {
        const status = String(staff['夜勤研修'] || '').trim();
        return status === '済';
    }

    cleanupUnavailableShifts() {
        this.shiftTable.forEach(staff => {
            this.dates.forEach(date => {
                if (this.isUnavailableShift(staff.shifts[date])) {
                    staff.shifts[date] = "";
                    staff.shiftMeta[date] = {
                        ...(staff.shiftMeta[date] || {}),
                        isLocked: true,
                        isUnavailable: true
                    };
                }
            });
        });
    }

    /**
     * Check if assigning a shift on `dateStr` would violate the max 5 consecutive work days rule.
     * Returns true if violated (i.e., do NOT assign).
     */
    checkConsecutiveWork(staff, dateStr) {
        const idx = this.dates.indexOf(dateStr);
        if (idx === -1) return false;

        // 役職者判定
        const isManager = staff['サ責'] === true || staff['サ責'] === '〇' || staff['サ責'] === 'TRUE';
        const isDirector = staff['施設長'] === true || staff['施設長'] === '〇' || staff['施設長'] === 'TRUE';
        const isClerk = staff['事務員'] === true || staff['事務員'] === '〇' || staff['事務員'] === 'TRUE';
        const isAdmin = staff['管理者'] === true || staff['管理者'] === '〇' || staff['管理者'] === 'TRUE';
        const isChief = staff['主任'] === true || staff['主任'] === '〇' || staff['主任'] === 'TRUE';
        const isRoleStaff = isManager || isDirector || isClerk || isAdmin || isChief;

        const maxConsecutive = isRoleStaff ? 5 : 4;

        // 「明」「予」「研」も出勤扱いとしてカウントする
        const isWork = (s) => ["早", "日", "遅", "夜", "明", "予", "研", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(s);

        // Scan Backward
        let backwardDays = 0;
        for (let k = 1; k <= 6; k++) {
            if (idx - k < 0) break;
            const s = staff.shifts[this.dates[idx - k]];
            if (isWork(s)) {
                backwardDays++;
            } else {
                break;
            }
        }

        // Scan Forward
        let forwardDays = 0;
        for (let k = 1; k <= 6; k++) {
            if (idx + k >= this.dates.length) break;
            const s = staff.shifts[this.dates[idx + k]];
            if (isWork(s)) {
                forwardDays++;
            } else {
                break;
            }
        }

        // Total if we add this shift (this shift counts as 1 start)
        const totalStreak = backwardDays + 1 + forwardDays;

        if (totalStreak > maxConsecutive) return true; // しきい値を超える連勤はNG

        return false;
    }

    // Helper to check if a specific shift is allowed on a date for a staff
    isShiftAllowed(staff, dateStr, shift) {
        const idx = this.dates.indexOf(dateStr);
        if (idx === -1) return false;

        if (this.isBeforeEmployment(staff, dateStr) || this.isUnavailableShift(staff.shifts[dateStr])) {
            return false;
        }

        const isTrainingShift = typeof shift === 'string' && shift.startsWith('研修');
        if (this.isTrainingDate(staff, dateStr)) {
            if (!isTrainingShift && shift !== '休') return false;
        } else if (isTrainingShift) {
            // Night training is allowed outside the daytime training period when explicitly pending.
            if (!(shift === '研修（夜）' && this.isNightTrainingPending(staff))) return false;
        }

        if (shift === '夜' && this.isNightTrainingPending(staff)) {
            return false;
        }

        // If the cell is locked, no changes are allowed
        if (staff.shiftMeta[dateStr] && staff.shiftMeta[dateStr].isLocked) {
            return false;
        }

        // Check Weekly Night Shift Limit (夜勤回数/週) - STRICT ENFORCEMENT
        if (shift === '夜' || shift === '研修（夜）') {
            const limitPerWeek = this.getStaffLimit(staff, ['夜勤回数/週', '夜勤/週', '夜勤制限'], 0);

            if (limitPerWeek > 0) {
                const weekNum = Math.floor(idx / 7);
                const startIdx = weekNum * 7;
                const endIdx = Math.min(startIdx + 7, this.dates.length);

                let nightInWeek = 0;
                for (let i = startIdx; i < endIdx; i++) {
                    const d = this.dates[i];
                    if (d === dateStr) continue;
                    const s = staff.shifts[d];
                    if (s === '夜' || s === '研修（夜）') {
                        nightInWeek++;
                    }
                }

                if (nightInWeek >= limitPerWeek) {
                    return false;
                }
            }
        }

        // Check Weekly Work Limit (勤務日数/週) - STRICT ENFORCEMENT
        if (["早", "日", "遅", "夜", "予", "研", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(shift)) {
            const limitPerWeek = this.getStaffLimit(staff, ['勤務日数/週', '日数/週', '勤務制限'], 0);

            if (limitPerWeek > 0) {
                const weekNum = Math.floor(idx / 7);
                const startIdx = weekNum * 7;
                const endIdx = Math.min(startIdx + 7, this.dates.length);

                let workInWeek = 0;
                for (let i = startIdx; i < endIdx; i++) {
                    const d = this.dates[i];
                    if (d === dateStr) continue;
                    const s = staff.shifts[d];
                    if (["早", "日", "遅", "夜", "予", "研", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(s)) {
                        workInWeek++;
                    }
                }

                if (workInWeek >= limitPerWeek) {
                    return false;
                }
            }
        }

        // Check Monthly Work Limit (公休数)
        // Only if we are trying to assign a WORK shift AND staff is NOT Exclusive
        if (!this.isStaffExclusive(staff) && ["早", "日", "遅", "夜", "予", "研", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(shift)) {
            // Calculate limit
            const availableDays = this.getAvailableDates(staff).length;
            const holidayTarget = this.getRequiredRest(staff);
            const limit = Math.max(0, availableDays - holidayTarget);

            // Count current work days
            let currentWork = 0;
            this.dates.forEach(d => {
                const s = staff.shifts[d];
                // Count Ming as occupied day for holiday calculation logic
                if (["早", "日", "遅", "夜", "予", "研", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(s)) {
                    currentWork++;
                }
            });

            // If we are replacing an empty slot (or non-work), and we are already at or above limit -> DENY
            const existing = staff.shifts[dateStr];
            const isExistingWork = ["早", "日", "遅", "夜", "予", "研", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(existing);

            if (!isExistingWork && currentWork >= limit) {
                // Deny adding new work if limit reached
                return false;
            }
        }

        // 1. Basic consecutive check (this doesn't check shift type, just streak)
        if (this.checkConsecutiveWork(staff, dateStr)) return false;

        // 2. Late -> Early check
        // Case A: Trying to put 'Early', check yesterday
        if ((shift === '早' || shift === '研修（早）') && idx > 0) {
            const yesterday = staff.shifts[this.dates[idx - 1]];
            if (yesterday === '遅' || yesterday === '研修（遅）') return false;
        }
        // Case B: Trying to put 'Late', check tomorrow
        if ((shift === '遅' || shift === '研修（遅）') && idx < this.dates.length - 1) {
            const tomorrow = staff.shifts[this.dates[idx + 1]];
            if (tomorrow === '早' || tomorrow === '研修（早）') return false;
        }

        // 3. Night -> Non-Ming check
        if (shift !== '明' && idx > 0) {
            const yesterday = staff.shifts[this.dates[idx - 1]];
            if (yesterday === '夜' || yesterday === '研修（夜）') return false;
        }

        // 4. Ming -> Rest check (Enforce Night -> Dawn -> Rest)
        if (shift !== '休' && idx > 0) {
            const yesterday = staff.shifts[this.dates[idx - 1]];
            if (yesterday === '明') return false;
        }

        // 夜勤の場合は、次の2日間（明け・休み）も確保できるかチェック
        if (shift === '夜' || shift === '研修（夜）') {
            const idx = this.dates.indexOf(dateStr);
            if (idx === -1) return false;

            // 次の日(明け)と次の次の日(休み)が必要
            const nextDate = this.dates[idx + 1];
            const nextNextDate = this.dates[idx + 2];

            if (!nextDate && !nextNextDate) {
                // Month end - allow Night
            } else {
                if (nextDate) {
                    if (staff.shiftMeta[nextDate]?.isLocked) return false;
                    if (staff.shifts[nextDate] !== "" && staff.shifts[nextDate] !== "明") return false;
                }
                if (nextNextDate) {
                    if (staff.shiftMeta[nextNextDate]?.isLocked) return false;
                    if (staff.shifts[nextNextDate] !== "" && staff.shifts[nextNextDate] !== "休") return false;
                }
            }
        }

        return true;
    }

    execute() {
        this.log(`Starting shift generation for ${this.targetYm}`);

        try {
            this.log("Logic from mystic-shifts used (研修 support and Exclusive lock).");
            this.step0_Initialize();
            this.step1_ApplyCarryOver();
            this.step2_ApplyPreferences();
            this.step2_1_ApplyEmploymentAvailability();
            this.step2_5_ApplyFixedDays(); // New Step
            this.step2_7_ApplyRoleBasedFixedShifts(); // New Step: Role Exemptions
            this.step2_8_ForceAdjustRoleHolidays(); // New Step: Force Adjust Role Holidays
            this.step3_ApplyWorkDaysPerWeek();
            this.step4_ApplyExclusive();
            this.step3_ApplyWorkDaysPerWeek();
            this.step4_ApplyExclusive();
            this.step5_ApplyNightShift();
            this.step6_ApplyEarlyLateShift();
            this.step7_ApplyDayLeader();
            this.step8_ApplyDayShift();
            this.step8_2_ForceFillDeficits(); // New: Force fill shortages
            this.step4_5_ApplyTrainee(); // Moved: Trainees fill their own slots after regulars are done
            this.step5_5_ApplyNightTraining();
            this.step8_5_BalanceWorkDays();
            this.step8_8_AdjustStaffCounts(); // New: Reduce excess staff
            this.step8_9_ForceAdjustTraineeHolidays(); // New: Trainee Holiday Final Check
            this.step9_DistributeOffDays();
            this.cleanupUnavailableShifts();
            // ★調整フェーズは「生成（休の配布まで）」が終わった後に最後に実行する。
            //   ここで日勤不足の穴埋め・公休過多→予(出勤)変換などを行う。
            this.step9_5_ChiefAdjustment();
            this.step10_FinalizeValidation();

            this.log("All steps completed successfully.");
            return {
                success: true,
                table: this.shiftTable,
                dates: this.dates,
                dayOfWeeks: this.dayOfWeeks,
                logs: this.logs
            };

        } catch (error) {
            this.log(`ERROR: ${error.message}`);
            console.error(error);
            return {
                success: false,
                error: error.message,
                logs: this.logs
            };
        }
    }

    // Step 4.5: Apply Trainee (専属研修生)
    step4_5_ApplyTrainee() {
        this.log("Step 4.5: Applying Trainee Shifts...");

        this.shiftTable.forEach(staff => {
            // Check if staff is '研修生'
            const isTrainee = this.isTraineeStaff(staff);

            if (!isTrainee) return;

            this.log(`[Step 4.5] Processing Trainee: ${staff.name}`);

            // 1. Fill empty slots with random Training Shifts
            const trainingTypes = [];
            // Check capabilities for training types (using standard capabilities but mapping to training shifts)
            if (staff['早可'] === '〇' || staff['早可'] === true) trainingTypes.push('研修（早）');
            if (staff['日可'] === '〇' || staff['日可'] === true) trainingTypes.push('研修（日）');
            if (staff['遅可'] === '〇' || staff['遅可'] === true) trainingTypes.push('研修（遅）');

            // If no capabilities set, default to Day
            if (trainingTypes.length === 0) trainingTypes.push('研修（日）');

            this.dates.forEach(date => {
                if (!this.isTrainingDate(staff, date)) return;
                // Skip if already filled (e.g. by Preferences or Previous Steps)
                if (staff.shifts[date] !== "") return;

                const randomShift = trainingTypes[Math.floor(Math.random() * trainingTypes.length)];
                staff.shifts[date] = randomShift;
                staff.shiftMeta[date].isLocked = true;
            });

            // 2. Adjust for Holidays (Monthly Limit)
            // 日付付き研修生（研修開始日/終了日あり）は休数の調整を通常ロジックに任せるためスキップ。
            // ※ただし連勤チェック（下の手順3）は全研修生に必ず適用する。
            if (!this.hasTrainingPeriod(staff)) {
                let currentRest = 0;
                this.dates.forEach(d => {
                    if (staff.shifts[d] === '公' || staff.shifts[d] === '休') currentRest++;
                });

                let requiredRest = this.getRequiredRest(staff);

                let diff = requiredRest - currentRest; // Positive = Need more Rest

                this.log(`  -> Rest Target: ${requiredRest}, Current: ${currentRest}, Need: ${diff}`);

                if (diff > 0) {
                    // Need to insert '休'
                    const candidates = this.dates.filter(d =>
                        staff.shifts[d].startsWith('研修') &&
                        !staff.shiftMeta[d].isPreference
                    );

                    // Shuffle
                    for (let i = candidates.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                    }

                    for (let k = 0; k < diff && k < candidates.length; k++) {
                        const d = candidates[k];
                        staff.shifts[d] = '休';
                        staff.shiftMeta[d].isLocked = true;
                    }
                }
            }

            // 3. Validate and Fix Constraints (Safe Loop) — 連勤(最大4)チェックは全研修生に適用
            // Constraints:
            // a. Late -> Early Forbidden
            // b. Max 5 Consecutive Work Days

            let safetyLoop = 0;
            while (safetyLoop < 50) {
                safetyLoop++;
                let changed = false;

                for (let i = 0; i < this.dates.length; i++) {
                    const date = this.dates[i];
                    const shift = staff.shifts[date];

                    // Guard: Only touch Training or Rest (non-preference)
                    if (staff.shiftMeta[date].isPreference) continue;
                    if (shift !== '休' && !shift.startsWith('研修')) continue;

                    // --- Check Late -> Early ---
                    if (i < this.dates.length - 1) {
                        const cur = staff.shifts[this.dates[i]];
                        const next = staff.shifts[this.dates[i + 1]];

                        if ((cur === '研修（遅）') &&
                            (next === '研修（早）')) {

                            // Fix: Change Next to Day (or Late) or Swap
                            // Simple fix: Change Next to '研修（日）' (if allowed) or '研修（遅）'
                            // Or swap next with a safe shift

                            // Try to changing next to '研修（日）'
                            if (trainingTypes.includes('研修（日）')) {
                                staff.shifts[this.dates[i + 1]] = '研修（日）';
                                changed = true;
                            } else if (trainingTypes.includes('研修（遅）')) {
                                staff.shifts[this.dates[i + 1]] = '研修（遅）';
                                changed = true;
                            } else {
                                // Forced Rest if nothing else works? Or swap
                            }
                        }
                    }

                    // --- Check Consecutive Work > 4 ---
                    // Calculate streak ending at i
                    // If i is start of a 5th consecutive day

                    let streak = 0;
                    const isWork = (s) => ["早", "日", "遅", "夜", "明", "予", "研", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(s);
                    // Look back
                    for (let k = 0; k <= 5; k++) {
                        if (i - k < 0) break;
                        const s = staff.shifts[this.dates[i - k]];
                        if (isWork(s)) {
                            streak++;
                        } else {
                            break;
                        }
                    }

                    if (streak > 4) {
                        // Found 6th day. Need to insert Rest.
                        // Try to swap current day (i) with a future Rest
                        // Find a Rest that is NOT locked/preference and swap

                        const restCandidates = [];
                        for (let r = 0; r < this.dates.length; r++) {
                            const rd = this.dates[r];
                            if (staff.shifts[rd] === '休' && !staff.shiftMeta[rd].isPreference) {
                                restCandidates.push(rd);
                            }
                        }

                        if (restCandidates.length > 0) {
                            // Pick random rest
                            const swapDate = restCandidates[Math.floor(Math.random() * restCandidates.length)];

                            // Perform Swap
                            staff.shifts[swapDate] = staff.shifts[date]; // Move work to rest slot
                            staff.shifts[date] = '休'; // Move rest to here

                            changed = true;
                        } else {
                            // No rest to swap? Force Rest here (will increase rest count but better than violation)
                            staff.shifts[date] = '休';
                            changed = true;
                        }
                    }
                }

                if (!changed) break;
            }
        });
    }

    // =================================================================
    // Step Implementations
    // =================================================================

    step0_Initialize() {
        this.log("Step 0: Initializing shift table...");
        this.log(`Target Month: ${this.targetYm}, Days: ${this.dates.length}`);

        // 2. Load staff from Master (マスタ)
        const rawMasterData = this.data['マスタ'];
        if (!rawMasterData) throw new Error("マスタシートが見つかりません");

        // Helper to normalize values (Full-width to Half-width, Trim)
        const normalizeVal = (val) => {
            if (typeof val === 'string') {
                // Convert full-width numbers/chars to half-width
                // 0xFEE0 is the offset for full-width characters
                return val.trim().replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
            }
            return val;
        };

        this.shiftTable = rawMasterData.map(row => {
            // Normalize Keys (Trim spaces) and Values
            const cleanRow = {};

            // Sort keys: Process DIRTY keys first, CLEAN keys last.
            // This ensures logic: if we have "Name " (val="Old") and "Name" (val="New"),
            // "Name" (Admin) overwrites "Name " (Excel).
            const keys = Object.keys(row).sort((a, b) => {
                const aClean = a === a.trim();
                const bClean = b === b.trim();
                // Dirty (needs trim) comes first (-1), Clean comes last (1)
                if (!aClean && bClean) return -1;
                if (aClean && !bClean) return 1;
                return 0;
            });

            keys.forEach(key => {
                const cleanKey = key.trim();
                cleanRow[cleanKey] = normalizeVal(row[key]);
            });

            // --- ALIAS MERGING ---
            // Merge variations into standard keys to prevent hidden columns from overriding logic
            const aliasMap = {
                '日数/週': '勤務日数/週',
                '勤務制限': '勤務日数/週',
                '週日数': '勤務日数/週',
                '夜勤/週': '夜勤回数/週',
                '夜勤制限': '夜勤回数/週',
                '夜勤回数': '夜勤回数/週',
                '専属フラグ': '専属'
            };

            Object.keys(aliasMap).forEach(alias => {
                const target = aliasMap[alias];
                if (Object.prototype.hasOwnProperty.call(cleanRow, alias)) {
                    // Only use alias value if target is empty/undefined
                    // (This prioritizes the standard key which Admin View uses)
                    if (!cleanRow[target] && cleanRow[alias]) {
                        cleanRow[target] = cleanRow[alias];
                    }
                    // Remove the alias so getStaffLimit doesn't accidentally use it
                    delete cleanRow[alias];
                }
            });
            // ---------------------

            // Create a row for each staff with initialized empty shifts
            const staffRow = {
                name: cleanRow['氏名'],
                ...cleanRow, // Copy normalized props
                shifts: {}, // Map date string to shift value
                shiftMeta: {} // Map date string to { isLocked: boolean }
            };

            // Initialize shifts
            this.dates.forEach(date => {
                staffRow.shifts[date] = "";
                staffRow.shiftMeta[date] = { isLocked: false };
            });

            return staffRow;
        }).filter(s => s.name);

        // Log loaded configuration for verification
        this.log(`--- Loaded Staff Configuration (Normalized & Merged / Admin Priority) ---`);
        this.shiftTable.forEach(s => {
            const isEx = s['専属'] === true || s['専属'] === '〇' || s['専属'] === 'TRUE' ? "Exclusive" : "";
            const days = s['勤務日数/週'] || "-";
            const night = s['夜勤回数/週'] || "-";
            // Log specifically for target users to verify fix
            if (s.name.includes("江崎") || s.name.includes("張") || this.shiftTable.length < 10) {
                this.log(`[${s.name}] : ${isEx} (Work:${days}/w, Night:${night}/w)`);
            }
        });
        this.log(`----------------------------------`);

        this.log(`Initialized table for ${this.shiftTable.length} staff.`);
    }

    step1_ApplyCarryOver() {
        this.log("Step 1: Applying Carry Over...");

        const carrySheet = this.data['繰越'];
        if (!carrySheet) {
            this.log("WARN: '繰越' sheet not found. Skipping Step 1.");
            return;
        }

        // Target dates: first 2 days
        const targetDates = this.dates.slice(0, 2);

        carrySheet.forEach(row => {
            const name = row['氏名'];
            const staff = this.shiftTable.find(s => s.name === name);
            if (!staff) return;

            targetDates.forEach(dateStr => {
                const val = this.findValueByDateKey(row, dateStr);
                if (val) {
                    staff.shifts[dateStr] = val;
                    staff.shiftMeta[dateStr].isLocked = true;
                    this.log(`Applied carry over for ${name} on ${dateStr}: ${val}`);
                }
            });
        });
    }

    step2_1_ApplyEmploymentAvailability() {
        this.log("Step 2.1: Applying employment start dates...");

        this.shiftTable.forEach(staff => {
            const startDate = this.normalizeOptionalDate(staff['入職日']);
            if (!startDate) return;

            this.dates.forEach(date => {
                if (date < startDate) {
                    staff.shifts[date] = '__UNAVAILABLE__';
                    staff.shiftMeta[date] = {
                        ...(staff.shiftMeta[date] || {}),
                        isLocked: true,
                        isUnavailable: true
                    };
                }
            });

            this.log(`[Availability] ${staff.name}: ${startDate} before dates are blank.`);
        });
    }

    step2_ApplyPreferences() {
        this.log("Step 2: Applying Preferences...");

        const prefSheet = this.data['希望'];
        if (!prefSheet) {
            this.log("WARN: '希望' sheet not found. Skipping Step 2.");
            return;
        }

        prefSheet.forEach(row => {
            const name = row['氏名'];
            const staff = this.shiftTable.find(s => s.name === name);
            if (!staff) {
                if (name) this.log(`WARN: Staff ${name} in Preferences not found in Master.`);
                return;
            }

            // Helper to apply preference
            const applyPref = (keyInSheet, symbol) => {
                const raw = row[keyInSheet];
                if (!raw) return;

                const rawStr = String(raw);
                const candidates = rawStr.split(/[,、\s・/]+|\.(?=\d)/);

                candidates.forEach(part => {
                    if (!part) return;
                    const subParts = part.includes('.') ? part.split('.') : [part];

                    subParts.forEach(sub => {
                        if (!sub) return;

                        // Normalization Logic
                        let normalized = this.normalizeDateStr(sub.trim());

                        if (!normalized) {
                            const dayNum = parseInt(sub.trim(), 10);
                            if (!isNaN(dayNum) && dayNum > 0 && dayNum <= 31) {
                                const [y, mStr] = this.targetYm.split('-');
                                const dStr = ("0" + dayNum).slice(-2);
                                const constructed = `${y}/${mStr}/${dStr}`;
                                if (this.dates.includes(constructed)) {
                                    normalized = constructed;
                                }
                            }
                        }

                        // Apply
                        if (normalized && staff.shifts[normalized] !== undefined) {
                            let mappedSymbol = symbol;
                            if (symbol === '遅い') mappedSymbol = '遅';
                            if (symbol === '休み') mappedSymbol = '休';

                            staff.shifts[normalized] = mappedSymbol;
                            staff.shiftMeta[normalized].isLocked = true;
                            staff.shiftMeta[normalized].isPreference = true;
                            this.log(`Pref: ${name} ${normalized} = ${mappedSymbol}`);

                        }
                    });
                });
            };

            applyPref("有休", "有");
            applyPref("休み希望", "休");
            applyPref("出勤不可", "×");
            applyPref("早番希望", "早");
            applyPref("日勤希望", "日");
            applyPref("遅出希望", "遅");
            applyPref("予備", "予");
            applyPref("予備希望", "予");
            applyPref("誕休", "誕");
            applyPref("誕休希望", "誕");
            applyPref("研修", "研");
            applyPref("研修希望", "研");
            applyPref("研修（早）希望", "研修（早）");
            applyPref("研修（日）希望", "研修（日）");
            applyPref("研修（遅）希望", "研修（遅）");
            applyPref("研修（夜）", "研修（夜）");
            applyPref("研修（夜）希望", "研修（夜）");

            // 夜勤希望 (Special handling for 3-day set)
            const rawNight = row["夜勤希望"];
            if (rawNight) {
                const rawStr = String(rawNight);
                const candidates = rawStr.split(/[,、\s・]+/);

                candidates.forEach(part => {
                    if (!part) return;

                    const subParts = part.includes('.') ? part.split('.') : [part];

                    subParts.forEach(sub => {
                        if (!sub) return;

                        let normalized = this.normalizeDateStr(sub.trim());

                        if (!normalized) {
                            const dayNum = parseInt(sub.trim(), 10);
                            if (!isNaN(dayNum) && dayNum > 0 && dayNum <= 31) {
                                const [y, mStr] = this.targetYm.split('-');
                                const dStr = ("0" + dayNum).slice(-2);
                                const constructed = `${y}/${mStr}/${dStr}`;
                                if (this.dates.includes(constructed)) {
                                    normalized = constructed;
                                }
                            }
                        }

                        if (normalized) {
                            this.applyNightShiftSet(staff, normalized, true);
                        }

                    });
                });
            }
        });
    }


    applyNightShiftSet(staff, dateStr, isPreference = false, nightSymbol = '夜') {
        const idx = this.dates.indexOf(dateStr);
        if (idx === -1) return;

        // Determine symbol based on preference if it's already '研修（夜）'
        let symbol = nightSymbol;
        if (staff.shifts[this.dates[idx]] === "研修（夜）") symbol = "研修（夜）";

        // Night
        staff.shifts[this.dates[idx]] = symbol;
        staff.shiftMeta[this.dates[idx]].isLocked = true;
        if (isPreference) staff.shiftMeta[this.dates[idx]].isPreference = true;
        this.log(`Night Set: ${staff.name} ${this.dates[idx]} = ${symbol}`);

        // Dawn (Ming)
        if (idx + 1 < this.dates.length) {
            staff.shifts[this.dates[idx + 1]] = "明";
            staff.shiftMeta[this.dates[idx + 1]].isLocked = true;
            if (isPreference) staff.shiftMeta[this.dates[idx + 1]].isPreference = true;
        }

        // Rest
        if (idx + 2 < this.dates.length) {
            staff.shifts[this.dates[idx + 2]] = "休";
            staff.shiftMeta[this.dates[idx + 2]].isLocked = true;
            if (isPreference) staff.shiftMeta[this.dates[idx + 2]].isPreference = true;
        }
    }


    findValueByDateKey(row, updateDateStr) {
        const key = this.findKeyForDate(row, updateDateStr);
        return key ? row[key] : null;
    }

    // Helper to get limit value from staff object with multiple key support
    getStaffLimit(staff, possibleKeys, defaultVal = 0) {
        for (const key of possibleKeys) {
            const val = staff[key];
            if (val !== undefined && val !== null && val !== "") {
                const num = parseInt(String(val).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)), 10);
                if (!isNaN(num)) return num;
            }
        }
        return defaultVal;
    }

    // Helper to check if staff is exclusive (Robust check)
    isStaffExclusive(staff) {
        const val = staff['専属'];
        return val === true || val === '〇' || val === 'TRUE' || val === 1 || val === '1';
    }

    // Step 2.5: Apply Fixed Days (曜日固定)
    step2_5_ApplyFixedDays() {
        this.log("Step 2.5: Applying Fixed Days...");

        this.shiftTable.forEach(staff => {
            const fixedDaysRaw = staff['曜日固定'];
            if (!fixedDaysRaw) return;

            const fixedDays = String(fixedDaysRaw).split(/[/\s,、]+/).map(d => d.trim()).filter(d => d);

            if (fixedDays.length === 0) return;

            this.log(`Fixed Days for ${staff.name}: ${fixedDays.join(', ')}`);

            this.dates.forEach((date, i) => {
                const dayOfWeek = this.dayOfWeeks[i]; // "月", "火"...

                if (!fixedDays.includes(dayOfWeek)) {
                    const current = staff.shifts[date];
                    if (current === "明") return;
                    if (current !== "") return;

                    // Mark as Rest "休"
                    staff.shifts[date] = "休";
                    staff.shiftMeta[date].isLocked = true;
                }
            });
        });
    }

    // Step 2.7: Apply Role-Based Fixed Shifts (サ責, 施設長, 事務員 -> 予)
    step2_7_ApplyRoleBasedFixedShifts() {
        this.log("Step 2.7: Applying Role-Based Shifts (予/Random Rest)...");

        this.shiftTable.forEach(staff => {
            // Check roles
            const isManager = staff['サ責'] === true || staff['サ責'] === '〇' || staff['サ責'] === 'TRUE';
            const isDirector = staff['施設長'] === true || staff['施設長'] === '〇' || staff['施設長'] === 'TRUE';
            const isClerk = staff['事務員'] === true || staff['事務員'] === '〇' || staff['事務員'] === 'TRUE';
            const isAdmin = staff['管理者'] === true || staff['管理者'] === '〇' || staff['管理者'] === 'TRUE';
            const isChief = staff['主任'] === true || staff['主任'] === '〇' || staff['主任'] === 'TRUE';

            if (isManager || isDirector || isClerk || isAdmin || isChief) {
                // 1. Fill empty spots with '予'
                this.dates.forEach(date => {
                    if (staff.shifts[date] === "") {
                        staff.shifts[date] = '予';
                        staff.shiftMeta[date].isLocked = true;
                    }
                });

                // 2. Adjust '予' to '休' to meet monthly holiday requirement
                if (isDirector || isAdmin || isClerk || isManager || isChief) {
                    let currentRestCount = 0;
                    this.dates.forEach(d => {
                        if (staff.shifts[d] === '公' || staff.shifts[d] === '休') {
                            currentRestCount++;
                        }
                    });

                    let requiredRest = this.getRequiredRest(staff);

                    this.log(`[Role Check] Staff: ${staff.name}, CurrentRest: ${currentRestCount}, Required: ${requiredRest}`);

                    if (currentRestCount < requiredRest) {
                        let needed = requiredRest - currentRestCount;
                        this.log(`[Role Check] Shortage detected: ${needed} days. Filling with '休' randomly.`);

                        // Find all '予' slots (excluding preference)
                        const candidates = this.dates.filter(d => staff.shifts[d] === '予' && !staff.shiftMeta[d].isPreference);

                        // Fisher-Yates Shuffle - ensuring randomness
                        for (let i = candidates.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                        }

                        // Fill needed amount
                        for (let k = 0; k < needed && k < candidates.length; k++) {
                            const date = candidates[k];
                            staff.shifts[date] = '休';
                            staff.shiftMeta[date].isLocked = true;
                        }

                            // --- Enforce Max 5 Consecutive Work Days (Role Staff) ---
                            // Swap '休' into streaks if necessary, maintaining total rest count.
                            let safetyLoop = 0;
                            while (safetyLoop < 20) {
                                safetyLoop++;
                                let maxStreak = 0;
                                let streakStart = -1;
                                let streakEnd = -1;

                                let currentRun = 0;
                                let runStart = 0;

                                // 「明」と「予」と「研」も勤務カウント
                                const isWork = (s) => s === '予' || ["早", "日", "遅", "夜", "明", "研", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(s);

                                for (let i = 0; i < this.dates.length; i++) {
                                    const d = this.dates[i];
                                    const s = staff.shifts[d];
                                    if (isWork(s)) {
                                        if (currentRun === 0) runStart = i;
                                        currentRun++;
                                    } else {
                                        if (currentRun > maxStreak) {
                                            maxStreak = currentRun;
                                            streakStart = runStart;
                                            streakEnd = i - 1;
                                        }
                                        currentRun = 0;
                                    }
                                }
                                if (currentRun > maxStreak) {
                                    maxStreak = currentRun;
                                    streakStart = runStart;
                                    streakEnd = this.dates.length - 1;
                                }

                                if (maxStreak <= 5) break;

                            // Need to insert a break in the streak
                            let possibleBreakIndices = [];
                            for (let i = streakStart; i <= streakEnd; i++) {
                                const dateStr = this.dates[i];
                                if (staff.shifts[dateStr] === '予' && !staff.shiftMeta[dateStr].isPreference) {
                                    possibleBreakIndices.push(i);
                                }
                            }

                            if (possibleBreakIndices.length === 0) {
                                this.log(`[Role Fix] Cannot break streak for ${staff.name}, no '予' found.`);
                                break;
                            }

                            const breakIdx = possibleBreakIndices[Math.floor(Math.random() * possibleBreakIndices.length)];
                            const breakDate = this.dates[breakIdx];

                            // Find a '休' to swap with
                            const swapCandidates = this.dates.filter(d =>
                                staff.shifts[d] === '休' &&
                                !staff.shiftMeta[d].isPreference &&
                                d !== breakDate
                            );

                            if (swapCandidates.length > 0) {
                                const swapDate = swapCandidates[Math.floor(Math.random() * swapCandidates.length)];

                                // Swap
                                staff.shifts[breakDate] = '休';
                                staff.shiftMeta[breakDate].isLocked = true;

                                staff.shifts[swapDate] = '予';
                                staff.shiftMeta[swapDate].isLocked = true;
                            } else {
                                // Forced break
                                staff.shifts[breakDate] = '休';
                                staff.shiftMeta[breakDate].isLocked = true;
                            }
                        }
                    }
                }
            }
        });
    }

    // Step 2.8: Force Adjust Role Holidays (役職者の公休数不足・過多を強制補正)
    step2_8_ForceAdjustRoleHolidays() {
        this.log("Step 2.8: Force Adjusting Role Holidays (Shortage & Excess)...");

        this.shiftTable.forEach(staff => {
            // 1. 対象者判定（役職者のみ）
            const isManager = staff['サ責'] === true || staff['サ責'] === '〇' || staff['サ責'] === 'TRUE';
            const isDirector = staff['施設長'] === true || staff['施設長'] === '〇' || staff['施設長'] === 'TRUE';
            const isClerk = staff['事務員'] === true || staff['事務員'] === '〇' || staff['事務員'] === 'TRUE';
            const isAdmin = staff['管理者'] === true || staff['管理者'] === '〇' || staff['管理者'] === 'TRUE';
            const isChief = staff['主任'] === true || staff['主任'] === '〇' || staff['主任'] === 'TRUE';

            if (!isManager && !isDirector && !isClerk && !isAdmin && !isChief) return;

            // 2. 目標と現状の比較
            let currentRest = 0;
            this.dates.forEach(d => {
                if (staff.shifts[d] === '公' || staff.shifts[d] === '休') currentRest++;
            });

            // Use robust parsing for Public Holidays
            const requiredRest = this.getRequiredRest(staff);

            const diff = requiredRest - currentRest; // Positive = Shortage, Negative = Excess

            this.log(`[Step 2.8] ${staff.name}: Req=${requiredRest}, Cur=${currentRest}, Diff=${diff}`);

            if (diff > 0) {
                // --- Case A: Shortage (Need more '休') ---
                const needed = diff;
                this.log(`  -> Shortage of ${needed}. Replacing '予' with '休'.`);

                const candidates = this.dates.filter(d => staff.shifts[d] === '予');

                // Shuffle
                for (let i = candidates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                }

                for (let k = 0; k < needed && k < candidates.length; k++) {
                    const d = candidates[k];
                    staff.shifts[d] = '休';
                    staff.shiftMeta[d].isLocked = true;
                    this.log(`    -> ${d}: 予 => 休`);
                }

            } else if (diff < 0) {
                // --- Case B: Excess (Too many '休') ---
                const excess = Math.abs(diff);
                this.log(`  -> Excess of ${excess}. Replacing '休' with '予'.`);

                // We can only remove '休' that are NOT preference-locked or carry-over locked?
                // Step 2.7 generated '休' are locked, so we check if it is a Preference.
                // If isPreference is true, we should NOT touch it.
                // If it was auto-generated in 2.5(FixedDays) or 2.7(Role), we might need to touch it.
                // However, messing with FixedDays (Step 2.5) is risky.
                // Let's target '休' that are NOT preferences.

                const candidates = this.dates.filter(d =>
                    staff.shifts[d] === '休' &&
                    !staff.shiftMeta[d].isPreference
                );

                // Shuffle
                for (let i = candidates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                }

                for (let k = 0; k < excess && k < candidates.length; k++) {
                    const d = candidates[k];
                    staff.shifts[d] = '予';
                    staff.shiftMeta[d].isLocked = true;
                    this.log(`    -> ${d}: 休 => 予`);
                }
            }
        });
    }

    // Step 3: Apply Work Days Per Week (勤務日数/週)
    step3_ApplyWorkDaysPerWeek() {
        this.log("Step 3: Applying Work Days Per Week constraints...");

        this.shiftTable.forEach(staff => {
            if (!staff['勤務日数/週']) return;

            const limitPerWeek = parseInt(staff['勤務日数/週'], 10);
            if (isNaN(limitPerWeek) || limitPerWeek <= 0) return;

            this.dates.forEach((date, i) => {
                const day = i + 1;
                if (day % 7 === 1 || i === 0) {
                    const weekDates = [];
                    for (let j = 0; j < 7; j++) {
                        if (i + j < this.dates.length) weekDates.push(this.dates[i + j]);
                    }

                    let rests = 0;

                    weekDates.forEach(d => {
                        const val = staff.shifts[d];
                        if (val === "休") rests++;
                    });

                    const requiredRest = 7 - limitPerWeek;
                    let neededRest = requiredRest - rests;

                    if (neededRest > 0) {
                        const emptyDates = weekDates.filter(d => staff.shifts[d] === "");
                        for (let k = emptyDates.length - 1; k > 0; k--) {
                            const r = Math.floor(Math.random() * (k + 1));
                            [emptyDates[k], emptyDates[r]] = [emptyDates[r], emptyDates[k]];
                        }

                        for (let k = 0; k < neededRest && k < emptyDates.length; k++) {
                            staff.shifts[emptyDates[k]] = "休";
                        }
                    }
                }
            });
        });
    }

    // Step 4: Apply Exclusive (専属反映)
    step4_ApplyExclusive() {
        this.log("Step 4: Applying Exclusive Staff (Restored Logic)...");

        const reqSheet = this.data['要員数'];
        const reqMap = {};
        if (reqSheet) {
            reqSheet.forEach(row => {
                const rawDate = row['日付'];
                const normalizedDate = this.normalizeDateStr(rawDate);
                if (normalizedDate && this.dates.includes(normalizedDate)) {
                    reqMap[normalizedDate] = {
                        '早': parseInt(row['早必要'] || 0, 10),
                        '日': parseInt(row['日必要'] || row['日勤必要'] || row['日'] || 0, 10),
                        '遅': parseInt(row['遅必要'] || 0, 10),
                        '夜': parseInt(row['夜必要'] || 0, 10)
                    };
                }
            });
        }

        // Current count helper
        const getCurrentCounts = () => {
            const counts = {};
            this.dates.forEach(d => { counts[d] = { '早': 0, '日': 0, '遅': 0, '夜': 0 }; });
            this.shiftTable.forEach(s => {
                this.dates.forEach(d => {
                    const v = s.shifts[d];
                    const baseV = (v && v.includes && v.includes('研修')) ? v.match(/（(.*?)）/)?.[1] : v;
                    if (['早', '日', '遅', '夜'].includes(baseV)) counts[d][baseV]++;
                });
            });
            return counts;
        };

        const exclusiveStaff = this.shiftTable.filter(s => this.isStaffExclusive(s));

        // Sort: Night-only exclusive first, then others
        exclusiveStaff.sort((a, b) => {
            const canShift = (s, k) => s[k] === true || s[k] === "TRUE" || s[k] === 1 || String(s[k]).trim() === "〇";
            const aNight = canShift(a, '夜可') && !(canShift(a, '日可') || canShift(a, '早可') || canShift(a, '遅可'));
            const bNight = canShift(b, '夜可') && !(canShift(b, '日可') || canShift(b, '早可') || canShift(b, '遅可'));
            return (bNight ? 1 : 0) - (aNight ? 1 : 0);
        });

        exclusiveStaff.forEach(staff => {
            const canShift = (key) => staff[key] === true || staff[key] === "TRUE" || staff[key] === 1 || String(staff[key]).trim() === "〇";
            const bands = [];
            if (canShift('早可')) bands.push('早');
            if (canShift('日可')) bands.push('日');
            if (canShift('遅可')) bands.push('遅');
            if (canShift('夜可')) bands.push('夜');

            // Night Shift Assignment for Exclusive
            if (bands.includes('夜')) {
                for (let i = 0; i < this.dates.length; i++) {
                    const date = this.dates[i];
                    if (staff.shifts[date] !== "") continue;

                    const needed = reqMap[date]?.['夜'] || 0;
                    const counts = getCurrentCounts();
                    const current = counts[date]['夜'];

                    if (current < needed) {
                        if (this.isShiftAllowed(staff, date, '夜')) {
                            // Logic handles EOM now
                            const d1 = this.dates[i + 1];
                            const d2 = this.dates[i + 2];

                            this.applyNightShiftSet(staff, date);
                            staff.shiftMeta[date].isLocked = true;
                            if (d1) staff.shiftMeta[d1].isLocked = true;
                            if (d2) staff.shiftMeta[d2].isLocked = true;
                        }
                    }
                }
            }

            // Day Shift Assignment
            const dayBands = bands.filter(b => b !== '夜');
            if (dayBands.length > 0) {
                const randDates = [...this.dates].sort(() => Math.random() - 0.5);
                randDates.forEach(date => {
                    if (staff.shifts[date] !== "") return;

                    const counts = getCurrentCounts();

                    // Shuffle bands to prevent bias (e.g., always filling 'Early' first)
                    const shuffledBands = [...dayBands].sort(() => Math.random() - 0.5);

                    for (const band of shuffledBands) {
                        const needed = reqMap[date]?.[band] || 0;
                        const current = counts[date][band];
                        if (current < needed) {
                            if (this.isShiftAllowed(staff, date, band)) {
                                staff.shifts[date] = band;
                                staff.shiftMeta[date].isLocked = true;
                                break;
                            }
                        }
                    }
                });

                // Log verification (Optional, for debugging)
                const summary = {};
                dayBands.forEach(b => summary[b] = 0);
                this.dates.forEach(d => {
                    const s = staff.shifts[d];
                    if (dayBands.includes(s)) summary[s]++;
                });
                this.log(`[Exclusive Balance] ${staff.name}: ${JSON.stringify(summary)}`);
            }

            // Fill remaining with Rest
            this.dates.forEach(d => {
                if (staff.shifts[d] === "") {
                    staff.shifts[d] = "休";
                    staff.shiftMeta[d].isLocked = true;
                }
            });

            // --- Adjustment for Full-Time Exclusive Staff (Weekly Days = 5) ---
            // Ensure their total holiday count matches the monthly requirement to remove yellow warnings.
            if (parseInt(staff['勤務日数/週'], 10) === 5) {
                const requiredRest = this.getRequiredRest(staff);

                let loopGuard = 0;
                while (loopGuard < 20) {
                    loopGuard++;
                    const currentRest = this.dates.filter(d => staff.shifts[d] === '休' || staff.shifts[d] === '公').length;

                    if (currentRest === requiredRest) break;

                    if (currentRest > requiredRest) {
                        // Too many rests: Change a '休' to a work day (randomly available shift)
                        // Be careful not to break Night-Ming-Rest sequence or restrictions
                        // Find convertible '休' days (not part of Night set, preferably not preference)
                        const candidates = this.dates.filter((d, i) => {
                            if (staff.shifts[d] !== '休') return false;

                            // Check if part of Night set (Night->Ming->Rest)
                            // If previous day is Ming, this Rest is likely mandatory.
                            if (i > 0 && staff.shifts[this.dates[i - 1]] === '明') return false;

                            return true;
                        });

                        if (candidates.length === 0) break;

                        // Pick random
                        const targetDate = candidates[Math.floor(Math.random() * candidates.length)];

                        // Try to assign a work shift (Day, Early, Late)
                        const dayBands = bands.filter(b => b !== '夜');
                        const shuffledBands = [...dayBands].sort(() => Math.random() - 0.5); // Randomize preference

                        for (const band of shuffledBands) {
                            if (this.isShiftAllowed(staff, targetDate, band)) {
                                staff.shifts[targetDate] = band;
                                // We keep lock as true since this is a fix
                                staff.shiftMeta[targetDate].isLocked = true;
                                break;
                            }
                        }
                        // If no band allowed, maybe leave as rest or try next loop
                    }
                    else if (currentRest < requiredRest) {
                        // Not enough rests: Change a work day to '休'
                        // Find convertible work days (Early, Day, Late)
                        // Avoid Night/Ming
                        const candidates = this.dates.filter(d => {
                            const s = staff.shifts[d];
                            return ["早", "日", "遅"].includes(s) && !staff.shiftMeta[d].isPreference;
                        });

                        if (candidates.length === 0) break;

                        const targetDate = candidates[Math.floor(Math.random() * candidates.length)];
                        staff.shifts[targetDate] = '休';
                        staff.shiftMeta[targetDate].isLocked = true;
                    }
                }
            }
        });
    }

    // Step 5: Apply Night Shift (夜勤均等化)
    step5_ApplyNightShift() {
        this.log("Step 5: Applying Night Shifts...");
        const reqSheet = this.data['要員数'];
        if (!reqSheet) return;

        const reqMap = {};
        reqSheet.forEach(row => {
            const rawDate = row['日付'];
            const normalizedDate = this.normalizeDateStr(rawDate);
            if (normalizedDate && this.dates.includes(normalizedDate)) {
                reqMap[normalizedDate] = {
                    night: parseInt(row['夜必要'] || 0, 10)
                };
            }
        });

        const nightCounts = {};
        this.shiftTable.forEach(s => nightCounts[s.name] = 0);

        this.dates.forEach((date, i) => {
            const req = reqMap[date];
            if (!req || req.night <= 0) return;

            // Exclude '研修（夜）' from count
            const currentNight = this.shiftTable.filter(s => s.shifts[date] === '夜').length;
            let need = req.night - currentNight;

            if (need <= 0) return;

            let candidates = this.shiftTable.filter(s => {
                if (this.isStaffExclusive(s) && s.shiftMeta[date].isLocked) return false;
                const canNight = s['夜可'] === true || s['夜可'] === "TRUE" || s['夜可'] === 1 || String(s['夜可']).trim() === "〇";
                if (!canNight) return false;
                if (s.shifts[date] !== "") return false;

                // Exclude active trainees from regular Night Shift assignment.
                if (this.isTrainingDate(s, date)) return false;

                // Use strict check including weekly night limits
                if (!this.isShiftAllowed(s, date, '夜')) return false;

                // Additional safety for Night set (Dawn + Rest need to be assignable)
                if (i < this.dates.length - 1 && s.shifts[this.dates[i + 1]] !== "" && !s.shiftMeta[this.dates[i + 1]].isLocked) {
                    // if next day is not empty, check if it's already '明'
                    if (s.shifts[this.dates[i + 1]] !== "明") return false;
                }
                if (i < this.dates.length - 1 && s.shifts[this.dates[i + 1]] !== "" && s.shiftMeta[this.dates[i + 1]].isLocked) {
                    if (s.shifts[this.dates[i + 1]] !== "明") return false;
                }

                return true;
            });

            while (need > 0 && candidates.length > 0) {
                candidates.sort((a, b) => nightCounts[a.name] - nightCounts[b.name]);
                const bestCount = nightCounts[candidates[0].name];
                const pool = candidates.filter(s => nightCounts[s.name] === bestCount);
                const chosen = pool[Math.floor(Math.random() * pool.length)];

                this.applyNightShiftSet(chosen, date);
                nightCounts[chosen.name]++;
                need--;
                candidates = candidates.filter(c => c !== chosen);
            }
        });
    }

    step5_5_ApplyNightTraining() {
        this.log("Step 5.5: Applying one-time night training...");

        const canReplaceForNightTraining = (staff, date, allowedValues) => {
            if (!date) return true;
            const meta = staff.shiftMeta[date] || {};
            if (meta.isPreference || meta.isUnavailable) return false;
            const current = staff.shifts[date];
            if (current === "") return true;
            if (allowedValues.includes(current)) return true;
            return typeof current === 'string' && current.startsWith('研修');
        };

        const targets = this.shiftTable.filter(staff => {
            const canNight = this.isTruthyMark(staff['夜可']);
            return canNight && this.isNightTrainingPending(staff);
        });

        targets.forEach(staff => {
            // 研修終了日以降の「一番最初の夜勤」を研修夜勤にする。
            // 研修終了日が未設定の場合は、従来どおり月内で最初に置ける夜に割り当てる。
            const trainingEnd = this.normalizeOptionalDate(staff['研修終了日']);
            for (let i = 0; i < this.dates.length; i++) {
                const date = this.dates[i];
                if (this.isBeforeEmployment(staff, date)) continue;
                // 研修終了日より前の日付は対象外（研修期間中は昼の研修のため）
                if (trainingEnd && date < trainingEnd) continue;

                // Put night training on a day where a regular night worker is already present.
                const hasRegularNight = this.shiftTable.some(other => other !== staff && other.shifts[date] === '夜');
                if (!hasRegularNight) continue;

                const nextDate = this.dates[i + 1];
                const nextNextDate = this.dates[i + 2];
                if (!canReplaceForNightTraining(staff, date, ["早", "日", "遅", "予", "研", "休"])) continue;
                if (!canReplaceForNightTraining(staff, nextDate, ["早", "日", "遅", "予", "研", "明", "休"])) continue;
                if (!canReplaceForNightTraining(staff, nextNextDate, ["早", "日", "遅", "予", "研", "休"])) continue;

                staff.shifts[date] = "";
                staff.shiftMeta[date] = { ...(staff.shiftMeta[date] || {}), isLocked: false };
                if (nextDate) {
                    staff.shifts[nextDate] = "";
                    staff.shiftMeta[nextDate] = { ...(staff.shiftMeta[nextDate] || {}), isLocked: false };
                }
                if (nextNextDate) {
                    staff.shifts[nextNextDate] = "";
                    staff.shiftMeta[nextNextDate] = { ...(staff.shiftMeta[nextNextDate] || {}), isLocked: false };
                }
                this.applyNightShiftSet(staff, date, false, '研修（夜）');
                staff['夜勤研修'] = '済';
                this.log(`[Night Training] ${staff.name}: ${date} 研修（夜） assigned.`);
                return;
            }

            this.log(`[Night Training] WARN: ${staff.name} needs night training, but no assignable date was found.`);
        });
    }

    step6_ApplyEarlyLateShift() {
        this.log("Step 6: Applying Early/Late Shifts (Balanced Mixed Distribution)...");
        const reqSheet = this.data['要員数'];
        if (!reqSheet) return;

        const reqMap = {};
        reqSheet.forEach(row => {
            const rawDate = row['日付'];
            const normalizedDate = this.normalizeDateStr(rawDate);
            if (normalizedDate && this.dates.includes(normalizedDate)) {
                reqMap[normalizedDate] = {
                    early: parseInt(row['早必要'] || 0, 10),
                    late: parseInt(row['遅必要'] || 0, 10)
                };
            }
        });

        const types = [
            { id: '早', prop: '早可', reqKey: 'early' },
            { id: '遅', prop: '遅可', reqKey: 'late' }
        ];

        // 1. Build a list of all needed tasks (date + shift type partials)
        let tasks = [];
        this.dates.forEach(date => {
            const req = reqMap[date];
            if (!req) return;

            types.forEach(type => {
                // Exclude '研修（...）' from count
                const current = this.shiftTable.filter(s => s.shifts[date] === type.id).length;
                let needed = req[type.reqKey] - current;

                // Add task entries for each needed slot
                for (let k = 0; k < needed; k++) {
                    tasks.push({ date: date, typeId: type.id, prop: type.prop });
                }
            });
        });

        // 2. Shuffle tasks to prevent sequential bias (Early first then Late)
        for (let i = tasks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
        }

        // Initialize counts
        const typeCounts = { '早': {}, '遅': {} };
        this.shiftTable.forEach(s => {
            typeCounts['早'][s.name] = 0;
            typeCounts['遅'][s.name] = 0;
        });

        // 3. Process Tasks
        tasks.forEach(task => {
            // Find candidates
            let candidates = this.shiftTable.filter(s => {
                if (this.isTrainingDate(s, task.date)) return false;

                if (this.isStaffExclusive(s) && s.shiftMeta[task.date].isLocked) return false;

                // Check ability
                const canDo = s[task.prop] === true || s[task.prop] === "TRUE" || s[task.prop] === 1 || String(s[task.prop]).trim() === "〇";
                if (!canDo) return false;

                // Check empty
                if (s.shifts[task.date] !== "") return false;

                // Check constraints
                if (!this.isShiftAllowed(s, task.date, task.typeId)) return false;

                return true;
            });

            if (candidates.length > 0) {
                // Sort by count of THIS type to ensure rotation equality
                candidates.sort((a, b) => typeCounts[task.typeId][a.name] - typeCounts[task.typeId][b.name]);

                // Filter pool of best candidates
                const bestVal = typeCounts[task.typeId][candidates[0].name];
                const pool = candidates.filter(s => typeCounts[task.typeId][s.name] === bestVal);

                // Random pick from pool
                const chosen = pool[Math.floor(Math.random() * pool.length)];

                // Assign
                chosen.shifts[task.date] = task.typeId;
                typeCounts[task.typeId][chosen.name]++;
            }
        });
    }

    step7_ApplyDayLeader() {
        this.log("Step 7: Applying Day Leaders...");
        const reqSheet = this.data['要員数'];
        const reqMap = {};
        reqSheet?.forEach(row => {
            const rawDate = row['日付'];
            const normalizedDate = this.normalizeDateStr(rawDate);
            if (normalizedDate && this.dates.includes(normalizedDate)) {
                let val = row['日勤リーダー必要'] || row['リーダー必要'] || row['リーダー'];
                reqMap[normalizedDate] = (val !== undefined) ? parseInt(val, 10) : 1;
            }
        });

        const leaderCounts = {};
        this.shiftTable.forEach(s => leaderCounts[s.name] = 0);

        this.dates.forEach(date => {
            const leadersWorking = this.shiftTable.filter(s => {
                const isL = s['日勤リーダー'] === true || s['日勤リーダー'] === "TRUE" || String(s['日勤リーダー']).trim() === "〇";
                // Exclude Trainee shifts from Leader count
                return isL && ["早", "日", "遅"].includes(s.shifts[date]);
            });

            if (leadersWorking.length > 0) return;

            let candidates = this.shiftTable.filter(s => {
                if (this.isTrainingDate(s, date)) return false;

                if (this.isStaffExclusive(s) && s.shiftMeta[date].isLocked) return false;
                if (s.shifts[date] !== "") return false;
                const isLeader = s['日勤リーダー'] === true || s['日勤リーダー'] === "TRUE" || String(s['日勤リーダー']).trim() === "〇";
                if (!isLeader) return false;
                if (!this.isShiftAllowed(s, date, '日')) return false;
                return true;
            });

            if (candidates.length > 0) {
                candidates.sort((a, b) => leaderCounts[a.name] - leaderCounts[b.name]);
                const pool = candidates.filter(s => leaderCounts[s.name] === leaderCounts[candidates[0].name]);
                const chosen = pool[Math.floor(Math.random() * pool.length)];
                chosen.shifts[date] = "日";
                leaderCounts[chosen.name]++;
            }
        });
    }

    step8_ApplyDayShift() {
        this.log("Step 8: Applying Day Shifts...");
        const reqSheet = this.data['要員数'];
        if (!reqSheet) return;

        const reqMap = {};
        reqSheet.forEach(row => {
            const rawDate = row['日付'];
            const normalizedDate = this.normalizeDateStr(rawDate);
            if (normalizedDate && this.dates.includes(normalizedDate)) {
                let val = row['日勤必要'] || row['日必要'] || row['日勤'] || row['日'] || 0;
                reqMap[normalizedDate] = parseInt(val, 10);
            }
        });

        const counts = {};
        this.shiftTable.forEach(s => {
            let c = 0;
            this.dates.forEach(d => {
                const sh = s.shifts[d];
                // Count existing work shifts to ensure fairness
                if (["早", "日", "遅", "夜", "予"].includes(sh) || (sh && sh.includes && sh.includes("研修"))) {
                    c++;
                }
            });
            counts[s.name] = c;
        });

        this.dates.forEach(date => {
            const req = reqMap[date];
            if (!req) return;

            let need = req;
            const current = this.shiftTable.filter(s => s.shifts[date] === '日' || s.shifts[date] === '研修（日）').length;
            need -= current;

            if (need <= 0) return;

            let candidates = this.shiftTable.filter(s => {
                if (this.isTrainingDate(s, date)) return false;

                if (this.isStaffExclusive(s) && s.shiftMeta[date].isLocked) return false;
                if (s.shifts[date] !== "") return false;
                if (!this.isShiftAllowed(s, date, '日')) return false;
                const canDay = s['日可'] === true || s['日可'] === "TRUE" || String(s['日可']).trim() === "〇";
                return canDay;
            });

            while (need > 0 && candidates.length > 0) {
                candidates.sort((a, b) => counts[a.name] - counts[b.name]);
                const pool = candidates.filter(s => counts[s.name] === counts[candidates[0].name]);
                const chosen = pool[Math.floor(Math.random() * pool.length)];
                chosen.shifts[date] = '日';
                counts[chosen.name]++;
                need--;
                candidates = candidates.filter(s => s !== chosen);
            }
        });
    }

    step8_2_ForceFillDeficits() {
        this.log("Step 8.2: Force Filling Deficits...");

        const parseIntSafe = (val) => {
            if (!val) return 0;
            // Normalize full-width numbers
            const s = String(val).trim().replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
            const n = parseInt(s, 10);
            return isNaN(n) ? 0 : n;
        };

        const calculateDeficit = (staff) => {
            let targetWork = 0;
            const workDaysStr = staff['勤務日数/週'];
            const workDays = parseIntSafe(workDaysStr);
            const availableDates = this.getAvailableDates(staff);
            const availableDays = availableDates.length;

            // Priority: Work Days Per Week
            if (workDays > 0) {
                targetWork = Math.floor((availableDays / 7) * workDays);
            } else {
                // Fallback: Holiday count（日割り按分は getRequiredRest に統一）
                const restTarget = this.getRequiredRest(staff);
                targetWork = Math.max(0, availableDays - restTarget);
            }

            let currentWork = 0;
            this.dates.forEach(d => {
                const s = staff.shifts[d];
                if (["早", "日", "遅", "夜", "予"].includes(s) || (s && s.includes("研修"))) currentWork++;
            });

            return targetWork - currentWork;
        };

        this.shiftTable.forEach(staff => {
            if (this.isTraineeStaff(staff) && !this.hasTrainingPeriod(staff)) return;

            let deficit = calculateDeficit(staff);

            // Debug logging for specific staff investigation
            const isDebugTarget = staff.name.includes("江崎") || staff.name.includes("張");
            if (isDebugTarget) {
                const workDays = parseIntSafe(staff['勤務日数/週']);
                const reqRest = parseIntSafe(staff['公休数']);
                this.log(`DEBUG [${staff.name}]: Deficit=${deficit}, Current=${calculateDeficit(staff) * -1 + 20 /*approx*/}. (WorkDays/W setting="${staff['勤務日数/週']}"->${workDays}, Holiday setting="${staff['公休数']}"->${reqRest})`);
            }

            if (deficit <= 0) return;

            this.log(`WARN: ${staff.name} is short by ${deficit} days. Force filling...`);

            const indices = this.dates.map((_, i) => i).sort(() => Math.random() - 0.5);

            for (const i of indices) {
                if (deficit <= 0) break;
                const date = this.dates[i];

                if (staff.shifts[date] === "") {
                    // Check strict rules only
                    if (this.isShiftAllowed(staff, date, '日')) {
                        const canDay = staff['日可'] === true || staff['日可'] === "TRUE" || String(staff['日可']).trim() === "〇";
                        if (canDay) {
                            staff.shifts[date] = '日';
                            staff.shiftMeta[date].isForceFilled = true;
                            deficit--;
                        } else {
                            if (isDebugTarget) this.log(`  -> Skipped [${date}]: Day shift not allowed (日可=${staff['日可']})`);
                        }
                    } else {
                        if (isDebugTarget) this.log(`  -> Skipped [${date}]: Shift allowed check failed (Consecutive/Interval rules?)`);
                    }
                }
            }
        });
    }

    step8_5_BalanceWorkDays() {
        this.log("Step 8.5: Balancing Work Days (Shift Swap)...");

        const calculateStats = () => {
            const stats = [];
            this.shiftTable.forEach(s => {
                const availableDays = this.getAvailableDates(s).length;
                let target = 0;
                if (s['勤務日数/週'] && parseInt(s['勤務日数/週'], 10) > 0) {
                    target = Math.floor((availableDays / 7) * parseInt(s['勤務日数/週'], 10));
                } else {
                    // 在籍日数 − 按分公休（月途中入職に対応）
                    target = availableDays - this.getRequiredRest(s);
                }
                let current = 0;
                this.dates.forEach(d => {
                    const v = s.shifts[d];
                    const baseV = (v && v.includes && v.includes('研修')) ? v.match(/（(.*?)）/)?.[1] : v;
                    if (["早", "日", "遅", "夜"].includes(baseV)) current++;
                });
                stats.push({ staff: s, target, current, diff: current - target });
            });
            return stats;
        };

        let loopCount = 0;
        while (loopCount < 100) {
            loopCount++;
            const stats = calculateStats();
            // Allow exclusives to participate in balancing (as receiver or provider) if they match criteria
            const needy = stats.filter(s => s.diff < 0).sort((a, b) => a.diff - b.diff);
            const rich = stats.filter(s => s.diff > 0).sort((a, b) => b.diff - a.diff);

            if (needy.length === 0 || rich.length === 0) break;

            let swapped = false;
            for (const n of needy) {
                const receiver = n.staff;
                for (const date of this.dates) {
                    if (receiver.shifts[date] !== "") continue;

                    const candidateProvider = rich.find(r => ["早", "日", "遅"].includes(r.staff.shifts[date]));
                    if (candidateProvider) {
                        const giver = candidateProvider.staff;
                        const shiftType = giver.shifts[date];
                        if (!this.isShiftAllowed(receiver, date, shiftType)) continue;

                        giver.shifts[date] = "休";
                        receiver.shifts[date] = shiftType;
                        swapped = true;
                        break;
                    }
                }
                if (swapped) break;
            }
            if (!swapped) break;
        }
    }

    step8_8_AdjustStaffCounts() {
        this.log("Step 8.8: Adjusting Staff Counts (Removing Excess)...");
        const reqSheet = this.data['要員数'];
        if (!reqSheet) return;

        const reqMap = {};
        reqSheet.forEach(row => {
            const rawDate = row['日付'];
            const normalizedDate = this.normalizeDateStr(rawDate);
            if (normalizedDate && this.dates.includes(normalizedDate)) {
                reqMap[normalizedDate] = {
                    '早': parseInt(row['早番必要'] || row['早必要'] || row['早'] || 0, 10),
                    '遅': parseInt(row['遅番必要'] || row['遅必要'] || row['遅'] || 0, 10),
                    '夜': parseInt(row['夜勤必要'] || row['夜必要'] || row['夜'] || 0, 10),
                    '日': parseInt(row['日勤必要'] || row['日必要'] || row['日'] || 0, 10) // Added Day
                };
            }
        });

        const getWorkCount = (staff) => {
            let c = 0;
            this.dates.forEach(d => {
                const s = staff.shifts[d];
                if (["早", "日", "遅", "夜", "予"].includes(s)) c++;
            });
            return c;
        };

        this.dates.forEach(date => {
            const reqs = reqMap[date];
            if (!reqs) return;

            ['早', '遅', '夜', '日'].forEach(type => { // Added '日'
                const limit = reqs[type];
                if (limit <= 0) return;

                // Find assigned staff (Regulars only)
                const assignedStaff = this.shiftTable.filter(s => {
                    if (this.isTrainingDate(s, date)) return false;
                    return s.shifts[date] === type;
                });

                const excess = assignedStaff.length - limit;

                if (excess > 0) {
                    this.log(`WARN: Excess ${type} on ${date}: Found ${assignedStaff.length}, Limit ${limit}. Removing ${excess}.`);

                    // Filter removable (not locked)
                    // Note: Removed isForceFilled check to prevent massive over-staffing if targets are too high
                    let removable = assignedStaff.filter(s => !s.shiftMeta[date].isLocked && !s.shiftMeta[date].isPreference);

                    // Sort by WORKLOAD DESCENDING (Remove from those who work the most)
                    removable.sort((a, b) => getWorkCount(b) - getWorkCount(a));

                    let removed = 0;
                    for (const victim of removable) {
                        if (removed >= excess) break;

                        // If removing Day, it becomes Rest.
                        // If removing others, ideally become Rest or Day?
                        // Just make it Rest for now to clear the slot, Step 9 will make it officially '休'
                        victim.shifts[date] = ""; // Clear it
                        removed++;
                    }
                }
            });
        });
    }

    step8_9_ForceAdjustTraineeHolidays() {
        this.log("Step 8.9: Force Adjusting Trainee Holidays...");

        this.shiftTable.forEach(staff => {
            if (!this.isTraineeStaff(staff) || this.hasTrainingPeriod(staff)) return;

            const requiredRest = this.getRequiredRest(staff);

            // Loop until fixed (max 10 iterations)
            for (let i = 0; i < 10; i++) {
                let currentRest = 0;
                this.dates.forEach(d => {
                    if (staff.shifts[d] === '公' || staff.shifts[d] === '休') currentRest++;
                });

                if (currentRest === requiredRest) break;

                const diff = requiredRest - currentRest; // +Need Rest, -Need Work

                if (diff > 0) {
                    // Need more Rest -> Change Work to Rest
                    // Find removable work shifts (Trainee shifts not locked)
                    const candidates = this.dates.filter(d =>
                        staff.shifts[d].startsWith('研修') &&
                        !staff.shiftMeta[d].isLocked &&
                        !staff.shiftMeta[d].isPreference
                    );

                    if (candidates.length > 0) {
                        const target = candidates[Math.floor(Math.random() * candidates.length)];
                        staff.shifts[target] = '休';
                        // staff.shiftMeta[target].isLocked = true; // Lock it? Maybe.
                    } else {
                        // No candidates? e.g. all locked. Critical issue.
                        this.log(`WARN: Cannot add rest for Trainee ${staff.name}, no slots.`);
                        break;
                    }
                } else {
                    // Need more Work -> Change Rest to Trainee Shift
                    const candidates = this.dates.filter(d =>
                        staff.shifts[d] === '休' &&
                        !staff.shiftMeta[d].isLocked &&
                        !staff.shiftMeta[d].isPreference
                    );

                    if (candidates.length > 0) {
                        const target = candidates[Math.floor(Math.random() * candidates.length)];
                        // Determine type based on ability
                        const types = [];
                        if (staff['早可'] === '〇' || staff['早可'] === true) types.push('研修（早）');
                        if (staff['日可'] === '〇' || staff['日可'] === true) types.push('研修（日）');
                        if (staff['遅可'] === '〇' || staff['遅可'] === true) types.push('研修（遅）');
                        if (types.length === 0) types.push('研修（日）');

                        staff.shifts[target] = types[Math.floor(Math.random() * types.length)];
                    } else {
                        this.log(`WARN: Cannot remove rest for Trainee ${staff.name}, no slots.`);
                        break;
                    }
                }
            }
        });
    }

    step9_DistributeOffDays() {
        this.log("Step 9: Distributing Off Days...");
        this.shiftTable.forEach(staff => {
            this.dates.forEach(date => {
                if (staff.shifts[date] === "") {
                    staff.shifts[date] = "休";
                }
            });
        });
    }
    step9_5_ChiefAdjustment() {
        this.log("Step 9.5: 調整フェーズ（全勤務の不足穴埋め＋公休バランス）...");
        const reqSheet = this.data['要員数'];

        const isMark = (v) => v === true || v === '〇' || v === 'TRUE';
        const isChief = (s) => isMark(s['主任']);
        const isSekinin = (s) => isMark(s['サ責']);
        const isClerk = (s) => isMark(s['事務員']);
        const isDirector = (s) => isMark(s['施設長']);
        const isAdmin = (s) => isMark(s['管理者']);
        // 事務員・施設長・管理者は調整で予や勤務を動かさない（保護対象・最優先）。
        // 仮に主任/サ責を兼任していても、保護を優先して触らない。
        const isProtected = (s) => isClerk(s) || isDirector(s) || isAdmin(s);
        const isExclusive = (s) => this.isStaffExclusive(s);
        const isRole = (s) => isChief(s) || isSekinin(s);
        // 公休不足の肩代わりで、主任・サ責が入れる勤務種別。
        //  サ責：日勤のみ（早・遅・夜・明は不可）／主任：早・日・遅（夜勤は不可）
        const canCover = (helper, type) => {
            if (isChief(helper)) return ['早', '日', '遅'].includes(type);
            if (isSekinin(helper)) return type === '日';
            return false;
        };
        const meta = (s, d) => s.shiftMeta[d] || {};
        const freeToChange = (s, d) => !meta(s, d).isPreference && !meta(s, d).isLocked;
        // 予備(予)は「展開するための待機」なので、ロックされていても勤務に回してよい（希望のみ保護）。
        const usableYobi = (s, d) => s.shifts[d] === '予' && !meta(s, d).isPreference;
        const restCount = (s) => this.dates.reduce((n, d) => (s.shifts[d] === '公' || s.shifts[d] === '休') ? n + 1 : n, 0);
        // ロックだけを一時的に無視して可否判定（連勤・前後関係・週上限などの本来の制約は維持）。
        const allowedIgnoringLock = (s, d, type) => {
            const m = s.shiftMeta[d] || (s.shiftMeta[d] = {});
            const was = m.isLocked; m.isLocked = false;
            const ok = this.isShiftAllowed(s, d, type);
            m.isLocked = was;
            return ok;
        };
        const deploy = (s, d, type) => { // 勤務を確定し、ロックは解除（実勤務になったため）
            s.shifts[d] = type;
            if (s.shiftMeta[d]) s.shiftMeta[d].isLocked = false;
        };

        // 指定シフト種別の不足数（予はカウントしない＝その種別の実勤務のみ数える）
        const shortage = (date, type) => {
            if (!reqSheet) return 0;
            const nd = this.normalizeDateStr(date);
            const row = reqSheet.find(r => this.normalizeDateStr(r['日付']) === nd);
            if (!row) return 0;
            let reqVal = 0;
            if (type === '早') reqVal = row['早番必要'] || row['早必要'] || row['早'] || 0;
            if (type === '日') reqVal = row['日勤必要'] || row['日必要'] || row['日'] || 0;
            if (type === '遅') reqVal = row['遅番必要'] || row['遅必要'] || row['遅'] || 0;
            if (type === '夜') reqVal = row['夜勤必要'] || row['夜必要'] || row['夜'] || 0;
            const reqNum = parseInt(reqVal, 10);
            if (reqNum <= 0) return 0;
            const current = this.shiftTable.filter(s => s.shifts[date] === type).length;
            return reqNum - current;
        };

        // ---- A. 不足を埋めて黄色をなくす：早/日/遅/夜すべて ----
        //   ① 公休過多の人（休→勤務／本人の過多も解消）→ ② 予備の人（予→勤務／主任・サ責は均等）
        //   予→勤務は連勤に影響しない（予はもともと出勤扱い）ので確実に埋まる。
        const roleUse = new Map();
        for (let loop = 0; loop < 8; loop++) {
            let filled = false;
            this.dates.forEach(date => {
                ['日', '早', '遅', '夜'].forEach(type => {
                    let need = shortage(date, type);
                    let guard = 0;
                    while (need > 0 && guard++ < 40) {
                        // ① 公休過多（休>目標）の人の '休' を 勤務に（過多が大きい人から）
                        const excess = this.shiftTable
                            .map(s => ({ s, over: restCount(s) - this.getRequiredRest(s) }))
                            .filter(x => x.over > 0 && x.s.shifts[date] === '休' && !isProtected(x.s)
                                && freeToChange(x.s, date) && allowedIgnoringLock(x.s, date, type))
                            .sort((a, b) => b.over - a.over);
                        if (excess.length) {
                            deploy(excess[0].s, date, type);
                            this.log(`  -> [不足:${type}] 公休過多の ${excess[0].s.name} を ${date}`);
                            filled = true; need--; continue;
                        }
                        // ② 予備の人の '予' を 勤務に（主任・サ責は使用回数が少ない人優先＝均等）
                        const yobi = this.shiftTable
                            .filter(s => usableYobi(s, date) && !isProtected(s) && allowedIgnoringLock(s, date, type))
                            .sort((a, b) => {
                                const ar = isRole(a) ? 0 : 1, br = isRole(b) ? 0 : 1;
                                if (ar !== br) return ar - br;            // 役職者を優先的に動かす
                                return (roleUse.get(a) || 0) - (roleUse.get(b) || 0); // 均等
                            });
                        if (yobi.length) {
                            deploy(yobi[0], date, type);
                            if (isRole(yobi[0])) roleUse.set(yobi[0], (roleUse.get(yobi[0]) || 0) + 1);
                            this.log(`  -> [不足:${type}] 予備の ${yobi[0].name} を ${date}`);
                            filled = true; need--; continue;
                        }
                        // ③ スワップ補完：その日が休の人を勤務にし、別の日の予を休へ振替（公休数は不変）。
                        //    予を多く持つ人（主任・サ責ら）優先。これで予備不在の日も埋まる。
                        const swapCand = this.shiftTable
                            .filter(s => !isExclusive(s) && !isProtected(s) && s.shifts[date] === '休'
                                && !meta(s, date).isPreference && allowedIgnoringLock(s, date, type)
                                && this.dates.some(d2 => d2 !== date && usableYobi(s, d2)))
                            .sort((a, b) => {
                                const ay = this.dates.filter(d2 => a.shifts[d2] === '予').length;
                                const by = this.dates.filter(d2 => b.shifts[d2] === '予').length;
                                return by - ay; // 予が多い人優先
                            });
                        if (swapCand.length) {
                            const s = swapCand[0];
                            deploy(s, date, type);
                            const yd = this.dates.find(d2 => d2 !== date && usableYobi(s, d2));
                            if (yd) { s.shifts[yd] = '休'; if (s.shiftMeta[yd]) s.shiftMeta[yd].isLocked = false; } // 公休数を保つため別の予を休に
                            this.log(`  -> [不足:${type}] スワップで ${s.name} を ${date}（${yd}の予を休に振替）`);
                            filled = true; need--; continue;
                        }
                        break; // これ以上は埋められない（有資格者がいない等）
                    }
                });
            });
            if (!filled) break;
        }

        // ---- B. 公休が足りない人（働きすぎ）：その日の勤務を主任・サ責の予に肩代わりしてもらい休に ----
        //   基本は「日勤」の日を代わってもらう。次点で早・遅（主任のみ可）。夜勤は主任・サ責とも不可。
        // 肩代わり役は主任・サ責のみ（保護対象が兼任していても除外）
        const roleHelpers = this.shiftTable.filter(s => (isChief(s) || isSekinin(s)) && !isProtected(s));
        const coverOrder = ['日', '早', '遅']; // 日勤を最優先。夜（夜・明）は肩代わり対象外。
        this.shiftTable.forEach(staff => {
            if (roleHelpers.includes(staff)) return;
            if (isProtected(staff)) return; // 事務員・施設長・管理者は触らない
            let need = this.getRequiredRest(staff) - restCount(staff); // >0 = 休が足りない
            let guard = 0;
            while (need > 0 && guard++ < 40) {
                let swapped = false;
                for (const wantType of coverOrder) {
                    for (const date of this.dates) {
                        if (staff.shifts[date] !== wantType) continue;
                        if (!freeToChange(staff, date)) continue;
                        // その日に予で待機していて、種別的に入れる主任・サ責を探す
                        const helper = roleHelpers.find(c => c.shifts[date] === '予'
                            && freeToChange(c, date) && canCover(c, wantType)
                            && this.isShiftAllowed(c, date, wantType));
                        if (helper) {
                            helper.shifts[date] = wantType; // 主任・サ責が肩代わり（人数は維持）
                            if (helper.shiftMeta[date]) helper.shiftMeta[date].isLocked = false;
                            staff.shifts[date] = '休';       // 本人は休
                            if (staff.shiftMeta[date]) staff.shiftMeta[date].isLocked = false;
                            need--; swapped = true;
                            this.log(`  -> [公休不足] ${staff.name} の${wantType}(${date})を ${helper.name} が肩代わり`);
                            break;
                        }
                    }
                    if (swapped) break;
                }
                if (!swapped) break;
            }
        });

        // ---- C. 公休が多すぎる人（専属以外）：余分な休を '予'(待機) に変換して公休を減らす ----
        this.shiftTable.forEach(staff => {
            if (isExclusive(staff)) return;
            if (isProtected(staff)) return; // 保護対象は調整で触らない（公休調整はStep2.8で実施）
            let over = restCount(staff) - this.getRequiredRest(staff);
            if (over <= 0) return;
            for (const date of this.dates) {
                if (over <= 0) break;
                if (staff.shifts[date] === '休' && freeToChange(staff, date)) {
                    if (this.checkConsecutiveWork(staff, date)) continue; // 連勤上限を超える日は避ける
                    staff.shifts[date] = '予';
                    over--;
                    this.log(`  -> [公休過多] ${staff.name} の休(${date})を予に`);
                }
            }
        });
    }

    step10_FinalizeValidation() {
        this.log("Step 10: Final Validation...");
        let errors = 0;
        // 按分後の必要公休数を各職員に保持（ビューの黄色判定と一致させる）
        this.shiftTable.forEach(staff => {
            staff.requiredRest = this.getRequiredRest(staff);
        });
        this.shiftTable.forEach(staff => {
            // 役職者判定
            const isManager = staff['サ責'] === true || staff['サ責'] === '〇' || staff['サ責'] === 'TRUE';
            const isDirector = staff['施設長'] === true || staff['施設長'] === '〇' || staff['施設長'] === 'TRUE';
            const isClerk = staff['事務員'] === true || staff['事務員'] === '〇' || staff['事務員'] === 'TRUE';
            const isAdmin = staff['管理者'] === true || staff['管理者'] === '〇' || staff['管理者'] === 'TRUE';
            const isChief = staff['主任'] === true || staff['主任'] === '〇' || staff['主任'] === 'TRUE';
            const isRoleStaff = isManager || isDirector || isClerk || isAdmin || isChief;

            const maxConsecutive = isRoleStaff ? 5 : 4;

            let consecutive = 0;
            const isWork = (s) => {
                if (!s) return false;
                const base = (s.includes && s.includes('研修')) ? s.match(/（(.*?)）/)?.[1] : s;
                return ["早", "日", "遅", "夜", "明", "予", "研"].includes(base);
            };

            this.dates.forEach((date, i) => {
                const shift = staff.shifts[date];
                const baseShift = (shift && shift.includes && shift.includes('研修')) ? shift.match(/（(.*?)）/)?.[1] : shift;

                if (isWork(shift)) {
                    consecutive++;
                } else {
                    consecutive = 0;
                }

                if (consecutive > maxConsecutive) {
                    this.log(`WARN: ${staff.name} has ${consecutive} consecutive work days at ${date} (Limit: ${maxConsecutive})`);
                    errors++;
                }

                if (i > 0) {
                    const prev = staff.shifts[this.dates[i - 1]];
                    const prevBase = (prev && prev.includes && prev.includes('研修')) ? prev.match(/（(.*?)）/)?.[1] : prev;
                    if (prevBase === '遅' && baseShift === '早') {
                        this.log(`WARN: ${staff.name} Late->Early on ${date}`);
                        errors++;
                    }
                    if (prevBase === '夜' && shift !== '明') {
                        this.log(`WARN: ${staff.name} Night shift not followed by Dawn on ${date}`);
                        errors++;
                    }
                }
            });
        });

        if (errors === 0) {
            this.log("Validation passed.");
        } else {
            this.log(`Validation finished with ${errors} issues.`);
        }
    }
}
