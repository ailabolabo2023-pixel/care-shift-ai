import React from 'react';

const MasterTableView = ({ masterData }) => {
    if (!masterData || masterData.length === 0) return <div>データがありません</div>;

    // Dynamically get headers from the first row object keys
    const headers = Object.keys(masterData[0]);

    return (
        <div className="overflow-auto border rounded-xl shadow-sm bg-white pb-4 max-h-[80vh]">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                        {headers.map(header => (
                            <th key={header} className="px-4 py-3 text-left font-bold text-slate-700 whitespace-nowrap border-b border-slate-200">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {masterData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                            {headers.map(header => {
                                let val = row[header];
                                // Convert boolean or special values to readable string
                                if (val === true) val = '〇';
                                if (val === false) val = '×';

                                return (
                                    <td key={`${i}-${header}`} className="px-4 py-2 text-slate-600 whitespace-nowrap">
                                        {val}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default MasterTableView;
