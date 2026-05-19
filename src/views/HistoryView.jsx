import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Trash2, Upload, Calendar, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const HistoryView = ({ onBack, onLoad }) => {
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const saved = localStorage.getItem('care_shift_ai_history');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Sort by createdAt descending (newest first)
                parsed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setHistory(parsed);
            } catch (e) {
                console.error("Failed to parse history", e);
            }
        }
    }, []);

    const handleDelete = (id) => {
        if (!window.confirm("この履歴を削除しますか？")) return;

        const newHistory = history.filter(h => h.id !== id);
        setHistory(newHistory);
        localStorage.setItem('care_shift_ai_history', JSON.stringify(newHistory));
    };

    const handleLoad = (item) => {
        if (window.confirm(`${item.date} のデータを読み込みますか？\n現在の作業内容は上書きされます。`)) {
            onLoad(item);
        }
    };

    const formatDate = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleString('ja-JP', {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric'
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-stone-700">過去のシフト表履歴</h2>
            </div>

            {history.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-stone-100 shadow-sm">
                    <p className="text-stone-400 text-lg">
                        保存された履歴はありません。<br />
                        シフト表画面の「保存」ボタンから作成したシフトを記録できます。
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    <AnimatePresence>
                        {history.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white p-6 rounded-xl shadow-sm border border-stone-100 flex items-center justify-between hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg">
                                        {item.date.split('-')[1]}月
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-stone-700">{item.date} シフト表</h3>
                                        <p className="text-sm text-stone-400 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            保存日時: {formatDate(item.createdAt)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleLoad(item)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition-colors"
                                    >
                                        <Upload className="w-4 h-4" />
                                        読み込む
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="削除"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default HistoryView;
