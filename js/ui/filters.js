// ================================================================
// ui/filters.js — KRD Importaciones
// Filtros de búsqueda para las tablas de asistencias y observaciones.
// Inyecta la UI de filtros y cachea los datos para filtrado local.
// Sin handlers inline (compatibilidad CSP strict).
// ================================================================

import { sanitize, getEstadoAsistencia, calcHoras } from "../utils/helpers.js";
import { isAdmin }                                   from "../core/session.js";

// ─── FILTROS DE ASISTENCIAS ───────────────────────────────────

let _asistenciasFull = [];
let _asistDelegationReady = false;
let _obsDelegationReady   = false;

export function setAsistenciasFull(lista) {
  _asistenciasFull = lista;
}

export function getAsistenciasFull() {
  return _asistenciasFull;
}

export function initFiltrosAsistencia() {
  const wrap = document.getElementById("filtrosAsistenciaWrap");
  if (!wrap) return;

  // Sin handlers inline: los event listeners se agregan con addEventListener
  wrap.innerHTML = `
    <div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;margin-bottom:0.85rem">
      <div style="position:relative;flex:1;min-width:160px">
        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none"
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="filtroAsistNombre" placeholder="Buscar por nombre..."
          style="width:100%;padding:7px 10px 7px 30px;background:var(--bg-input);border:1px solid var(--border);
            border-radius:var(--radius);color:var(--text-primary);font-size:0.82rem;font-family:var(--font-body);outline:none" />
      </div>
      <select id="filtroAsistEstado"
        style="padding:7px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);
          color:var(--text-primary);font-size:0.82rem;font-family:var(--font-body);outline:none;cursor:pointer">
        <option value="">Todos los estados</option>
        <option value="Asistencia">✓ Asistencia</option>
        <option value="Tardanza">⏰ Tardanza</option>
        <option value="Falta">✗ Falta</option>
        <option value="Justificado">📋 Justificado</option>
      </select>
      <button id="btnLimpiarFiltroAsist"
        style="padding:7px 12px;background:transparent;border:1px solid var(--border);border-radius:var(--radius);
          color:var(--text-secondary);font-size:0.78rem;cursor:pointer;font-family:var(--font-body)">
        ✕ Limpiar
      </button>
      <span id="filtroAsistCount" style="font-size:0.76rem;color:var(--text-muted);margin-left:auto"></span>
    </div>`;

  // Event listeners en lugar de handlers inline
  document.getElementById("filtroAsistNombre")?.addEventListener("input",  aplicarFiltrosAsistencia);
  document.getElementById("filtroAsistEstado")?.addEventListener("change", aplicarFiltrosAsistencia);
  document.getElementById("btnLimpiarFiltroAsist")?.addEventListener("click", limpiarFiltrosAsistencia);

  // Delegación para botones de acción en filas (se registra una sola vez)
  if (!_asistDelegationReady) {
    const tbody = document.getElementById("bodyAsistencia");
    if (tbody) {
      tbody.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const { action, id } = btn.dataset;
        if (action === "editarAsistencia") window._editarAsistencia?.(id);
        if (action === "delAsistencia")    window._delAsistencia?.(id);
      });
      _asistDelegationReady = true;
    }
  }
}

export function aplicarFiltrosAsistencia() {
  const nombre   = (document.getElementById("filtroAsistNombre")?.value || "").toLowerCase().trim();
  const estado   = document.getElementById("filtroAsistEstado")?.value || "";
  const filtrados = _asistenciasFull.filter((r) => {
    const matchNombre = !nombre || (r.nombre || "").toLowerCase().includes(nombre);
    const estadoReal  = r.estado || getEstadoAsistencia(r.entrada);
    const matchEstado = !estado || estadoReal === estado;
    return matchNombre && matchEstado;
  });
  renderBodyAsistencia(filtrados);
  const countEl = document.getElementById("filtroAsistCount");
  if (countEl) {
    countEl.textContent = (nombre || estado)
      ? `${filtrados.length} de ${_asistenciasFull.length} registros`
      : "";
  }
}

