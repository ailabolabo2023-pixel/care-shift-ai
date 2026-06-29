import { supabase } from './supabase';

// アプリの全データは localStorage の 'care_shift_ai_data'（excelData等のまとまり）に入っている。
// それをクラウド(app_data.data jsonb)とユーザー単位で同期する。
const LS_KEY = 'care_shift_ai_data';

/**
 * ログイン直後に呼ぶ。クラウドにデータがあれば localStorage に書き込む（クラウド優先）。
 * クラウドが空でローカルにデータがあれば、ローカルをクラウドへ初回アップロード（移行）。
 * @returns {Promise<'cloud'|'local'|'empty'>}
 */
export async function pullToLocal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'empty';

    const { data, error } = await supabase
        .from('app_data')
        .select('data')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('[cloudSync] pull error', error);
        return 'empty';
    }

    if (data && data.data) {
        // クラウドが正：ローカルへ反映
        localStorage.setItem(LS_KEY, JSON.stringify(data.data));
        return 'cloud';
    }

    // クラウドが空：ローカルにあれば初回アップロード
    const local = localStorage.getItem(LS_KEY);
    if (local) {
        try { await pushFromLocal(); return 'local'; } catch (e) { /* noop */ }
    }
    return 'empty';
}

let pushTimer = null;
/** データ変更時に呼ぶ。1.5秒デバウンスでクラウドへ保存。 */
export function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushFromLocal().catch(() => { }); }, 1500);
}

/** localStorage の内容をクラウドへ upsert。 */
export async function pushFromLocal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const local = localStorage.getItem(LS_KEY);
    if (!local) return;
    let parsed;
    try { parsed = JSON.parse(local); } catch { return; }
    const { error } = await supabase
        .from('app_data')
        .upsert({ user_id: user.id, data: parsed, updated_at: new Date().toISOString() });
    if (error) console.error('[cloudSync] push error', error);
}
