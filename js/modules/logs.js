// ================================================================
// modules/logs.js — KRD Importaciones
// Dashboard de Logs de Seguridad (solo admin).
// ================================================================

import { isAdmin }                          from "../core/session.js";
import { sanitize, mostrarToast }           from "../utils/helpers.js";
import { getLogs, limpiarLogsAntiguos }     from "../services/logs.service.js";
import { mostrarConfirm }                   from "../ui/modals.js";
import { audit }                            from "../services/auditoria.service.js";

const NIVEL = {
  info:     { color: "#4da6ff", bg: "rgba(77,166,255,0.12)",   emoji: "ℹ️" },
  warning:  { color: "#f59e0b", bg: "rgba(245,158,11,0.15)",   emoji: "⚠️" },
  critical: { color: "#f05a6e", bg: "rgba(240,90,110,0.12)",   emoji: "🚨" },
};

let _cache      = [];
let _filtroNivel = "";
let _filtroTipo  = "";

// ── Dashboard ─────────────────────────────────────────────────────

export async function renderLogs() {
  if (!isAdmin()) return;
  const lista = await getLogs({ nivel: _filtroNivel || undefined, tipo: _filtroTipo || undefined });
  _cache = lista;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("logs-count-total",    lista.length);
  set("logs-count-info",     lista.filter((l) => l.nivel === "info").length);
  set("logs-count-warning",  lista.filter((l) => l.nivel === "warning").length);
  set("logs-count-critical", lista.filter((l) => l.nivel === "critical").length);

  _renderTabla(lista);
}

function _renderTabla(lista) {
  const tbody = document.getElementById("bodyLogs");
  const empty = document.getElementById("emptyLogs");
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  tbody.innerHTML = lista.slice(0, 500).map((l) => {
    const n = NIVEL[l.nivel] || NIVEL.info;
    const fecha = l.fecha
      ? new Date(l.fecha).toLocaleString("es-PE", {
          day: "2-digit", month: "2-digit", year: "2-digit",
          hour: "2-digit", minute: "2-digit",
        })
      : "—";
    return `<tr>
      <td style="font-size:0.73rem;color:var(--text-muted);white-space:nowrap">${fecha}</td>
      <td>
        <span style="background:${n.bg};color:${n.color};padding:2px 8px;border-radius:999px;font-size:0.71rem;font-weight:700;white-space:nowrap">
          ${n.emoji} ${(l.nivel || "info").toUpperCase()}
        </span>
      </td>
      <td style="font-size:0.76rem;color:var(--text-secondary)">${sanitize(l.tipo || "—")}</td>
      <td style="font-size:0.78rem;font-weight:600">${sanitize(l.usuario || "—")}</td>
      <td style="font-size:0.72rem;font-family:monospace;color:var(--text-muted)">${sanitize(l.ip || "—")}</td>
      <td style="font-size:0.76rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${sanitize(l.detalle || "")}">${sanitize(l.detalle || "—")}</td>
      <td style="font-size:0.72rem;color:var(--text-muted)">${sanitize(l.dispositivo || "—")}</td>
    </tr>`;
  }).join("");
}

// ── Init ──────────────────────────────────────────────────────────

export function initLogs() {
  if (!isAdmin()) return;

  document.getElementById("logsFiltroNivel")?.addEventListener("change", async (e) => {
    _filtroNivel = e.target.value;
    await renderLogs();
  });

  document.getElementById("logsFiltroTipo")?.addEventListener("change", async (e) => {
    _filtroTipo = e.target.value;
    await renderLogs();
  });

  document.getElementById("btnLimpiarLogs")?.addEventListener("click", async () => {
    if (!isAdmin()) return;
    if (!(await mostrarConfirm(
      "¿Limpiar logs antiguos?",
      "Se eliminarán todos los logs de más de 90 días. Esta acción no se puede deshacer.",
      "Limpiar"
    ))) return;
    const { error } = await limpiarLogsAntiguos(90);
    if (error) { mostrarToast("Error al limpiar logs.", "error"); return; }
    await audit("delete", "Logs de seguridad limpiados (registros > 90 días)");
    mostrarToast("✓ Logs antiguos eliminados.", "success");
    await renderLogs();
  });
}
