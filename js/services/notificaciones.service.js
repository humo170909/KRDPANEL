// ================================================================
// services/notificaciones.service.js — KRD Importaciones
// Notificaciones vía WhatsApp (CallMeBot).
//
// ARQUITECTURA DE CANALES:
//   notificarLaboral()   → solo días laborales (L-S, nunca domingo)
//   notificarSeguridad() → siempre activo (7/7), para eventos críticos
//   notificar()          → canal directo sin filtro de día
//
// FUTURO: migración a Telegram se hará reemplazando enviarWhatsApp()
// por enviarTelegram() sin cambiar la lógica de negocio.
// ================================================================

import { WA_PHONE, WA_APIKEY } from "../core/config.js";

// ── Helpers de calendario ─────────────────────────────────────────

// Retorna true si hoy es día laboral (lunes=1 a sábado=6).
// Los DOMINGOS (0) no se envían alertas laborales.
function esDiaLaboral() {
  return new Date().getDay() !== 0;
}

// ── Envío base ────────────────────────────────────────────────────

export async function enviarWhatsApp(mensaje) {
  if (!WA_PHONE || !WA_APIKEY) {
    console.warn("[Notif] WA_PHONE o WA_APIKEY no configurados.");
    return false;
  }
  try {
    const texto = encodeURIComponent(mensaje);
    const url   = `https://api.callmebot.com/whatsapp.php?phone=${WA_PHONE}&text=${texto}&apikey=${WA_APIKEY}`;
    await fetch(url, { method: "GET", mode: "no-cors" });
    return true;
  } catch (err) {
    console.warn("[Notif] WhatsApp send error (non-critical):", err);
    return false;
  }
}

// ── Notificación laboral (BLOQUEADA los domingos) ─────────────────
// Usar para: tardanzas, faltas, permisos, RRHH, observaciones.

export async function notificarLaboral(mensaje) {
  if (!esDiaLaboral()) {
    // Domingo: suprimir silenciosamente sin error
    console.info("[Notif] Domingo — alerta laboral suprimida.");
    return false;
  }
  return enviarWhatsApp(mensaje);
}

// ── Notificación de seguridad (SIEMPRE activa, incluyendo domingos) ──
// Usar para: intentos fallidos, bloqueos, acceso sospechoso,
//            cambios de contraseña, modificaciones admin críticas.

export async function notificarSeguridad(mensaje) {
  return enviarWhatsApp(mensaje);
}

// ── Notificación directa (sin filtro de día) ──────────────────────
// Para casos donde el llamador ya decidió si enviar o no.

export async function notificar(mensaje) {
  return enviarWhatsApp(mensaje);
}

// ── Plantillas de mensaje ─────────────────────────────────────────

export function msgLoginFallido(usuario, ip) {
  return `⚠️ *KRD Seguridad — Intento fallido*\n👤 Usuario: ${usuario}\n🌐 IP: ${ip}\n📅 ${_fechaHoy()}`;
}

export function msgCuentaBloqueada(usuario, minutos, ip) {
  return `🚨 *KRD Seguridad — CUENTA BLOQUEADA*\n👤 Usuario: ${usuario}\n⏳ Bloqueado por ${minutos} min\n🌐 IP: ${ip}\n📅 ${_fechaHoy()}`;
}

// ── Helpers internos ──────────────────────────────────────────────

function _fechaHoy() {
  return new Date().toLocaleDateString("es-PE", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });
}
