// ================================================================
// modules/asistencia.js — KRD Importaciones
// Control completo de asistencias: vistas admin/colaborador,
// formularios, CRUD y gestión de meses.
// ================================================================

import { supabaseClient }                from "../core/config.js";
import { getSession, isAdmin }           from "../core/session.js";
import { sanitize, mostrarToast, getTodayStr,
         calcHoras, getEstadoAsistencia, uid,
         setError, clearErrors }          from "../utils/helpers.js";
import {
  mostrarConfirm, mostrarGuardar,
  mostrarColabHoraModal, mostrarJustificacionTardanzaModal, mostrarEstadoEntradaModal,
} from "../ui/modals.js";
import {
  setAsistenciasFull, aplicarFiltrosAsistencia, getAsistenciasFull,
} from "../ui/filters.js";
import {
  getMesesAsistencia, getAsistencias, getAsistenciasHoy,
  getRegistroColabHoy, insertarAsistencia, actualizarSalidaAsistencia,
  eliminarAsistencia, limpiarAsistenciasMes, crearMesAsistencia,
  actualizarRegistroAsistencia,
} from "../services/asistencia.service.js";
import { audit }           from "../services/auditoria.service.js";
import { notificarLaboral } from "../services/notificaciones.service.js";

// ── Selector de meses ──

export function getMesActivoAsistencia() {
  return document.getElementById("mesSelectorAsistencia")?.value;
}

export async function renderSelectMesesAsistencia() {
  const sel  = document.getElementById("mesSelectorAsistencia");
  const prev = sel.value;
  const meses = await getMesesAsistencia();
  sel.innerHTML = meses.length
    ? meses.map((m) => `<option value="${m.id}">${sanitize(m.nombre)}</option>`).join("")
    : '<option value="">— Sin meses —</option>';
  if (prev && meses.find((m) => m.id === prev)) sel.value = prev;
  else if (meses.length) sel.value = meses[meses.length - 1].id;
}

// ── Render tabla de asistencias ──

export async function renderAsistencia(callbacks = {}) {
  const mesId = getMesActivoAsistencia();
  const lista = await getAsistencias(mesId);

  const totalEl = document.getElementById("totalAsistencias");
  if (totalEl) totalEl.textContent = `${lista.length} registro${lista.length !== 1 ? "s" : ""} en este mes`;

  setAsistenciasFull(lista);
  aplicarFiltrosAsistencia();

  if (isAdmin()) {
    callbacks.onRender?.(lista);
  }
}

// ── Vista colaborador ──

