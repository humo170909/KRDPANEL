// ================================================================
// core/session.js — KRD Importaciones
// Gestión completa de sesión y bloqueo por intentos fallidos.
// Toda lógica de estado de autenticación vive aquí.
// ================================================================

import {
  SK_SESSION,
  SK_LOGIN_FAILS,
  SK_LOGIN_BLOCK,
  MAX_LOGIN_TRIES,
  BLOCK_MS,
  SESSION_DURATION_MS,
  IDLE_TIMEOUT_MS,
  SK_LOGIN_BLOCK_COUNT,
  SK_SESSION_SIG,
} from "./config.js";

// ── Firma de integridad de sesión ──────────────────────────────
// Previene que un colaborador edite sessionStorage para cambiar su rol.
// No es criptografía real (el secreto está en el cliente), pero
// eleva significativamente la barrera frente a manipulación casual.

function _signSession(data) {
  const payload = `${data.uid}|${data.role}|${data._issuedAt}|krd-salt-2026`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (Math.imul(31, hash) + payload.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

function _verifySession(data) {
  if (!data || !data._sig) return false;
  return data._sig === _signSession(data);
}

// ── Bloqueo progresivo (localStorage persiste entre pestañas) ──

export function getLoginFails() {
  return parseInt(localStorage.getItem(SK_LOGIN_FAILS) || "0", 10) || 0;
}

export function incrementLoginFails() {
  const fails = getLoginFails() + 1;
  localStorage.setItem(SK_LOGIN_FAILS, String(fails));
  return fails;
}

export function resetLoginFails() {
  localStorage.removeItem(SK_LOGIN_FAILS);
  localStorage.removeItem(SK_LOGIN_BLOCK);
  localStorage.removeItem(SK_LOGIN_BLOCK_COUNT);
}

export function blockLogin() {
  // Lockout progresivo: cada bloqueo duplica la duración (máx 64 minutos)
  const blockCount = parseInt(localStorage.getItem(SK_LOGIN_BLOCK_COUNT) || "0", 10) + 1;
  const duration   = BLOCK_MS * Math.pow(2, Math.min(blockCount - 1, 5));
  localStorage.setItem(SK_LOGIN_BLOCK_COUNT, String(blockCount));
  localStorage.setItem(SK_LOGIN_BLOCK, String(Date.now() + duration));
  return duration;
}

export function getBlockSecondsLeft() {
  const blockedUntil = parseInt(localStorage.getItem(SK_LOGIN_BLOCK) || "0", 10);
  if (!blockedUntil || blockedUntil <= Date.now()) return 0;
  return Math.ceil((blockedUntil - Date.now()) / 1000);
}

export function isLoginBlocked() {
  const blockedUntil = parseInt(localStorage.getItem(SK_LOGIN_BLOCK) || "0", 10);
  if (!blockedUntil) return false;
  if (blockedUntil <= Date.now()) {
    resetLoginFails();
    return false;
  }
  return true;
}

// ── Sesión de usuario con expiración e integridad ──────────────

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SK_SESSION);
    if (!raw) return null;
    const s = JSON.parse(raw);

    // Verificar firma de integridad
    if (!_verifySession(s)) {
      sessionStorage.removeItem(SK_SESSION);
      return null;
    }

    // Verificar expiración absoluta (duración máxima de sesión)
    if (s._expiresAt && Date.now() > s._expiresAt) {
      sessionStorage.removeItem(SK_SESSION);
      return null;
    }

    // Verificar inactividad (idle timeout)
    if (s._lastActive && (Date.now() - s._lastActive) > IDLE_TIMEOUT_MS) {
      sessionStorage.removeItem(SK_SESSION);
      return null;
    }

    return s;
  } catch {
    return null;
  }
}

export function setSession(userData) {
  const now     = Date.now();
  const session = {
    ...userData,
    _issuedAt:  now,
    _expiresAt: now + SESSION_DURATION_MS,
    _lastActive: now,
  };
  session._sig = _signSession(session);
  sessionStorage.setItem(SK_SESSION, JSON.stringify(session));
}

// Actualiza el timestamp de última actividad para reiniciar el idle timer
export function touchSession() {
  try {
    const raw = sessionStorage.getItem(SK_SESSION);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!_verifySession(s)) return;
    s._lastActive = Date.now();
    // Recalcular firma tras actualizar _lastActive
    s._sig = _signSession(s);
    sessionStorage.setItem(SK_SESSION, JSON.stringify(s));
  } catch { /* silencioso */ }
}

export function clearSession() {
  sessionStorage.removeItem(SK_SESSION);
}

// ── Helpers de rol ────────────────────────────────────────────────
// Jerarquía: admin > rrhh > supervisor > colaborador

export function getRol() {
  return getSession()?.role || null;
}

export function isAdmin() {
  return getRol() === "admin";
}

// Admin + RRHH pueden acceder al panel RRHH
export function isRRHH() {
  const r = getRol();
  return r === "admin" || r === "rrhh";
}

// Admin + RRHH + supervisor pueden ver asistencia y reportes
export function isSupervisor() {
  const r = getRol();
  return r === "admin" || r === "rrhh" || r === "supervisor";
}

// Solo el rol colaborador puro (no los superiores)
export function isColab() {
  return getRol() === "colaborador";
}

// Verificación genérica multi-rol
export function hasRole(...roles) {
  return roles.includes(getRol());
}
