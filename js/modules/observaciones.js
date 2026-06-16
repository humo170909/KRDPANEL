// ================================================================
// modules/observaciones.js — KRD Importaciones
// Envío y visualización de observaciones de mercadería.
// Notifica automáticamente al administrador por WhatsApp.
// ================================================================

import { getSession, isAdmin }   from "../core/session.js";
import { sanitize, mostrarToast }  from "../utils/helpers.js";
import { mostrarConfirm, mostrarObsConfirm, mostrarEliminarObsModal } from "../ui/modals.js";
import {
  getObservaciones, getCountObsPendientes,
  insertarObservacion, marcarObservacionLeida,
  marcarTodasObservacionesLeidas, eliminarObservacionById,
} from "../services/observaciones.service.js";
import { audit }           from "../services/auditoria.service.js";
import { notificarLaboral } from "../services/notificaciones.service.js";
import {
  setObservacionesFull, aplicarFiltrosObs, renderBodyObservaciones,
} from "../ui/filters.js";

// Rate limiting: máximo 1 observación por minuto por sesión de pestaña
const OBS_COOLDOWN_MS = 60 * 1000;
let _lastObsTs = 0;

// ── Badge de observaciones pendientes ──

export async function actualizarBadgeObs() {
  if (!isAdmin()) return;
  const count  = await getCountObsPendientes();
  const badge  = document.getElementById("obsBadge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// ── Render tabla de observaciones ──

export async function renderObservaciones() {
  const lista = await getObservaciones();
  setObservacionesFull(lista);
  aplicarFiltrosObs();
  if (isAdmin()) await actualizarBadgeObs();
}

// ── Marcar como leída ──

export async function marcarObsLeida(id) {
  if (!isAdmin()) return;
  const { error } = await marcarObservacionLeida(id);
  if (error) { console.error(error); mostrarToast("Error al marcar como leída.", "error"); return; }
  await renderObservaciones();
  mostrarToast("Observación marcada como leída.", "success");
}

// ── Eliminar observación ──

export async function eliminarObservacion(id) {
  if (!isAdmin()) return;
  if (!(await mostrarEliminarObsModal())) return;
  const { error } = await eliminarObservacionById(id);
  if (error) { console.error(error); mostrarToast("Error al eliminar la observación.", "error"); return; }
  await audit("delete", `Observación eliminada: ID ${id}`);
  await renderObservaciones();
  mostrarToast("Observación eliminada.", "info");
}

// ── Inicializar eventos ──

export function initObservaciones() {
  // Contador de caracteres
  document.getElementById("obsTexto")?.addEventListener("input", function () {
    const len   = this.value.length;
    const count = document.getElementById("obsCharCount");
    count.textContent = `${len} / 1000`;
    count.className   = "obs-count" + (len > 900 ? " obs-count--limit" : len > 700 ? " obs-count--warn" : "");
  });

  // Formulario enviar
  document.getElementById("formObservacion")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    const s        = getSession();
    const textarea = document.getElementById("obsTexto");
    const errEl    = document.getElementById("err-obs");
    const btn      = document.getElementById("btnEnviarObs");

    errEl.textContent = "";
    textarea.classList.remove("input-error");
    const texto = textarea.value.trim();

    if (!texto || texto.length < 5)    { errEl.textContent = "El mensaje debe tener al menos 5 caracteres."; textarea.classList.add("input-error"); return; }
    if (texto.length > 1000)           { errEl.textContent = "El mensaje no puede superar los 1000 caracteres."; textarea.classList.add("input-error"); return; }

    // Rate limiting: prevenir spam de observaciones
    const ahora = Date.now();
    if (ahora - _lastObsTs < OBS_COOLDOWN_MS) {
      const segs = Math.ceil((OBS_COOLDOWN_MS - (ahora - _lastObsTs)) / 1000);
      errEl.textContent = `Espera ${segs} segundo${segs !== 1 ? "s" : ""} antes de enviar otra observación.`;
      textarea.classList.add("input-error");
      return;
    }

    btn.disabled  = true;
    btn.innerHTML = `<span class="obs-sending-spinner"></span> Enviando...`;

    try {
      const ahora = new Date().toISOString();
      const obs   = {
        fecha: ahora, fecha_registro: ahora,
        usuario: s.username, username: s.username,
        colaborador: s.display, user_email: s.email,
        rol: s.role, asunto: "Observación de mercadería",
        detalle: texto, mensaje: texto,
        leida_admin: false, notificado_whatsapp: false,
        notificado_en: null, ip_origen: null, mes_asist_id: null,
      };
      const { error } = await insertarObservacion(obs);
      if (error) throw error;
      _lastObsTs = Date.now(); // registrar timestamp tras insert exitoso

      const fechaLeg = new Date().toLocaleString("es-PE");
      await notificarLaboral(`📦 *KRD Importaciones - Nueva Observación*\n\n👤 Colaborador: ${s.display}\n📅 Fecha: ${fechaLeg}\n\n💬 Mensaje:\n${texto}`);
      await audit("add", `Observación enviada por: ${s.display}`);

      textarea.value = "";
      document.getElementById("obsCharCount").textContent = "0 / 1000";
      document.getElementById("obsCharCount").className   = "obs-count";
      await mostrarObsConfirm(texto, s.display);
      await renderObservaciones();
    } catch (err) {
      console.error("Error al enviar observación:", err);
      mostrarToast("Error al enviar la observación. Intenta de nuevo.", "error");
    } finally {
      btn.disabled  = false;
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar Observación`;
    }
  });

  // Marcar todas como leídas
  document.getElementById("btnMarcarTodasLeidas")?.addEventListener("click", async () => {
    if (!isAdmin()) return;
    if (!(await mostrarConfirm("¿Marcar todas como leídas?", "Se marcarán todas las observaciones pendientes como leídas.", "Confirmar"))) return;
    const { error } = await marcarTodasObservacionesLeidas();
    if (error) { console.error(error); mostrarToast("Error al actualizar.", "error"); return; }
    await renderObservaciones();
    mostrarToast("✓ Todas las observaciones marcadas como leídas.", "success");
  });
}
