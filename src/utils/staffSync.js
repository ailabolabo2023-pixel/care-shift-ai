// スマホ入力ページ（Apps Script ウェブアプリ）への職員名簿の自動同期。
// 職員を保存するたびに、その施設(fid)の氏名一覧を送り、スマホ側の氏名プルダウンを最新に保つ。

import { getFacilityId } from '../lib/facility';

// 全施設で共通のスマホ入力ページ（Apps Script ウェブアプリ）の基本URL。
// 施設の振り分けは ?fid=施設ID で行うため、URLは1本でよい。
export const DEFAULT_WEBAPP_BASE =
    'https://script.google.com/macros/s/AKfycbwJJ_2pAkDD4c-OmI7aLDccf4wRuHovCtFLPFczb5fpWbxYaGvCbDp9-EgCyPe49q4Y1Q/exec';

// 設定欄で上書きしていればそれを優先。未設定なら共通URL。
export const getWebAppBase = () =>
    (localStorage.getItem('care_shift_ai_webapp_url') || DEFAULT_WEBAPP_BASE).trim();

// この施設の職員に配るスマホURL（基本URL + ?fid=施設ID）。
export const getStaffPageUrl = () => {
    const base = getWebAppBase();
    const fid = getFacilityId();
    if (!base) return '';
    if (!fid) return base;
    return base + (base.includes('?') ? '&' : '?') + 'fid=' + encodeURIComponent(fid);
};

/**
 * マスタ（スタッフ一覧）の氏名を、スマホ入力ページの名簿に反映する。
 * CORS回避のため text/plain + no-cors の投げっぱなし（結果は読めないが書き込みは成功する）。
 * 施設ID(fid)を body に含めるので、宛先は基本URLのままでよい。
 */
export const syncStaffToForm = (master) => {
    const base = getWebAppBase();
    const fid = getFacilityId();
    if (!base || !fid) return;
    const names = (master || [])
        .map((s) => (s && s['氏名'] ? String(s['氏名']).trim() : ''))
        .filter(Boolean);
    try {
        fetch(base, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // プリフライト回避
            body: JSON.stringify({ action: 'setStaff', fid, staff: names }),
        }).catch(() => { });
    } catch (e) {
        /* 同期失敗はアプリの動作を妨げない */
    }
};

/**
 * 希望提出の制限（上限日数・同日重複上限）を、スマホ入力ページ(GAS)へ同期する。
 * GAS側は施設(fid)ごとに保存し、スマホページの送信バリデーションに使う。
 * config 例: { maxRequestDays: 3, maxOverlapPerDay: 2 }（0/未設定＝無制限）
 */
export const syncConfigToForm = (config) => {
    const base = getWebAppBase();
    const fid = getFacilityId();
    if (!base || !fid) return;
    try {
        fetch(base, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'setConfig',
                fid,
                config: {
                    maxRequestDays: parseInt(config?.maxRequestDays, 10) || 0,
                    maxOverlapPerDay: parseInt(config?.maxOverlapPerDay, 10) || 0,
                },
            }),
        }).catch(() => { });
    } catch (e) {
        /* 同期失敗はアプリの動作を妨げない */
    }
};
