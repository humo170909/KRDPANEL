// ================================================================
// utils/helpers.js — KRD Importaciones
// Funciones puras de utilidad: fecha, formato, validación, UI.
// Sin efectos secundarios externos; todas son exportables y testeables.
// ================================================================

// ── Fecha y hora ──

export function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getNowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

// ── Sanitización XSS ──
// Convierte caracteres HTML especiales en entidades seguras.
// SIEMPRE usar antes de insertar texto de usuario en innerHTML.
export function sanitize(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// ── Formato moneda Soles ──
export function fmt(n) {
  return "S/ " + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// ── Formato porcentaje ──
export function fmtPct(v, t) {
  if (!t || t === 0) return "0%";
  return ((v / t) * 100).toFixed(1) + "%";
}

// ── ID único (crypto-safe) ──
export function uid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ── Cálculo de horas trabajadas ──
export function calcHoras(entrada, salida) {
  if (!entrada || !salida) return "—";
  const [hE, mE] = entrada.split(":").map(Number);
  const [hS, mS] = salida.split(":").map(Number);
  let min = hS * 60 + mS - (hE * 60 + mE);
  if (min < 0) min += 1440; // turno nocturno
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m`;
}

// ── Estado de asistencia según hora de entrada ──
// Límite: 10:20 AM. Antes o igual → "Asistencia", después → "Tardanza"
export function getEstadoAsistencia(horaEntrada) {
  if (!horaEntrada) return "";
  const [hh, mm] = horaEntrada.split(":").map(Number);
  const totalMin  = hh * 60 + mm;
  const limiteMin = 10 * 60 + 20;
  return totalMin <= limiteMin ? "Asistencia" : "Tardanza";
}

// ── Manejo de errores en formularios ──
export function setError(idMsg, input, msg) {
  const el = document.getElementById(idMsg);
  if (el) el.textContent = msg;
  if (input) input.classList.add("input-error");
}

export function clearErrors(ids, inputs = []) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
  inputs.forEach((i) => i && i.classList.remove("input-error"));
}

// ── Toast de notificación ──
export function mostrarToast(msg, tipo = "success") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show toast-${tipo}`;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 3500);
}

// ── Reloj Perú (UTC-5) ──
let _clockInterval = null;

export function iniciarRelojPeru() {
  if (_clockInterval) clearInterval(_clockInterval);
  function tick() {
    const ahora  = new Date();
    const utcMs  = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
    const peruMs = utcMs - 5 * 3600000;
    const peru   = new Date(peruMs);
    const hh = String(peru.getHours()).padStart(2, "0");
    const mm = String(peru.getMinutes()).padStart(2, "0");
    const ss = String(peru.getSeconds()).padStart(2, "0");
    const el = document.getElementById("headerClock");
    if (el) el.textContent = `🕐 ${hh}:${mm}:${ss} (PE)`;
  }
  tick();
  _clockInterval = setInterval(tick, 1000);
}
