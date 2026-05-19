import React, { useCallback } from 'react';
import { useData } from '../context/DataContext';
import { readExcelData, validateSheets } from '../utils/excelParser';
import { Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const FileUploader = () => {
    const { setExcelData, setFileName } = useData();
    const [status, setStatus] = React.useState("idle"); // idle, loading, success, error
    const [message, setMessage] = React.useState("");

    const handleFileUpload = useCallback(async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setStatus("loading");
        setMessage("読み込み中...");

        try {
            const data = await readExcelData(file);
            const validation = validateSheets(data);

            if (!validation.isValid) {
                setStatus("error");
                setMessage(`エラー: ${validation.missingSheets.join(", ")} シートが見つかりません。`);
                return;
            }

            setExcelData(data);
            setFileName(file.name);
            setStatus("success");
            setMessage("読み込み完了！");
        } catch (error) {
            console.error("Upload error:", error);
            setStatus("error");
            setMessage("ファイルの読み込みに失敗しました。");
        }
    }, [setExcelData, setFileName]);

    return (
        <div className="w-full">
            <label
                htmlFor="file-upload"
                className={`
                    relative group flex flex-col items-center justify-center w-full h-40 
                    border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
                    ${status === 'error' ? 'border-red-300 bg-red-50' :
                        status === 'success' ? 'border-green-300 bg-green-50' :
                            'border-stone-300 bg-stone-50 hover:bg-white hover:border-orange-300 hover:shadow-md'}
                `}
            >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                    {status === 'loading' ? (
                        <Loader2 className="w-10 h-10 text-orange-400 animate-spin mb-3" />
                    ) : status === 'success' ? (
                        <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
                    ) : status === 'error' ? (
                        <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
                    ) : (
                        <motion.div whileHover={{ y: -5 }}>
                            <Upload className="w-10 h-10 text-stone-400 group-hover:text-orange-400 mb-3 transition-colors" />
                        </motion.div>
                    )}

                    <p className={`text-sm ${status === 'error' ? 'text-red-500' : 'text-stone-500'}`}>
                        {message || (
                            <>
                                <span className="font-semibold text-stone-700">クリックしてアップロード</span>
                                <br />またはドラッグ＆ドロップ
                            </>
                        )}
                    </p>
                    <p className="text-xs text-stone-400 mt-1">.xlsx, .xls (Excelファイル)</p>
                </div>
                <input
                    id="file-upload"
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={status === 'loading'}
                />
            </label>
        </div>
    );
};

export default FileUploader;
