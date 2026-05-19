import React from 'react';
import { DataProvider, useData } from './context/DataContext';
import TopView from './views/TopView';
import ShiftTableView from './views/ShiftTableView';
import HistoryView from './views/HistoryView';
import DashboardView from './views/DashboardView';
import AdminView from './views/AdminView';
import { ShiftEngine } from './logic/ShiftEngine';
import { Layers, Table, RefreshCw, ChevronLeft, LayoutDashboard, Settings, History, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MainApp = () => {
  const {
    viewMode, setViewMode, excelData, targetDate, setTargetDate,
    shiftTable, setShiftTable, logs, setLogs,
    dates, setDates, monthlySettings, updateSheetData
  } = useData();

  // Data Migration Logic (Old Key -> New Key)
  React.useEffect(() => {
    const oldKey = 'mystic_shifts_history';
    const newKey = 'care_shift_ai_history';

    // Check if old data exists and new data doesn't (or we can merge, but simple migration is safer to avoid duplication if run twice)
    const oldData = localStorage.getItem(oldKey);
    const newData = localStorage.getItem(newKey);

    if (oldData && !newData) {
      try {
        console.log("Migrating history data...");
        localStorage.setItem(newKey, oldData);
        // Optional: Remove old data or keep as backup? Keeping as backup for now is safer.
        // localStorage.removeItem(oldKey); 
        console.log("Migration complete.");
      } catch (e) {
        console.error("Migration failed", e);
      }
    }
  }, []);

  const [activeTab, setActiveTab] = React.useState("shift"); // 'shift', 'master', 'history'

  // Handle manual shift change
  const handleCellChange = (rowIndex, date, value) => {
    const newTable = [...shiftTable];
    // Create a deep copy of the modified row to avoid mutation issues
    newTable[rowIndex] = {
      ...newTable[rowIndex],
      shifts: { ...newTable[rowIndex].shifts, [date]: value }
    };
    setShiftTable(newTable);
  };

  const handleGenerate = async () => {
    if (!excelData || !targetDate) return;

    // Use targetDate (YYYY-MM)
    // Prepare data with monthly preferences
    const engineData = { ...excelData };
    const monthlyPrefKey = `希望_${targetDate}`;
    if (engineData[monthlyPrefKey]) {
      engineData['希望'] = engineData[monthlyPrefKey];
    }

    const monthlyCarryKey = `繰越_${targetDate}`;
    if (engineData[monthlyCarryKey]) {
      engineData['繰越'] = engineData[monthlyCarryKey];
    }

    const monthlyReqKey = `要員数_${targetDate}`;
    if (engineData[monthlyReqKey]) {
      engineData['要員数'] = engineData[monthlyReqKey];
    }

    // Pass the dynamic monthlySettings from context, NOT from excelData
    const engine = new ShiftEngine(engineData, targetDate, monthlySettings);
    const result = engine.execute();

    if (result.success) {
      setShiftTable(result.table);
      // Engine likely has dates derived from targetDate in constructor
      // We need to capture them to show in table
      setDates(engine.dates);
      setLogs(result.logs);
      alert("シフト作成が完了しました！");
    } else {
      setLogs(result.logs || []);
      alert("エラーが発生しました。ログを確認してください。");
    }
  };

  const handleLoadHistory = (historyItem) => {
    // Restore state
    setTargetDate(historyItem.date);
    setShiftTable(historyItem.table);
    // We need to re-calculate dates or restore them if saved.
    // Saving dates in history is safer.
    // If historyItem.dates exists, use it.
    if (historyItem.dates) {
      setDates(historyItem.dates);
    } else {
      // Fallback: Recalculate from date string (less reliable if logic changed)
      // For now assuming we will save dates too.
    }
    setActiveTab('shift');
  };

  if (viewMode === 'top') {
    return <TopView />;
  }

  // --- Main Dashboard View ---
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-stone-100">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('top')}
              className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
              title="トップに戻る"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-stone-700 flex items-center gap-2">
              <span className="w-2 h-6 bg-orange-400 rounded-full inline-block"></span>
              Care Shift AI
              <span className="text-lg font-normal text-stone-400 ml-2">
                {targetDate}
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Tab Switcher */}
            <div className="flex bg-stone-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('shift')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'shift' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                シフト表
              </button>
              <button
                onClick={() => setActiveTab('master')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'master' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
              >
                <Settings className="w-4 h-4" />
                管理設定
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
              >
                <History className="w-4 h-4" />
                過去シフト表
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-white text-orange-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                  }`}
              >
                <BarChart3 className="w-4 h-4" />
                ダッシュボード
              </button>
            </div>

            <button
              disabled={true} // Future Feature
              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full"
              title="管理設定（未実装）"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="w-full px-6 py-6">
        {activeTab === 'shift' && (
          <div className="flex justify-end mb-6">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg font-bold tracking-wide"
            >
              <RefreshCw className="w-5 h-5" />
              {shiftTable.length > 0 ? "シフトを再生成" : "シフト自動作成"}
            </motion.button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'shift' ? (
            <motion.div
              key="shift"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {shiftTable.length > 0 ? (
                <ShiftTableView
                  table={shiftTable}
                  dates={dates}
                  onCellChange={handleCellChange}
                  defaultMonthlyHoliday={monthlySettings[targetDate]?.monthlyHoliday || 10}
                  targetDate={targetDate} // Pass for saving
                  requirements={(() => {
                    // Logic to resolve requirements same as handleGenerate
                    const reqKey = `要員数_${targetDate}`;
                    return excelData?.[reqKey] || excelData?.['要員数'] || [];
                  })()}
                  updateSheetData={updateSheetData}
                />
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-stone-100 shadow-sm">
                  <p className="text-stone-400 text-lg">
                    「シフト自動作成」ボタンを押して生成を開始してください。
                  </p>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'master' ? (
            <motion.div
              key="master"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminView />
            </motion.div>
          ) : activeTab === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <HistoryView
                onBack={() => setActiveTab('shift')}
                onLoad={handleLoadHistory}
              />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <DashboardView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

// Root Component
function App() {
  return (
    <DataProvider>
      <MainApp />
    </DataProvider>
  );
}

export default App;
