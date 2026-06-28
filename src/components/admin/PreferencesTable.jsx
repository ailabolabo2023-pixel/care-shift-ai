import React, { useState, useEffect } from 'react';
import { Save, Calendar, Copy, Clipboard, X } from 'lucide-react';

// カレンダー複数選択モーダル
const MultiDatePickerModal = ({ isOpen, onClose, onSave, title, initialValue, monthStr }) => {
    const [selectedDays, setSelectedDays] = useState([]);

    useEffect(() => {
        if (isOpen) {
            const days = initialValue
                ? initialValue.split(',')
                    .map(s => parseInt(s.trim(), 10))
                    .filter(n => !isNaN(n))
                : [];
            setSelectedDays(days);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const [yearStr, monthNumStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthNumStr, 10) - 1;

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
    const paddingArray = Array.from({ length: startDayOfWeek }, (_, i) => null);

    const toggleDay = (day) => {
        setSelectedDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day]
        );
    };

    const handleApply = () => {
        const sorted = [...selectedDays].sort((a, b) => a - b);
        onSave(sorted.join(', '));
        onClose();
    };

    const handleClear = () => {
        setSelectedDays([]);
    };

    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
                <div className="bg-stone-50 px-4 py-3 border-b border-stone-100 flex justify-between items-center">
                    <h4 className="font-bold text-stone-700 text-sm truncate">{title}</h4>
                    <button onClick={onClose} className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4">
                    <div className="text-center font-bold text-stone-600 mb-2">
                        {year}年{month + 1}月
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-stone-500 mb-2">
                        {weekdays.map((w, idx) => (
                            <span key={w} className={idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : ''}>
                                {w}
                            </span>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {paddingArray.map((_, i) => (
                            <div key={`pad-${i}`} />
                        ))}
                        {daysArray.map(day => {
                            const isSelected = selectedDays.includes(day);
                            const dateObj = new Date(year, month, day);
                            const dayOfWeek = dateObj.getDay();
                            
                            let textClass = 'text-stone-700';
                            if (dayOfWeek === 0) textClass = 'text-red-500';
                            if (dayOfWeek === 6) textClass = 'text-blue-500';

                            return (
                                <button
                                    key={day}
                                    onClick={() => toggleDay(day)}
                                    className={`h-9 rounded-lg font-semibold text-sm transition-all flex items-center justify-center
                                        ${isSelected 
                                            ? 'bg-blue-600 text-white shadow-sm scale-105' 
                                            : `hover:bg-stone-100 ${textClass}`
                                        }`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-stone-50 px-4 py-3 border-t border-stone-100 flex justify-between gap-2">
                    <button
                        onClick={handleClear}
                        className="px-3 py-1.5 text-xs font-bold text-stone-500 hover:bg-stone-200 rounded"
                    >
                        クリア
                    </button>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-200 rounded"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleApply}
                            className="px-4 py-1.5 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded shadow"
                        >
                            反映
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 一括貼り付けモーダル
const PasteModal = ({ isOpen, onClose, onApply }) => {
    const [text, setText] = useState('');

    if (!isOpen) return null;

    const handleApply = () => {
        onApply(text);
        setText('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
                <div className="bg-stone-50 px-4 py-3 border-b border-stone-100 flex justify-between items-center">
                    <h4 className="font-bold text-stone-700 text-sm">一括貼り付け</h4>
                    <button onClick={onClose} className="p-1 hover:bg-stone-200 rounded text-stone-400 hover:text-stone-600">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <p className="text-xs text-stone-500 leading-relaxed">
                        Excel等のスプレッドシートからコピーした範囲（氏名、希望休、有休などの列を含む範囲）を、下のテキストエリアに貼り付け（Ctrl+V）て「適用」ボタンを押してください。
                    </p>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="ここに貼り付けてください（タブ区切りテキスト）"
                        className="w-full h-48 p-2 border border-stone-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-200 outline-none"
                    />
                </div>
                <div className="bg-stone-50 px-4 py-3 border-t border-stone-100 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-200 rounded"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!text.trim()}
                        className={`px-4 py-1.5 text-xs font-bold rounded shadow ${
                            text.trim()
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                        }`}
                    >
                        適用する
                    </button>
                </div>
            </div>
        </div>
    );
};

const PreferencesTable = ({ data, masterData, onUpdate, currentMonth, monthlySettings, updateMonthlySettings, setActiveTab }) => {
    const [localData, setLocalData] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [localMonthlyHoliday, setLocalMonthlyHoliday] = useState(9);

    // カレンダーモーダル用状態
    const [activeCalendar, setActiveCalendar] = useState(null); // { rowIndex, field, title, value }
    // 貼り付けモーダル用状態
    const [isPasteOpen, setIsPasteOpen] = useState(false);

    useEffect(() => {
        if (monthlySettings && currentMonth) {
            const settings = monthlySettings[currentMonth] || {};
            setLocalMonthlyHoliday(settings.monthlyHoliday || 9);
        }
    }, [monthlySettings, currentMonth]);

    useEffect(() => {
        if (!masterData) return;

        const merged = masterData.map(staff => {
            const prefRow = data ? data.find(d => d['氏名'] === staff['氏名']) : {};
            return {
                ...prefRow,
                '氏名': staff['氏名'],
            };
        });

        setLocalData(merged);
    }, [data, masterData]);

    const handleCellChange = (rowIndex, field, value) => {
        const newData = [...localData];
        newData[rowIndex] = { ...newData[rowIndex], [field]: value };
        setLocalData(newData);
        setHasChanges(true);
        onUpdate(newData); // 即時自動保存
    };

    const handleMonthlySettingChange = (val) => {
        const num = parseInt(val, 10);
        setLocalMonthlyHoliday(num);
        setHasChanges(true);
        if (updateMonthlySettings && currentMonth) {
            updateMonthlySettings(currentMonth, { monthlyHoliday: num });
        }
        onUpdate(localData); // 即時自動保存
    };

    const handleReflect = () => {
        if (updateMonthlySettings && currentMonth) {
            updateMonthlySettings(currentMonth, { monthlyHoliday: localMonthlyHoliday });
        }
        onUpdate(localData);
        setHasChanges(false);
        if (setActiveTab) {
            setActiveTab('shift');
        } else {
            alert("希望条件・月設定を反映しました。");
        }
    };

    // 一括コピー処理
    const handleBulkCopy = () => {
        const headers = ['氏名', ...INPUT_FIELDS.map(f => f.key)];
        const tsvRows = [
            headers.join('\t'),
            ...localData.map(row => headers.map(h => row[h] || '').join('\t'))
        ];
        const tsvText = tsvRows.join('\n');
        
        navigator.clipboard.writeText(tsvText).then(() => {
            alert("設定データをクリップボードにコピーしました（Excel等にそのまま貼り付けできます）。");
        }).catch(err => {
            console.error("Copy failed", err);
            alert("コピーに失敗しました。");
        });
    };

    // 一括貼り付け反映処理
    const handlePasteApply = (pastedText) => {
        if (!pastedText.trim()) return;

        const rows = pastedText.split(/\r?\n/).map(line => line.split('\t'));
        if (rows.length === 0) return;

        const headerRow = rows[0].map(h => h.trim());
        const nameIndex = headerRow.findIndex(h => h === '氏名');
        if (nameIndex === -1) {
            alert("貼り付けられたデータに「氏名」列が見つかりません。ヘッダー（1行目）に「氏名」を含めてコピーしてください。");
            return;
        }

        const fieldMappings = {};
        INPUT_FIELDS.forEach(field => {
            const idx = headerRow.findIndex(h => {
                const cleanH = h.trim();
                return cleanH === field.label || 
                       cleanH === field.key ||
                       cleanH === field.key + '希望' ||
                       cleanH === field.label + '希望';
            });
            if (idx !== -1) {
                fieldMappings[field.key] = idx;
            }
        });

        const updatedData = [...localData];
        let updateCount = 0;

        for (let i = 1; i < rows.length; i++) {
            const rowData = rows[i];
            if (rowData.length <= nameIndex) continue;

            const name = rowData[nameIndex]?.trim();
            if (!name) continue;

            const targetRowIndex = updatedData.findIndex(d => d['氏名'] === name);
            if (targetRowIndex !== -1) {
                const targetRow = { ...updatedData[targetRowIndex] };
                
                Object.keys(fieldMappings).forEach(key => {
                    const idx = fieldMappings[key];
                    if (idx < rowData.length) {
                        targetRow[key] = rowData[idx]?.trim() || '';
                    }
                });

                updatedData[targetRowIndex] = targetRow;
                updateCount++;
            }
        }

        if (updateCount > 0) {
            setLocalData(updatedData);
            setHasChanges(true);
            onUpdate(updatedData); // 即時自動保存
            alert(`${updateCount}人分の設定データを反映しました。`);
        } else {
            alert("一致するスタッフのデータが見つかりませんでした。氏名が一致しているか確認してください。");
        }
    };

    if (!localData || localData.length === 0) return <div>データがありません</div>;

    const INPUT_FIELDS = [
        { key: '休み希望', label: '休み希望', color: 'border-red-200 focus:ring-red-100', width: 'min-w-[150px]' },
        { key: '有休', label: '有休', color: 'border-pink-200 focus:ring-pink-100', width: 'min-w-[120px]' },
        { key: '早番希望', label: '早番希望', color: 'border-orange-200 focus:ring-orange-100', width: 'min-w-[120px]' },
        { key: '日勤希望', label: '日勤希望', color: 'border-green-200 focus:ring-green-100', width: 'min-w-[120px]' },
        { key: '遅出希望', label: '遅出希望', color: 'border-blue-200 focus:ring-blue-100', width: 'min-w-[120px]' },
        { key: '夜勤希望', label: '夜勤希望', color: 'border-indigo-200 focus:ring-indigo-100', width: 'min-w-[120px]' },
        { key: '出勤不可', label: '出勤不可', color: 'border-stone-200 focus:ring-stone-100', width: 'min-w-[120px]' },
        { key: '予備', label: '予備', color: 'border-amber-200 focus:ring-amber-100', width: 'min-w-[120px]' },
        { key: '誕休', label: '誕休', color: 'border-purple-200 focus:ring-purple-100', width: 'min-w-[120px]' },
        { key: '研修', label: '研修', color: 'border-sky-200 focus:ring-sky-100', width: 'min-w-[120px]' },
        { key: '研修（夜）', label: '研修（夜）', color: 'border-violet-200 focus:ring-violet-100', width: 'min-w-[120px]' },
    ];

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-100 space-y-4">
                <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                    <h3 className="font-bold text-stone-700">月間設定 ({currentMonth})</h3>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-600">月公休数（週休2日）:</span>
                        <select
                            value={localMonthlyHoliday}
                            onChange={(e) => handleMonthlySettingChange(e.target.value)}
                            className="bg-stone-50 border border-stone-300 rounded px-3 py-1 text-sm font-bold text-stone-700 outline-none focus:ring-2 focus:ring-blue-200"
                        >
                            {[...Array(11)].map((_, i) => (
                                <option key={i} value={5 + i}>{5 + i}日</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-center gap-4">
                        <h3 className="font-bold text-stone-700">希望・条件詳細</h3>
                        <span className="text-xs text-stone-400">※日付はカンマ区切りで入力、またはカレンダーから選択できます。</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBulkCopy}
                            className="flex items-center gap-1.5 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-all"
                            title="テーブルデータをExcel用にコピーします"
                        >
                            <Copy size={14} />
                            一括コピー
                        </button>
                        <button
                            onClick={() => setIsPasteOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-all"
                            title="Excel等のデータを貼り付けます"
                        >
                            <Clipboard size={14} />
                            一括貼り付け
                        </button>
                        <button
                            onClick={handleReflect}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all bg-orange-600 hover:bg-orange-700 text-white shadow-md"
                        >
                            <Save size={18} />
                            シフト表に反映
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-auto border rounded-xl shadow-sm bg-white pb-4 max-h-[70vh]">
                <table className="min-w-full divide-y divide-stone-200 text-sm">
                    <thead className="bg-stone-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-3 py-3 text-left font-bold text-stone-600 min-w-[120px] sticky left-0 bg-stone-50 border-r border-stone-200">氏名</th>
                            {INPUT_FIELDS.map(f => (
                                <th key={f.key} className={`px-3 py-3 text-left font-bold text-stone-600 ${f.width}`}>{f.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                        {localData.map((row, i) => (
                            <tr key={i} className="hover:bg-stone-50 transition-colors">
                                <td className="p-2 sticky left-0 bg-white border-r border-stone-100 font-medium text-stone-700">
                                    {row['氏名']}
                                </td>
                                {INPUT_FIELDS.map(f => (
                                    <td key={f.key} className="p-2">
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                value={row[f.key] || ''}
                                                onChange={(e) => handleCellChange(i, f.key, e.target.value)}
                                                onClick={(e) => {
                                                    // 空白のところを押したとき、または常にクリックでカレンダーを開く
                                                    if (!row[f.key]) {
                                                        setActiveCalendar({
                                                            rowIndex: i,
                                                            field: f.key,
                                                            title: `${row['氏名']} - ${f.label} 日付選択`,
                                                            value: row[f.key] || ''
                                                        });
                                                    }
                                                }}
                                                className={`w-full pr-8 pl-3 py-1.5 border rounded-md outline-none focus:ring-2 transition-all text-stone-700 placeholder-stone-300 ${f.color}`}
                                                placeholder="-"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setActiveCalendar({
                                                    rowIndex: i,
                                                    field: f.key,
                                                    title: `${row['氏名']} - ${f.label} 日付選択`,
                                                    value: row[f.key] || ''
                                                })}
                                                className="absolute right-2 text-stone-400 hover:text-stone-600 p-0.5 rounded hover:bg-stone-100"
                                            >
                                                <Calendar size={14} />
                                            </button>
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* モーダル群 */}
            <MultiDatePickerModal
                isOpen={activeCalendar !== null}
                onClose={() => setActiveCalendar(null)}
                title={activeCalendar?.title || ''}
                initialValue={activeCalendar?.value || ''}
                monthStr={currentMonth}
                onSave={(val) => {
                    if (activeCalendar) {
                        handleCellChange(activeCalendar.rowIndex, activeCalendar.field, val);
                    }
                }}
            />

            <PasteModal
                isOpen={isPasteOpen}
                onClose={() => setIsPasteOpen(false)}
                onApply={handlePasteApply}
            />
        </div>
    );
};

export default PreferencesTable;
