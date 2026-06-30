import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import StaffTable from '../components/admin/StaffTable';
import RequirementsTable from '../components/admin/RequirementsTable';
import PreferencesTable from '../components/admin/PreferencesTable';
import CarryOverTable from '../components/admin/CarryOverTable';
import { Users, Calendar, Timer, Smartphone, Download, Link2, Copy, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchFormResponses, buildPreferencesFromForm, DEFAULT_FORM_CSV_URL } from '../utils/formImport';
import { getFacilityId } from '../lib/facility';
import { getStaffPageUrl } from '../utils/staffSync';



const AdminView = ({ setMainTab }) => {
    const { excelData, updateSheetData, targetDate, monthlySettings, updateMonthlySettings } = useData();
    const [activeTab, setActiveTab] = useState('staff');
    const [currentMonth, setCurrentMonth] = useState(targetDate || new Date().toISOString().slice(0, 7));

    // --- スマホ希望の取り込み（マルチ施設：fid=施設IDで自動振り分け） ---
    // 配布URL・取り込みCSVは共通の固定値を内蔵し、ログイン施設IDで自動的に分離する。
    // ※「上書きURL」は通常空欄でOK（共通URLを使う）。特殊な構成のときだけ使う。
    const facilityId = getFacilityId();
    const staffPageUrl = getStaffPageUrl(); // 共通URL + ?fid=施設ID（職員にLINEで配るURL）
    const [webAppUrl, setWebAppUrl] = useState(() => localStorage.getItem('care_shift_ai_webapp_url') || '');
    const [csvUrl, setCsvUrl] = useState(() => localStorage.getItem('care_shift_ai_form_csv_url') || DEFAULT_FORM_CSV_URL);
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
        if (!staffPageUrl) return;
        try {
            await navigator.clipboard.writeText(staffPageUrl);
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
                rows, master, existing, currentMonth, facilityId
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
                    {/* ① この施設の配布URL（自動生成） */}
                    <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sky-800 font-bold">
                            <Link2 size={18} /> 職員に配るスマホURL
                            {facilityId && (
                                <span className="text-xs font-normal text-sky-600">（施設ID: <b>{facilityId}</b>）</span>
                            )}
                        </div>
                        <p className="text-xs text-stone-500 leading-relaxed">
                            このURLは<b>この施設専用</b>に自動で作られます（末尾の <code>?fid={facilityId || '施設ID'}</code> で他施設と分かれます）。<br />
                            LINEなどで職員に配ってください。<b>設定は不要</b>です。
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                value={staffPageUrl}
                                readOnly
                                onFocus={(e) => e.target.select()}
                                className="flex-1 px-3 py-2 border border-sky-300 rounded-lg text-sm bg-white/70 outline-none focus:ring-2 focus:ring-sky-200"
                            />
                            <button
                                onClick={copySmartphoneUrl}
                                disabled={!staffPageUrl}
                                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${!staffPageUrl ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                            >
                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                {copied ? 'コピー済' : 'コピー'}
                            </button>
                            <a
                                href={staffPageUrl || undefined}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap border transition-all ${!staffPageUrl ? 'border-stone-200 text-stone-300 pointer-events-none' : 'border-sky-300 text-sky-700 hover:bg-sky-100'}`}
                            >
                                <ExternalLink size={16} /> 開く
                            </a>
                        </div>

                        {/* 上級者向け：通常は触らない上書き設定 */}
                        <details className="text-xs text-stone-500">
                            <summary className="cursor-pointer select-none text-sky-700 font-bold">上級者向け設定（通常は不要）</summary>
                            <div className="mt-2 space-y-2">
                                <div>
                                    <label className="text-xs font-bold text-stone-600">スマホページの基本URLを上書き（空欄=共通URL）</label>
                                    <input
                                        type="text"
                                        value={webAppUrl}
                                        onChange={(e) => setWebAppUrl(e.target.value)}
                                        placeholder="https://script.google.com/macros/s/.../exec"
                                        className="w-full mt-1 px-3 py-2 border border-sky-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-stone-600">取り込み用CSV URLを上書き（空欄=共通URL）</label>
                                    <input
                                        type="text"
                                        value={csvUrl}
                                        onChange={(e) => setCsvUrl(e.target.value)}
                                        placeholder={DEFAULT_FORM_CSV_URL}
                                        className="w-full mt-1 px-3 py-2 border border-sky-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-sky-200"
                                    />
                                </div>
                            </div>
                        </details>
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
