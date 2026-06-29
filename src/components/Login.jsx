import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, LogIn } from 'lucide-react';

export default function Login() {
    const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [msg, setMsg] = useState(null); // { type:'err'|'ok', text }
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!email || !password) return;
        setBusy(true); setMsg(null);
        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({ email: email.trim(), password });
                if (error) throw error;
                // 確認メール不要設定ならそのままログイン
                const { error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
                if (e2) {
                    setMsg({ type: 'ok', text: '登録しました。確認メールが届いている場合はリンクを押してからログインしてください。' });
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
                if (error) throw error;
            }
            // 成功時は onAuthStateChange が拾って画面が切り替わる
        } catch (err) {
            const m = err?.message || '';
            let jp = 'ログインに失敗しました。';
            if (/Invalid login/i.test(m)) jp = 'メールアドレスかパスワードが違います。';
            else if (/already registered/i.test(m)) jp = 'このメールは登録済みです。「ログイン」で入ってください。';
            else if (/Email not confirmed/i.test(m)) jp = 'メール確認が未完了です。届いたメールのリンクを押してください。';
            else if (/at least/i.test(m)) jp = 'パスワードは6文字以上にしてください。';
            setMsg({ type: 'err', text: jp });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6 font-sans">
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-stone-100 p-8 space-y-6">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-orange-50 rounded-2xl mb-3">
                        <Building2 className="w-8 h-8 text-orange-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-stone-800">Care Shift AI</h1>
                    <p className="text-sm text-stone-500 mt-1">
                        {mode === 'signin' ? 'ログインしてシフトを管理' : '新規アカウント作成'}
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-stone-600 mb-1">メールアドレス</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="username"
                            className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-stone-600 mb-1">パスワード（6文字以上）</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                            className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                            placeholder="••••••••"
                        />
                    </div>

                    {msg && (
                        <div className={`text-sm rounded-lg px-3 py-2 ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {msg.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={busy || !email || !password}
                        className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-bold text-white transition-all ${busy || !email || !password ? 'bg-stone-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 shadow-md'}`}
                    >
                        <LogIn className="w-4 h-4" />
                        {busy ? '処理中…' : (mode === 'signin' ? 'ログイン' : '登録してはじめる')}
                    </button>
                </form>

                <div className="text-center text-sm text-stone-500">
                    {mode === 'signin' ? (
                        <>はじめての方は <button onClick={() => { setMode('signup'); setMsg(null); }} className="text-orange-600 font-bold underline">新規登録</button></>
                    ) : (
                        <>アカウントをお持ちの方は <button onClick={() => { setMode('signin'); setMsg(null); }} className="text-orange-600 font-bold underline">ログイン</button></>
                    )}
                </div>

                <p className="text-[11px] text-stone-400 text-center leading-relaxed">
                    同じメール・パスワードでログインすれば、別のPCからでも同じシフトデータを使えます。
                </p>
            </div>
        </div>
    );
}
