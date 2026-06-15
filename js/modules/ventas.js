// ================================================================
// modules/ventas.js — KRD Importaciones
// Registro de ventas diarias, gestión de meses, reporte mensual
// y exportación a Excel.
// ================================================================

import { getSession, isAdmin }  from "../core/session.js";
import { sanitize, mostrarToast, getTodayStr, fmt, fmtPct, uid,
         setError, clearErrors }   from "../utils/helpers.js";
import { mostrarConfirm, mostrarGuardar, mostrarReauth } from "../ui/modals.js";
import {
  getMeses, getDias, crearMes, insertarDia, actualizarDia,
  eliminarDia, limpiarDiasMes,
} from "../services/ventas.service.js";
import { getMesesAsistencia }   from "../services/asistencia.service.js";
import { audit }                from "../services/auditoria.service.js";
import { exportarExcel }        from "../utils/exports.js";
import { supabaseClient }       from "../core/config.js";

export function getMesActivo() {
  return document.getElementById("mesSelector")?.value;
}

// ── Selector de meses de ventas ──

export async function renderSelectMeses() {
  const sel  = document.getElementById("mesSelector");
  const prev = sel.value;
  const meses = await getMeses();
  sel.innerHTML = meses.length
    ? meses.map((m) => `<option value="${m.id}">${sanitize(m.nombre)}</option>`).join("")
    : '<option value="">— Sin meses creados —</option>';
  if (prev && meses.find((m) => m.id === prev)) sel.value = prev;
  else if (meses.length) sel.value = meses[meses.length - 1].id;
}

export async function renderSelectDescargasVentas() {
  if (!isAdmin()) return;
  const sel   = document.getElementById("selectMesVentasDescargas");
  const meses = await getMeses();
  sel.innerHTML = meses.length
    ? meses.map((m) => `<option value="${m.id}">${sanitize(m.nombre)}</option>`).join("")
    : '<option value="">— Sin meses creados —</option>';
  if (meses.length) sel.value = meses[meses.length - 1].id;
}

export async function renderSelectDescargasAsistencia() {
  if (!isAdmin()) return;
  const sel = document.getElementById("selectMesAsistDescargas");
  if (!sel) return;
  const meses = await getMesesAsistencia();
  sel.innerHTML = meses.length
    ? meses.map((m) => `<option value="${m.id}">${sanitize(m.nombre)}</option>`).join("")
    : '<option value="">— Sin meses creados —</option>';
  if (meses.length) sel.value = meses[meses.length - 1].id;
}

// ── Render tabla ventas ──

export async function renderVentas(callbacks = {}) {
  const mesId = getMesActivo();
  const meses = await getMeses();
  const mes   = meses.find((m) => m.id === mesId);

  if (isAdmin()) {
    const labelEl = document.getElementById("labelMesActual");
    if (labelEl) labelEl.textContent = mes ? `DÍAS REGISTRADOS — ${mes.nombre.toUpperCase()}` : "DÍAS REGISTRADOS";
  }

  const lista = mesId ? await getDias(mesId) : [];

  if (isAdmin()) {
    const tbody = document.getElementById("bodyVentas");
    const empty = document.getElementById("emptyVentas");
    if (!lista.length) {
      tbody.innerHTML = "";
      empty.classList.remove("hidden");
      actualizarReporte([]);
      if (callbacks.onRender) await callbacks.onRender(lista);
      return;
    }
    empty.classList.add("hidden");
    tbody.innerHTML = lista.map((d, i) => {
      const totalBruto = (d.efectivo || 0) + (d.yape || 0) + (d.plin || 0);
      const gastos     = d.transf || 0;
      const totalNeto  = totalBruto - gastos;
      const ganancia   = d.ganancia || 0;
      const balance    = totalNeto - ganancia;
      const clsGan     = ganancia >= 0 ? "val-ganancia" : "val-negativo";
      const pctGan     = fmtPct(ganancia, totalNeto);
      const fechaFmt   = new Date(d.fecha + "T12:00:00").toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
      return `
        <tr class="${i === lista.length - 1 ? "row-new" : ""}">
          <td>${i + 1}</td>
          <td>${fechaFmt}</td>
          <td class="val-mono" style="color:#10b981">${fmt(d.efectivo || 0)}</td>
          <td class="val-mono val-yape">${fmt(d.yape || 0)}</td>
          <td class="val-mono val-plin">${fmt(d.plin || 0)}</td>
          <td class="val-mono val-transf" style="color:#ef4444">${fmt(gastos)}</td>
          <td class="val-mono val-accent">${fmt(totalBruto)}</td>
          <td class="val-mono val-accent">${fmt(totalNeto)}</td>
          <td class="val-mono ${clsGan}">${fmt(ganancia)}</td>
          <td class="val-mono" style="color:#8892b0">${fmt(balance)}</td>
          <td class="val-mono" style="color:var(--text-secondary)">${pctGan}</td>
          <td><span class="reg-by">${sanitize(d.registrado_por || "—")}</span></td>
          <td><button class="btn-delete" data-action="delDia" data-mes-id="${mesId}" data-id="${d.id}">✕</button></td>
        </tr>`;
    }).join("");
    actualizarReporte(lista);
    if (callbacks.onRender) await callbacks.onRender(lista);
  }
}

