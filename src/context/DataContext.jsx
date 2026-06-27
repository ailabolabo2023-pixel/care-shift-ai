import React, { createContext, useState, useContext, useEffect } from 'react';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    // Persistent Data
    const [excelData, setExcelData] = useState(null); // { master, requirements, etc. }
    const [fileName, setFileName] = useState("");

    // Session Data
    const [targetDate, setTargetDate] = useState(""); // "YYYY-MM"
    const [shiftTable, setShiftTable] = useState([]); // Generated Shift Results (Array of Staff objects)
    const [dates, setDates] = useState([]); // Array of date strings for table header
    const [logs, setLogs] = useState([]);

    // Monthly Settings (e.g., standard holidays)
    const [monthlySettings, setMonthlySettings] = useState({}); // { "YYYY-MM": { standardHoliday: 9, weekly2Holiday: 8 } }

    // UI State
    const [viewMode, setViewMode] = useState("top"); // "top", "shift", "master"

    // Load from LocalStorage on mount
    useEffect(() => {
        const key = "care_shift_ai_data";
        const oldKey = "mystic_shifts_data";

        let savedData = localStorage.getItem(key);

        // Migration: If new data missing, try old data
        if (!savedData) {
            const oldData = localStorage.getItem(oldKey);
            if (oldData) {
                console.log("Migrating main data...");
                savedData = oldData;
                // Optional: Save immediately to new key? 
                // The persist effect will trigger if state changes, but maybe not immediately if just setting state.
                // It's safer to just load it into state. The next save will write to new key.
            }
        }

        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                setExcelData(parsed.excelData);
                setFileName(parsed.fileName || "シフト①");

                // Restore session state
                if (parsed.targetDate) setTargetDate(parsed.targetDate);
                if (parsed.shiftTable) setShiftTable(parsed.shiftTable);
                if (parsed.dates) setDates(parsed.dates);
                if (parsed.logs) setLogs(parsed.logs);
                if (parsed.viewMode) setViewMode(parsed.viewMode);
                if (parsed.monthlySettings) setMonthlySettings(parsed.monthlySettings);
            } catch (e) {
                console.error("Failed to load saved data", e);
            }
        }
    }, []);

    // Save to LocalStorage when essential data changes
    useEffect(() => {
        if (excelData) {
            localStorage.setItem("care_shift_ai_data", JSON.stringify({
                excelData,
                fileName,
                targetDate,
                shiftTable,
                dates,
                logs,
                viewMode,
                monthlySettings
            }));
        }
    }, [excelData, fileName, targetDate, shiftTable, dates, logs, viewMode, monthlySettings]);

    const clearData = () => {
        setExcelData(null);
        setFileName("");
        setShiftTable([]);
        setDates([]);
        setTargetDate("");
        setMonthlySettings({});
        localStorage.removeItem("care_shift_ai_data");
        setViewMode("top");
    };

    const updateSheetData = (sheetName, newData) => {
        setExcelData(prev => ({
            ...prev,
            [sheetName]: newData
        }));
    };

    const updateMonthlySettings = (month, newSettings) => {
        setMonthlySettings(prev => ({
            ...prev,
            [month]: { ...(prev[month] || {}), ...newSettings }
        }));
    };

    const saveBackup = (name) => {
        if (!excelData) return;
        const backupData = {
            excelData,
            fileName,
            targetDate,
            shiftTable,
            dates,
            logs,
            viewMode,
            monthlySettings,
            timestamp: new Date().toISOString()
        };
        localStorage.setItem(`care_shift_ai_backup_${name}`, JSON.stringify(backupData));
        return true;
    };

    const value = {
        excelData, setExcelData,
        fileName, setFileName,
        targetDate, setTargetDate,
        shiftTable, setShiftTable,
        dates, setDates,
        logs, setLogs,
        viewMode, setViewMode,
        monthlySettings, updateMonthlySettings,
        clearData,
        updateSheetData,
        saveBackup
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};
