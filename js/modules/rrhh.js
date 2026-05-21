// ================================================================
// modules/rrhh.js — KRD Importaciones
// Panel RRHH: vacaciones, permisos, licencias, tardanzas,
// sanciones, horas extra, justificaciones.
// CRUD + aprobaciones + historial por colaborador.
// ================================================================

import { isAdmin, getSession }                      from "../core/session.js";
import { sanitize, mostrarToast, uid, getTodayStr } from "../utils/helpers.js";
import { mostrarConfirm }                           from "../ui/modals.js";
import {
  getEventosRRHH, crearEvento, actualizarEvento,
  eliminarEvento, getResumenMensual,
}                                                   from "../services/rrhh.service.js";
import { getUsuarios }                              from "../services/usuarios.service.js";
import { audit }                                    from "../services/auditoria.service.js";
import { logAsync }                                 from "../services/logs.service.js";
import {
  getSucursales, crearSucursal, actualizarSucursal, eliminarSucursal,
}                                                   from "../services/sucursales.service.js";
import { notificarLaboral }                          from "../services/notificaciones.service.js";

// ── Catálogos ────────────────────────────────────────────────────

const TIPOS = {
  vacacion:      { label: "Vacación",      emoji: "🏖️", color: "#4da6ff" },
  permiso:       { label: "Permiso",       emoji: "📋", color: "#a48dff" },
  licencia:      { label: "Licencia",      emoji: "🏥", color: "#f59e0b" },
  tardanza:      { label: "Tardanza",      emoji: "⏰", color: "#f05a6e" },
  sancion:       { label: "Sanción",       emoji: "⚠️", color: "#ef4444" },
  horas_extra:   { label: "Horas Extra",   emoji: "⚡", color: "#4ecb8d" },
  justificacion: { label: "Justificación", emoji: "📝", color: "#8b949e" },
};