function actualizarReporte(lista) {
  if (!isAdmin()) return;
  const totalE = lista.reduce((a, d) => a + (d.efectivo || 0), 0);
  const totalY = lista.reduce((a, d) => a + (d.yape || 0), 0);
  const totalP = lista.reduce((a, d) => a + (d.plin || 0), 0);
  const totalT = lista.reduce((a, d) => a + (d.transf || 0), 0);
  const totalBruto = totalE + totalY + totalP;
  const totalNeto  = totalBruto - totalT;
  const totalG     = lista.reduce((a, d) => a + (d.ganancia || 0), 0);
  const totalB     = totalNeto - totalG;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("reporteEfectivo", fmt(totalE));
  set("reporteYape", fmt(totalY));
  set("reportePlin", fmt(totalP));
  set("reporteTransf", fmt(totalT));
  set("reporteTotalBruto", fmt(totalBruto));
  set("reporteTotalVentas", fmt(totalNeto));
  set("reporteCostoTotal", fmt(totalG));
  set("reporteGananciaTotal", fmt(totalB));
  set("reporteDias", lista.length);
  const ganEl = document.getElementById("reporteGananciaTotal");
  if (ganEl) ganEl.style.color = totalB >= 0 ? "var(--success)" : "var(--danger)";
}

// ── Preview en tiempo real del formulario ──

export function actualizarPreview() {
  const e  = parseFloat(document.getElementById("ventaEfectivo").value) || 0;
  const y  = parseFloat(document.getElementById("ventaYape").value) || 0;
  const p  = parseFloat(document.getElementById("ventaPlin").value) || 0;
  const t  = parseFloat(document.getElementById("ventaTransf").value) || 0;
  const g  = parseFloat(document.getElementById("gananciaDelDia").value) || 0;
  const tb = e + y + p;
  const tn = tb - t;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("previewEfectivo", fmt(e));
  set("previewYapeVal",  fmt(y));
  set("previewPlinVal",  fmt(p));
  set("previewTransfVal", fmt(t));
  set("previewTotalBruto", fmt(tb));
  set("previewTotal",   fmt(tn));
  set("previewGanancia", fmt(g));
  set("previewBalance",  fmt(tn - g));
  const ganEl = document.getElementById("previewGanancia");
  if (ganEl) ganEl.style.color = g >= 0 ? "var(--accent-light)" : "var(--danger)";
}

// ── Inicializar eventos ──

export function initVentas(callbacks = {}) {
  // Delegación para botón eliminar día (CSP-compliant: sin onclick inline)
  document.getElementById("bodyVentas")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='delDia']");
    if (!btn) return;
    window._delDia?.(btn.dataset.mesId, btn.dataset.id);
  });

  ["ventaEfectivo", "ventaYape", "ventaPlin", "ventaTransf", "gananciaDelDia"].forEach((id) =>
    document.getElementById(id)?.addEventListener("input", actualizarPreview));

  document.getElementById("formVentas")?.addEventListener("submit", (e) =>
    _submitFormVentas(e, callbacks));

  document.getElementById("clearDia")?.addEventListener("click", () =>
    _limpiarMes(callbacks));

  document.getElementById("mesSelector")?.addEventListener("change", async () => {
    await renderVentas(callbacks);
    if (isAdmin()) await renderSelectDescargasVentas();
  });

  _initModalNuevoMes(callbacks);
  _initDescargaVentas();
  _initDescargaAsistencias();
}

