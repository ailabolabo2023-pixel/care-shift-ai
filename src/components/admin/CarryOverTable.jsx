import React, { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';

const CarryOverTable = ({ data, masterData, onUpdate }) => {
    const [localData, setLocalData] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (!masterData) return;

        // Merge Master with existing CarryOver Data
        const merged = masterData.map(staff => {
            const row = data ? data.find(d => d['氏名'] === staff['氏名']) : {};
            return {
                ...row,
                '氏名': staff['氏名']
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

    const handleSave = () => {
        onUpdate(localData);
        setHasChanges(false);
        alert("繰越設定を保存しました。");
    };

    const handleReset = () => {
        if (!window.confirm("入力内容を全てリセット（空欄に）しますか？")) return;

        const newData = localData.map(row => {
            const newRow = { ...row };
            keys.forEach(key => {
                newRow[key] = "";
            });
            return newRow;
        });
        setLocalData(newData);
        setHasChanges(true);
    };

    if (!localData || localData.length === 0) return <div>データロード中...</div>;

    // シフト種別
    const SHIFT_TYPES = ["", "早", "日", "遅", "夜", "明", "休", "有", "公"];

    // Keys: Try to find keys from data, otherwise default to ["1", "2"] (1st and 2nd day)
    // We scan all rows to find potential keys if data is sparse?
    // Or just fixed keys because valid logic in ShiftEngine step1 uses keys that look like date.
    // Ideally we want to let user Input for "1" and "2".
    // Let's assume defaults if no keys found.
    let keys = [];
    if (data && data.length > 0) {
        keys = Object.keys(data[0]).filter(k => k !== '氏名' && k !== 'No');
    }
    if (keys.length === 0) {
        keys = ["1", "2"];
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                <h3 className="font-bold text-stone-700">前月繰越設定</h3>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-stone-400">※月初2日間のシフトを入力します</span>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-red-500 transition-all"
                        title="全てクリア"
                    >
                        <RotateCcw size={18} />
                        リセット
                    </button>
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

            <div className="overflow-auto border rounded-xl shadow-sm bg-white pb-4 max-h-[70vh]">
                <table className="min-w-fit divide-y divide-stone-200 text-sm">
                    <thead className="bg-stone-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold text-stone-600 min-w-[150px]">氏名</th>
                            {keys.map(key => (
                                <th key={key} className="px-4 py-3 text-center font-bold text-stone-600 min-w-[80px]">{key}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                        {localData.map((row, i) => (
                            <tr key={i} className="hover:bg-stone-50 transition-colors">
                                <td className="p-3 font-medium text-stone-700 border-r border-stone-100">
                                    {row['氏名']}
                                </td>
                                {keys.map(key => (
                                    <td key={key} className="p-2 text-center">
                                        <select
                                            value={row[key] || ''}
                                            onChange={(e) => handleCellChange(i, key, e.target.value)}
                                            className="w-full text-center p-1 border rounded bg-transparent focus:bg-white focus:border-blue-400 outline-none cursor-pointer"
                                        >
                                            {SHIFT_TYPES.map(type => (
                                                <option key={type} value={type}>{type || "-"}</option>
                                            ))}
                                        </select>
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

export default CarryOverTable;
