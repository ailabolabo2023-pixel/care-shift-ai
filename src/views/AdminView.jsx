import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import StaffTable from '../components/admin/StaffTable';
import RequirementsTable from '../components/admin/RequirementsTable';
import PreferencesTable from '../components/admin/PreferencesTable';
import CarryOverTable from '../components/admin/CarryOverTable';
import { Users, Calendar, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';



const AdminView = () => {
    const { excelData, updateSheetData, targetDate, monthlySettings, updateMonthlySettings } = useData();
    const [activeTab, setActiveTab] = useState('staff');
    const [currentMonth, setCurrentMonth] = useState(targetDate || new Date().toISOString().slice(0, 7));

    if (!excelData) return null;

    // Dynamic data key
    const getPreferencesKey = () => `希望_${currentMonth}`;
    const getCarryOverKey = () => `繰越_${currentMonth}`;
    const getRequirementsKey = () => `要員数_${currentMonth}`;

    const tabs = [
        { id: 'staff', label: 'スタッフ設定', icon: Users, component: StaffTable, dataKey: 'マスタ' },
        { id: 'requirements', label: '要員設定', icon: Users, component: RequirementsTable, dataKey: getRequirementsKey() },
        { id: 'preferences', label: '希望休・条件', icon: Calendar, component: PreferencesTable, dataKey: getPreferencesKey() },
        { id: 'carryover', label: '繰越設定', icon: Timer, component: CarryOverTable, dataKey: getCarryOverKey() },
    ];

    const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || StaffTable;
    const activeDataKey = tabs.find(t => t.id === activeTab)?.dataKey;

    const handleUpdate = (newData) => {
        if (activeDataKey) {
            updateSheetData(activeDataKey, newData);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-1 justify-between items-end">
                <div className="flex gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-t-lg font-bold transition-all relative ${activeTab === tab.id
                                ? 'text-orange-600 bg-white border-x border-t border-stone-200 shadow-sm z-10'
                                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                                }`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-[-1px] left-0 w-full h-1 bg-white"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Month Selector for Requirements, Preferences & CarryOver */}
                {(activeTab === 'requirements' || activeTab === 'preferences' || activeTab === 'carryover') && (
                    <div className="mb-2 flex items-center gap-2 bg-stone-100 px-3 py-1.5 rounded-lg border border-stone-200">
                        <span className="text-sm font-bold text-stone-600">対象月:</span>
                        <input
                            type="month"
                            value={currentMonth}
                            onChange={(e) => setCurrentMonth(e.target.value)}
                            className="bg-white border border-stone-300 rounded px-2 py-1 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-200"
                        />
                    </div>
                )}


            </div>

            <div className="bg-white rounded-b-xl min-h-[500px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab + (['requirements', 'preferences', 'carryover'].includes(activeTab) ? currentMonth : '')}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ActiveComponent
                            data={excelData[activeDataKey] || []}
                            masterData={excelData['マスタ'] || []}
                            currentMonth={currentMonth}
                            onUpdate={handleUpdate}
                            monthlySettings={excelData.monthlySettings || monthlySettings} // Use context value if not in excelData (backward compat)
                            updateMonthlySettings={updateMonthlySettings}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div >
    );
};

export default AdminView;
