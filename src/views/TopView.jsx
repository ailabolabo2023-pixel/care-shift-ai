import React, { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import FileUploader from '../components/FileUploader';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Building2, Calendar, ClipboardList, Upload, Users } from 'lucide-react';

const TopView = () => {
    const {
        excelData,
        fileName,
        facilityName,
        createFacility,
        renameFacility,
        setTargetDate,
        setViewMode,
        clearData
    } = useData();

    const [facilityInput, setFacilityInput] = useState(facilityName || fileName || '');
    const [inputDate, setInputDate] = useState(new Date().toISOString().slice(0, 7));

    useEffect(() => {
        setFacilityInput(facilityName || fileName || '');
    }, [facilityName, fileName]);

    const staffCount = excelData?.['マスタ']?.length || 0;
    const registeredName = facilityName || excelData?.facilityName || fileName || '';

    const handleFacilitySubmit = (event) => {
        event.preventDefault();
        if (!facilityInput.trim()) return;

        if (excelData) {
            renameFacility(facilityInput);
        } else {
            createFacility(facilityInput);
        }
    };

    const moveToStaffSettings = () => {
        if (!excelData && facilityInput.trim()) {
            createFacility(facilityInput);
        }
        if (inputDate) setTargetDate(inputDate);
        setViewMode('master');
    };

    const moveToShift = () => {
        if (!inputDate) return;
        setTargetDate(inputDate);
        setViewMode('shift');
    };

    return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 font-sans text-stone-700 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none z-0">
                <div
                    className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: "url('/images/hero-welfare.png')" }}
                />
                <div className="absolute inset-0 bg-white/35" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="z-10 w-full max-w-4xl space-y-6"
            >
                <div className="text-center">
                    <div className="inline-flex items-center justify-center p-4 bg-white/85 backdrop-blur-sm rounded-full shadow-sm mb-5">
                        <Building2 className="w-10 h-10 text-orange-500 mr-3" />
                        <h1 className="text-3xl font-bold tracking-tight text-stone-800">
                            Care Shift AI <span className="text-lg font-normal text-stone-600 ml-2">for Welfare</span>
                        </h1>
                    </div>
                    <p className="text-base font-bold text-stone-700 bg-white/70 backdrop-blur-sm rounded-full py-2 px-5 shadow-sm inline-block">
                        施設名と職員データを登録して、Excelなしでシフトを作成します。
                    </p>
                </div>

                <div className="bg-white/80 backdrop-blur-md rounded-3xl p-7 shadow-xl border border-white/60">
                    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-orange-500" />
                                <h2 className="text-xl font-bold text-stone-800">施設登録</h2>
                            </div>

                            <form onSubmit={handleFacilitySubmit} className="space-y-3">
                                <label className="block text-sm font-bold text-stone-600">
                                    施設名
                                </label>
                                <input
                                    type="text"
                                    value={facilityInput}
                                    onChange={(event) => setFacilityInput(event.target.value)}
                                    className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-lg font-bold text-stone-800 outline-none transition-all focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                                    placeholder="例：原田南2号館"
                                />
                                <button
                                    type="submit"
                                    disabled={!facilityInput.trim()}
                                    className={`w-full rounded-xl px-4 py-3 font-bold transition-all ${facilityInput.trim()
                                        ? 'bg-orange-500 text-white shadow-md hover:bg-orange-600'
                                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                        }`}
                                >
                                    {excelData ? '施設名を更新' : 'この施設で始める'}
                                </button>
                            </form>

                            {excelData && (
                                <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3">
                                    <p className="text-xs font-bold text-green-700">登録施設</p>
                                    <p className="mt-1 text-lg font-bold text-green-900 truncate">{registeredName}</p>
                                    <p className="mt-1 text-sm text-green-800">登録職員：{staffCount}名</p>
                                </div>
                            )}
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-500" />
                                <h2 className="text-xl font-bold text-stone-800">作成月と操作</h2>
                            </div>

                            <div className="rounded-2xl border border-stone-200 bg-white/80 p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-stone-600 mb-2">
                                        シフト作成月
                                    </label>
                                    <input
                                        type="month"
                                        value={inputDate}
                                        onChange={(event) => setInputDate(event.target.value)}
                                        className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-xl font-bold text-stone-800 outline-none transition-all focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <button
                                        onClick={moveToStaffSettings}
                                        disabled={!excelData && !facilityInput.trim()}
                                        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-all ${excelData || facilityInput.trim()
                                            ? 'bg-stone-800 text-white shadow-md hover:bg-stone-900'
                                            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                            }`}
                                    >
                                        <Users className="w-5 h-5" />
                                        職員登録へ
                                    </button>
                                    <button
                                        onClick={moveToShift}
                                        disabled={!excelData || !inputDate}
                                        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-all ${excelData && inputDate
                                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md hover:shadow-lg'
                                            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                            }`}
                                    >
                                        <ClipboardList className="w-5 h-5" />
                                        シフト管理へ
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {excelData && (
                                <button
                                    onClick={() => {
                                        if (window.confirm('登録施設と入力データを削除して、最初からやり直しますか？')) {
                                            clearData();
                                        }
                                    }}
                                    className="text-sm font-bold text-stone-500 underline hover:text-red-600"
                                >
                                    登録データを削除してやり直す
                                </button>
                            )}
                        </section>
                    </div>

                    {!excelData && (
                        <details className="mt-6 rounded-2xl border border-stone-200 bg-white/70 p-4">
                            <summary className="cursor-pointer text-sm font-bold text-stone-600 flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                既存のExcelファイルから移行する
                            </summary>
                            <div className="mt-4 max-w-md">
                                <FileUploader />
                            </div>
                        </details>
                    )}
                </div>
            </motion.div>

            <div className="absolute top-6 right-6 z-20">
                <a
                    href="/manual.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white/85 backdrop-blur-md rounded-full shadow-sm text-stone-600 font-medium hover:bg-white hover:text-orange-500 transition-colors"
                >
                    <BookOpen className="w-5 h-5" />
                    使用ガイド
                </a>
            </div>

            <footer className="absolute bottom-4 text-stone-500 text-xs text-center w-full">
                &copy; Care Shift AI - Welfare Edition
            </footer>
        </div>
    );
};

export default TopView;