// ── Formulario guardar día ──

async function _submitFormVentas(e, callbacks) {
  e.preventDefault();
  const fec      = document.getElementById("fechaVenta");
  const efectivo = document.getElementById("ventaEfectivo");
  const yape     = document.getElementById("ventaYape");
  const plin     = document.getElementById("ventaPlin");
  const transf   = document.getElementById("ventaTransf");
  const ganancia = document.getElementById("gananciaDelDia");
  clearErrors(["err-fecha","err-efectivo","err-yape","err-plin","err-transf","err-ganancia"],
    [fec, efectivo, yape, plin, transf, ganancia]);

  const mesId = getMesActivo();
  if (!mesId) { mostrarToast("Crea un mes primero.", "error"); return; }

  let ok = true;
  if (!fec.value) { setError("err-fecha", fec, "Selecciona una fecha."); ok = false; }
  const eNum = parseFloat(efectivo.value) || 0;
  const yNum = parseFloat(yape.value) || 0;
  const pNum = parseFloat(plin.value) || 0;
  const tNum = parseFloat(transf.value) || 0;
  const gNum = parseFloat(ganancia.value) || 0;
  if (eNum === 0 && yNum === 0 && pNum === 0) { setError("err-efectivo", efectivo, "Ingresa al menos un monto de venta."); ok = false; }
  if (gNum < 0) { setError("err-ganancia", ganancia, "La ganancia no puede ser negativa."); ok = false; }
  if (!ok) return;

  const meses     = await getMeses();
  const mesActual = meses.find((m) => m.id === mesId);
  if (!mesActual) { mostrarToast("El mes seleccionado no existe. Recarga la página.", "error"); return; }

  const tb   = eNum + yNum + pNum;
  const tn   = tb - tNum;
  const lista = await getDias(mesId);
  const existe = lista.find((d) => d.fecha === fec.value);
  const s      = getSession();

  if (existe) {
    if (!isAdmin()) { mostrarToast("Ya existe un registro para esa fecha. Solo el administrador puede modificarlo.", "error"); return; }
    if (!(await mostrarConfirm(`¿Sobreescribir ${fec.value}?`, "Ya existe un registro para esta fecha. ¿Deseas reemplazarlo?", "Sobreescribir"))) return;
    const { error } = await actualizarDia(existe.id, { efectivo: eNum, yape: yNum, plin: pNum, transf: tNum, ganancia: gNum, registrado_por: s?.display || "—" });
    if (error) { console.error(error); mostrarToast("Error al actualizar el día.", "error"); return; }
    await audit("add", `Día sobreescrito: ${fec.value} [Mes: ${mesActual.nombre}]`);
  } else {
    const preview = `<strong>Mes:</strong> ${sanitize(mesActual.nombre)}<br><strong>Fecha:</strong> ${sanitize(fec.value)}<br><strong>Efectivo:</strong> ${fmt(eNum)} &nbsp; <strong>Yape:</strong> ${fmt(yNum)} &nbsp; <strong>Plin:</strong> ${fmt(pNum)}<br><strong>Gastos:</strong> ${fmt(tNum)}<br><strong>Total bruto:</strong> ${fmt(tb)} &nbsp; <strong>Total neto:</strong> ${fmt(tn)}<br><strong>Ganancia:</strong> ${fmt(gNum)}<br><strong>Registrado por:</strong> ${sanitize(s?.display || "—")}`;
    if (!(await mostrarGuardar("¿Confirmar registro del día?", preview))) return;

    const { error } = await insertarDia({ mes_id: mesId, fecha: fec.value, efectivo: eNum, yape: yNum, plin: pNum, transf: tNum, ganancia: gNum, registrado_por: s?.display || "—" });
    if (error) { console.error(error); mostrarToast("Error al guardar el día.", "error"); return; }
    await audit("add", `Día registrado: ${fec.value} [Mes: ${mesActual.nombre}]`);
    if (!isAdmin()) document.getElementById("cardColabVentasMsg")?.classList.remove("hidden");
  }
  await renderVentas(callbacks);
  if (isAdmin()) await renderSelectDescargasVentas();
  mostrarToast("✓ Día guardado correctamente.", "success");
  e.target.reset();
  actualizarPreview();
  document.getElementById("fechaVenta").value = getTodayStr();
}

