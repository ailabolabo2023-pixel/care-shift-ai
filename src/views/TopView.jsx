import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import FileUploader from '../components/FileUploader';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Upload, ArrowRight, HeartHandshake, BookOpen } from 'lucide-react';

const TopView = () => {
    const { excelData, fileName, setTargetDate, setViewMode, clearData } = useData();
    const [inputDate, setInputDate] = useState("");

    const handleDateSubmit = () => {
        if (!inputDate) return;
        setTargetDate(inputDate);
        setViewMode("shift"); // Proceed to main shift view
    };

    return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-6 font-sans text-stone-700 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
                {/* Hero Image Background */}
                <div
                    className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: "url('/images/hero-image.png')" }}
                />


            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="z-10 w-full max-w-2xl text-center space-y-8"
            >
                <div>
                    <motion.div
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="inline-flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm rounded-full shadow-sm mb-6"
                    >
                        <HeartHandshake className="w-10 h-10 text-orange-400 mr-3" />
                        <h1 className="text-3xl font-bold tracking-tight text-stone-800 drop-shadow-sm">
                            Care Shift AI <span className="text-lg font-normal text-stone-600 ml-2">for Welfare</span>
                        </h1>
                    </motion.div>
                    <p className="text-lg font-bold text-stone-800 max-w-lg mx-auto leading-relaxed drop-shadow-md bg-white/30 backdrop-blur-[1px] rounded-lg py-2 px-4 shadow-sm inline-block">
                        「公正性」と「効率」を両立するシフト作成。<br />
                        生まれた時間を、利用者のケアとスタッフに寄り添う時間へ。
                    </p>
                </div>

                <div className="bg-white/60 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-white/50">
                    <AnimatePresence mode="wait">
                        {!excelData ? (
                            <motion.div
                                key="upload"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <h2 className="text-xl font-semibold text-stone-800 flex items-center justify-center gap-2">
                                        <Upload className="w-5 h-5 text-green-600" />
                                        データ読み込み
                                    </h2>
                                    <p className="text-sm text-stone-500">
                                        「原田南２号館...xlsx」などのシフト管理ファイルをアップロードしてください。<br />
                                        一度読み込むと、次回からは自動的に復元されます。
                                    </p>
                                </div>
                                <div className="max-w-md mx-auto">
                                    <FileUploader />
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="select"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-2">
                                    <h2 className="text-xl font-semibold text-stone-800 flex items-center justify-center gap-2">
                                        <Calendar className="w-5 h-5 text-orange-500" />
                                        作成月の選択
                                    </h2>
                                    <div className="flex items-center justify-center gap-2 bg-green-50 px-4 py-2 rounded-full w-fit mx-auto">
                                        <span className="text-sm text-green-800 font-medium truncate max-w-[200px]">{fileName}</span>
                                        <button
                                            onClick={() => {
                                                if (window.confirm("読み込んだデータを削除して変更しますか？")) {
                                                    clearData();
                                                }
                                            }}
                                            className="text-xs text-green-600 underline hover:text-green-800"
                                        >
                                            変更
                                        </button>
                                    </div>
                                    <p className="text-sm text-stone-500 pt-2">
                                        シフトを作成したい年月を入力してください（例: 2025-10）
                                    </p>
                                </div>

                                <div className="flex flex-col items-center gap-4">
                                    <div className="relative">
                                        <input
                                            type="month"
                                            value={inputDate}
                                            onChange={(e) => setInputDate(e.target.value)}
                                            className="text-2xl font-bold text-center text-stone-700 bg-white border-2 border-stone-200 rounded-xl px-6 py-3 shadow-inner focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100 transition-all w-64"
                                            placeholder="YYYY-MM"
                                        />
                                    </div>

                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleDateSubmit}
                                        disabled={!inputDate}
                                        className={`flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg shadow-lg transition-all
                                            ${inputDate
                                                ? "bg-gradient-to-r from-orange-400 to-pink-500 text-white shadow-orange-200"
                                                : "bg-stone-200 text-stone-400 cursor-not-allowed"
                                            }`}
                                    >
                                        シフト管理へ進む
                                        <ArrowRight className="w-5 h-5" />
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <div className="absolute top-6 right-6 z-20">
                <a
                    href="/manual.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md rounded-full shadow-sm text-stone-600 font-medium hover:bg-white hover:text-orange-500 transition-colors"
                >
                    <BookOpen className="w-5 h-5" />
                    使用ガイド
                </a>
            </div>

            <footer className="absolute bottom-4 text-stone-400 text-xs text-center w-full">
                &copy; Care Shift AI - Welfare Edition
            </footer>
        </div >
    );
};

export default TopView;
