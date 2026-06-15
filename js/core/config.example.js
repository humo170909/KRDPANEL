// ================================================================
// config.example.js — Plantilla pública de configuración
// ----------------------------------------------------------------
// Copia este archivo como config.js y rellena los valores reales.
// NUNCA subas config.js a un repositorio público.
// ================================================================

export const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";
export const SUPABASE_KEY = "TU_ANON_KEY_DE_SUPABASE";

// WhatsApp via CallMeBot (https://www.callmebot.com/blog/free-api-whatsapp-messages/)
export const WA_PHONE  = "CODIGO_PAIS + NUMERO";  // ej: "51999999999"
export const WA_APIKEY = "TU_APIKEY_CALLMEBOT";

// Claves de almacenamiento
export const SK_SESSION     = "krd_session";
export const SK_LOGIN_FAILS = "krd_login_fails";
export const SK_LOGIN_BLOCK = "krd_login_blocked_until";

export const MAX_LOGIN_TRIES = 5;
export const BLOCK_MS        = 2 * 60 * 1000;

export const SK_LOGIN_BLOCK_COUNT = "krd_block_count";
export const SK_SESSION_SIG       = "krd_sig";

export const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;
export const IDLE_TIMEOUT_MS     = 30 * 60 * 1000;

export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:    false,
    autoRefreshToken:  false,
    detectSessionInUrl: false,
  },
});
