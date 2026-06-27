import React, { useState, useEffect } from 'react';
import { Save, Plus, PlusCircle } from 'lucide-react';
import { excelSerialToDate, formatDate, getDayOfWeek, addDays, parseDateString } from '../../utils/dateUtils';

const RequirementsTable = ({ data, currentMonth, onUpdate }) => {
    const [localData, setLocalData] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);

    // Base settings for bulk apply
    const [baseSettings, setBaseSettings] = useState({
        '早必要': 0, '日必要': 0, '遅必要': 0, '夜必要': 0
    });

    useEffect(() => {
        if (data && data.length > 0) {
            setLocalData(data);
        } else if (currentMonth) {
            // Generate empty rows if no data
            generateMonthRows(currentMonth);
        }
    }, [data, currentMonth]);

    const handleCellChange = (rowIndex, field, value) => {
        const newData = [...localData];
        newData[rowIndex] = { ...newData[rowIndex], [field]: value };
        setLocalData(newData);
        setHasChanges(true);
    };

    const handleSave = () => {
        onUpdate(localData);
        setHasChanges(false);
        alert("要員設定を保存しました。");
    };

    const generateMonthRows = (monthStr) => {
        // monthStr: YYYY-MM
        if (!monthStr) return;
        const [y, m] = monthStr.split('-');
        const year = parseInt(y, 10);
        const month = parseInt(m, 10) - 1; // 0-indexed

        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0); // Last day of month

        const newRows = [];
        // Loop from 1 to last day
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            newRows.push({
                '日付': formatDate(new Date(d)), // ensure Copy
                '曜日': getDayOfWeek(d),
                '早必要': 0, '日必要': 0, '遅必要': 0, '夜必要': 0
            });
        }
        setLocalData(newRows);
        setHasChanges(true);
    };

    const handleApplyBase = () => {
        const newData = localData.map(row => ({
            ...row,
            ...baseSettings
        }));
        setLocalData(newData);
        setHasChanges(true);
    };

    const handleReset = () => {
        if (window.confirm("現在の設定をすべてリセット（0クリア）しますか？")) {
            if (currentMonth) {
                generateMonthRows(currentMonth);
            } else {
                const newData = localData.map(row => ({
                    ...row,
                    '早必要': 0, '日必要': 0, '遅必要': 0, '夜必要': 0
                }));
                setLocalData(newData);
                setHasChanges(true);
            }
        }
    };

    const getDisplayDate = (val) => {
        if (!val) return "";
        // If number, try excel serial
        if (typeof val === 'number') {
            const d = excelSerialToDate(val);
            return d ? formatDate(d) : val;
        }
        // If string, maybe it's already "2025/10/01"
        return val;
    };

    const getDisplayDow = (row) => {
        // Use row date to calc DOW
        const val = row['日付'];
        let d = null;
        if (typeof val === 'number') d = excelSerialToDate(val);
        else d = parseDateString(val);

        if (d) return getDayOfWeek(d);
        return row['曜日'] || ""; // Fallback to existing
    };

    const getLastDate = () => {
        if (localData.length === 0) return new Date(); // Default today?
        const lastRow = localData[localData.length - 1];
        const val = lastRow['日付'];
        if (typeof val === 'number') return excelSerialToDate(val);
        return parseDateString(val) || new Date();
    };

    const handleAddDays = (count) => {
        const lastDate = getLastDate();
        const newRows = [];

        // Copy last row's requirements as default
        const lastRow = localData.length > 0 ? localData[localData.length - 1] : {};
        const baseReq = {
            '早必要': lastRow['早必要'] || 0,
            '日必要': lastRow['日必要'] || 0,
            '遅必要': lastRow['遅必要'] || 0,
            '夜必要': lastRow['夜必要'] || 0
        };

        for (let i = 1; i <= count; i++) {
            const nextDate = addDays(lastDate, i);
            newRows.push({
                '日付': formatDate(nextDate),
                '曜日': getDayOfWeek(nextDate),
                ...baseReq
            });
        }

        setLocalData([...localData, ...newRows]);
        setHasChanges(true);
    };

    const handleAddMonth = () => {
        // Add roughly 30 days
        handleAddDays(31);
    };

    if (!localData) return <div>データロード中...</div>;

    return (
        <div className="space-y-6">
            {/* Bulk Settings Panel */}
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <h4 className="font-bold text-stone-600 mb-3 text-sm flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-orange-400 rounded-full"></span>
                    基本人数設定（一括反映）
                </h4>
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex gap-2">
                        {['早必要', '日必要', '遅必要', '夜必要'].map(idx => {
                            const labels = { '早必要': '早', '日必要': '日', '遅必要': '遅', '夜必要': '夜' };
                            const colors = { '早必要': 'bg-orange-50', '日必要': 'bg-green-50', '遅必要': 'bg-blue-50', '夜必要': 'bg-indigo-50' };
                            return (
                                <div key={idx} className={`flex flex-col items-center p-2 rounded-lg border border-stone-100 ${colors[idx]}`}>
                                    <span className="text-xs font-bold text-stone-500 mb-1">{labels[idx]}</span>
                                    <input
                                        type="number"
                                        value={baseSettings[idx]}
                                        onChange={(e) => setBaseSettings({ ...baseSettings, [idx]: e.target.value })}
                                        className="w-12 text-center p-1 border border-stone-200 rounded text-sm focus:border-blue-400 outline-none"
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <button
                        onClick={handleApplyBase}
                        className="px-4 py-2 bg-blue-500 text-white font-bold rounded-lg shadow-sm hover:bg-blue-600 transition-all text-sm"
                    >
                        一括反映
                    </button>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-stone-200 text-stone-600 font-bold rounded-lg hover:bg-stone-300 transition-all text-sm ml-auto"
                    >
                        リセット
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                <h3 className="font-bold text-stone-700">日別体制数設定</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleAddDays(1)}
                        className="flex items-center gap-1 px-3 py-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 text-sm font-bold transition-colors"
                        title="末尾に1日追加"
                    >
                        <Plus size={16} />
                        1日追加
                    </button>
                    <button
                        onClick={handleAddMonth}
                        className="flex items-center gap-1 px-3 py-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 text-sm font-bold transition-colors mr-4"
                        title="末尾に1ヶ月追加"
                    >
                        <PlusCircle size={16} />
                        1ヶ月追加
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
                <table className="min-w-full divide-y divide-stone-200 text-sm">
                    <thead className="bg-stone-50 sticky top-0 z-10">
                        <tr>
                            <th className="px-3 py-3 text-left font-bold text-stone-600 min-w-[120px]">日付</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16">曜日</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 bg-orange-50 w-24">早番</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 bg-green-50 w-24">日勤</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 bg-blue-50 w-24">遅番</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 bg-indigo-50 w-24">夜勤</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                        {localData.map((row, i) => {
                            const displayDate = getDisplayDate(row['日付']);
                            const displayDow = getDisplayDow(row);
                            const isSun = displayDow === '日';
                            const isSat = displayDow === '土';
                            const rowClass = isSun ? 'bg-red-50/30' : isSat ? 'bg-blue-50/30' : '';

                            return (
                                <tr key={i} className={`hover:bg-stone-50 transition-colors ${rowClass}`}>
                                    <td className="p-2 px-3 font-medium text-stone-700 whitespace-nowrap">
                                        {displayDate}
                                    </td>
                                    <td className={`p-2 text-center font-bold ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-stone-600'}`}>
                                        {displayDow}
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            value={row['早必要'] || ''}
                                            onChange={(e) => handleCellChange(i, '早必要', e.target.value)}
                                            className="w-full text-center px-2 py-1 border border-stone-200 focus:border-orange-400 rounded outline-none bg-white/50"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            value={row['日必要'] || ''}
                                            onChange={(e) => handleCellChange(i, '日必要', e.target.value)}
                                            className="w-full text-center px-2 py-1 border border-stone-200 focus:border-green-400 rounded outline-none bg-white/50"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            value={row['遅必要'] || ''}
                                            onChange={(e) => handleCellChange(i, '遅必要', e.target.value)}
                                            className="w-full text-center px-2 py-1 border border-stone-200 focus:border-blue-400 rounded outline-none bg-white/50"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            value={row['夜必要'] || ''}
                                            onChange={(e) => handleCellChange(i, '夜必要', e.target.value)}
                                            className="w-full text-center px-2 py-1 border border-stone-200 focus:border-indigo-400 rounded outline-none bg-white/50"
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RequirementsTable;
