import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, LogIn } from 'lucide-react';

// 施設IDをSupabase内部用の擬似メールに変換する。
// 画面にはメアドは一切出さず、IDだけで完結させるための内部処理。
const ID_DOMAIN = 'careshift.local';
const normalizeId = (raw) => (raw || '').trim().toLowerCase();
const idToEmail = (id) => `${id}@${ID_DOMAIN}`;

export default function Login() {
    const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
    const [facilityId, setFacilityId] = useState('');
    const [password, setPassword] = useState('');
    const [msg, setMsg] = useState(null); // { type:'err'|'ok', text }
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        const id = normalizeId(facilityId);
        if (!id || !password) return;
        if (!/^[a-z0-9]+$/.test(id)) {
            setMsg({ type: 'err', text: '施設IDは半角の英数字（a〜z, 0〜9）だけで入力してください。' });
            return;
        }
        const email = idToEmail(id);
        setBusy(true); setMsg(null);
        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                // メール確認OFF設定ならそのままログインできる
                const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
                if (e2) {
                    setMsg({ type: 'err', text: '登録はできましたが自動ログインに失敗しました。Supabaseの「メール確認」がONになっている可能性があります。' });
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
            // 成功時は onAuthStateChange が拾って画面が切り替わる
        } catch (err) {
            const m = err?.message || '';
            let jp = 'ログインに失敗しました。';
            if (/Invalid login/i.test(m)) jp = '施設IDかパスワードが違います。';
            else if (/already registered/i.test(m)) jp = 'この施設IDは登録済みです。「ログイン」で入ってください。';
            else if (/Email not confirmed/i.test(m)) jp = 'Supabaseの「メール確認」がONのままです。OFFにしてください。';
            else if (/at least/i.test(m)) jp = 'パスワードは6文字以上にしてください。';
            setMsg({ type: 'err', text: jp });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-app-auth p-6 font-sans">
            <div className="w-full max-w-sm bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/70 p-8 space-y-6">
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
                        <label className="block text-xs font-bold text-stone-600 mb-1">施設ID（半角英数字）</label>
                        <input
                            type="text"
                            value={facilityId}
                            onChange={(e) => setFacilityId(e.target.value)}
                            autoComplete="username"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                            placeholder="例：sakura"
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
                        disabled={busy || !facilityId || !password}
                        className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-bold text-white transition-all ${busy || !facilityId || !password ? 'bg-stone-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 shadow-md'}`}
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
                    同じ施設ID・パスワードでログインすれば、別のPCからでも同じシフトデータを使えます。
                </p>
            </div>
        </div>
    );
}
