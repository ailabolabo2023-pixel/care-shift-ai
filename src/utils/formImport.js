import * as XLSX from 'xlsx';

// 希望テーブルが持つ項目（PreferencesTable と同じ）
export const PREF_FIELDS = ['休み希望', '有休', '早番希望', '日勤希望', '遅出希望', '夜勤希望', '出勤不可', '予備', '誕休', '研修', '研修（夜）'];

/**
 * 「2026-07」「2026/7」「2026年7月」などを "YYYY-MM" に正規化する。
 */
export const normalizeMonth = (val) => {
    if (!val) return '';
    const s = String(val).trim();
    const m = s.match(/(\d{4})\D+(\d{1,2})/);
    if (m) {
        const y = m[1];
        const mo = String(parseInt(m[2], 10)).padStart(2, '0');
        return `${y}-${mo}`;
    }
    return s;
};

/**
 * 公開された Google スプレッドシートの CSV を取得して行配列にする。
 * @param {string} csvUrl 「ウェブに公開」した CSV の URL
 * @returns {Promise<Object[]>}
 */
export const fetchFormResponses = async (csvUrl) => {
    if (!csvUrl || !/^https?:\/\//.test(csvUrl.trim())) {
        throw new Error('シートのURLが正しくありません。「ウェブに公開」したCSVのURLを貼り付けてください。');
    }
    let res;
    try {
        res = await fetch(csvUrl.trim());
    } catch (e) {
        throw new Error('シートに接続できませんでした。URLと「ウェブに公開」設定を確認してください。');
    }
    if (!res.ok) throw new Error(`シートの取得に失敗しました（HTTP ${res.status}）。公開設定を確認してください。`);
    const text = await res.text();
    // raw:true で全セルを文字列のまま読む（"2026-06" などをExcel日付に自動変換させない）
    const wb = XLSX.read(text, { type: 'string', raw: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
};

// 行のキー名を「ぴったり一致 → 含む」の順で探す（フォームの見出しに余計な文字が付いても拾えるように）
const findKey = (row, target) => {
    const keys = Object.keys(row);
    let k = keys.find((x) => x.trim() === target);
    if (k) return k;
    k = keys.find((x) => x.includes(target));
    return k || null;
};

/**
 * フォームの回答行・既存の希望・スタッフ名簿から、指定月の希望テーブルを組み立てる。
 * @returns {{ newPrefs: Object[], importedNames: string[], unknownNames: string[] }}
 */
export const buildPreferencesFromForm = (formRows, master, existingPrefs, currentMonth) => {
    const latestByName = {};

    (formRows || []).forEach((row) => {
        const nameKey = findKey(row, '氏名') || findKey(row, '名前');
        if (!nameKey) return;
        const name = String(row[nameKey]).trim();
        if (!name) return;

        const monthKey = findKey(row, '対象月') || findKey(row, '月');
        const month = monthKey ? normalizeMonth(row[monthKey]) : '';
        // 対象月の指定があり、今選んでいる月と違う回答はスキップ
        if (currentMonth && month && month !== currentMonth) return;

        const tsKey = findKey(row, 'タイムスタンプ') || findKey(row, 'Timestamp');
        const ts = tsKey ? String(row[tsKey]) : '';

        const prev = latestByName[name];
        // 同じ人が複数回出していたら、最新（タイムスタンプが新しい方）を採用
        if (!prev || ts >= prev._ts) {
            latestByName[name] = { ...row, _ts: ts };
        }
    });

    const masterNames = new Set((master || []).map((s) => s['氏名']));

    const newPrefs = (master || []).map((staff) => {
        const name = staff['氏名'];
        const existing = (existingPrefs || []).find((p) => p['氏名'] === name) || {};
        const out = { ...existing, 氏名: name };
        const sub = latestByName[name];
        if (sub) {
            PREF_FIELDS.forEach((f) => {
                const k = findKey(sub, f);
                if (k != null) {
                    const v = String(sub[k] ?? '').trim();
                    if (v) out[f] = v; // 空欄は上書きしない（既存を残す）
                }
            });
        }
        return out;
    });

    const importedNames = Object.keys(latestByName).filter((n) => masterNames.has(n));
    const unknownNames = Object.keys(latestByName).filter((n) => !masterNames.has(n));
    return { newPrefs, importedNames, unknownNames };
};
