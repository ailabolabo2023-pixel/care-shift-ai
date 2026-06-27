import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import React, { useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize, Minimize, Save, FileSpreadsheet, Printer } from 'lucide-react';

const SHIFT_TYPES = ["", "早", "日", "遅", "夜", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）", "明", "休", "有", "公", "予"]; // added 研修

const ShiftCell = ({ value, onChange, isPreference }) => {
    // Simple native select for robustness and ease of use
    const getColor = (val) => {
        if (!val) return 'text-slate-300';
        if (val === '夜' || val === '研修（夜）') return 'text-indigo-600 font-bold bg-indigo-50';
        if (val === '明') return 'text-purple-500 bg-purple-50';
        if (val === '休') return 'text-red-500 bg-red-50';
        if (val === '早' || val === '研修（早）') return 'text-orange-500 bg-orange-50';
        if (val === '遅' || val === '研修（遅）') return 'text-blue-500 bg-blue-50';
        if (val === '日' || val === '研修（日）') return 'text-green-600 bg-green-50';
        if (val === '有') return 'text-pink-600 bg-pink-50';
        if (val === '公') return 'text-red-600 bg-red-50';
        if (val === '予') return 'text-teal-600 bg-teal-50';
        return 'text-slate-700';
    };

    const colorClass = getColor(value);

    const handleChange = (e) => {
        const newValue = e.target.value;
        if (isPreference) {
            if (!window.confirm("希望シフトを変更しますか？")) {
                return;
            }
        }
        onChange(newValue);
    };

    return (
        <div className="relative w-full h-full group">
            {/* Red Dot for User Preferences */}
            {isPreference && (
                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full z-20 pointer-events-none" />
            )}
            {/* Screen View */}
            <select
                value={value || ""}
                onChange={handleChange}
                className={`w-full h-full text-center appearance-none cursor-pointer border-transparent hover:border-orange-300 border transition-all text-sm focus:ring-2 focus:ring-orange-200 outline-none rounded-sm ${colorClass} print:hidden`}
                style={{
                    textAlignLast: 'center',
                    fontSize: value && value.includes('研修') ? '0.55rem' : undefined,
                    padding: 0 // Remove padding to maximize space
                }}
            >
                {SHIFT_TYPES.map(type => (
                    <option key={type} value={type}>{type || "-"}</option>
                ))}
            </select>

            {/* Print View */}
            <div className={`hidden print:flex w-full h-full items-center justify-center font-bold leading-none ${colorClass}`}
                style={{
                    printColorAdjust: 'exact',
                    WebkitPrintColorAdjust: 'exact',
                    fontSize: value && value.includes('研修') ? '0.45rem' : '0.875rem'
                }}
            >
                {value || ""}
            </div>
        </div>
    );
};

const ShiftTableView = ({ table, dates, dayOfWeeks, onCellChange, defaultMonthlyHoliday = 9, targetDate, requirements = [], updateSheetData }) => {
    const [scale, setScale] = useState(1);
    const [showCounter, setShowCounter] = useState(true);
    const [isSticky, setIsSticky] = useState(false);

    if (!table || table.length === 0) return null;

    const handleSaveHistory = () => {
        if (!window.confirm("現在のシフト表を保存しますか？")) return;

        const newItem = {
            id: Date.now(),
            date: targetDate || "Unknown",
            createdAt: new Date().toISOString(),
            table: table,
            dates: dates // Save dates structure too
        };

        const existing = localStorage.getItem('care_shift_ai_history');
        const history = existing ? JSON.parse(existing) : [];
        history.push(newItem);
        localStorage.setItem('care_shift_ai_history', JSON.stringify(history));

        // Auto Carry-over Logic (Next Month)
        if (updateSheetData && targetDate) {
            try {
                // 1. Calculate Next Month Key (e.g., 2026-02 -> 繰越_2026-03)
                const [year, month] = targetDate.split('-').map(Number);
                const nextDate = new Date(year, month, 1); // Month is 0-indexed in Date, so 'month' (which is 1-indexed from parse) actually points to next month in Date constructor? No wait.
                // new Date(2026, 2, 1) -> March 1st. (Month 0=Jan, 1=Feb, 2=Mar)
                // If target is "2026-02", month var is 2. new Date(2026, 2, 1) is March 1st. Correct.

                const nextYear = nextDate.getFullYear();
                const nextMonthStr = String(nextDate.getMonth() + 1).padStart(2, '0');
                const nextKey = `繰越_${nextYear}-${nextMonthStr}`;

                console.log(`Auto Carry-over: Generating for ${nextKey}`);

                // 2. Identify Last Day shifts
                // We need the last date string from the dates array.
                const lastDate = dates[dates.length - 1]; // "YYYY-MM-DD"

                const carryOverData = table.map(staff => {
                    const lastShift = staff.shifts[lastDate];

                    // Logic:
                    // Night/Training(Night) -> 1st: Ming, 2nd: Rest
                    // Ming -> 1st: Rest

                    let day1 = "";
                    let day2 = "";

                    if (lastShift === '夜' || lastShift === '研修（夜）') {
                        day1 = "明";
                        day2 = "休";
                    } else if (lastShift === '明') {
                        day1 = "休";
                    }

                    // Return row structure for CarryOver sheet
                    // { "氏名": "Name", "1": "明", "2": "休" }
                    return {
                        "氏名": staff.name,
                        "1": day1,
                        "2": day2
                    };
                });

                // 3. Save to Excel Data
                updateSheetData(nextKey, carryOverData);
                console.log("Auto Carry-over saved.", carryOverData);
                alert(`保存しました。\n翌月（${nextYear}-${nextMonthStr}）の繰越設定も自動更新しました。`);

            } catch (e) {
                console.error("Auto Carry-over failed", e);
                alert("保存はできましたが、自動繰越設定に失敗しました。");
            }
        } else {
            alert("保存しました。「過去シフト表」から確認できます。");
        }
    };

    const handleDownloadExcel = async () => {
        try {
            if (!table || table.length === 0) {
                alert("データがありません");
                return;
            }

            // Create Workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Shift');

            // Columns Setup
            const columns = [
                { header: '', key: 'name', width: 20 },
                ...dates.map((_, i) => ({ header: '', key: `date_${i}`, width: 4 })),
                { header: '', key: 'spacer_1', width: 2 },
                // Counters
                { header: '', key: 'count_early', width: 4 },
                { header: '', key: 'count_day', width: 4 },
                { header: '', key: 'count_late', width: 4 },
                { header: '', key: 'count_night', width: 4 },
                { header: '', key: 'count_ming', width: 4 },
                { header: '', key: 'count_holiday', width: 4 },
            ];
            worksheet.columns = columns;

            // --- Styles ---
            const borderStyle = { style: "thin", color: { argb: "FF000000" } };
            const baseFont = { name: "Yu Gothic", size: 10 };
            const centerAlign = { vertical: "middle", horizontal: "center" };
            const defaultBorder = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
            const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

            // --- Header Rows ---

            // Row 1: Title
            worksheet.mergeCells('A1:C1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = `対象年月: ${targetDate || ""}`;
            titleCell.font = { name: "Yu Gothic", size: 12, bold: true };

            // Row 2: Dates
            const row2Values = ['']; // Name col empty
            dates.forEach(d => {
                const dateObj = new Date(d);
                row2Values.push(`${dateObj.getDate()}日`);
            });
            row2Values.push(''); // Spacer
            row2Values.push('早', '日', '遅', '夜', '明', '休'); // Counter headers
            const row2 = worksheet.addRow(row2Values);

            // Style Row 2 (Counters part)
            const dateStartCol = 2;
            const counterStartCol = dateStartCol + dates.length + 1;
            for (let i = 0; i < 6; i++) {
                const cell = row2.getCell(counterStartCol + i);
                cell.fill = headerFill;
                cell.border = defaultBorder;
                cell.alignment = centerAlign;
                cell.font = { ...baseFont, size: 9 };
            }
            // Style Dates
            for (let i = 0; i < dates.length; i++) {
                const cell = row2.getCell(dateStartCol + i);
                cell.alignment = centerAlign;
                cell.font = { ...baseFont, size: 9 };
                cell.border = defaultBorder;
            }


            // Row 3: Days
            const row3Values = ['氏名'];
            dates.forEach((_, i) => {
                // Helper to get Day of Week 
                let dow = '';
                if (dayOfWeeks && dayOfWeeks[i]) dow = dayOfWeeks[i];
                else {
                    const d = new Date(dates[i]);
                    const days = ['日', '月', '火', '水', '木', '金', '土'];
                    dow = days[d.getDay()];
                }
                row3Values.push(dow);
            });
            row3Values.push(''); // Spacer
            row3Values.push('', '', '', '', '', ''); // Empty counters
            const row3 = worksheet.addRow(row3Values);

            // Style Row 3 (Name + Days)
            const nameCell = row3.getCell(1);
            nameCell.fill = headerFill;
            nameCell.border = defaultBorder;
            nameCell.alignment = centerAlign;
            nameCell.font = { ...baseFont, bold: true };

            dates.forEach((_, i) => {
                const cell = row3.getCell(dateStartCol + i);
                const val = row3Values[i + 1]; // +1 because Name is at index 0
                cell.border = defaultBorder;
                cell.alignment = centerAlign;

                let fontColor = 'FF000000';
                let bgColor = null;

                if (val === '土') {
                    fontColor = 'FF0000FF'; // Blue
                    bgColor = 'FFE0F2FE'; // Light Blue
                } else if (val === '日') {
                    fontColor = 'FFFF0000'; // Red
                    bgColor = 'FFFEE2E2'; // Light Red
                }

                cell.font = { ...baseFont, color: { argb: fontColor } };
                if (bgColor) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                }
            });


            // --- Data Rows ---
            table.forEach((staff, rowIndex) => {
                const rowData = [staff.name];

                // Shifts
                dates.forEach(date => {
                    rowData.push(staff.shifts[date] || '');
                });

                // Spacer
                rowData.push('');

                // Counters
                const c = rowCounts[rowIndex];
                rowData.push(c['早'] || 0);
                rowData.push(c['日'] || 0);
                rowData.push(c['遅'] || 0);
                rowData.push(c['夜'] || 0);
                rowData.push(c['明'] || 0);
                rowData.push(c['休'] || 0);

                const row = worksheet.addRow(rowData);

                // Style Data Row
                // Name
                const rName = row.getCell(1);
                rName.border = defaultBorder;
                rName.alignment = { vertical: 'middle', horizontal: 'left' }; // Name left align usually? or center? let's do left with padding
                rName.font = baseFont;

                // Shifts
                dates.forEach((date, i) => {
                    const cell = row.getCell(dateStartCol + i);
                    const val = staff.shifts[date];

                    // Process Trainee Labels (Shorten and Resize)
                    let displayVal = val;
                    let fontSize = baseFont.size;

                    if (val && val.includes('研修')) {
                        if (val === '研修（早）') displayVal = '研(早)';
                        else if (val === '研修（日）') displayVal = '研(日)';
                        else if (val === '研修（遅）') displayVal = '研(遅)';
                        else if (val === '研修（夜）') displayVal = '研(夜)';
                        fontSize = 6;
                    }
                    cell.value = displayVal;

                    cell.border = defaultBorder;
                    cell.alignment = centerAlign;

                    // Colorize text
                    let color = 'FF334155'; // Slate 700
                    let bold = false;
                    if (val === '夜') { color = 'FF4F46E5'; bold = true; } // Indigo
                    else if (val === '休') { color = 'FFEF4444'; } // Red
                    else if (val === '日') { color = 'FF16A34A'; } // Green
                    else if (val === '早') { color = 'FFEA580C'; } // Orange
                    else if (val === '遅') { color = 'FF2563EB'; } // Blue

                    cell.font = { ...baseFont, size: fontSize, color: { argb: color }, bold: bold };

                    // Background for Sat/Sun columns
                    const dowCell = row3.getCell(dateStartCol + i); // Reuse logic from header? OR check day index
                    // Easier to check day index again or grab from header style?
                    // Let's re-eval DOW for bg
                    let dow = '';
                    if (dayOfWeeks && dayOfWeeks[i]) dow = dayOfWeeks[i];
                    else {
                        const d = new Date(dates[i]);
                        const days = ['日', '月', '火', '水', '木', '金', '土'];
                        dow = days[d.getDay()];
                    }

                    if (dow === '土') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
                    if (dow === '日') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };

                    // Preference Highlight (Red Border)
                    const isPreference = staff.shiftMeta && staff.shiftMeta[date] && staff.shiftMeta[date].isPreference;
                    if (isPreference) {
                        const redBorder = { style: "thick", color: { argb: "FFFF0000" } };
                        cell.border = { top: redBorder, bottom: redBorder, left: redBorder, right: redBorder };
                    }

                    // *** Data Validation (Dropdown) ***
                    cell.dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`"${SHIFT_TYPES.join(',')}"`]
                    };
                });

                // Counters (Formulas)
                // Range for this row's shifts:
                // Start: dateStartCol (2)
                // End: dateStartCol + dates.length - 1
                const startCell = row.getCell(dateStartCol).address;
                const endCell = row.getCell(dateStartCol + dates.length - 1).address;
                const range = `${startCell}:${endCell}`;

                // c is already declared above

                const setCounterFormula = (colOffset, criteria, label) => {
                    const cell = row.getCell(counterStartCol + colOffset);
                    cell.border = defaultBorder;
                    cell.alignment = centerAlign;
                    cell.font = { ...baseFont, size: 9 };
                    cell.value = { formula: `COUNTIF(${range}, "${criteria}")`, result: c[label] || 0 };
                };

                setCounterFormula(0, '早', '早');
                setCounterFormula(1, '日', '日');
                setCounterFormula(2, '遅', '遅');
                setCounterFormula(3, '夜', '夜');
                setCounterFormula(4, '明', '明');
                setCounterFormula(5, '休', '休');

                // Conditional Formatting: Holiday Warning
                // If actual holidays != target holidays
                const holidayTarget = parseInt(staff['公休数'], 10) || defaultMonthlyHoliday;
                const holidayCellAddress = row.getCell(counterStartCol + 5).address;
                worksheet.addConditionalFormatting({
                    ref: holidayCellAddress,
                    rules: [
                        {
                            type: 'cellIs',
                            operator: 'notEqual',
                            formulae: [`${holidayTarget}`],
                            style: {
                                fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB3B' } }, // Yellow
                                font: { color: { argb: 'FF000000' }, bold: true }
                            }
                        }
                    ]
                });
            });

            // --- Footer Rows (Total) ---
            const footerTitles = ["早", "日", "遅", "夜"];
            const footerKeys = ["早", "日", "遅", "夜"];

            // Define data range rows
            // Body rows start after header rows. 
            // Header rows: Title(1) + Dates(1) + Days(1) + Spacer(1) = 4 rows?
            // Actually: 
            // 1. Title (row 1)
            // 2. Dates (row 2)
            // 3. Days (row 3)
            // 4. Spacer -> row 4 (empty)
            // 5. Body starts at row 5.
            const dataStartRow = 5;
            const dataEndRow = dataStartRow + table.length - 1;

            // Totals Section
            worksheet.addRow([]); // Spacer
            const totalLabelRow = worksheet.addRow(['合計']);
            totalLabelRow.getCell(1).font = { ...baseFont, bold: true };

            footerTitles.forEach((title, idx) => {
                const key = footerKeys[idx];
                const rowVals = [title];

                // Perform row addition first to get the row object
                const r = worksheet.addRow(rowVals);

                // Style Title
                const titleCell = r.getCell(1);
                titleCell.fill = headerFill;
                titleCell.border = defaultBorder;
                titleCell.alignment = centerAlign;
                titleCell.font = baseFont;

                dates.forEach((_, i) => {
                    const cell = r.getCell(dateStartCol + i);
                    cell.border = defaultBorder;
                    cell.alignment = centerAlign;
                    cell.font = { ...baseFont, size: 9 };

                    // Construct Column Range
                    // e.g. B5:B20
                    // We need column letter. ExcelJS getCell(col, row) can accept numbers.
                    // But for formula relative reference or explicit range construction?
                    // ExcelJS doesn't give easily "Column Letter" from index usually, but address property helps.
                    // Let's get address of top and bottom cells of this column options.
                    // optimization: avoid repeated getCell calls if slow, but here it's fine.

                    // Let's use `worksheet.getRow(rowNum).getCell(colNum).address` to be safe.
                    const topAddress = worksheet.getRow(dataStartRow).getCell(dateStartCol + i).address;
                    const bottomAddress = worksheet.getRow(dataEndRow).getCell(dateStartCol + i).address;

                    cell.value = { formula: `COUNTIF(${topAddress}:${bottomAddress}, "${title}")`, result: colCounts[i][key] || 0 };

                    // Conditional Formatting: Daily Requirement Warning
                    // Need to find requirement for this date and shift type (title)
                    // title is '早', '日', '遅', '夜'

                    // Normalize Date Helper (Reused from footer render logic, can be extracted or duplicated here)
                    const normalizeDate = (s) => {
                        if (!s) return null;
                        if (typeof s === 'number') {
                            const utc_days = Math.floor(s - 25569);
                            const utc_value = utc_days * 86400;
                            const date_info = new Date(utc_value * 1000);
                            const y = date_info.getFullYear();
                            const m = ('0' + (date_info.getMonth() + 1)).slice(-2);
                            const d = ('0' + date_info.getDate()).slice(-2);
                            return `${y}/${m}/${d}`;
                        }
                        const str = String(s).trim();
                        let m = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
                        if (m) return `${m[1]}/${('0' + m[2]).slice(-2)}/${('0' + m[3]).slice(-2)}`;
                        return str;
                    };

                    const dateStr = dates[i]; // "2025-04-01"
                    // Requirement keys map: '早' -> '早必要' etc.
                    // But date format in requirements might differ. 
                    // Let's try to match by normalized date.
                    const reqRow = requirements.find(r => {
                        const rDate = normalizeDate(r['日付'] || r['Date']);
                        // dateStr is typical YYYY-MM-DD from dates array.
                        // normalizeDate produces YYYY/MM/DD or original string.
                        // Let's ensure dateStr is YYYY/MM/DD for comparison if needed or just compare flexible.
                        // Actually dates array usually has "YYYY-MM-DD".
                        // Let's standardize to compare.
                        const d1 = new Date(rDate).getTime();
                        const d2 = new Date(dateStr).getTime();
                        return !isNaN(d1) && !isNaN(d2) && d1 === d2;
                    });

                    if (reqRow) {
                        let reqVal = undefined;
                        if (title === '早') reqVal = reqRow['早必要'] ?? reqRow['早'];
                        if (title === '日') reqVal = reqRow['日必要'] ?? reqRow['日勤必要'] ?? reqRow['日'];
                        if (title === '遅') reqVal = reqRow['遅必要'] ?? reqRow['遅'];
                        if (title === '夜') reqVal = reqRow['夜必要'] ?? reqRow['夜'];

                        if (reqVal !== undefined && reqVal !== null && String(reqVal).trim() !== "") {
                            const requiredNum = parseInt(reqVal, 10);
                            // Add rule
                            worksheet.addConditionalFormatting({
                                ref: cell.address,
                                rules: [
                                    {
                                        type: 'cellIs',
                                        operator: 'notEqual',
                                        formulae: [`${requiredNum}`],
                                        style: {
                                            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB3B' } }, // Yellow
                                            font: { color: { argb: 'FF000000' }, bold: true }
                                        }
                                    }
                                ]
                            });
                        }
                    }
                });
            });


            // Generate Buffer
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `Shift_${targetDate || "Export"}.xlsx`);

        } catch (e) {
            console.error("Export Error:", e);
            alert(`Excel出力中にエラーが発生しました:\n${e.message}`);
        }
    };

    const handlePrintPDF = () => {
        // Just trigger browser print.
        // CSS @media print handles the rest.
        window.print();
    };

    // Zoom controls
    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 1.5));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));

    // Counters
    // Row Counts (per staff)
    const rowCounts = useMemo(() => {
        return table.map(staff => {
            const counts = { '早': 0, '日': 0, '遅': 0, '夜': 0, '明': 0, '休': 0, '勤': 0 };
            dates.forEach(date => {
                const val = staff.shifts[date];
                if (counts[val] !== undefined) counts[val]++;
                if (["早", "日", "遅", "夜"].includes(val)) counts['勤']++;
            });
            return counts;
        });
    }, [table, dates]);

    // Column Counts (per day)
    const colCounts = useMemo(() => {
        const counts = dates.map(date => ({ '早': 0, '日': 0, '遅': 0, '夜': 0, '明': 0, '休': 0 }));
        table.forEach(staff => {
            dates.forEach((date, i) => {
                const val = staff.shifts[date];
                // Exclude Trainee shifts from counts
                if (val && val.includes('研修')) return;

                if (counts[i][val] !== undefined) counts[i][val]++;
            });
        });
        return counts;
    }, [table, dates]);

    // Style for Zoom
    // NOTE: transform creates a containing block which breaks position:sticky.
    // We only apply transform if scale != 1. Ideally we would use 'zoom' property for Blink browsers but transform is standard.
    // When scale is 1, we remove the transform to ensure sticky works perfectly.
    const tableStyle = scale === 1 ? {} : {
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: `${100 / scale}%`
    };

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-4 bg-white p-2 rounded-lg shadow-sm w-fit border border-slate-200 sticky left-0 print:hidden">
                <button onClick={handleZoomOut} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="縮小"><ZoomOut size={20} /></button>
                <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                <button onClick={handleZoomIn} className="p-1 hover:bg-slate-100 rounded text-slate-600" title="拡大"><ZoomIn size={20} /></button>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                    <input type="checkbox" checked={showCounter} onChange={e => setShowCounter(e.target.checked)} className="rounded text-indigo-600" />
                    カウンター表示
                </label>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                    <input type="checkbox" checked={isSticky} onChange={e => setIsSticky(e.target.checked)} className="rounded text-indigo-600" />
                    追従
                </label>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>

                <button
                    onClick={handleDownloadExcel}
                    className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded text-sm font-bold transition-colors"
                >
                    <FileSpreadsheet size={16} /> Excel出力
                </button>
                <button
                    onClick={handlePrintPDF}
                    className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-sm font-bold transition-colors"
                >
                    <Printer size={16} /> PDF/印刷
                </button>

                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <button
                    onClick={handleSaveHistory}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-bold transition-colors"
                >
                    <Save size={16} /> 保存
                </button>
            </div>

            <div className="overflow-auto border rounded-xl shadow-sm bg-white pb-4 max-h-[80vh] relative print:overflow-visible print:max-h-none print:border-none print:shadow-none">
                <div style={tableStyle} className="print:transform-none print:w-full">
                    <table className="min-w-full divide-y divide-slate-200 text-sm border-separate border-spacing-0">
                        <thead className="bg-slate-50 print:bg-white">
                            <tr>
                                <th className="px-2 py-3 text-left font-bold text-slate-700 sticky left-0 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-20 w-32 min-w-[140px] rounded-tl-xl top-0 print:static print:shadow-none print:border-slate-300">
                                    氏名
                                </th>
                                {/* Counters Header */}
                                {showCounter && (
                                    <>
                                        <th className="px-1 py-1 text-center text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200 sticky top-0 z-10 w-8 print:static">早</th>
                                        <th className="px-1 py-1 text-center text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200 sticky top-0 z-10 w-8 print:static">日</th>
                                        <th className="px-1 py-1 text-center text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200 sticky top-0 z-10 w-8 print:static">遅</th>
                                        <th className="px-1 py-1 text-center text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200 sticky top-0 z-10 w-8 print:static">夜</th>
                                        <th className="px-1 py-1 text-center text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200 sticky top-0 z-10 w-8 print:static">明</th>
                                        <th className="px-1 py-1 text-center text-xs font-bold text-slate-500 bg-slate-50 border-r border-b border-slate-200 sticky top-0 z-10 w-8 print:static">休</th>
                                    </>
                                )}
                                {dates.map((date, i) => {
                                    // Calculate Day of Week if not provided (fallback)
                                    const d = new Date(date);
                                    const days = ['日', '月', '火', '水', '木', '金', '土'];
                                    const dow = dayOfWeeks ? dayOfWeeks[i] : days[d.getDay()];
                                    const isSat = dow === '土';
                                    const isSun = dow === '日';
                                    // Removed transparency (/50) and used slightly darker shades for better visibility
                                    const headerColor = isSun ? 'text-red-600 bg-red-100' : isSat ? 'text-blue-600 bg-blue-100' : 'text-slate-700 bg-slate-50';

                                    return (
                                        <th key={date} className={`px-1 py-3 text-center font-medium min-w-[40px] whitespace-nowrap ${headerColor} border-b border-slate-200 sticky top-0 z-10 print:static print:border-slate-300`}>
                                            <div className="text-[10px] leading-tight opacity-70 mb-0.5">{date.slice(5)}</div>
                                            <div className="text-sm">{dow}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {table.map((staff, rowIndex) => (
                                <tr key={staff.name} className="hover:bg-slate-50/80 transition-colors print:break-inside-avoid">
                                    {/* Name */}
                                    <td className="px-4 py-1.5 font-medium text-slate-800 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-10 truncate group-hover:bg-slate-50 text-xs h-10 print:static print:shadow-none print:border-slate-300">
                                        {staff.name}
                                    </td>

                                    {/* Row Counters */}
                                    {showCounter && (() => {
                                        const count = rowCounts[rowIndex];
                                        const holiday = parseInt(staff['公休数'], 10) || defaultMonthlyHoliday;
                                        // Warning if actual rest days != target holiday (shortage OR excess)
                                        const isExclusive = staff['専属'] === true || staff['専属'] === '〇' || staff['専属'] === 'TRUE';
                                        const isTrainee = staff['研修生'] === true || staff['研修生'] === '〇' || staff['研修生'] === 'TRUE';

                                        const workDays = parseInt(staff['勤務日数/週'], 10);
                                        const isWeek5 = workDays === 5;

                                        // Suppress warning if:
                                        // 1. Staff is Exclusive
                                        // 2. AND NOT Week 5
                                        // 3. AND NOT Trainee (Trainees should always show warnings)
                                        const suppressWarning = isExclusive && !isWeek5 && !isTrainee;

                                        const isWarning = !suppressWarning && (count['休'] !== holiday);

                                        return (
                                            <>
                                                <td className="text-center text-xs bg-slate-50/50 text-slate-600 font-mono border-b border-slate-100 print:border-slate-300">{count['早'] || 0}</td>
                                                <td className="text-center text-xs bg-slate-50/50 text-slate-600 font-mono border-b border-slate-100 print:border-slate-300">{rowCounts[rowIndex]['日'] || 0}</td>
                                                <td className="text-center text-xs bg-slate-50/50 text-slate-600 font-mono border-b border-slate-100 print:border-slate-300">{rowCounts[rowIndex]['遅'] || 0}</td>
                                                <td className="text-center text-xs bg-slate-50/50 text-slate-600 font-mono border-b border-slate-100 print:border-slate-300">{rowCounts[rowIndex]['夜'] || 0}</td>
                                                <td className="text-center text-xs bg-slate-50/50 text-slate-600 font-mono border-b border-slate-100 print:border-slate-300">{rowCounts[rowIndex]['明'] || 0}</td>
                                                <td className={`text-center text-xs font-mono border-r border-b border-slate-100 print:border-slate-300 ${isWarning ? 'bg-yellow-300 font-bold text-slate-900 border-yellow-400' : 'bg-slate-50/50 text-slate-600'}`}>
                                                    {rowCounts[rowIndex]['休'] || 0}
                                                </td>
                                            </>
                                        );
                                    })()}

                                    {/* Shift Cells */}
                                    {dates.map(date => {
                                        const val = staff.shifts[date];
                                        return (
                                            <td key={date} className="p-0 border-b border-slate-100 h-10 w-10 print:border-slate-300">
                                                <ShiftCell
                                                    value={val}
                                                    onChange={(newVal) => onCellChange && onCellChange(rowIndex, date, newVal)}
                                                    isPreference={staff.shiftMeta?.[date]?.isPreference}
                                                />

                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>

                        {/* Footer: Column Counters */}
                        {showCounter && (
                            <tfoot className={`bg-slate-50 font-bold text-xs shadow-[0_-2px_5px_-2px_rgba(0,0,0,0.1)] print:table-row-group print:static print:shadow-none ${isSticky ? "sticky bottom-0 z-20" : ""}`}>
                                <tr>
                                    <td className="px-4 py-2 sticky left-0 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-30 print:static print:shadow-none print:border-slate-300">
                                        合計 (早/日/遅/夜)
                                    </td>
                                    <td colSpan={6} className="border-r border-slate-200 print:border-slate-300"></td>
                                    {colCounts.map((counts, i) => {
                                        const date = dates[i];

                                        // Helper to normalize date (similar to ShiftEngine)
                                        const normalizeDate = (s) => {
                                            if (!s) return null;
                                            if (typeof s === 'number') {
                                                const utc_days = Math.floor(s - 25569);
                                                const utc_value = utc_days * 86400;
                                                const date_info = new Date(utc_value * 1000);
                                                const y = date_info.getFullYear();
                                                const m = ('0' + (date_info.getMonth() + 1)).slice(-2);
                                                const d = ('0' + date_info.getDate()).slice(-2);
                                                return `${y}/${m}/${d}`;
                                            }
                                            let str = String(s).trim();

                                            // Unified format YYYY/MM/DD
                                            // Handle YYYY-MM-DD
                                            str = str.replace(/-/g, '/');

                                            // Handle YYYY/M/D -> YYYY/MM/DD
                                            const parts = str.split('/');
                                            if (parts.length === 3) {
                                                const y = parts[0];
                                                const m = ('0' + parts[1]).slice(-2);
                                                const d = ('0' + parts[2]).slice(-2);
                                                return `${y}/${m}/${d}`;
                                            }

                                            return str;
                                        };

                                        // Find requirement for this date
                                        const reqRow = requirements.find(r => {
                                            const rDate = normalizeDate(r['日付'] || r['Date']);
                                            return rDate === date; // date is already YYYY/MM/DD from ShiftEngine
                                        }) || {};

                                        const check = (type) => {
                                            // Map type to possible keys in requirement sheet
                                            // '早' -> '早', '早必要', etc.
                                            let reqVal = undefined;

                                            if (type === '早') reqVal = reqRow['早必要'] ?? reqRow['早'];
                                            if (type === '日') reqVal = reqRow['日必要'] ?? reqRow['日勤必要'] ?? reqRow['日'];
                                            if (type === '遅') reqVal = reqRow['遅必要'] ?? reqRow['遅'];
                                            if (type === '夜') reqVal = reqRow['夜必要'] ?? reqRow['夜'];

                                            if (reqVal === undefined || reqVal === null || String(reqVal).trim() === "") return false;

                                            const required = parseInt(reqVal, 10);
                                            const actual = counts[type] || 0;

                                            return actual !== required;
                                        };

                                        return (
                                            <td key={dates[i]} className="text-center py-2 border-r border-slate-200/50 last:border-0 min-w-[40px] print:border-slate-300">
                                                <div className={`${check('早') ? 'bg-yellow-300 text-slate-900 font-extrabold px-1 rounded' : 'text-orange-600'}`}>{counts['早'] || 0}</div>
                                                <div className={`${check('日') ? 'bg-yellow-300 text-slate-900 font-extrabold px-1 rounded' : 'text-green-600'}`}>{counts['日'] || 0}</div>
                                                <div className={`${check('遅') ? 'bg-yellow-300 text-slate-900 font-extrabold px-1 rounded' : 'text-blue-600'}`}>{counts['遅'] || 0}</div>
                                                <div className={`${check('夜') ? 'bg-yellow-300 text-slate-900 font-extrabold px-1 rounded' : 'text-indigo-600'}`}>{counts['夜'] || 0}</div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div >
    );
};

export default ShiftTableView;
