import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';

const PreferencesTable = ({ data, masterData, onUpdate, currentMonth, monthlySettings, updateMonthlySettings }) => {
    const [localData, setLocalData] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [localMonthlyHoliday, setLocalMonthlyHoliday] = useState(9);

    useEffect(() => {
        // Initial load of monthly holiday
        if (monthlySettings && currentMonth) {
            const settings = monthlySettings[currentMonth] || {};
            setLocalMonthlyHoliday(settings.monthlyHoliday || 9);
        }
    }, [monthlySettings, currentMonth]);

    useEffect(() => {
        if (!masterData) return;

        // Merge Master (Staff List) with existing Preferences Data
        const merged = masterData.map(staff => {
            const prefRow = data ? data.find(d => d['氏名'] === staff['氏名']) : {};
            return {
                ...prefRow, // Keep existing prefs
                '氏名': staff['氏名'], // Ensure name from Master is key
                // IDs or other props can be carried over if needed
            };
        });

        setLocalData(merged);
    }, [data, masterData]);

    const handleCellChange = (rowIndex, field, value) => {
        const newData = [...localData];
        newData[rowIndex] = { ...newData[rowIndex], [field]: value };
        setLocalData(newData);
        setHasChanges(true);
    };

    const handleMonthlySettingChange = (val) => {
        setLocalMonthlyHoliday(parseInt(val, 10));
        setHasChanges(true);
    };

    const handleSave = () => {
        // Update Monthly Settings
        if (updateMonthlySettings && currentMonth) {
            updateMonthlySettings(currentMonth, { monthlyHoliday: localMonthlyHoliday });
        }

        // Update Table Data
        onUpdate(localData);
        setHasChanges(false);
        alert("希望条件・月設定を保存しました。");
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

                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-stone-700">希望・条件詳細</h3>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-stone-400">※日付はカンマ区切りで入力（例: 1, 5, 15）</span>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${hasChanges
                                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                }`}
                        >
                            <Save size={18} />
                            保存
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
                                        <input
                                            type="text"
                                            value={row[f.key] || ''}
                                            onChange={(e) => handleCellChange(i, f.key, e.target.value)}
                                            className={`w-full px-3 py-1.5 border rounded-md outline-none focus:ring-2 transition-all text-stone-700 placeholder-stone-300 ${f.color}`}
                                            placeholder="-"
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PreferencesTable;
