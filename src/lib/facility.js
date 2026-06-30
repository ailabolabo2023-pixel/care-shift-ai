import { supabase } from './supabase';

// ログイン中の施設ID（= ログインIDの @ より前）を扱うヘルパー。
// スマホ入力ページの fid や、回答の施設別フィルタに使う。
const LS_FID = 'care_shift_ai_facility_id';

// ログインIDのメール（id@careshift.local）から施設IDを取り出す。
export const facilityIdFromEmail = (email) =>
    (email || '').split('@')[0].trim().toLowerCase();

// AuthGate がログイン時に呼ぶ。施設IDを端末に控えておく（同期的に読めるように）。
export const setFacilityId = (id) => {
    if (id) localStorage.setItem(LS_FID, id);
};

// どこからでも同期的に読める施設ID。未設定なら空文字。
export const getFacilityId = () => (localStorage.getItem(LS_FID) || '').trim();

// localStorage に無ければセッションから取り出して保存し直す（保険）。
export const ensureFacilityId = async () => {
    const cached = getFacilityId();
    if (cached) return cached;
    const { data: { user } } = await supabase.auth.getUser();
    const id = facilityIdFromEmail(user?.email);
    if (id) setFacilityId(id);
    return id;
};
