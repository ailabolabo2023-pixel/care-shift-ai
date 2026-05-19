import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import React, { useState, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize, Minimize, Save, FileSpreadsheet, Printer } from 'lucide-react';
import { isHoliday, getHolidayName } from '../utils/holidays';

const SHIFT_TYPES = ["", "早", "日", "遅", "夜", "研修（早）", "研修（日）", "研修（遅）", "研修（夜）", "研修", "明", "休", "有", "公", "予", "誕休"]; // v2.3 Expanded

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
        if (val === '研修') return 'text-amber-600 bg-amber-50';
        if (val === '誕休') return 'text-purple-600 font-bold bg-purple-50';
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

    const getFontSize = (val) => {
        if (!val) return undefined;
        if (val.length >= 4) return '0.5rem'; // 研修（早）など
        if (val.includes('研修')) return '0.6rem'; // 研修単体
        return '0.85rem';
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

                className={`w-full h-full text-center appearance-none cursor-pointer border-transparent hover:border-orange-300 border transition-all focus:ring-2 focus:ring-orange-200 outline-none rounded-sm ${colorClass} print:hidden`}
                style={{ textAlignLast: 'center', fontSize: getFontSize(value), letterSpacing: value && value.length >= 4 ? '-0.05em' : undefined }}
            >
                {SHIFT_TYPES.map(type => (
                    <option key={type} value={type} style={{ fontSize: '1rem' }}>{type || "-"}</option>
                ))}
            </select>

            {/* Print View */}
            <div className={`hidden print:flex w-full h-full items-center justify-center font-bold leading-none ${colorClass}`} 
                 style={{ 
                    printColorAdjust: 'exact', 
                    WebkitPrintColorAdjust: 'exact',
                    fontSize: value && value.length >= 4 ? '0.5rem' : value && value.includes('研修') ? '0.6rem' : '0.8rem'
                 }}>
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
                const [year, month] = targetDate.split(/[/-]/).map(Number);
                const nextDate = new Date(year, month, 1);
                const nextYear = nextDate.getFullYear();
                const nextMonthStr = String(nextDate.getMonth() + 1).padStart(2, '0');
                const nextKey = `繰越_${nextYear}-${nextMonthStr}`;

                const lastDate = dates[dates.length - 1]; // "YYYY-MM-DD"

                const carryOverData = table.map(staff => {
                    const lastShift = staff.shifts[lastDate];
                    let day1 = "";
                    let day2 = "";

                    if (lastShift === '夜' || lastShift === '研修（夜）') {
                        day1 = "明";
                        day2 = "休";
                    } else if (lastShift === '明') {
                        day1 = "休";
                    }
                    return { "氏名": staff.name, "1": day1, "2": day2 };
                });

                updateSheetData(nextKey, carryOverData);
                alert(`保存しました。\n翌月（${nextYear}-${nextMonthStr}）の繰越設定も自動更新しました。`);
            } catch (e) {
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

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Shift');

            const columns = [
                { header: '', key: 'name', width: 20 },
                ...dates.map((_, i) => ({ header: '', key: `date_${i}`, width: 4 })),
                { header: '', key: 'spacer_1', width: 2 },
                { header: '', key: 'count_early', width: 4 },
                { header: '', key: 'count_day', width: 4 },
                { header: '', key: 'count_late', width: 4 },
                { header: '', key: 'count_night', width: 4 },
                { header: '', key: 'count_ming', width: 4 },
                { header: '', key: 'count_holiday', width: 4 },
            ];
            worksheet.columns = columns;

            const borderStyle = { style: "thin", color: { argb: "FF000000" } };
            const baseFont = { name: "Yu Gothic", size: 10 };
            const centerAlign = { vertical: "middle", horizontal: "center" };
            const defaultBorder = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
            const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };

            worksheet.mergeCells('A1:C1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = `対象年月: ${targetDate || ""}`;
            titleCell.font = { name: "Yu Gothic", size: 12, bold: true };

            const row2Values = [''];
            dates.forEach(d => {
                const dateObj = new Date(String(d).replace(/\//g, '-'));
                row2Values.push(`${dateObj.getDate()}日`);
            });
            row2Values.push('');
            row2Values.push('早', '日', '遅', '夜', '明', '休');
            const row2 = worksheet.addRow(row2Values);

            const dateStartCol = 2;
            const counterStartCol = dateStartCol + dates.length + 1;
            for (let i = 0; i < 6; i++) {
                const cell = row2.getCell(counterStartCol + i);
                cell.fill = headerFill;
                cell.border = defaultBorder;
                cell.alignment = centerAlign;
                cell.font = { ...baseFont, size: 9 };
            }
            for (let i = 0; i < dates.length; i++) {
                const cell = row2.getCell(dateStartCol + i);
                cell.alignment = centerAlign;
                cell.font = { ...baseFont, size: 9 };
                cell.border = defaultBorder;
            }

            const row3Values = ['氏名'];
            dates.forEach((date, i) => {
                let dow = '';
                if (dayOfWeeks && dayOfWeeks[i]) dow = dayOfWeeks[i];
                else {
                    const d = new Date(String(date).replace(/\//g, '-'));
                    const days = ['日', '月', '火', '水', '木', '金', '土'];
                    dow = days[d.getDay()];
                }
                const holidayName = isHoliday(date) ? getHolidayName(date) : null;
                row3Values.push(holidayName ? `${dow}(祝)` : dow);
            });
            row3Values.push('');
            row3Values.push('', '', '', '', '', '');
            const row3 = worksheet.addRow(row3Values);

            const nCell = row3.getCell(1);
            nCell.fill = headerFill;
            nCell.border = defaultBorder;
            nCell.alignment = centerAlign;
            nCell.font = { ...baseFont, bold: true };

            dates.forEach((date, i) => {
                const cell = row3.getCell(dateStartCol + i);
                const dow = dayOfWeeks?.[i] || "";
                const isHol = isHoliday(date);
                cell.border = defaultBorder;
                cell.alignment = centerAlign;

                let fontColor = 'FF000000';
                let bgColor = null;

                if (dow === '土') { fontColor = 'FF0000FF'; bgColor = 'FFE0F2FE'; }
                else if (dow === '日' || isHol) { fontColor = 'FFFF0000'; bgColor = 'FFFEE2E2'; }

                cell.font = { ...baseFont, color: { argb: fontColor } };
                if (bgColor) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
            });

            table.forEach((staff, rowIndex) => {
                const rowData = [staff.name];
                dates.forEach(date => rowData.push(staff.shifts[date] || ''));
                rowData.push('');
                const c = rowCounts[rowIndex];
                rowData.push(c['早'] || 0, c['日'] || 0, c['遅'] || 0, c['夜'] || 0, c['明'] || 0, c['休'] || 0);
                const row = worksheet.addRow(rowData);

                row.getCell(1).border = defaultBorder;
                row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
                row.getCell(1).font = baseFont;

                dates.forEach((date, i) => {
                    const cell = row.getCell(dateStartCol + i);
                    const val = staff.shifts[date];
                    cell.border = defaultBorder;
                    cell.alignment = centerAlign;

                    let color = 'FF334155';
                    let bold = false;
                    if (val === '夜' || val === '研修（夜）') { color = 'FF4F46E5'; bold = true; }
                    else if (val === '休') { color = 'FFEF4444'; }
                    else if (val === '日') { color = 'FF16A34A'; }
                    else if (val === '早') { color = 'FFEA580C'; }
                    else if (val === '遅') { color = 'FF2563EB'; }
                    cell.font = { ...baseFont, color: { argb: color }, bold: bold };

                    const dow = dayOfWeeks?.[i] || "";
                    if (dow === '土') cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
                    if (dow === '日' || isHoliday(date)) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };

                    const isRef = staff.shiftMeta && staff.shiftMeta[date] && staff.shiftMeta[date].isPreference;
                    if (isRef) {
                        const redBorder = { style: "thick", color: { argb: "FFFF0000" } };
                        cell.border = { top: redBorder, bottom: redBorder, left: redBorder, right: redBorder };
                    }

                    cell.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${SHIFT_TYPES.join(',')}"`] };
                });

                const startCell = row.getCell(dateStartCol).address;
                const endCell = row.getCell(dateStartCol + dates.length - 1).address;
                const range = `${startCell}:${endCell}`;

                const setCounterFormula = (colOffset, criteria, label) => {
                    const cell = row.getCell(counterStartCol + colOffset);
                    cell.border = defaultBorder;
                    cell.alignment = centerAlign;
                    cell.font = { ...baseFont, size: 9 };
                    cell.value = { formula: `COUNTIF(${range}, "${criteria}")`, result: c[label] || 0 };
                };

                setCounterFormula(0, '早', '早'); setCounterFormula(1, '日', '日'); setCounterFormula(2, '遅', '遅');
                setCounterFormula(3, '夜', '夜'); setCounterFormula(4, '明', '明'); setCounterFormula(5, '休', '休');

                const hTarget = parseInt(staff['公休数'], 10) || defaultMonthlyHoliday;
                const hCellAddr = row.getCell(counterStartCol + 5).address;
                worksheet.addConditionalFormatting({
                    ref: hCellAddr,
                    rules: [{ type: 'cellIs', operator: 'notEqual', formulae: [`${hTarget}`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB3B' } }, font: { color: { argb: 'FF000000' }, bold: true } } }]
                });
            });

            const dataStartRow = 5;
            const dataEndRow = dataStartRow + table.length - 1;
            worksheet.addRow([]);
            const totalLabelRow = worksheet.addRow(['合計']);
            totalLabelRow.getCell(1).font = { ...baseFont, bold: true };

            const footerTitles = ["早", "日", "遅", "夜"];
            footerTitles.forEach((title, idx) => {
                const r = worksheet.addRow([title]);
                r.getCell(1).fill = headerFill;
                r.getCell(1).border = defaultBorder;
                r.getCell(1).alignment = centerAlign;
                r.getCell(1).font = baseFont;

                dates.forEach((date, i) => {
                    const cell = r.getCell(dateStartCol + i);
                    cell.border = defaultBorder;
                    cell.alignment = centerAlign;
                    cell.font = { ...baseFont, size: 9 };
                    const tAddr = worksheet.getRow(dataStartRow).getCell(dateStartCol + i).address;
                    const bAddr = worksheet.getRow(dataEndRow).getCell(dateStartCol + i).address;
                    cell.value = { formula: `COUNTIF(${tAddr}:${bAddr}, "${title}")`, result: colCounts[i][title] || 0 };

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

                    const reqRow = requirements.find(req => {
                        const rDate = normalizeDate(req['日付'] || req['Date']);
                        return new Date(rDate).getTime() === new Date(date).getTime();
                    });

                    if (reqRow) {
                        let rVal = reqRow[title === '日' ? '日必要' : `${title}必要`] ?? reqRow[title];
                        if (rVal !== undefined && rVal !== null && String(rVal).trim() !== "") {
                            worksheet.addConditionalFormatting({
                                ref: cell.address,
                                rules: [{ type: 'cellIs', operator: 'notEqual', formulae: [`${parseInt(rVal, 10)}`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB3B' } }, font: { color: { argb: 'FF000000' }, bold: true } } }]
                            });
                        }
                    }
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const safeDate = (targetDate || "Export").replace(/\//g, '-');
            const filename = `Shift_${safeDate}.xlsx`;
            
            // file-saver(saveAs)を使わず、ブラウザ標準の機能で強制的にダウンロードさせる
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // 後処理
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (e) { alert(`Excel出力エラー: ${e.message}`); }
    };

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 1.5));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));

    const rowCounts = useMemo(() => {
        return table.map(staff => {
            const counts = { '早': 0, '日': 0, '遅': 0, '夜': 0, '明': 0, '休': 0 };
            dates.forEach(date => {
                const val = staff.shifts[date];
                if (val === '早' || val === '研修（早）') counts['早']++;
                else if (val === '日' || val === '研修（日）') counts['日']++;
                else if (val === '遅' || val === '研修（遅）') counts['遅']++;
                else if (val === '夜' || val === '研修（夜）') counts['夜']++;
                else if (val === '明') counts['明']++;
                else if (val === '休' || val === '有' || val === '公') counts['休']++;
            });
            return counts;
        });
    }, [table, dates]);

    const colCounts = useMemo(() => {
        const counts = dates.map(() => ({ '早': 0, '日': 0, '遅': 0, '夜': 0, '明': 0, '休': 0 }));
        table.forEach(staff => {
            dates.forEach((date, i) => {
                const val = staff.shifts[date];
                if (counts[i][val] !== undefined) counts[i][val]++;
            });
        });
        return counts;
    }, [table, dates]);

    const tableStyle = scale === 1 ? {} : { transform: `scale(${scale})`, transformOrigin: 'top left', width: `${100 / scale}%` };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white p-2 rounded-lg shadow-sm w-fit border border-slate-200 sticky left-0 print:hidden">
                <button onClick={handleZoomOut} className="p-1 hover:bg-slate-100 rounded text-slate-600"><ZoomOut size={20} /></button>
                <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                <button onClick={handleZoomIn} className="p-1 hover:bg-slate-100 rounded text-slate-600"><ZoomIn size={20} /></button>
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
                <button onClick={handleDownloadExcel} className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 hover:bg-green-100 rounded text-sm font-bold"><FileSpreadsheet size={16} /> Excel出力</button>
                <button onClick={() => window.print()} className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded text-sm font-bold"><Printer size={16} /> PDF/印刷</button>
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <button onClick={handleSaveHistory} className="flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-bold"><Save size={16} /> 保存</button>
            </div>

            <div className="overflow-auto border rounded-xl shadow-sm bg-white pb-4 max-h-[80vh] relative print:overflow-visible print:max-h-none print:border-none print:shadow-none">
                <div style={tableStyle} className="print:transform-none print:w-full">
                    <table className="min-w-full divide-y divide-slate-200 text-sm border-separate border-spacing-0">
                        <thead className="bg-slate-50 print:bg-white">
                            <tr>
                                <th className="px-2 py-3 text-left font-bold text-slate-700 sticky left-0 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-20 w-32 min-w-[140px] rounded-tl-xl top-0 print:static">氏名</th>
                                {showCounter && ["早", "日", "遅", "夜", "明", "休"].map(h => <th key={h} className={`px-1 py-1 text-center text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-200 sticky top-0 z-10 w-8 ${h==='休'?'border-r':''}`}>{h}</th>)}
                                {dates.map((date, i) => {
                                    const dow = dayOfWeeks ? dayOfWeeks[i] : (['日','月','火','水','木','金','土'][new Date(date).getDay()]);
                                    const isSat = dow === '土'; const isSun = dow === '日'; const isHol = isHoliday(date);
                                    const headerColor = (isSun || isHol) ? 'text-red-500 bg-red-50' : isSat ? 'text-blue-500 bg-blue-50' : 'text-slate-600 bg-white';
                                    return (
                                        <th key={date} className={`px-1 py-3 text-center font-medium min-w-[40px] whitespace-nowrap ${headerColor} border-b border-slate-200 sticky top-0 z-10 print:static`}>
                                            <div className="text-[10px] leading-tight mb-0.5">{String(date).slice(String(date).length-5)}</div>
                                            <div className="text-sm">{dow}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {table.map((staff, rowIndex) => (
                                <tr key={staff.name} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-4 py-1.5 font-medium text-slate-800 sticky left-0 bg-white border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-10 truncate text-xs h-10 print:static">{staff.name}</td>
                                    {showCounter && (() => {
                                        const count = rowCounts[rowIndex];
                                        const hTarget = parseInt(staff['公休数'], 10) || defaultMonthlyHoliday;
                                        const isWarning = (count['休'] !== hTarget);
                                        return ["早", "日", "遅", "夜", "明", "休"].map(h => (
                                            <td key={h} className={`text-center text-xs bg-slate-50/50 text-slate-600 font-mono border-b border-slate-100 ${h==='休'?(isWarning?'bg-yellow-300 font-bold text-slate-900 border-r':'border-r'):''}`}>{count[h] || 0}</td>
                                        ));
                                    })()}
                                    {dates.map(date => (
                                        <td key={date} className="p-0 border-b border-slate-100 h-10 w-10">
                                            <ShiftCell value={staff.shifts[date]} onChange={val => onCellChange && onCellChange(rowIndex, date, val)} isPreference={staff.shiftMeta?.[date]?.isPreference} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        {showCounter && (
                            <tfoot className={`bg-slate-50 font-bold text-xs shadow-[0_-2px_5px_-2px_rgba(0,0,0,0.1)] ${isSticky ? "sticky bottom-0 z-20" : ""}`}>
                                <tr>
                                    <td className="px-4 py-2 sticky left-0 bg-slate-50 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] z-30 print:static">合計 (早/日/遅/夜)</td>
                                    <td colSpan={6} className="border-r border-slate-200"></td>
                                    {dates.map((date, i) => {
                                        const reqRow = requirements.find(r => new Date(r['日付']||r['Date']).getTime() === new Date(date).getTime()) || {};
                                        const check = (t) => (colCounts[i][t] || 0) !== parseInt(reqRow[t==='日'?'日必要':`${t}必要`] ?? reqRow[t], 10);
                                        return (
                                            <td key={date} className="text-center py-2 border-r border-slate-200/50 last:border-0 min-w-[40px]">
                                                {["早", "日", "遅", "夜"].map(t => (
                                                    <div key={t} className={`${check(t) ? 'bg-yellow-300 text-slate-900 font-extrabold px-1 rounded' : (t==='早'?'text-orange-600':t==='日'?'text-green-600':t==='遅'?'text-blue-600':'text-indigo-600')}`}>{colCounts[i][t] || 0}</div>
                                                ))}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ShiftTableView;
