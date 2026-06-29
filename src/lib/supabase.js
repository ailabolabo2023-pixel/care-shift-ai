import { createClient } from '@supabase/supabase-js';

// Supabase 接続情報。publishable(anon)キーはクライアント公開前提・RLSで保護されるため埋め込み可。
// 環境変数があればそちらを優先（本番で差し替えたい時用）。
const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL || 'https://wzvwriesrxrdypduhaph.supabase.co';
const SUPABASE_KEY =
    import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_N_RoC9vSuiBlrFznK-cMFA_FjCrZRzP';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});
