import { supabase } from './supabase';

// アプリの全データは localStorage の 'care_shift_ai_data'（excelData等のまとまり）に入っている。
// それをクラウド(app_data.data jsonb)とユーザー（＝施設）単位で同期する。
const LS_KEY = 'care_shift_ai_data';
// 端末に入っているデータが「どの施設(uid)のものか」を覚えておく鍵。施設の取り違え防止。
const LS_OWNER = 'care_shift_ai_data_owner';
// 別施設のデータを誤って消さないための退避先（消失防止のバックアップ）。
const LS_ORPHAN = 'care_shift_ai_data_orphan';

/**
 * ログイン直後に呼ぶ。施設(uid)単位でデータを正しく揃える。
 *  - 端末のデータが別施設のものなら退避してクリア（混在防止）
 *  - クラウドにこの施設のデータがあれば localStorage に反映（クラウド優先）
 *  - クラウドが空なら、この施設が自分でこの端末に作ったデータだけ初回アップロード
 * @returns {Promise<'cloud'|'local'|'empty'>}
 */
export async function pullToLocal() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'empty';
    const uid = user.id;

    // 端末に残っているデータの所有者がこの施設でなければ、いったん退避してクリアする。
    // （別施設のデータをこの施設として表示・アップロードしてしまうのを防ぐ）
    const owner = localStorage.getItem(LS_OWNER);
    if (owner !== uid) {
        const stray = localStorage.getItem(LS_KEY);
        if (stray) localStorage.setItem(LS_ORPHAN, stray); // 消失防止に退避
        localStorage.removeItem(LS_KEY);
    }

    const { data, error } = await supabase
        .from('app_data')
        .select('data')
        .eq('user_id', uid)
        .maybeSingle();

    if (error) {
        console.error('[cloudSync] pull error', error);
        return 'empty';
    }

    if (data && data.data) {
        // クラウドが正：ローカルへ反映し、所有者をこの施設に設定
        localStorage.setItem(LS_KEY, JSON.stringify(data.data));
        localStorage.setItem(LS_OWNER, uid);
        return 'cloud';
    }

    // クラウドが空：この端末のデータが「この施設のもの」と確定している時だけ初回アップロード
    const local = localStorage.getItem(LS_KEY);
    if (local && localStorage.getItem(LS_OWNER) === uid) {
        try { await pushFromLocal(); return 'local'; } catch (e) { /* noop */ }
    } else {
        // 所有者不明/別施設のデータは残さない＝新規施設は空から始める
        localStorage.removeItem(LS_KEY);
        localStorage.setItem(LS_OWNER, uid);
    }
    return 'empty';
}

let pushTimer = null;
/** データ変更時に呼ぶ。1.5秒デバウンスでクラウドへ保存。 */
export function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushFromLocal().catch(() => { }); }, 1500);
}

/** localStorage の内容をクラウドへ upsert。保存できたら所有者をこの施設に記録する。 */
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
    if (error) { console.error('[cloudSync] push error', error); return; }
    // この端末のデータはこの施設のもの、と確定させる
    localStorage.setItem(LS_OWNER, user.id);
}
