import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import StaffTable from '../components/admin/StaffTable';
import RequirementsTable from '../components/admin/RequirementsTable';
import PreferencesTable from '../components/admin/PreferencesTable';
import CarryOverTable from '../components/admin/CarryOverTable';
import { Users, Calendar, Timer, Smartphone, Download, Link2, Copy, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchFormResponses, buildPreferencesFromForm } from '../utils/formImport';



const AdminView = ({ setMainTab }) => {
    const { excelData, updateSheetData, targetDate, monthlySettings, updateMonthlySettings } = useData();
    const [activeTab, setActiveTab] = useState('staff');
    const [currentMonth, setCurrentMonth] = useState(targetDate || new Date().toISOString().slice(0, 7));

    // --- スマホ希望の取り込み（施設ごとの連携設定） ---
    // ※URLは施設ごとに違う。1端末＝1施設の前提で localStorage に保存する。
    const [webAppUrl, setWebAppUrl] = useState(() => localStorage.getItem('care_shift_ai_webapp_url') || '');
    const [csvUrl, setCsvUrl] = useState(() => localStorage.getItem('care_shift_ai_form_csv_url') || '');
    const [importing, setImporting] = useState(false);
    const [importMsg, setImportMsg] = useState(null); // { type: 'ok' | 'err', text }
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        localStorage.setItem('care_shift_ai_form_csv_url', csvUrl);
    }, [csvUrl]);
    useEffect(() => {
        localStorage.setItem('care_shift_ai_webapp_url', webAppUrl);
    }, [webAppUrl]);

    const copySmartphoneUrl = async () => {
        if (!webAppUrl) return;
        try {
            await navigator.clipboard.writeText(webAppUrl.trim());
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (e) { /* クリップボード不可でも致命的ではない */ }
    };

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
        <div className="max-w-[1700px] mx-auto px-2 space-y-6">
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

            {/* スマホ連携パネル（①施設ごとの設定 ②取り込み） */}
            {activeTab === 'preferences' && (
                <div className="space-y-3">
                    {/* ① この施設の連携URL設定 */}
                    <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sky-800 font-bold">
                            <Link2 size={18} /> この施設のスマホ連携設定
                            <span className="text-xs font-normal text-sky-600">（施設ごとに専用URL）</span>
                        </div>
                        <p className="text-xs text-stone-500 leading-relaxed">
                            下の2つは<b>この施設専用</b>のURLです。別施設では別のURLを設定してください（混ざりません）。<br />
                            ※この設定はこの端末に保存されます。施設ごとに端末（またはブラウザ）を分けて使ってください。
                        </p>

                        <div>
                            <label className="text-xs font-bold text-stone-600">① 職員に配るスマホ入力ページURL（名簿の同期にも使われます）</label>
                            <div className="flex flex-col sm:flex-row gap-2 mt-1">
                                <input
                                    type="text"
                                    value={webAppUrl}
                                    onChange={(e) => setWebAppUrl(e.target.value)}
                                    placeholder="https://script.google.com/macros/s/.../exec"
                                    className="flex-1 px-3 py-2 border border-sky-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-200"
                                />
                                <button
                                    onClick={copySmartphoneUrl}
                                    disabled={!webAppUrl}
                                    className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${!webAppUrl ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                                >
                                    {copied ? <Check size={16} /> : <Copy size={16} />}
                                    {copied ? 'コピー済' : 'コピー'}
                                </button>
                                <a
                                    href={webAppUrl ? webAppUrl.trim() : undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap border transition-all ${!webAppUrl ? 'border-stone-200 text-stone-300 pointer-events-none' : 'border-sky-300 text-sky-700 hover:bg-sky-100'}`}
                                >
                                    <ExternalLink size={16} /> 開く
                                </a>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-stone-600">② 取り込み用CSV URL（回答シートのexport形式）</label>
                            <input
                                type="text"
                                value={csvUrl}
                                onChange={(e) => setCsvUrl(e.target.value)}
                                placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=..."
                                className="w-full mt-1 px-3 py-2 border border-sky-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-200"
                            />
                        </div>
                    </div>

                    {/* ② 取り込み実行 */}
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold">
                            <Smartphone size={18} /> スマホ希望の取り込み
                        </div>
                        <p className="text-xs text-stone-500 leading-relaxed">
                            職員がスマホから送った希望を、<b>{currentMonth}</b> の希望表に取り込みます。
                        </p>
                        <button
                            onClick={handleImportForm}
                            disabled={importing || !csvUrl}
                            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-white transition-all ${importing || !csvUrl
                                ? 'bg-stone-300 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-md'
                                }`}
                        >
                            <Download size={18} />
                            {importing ? '取り込み中...' : 'スマホ希望を取り込む'}
                        </button>
                        {importMsg && (
                            <div className={`text-sm whitespace-pre-wrap rounded-lg px-3 py-2 ${importMsg.type === 'ok'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-700'
                                }`}>
                                {importMsg.text}
                            </div>
                        )}
                    </div>
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
