// ================================================================
// core/config.js — KRD Importaciones
// Única fuente de verdad: credenciales, claves y constantes globales
// ADVERTENCIA: SUPABASE_KEY es la "anon key" (publishable).
// Segura para exponer en cliente SOLO SI tienes RLS activado en
// todas tus tablas de Supabase → Authentication → Policies.
// ================================================================

export const SUPABASE_URL = "https://vbphssxbfuthmkcldnkb.supabase.co";
export const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicGhzc3hiZnV0aG1rY2xkbmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTMzMjIsImV4cCI6MjA5MDEyOTMyMn0.FHbdMKMWT9V2tf-Z0KGbZtKxcM1c30gX7GeRWXdvq10";

// WhatsApp via CallMeBot
export const WA_PHONE  = "51993100282";
export const WA_APIKEY = "3956084";

// Claves de almacenamiento
export const SK_SESSION     = "krd_session";
export const SK_LOGIN_FAILS = "krd_login_fails";
export const SK_LOGIN_BLOCK = "krd_login_blocked_until";

// Política de bloqueo por intentos fallidos
export const MAX_LOGIN_TRIES = 5;
export const BLOCK_MS        = 2 * 60 * 1000; // 2 min base (se duplica progresivamente)

// Claves adicionales de seguridad
export const SK_LOGIN_BLOCK_COUNT = "krd_block_count"; // contador de bloqueos para lockout progresivo
export const SK_SESSION_SIG       = "krd_sig";         // firma de integridad de sesión

// Política de expiración de sesión
export const SESSION_DURATION_MS = 4 * 60 * 60 * 1000;  // 4 horas máximo por sesión
export const IDLE_TIMEOUT_MS     = 30 * 60 * 1000;       // 30 min de inactividad → logout

// Instancia única de Supabase (singleton)
// persistSession:false  → no guarda tokens en localStorage (la app usa krd_session en sessionStorage)
// autoRefreshToken:false → evita el error 400 "Refresh Token Not Found" al inicializar
// detectSessionInUrl:false → no procesa tokens OAuth de la URL (no usamos OAuth)
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession:    false,
    autoRefreshToken:  false,
    detectSessionInUrl: false,
  },
});
