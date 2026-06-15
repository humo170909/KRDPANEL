// ================================================================
// core/config.js — KRD Importaciones
// ----------------------------------------------------------------
// ⚠️  Las credenciales se cargan desde js/core/env.js (gitignoreado)
//     NUNCA pongas credenciales reales directamente en este archivo.
//
// CONFIGURACIÓN LOCAL:
//   1. Copia js/core/env.example.js → js/core/env.js
//   2. Pega tus credenciales en env.js
//   3. NUNCA subas env.js a GitHub/GitLab/Bitbucket
//
// DESPLIEGUE EN PRODUCCIÓN:
//   ── VERCEL ──────────────────────────────────────────────────────
//   1. Dashboard → Settings → Environment Variables
//   2. Agrega: SUPABASE_URL, SUPABASE_KEY, WA_PHONE, WA_APIKEY
//   3. Crea una Edge Function que sirva window.KRD_ENV como JS
//
//   ── NETLIFY ──────────────────────────────────────────────────────
//   1. Site Settings → Build & Deploy → Environment
//   2. Agrega las variables
//   3. Usa un Netlify Function como proxy para env.js
//
//   ── GITHUB ACTIONS (build estático) ──────────────────────────────
//   1. Repository → Settings → Secrets → Actions
//   2. En el workflow: genera env.js desde los secrets de CI
//
//   ── SUPABASE (seguridad de datos) ────────────────────────────────
//   1. Activa RLS en TODAS las tablas del proyecto
//   2. Crea políticas que limiten acceso por rol/usuario
//   3. Usa service_role key SOLO en server-side, nunca en el cliente
// ================================================================

// Las credenciales las inyecta env.js (cargado antes que main.js en index.html).
// Si env.js no existe o está vacío, las constantes quedan en "" y
// supabaseClient será null → la app muestra un aviso de configuración.
const _env = (typeof window !== "undefined" && window.KRD_ENV) || {};

export const SUPABASE_URL = _env.SUPABASE_URL || "";
export const SUPABASE_KEY = _env.SUPABASE_KEY || "";

// WhatsApp via CallMeBot — ver advertencia arriba
export const WA_PHONE  = _env.WA_PHONE  || "";
export const WA_APIKEY = _env.WA_APIKEY || "";

// Claves de almacenamiento (no sensibles)
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
// persistSession:false  → no guarda tokens en localStorage
// autoRefreshToken:false → evita el error 400 "Refresh Token Not Found"
// detectSessionInUrl:false → no procesa tokens OAuth de la URL
export const supabaseClient = (SUPABASE_URL && SUPABASE_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession:    false,
        autoRefreshToken:  false,
        detectSessionInUrl: false,
      },
    })
  : (() => {
      // Muestra aviso si faltan credenciales (solo en navegador)
      if (typeof document !== "undefined") {
        document.addEventListener("DOMContentLoaded", () => {
          const loginCard = document.querySelector(".login-card");
          if (loginCard) {
            loginCard.innerHTML = `
              <div style="text-align:center;padding:8px 0;">
                <div style="font-size:2.5rem;margin-bottom:14px">⚙️</div>
                <h2 style="font-family:'Rajdhani',sans-serif;font-size:1.2rem;color:var(--danger,#f05a6e);margin-bottom:10px;letter-spacing:.05em">Configuración incompleta</h2>
                <p style="color:var(--text-secondary,#7688aa);font-size:.85rem;margin-bottom:8px;line-height:1.6">
                  No se encontró <code style="background:rgba(255,255,255,.07);padding:2px 7px;border-radius:4px">js/core/env.js</code>
                </p>
                <p style="color:var(--text-muted,#5a6888);font-size:.78rem;line-height:1.6">
                  Copia <code style="background:rgba(255,255,255,.07);padding:2px 7px;border-radius:4px">env.example.js</code>
                  → <code style="background:rgba(255,255,255,.07);padding:2px 7px;border-radius:4px">env.js</code>
                  y pega tus credenciales de Supabase.
                </p>
              </div>`;
          }
        }, { once: true });
      }
      return null;
    })();
