// スマホ入力ページ（Apps Script ウェブアプリ）への職員名簿の自動同期。
// 職員を保存するたびに氏名一覧を送り、スマホ側の氏名プルダウンを最新に保つ。

// スマホ入力ページ（ウェブアプリ）URLは「施設ごとに」アプリの設定欄で登録する。
// 固定URLは持たない（持つと別施設の名簿を上書きしてしまうため）。未設定なら同期しない。
export const getWebAppUrl = () =>
    (localStorage.getItem('care_shift_ai_webapp_url') || '').trim();

/**
 * マスタ（スタッフ一覧）の氏名を、スマホ入力ページの名簿に反映する。
 * CORS回避のため text/plain + no-cors の投げっぱなし（結果は読めないが書き込みは成功する）。
 */
export const syncStaffToForm = (master) => {
    const url = getWebAppUrl();
    if (!url) return;
    const names = (master || [])
        .map((s) => (s && s['氏名'] ? String(s['氏名']).trim() : ''))
        .filter(Boolean);
    try {
        fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // プリフライト回避
            body: JSON.stringify({ action: 'setStaff', staff: names }),
        }).catch(() => { });
    } catch (e) {
        /* 同期失敗はアプリの動作を妨げない */
    }
};