export function limpiarFiltrosAsistencia() {
  const inp = document.getElementById("filtroAsistNombre");
  const sel = document.getElementById("filtroAsistEstado");
  if (inp) inp.value = "";
  if (sel) sel.value = "";
  aplicarFiltrosAsistencia();
}

export function renderBodyAsistencia(lista) {
  const tbody = document.getElementById("bodyAsistencia");
  const empty = document.getElementById("emptyAsistencia");
  if (!lista.length) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  tbody.innerHTML = lista.map((r, i) => {
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    const estadoBadge = estado === "Tardanza"
      ? `<span style="background:#fee2e2;color:#ef4444;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600">⏰ Tardanza</span>`
      : estado === "Asistencia"
      ? `<span style="background:#d1fae5;color:#059669;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600">✓ Asistencia</span>`
      : estado === "Falta"
      ? `<span style="background:rgba(240,90,110,0.15);color:#f05a6e;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600">✗ Falta</span>`
      : estado === "Justificado"
      ? `<span style="background:rgba(77,166,255,0.15);color:#4da6ff;padding:2px 8px;border-radius:999px;font-size:0.72rem;font-weight:600">📋 Justificado</span>`
      : `<span style="color:var(--text-muted)">—</span>`;
    const just      = r.justificacion ? sanitize(r.justificacion) : "";
    const justShort = just ? (just.length > 50 ? `${just.slice(0, 50)}...` : just) : "—";

    // data-action en lugar de onclick (CSP-compliant)
    const acciones = isAdmin()
      ? `<div style="display:flex;gap:5px;align-items:center">
           <button class="btn-edit-asist" data-action="editarAsistencia" data-id="${r.id}" title="Editar registro">✎</button>
           <button class="btn-delete"     data-action="delAsistencia"    data-id="${r.id}" title="Eliminar">✕</button>
         </div>`
      : "";
    return `
    <tr>
      <td>${i + 1}</td>
      <td>${sanitize(r.nombre)}</td>
      <td class="val-mono" style="font-size:0.78rem;color:var(--text-muted)">${r.fecha || ""}</td>
      <td class="val-mono">${r.entrada}</td>
      <td class="val-mono">${r.salida || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="val-mono">${calcHoras(r.entrada, r.salida)}</td>
      <td>${estadoBadge}</td>
      <td title="${just}">${justShort}</td>
      <td><span class="reg-by">${sanitize(r.registrado_por || "—")}</span></td>
      <td>${acciones}</td>
    </tr>`;
  }).join("");
}

// ─── FILTROS DE OBSERVACIONES ─────────────────────────────────

let _observacionesFull = [];

export function setObservacionesFull(lista) {
  _observacionesFull = lista;
}

export function initFiltrosObservaciones() {
  const wrap = document.getElementById("filtrosObsWrap");
  if (!wrap) return;

  wrap.innerHTML = `
    <div style="display:flex;gap:0.6rem;align-items:center;flex-wrap:wrap;margin-bottom:0.85rem">
      <div style="position:relative;flex:1;min-width:160px">
        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none"
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="filtroObsColab" placeholder="Buscar por colaborador..."
          style="width:100%;padding:7px 10px 7px 30px;background:var(--bg-input);border:1px solid var(--border);
            border-radius:var(--radius);color:var(--text-primary);font-size:0.82rem;font-family:var(--font-body);outline:none" />
      </div>
      <input type="date" id="filtroObsFecha"
        style="padding:7px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);
          color:var(--text-primary);font-size:0.82rem;font-family:var(--font-body);outline:none;cursor:pointer" />
      <button id="btnLimpiarFiltroObs"
        style="padding:7px 12px;background:transparent;border:1px solid var(--border);border-radius:var(--radius);
          color:var(--text-secondary);font-size:0.78rem;cursor:pointer;font-family:var(--font-body)">
        ✕ Limpiar
      </button>
      <span id="filtroObsCount" style="font-size:0.76rem;color:var(--text-muted);margin-left:auto"></span>
    </div>`;

  document.getElementById("filtroObsColab")?.addEventListener("input",  aplicarFiltrosObs);
  document.getElementById("filtroObsFecha")?.addEventListener("change", aplicarFiltrosObs);
  document.getElementById("btnLimpiarFiltroObs")?.addEventListener("click", limpiarFiltrosObs);

  // Delegación para botones de observaciones
  if (!_obsDelegationReady) {
    const tbody = document.getElementById("bodyObservaciones");
    if (tbody) {
      tbody.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const { action, id } = btn.dataset;
        if (action === "marcarLeida")       window._marcarObsLeida?.(id);
        if (action === "eliminarObservacion") window._eliminarObservacion?.(id);
      });
      _obsDelegationReady = true;
    }
  }
}

