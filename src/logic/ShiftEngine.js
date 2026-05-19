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
        let m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
        if (m) {
            const y = m[1];
            const mo = ("0" + m[2]).slice(-2);
            const d = ("0" + m[3]).slice(-2);
            return `${y}/${mo}/${d}`;
        }

        // Try MD format (10/1) - Assume target year
        m = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
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

    checkConsecutiveWork(staff, dateStr) {
        const idx = this.dates.indexOf(dateStr);
        if (idx === -1) return false;

        // Exempt roles don't have the strict 4-day max consecutive work rule
        const isExempt = staff['サ責'] === true || staff['サ責'] === '〇' || staff['サ責'] === 'TRUE' ||
                         staff['主任'] === true || staff['主任'] === '〇' || staff['主任'] === 'TRUE' ||
                         staff['施設長'] === true || staff['施設長'] === '〇' || staff['施設長'] === 'TRUE' ||
                         staff['管理者'] === true || staff['管理者'] === '〇' || staff['管理者'] === 'TRUE';

        // Set max limit: 6 for exempt (legal max), 4 for regular staff
        const MAX_CONSECUTIVE = isExempt ? 6 : 4;

        // Include "明" (Ming) as a work day
        const isWorkDay = (s) => ["早", "日", "遅", "夜", "明", "予", "研修", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(s);

        // Scan Backward
        let backwardStreak = 0;
        for (let k = 1; k <= 7; k++) {
            if (idx - k < 0) break;
            const s = staff.shifts[this.dates[idx - k]];
            if (isWorkDay(s)) {
                backwardStreak++;
            } else {
                break;
            }
        }

        // Scan Forward
        let forwardStreak = 0;
        for (let k = 1; k <= 7; k++) {
            if (idx + k >= this.dates.length) break;
            const s = staff.shifts[this.dates[idx + k]];
            if (isWorkDay(s)) {
                forwardStreak++;
            } else {
                break;
            }
        }

        // Total if we add this shift (this shift counts as 1 day)
        const totalStreak = backwardStreak + 1 + forwardStreak;

        if (totalStreak > MAX_CONSECUTIVE) return true; // Violated rule

        return false;
    }

    // Helper to check if a specific shift is allowed on a date for a staff
    isShiftAllowed(staff, dateStr, shift) {
        const idx = this.dates.indexOf(dateStr);
        if (idx === -1) return false;

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
        if (["早", "日", "遅", "夜", "予", "研修", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(shift)) {
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
                    if (["早", "日", "遅", "夜", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(s)) {
                        workInWeek++;
                    }
                }

                if (workInWeek >= limitPerWeek) {
                    return false;
                }
            }
        }

        // Check Monthly Work Limit (公休数)
        // Only if we are trying to assign a WORK shift AND staff is NOT Exclusive AND staff is NOT weekly-based (Part Time)
        const isPartTime = this.getStaffLimit(staff, ['勤務日数/週', '日数/週', '勤務制限'], 0) > 0;
        
        if (!this.isStaffExclusive(staff) && !isPartTime && ["早", "日", "遅", "夜", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(shift)) {
            // Calculate limit
            const holiday = this.monthlySettings.monthlyHoliday || 9;
            const limit = this.dates.length - holiday;

            // Count current work days
            let currentWork = 0;
            this.dates.forEach(d => {
                const s = staff.shifts[d];
                // Count Ming as occupied day for holiday calculation logic
                if (["早", "日", "遅", "夜", "予", "研修", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(s)) {
                    currentWork++;
                }
            });

            // If we are replacing an empty slot (or non-work), and we are already at or above limit -> DENY
            const existing = staff.shifts[dateStr];
            const isExistingWork = ["早", "日", "遅", "夜", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）"].includes(existing);

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

            // 夜勤研修の「卒業」ルール（研修終了までは独り立ち夜勤を禁止）
            if (shift === '夜' && staff.hasTrainingPref) {
                const trainingDates = Object.keys(staff.shifts).filter(d => staff.shifts[d] === '研修（夜）');
                if (trainingDates.length > 0) {
                    const lastDay = trainingDates.sort().reverse()[0];
                    if (dateStr <= lastDay) return false; // 研修終了日以前は一人立ち禁止
                } else {
                    return false; // 決定した研修日が今月ない場合は、今月はずっと一人立ち不可
                }
            }

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

    // 夜勤の3点セット（夜→明→休）を適用する
    applyNightShiftSet(staff, dateStr, isPreference = false) {
        const idx = this.dates.indexOf(dateStr);
        if (idx === -1) {
            this.log(`Error: Cannot apply night shift set for ${staff.name} on ${dateStr} - date not found`);
            return false;
        }

        const nextDate = this.dates[idx + 1];
        const nextNextDate = this.dates[idx + 2];

        // 3点セットを適用
        staff.shifts[dateStr] = '夜';
        staff.shiftMeta[dateStr].isLocked = true;
        if (isPreference) staff.shiftMeta[dateStr].isPreference = true;

        if (nextDate) {
            staff.shifts[nextDate] = '明';
            staff.shiftMeta[nextDate].isLocked = true;
            if (isPreference) staff.shiftMeta[nextDate].isPreference = true;
        }

        if (nextNextDate) {
            staff.shifts[nextNextDate] = '休';
            staff.shiftMeta[nextNextDate].isLocked = true;
            if (isPreference) staff.shiftMeta[nextNextDate].isPreference = true;
        }

        this.log(`Applied night shift set for ${staff.name}: ${dateStr}(夜) → ${nextDate || 'Next'}(明) → ${nextNextDate || 'Next'}(休)`);
        return true;
    }



    execute() {
        this.log(`Starting shift generation for ${this.targetYm}`);

        try {
            this.log("Logic from mystic-shifts used (研修 support and Exclusive lock).");
            this.step0_Initialize();
            this.step1_ApplyCarryOver();
            this.step2_ApplyPreferences();
            this.step2_5_ApplyFixedDays(); // New Step
            this.step2_7_ApplyRoleBasedFixedShifts(); // New Step: Role Exemptions
            this.step2_8_ForceAdjustRoleHolidays(); // New Step: Force Adjust Role Holidays
            this.step3_ApplyWorkDaysPerWeek();
            this.step4_ApplyExclusive();
            this.step5_ApplyNightShift();
            this.step6_ApplyEarlyLateShift();
            this.step7_ApplyDayLeader();
            this.step8_ApplyDayShift();
            this.step8_2_ForceFillDeficits(); // New: Force fill shortages
            this.step8_3_EnsureClerkPresence(); // New: Ensure at least one clerk
            this.step4_5_ApplyTrainee(); // Moved: Trainees fill their own slots after regulars are done
            this.step8_5_BalanceWorkDays();
            this.step8_8_AdjustStaffCounts(); // New: Reduce excess staff
            this.step8_9_ForceAdjustTraineeHolidays(); // New: Trainee Holiday Final Check
            this.step9_5_ChiefAdjustment(); // New: Chief uses '予' to fill holes and adjust holidays
            this.step9_DistributeOffDays();
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
            const isTrainee = staff['研修生'] === true || staff['研修生'] === '〇' || staff['研修生'] === 'TRUE';
            if (!isTrainee) return;

            this.log(`[Step 4.5] Processing Trainee: ${staff.name}`);
            const trainingTypes = [];
            if (staff['早可'] === '〇' || staff['早可'] === true) trainingTypes.push('研修（早）');
            if (staff['日可'] === '〇' || staff['日可'] === true) trainingTypes.push('研修（日）');
            if (staff['遅可'] === '〇' || staff['遅可'] === true) trainingTypes.push('研修（遅）');
            if (trainingTypes.length === 0) trainingTypes.push('研修（日）');

            this.dates.forEach(date => {
                if (staff.shifts[date] !== "") return;
                const randomShift = trainingTypes[Math.floor(Math.random() * trainingTypes.length)];
                staff.shifts[date] = randomShift;
                staff.shiftMeta[date].isLocked = true;
            });

            let currentRest = 0;
            this.dates.forEach(d => { if (staff.shifts[d] === '公' || staff.shifts[d] === '休') currentRest++; });
            let diff = (this.monthlySettings.monthlyHoliday || 9) - currentRest;

            if (diff > 0) {
                const candidates = this.dates.filter(d => staff.shifts[d].startsWith('研修') && !staff.shiftMeta[d].isPreference);
                for (let i = candidates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                }
                for (let k = 0; k < diff && k < candidates.length; k++) {
                    staff.shifts[candidates[k]] = '休';
                    staff.shiftMeta[candidates[k]].isLocked = true;
                }
            }
        });
    }

    step0_Initialize() {
        this.log("Step 0: Initializing shift table...");
        const rawMasterData = this.data['マスタ'];
        if (!rawMasterData) throw new Error("マスタシートが見つかりません");
        const normalizeVal = (val) => typeof val === 'string' ? val.trim().replace(/[！-～]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) : val;

        this.shiftTable = rawMasterData.map(row => {
            const cleanRow = {};
            Object.keys(row).forEach(key => { cleanRow[key.trim()] = normalizeVal(row[key]); });
            const aliasMap = { '日数/週': '勤務日数/週', '勤務制限': '勤務日数/週', '夜勤制限': '夜勤回数/週', '専属フラグ': '専属' };
            Object.keys(aliasMap).forEach(a => { if (cleanRow[a] && !cleanRow[aliasMap[a]]) cleanRow[aliasMap[a]] = cleanRow[a]; });
            
            const sRow = { name: cleanRow['氏名'], ...cleanRow, shifts: {}, shiftMeta: {} };
            const isT = (k) => sRow[k] === true || sRow[k] === '〇' || sRow[k] === 'TRUE';
            if (isT('夜勤研修')) sRow.hasTrainingPref = true; 

            this.dates.forEach(d => { sRow.shifts[d] = ""; sRow.shiftMeta[d] = { isLocked: false }; });
            return sRow;
        }).filter(s => s.name);
    }

    step1_ApplyCarryOver() {
        const carrySheet = this.data['繰越'];
        if (!carrySheet) return;
        carrySheet.forEach(row => {
            const staff = this.shiftTable.find(s => s.name === row['氏名']);
            if (!staff) return;
            this.dates.slice(0, 2).forEach(d => {
                const val = this.findValueByDateKey(row, d);
                if (val) { staff.shifts[d] = val; staff.shiftMeta[d].isLocked = true; }
            });
        });
    }

    step2_ApplyPreferences() {
        const prefSheet = this.data['希望'];
        if (!prefSheet) return;
        prefSheet.forEach(row => {
            const staff = this.shiftTable.find(s => s.name === row['氏名']);
            if (!staff) return;
            const apply = (k, sym) => {
                if (!row[k]) return;
                String(row[k]).split(/[,、\s・/]+/).forEach(p => {
                    let norm = this.normalizeDateStr(p.trim());
                    if (!norm) {
                        const dNum = parseInt(p.trim(), 10);
                        if (dNum > 0 && dNum <= 31) norm = `${this.targetYm.split('-')[0]}/${this.targetYm.split('-')[1]}/${("0" + dNum).slice(-2)}`;
                    }
                    if (norm && staff.shifts[norm] !== undefined) {
                        staff.shifts[norm] = sym;
                        staff.shiftMeta[norm].isLocked = true;
                        staff.shiftMeta[norm].isPreference = true;
                    }
                });
            };
            ["有休", "休み希望", "早番希望", "日勤希望", "遅出希望", "予備", "誕休", "研修"].forEach(k => {
                let s = k === "有休" ? "有" : k === "休み希望" ? "休" : k === "早番希望" ? "早" : k === "日勤希望" ? "日" : k === "遅出希望" ? "遅" : k === "予備" ? "予" : k;
                apply(k, s);
            });
            if (row["夜勤研修"]) {
                staff.hasTrainingPref = true;
                if (String(row["夜勤研修"]) !== '〇') this.applySpecificDates(staff, String(row["夜勤研修"]), "研修（夜）");
            }
            if (row["夜勤希望"]) {
                String(row["夜勤希望"]).split(/[,、\s・]+/).forEach(p => {
                    let norm = this.normalizeDateStr(p.trim());
                    if (norm) this.applyNightShiftSet(staff, norm, true);
                });
            }
        });
    }

    applySpecificDates(staff, raw, sym) {
        String(raw).split(/[,、\s・/]+/).forEach(p => {
            let norm = this.normalizeDateStr(p.trim());
            if (norm && staff.shifts[norm] !== undefined) {
                if (sym === "研修（夜）") this.applyNightShiftSet(staff, norm, true);
                else { staff.shifts[norm] = sym; staff.shiftMeta[norm].isLocked = true; staff.shiftMeta[norm].isPreference = true; }
            }
        });
    }

    applyNightShiftSet(staff, dateStr, isPref = false) {
        const idx = this.dates.indexOf(dateStr);
        if (idx === -1) return;
        let sym = "夜";
        if (staff.hasTrainingPref && Object.values(staff.shifts).filter(v => v === '夜' || v === '研修（夜）').length === 0) sym = "研修（夜）";
        staff.shifts[this.dates[idx]] = sym;
        staff.shiftMeta[this.dates[idx]].isLocked = true;
        if (isPref) staff.shiftMeta[this.dates[idx]].isPreference = true;
        if (idx + 1 < this.dates.length) { staff.shifts[this.dates[idx + 1]] = "明"; staff.shiftMeta[this.dates[idx + 1]].isLocked = true; }
        if (idx + 2 < this.dates.length) { staff.shifts[this.dates[idx + 2]] = "休"; staff.shiftMeta[this.dates[idx + 2]].isLocked = true; }
    }

    findValueByDateKey(row, d) { const k = this.findKeyForDate(row, d); return k ? row[k] : null; }
    getStaffLimit(staff, keys, def = 0) {
        for (const k of keys) {
            const v = staff[k];
            if (v !== undefined && v !== null && v !== "") {
                const n = parseInt(String(v).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)), 10);
                if (!isNaN(n)) return n;
            }
        }
        return def;
    }
    isStaffExclusive(staff) { return staff['専属'] === true || staff['専属'] === '〇' || staff['専属'] === 'TRUE'; }

    step2_5_ApplyFixedDays() {
        this.shiftTable.forEach(staff => {
            if (!staff['曜日固定']) return;
            const days = String(staff['曜日固定']).split(/[/\s,、]+/).map(d => d.trim());
            this.dates.forEach((d, i) => { if (!days.includes(this.dayOfWeeks[i]) && staff.shifts[d] === "") { staff.shifts[d] = "休"; staff.shiftMeta[d].isLocked = true; } });
        });
    }

    step2_7_ApplyRoleBasedFixedShifts() {
        this.shiftTable.forEach(staff => {
            const r = (k) => staff[k] === true || staff[k] === '〇' || staff[k] === 'TRUE';
            if (r('サ責') || r('施設長') || r('事務員') || r('管理者') || r('主任')) {
                this.dates.forEach(d => { if (staff.shifts[d] === "") { staff.shifts[d] = '予'; staff.shiftMeta[d].isLocked = true; } });
                let curRest = 0;
                this.dates.forEach(d => { if (staff.shifts[d] === '公' || staff.shifts[d] === '休') curRest++; });
                let req = this.monthlySettings.monthlyHoliday || 9;
                if (curRest < req) {
                    const cands = this.dates.filter(d => staff.shifts[d] === '予').sort(() => Math.random() - 0.5);
                    for (let k = 0; k < (req - curRest) && k < cands.length; k++) { staff.shifts[cands[k]] = '休'; staff.shiftMeta[cands[k]].isLocked = true; }
                }
            }
        });
    }

    step2_8_ForceAdjustRoleHolidays() {
        this.shiftTable.forEach(staff => {
            const r = (k) => staff[k] === true || staff[k] === '〇' || staff[k] === 'TRUE';
            if (!r('サ責') && !r('施設長') && !r('事務員') && !r('管理者') && !r('主任')) return;
            let cur = 0; this.dates.forEach(d => { if (staff.shifts[d] === '公' || staff.shifts[d] === '休') cur++; });
            let req = this.getStaffLimit(staff, ['公休数'], this.monthlySettings.monthlyHoliday || 9);
            let diff = req - cur;
            if (diff > 0) {
                const c = this.dates.filter(d => staff.shifts[d] === '予').sort(() => Math.random() - 0.5);
                for (let k = 0; k < diff && k < c.length; k++) { staff.shifts[c[k]] = '休'; staff.shiftMeta[c[k]].isLocked = true; }
            } else if (diff < 0) {
                const c = this.dates.filter(d => staff.shifts[d] === '休' && !staff.shiftMeta[d].isPreference).sort(() => Math.random() - 0.5);
                for (let k = 0; k < Math.abs(diff) && k < c.length; k++) { staff.shifts[c[k]] = '予'; staff.shiftMeta[c[k]].isLocked = true; }
            }
        });
    }

    step3_ApplyWorkDaysPerWeek() {
        this.shiftTable.forEach(staff => {
            const lim = parseInt(staff['勤務日数/週'], 10);
            if (!lim) return;
            for (let i = 0; i < this.dates.length; i += 7) {
                const wDates = this.dates.slice(i, i + 7);
                let rests = 0; wDates.forEach(d => { if (staff.shifts[d] === "休") rests++; });
                let need = (7 - lim) - rests;
                if (need > 0) {
                    const e = wDates.filter(d => staff.shifts[d] === "").sort(() => Math.random() - 0.5);
                    for (let k = 0; k < need && k < e.length; k++) staff.shifts[e[k]] = "休";
                }
            }
        });
    }

    step4_ApplyExclusive() {
        this.shiftTable.filter(s => this.isStaffExclusive(s)).forEach(staff => {
            const can = (b) => staff[b + '可'] === true || staff[b + '可'] === '〇';
            const bands = ['早', '日', '遅', '夜'].filter(b => can(b));
            if (bands.includes('夜')) {
                this.dates.forEach(d => { if (staff.shifts[d] === "" && this.isShiftAllowed(staff, d, '夜')) this.applyNightShiftSet(staff, d); });
            }
            this.dates.forEach(d => {
                if (staff.shifts[d] !== "") return;
                const b = bands.filter(x => x !== '夜').sort(() => Math.random() - 0.5)[0];
                if (b && this.isShiftAllowed(staff, d, b)) { staff.shifts[d] = b; staff.shiftMeta[d].isLocked = true; }
            });
            this.dates.forEach(d => { if (staff.shifts[d] === "") { staff.shifts[d] = "休"; staff.shiftMeta[d].isLocked = true; } });
        });
    }

    step5_ApplyNightShift() {
        this.dates.forEach(date => {
            let candidates = this.shiftTable.filter(s => !s.shifts[date] && (s['夜可'] === '〇' || s['夜可'] === true) && this.isShiftAllowed(s, date, '夜'));
            if (candidates.length > 0) {
                candidates.sort((a, b) => Object.values(a.shifts).filter(v => v === '夜').length - Object.values(b.shifts).filter(v => v === '夜').length);
                this.applyNightShiftSet(candidates[0], date);
            }
        });
    }

    step6_ApplyEarlyLateShift() {
        this.log("Step 6: Applying Early and Late Shifts...");
        this.dates.forEach(date => {
            const bands = ['早', '遅'];
            bands.forEach(band => {
                let candidates = this.shiftTable.filter(s => !s.shifts[date] && (s[band + '可'] === '〇' || s[band + '可'] === true) && this.isShiftAllowed(s, date, band));
                if (candidates.length > 0) {
                    candidates.sort((a, b) => Object.values(a.shifts).filter(v => v === band).length - Object.values(b.shifts).filter(v => v === band).length);
                    const chosen = candidates[0];
                    chosen.shifts[date] = band;
                    chosen.shiftMeta[date].isLocked = true;
                }
            });
        });
    }

    step7_ApplyDayLeader() {
        this.log("Step 7: Identifying Day Leaders...");
        this.dates.forEach(date => {
            const leaders = this.shiftTable.filter(s => (s['リーダー可'] === '〇' || s['リーダー可'] === true) && ['早', '日', '遅'].includes(s.shifts[date]));
            if (leaders.length > 0) leaders.forEach(l => { l.isLeader = true; });
        });
    }

    step8_ApplyDayShift() {
        this.log("Step 8: Filling Day Shifts...");
        this.dates.forEach(date => {
            let candidates = this.shiftTable.filter(s => !s.shifts[date] && (s['日可'] === '〇' || s['日可'] === true) && this.isShiftAllowed(s, date, '日'));
            candidates.forEach(s => { s.shifts[date] = '日'; s.shiftMeta[date].isLocked = true; });
        });
    }

    step8_2_ForceFillDeficits() {
        this.log("Step 8.2: Force Filling Deficits...");
        this.dates.forEach(date => {
            ['早', '日', '遅', '夜'].forEach(b => {
                let current = this.shiftTable.filter(s => s.shifts[date] === b || (s.shifts[date].includes('研修') && s.shifts[date].includes(b))).length;
                let req = 0;
                if (this.data['要員数']) {
                    const r = this.data['要員数'].find(x => this.normalizeDateStr(x['日付']) === date);
                    if (r) req = parseInt(r[b === '日' ? '日必要' : b + '必要'] || r[b] || 0, 10);
                }
                while (current < req) {
                    const cands = this.shiftTable.filter(s => !s.shifts[date] && this.isShiftAllowed(s, date, b));
                    if (cands.length === 0) break;
                    const c = cands[0];
                    if (b === '夜') this.applyNightShiftSet(c, date); else { c.shifts[date] = b; c.shiftMeta[date].isLocked = true; }
                    current++;
                }
            });
        });
    }

    step8_3_EnsureClerkPresence() {
        this.log("Step 8.3: Ensure at least one clerk (事務員) is working each day...");
        const clerks = this.shiftTable.filter(s => s['事務員'] === true || s['事務員'] === '〇' || s['事務員'] === 'TRUE');
        if (clerks.length >= 2) {
            this.dates.forEach(date => {
                // Check if any clerk is working on this day (including '予')
                const workingClerks = clerks.filter(c => ["早", "日", "遅", "夜", "予"].includes(c.shifts[date]));
                if (workingClerks.length === 0) {
                    // Try to assign '日' to one of the available clerks
                    const availableClerks = clerks.filter(c => !c.shiftMeta[date].isLocked && this.isShiftAllowed(c, date, '日')).sort(() => Math.random() - 0.5);
                    if (availableClerks.length > 0) {
                        availableClerks[0].shifts[date] = '日';
                        availableClerks[0].shiftMeta[date].isLocked = true;
                    } else {
                        // If no unlocked clerks are found, forcefully assign to an unlocked one without checking strictly
                        const anyAvailable = clerks.filter(c => !c.shiftMeta[date].isLocked).sort(() => Math.random() - 0.5);
                        if (anyAvailable.length > 0) {
                            anyAvailable[0].shifts[date] = '日';
                            anyAvailable[0].shiftMeta[date].isLocked = true;
                        }
                    }
                }
            });
        }
    }

    step8_5_BalanceWorkDays() {
        this.log("Step 8.5: Balancing Work Days...");
        this.shiftTable.forEach(staff => {
            let cur = 0; this.dates.forEach(d => { if (["早", "日", "遅", "夜", "研修"].includes(staff.shifts[d])) cur++; });
            let req = this.dates.length - (this.monthlySettings.monthlyHoliday || 9);
            const lim = this.getStaffLimit(staff, ['公休数'], -1); if (lim !== -1) req = this.dates.length - lim;
            while (cur > req) {
                const c = this.dates.filter(d => ["早", "日", "遅", "夜"].includes(staff.shifts[d]) && !staff.shiftMeta[d].isLocked).sort(() => Math.random() - 0.5);
                if (c.length === 0) break;
                staff.shifts[c[0]] = "休"; cur--;
            }
        });
    }

    step8_8_AdjustStaffCounts() {
        this.log("Step 8.8: Reducing Excess Staff...");
        this.dates.forEach(date => {
            ['早', '日', '遅'].forEach(b => {
                let cur = this.shiftTable.filter(s => s.shifts[date] === b).length;
                let req = 0;
                if (this.data['要員数']) {
                    const r = this.data['要員数'].find(x => this.normalizeDateStr(x['日付']) === date);
                    if (r) req = parseInt(r[b === '日' ? '日必要' : b + '必要'] || r[b] || 0, 10);
                }
                while (cur > req) {
                    const cands = this.shiftTable.filter(s => s.shifts[date] === b && !s.shiftMeta[date].isLocked && !this.isStaffExclusive(s));
                    if (cands.length === 0) break;
                    cands[0].shifts[date] = "休"; cur--;
                }
            });
        });
    }

    step8_9_ForceAdjustTraineeHolidays() {
        this.log("Step 8.9: Final Trainee Holiday Check...");
        this.shiftTable.filter(s => s['研修生'] === '〇' || s['研修生'] === true).forEach(staff => {
            let cur = 0; this.dates.forEach(d => { if (staff.shifts[d] === '休' || staff.shifts[d] === '公') cur++; });
            let req = this.monthlySettings.monthlyHoliday || 9;
            let diff = req - cur;
            if (diff > 0) {
                const c = this.dates.filter(d => staff.shifts[d].startsWith('研修') && !staff.shiftMeta[d].isPreference).sort(() => Math.random() - 0.5);
                for (let k = 0; k < diff && k < c.length; k++) staff.shifts[c[k]] = '休';
            }
        });
    }

    step9_5_ChiefAdjustment() {
        this.log("Step 9.5: Chief Final Adjustment...");
        this.shiftTable.filter(s => s['サ責'] === '〇' || s['主任'] === '〇').forEach(chief => {
            this.dates.forEach(d => {
                if (chief.shifts[d] === '予') {
                    ['早', '日', '遅'].forEach(b => {
                        let cur = this.shiftTable.filter(s => s.shifts[d] === b).length;
                        let req = 0; if (this.data['要員数']) { const r = this.data['要員数'].find(x => this.normalizeDateStr(x['日付']) === d); if (r) req = parseInt(r[b === '日' ? '日必要' : b + '必要'] || r[b] || 0, 10); }
                        if (cur < req) chief.shifts[d] = b;
                    });
                }
            });
        });
    }

    step9_DistributeOffDays() {
        this.log("Step 9: Finalizing empty slots to rest days...");
        this.shiftTable.forEach(s => { this.dates.forEach(d => { if (s.shifts[d] === "") s.shifts[d] = "休"; }); });
    }

    step10_FinalizeValidation() {
        this.log("Step 10: Final validation of shift constraints...");
        this.shiftTable.forEach(s => {
            this.dates.forEach((d, i) => {
                if (s.shifts[d] === '夜' && i + 1 < this.dates.length && s.shifts[this.dates[i+1]] !== '明') s.shifts[this.dates[i+1]] = '明';
            });
        });
    }
}