// ── Eliminar día (desde inline HTML) ──

export async function delDia(mesId, id, callbacks = {}) {
  if (!isAdmin()) return;
  if (!(await mostrarConfirm("¿Eliminar este día?", "Se eliminará permanentemente el registro de este día.", "Eliminar"))) return;
  const lista = await getDias(mesId);
  const reg   = lista.find((d) => d.id === id);
  const { error } = await eliminarDia(id);
  if (error) { console.error(error); mostrarToast("Error al eliminar el día.", "error"); return; }
  const totalBruto = (reg?.efectivo || 0) + (reg?.yape || 0) + (reg?.plin || 0);
  await audit("delete", `Día eliminado: ${reg?.fecha} — Total neto: ${fmt(totalBruto - (reg?.transf || 0))}`);
  await renderVentas(callbacks);
  await renderSelectDescargasVentas();
  mostrarToast("Día eliminado.", "info");
}

// ── Limpiar mes ──

async function _limpiarMes(callbacks) {
  if (!isAdmin()) return;
  const mesId = getMesActivo();
  if (!mesId) { mostrarToast("No hay mes seleccionado.", "error"); return; }
  const meses = await getMeses();
  const mes   = meses.find((m) => m.id === mesId);
  if (!(await mostrarConfirm(`¿Limpiar el mes "${mes?.nombre}"?`, "Se eliminarán todos los días registrados de este mes.", "Limpiar mes"))) return;
  const { error } = await limpiarDiasMes(mesId);
  if (error) { console.error(error); mostrarToast("Error al limpiar el mes.", "error"); return; }
  await audit("clear", `Mes limpiado: ${mes?.nombre}`);
  await renderVentas(callbacks);
  await renderSelectDescargasVentas();
  mostrarToast("Mes limpiado.", "info");
}

// ── Modal nuevo mes ──

function _initModalNuevoMes(callbacks) {
  const overlay  = document.getElementById("modalOverlay");
  const inputMes = document.getElementById("inputNuevoMes");
  const cerrar   = () => overlay.classList.remove("active");

  document.getElementById("btnNuevoMes")?.addEventListener("click", () => {
    inputMes.value = "";
    document.getElementById("err-mes").textContent = "";
    inputMes.classList.remove("input-error");
    overlay.classList.add("active");
    setTimeout(() => inputMes.focus(), 80);
  });
  document.getElementById("modalCancelar")?.addEventListener("click", cerrar);
  document.getElementById("modalCerrar")?.addEventListener("click", cerrar);
  overlay?.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });

  document.getElementById("modalConfirmar")?.addEventListener("click", async () => {
    const nombre = inputMes.value.trim();
    const errEl  = document.getElementById("err-mes");
    inputMes.classList.remove("input-error");
    errEl.textContent = "";
    if (!nombre || nombre.length < 2) { errEl.textContent = "Mínimo 2 caracteres."; inputMes.classList.add("input-error"); return; }
    const meses = await getMeses();
    if (meses.find((m) => m.nombre.toLowerCase() === nombre.toLowerCase())) { errEl.textContent = "Ya existe un mes con ese nombre."; inputMes.classList.add("input-error"); return; }

    const { error, nuevoMes } = await crearMes(nombre);
    if (error) { console.error(error); mostrarToast("Error al crear el mes.", "error"); return; }
    await renderSelectMeses();
    if (isAdmin()) await renderSelectDescargasVentas();
    document.getElementById("mesSelector").value = nuevoMes.id;
    await renderVentas(callbacks);
    await audit("add", `Nuevo mes creado: ${nombre}`);
    cerrar();
    mostrarToast(`✓ Mes "${nombre}" creado correctamente.`, "success");
  });

  inputMes?.addEventListener("keydown", (e) => {
    if (e.key === "Enter")  document.getElementById("modalConfirmar")?.click();
    if (e.key === "Escape") cerrar();
  });
}

// ── Descarga Excel Ventas ──

