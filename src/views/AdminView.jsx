import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import StaffTable from '../components/admin/StaffTable';
import RequirementsTable from '../components/admin/RequirementsTable';
import PreferencesTable from '../components/admin/PreferencesTable';
import CarryOverTable from '../components/admin/CarryOverTable';
import { Users, Calendar, Timer, Smartphone, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchFormResponses, buildPreferencesFromForm } from '../utils/formImport';



const AdminView = ({ setMainTab }) => {
    const { excelData, updateSheetData, targetDate, monthlySettings, updateMonthlySettings } = useData();
    const [activeTab, setActiveTab] = useState('staff');
    const [currentMonth, setCurrentMonth] = useState(targetDate || new Date().toISOString().slice(0, 7));

    // --- スマホ希望（Googleフォーム）取り込み用 ---
    const [csvUrl, setCsvUrl] = useState(() => localStorage.getItem('care_shift_ai_form_csv_url') || '');
    const [importing, setImporting] = useState(false);
    const [importMsg, setImportMsg] = useState(null); // { type: 'ok' | 'err', text }

    useEffect(() => {
        localStorage.setItem('care_shift_ai_form_csv_url', csvUrl);
    }, [csvUrl]);

    if (!excelData) return null;

    // Dynamic data key
    const getPreferencesKey = () => `希望_${currentMonth}`;
    const getCarryOverKey = () => `繰越_${currentMonth}`;
    const getRequirementsKey = () => `要員数_${currentMonth}`;

    // スマホ（Googleフォーム）から送られた希望を、選択中の月の希望表に取り込む
    const handleImportForm = async () => {
        setImporting(true);
        setImportMsg(null);
        try {
            const master = excelData['マスタ'] || [];
            if (master.length === 0) {
                throw new Error('先に「スタッフ設定」でスタッフを登録してください。');
            }
            const rows = await fetchFormResponses(csvUrl);
            const prefKey = getPreferencesKey();
            const existing = excelData[prefKey] || [];
            const { newPrefs, importedNames, unknownNames } = buildPreferencesFromForm(
                rows, master, existing, currentMonth
            );

            if (importedNames.length === 0 && unknownNames.length === 0) {
                setImportMsg({ type: 'err', text: `⚠️ ${currentMonth} の回答が見つかりませんでした。対象月や公開設定を確認してください。` });
                return;
            }

            updateSheetData(prefKey, newPrefs);

            let text = `✅ ${currentMonth} の希望を ${importedNames.length}人分 取り込みました`;
            if (importedNames.length) text += `（${importedNames.join('、')}）`;
            if (unknownNames.length) {
                text += `\n⚠️ 名簿に無い名前のため取り込めませんでした: ${unknownNames.join('、')}\n→ 「スタッフ設定」の氏名と、フォームの氏名を一致させてください。`;
            }
            setImportMsg({ type: 'ok', text });
        } catch (e) {
            setImportMsg({ type: 'err', text: '❌ ' + (e.message || '取り込みに失敗しました') });
        } finally {
            setImporting(false);
        }
    };

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

            {/* スマホ希望（Googleフォーム）取り込みパネル */}
            {activeTab === 'preferences' && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                        <Smartphone size={18} /> スマホ希望の取り込み（Googleフォーム連携）
                    </div>
                    <p className="text-xs text-stone-500 leading-relaxed">
                        職員がスマホ（LINEで配ったフォーム）から送った希望を、<b>{currentMonth}</b> の希望表に取り込みます。<br />
                        ※ Googleシートを「ファイル→共有→ウェブに公開→CSV」で公開し、そのURLを下に貼り付けてください。
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="text"
                            value={csvUrl}
                            onChange={(e) => setCsvUrl(e.target.value)}
                            placeholder="GoogleシートのCSV公開URLを貼り付け（https://...）"
                            className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <button
                            onClick={handleImportForm}
                            disabled={importing || !csvUrl}
                            className={`flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-bold text-white transition-all whitespace-nowrap ${importing || !csvUrl
                                ? 'bg-stone-300 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-md'
                                }`}
                        >
                            <Download size={18} />
                            {importing ? '取り込み中...' : 'スマホ希望を取り込む'}
                        </button>
                    </div>
                    {importMsg && (
                        <div className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${importMsg.type === 'ok'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-700'
                            }`}>
                            {importMsg.text}
                        </div>
                    )}
                </div>
            )}

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
                            setActiveTab={setMainTab}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div >
    );
};

export default AdminView;
