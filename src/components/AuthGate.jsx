import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { pullToLocal } from '../lib/cloudSync';
import Login from './Login';

// 認証ゲート：未ログインならLogin、ログイン後はクラウド→ローカル同期を済ませてから子を描画。
export default function AuthGate({ children }) {
    const [session, setSession] = useState(undefined); // undefined=確認中, null=未ログイン
    const [synced, setSynced] = useState(false);
    const pulledFor = useRef(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s ?? null);
        });
        return () => sub.subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const uid = session?.user?.id;
        if (uid) {
            if (pulledFor.current !== uid) {
                setSynced(false);
                pullToLocal().finally(() => { pulledFor.current = uid; setSynced(true); });
            }
        } else {
            pulledFor.current = null;
            setSynced(false);
        }
    }, [session]);

    if (session === undefined) {
        return <Centered text="読み込み中…" />;
    }
    if (!session) {
        return <Login />;
    }
    if (!synced) {
        return <Centered text="データを同期中…" />;
    }
    return children;
}

function Centered({ text }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-500 font-sans">
            <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full border-2 border-orange-300 border-t-orange-500 animate-spin inline-block" />
                {text}
            </div>
        </div>
    );
}
