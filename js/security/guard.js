// ================================================================
// security/guard.js — KRD Importaciones
//
// Guard de sesión activa.
// Verifica periódicamente en Supabase que el usuario sigue activo.
// Si el administrador desactiva la cuenta mientras el usuario está
// conectado, el guard detecta el cambio en ≤ INTERVAL_MS segundos
// y lo expulsa automáticamente — sin importar lo que haya en
// localStorage o sessionStorage.
//
// Flujo:
//   iniciarGuard(onExpulsar) → tick cada 60 s → consulta perfiles
//   → activo === false  → clearSession + onExpulsar(nombre)
//   → activo === true   → no hace nada, continúa
//   → error de red      → silencioso, reintenta en el siguiente tick
// ================================================================

import { supabaseClient }      from "../core/config.js";
import { getSession, clearSession } from "../core/session.js";
import { logAsync }            from "../services/logs.service.js";

// ── Constantes ────────────────────────────────────────────────────

const INTERVAL_MS = 60_000; // verificar cada 60 segundos

// ── Estado interno ────────────────────────────────────────────────

let _timer      = null;
let _expulsarCb = null;
let _ocupado    = false; // evita solapamiento de requests simultáneos
let _activo     = false; // indica si el guard está corriendo

// ── API pública ───────────────────────────────────────────────────

/**
 * Inicia el guard de sesión.
 * @param {Function} onExpulsar  Callback llamado cuando la cuenta
 *                               es desactivada. Recibe (nombreMostrado).
 */
export function iniciarGuard(onExpulsar) {
  if (_activo) detenerGuard();

  _expulsarCb = onExpulsar;
  _activo     = true;

  const tick = async () => {
    if (_ocupado) return;
    const session = getSession();
    if (!session) { detenerGuard(); return; }
    _ocupado = true;
    try {
      await _verificarEstado(session);
    } finally {
      _ocupado = false;
    }
  };

  // Verificación inmediata + periódica
  tick();
  _timer = setInterval(tick, INTERVAL_MS);
}

/**
 * Detiene el guard limpiamente (p.ej. al hacer logout voluntario).
 */
export function detenerGuard() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  _expulsarCb = null;
  _activo     = false;
  _ocupado    = false;
}

/**
 * Fuerza una verificación inmediata fuera del ciclo regular.
 * Útil para llamar justo después de que el admin cambia el estado.
 */
export async function verificarAhora() {
  const session = getSession();
  if (!session || _ocupado) return;
  _ocupado = true;
  try {
    await _verificarEstado(session);
  } finally {
    _ocupado = false;
  }
}

// ── Verificación interna ──────────────────────────────────────────

async function _verificarEstado(session) {
  try {
    const { data, error } = await supabaseClient
      .from("perfiles")
      .select("activo")
      .eq("username", session.username)
      .maybeSingle();

    // Error de Supabase / red → silencioso, no expulsar
    if (error) return;

    // Cuenta inexistente o marcada como inactiva → expulsar
    if (!data || data.activo === false) {
      _expulsar(session);
    }
  } catch {
    // Silencioso: un error de red no debe expulsar al usuario
  }
}

async function _expulsar(session) {
  // 1. Limpiar sesión local inmediatamente
  clearSession();

  // 2. Detener el guard para que no dispare más veces
  const cb = _expulsarCb;
  detenerGuard();

  // 3. Registrar el evento de seguridad (best-effort)
  logAsync(
    "sesion_expulsada",
    "warning",
    `Expulsión automática por cuenta desactivada: ${session.username}`
  ).catch(() => {});

  // 4. Notificar al orquestador (main.js) para mostrar UI
  if (cb) cb(session.display || session.username);
}
