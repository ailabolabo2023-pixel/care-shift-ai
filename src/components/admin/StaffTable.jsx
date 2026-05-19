import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, GripVertical } from 'lucide-react';

const StaffTable = ({ data, onUpdate }) => {
    // Local state for editing to prevent excessive context updates
    const [localData, setLocalData] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);

    // Drag and Drop refs
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (data) {
            setLocalData(data);
        }
    }, [data]);

    const handleCellChange = (rowIndex, field, value) => {
        const newData = [...localData];
        newData[rowIndex] = { ...newData[rowIndex], [field]: value };
        setLocalData(newData);
        setHasChanges(true);
    };

    const handleSave = () => {
        onUpdate(localData);
        setHasChanges(false);
        alert("スタッフ設定を保存しました。");
    };

    const handleAdd = () => {
        const newStaff = {
            '氏名': '',
            '勤務日数/週': 5,
            '夜勤回数/週': 1,
            '早可': '〇',
            '日可': '〇',
            '遅可': '〇',
            '夜可': '〇',
            '専属': '',
            'サ責': '',
            '主任': '',
            '施設長': '',
            '事務員': '',
            '管理者': '',
            '研修生': '',
            '曜日固定': ''
        };
        setLocalData([...localData, newStaff]);
        setHasChanges(true);
    };

    const handleDelete = (index) => {
        if (window.confirm('本当にこのスタッフを削除しますか？')) {
            const newData = localData.filter((_, i) => i !== index);
            setLocalData(newData);
            setHasChanges(true);
        }
    };

    // Drag Handlers
    const handleDragStart = (e, position) => {
        dragItem.current = position;
        setIsDragging(true);
        // e.dataTransfer.effectAllowed = "move"; // Optional visual tweak
    };

    const handleDragEnter = (e, position) => {
        const dragIndex = dragItem.current;
        if (dragIndex === null || dragIndex === undefined) return;

        const dragOverIndex = position;
        dragOverItem.current = dragOverIndex;

        if (dragIndex === dragOverIndex) return;

        const newData = [...localData];
        const draggedItemContent = newData[dragIndex];
        newData.splice(dragIndex, 1);
        newData.splice(dragOverIndex, 0, draggedItemContent);

        dragItem.current = dragOverIndex;
        setLocalData(newData);
        setHasChanges(true);
    };

    const handleDragEnd = () => {
        dragItem.current = null;
        dragOverItem.current = null;
        setIsDragging(false);
    };

    // Prevent default to allow drop (needed for some browsers/logic although we swap on Enter)
    const handleDragOver = (e) => {
        e.preventDefault();
    };


    // Helper for boolean-like text
    const handleCheckChange = (rowIndex, field, currentVal) => {
        const newVal = currentVal === true || currentVal === '〇' || currentVal === 'TRUE' ? '' : '〇';
        handleCellChange(rowIndex, field, newVal);
    };

    if (!localData) return <div>データがありません</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-stone-700">スタッフ一覧設定</h3>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-1 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-sm transition-colors"
                    >
                        <Plus size={16} />
                        追加
                    </button>
                </div>
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

            <div className="overflow-auto border rounded-xl shadow-sm bg-white pb-4 max-h-[70vh]">
                <table className="min-w-full divide-y divide-stone-200 text-sm">
                    <thead className="bg-stone-50 sticky top-0 z-10">
                        <tr>
                            <th className="w-10 px-2 py-3 bg-stone-50"></th>{/* Grip Column */}
                            <th className="px-3 py-3 text-left font-bold text-stone-600 min-w-[120px]">氏名</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-20">日数/週</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-20">夜勤/週</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16 bg-orange-50">早可</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16 bg-green-50">日可</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16 bg-blue-50">遅可</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16 bg-indigo-50">夜可</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-20">専属</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16 bg-pink-50">サ責</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16 bg-cyan-50">主任</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16 bg-yellow-50">施設長</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16 bg-gray-50">事務員</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16 bg-indigo-50">管理者</th>
                            <th className="px-2 py-3 text-center font-bold text-stone-600 w-16 bg-green-50">研修生</th>
                            <th className="px-3 py-3 text-left font-bold text-stone-600 min-w-[100px]">曜日固定</th>
                            <th className="px-2 py-3 text-center w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 bg-white">
                        {localData.map((row, i) => (
                            <tr
                                key={i}
                                className={`group hover:bg-stone-50 transition-colors ${isDragging && dragItem.current === i ? 'bg-blue-50 opacity-50' : ''}`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, i)}
                                onDragEnter={(e) => handleDragEnter(e, i)}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                            >
                                <td className="p-2 text-center cursor-move text-stone-300 hover:text-stone-500">
                                    <GripVertical size={16} className="mx-auto" />
                                </td>
                                <td className="p-2">
                                    <input
                                        type="text"
                                        value={row['氏名'] || ''}
                                        onChange={(e) => handleCellChange(i, '氏名', e.target.value)}
                                        className="w-full px-2 py-1 border border-transparent hover:border-stone-300 focus:border-blue-400 rounded bg-transparent transition-all outline-none"
                                        placeholder="氏名を入力"
                                    />
                                </td>
                                <td className="p-2 text-center">
                                    <input
                                        type="number"
                                        value={row['勤務日数/週'] || ''}
                                        onChange={(e) => handleCellChange(i, '勤務日数/週', e.target.value)}
                                        className="w-full text-center px-1 py-1 border border-transparent hover:border-stone-300 focus:border-blue-400 rounded bg-transparent outline-none"
                                    />
                                </td>
                                <td className="p-2 text-center">
                                    <input
                                        type="number"
                                        value={row['夜勤回数/週'] || ''}
                                        onChange={(e) => handleCellChange(i, '夜勤回数/週', e.target.value)}
                                        className="w-full text-center px-1 py-1 border border-transparent hover:border-stone-300 focus:border-blue-400 rounded bg-transparent outline-none"
                                    />
                                </td>
                                {/* Updated boolean-like fields to include '管理者' */}
                                {['早可', '日可', '遅可', '夜可', '専属', 'サ責', '主任', '施設長', '事務員', '管理者', '研修生'].map(field => {
                                    const val = row[field];
                                    const isChecked = val === true || val === '〇' || val === 'TRUE';
                                    return (
                                        <td key={field} className="p-2 text-center cursor-pointer" onClick={() => handleCheckChange(i, field, val)}>
                                            <div className={`w-6 h-6 mx-auto rounded-full border flex items-center justify-center transition-all ${isChecked ? 'bg-blue-500 border-blue-600 text-white' : 'bg-white border-stone-300 text-transparent'
                                                }`}>
                                                ✔
                                            </div>
                                        </td>
                                    );
                                })}
                                <td className="p-2">
                                    <input
                                        type="text"
                                        value={row['曜日固定'] || ''}
                                        placeholder="例: 月/水"
                                        onChange={(e) => handleCellChange(i, '曜日固定', e.target.value)}
                                        className="w-full px-2 py-1 border border-transparent hover:border-stone-300 focus:border-blue-400 rounded bg-transparent outline-none text-xs"
                                    />
                                </td>
                                <td className="p-2 text-center">
                                    <button
                                        onClick={() => handleDelete(i)}
                                        className="text-stone-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                                        title="削除"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StaffTable;