export function aplicarFiltrosObs() {
  const colab   = (document.getElementById("filtroObsColab")?.value || "").toLowerCase().trim();
  const fecha   = document.getElementById("filtroObsFecha")?.value || "";
  const filtrados = _observacionesFull.filter((r) => {
    const matchColab = !colab || (r.nombre || r.colaborador || "").toLowerCase().includes(colab);
    const fechaReg   = (r.creado_en || r.fecha || "").slice(0, 10);
    const matchFecha = !fecha || fechaReg === fecha;
    return matchColab && matchFecha;
  });
  renderBodyObservaciones(filtrados);
  const countEl = document.getElementById("filtroObsCount");
  if (countEl) {
    countEl.textContent = (colab || fecha)
      ? `${filtrados.length} de ${_observacionesFull.length}`
      : "";
  }
}

export function limpiarFiltrosObs() {
  const inp  = document.getElementById("filtroObsColab");
  const inp2 = document.getElementById("filtroObsFecha");
  if (inp)  inp.value  = "";
  if (inp2) inp2.value = "";
  aplicarFiltrosObs();
}

export function renderBodyObservaciones(lista) {
  const tbody   = document.getElementById("bodyObservaciones");
  const empty   = document.getElementById("emptyObservaciones");
  const totalEl = document.getElementById("totalObservaciones");
  if (totalEl) totalEl.textContent = `${lista.length} observacion${lista.length !== 1 ? "es" : ""}`;
  if (!lista.length) {
    tbody.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");
  tbody.innerHTML = lista.map((obs, i) => {
    const fechaStr = obs.creado_en
      ? new Date(obs.creado_en).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : obs.fecha || "—";
    const leido = obs.leido || obs.leida_admin || obs.estado === "leido";
    const estadoBadge = leido
      ? `<span class="obs-status-badge obs-status-badge--leida">✓ Leída</span>`
      : `<span class="obs-status-badge obs-status-badge--nueva">● Nueva</span>`;
    const nombre = sanitize(obs.nombre || obs.colaborador || obs.usuario || "—");

    // data-action en lugar de onclick
    return `
      <tr class="${!leido ? "obs-row--nueva row-new" : ""}">
        <td>${i + 1}</td>
        <td class="val-mono" style="font-size:0.75rem;white-space:nowrap">${fechaStr}</td>
        ${isAdmin() ? `<td><span class="reg-by">${nombre}</span></td>` : ""}
        <td class="obs-msg-text">${sanitize(obs.texto || obs.mensaje || "")}</td>
        <td>${estadoBadge}</td>
        ${isAdmin() ? `
          <td style="display:flex;gap:6px;align-items:center">
            ${!leido ? `<button class="btn btn-sm btn-ghost" data-action="marcarLeida" data-id="${obs.id}" style="font-size:0.72rem">✓ Marcar leída</button>` : ""}
            <button class="btn-delete" data-action="eliminarObservacion" data-id="${obs.id}" style="margin-left:4px">✕</button>
          </td>` : ""}
      </tr>`;
  }).join("");
}
