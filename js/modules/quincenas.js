// ================================================================
// modules/quincenas.js — KRD Importaciones
// Análisis de asistencia por quincena del mes.
// Separado de asistencia.js porque es analítica, no CRUD.
// ================================================================

import { sanitize, getEstadoAsistencia } from "../utils/helpers.js";
import { isAdmin }                        from "../core/session.js";

export function calcMinutos(entrada, salida) {
  if (!entrada || !salida) return 0;
  const [hE, mE] = entrada.split(":").map(Number);
  const [hS, mS] = salida.split(":").map(Number);
  const diff = (hS * 60 + mS) - (hE * 60 + mE);
  return diff > 0 ? diff : 0;
}

export function minToHHMM(min) {
  if (!min || min <= 0) return "0h 0m";
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function getQuincena(fecha) {
  if (!fecha) return null;
  const dia = parseInt(fecha.split("-")[2]);
  return dia <= 15 ? 1 : 2;
}

export function calcularQuincenas(lista) {
  const q = {
    1: { tardanzas: 0, minutos: 0, registros: [] },
    2: { tardanzas: 0, minutos: 0, registros: [] },
  };
  lista.forEach((r) => {
    const qNum   = getQuincena(r.fecha);
    if (!qNum) return;
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    const min    = calcMinutos(r.entrada, r.salida);
    q[qNum].minutos += min;
    q[qNum].registros.push(r);
    if (estado === "Tardanza") q[qNum].tardanzas++;
  });
  return q;
}

export async function renderPanelQuincenas(lista) {
  if (!isAdmin()) return;
  const contenedor = document.getElementById("panelQuincenasContenido");
  if (!contenedor) return;

  if (!lista.length) {
    contenedor.innerHTML = `<p style="color:#7d8590;font-size:0.82rem;text-align:center;padding:1rem 0">Sin datos para este mes.</p>`;
    return;
  }

  const q          = calcularQuincenas(lista);
  const porUsuario = {};

  lista.forEach((r) => {
    const key  = r.nombre;
    if (!porUsuario[key]) porUsuario[key] = { 1: { tardanzas: 0, minutos: 0 }, 2: { tardanzas: 0, minutos: 0 } };
    const qNum   = getQuincena(r.fecha);
    if (!qNum) return;
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    porUsuario[key][qNum].minutos += calcMinutos(r.entrada, r.salida);
    if (estado === "Tardanza") porUsuario[key][qNum].tardanzas++;
  });

  const filas = Object.entries(porUsuario).map(([nombre, data]) => `
    <tr>
      <td style="padding:8px 12px;font-size:0.82rem;color:#e6edf3;border-bottom:0.5px solid #21262d">${sanitize(nombre)}</td>
      <td style="padding:8px 12px;text-align:center;font-family:monospace;font-size:0.82rem;color:${data[1].tardanzas > 0 ? "#f85149" : "#3fb950"};border-bottom:0.5px solid #21262d">${data[1].tardanzas}</td>
      <td style="padding:8px 12px;text-align:center;font-family:monospace;font-size:0.82rem;color:#58a6ff;border-bottom:0.5px solid #21262d">${minToHHMM(data[1].minutos)}</td>
      <td style="padding:8px 12px;text-align:center;font-family:monospace;font-size:0.82rem;color:${data[2].tardanzas > 0 ? "#f85149" : "#3fb950"};border-bottom:0.5px solid #21262d">${data[2].tardanzas}</td>
      <td style="padding:8px 12px;text-align:center;font-family:monospace;font-size:0.82rem;color:#58a6ff;border-bottom:0.5px solid #21262d">${minToHHMM(data[2].minutos)}</td>
    </tr>`).join("");

  contenedor.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      ${_quincenaCard(1, "1ª Quincena (1–15)",    q[1])}
      ${_quincenaCard(2, "2ª Quincena (16–fin)",   q[2])}
    </div>
    <div style="background:#161b22;border:0.5px solid #30363d;border-radius:10px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#0d1117">
            <th style="padding:9px 12px;text-align:left;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7d8590;font-family:monospace">Trabajador</th>
            <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;color:#7d8590;font-family:monospace">Tard. Q1</th>
            <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;color:#7d8590;font-family:monospace">Hrs. Q1</th>
            <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;color:#7d8590;font-family:monospace">Tard. Q2</th>
            <th style="padding:9px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;color:#7d8590;font-family:monospace">Hrs. Q2</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

function _quincenaCard(num, label, data) {
  return `
    <div style="background:#161b22;border:0.5px solid #30363d;border-radius:10px;padding:14px 16px">
      <div style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7d8590;font-family:monospace;margin-bottom:8px">${label}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:10px;color:#7d8590;font-family:monospace">Tardanzas</div>
          <div style="font-size:20px;font-weight:600;color:${data.tardanzas > 0 ? "#f85149" : "#3fb950"};font-family:monospace">${data.tardanzas}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:#7d8590;font-family:monospace">Horas trabajadas</div>
          <div style="font-size:20px;font-weight:600;color:#58a6ff;font-family:monospace">${minToHHMM(data.minutos)}</div>
        </div>
      </div>
    </div>`;
}
