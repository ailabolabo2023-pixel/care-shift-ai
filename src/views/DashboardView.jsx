import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { BarChart, AlertTriangle, CheckCircle } from 'lucide-react';

const DashboardView = () => {
    const { shiftTable, dates } = useData();

    // Calculate Stats
    const stats = useMemo(() => {
        if (!shiftTable || shiftTable.length === 0) return [];

        return shiftTable.map(staff => {
            const counts = { '早': 0, '日': 0, '遅': 0, '夜': 0, '他': 0 };
            let totalWork = 0;

            dates.forEach(date => {
                const shift = staff.shifts[date];
                if (['早', '日', '遅', '夜'].includes(shift)) {
                    counts[shift]++;
                    totalWork++;
                } else if (shift && shift !== '休' && shift !== '明' && shift !== '公') {
                    counts['他']++; // Any other work type
                }
            });

            return {
                name: staff.name,
                counts,
                totalWork
            };
        }).sort((a, b) => b.totalWork - a.totalWork); // Sort by busy-ness
    }, [shiftTable, dates]);

    // Max work count for scaling charts
    const maxWork = Math.max(...stats.map(s => s.totalWork), 1);

    if (!shiftTable || shiftTable.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-stone-100 shadow-sm">
                <BarChart className="w-16 h-16 text-stone-200 mb-4" />
                <p className="text-stone-400 text-lg">シフトデータがありません。<br />まずはシフトを作成してください。</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                <h2 className="text-xl font-bold text-stone-700 flex items-center gap-2 mb-2">
                    <BarChart className="w-6 h-6 text-orange-500" />
                    シフト回数分布
                </h2>
                <p className="text-sm text-stone-500">
                    スタッフごとの勤務回数の偏りを可視化しています。
                </p>
            </div>

            {/* Shift Distribution Chart */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100">
                <div className="space-y-4">
                    {stats.map((staff, index) => (
                        <div key={index} className="flex items-center gap-4">
                            {/* Staff Name */}
                            <div className="w-32 text-sm font-bold text-stone-600 truncate text-right">
                                {staff.name}
                            </div>

                            {/* Bar Container */}
                            <div className="flex-1 h-8 bg-stone-100 rounded-full overflow-hidden flex relative">
                                {/* Stacked Bars */}
                                {staff.counts['早'] > 0 && (
                                    <div
                                        style={{ width: `${(staff.counts['早'] / maxWork) * 100}%` }}
                                        className="h-full bg-orange-400 flex items-center justify-center text-[10px] text-white font-bold"
                                        title={`早番: ${staff.counts['早']}回`}
                                    >
                                        {staff.counts['早']}
                                    </div>
                                )}
                                {staff.counts['日'] > 0 && (
                                    <div
                                        style={{ width: `${(staff.counts['日'] / maxWork) * 100}%` }}
                                        className="h-full bg-green-500 flex items-center justify-center text-[10px] text-white font-bold"
                                        title={`日勤: ${staff.counts['日']}回`}
                                    >
                                        {staff.counts['日']}
                                    </div>
                                )}
                                {staff.counts['遅'] > 0 && (
                                    <div
                                        style={{ width: `${(staff.counts['遅'] / maxWork) * 100}%` }}
                                        className="h-full bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold"
                                        title={`遅番: ${staff.counts['遅']}回`}
                                    >
                                        {staff.counts['遅']}
                                    </div>
                                )}
                                {staff.counts['夜'] > 0 && (
                                    <div
                                        style={{ width: `${(staff.counts['夜'] / maxWork) * 100}%` }}
                                        className="h-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-bold"
                                        title={`夜勤: ${staff.counts['夜']}回`}
                                    >
                                        {staff.counts['夜']}
                                    </div>
                                )}
                            </div>

                            {/* Total Count Label */}
                            <div className="w-12 text-sm text-stone-500 font-mono text-right">
                                {staff.totalWork}<span className="text-[10px] ml-0.5">回</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6 mt-8 p-4 bg-stone-50 rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-stone-600">
                        <span className="w-3 h-3 bg-orange-400 rounded-sm"></span> 早番
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-600">
                        <span className="w-3 h-3 bg-green-500 rounded-sm"></span> 日勤
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-600">
                        <span className="w-3 h-3 bg-blue-500 rounded-sm"></span> 遅番
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-600">
                        <span className="w-3 h-3 bg-indigo-600 rounded-sm"></span> 夜勤
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