export async function renderColabAsistencia() {
  if (isAdmin()) return;
  const s        = getSession();
  const mesId    = getMesActivoAsistencia();
  const statusEl = document.getElementById("colabAsistStatus");
  const btnEntrada = document.getElementById("btnColabEntrada");
  const btnSalida  = document.getElementById("btnColabSalida");
  const registro   = await getRegistroColabHoy(mesId);

  // ── Logs temporales de diagnóstico ──
  console.log("SESSION:", s);
  console.log("REGISTRO HOY:", registro);
  console.log("ENTRADA:", registro?.entrada);
  console.log("SALIDA:", registro?.salida);
  console.log("BTN ENTRADA (antes de render):", btnEntrada?.disabled);
  console.log("BTN SALIDA (antes de render):",  btnSalida?.disabled);

  const headerNombre = document.getElementById("colabHeaderNombre");
  const headerFecha  = document.getElementById("colabHeaderFecha");
  if (headerNombre) headerNombre.textContent = `Hola, ${s.display}`;
  if (headerFecha) headerFecha.textContent = new Date().toLocaleDateString("es-PE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  if (!registro) {
    statusEl.className = "colab-asist-status colab-status--neutral";
    statusEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Hola <strong>${sanitize(s.display)}</strong> — Aún no has registrado tu entrada hoy.`;
    btnEntrada.disabled = false;
    btnSalida.disabled  = true;
  } else if (registro.entrada && !registro.salida) {
    const estadoBadge = registro.estado === "Tardanza"
      ? `<span style="color:#ef4444;font-weight:700">⏰ Tardanza</span>`
      : `<span style="color:#059669;font-weight:700">✓ Asistencia</span>`;
    statusEl.className = "colab-asist-status colab-status--warn";
    statusEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Entrada registrada a las <strong>${sanitize(registro.entrada)}</strong> — Estado: ${estadoBadge}.`;
    btnEntrada.disabled = true;
    btnSalida.disabled  = false;
  } else if (registro.entrada && registro.salida) {
    statusEl.className = "colab-asist-status colab-status--ok";
    statusEl.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      ¡Jornada completa! Entrada: <strong>${sanitize(registro.entrada)}</strong> · Salida: <strong>${sanitize(registro.salida)}</strong> · Total: <strong>${calcHoras(registro.entrada, registro.salida)}</strong>`;
    btnEntrada.disabled = true;
    btnSalida.disabled  = true;
  }

  // ── Logs temporales de diagnóstico (estado final de botones) ──
  console.log("BTN ENTRADA (después de render):", btnEntrada?.disabled);
  console.log("BTN SALIDA (después de render):",  btnSalida?.disabled);
}

// ── Inicializar todos los eventos ──

export function initAsistencia(callbacks = {}) {
  // Cambio de mes
  document.getElementById("mesSelectorAsistencia")?.addEventListener("change", async () => {
    await renderAsistencia(callbacks);
    if (!isAdmin()) await renderColabAsistencia();
    if (isAdmin() && callbacks.onMesChange) await callbacks.onMesChange();
  });

  // Radio buttons entrada/salida
  document.querySelectorAll('input[name="accionAsistencia"]').forEach((r) =>
    r.addEventListener("change", toggleAsistenciaMode));

  // Botón entrada colaborador
  document.getElementById("btnColabEntrada")?.addEventListener("click", () =>
    _registrarEntradaColab(callbacks));

  // Botón salida colaborador
  document.getElementById("btnColabSalida")?.addEventListener("click", () =>
    _registrarSalidaColab(callbacks));

  // Formulario admin
  document.getElementById("formAsistencia")?.addEventListener("submit", (e) =>
    _submitFormAdmin(e, callbacks));

  // Limpiar mes
  document.getElementById("clearAsistencia")?.addEventListener("click", () =>
    _limpiarMes(callbacks));

  // Modal nuevo mes
  _initModalNuevoMesAsist(callbacks);

  // Modal edición de registros (solo admin)
  _initModalEditarAsist(callbacks);

  // Inicializar fecha del formulario admin al día de hoy
  const fechaAsistInput = document.getElementById("fechaAsistencia");
  if (fechaAsistInput && !fechaAsistInput.value) fechaAsistInput.value = getTodayStr();
}

// ── Modo entrada / salida ──

export function toggleAsistenciaMode() {
  if (!isAdmin()) return;
  const isEntrada = document.querySelector('input[name="accionAsistencia"]:checked').value === "entrada";

  // Visibilidad de campos
  document.getElementById("groupSelectSalida").style.display     = isEntrada ? "none"  : "block";
  document.getElementById("groupNombreTrabajador").style.display  = isEntrada ? "block" : "none";
  document.getElementById("groupHoraEntrada").style.display      = isEntrada ? "block" : "none";
  document.getElementById("groupHoraSalida").style.display       = "block";
  if (!isEntrada) _populateSelectSalida();

  // Actualizar indicador de modo y botón
  const indicator = document.getElementById("asistModeIndicator");
  const bar       = document.getElementById("asistModeBar");
  const label     = document.getElementById("asistModeLabel");
  const btn       = document.getElementById("btnRegistrarAsistencia");
  const btnTxt    = document.getElementById("asistBtnLabel");

  if (indicator) indicator.className = `asist-mode-indicator ${isEntrada ? "mode-entrada" : "mode-salida"}`;
  if (bar)       bar.className       = `asist-mode-bar${isEntrada ? "" : " mode-salida"}`;
  if (label) {
    label.className   = `asist-mode-label${isEntrada ? "" : " mode-salida"}`;
    label.textContent = isEntrada ? "▶  MODO ENTRADA ACTIVO" : "◀  MODO SALIDA ACTIVO";
  }
  if (btn)    btn.className      = `asist-submit-btn${isEntrada ? "" : " mode-salida"}`;
  if (btnTxt) btnTxt.textContent = isEntrada ? "REGISTRAR ENTRADA" : "REGISTRAR SALIDA";
}

async function _populateSelectSalida() {
  const select   = document.getElementById("selectTrabajadorSalida");
  const mesId    = getMesActivoAsistencia();
  const lista    = await getAsistenciasHoy(mesId);
  const filtered = lista.filter((r) => r.entrada && !r.salida);
  select.innerHTML = '<option value="">— Selecciona —</option>' +
    filtered.map((r) => `<option value="${r.id}">${sanitize(r.nombre)}</option>`).join("");
}

// ── Registro de entrada — COLABORADOR ──

async function _registrarEntradaColab(callbacks) {
  if (isAdmin()) return;
  const btnEntrada = document.getElementById("btnColabEntrada");
  if (btnEntrada) btnEntrada.disabled = true;
  try {
  const s     = getSession();
  const mesId = getMesActivoAsistencia();
  if (!mesId) { mostrarToast("No hay mes de asistencia activo. Contacta al administrador.", "error"); return; }

  const existente = await getRegistroColabHoy(mesId);
  if (existente) { mostrarToast("Ya tienes una entrada registrada hoy.", "error"); await renderColabAsistencia(); return; }

  const hora = await mostrarColabHoraModal("entrada");
  if (!hora) return;

  const estadoEntrada = getEstadoAsistencia(hora);
  let justificacion   = null;
  if (estadoEntrada === "Tardanza") {
    justificacion = await mostrarJustificacionTardanzaModal(hora);
    if (!justificacion) { mostrarToast("Debes justificar la tardanza para continuar.", "error"); return; }
  }

  const preview = `<strong>Trabajador:</strong> ${sanitize(s.display)}<br><strong>Acción:</strong> Entrada<br><strong>Hora:</strong> ${hora}<br><strong>Estado:</strong> ${estadoEntrada}${justificacion ? `<br><strong>Justificación:</strong> ${sanitize(justificacion)}` : ""}`;
  if (!(await mostrarGuardar("¿Confirmar registro de entrada?", preview))) return;

  const nuevo = {
    nombre: s.display, entrada: hora, salida: null,
    registrado_por: s.display, fecha: getTodayStr(),
    mes_asist_id: mesId, estado: estadoEntrada, justificacion: justificacion || null,
    user_id: s.uid || null,
  };
  const { error } = await insertarAsistencia(nuevo);
  if (error) { console.error(error); mostrarToast("Error al registrar entrada.", "error"); return; }

  await audit("add", `Entrada registrada por colaborador: ${s.display} (${hora}) [${estadoEntrada}]`);

  if (estadoEntrada === "Tardanza") {
    const fechaLeg = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    await notificarLaboral(`⏰ *KRD Importaciones — TARDANZA*\n\n👤 Colaborador: ${s.display}\n📅 Fecha: ${fechaLeg}\n🕐 Hora: ${hora}\n\n📝 Justificación:\n${justificacion}`);
  }

  mostrarToast(`✓ Entrada registrada a las ${hora} — ${estadoEntrada}.`, estadoEntrada === "Asistencia" ? "success" : "error");
  await mostrarEstadoEntradaModal(hora, s.display);
  await renderColabAsistencia();
  await renderAsistencia(callbacks);
  } finally {
    await renderColabAsistencia();
  }
}

// ── Registro de salida — COLABORADOR ──

async function _registrarSalidaColab(callbacks) {
  if (isAdmin()) return;
  const btnSalida = document.getElementById("btnColabSalida");
  if (btnSalida) btnSalida.disabled = true;
  try {
  const s       = getSession();
  const mesId   = getMesActivoAsistencia();
  const registro = await getRegistroColabHoy(mesId);
  if (!registro) { mostrarToast("Primero debes registrar tu entrada.", "error"); return; }
  if (registro.salida) { mostrarToast("Tu salida ya fue registrada hoy.", "error"); return; }

  const hora = await mostrarColabHoraModal("salida");
  if (!hora) return;

  const [hE, mE] = registro.entrada.split(":").map(Number);
  const [hS, mS] = hora.split(":").map(Number);
  const diff = (hS * 60 + mS) >= (hE * 60 + mE)
    ? (hS * 60 + mS) - (hE * 60 + mE)
    : 1440 - (hE * 60 + mE) + (hS * 60 + mS);
  if (diff === 0) { mostrarToast("La salida no puede ser igual a la entrada.", "error"); return; }

  const preview = `<strong>Trabajador:</strong> ${sanitize(s.display)}<br><strong>Acción:</strong> Salida<br><strong>Hora salida:</strong> ${hora}<br><strong>Duración:</strong> ${calcHoras(registro.entrada, hora)}`;
  if (!(await mostrarGuardar("¿Confirmar registro de salida?", preview))) return;

  const { error } = await actualizarSalidaAsistencia(registro.id, hora);
  if (error) { console.error(error); mostrarToast("Error al registrar salida.", "error"); return; }

  await audit("add", `Salida registrada por colaborador: ${s.display} (${hora})`);
  mostrarToast(`✓ Salida registrada. Duración: ${calcHoras(registro.entrada, hora)}.`, "success");
  await renderColabAsistencia();
  await renderAsistencia(callbacks);
  } finally {
    await renderColabAsistencia();
  }
}

// ── Formulario admin ──

async function _submitFormAdmin(e, callbacks) {
  e.preventDefault();
  if (!isAdmin()) { mostrarToast("Sin permisos para registrar asistencia.", "error"); return; }
  const mesId = getMesActivoAsistencia();
  if (!mesId) { mostrarToast("Crea un mes de asistencia primero.", "error"); return; }

  const accion = document.querySelector('input[name="accionAsistencia"]:checked').value;

  if (accion === "entrada") {
    await _adminRegistrarEntrada(e.target, mesId, callbacks);
  } else {
    await _adminRegistrarSalida(e.target, mesId, callbacks);
  }
}

async function _adminRegistrarEntrada(form, mesId, callbacks) {
  const nom = document.getElementById("nombreTrabajador");
  const ent = document.getElementById("horaEntrada");
  const sal = document.getElementById("horaSalida");
  const fec = document.getElementById("fechaAsistencia");
  clearErrors(["err-nombre", "err-entrada", "err-salida"], [nom, ent, sal]);

  let ok = true;
  if (!nom.value.trim() || nom.value.trim().length < 3) { setError("err-nombre", nom, "Mínimo 3 caracteres."); ok = false; }
  if (!ent.value) { setError("err-entrada", ent, "Ingresa la hora de entrada."); ok = false; }
  if (sal.value && sal.value === ent.value) { setError("err-salida", sal, "Salida no puede ser igual a entrada."); ok = false; }
  if (!ok) return;

  const s             = getSession();
  const fechaRegistro = fec?.value || getTodayStr();
  const lista         = await getAsistencias(mesId);
  const yaExiste      = lista.find(
    (r) => r.nombre.toLowerCase() === nom.value.trim().toLowerCase() && r.fecha === fechaRegistro,
  );
  if (yaExiste) { mostrarToast(`Ya existe un registro para ${nom.value.trim()} el ${fechaRegistro}.`, "error"); return; }

  const estadoEntrada = getEstadoAsistencia(ent.value);
  let justificacion   = null;
  if (estadoEntrada === "Tardanza") {
    justificacion = await mostrarJustificacionTardanzaModal(ent.value);
    if (!justificacion) { mostrarToast("Debes ingresar la justificación de tardanza.", "error"); return; }
  }

  const preview = `<strong>Trabajador:</strong> ${sanitize(nom.value.trim())}<br><strong>Hora entrada:</strong> ${sanitize(ent.value)}<br><strong>Estado:</strong> ${sanitize(estadoEntrada)}<br><strong>Fecha:</strong> ${sanitize(fechaRegistro)}<br><strong>Registrado por:</strong> ${sanitize(s?.display || "—")}`;
  if (!(await mostrarGuardar("¿Confirmar registro de entrada?", preview))) return;

  const nuevo = {
    nombre: nom.value.trim(), entrada: ent.value, salida: sal.value || null,
    registrado_por: s?.display || "—", fecha: fechaRegistro,
    mes_asist_id: mesId, estado: estadoEntrada, justificacion: justificacion || null,
  };
  const { error } = await insertarAsistencia(nuevo);
  if (error) { console.error(error); mostrarToast("Error al guardar la asistencia.", "error"); return; }

  await audit("add", `Asistencia registrada (admin): ${nuevo.nombre} (${nuevo.entrada}) [${estadoEntrada}]`);
  if (estadoEntrada === "Tardanza") {
    const fechaLeg = new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    await notificarLaboral(`⏰ *KRD Importaciones — TARDANZA REGISTRADA*\n\n👤 Trabajador: ${nuevo.nombre}\n📅 Fecha: ${fechaLeg}\n🕐 Hora: ${nuevo.entrada}\n👨‍💼 Registrado por: ${s?.display || "—"}\n\n📝 Justificación:\n${justificacion}`);
  }
  await renderAsistencia(callbacks);
  mostrarToast(`✓ Asistencia de ${nuevo.nombre} registrada — ${estadoEntrada}.`, "success");
  await mostrarEstadoEntradaModal(ent.value, nom.value.trim());
  form.reset();
  toggleAsistenciaMode();
}

async function _adminRegistrarSalida(form, mesId, callbacks) {
  const select = document.getElementById("selectTrabajadorSalida");
  const sal    = document.getElementById("horaSalida");
  clearErrors(["err-select", "err-salida"], [select, sal]);

  let ok = true;
  if (!select.value) { setError("err-select", select, "Selecciona un trabajador."); ok = false; }
  if (!sal.value)    { setError("err-salida", sal, "Ingresa la hora de salida."); ok = false; }
  if (!ok) return;

  const lista = await getAsistenciasHoy(mesId);
  const reg   = lista.find((r) => r.id === select.value);
  if (!reg) { mostrarToast("Registro no encontrado.", "error"); return; }
  if (reg.salida) { mostrarToast("Este trabajador ya tiene salida registrada.", "error"); return; }
  if (sal.value === reg.entrada) { setError("err-salida", sal, "Salida no puede ser igual a entrada."); return; }

  const preview = `<strong>Trabajador:</strong> ${sanitize(reg.nombre)}<br><strong>Hora salida:</strong> ${sanitize(sal.value)}<br><strong>Duración:</strong> ${sanitize(calcHoras(reg.entrada, sal.value))}`;
  if (!(await mostrarGuardar("¿Confirmar registro de salida?", preview))) return;

  const { error } = await actualizarSalidaAsistencia(select.value, sal.value);
  if (error) { console.error(error); mostrarToast("Error al registrar la salida.", "error"); return; }

  await audit("add", `Salida registrada (admin): ${reg.nombre} (${sal.value})`);
  await renderAsistencia(callbacks);
  mostrarToast(`✓ Salida de ${reg.nombre} registrada.`, "success");
  form.reset();
  toggleAsistenciaMode();
}

// ── Limpiar mes ──

async function _limpiarMes(callbacks) {
  if (!isAdmin()) return;
  const mesId = getMesActivoAsistencia();
  const meses = await getMesesAsistencia();
  const mes   = meses.find((m) => m.id === mesId);
  const confirmado = await mostrarConfirm(
    `¿Limpiar registros del mes "${mes?.nombre || "actual"}"?`,
    "Se eliminarán TODOS los registros de asistencia de este mes.",
    "Limpiar todo",
  );
  if (!confirmado) return;
  const { error } = await limpiarAsistenciasMes(mesId);
  if (error) { console.error(error); mostrarToast("Error al limpiar asistencias.", "error"); return; }
  await audit("clear", `Registros de asistencia del mes "${mes?.nombre}" eliminados`);
  await renderAsistencia(callbacks);
  mostrarToast("Registros del mes eliminados.", "info");
}

// ── Eliminar registro (llamado desde HTML inline) ──

export async function delAsistencia(id, callbacks = {}) {
  if (!isAdmin()) return;
  const confirmado = await mostrarConfirm("¿Eliminar registro?", "Se eliminará este registro de asistencia.", "Eliminar");
  if (!confirmado) return;
  const reg = getAsistenciasFull().find((r) => r.id === id);
  const { error } = await eliminarAsistencia(id);
  if (error) { console.error(error); mostrarToast("Error al eliminar el registro.", "error"); return; }
  await audit("delete", `Asistencia eliminada: ${reg?.nombre || id}`);
  await renderAsistencia(callbacks);
  mostrarToast("Registro eliminado.", "info");
}

// ── Modal editar registro (admin) ──

let _editModalCallbacks = {};

export function abrirModalEditarAsistencia(id, callbacks = {}) {
  if (!isAdmin()) { mostrarToast("Sin permisos de edición.", "error"); return; }
  _editModalCallbacks = callbacks;

  const reg = getAsistenciasFull().find((r) => r.id === id);
  if (!reg) { mostrarToast("Registro no encontrado. Recarga la tabla.", "error"); return; }

  document.getElementById("editarAsistId").value            = reg.id;
  document.getElementById("editarAsistNombre").value        = reg.nombre    || "";
  document.getElementById("editarAsistFecha").value         = reg.fecha     || getTodayStr();
  document.getElementById("editarAsistEntrada").value       = reg.entrada   || "";
  document.getElementById("editarAsistSalida").value        = reg.salida    || "";
  document.getElementById("editarAsistEstado").value        = reg.estado    || "Asistencia";
  document.getElementById("editarAsistJustificacion").value = reg.justificacion || "";

  ["err-edit-nombre", "err-edit-fecha", "err-edit-entrada"].forEach((eid) => {
    const el = document.getElementById(eid);
    if (el) el.textContent = "";
  });
  ["editarAsistNombre", "editarAsistFecha", "editarAsistEntrada"].forEach((eid) => {
    document.getElementById(eid)?.classList.remove("input-error");
  });

  document.getElementById("modalEditarAsistOverlay").classList.add("active");
}

function _initModalEditarAsist(callbacks) {
  _editModalCallbacks = callbacks;
  const overlay = document.getElementById("modalEditarAsistOverlay");
  if (!overlay) return;
  const cerrar  = () => overlay.classList.remove("active");
  document.getElementById("editarAsistCerrar")?.addEventListener("click",   cerrar);
  document.getElementById("editarAsistCancelar")?.addEventListener("click", cerrar);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
  document.getElementById("editarAsistGuardar")?.addEventListener("click",  () => _guardarEdicionAsistencia());
}

async function _guardarEdicionAsistencia() {
  if (!isAdmin()) return;
  const id   = document.getElementById("editarAsistId").value;
  const nom  = document.getElementById("editarAsistNombre");
  const fec  = document.getElementById("editarAsistFecha");
  const ent  = document.getElementById("editarAsistEntrada");
  const sal  = document.getElementById("editarAsistSalida");
  const est  = document.getElementById("editarAsistEstado");
  const just = document.getElementById("editarAsistJustificacion");
  clearErrors(["err-edit-nombre", "err-edit-fecha", "err-edit-entrada"], [nom, fec, ent]);

  let ok = true;
  if (!nom.value.trim() || nom.value.trim().length < 2) { setError("err-edit-nombre", nom, "Mínimo 2 caracteres."); ok = false; }
  if (!fec.value) { setError("err-edit-fecha", fec, "Selecciona una fecha."); ok = false; }
  if (!ent.value) { setError("err-edit-entrada", ent, "Ingresa la hora de entrada."); ok = false; }
  if (sal.value && sal.value === ent.value) { setError("err-edit-entrada", ent, "Salida no puede ser igual a entrada."); ok = false; }
  if (!ok) return;

  const s      = getSession();
  const campos = {
    nombre:         nom.value.trim(),
    fecha:          fec.value,
    entrada:        ent.value,
    salida:         sal.value || null,
    estado:         est.value,
    justificacion:  just.value.trim() || null,
    registrado_por: s?.display || "—",
  };

  const preview = `<strong>Trabajador:</strong> ${sanitize(campos.nombre)}<br>
    <strong>Fecha:</strong> ${sanitize(campos.fecha)}<br>
    <strong>Entrada:</strong> ${sanitize(campos.entrada)}${campos.salida ? ` &nbsp; <strong>Salida:</strong> ${sanitize(campos.salida)}` : ""}<br>
    <strong>Estado:</strong> ${sanitize(campos.estado)}${campos.justificacion ? `<br><strong>Justificación:</strong> ${sanitize(campos.justificacion)}` : ""}`;

  // Close edit modal first — it sits later in the DOM than the confirmation modal
  // and would render on top of it (same z-index), making the confirmation invisible.
  const editOverlay = document.getElementById("modalEditarAsistOverlay");
  editOverlay.classList.remove("active");

  if (!(await mostrarGuardar("¿Guardar cambios del registro?", preview))) {
    editOverlay.classList.add("active");
    return;
  }

  try {
    const { error } = await actualizarRegistroAsistencia(id, campos);
    if (error) { console.error(error); mostrarToast("Error al guardar los cambios.", "error"); return; }
    await audit("add", `Registro editado (admin): ${campos.nombre} — ${campos.fecha} — ${campos.entrada}`);
    await renderAsistencia(_editModalCallbacks);
    mostrarToast(`✓ Registro de ${campos.nombre} actualizado correctamente.`, "success");
  } catch (err) {
    console.error(err);
    mostrarToast("Error inesperado al guardar los cambios.", "error");
  }
}

// ── Modal nuevo mes de asistencia ──

function _initModalNuevoMesAsist(callbacks) {
  const overlayAsist  = document.getElementById("modalAsistMesOverlay");
  const inputMesAsist = document.getElementById("inputNuevoMesAsist");

  document.getElementById("btnNuevoMesAsist")?.addEventListener("click", () => {
    inputMesAsist.value = "";
    document.getElementById("err-mes-asist").textContent = "";
    inputMesAsist.classList.remove("input-error");
    overlayAsist.classList.add("active");
    setTimeout(() => inputMesAsist.focus(), 80);
  });

  const cerrar = () => overlayAsist.classList.remove("active");
  document.getElementById("modalAsistMesCancelar")?.addEventListener("click", cerrar);
  document.getElementById("modalAsistMesCerrar")?.addEventListener("click", cerrar);
  overlayAsist?.addEventListener("click", (e) => { if (e.target === overlayAsist) cerrar(); });

  document.getElementById("modalAsistMesConfirmar")?.addEventListener("click", async () => {
    const nombre = inputMesAsist.value.trim();
    const errEl  = document.getElementById("err-mes-asist");
    inputMesAsist.classList.remove("input-error");
    errEl.textContent = "";

    if (!nombre || nombre.length < 2) {
      errEl.textContent = "Mínimo 2 caracteres.";
      inputMesAsist.classList.add("input-error");
      return;
    }
    const meses = await getMesesAsistencia();
    if (meses.find((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) {
      errEl.textContent = "Ya existe un mes con ese nombre.";
      inputMesAsist.classList.add("input-error");
      return;
    }
    const nuevoMes = { id: uid(), nombre };
    const { error } = await crearMesAsistencia(nuevoMes);
    if (error) { console.error(error); mostrarToast("Error al crear el mes de asistencia.", "error"); return; }

    await renderSelectMesesAsistencia();
    if (callbacks.onNuevoMes) await callbacks.onNuevoMes();
    document.getElementById("mesSelectorAsistencia").value = nuevoMes.id;
    await renderAsistencia(callbacks);
    await audit("add", `Nuevo mes de asistencia creado: ${nombre}`);
    cerrar();
    mostrarToast(`✓ Mes de asistencia "${nombre}" creado.`, "success");
  });

  inputMesAsist?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("modalAsistMesConfirmar")?.click();
    if (e.key === "Escape") cerrar();
  });
}