function _initDescargaVentas() {
  document.getElementById("btnDescargarVentas")?.addEventListener("click", async () => {
    if (!isAdmin()) { mostrarToast("Solo el administrador puede exportar datos.", "error"); return; }
    const { supabaseClient: _sc } = await import("../core/config.js");
    const session = (await import("../core/session.js")).getSession();
    if (!(await mostrarReauth(_sc, session))) return;

    const mesId = document.getElementById("selectMesVentasDescargas")?.value;
    if (!mesId) { mostrarToast("Selecciona un mes para descargar.", "error"); return; }
    const meses = await getMeses();
    const mes   = meses.find((m) => m.id === mesId);
    const dias  = await getDias(mesId);
    if (!dias.length) { mostrarToast("No hay datos en este mes.", "info"); return; }

    const sorted  = [...dias].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const headers = ["Fecha","Día","Efectivo (S/)","Yape (S/)","Plin (S/)","Gastos (S/)","Total Bruto (S/)","Total Neto (S/)","Ganancia Realizada (S/)","Balance Restante (S/)","Margen %","Registrado por"];
    const rows    = sorted.map((d) => {
      const bruto  = (d.efectivo || 0) + (d.yape || 0) + (d.plin || 0);
      const neto   = bruto - (d.transf || 0);
      const gan    = d.ganancia || 0;
      const balance = neto - gan;
      const margen  = neto > 0 ? ((gan / neto) * 100).toFixed(1) + "%" : "0%";
      const dia     = new Date(d.fecha + "T12:00:00").toLocaleDateString("es-PE", { weekday: "short" }).toUpperCase();
      return [d.fecha, dia, +(d.efectivo||0).toFixed(2), +(d.yape||0).toFixed(2), +(d.plin||0).toFixed(2), +(d.transf||0).toFixed(2), +bruto.toFixed(2), +neto.toFixed(2), +gan.toFixed(2), +balance.toFixed(2), margen, d.registrado_por || "—"];
    });
    const totE = dias.reduce((a,d) => a+(d.efectivo||0),0), totY = dias.reduce((a,d) => a+(d.yape||0),0), totP = dias.reduce((a,d) => a+(d.plin||0),0), totT = dias.reduce((a,d) => a+(d.transf||0),0);
    const totB = totE+totY+totP, totN = totB-totT, totG = dias.reduce((a,d) => a+(d.ganancia||0),0);
    rows.push([]);
    rows.push(["TOTAL","",+totE.toFixed(2),+totY.toFixed(2),+totP.toFixed(2),+totT.toFixed(2),+totB.toFixed(2),+totN.toFixed(2),+totG.toFixed(2),+(totN-totG).toFixed(2),totN>0?((totG/totN)*100).toFixed(1)+"%":"0%",""]);

    const hoy = new Date();
    exportarExcel(`Ventas_${mes.nombre}_${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-${String(hoy.getDate()).padStart(2,"0")}`, mes.nombre, headers, rows);
    await audit("add", `Exportación Excel de ventas: ${mes.nombre}`);
    mostrarToast("✓ Reporte de ventas descargado.", "success");
  });
}

// ── Descarga Excel Asistencias (desde tab Descargas) ──

function _initDescargaAsistencias() {
  document.getElementById("btnDescargarAsistencias")?.addEventListener("click", async () => {
    if (!isAdmin()) { mostrarToast("Solo el administrador puede exportar datos.", "error"); return; }
    const { supabaseClient: _sc } = await import("../core/config.js");
    const session = (await import("../core/session.js")).getSession();
    if (!(await mostrarReauth(_sc, session))) return;

    const mesId = document.getElementById("selectMesAsistDescargas")?.value;
    if (!mesId) { mostrarToast("Selecciona un mes de asistencia para descargar.", "error"); return; }
    const { descargarExcelAsistencia } = await import("../utils/exports.js");
    const { getMesesAsistencia, getAsistencias } = await import("../services/asistencia.service.js");
    const { calcularQuincenas, calcMinutos, getQuincena } = await import("./quincenas.js");
    const { getEstadoAsistencia, calcHoras } = await import("../utils/helpers.js");
    const meses = await getMesesAsistencia();
    const mes   = meses.find((m) => m.id === mesId);
    const lista = await getAsistencias(mesId);
    if (!lista.length) { mostrarToast("No hay asistencias para este mes.", "info"); return; }

    const { audit: _audit } = await import("../services/auditoria.service.js");
    await descargarExcelAsistencia({ lista, mesNombre: mes?.nombre || "mes", calcularQuincenas, calcMinutos, getEstadoAsistencia, getQuincena, audit: _audit });
  });
}