const ESTADOS = {
  pendiente:  { label: "Pendiente",  color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  aprobado:   { label: "Aprobado",   color: "#4ecb8d", bg: "rgba(78,203,141,0.15)" },
  rechazado:  { label: "Rechazado",  color: "#f05a6e", bg: "rgba(240,90,110,0.12)" },
  anulado:    { label: "Anulado",    color: "#8b949e", bg: "rgba(139,148,158,0.12)" },
};

// ── Estado local ─────────────────────────────────────────────────

let _cache       = [];
let _filtroTipo  = "";
let _filtroEst   = "";
let _filtroColab = "";

// ── Dashboard ────────────────────────────────────────────────────

export async function renderRRHH() {
  const hoy    = new Date();
  const lista  = await getEventosRRHH();
  const resumen = await getResumenMensual(hoy.getFullYear(), hoy.getMonth() + 1);
  _cache = lista;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("rrhh-count-vacacion",    resumen.vacacion    || 0);
  set("rrhh-count-permiso",     resumen.permiso     || 0);
  set("rrhh-count-tardanza",    resumen.tardanza    || 0);
  set("rrhh-count-hextra",      resumen.horas_extra || 0);
  set("rrhh-count-pendientes",  lista.filter((e) => e.estado === "pendiente").length);
  set("rrhh-count-sanciones",   lista.filter((e) => e.tipo === "sancion").length);

  _renderTabla(lista);
}

function _renderTabla(lista) {
  const tbody = document.getElementById("bodyRRHH");
  const empty = document.getElementById("emptyRRHH");
  if (!tbody) return;

  let filtrada = lista;
  if (_filtroTipo)  filtrada = filtrada.filter((e) => e.tipo === _filtroTipo);
  if (_filtroEst)   filtrada = filtrada.filter((e) => e.estado === _filtroEst);
  if (_filtroColab) filtrada = filtrada.filter((e) =>
    (e.colaborador || "").toLowerCase().includes(_filtroColab.toLowerCase()));

  if (!filtrada.length) {
    tbody.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  tbody.innerHTML = filtrada.map((e, i) => {
    const t = TIPOS[e.tipo]    || { label: e.tipo,    emoji: "📌", color: "#8b949e" };
    const s = ESTADOS[e.estado] || { label: e.estado, color: "#8b949e", bg: "rgba(139,148,158,0.12)" };
    const rango = e.fecha_fin && e.fecha_fin !== e.fecha_inicio
      ? `${e.fecha_inicio} → ${e.fecha_fin} (${_dias(e.fecha_inicio, e.fecha_fin)} d.)`
      : e.horas ? `${e.fecha_inicio} (${e.horas}h)` : e.fecha_inicio;

    const btnAprobar = isAdmin() && e.estado === "pendiente"
      ? `<button class="btn btn-sm rrhh-btn-ok" data-action="aprobarEvento" data-id="${e.id}">✓ Aprobar</button>
         <button class="btn btn-sm rrhh-btn-no" data-action="rechazarEvento" data-id="${e.id}">✕ Rechazar</button>`
      : "";
    const btnEliminar = isAdmin()
      ? `<button class="btn btn-sm btn-danger" data-action="eliminarEvento" data-id="${e.id}" style="font-size:0.7rem;padding:3px 8px">🗑️</button>`
      : "";

    return `<tr>
      <td style="color:var(--text-muted)">${i + 1}</td>
      <td>
        <span class="rrhh-tipo-badge" style="background:${_dim(t.color)};color:${t.color}">
          ${t.emoji} ${t.label}
        </span>
      </td>
      <td style="font-weight:600">${sanitize(e.colaborador)}</td>
      <td style="font-size:0.78rem;color:var(--text-secondary)">${sanitize(rango)}</td>
      <td style="font-size:0.78rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
          title="${sanitize(e.descripcion || "")}">${sanitize(e.descripcion || "—")}</td>
      <td>
        <span style="background:${s.bg};color:${s.color};padding:2px 9px;border-radius:999px;font-size:0.71rem;font-weight:600">${s.label}</span>
      </td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
          ${btnAprobar}
          <button class="btn btn-sm btn-ghost" data-action="editarEvento" data-id="${e.id}"
            style="font-size:0.7rem;padding:3px 8px">✏️ Editar</button>
          ${btnEliminar}
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ── Modal crear / editar ──────────────────────────────────────────

export async function abrirModalRRHH(eventoId = null) {
  const overlay = document.getElementById("modalRRHHOverlay");
  if (!overlay) return;

  const usuarios = await getUsuarios();
  const sel = document.getElementById("rrhhColaborador");
  if (sel) {
    sel.innerHTML = `<option value="">— Selecciona colaborador —</option>` +
      usuarios.map((u) => {
        const n = sanitize(u.display_name || u.nombre || u.username || "");
        return `<option value="${n}">${n}</option>`;
      }).join("");
  }

  const ev = eventoId ? _cache.find((e) => e.id === eventoId) : null;
  document.getElementById("rrhhModalTitle").textContent = ev ? "✏️ Editar evento RRHH" : "➕ Nuevo evento RRHH";
  document.getElementById("rrhhEventoId").value    = ev?.id           || "";
  if (sel && ev?.colaborador) sel.value            = ev.colaborador;
  document.getElementById("rrhhTipo").value        = ev?.tipo         || "vacacion";
  document.getElementById("rrhhFechaInicio").value = ev?.fecha_inicio || getTodayStr();
  document.getElementById("rrhhFechaFin").value    = ev?.fecha_fin    || "";
  document.getElementById("rrhhHoras").value       = ev?.horas        || "";
  document.getElementById("rrhhDescripcion").value = ev?.descripcion  || "";
  document.getElementById("rrhhEstado").value      = ev?.estado       || "pendiente";
  document.getElementById("rrhhNotas").value       = ev?.notas        || "";

  // El select de estado solo es editable por admin
  const estadoSel = document.getElementById("rrhhEstado");
  if (estadoSel) estadoSel.disabled = !isAdmin();

  _limpiarErrores();
  _toggleCampos(document.getElementById("rrhhTipo").value);
  overlay.classList.add("active");
  setTimeout(() => document.getElementById("rrhhColaborador")?.focus(), 80);
}

// ── Guardar ───────────────────────────────────────────────────────

async function _guardar() {
  const id          = document.getElementById("rrhhEventoId").value.trim();
  const colaborador = document.getElementById("rrhhColaborador").value.trim();
  const tipo        = document.getElementById("rrhhTipo").value;
  const fechaInicio = document.getElementById("rrhhFechaInicio").value;
  const fechaFin    = document.getElementById("rrhhFechaFin").value || null;
  const horas       = parseFloat(document.getElementById("rrhhHoras").value) || null;
  const descripcion = document.getElementById("rrhhDescripcion").value.trim() || null;
  const estado      = document.getElementById("rrhhEstado").value;
  const notas       = document.getElementById("rrhhNotas").value.trim() || null;
  const session     = getSession();

  _limpiarErrores();
  let ok = true;
  if (!colaborador) {
    document.getElementById("err-rrhh-colab").textContent = "Selecciona un colaborador.";
    ok = false;
  }
  if (!fechaInicio) {
    document.getElementById("err-rrhh-fecha").textContent = "La fecha es obligatoria.";
    ok = false;
  }
  if (tipo === "horas_extra" && (!horas || horas <= 0)) {
    document.getElementById("err-rrhh-horas").textContent = "Ingresa las horas extra.";
    ok = false;
  }
  if (!ok) return;

  const payload = {
    colaborador,
    tipo,
    fecha_inicio: fechaInicio,
    fecha_fin:    tipo === "horas_extra" || tipo === "tardanza" ? null : (fechaFin || null),
    horas:        tipo === "horas_extra" ? horas : null,
    descripcion,
    estado,
    notas,
    creado_por:   session?.username || "—",
  };

  try {
    if (id) {
      const { error } = await actualizarEvento(id, payload);
      if (error) throw error;
      await audit("edit", `RRHH editado: ${tipo} — ${colaborador}`);
      mostrarToast(`✓ Evento RRHH actualizado.`, "success");
    } else {
      const { error } = await crearEvento({ ...payload, id: uid() });
      if (error) throw error;
      await audit("add", `RRHH creado: ${tipo} — ${colaborador}`);
      logAsync("rrhh_nuevo", "info", `${tipo} registrado para ${colaborador}`);

      // Notificar si es sanción o tardanza
      if (tipo === "sancion" || tipo === "tardanza") {
        const msg = `⚠️ KRD RRHH: ${TIPOS[tipo]?.label} registrada para ${colaborador}. ${descripcion || ""}`;
        notificarLaboral(msg);
      }
      mostrarToast(`✓ Evento RRHH registrado.`, "success");
    }
    document.getElementById("modalRRHHOverlay").classList.remove("active");
    await renderRRHH();
  } catch (err) {
    console.error(err);
    mostrarToast("Error al guardar el evento RRHH.", "error");
  }
}

// ── Aprobar / Rechazar ────────────────────────────────────────────

async function _aprobar(id) {
  if (!isAdmin()) return;
  const ev = _cache.find((e) => e.id === id);
  const session = getSession();
  const { error } = await actualizarEvento(id, { estado: "aprobado", aprobado_por: session?.username || "admin" });
  if (error) { mostrarToast("Error al aprobar.", "error"); return; }
  await audit("edit", `RRHH aprobado: ${ev?.tipo || ""} — ${ev?.colaborador || id}`);
  logAsync("rrhh_aprobado", "info", `${ev?.tipo} aprobado para ${ev?.colaborador}`);
  mostrarToast("✓ Evento aprobado.", "success");
  await renderRRHH();
}

async function _rechazar(id) {
  if (!isAdmin()) return;
  const ev = _cache.find((e) => e.id === id);
  if (!(await mostrarConfirm("¿Rechazar este evento?", "El evento quedará como rechazado.", "Rechazar"))) return;
  const { error } = await actualizarEvento(id, { estado: "rechazado" });
  if (error) { mostrarToast("Error al rechazar.", "error"); return; }
  await audit("edit", `RRHH rechazado: ${ev?.tipo || ""} — ${ev?.colaborador || id}`);
  logAsync("rrhh_rechazado", "warning", `${ev?.tipo} rechazado para ${ev?.colaborador}`);
  mostrarToast("✓ Evento rechazado.", "success");
  await renderRRHH();
}

async function _eliminar(id) {
  if (!isAdmin()) return;
  const ev = _cache.find((e) => e.id === id);
  if (!(await mostrarConfirm("¿Eliminar este registro RRHH?", "Esta acción no se puede deshacer.", "Eliminar"))) return;
  const { error } = await eliminarEvento(id);
  if (error) { mostrarToast("Error al eliminar.", "error"); return; }
  await audit("delete", `RRHH eliminado: ${ev?.tipo || ""} — ${ev?.colaborador || id}`);
  mostrarToast("✓ Registro eliminado.", "success");
  await renderRRHH();
}

// ── Sucursales (gestión de sedes para geolocalización) ────────────

export async function renderSucursales() {
  if (!isAdmin()) return;
  const lista  = document.getElementById("bodySucursales");
  const empty  = document.getElementById("emptySucursales");
  if (!lista) return;
  const sedes = await getSucursales(false);
  if (!sedes.length) { lista.innerHTML = ""; if (empty) empty.classList.remove("hidden"); return; }
  if (empty) empty.classList.add("hidden");
  lista.innerHTML = sedes.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:600">${sanitize(s.nombre)}</td>
      <td style="font-size:0.78rem;color:var(--text-secondary)">${sanitize(s.direccion || "—")}</td>
      <td style="font-family:monospace;font-size:0.75rem">${s.lat?.toFixed(6) || "—"}, ${s.lng?.toFixed(6) || "—"}</td>
      <td>${s.radio_metros || 200} m</td>
      <td>
        <span style="background:${s.activa ? "rgba(78,203,141,0.15)" : "rgba(240,90,110,0.12)"};
          color:${s.activa ? "#4ecb8d" : "#f05a6e"};padding:2px 8px;border-radius:999px;font-size:0.72rem">
          ${s.activa ? "● Activa" : "○ Inactiva"}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm btn-ghost" data-action="editarSucursal" data-id="${s.id}" style="font-size:0.7rem;padding:3px 8px">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" data-action="eliminarSucursal" data-id="${s.id}" style="font-size:0.7rem;padding:3px 8px">🗑️</button>
        </div>
      </td>
    </tr>`).join("");
}

let _sucursalesCache = [];

async function _abrirModalSucursal(sucursalId = null) {
  const overlay = document.getElementById("modalSucursalOverlay");
  if (!overlay) return;
  _sucursalesCache = await getSucursales(false);
  const s = sucursalId ? _sucursalesCache.find((x) => x.id === sucursalId) : null;
  document.getElementById("sucursalModalTitle").textContent = s ? "✏️ Editar sucursal" : "➕ Nueva sucursal";
  document.getElementById("sucursalId").value      = s?.id          || "";
  document.getElementById("sucursalNombre").value  = s?.nombre      || "";
  document.getElementById("sucursalDir").value     = s?.direccion   || "";
  document.getElementById("sucursalLat").value     = s?.lat         || "";
  document.getElementById("sucursalLng").value     = s?.lng         || "";
  document.getElementById("sucursalRadio").value   = s?.radio_metros || 200;
  document.getElementById("sucursalActiva").checked = s?.activa !== false;
  overlay.classList.add("active");
  setTimeout(() => document.getElementById("sucursalNombre")?.focus(), 80);
}

async function _guardarSucursal() {
  const id     = document.getElementById("sucursalId").value.trim();
  const nombre = document.getElementById("sucursalNombre").value.trim();
  const dir    = document.getElementById("sucursalDir").value.trim();
  const lat    = parseFloat(document.getElementById("sucursalLat").value);
  const lng    = parseFloat(document.getElementById("sucursalLng").value);
  const radio  = parseInt(document.getElementById("sucursalRadio").value) || 200;
  const activa = document.getElementById("sucursalActiva").checked;

  if (!nombre)        { mostrarToast("El nombre es obligatorio.", "error"); return; }
  if (isNaN(lat) || isNaN(lng)) { mostrarToast("Ingresa coordenadas válidas.", "error"); return; }

  const payload = { nombre, direccion: dir || null, lat, lng, radio_metros: radio, activa };
  try {
    if (id) {
      const { error } = await actualizarSucursal(id, payload);
      if (error) throw error;
      await audit("edit", `Sucursal editada: ${nombre}`);
      mostrarToast("✓ Sucursal actualizada.", "success");
    } else {
      const { error } = await crearSucursal({ ...payload, id: uid() });
      if (error) throw error;
      await audit("add", `Sucursal creada: ${nombre} (${lat},${lng}) r=${radio}m`);
      mostrarToast("✓ Sucursal registrada.", "success");
    }
    document.getElementById("modalSucursalOverlay").classList.remove("active");
    await renderSucursales();
  } catch (err) {
    console.error(err);
    mostrarToast("Error al guardar la sucursal.", "error");
  }
}

async function _eliminarSucursal(id) {
  if (!isAdmin()) return;
  if (!(await mostrarConfirm("¿Eliminar esta sucursal?", "Se eliminará de la validación de asistencia.", "Eliminar"))) return;
  const { error } = await eliminarSucursal(id);
  if (error) { mostrarToast("Error al eliminar.", "error"); return; }
  await audit("delete", `Sucursal eliminada: ID ${id}`);
  mostrarToast("✓ Sucursal eliminada.", "success");
  await renderSucursales();
}

// ── Init ──────────────────────────────────────────────────────────

export function initRRHH() {
  // Modal RRHH
  const overlay = document.getElementById("modalRRHHOverlay");
  if (overlay) {
    const cerrar = () => overlay.classList.remove("active");
    document.getElementById("rrhhModalCerrar")?.addEventListener("click", cerrar);
    document.getElementById("rrhhModalCancelar")?.addEventListener("click", cerrar);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
    document.getElementById("rrhhGuardar")?.addEventListener("click", _guardar);
  }

  // Botón nuevo evento
  document.getElementById("btnNuevoEventoRRHH")?.addEventListener("click", () => abrirModalRRHH());

  // Tipo cambia → toggle campos
  document.getElementById("rrhhTipo")?.addEventListener("change", (e) => _toggleCampos(e.target.value));

  // Filtros
  document.getElementById("rrhhFiltroTipo")?.addEventListener("change", (e) => {
    _filtroTipo = e.target.value; _renderTabla(_cache);
  });
  document.getElementById("rrhhFiltroEstado")?.addEventListener("change", (e) => {
    _filtroEst = e.target.value; _renderTabla(_cache);
  });
  document.getElementById("rrhhFiltroColab")?.addEventListener("input", (e) => {
    _filtroColab = e.target.value; _renderTabla(_cache);
  });

  // Delegación tabla RRHH
  document.getElementById("bodyRRHH")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "editarEvento")   abrirModalRRHH(id);
    if (action === "aprobarEvento")  _aprobar(id);
    if (action === "rechazarEvento") _rechazar(id);
    if (action === "eliminarEvento") _eliminar(id);
  });

  // Modal Sucursales
  const overlaySuc = document.getElementById("modalSucursalOverlay");
  if (overlaySuc) {
    const cerrarS = () => overlaySuc.classList.remove("active");
    document.getElementById("sucursalModalCerrar")?.addEventListener("click", cerrarS);
    document.getElementById("sucursalModalCancelar")?.addEventListener("click", cerrarS);
    overlaySuc.addEventListener("click", (e) => { if (e.target === overlaySuc) cerrarS(); });
    document.getElementById("sucursalGuardar")?.addEventListener("click", _guardarSucursal);
  }

  // Botón nueva sucursal
  document.getElementById("btnNuevaSucursal")?.addEventListener("click", () => _abrirModalSucursal());

  // Delegación tabla Sucursales
  document.getElementById("bodySucursales")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "editarSucursal")   _abrirModalSucursal(id);
    if (action === "eliminarSucursal") _eliminarSucursal(id);
  });
}

// ── Helpers ───────────────────────────────────────────────────────

function _limpiarErrores() {
  ["err-rrhh-colab", "err-rrhh-fecha", "err-rrhh-horas"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

function _toggleCampos(tipo) {
  const campoFin  = document.getElementById("rrhhCampoFechaFin");
  const campoHrs  = document.getElementById("rrhhCampoHoras");
  const sinFechaFin = tipo === "horas_extra" || tipo === "tardanza" || tipo === "justificacion";
  if (campoFin) campoFin.classList.toggle("hidden", sinFechaFin);
  if (campoHrs) campoHrs.classList.toggle("hidden", tipo !== "horas_extra");
}

function _dias(inicio, fin) {
  return Math.round((new Date(fin) - new Date(inicio)) / 86400000) + 1;
}

function _dim(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},0.13)`;
}
