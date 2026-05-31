// ================================================================
// charts/grafico.ventas.js — KRD Importaciones
// Gráfico de tendencia de ventas y barra de progreso de meta.
// Usa Chart.js (cargado globalmente vía CDN).
// ================================================================

import { isAdmin }           from "../core/session.js";
import { fmt }               from "../utils/helpers.js";
import { getMeses, getDias, getMetaMes, guardarMetaMes } from "../services/ventas.service.js";
import { audit }             from "../services/auditoria.service.js";
import { mostrarToast }      from "../utils/helpers.js";

export async function renderGraficoVentas(getMesActivo) {
  if (!isAdmin()) return;
  const contenedor = document.getElementById("graficoVentasContenedor");
  if (!contenedor) return;

  const mesId    = getMesActivo();
  const meses    = await getMeses();
  const mesActual = meses.find((m) => m.id === mesId);
  const diasActual = mesId ? await getDias(mesId) : [];
  const idxActual  = meses.findIndex((m) => m.id === mesId);
  const mesAnterior = idxActual > 0 ? meses[idxActual - 1] : null;
  const diasAnterior = mesAnterior ? await getDias(mesAnterior.id) : [];
  const metaObj    = await getMetaMes(mesId);
  const meta       = metaObj?.meta || 0;

  const mapDias = (dias) => dias
    .map((d) => ({ fecha: d.fecha, neto: (d.efectivo||0)+(d.yape||0)+(d.plin||0)-(d.transf||0), ganancia: d.ganancia||0 }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const datosActual   = mapDias(diasActual);
  const datosAnterior = mapDias(diasAnterior);
  const totalNeto     = datosActual.reduce((a, d) => a + d.neto, 0);
  const totalAnterior = datosAnterior.reduce((a, d) => a + d.neto, 0);
  const pct = totalAnterior > 0 ? (((totalNeto - totalAnterior) / totalAnterior) * 100).toFixed(1) : null;

  actualizarBarraMeta(meta, totalNeto, mesActual);

  if (window._chartVentas) { window._chartVentas.destroy(); }

  contenedor.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#7d8590;font-family:monospace">Tendencia de ventas</div>
        <div style="font-size:22px;font-weight:600;color:#e6edf3;margin-top:4px;font-family:monospace">${fmt(totalNeto)}</div>
      </div>
      ${pct !== null ? `<span style="font-size:11px;font-weight:500;padding:3px 10px;border-radius:20px;font-family:monospace;background:${parseFloat(pct)>=0?"rgba(35,134,54,.15)":"rgba(248,81,73,.12)"};color:${parseFloat(pct)>=0?"#3fb950":"#f85149"};border:0.5px solid ${parseFloat(pct)>=0?"rgba(63,185,80,.2)":"rgba(248,81,73,.2)"}">${parseFloat(pct)>=0?"▲":"▼"} ${Math.abs(pct)}% vs anterior</span>` : ""}
    </div>
    <div style="position:relative;height:200px"><canvas id="_cvVentas" role="img" aria-label="Gráfico de ventas del mes">Ventas mensuales.</canvas></div>
    <div style="display:flex;gap:16px;margin-top:12px;flex-wrap:wrap">
      <span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#8b949e;font-family:monospace">
        <span style="width:10px;height:10px;border-radius:2px;background:#58a6ff;display:inline-block"></span>${mesActual?.nombre||"Este mes"}
      </span>
      ${datosAnterior.length ? `<span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#8b949e;font-family:monospace"><span style="width:14px;height:0;border-top:1.5px dashed #8b949e;display:inline-block"></span>${mesAnterior?.nombre||"Mes anterior"}</span>` : ""}
      ${meta ? `<span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#8b949e;font-family:monospace"><span style="width:14px;height:0;border-top:1.5px dashed #d29922;display:inline-block"></span>Meta</span>` : ""}
    </div>`;

  const ctx  = document.getElementById("_cvVentas").getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, "rgba(88,166,255,0.22)");
  grad.addColorStop(1, "rgba(88,166,255,0.0)");

  const metaPlugin = {
    id: "metaLine",
    afterDraw(chart) {
      if (!meta) return;
      const { ctx, chartArea: { left, right }, scales: { y } } = chart;
      const yPos = y.getPixelForValue(meta);
      ctx.save();
      ctx.strokeStyle = "#d29922"; ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]); ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(left, yPos); ctx.lineTo(right, yPos); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillStyle = "#d29922";
      ctx.font = "500 10px monospace"; ctx.textAlign = "right";
      ctx.fillText("META " + fmt(meta), right - 4, yPos - 5);
      ctx.restore();
    },
  };

  window._chartVentas = new Chart(ctx, {
    type: "line",
    plugins: [metaPlugin],
    data: {
      labels: datosActual.map((d) => new Date(d.fecha + "T12:00:00").getDate()),
      datasets: [
        {
          label: mesActual?.nombre || "Este mes",
          data: datosActual.map((d) => d.neto),
          borderColor: "#58a6ff", borderWidth: 2,
          backgroundColor: grad, fill: true, tension: 0.4,
          pointRadius: 0, pointHoverRadius: 5,
          pointHoverBackgroundColor: "#58a6ff", pointHoverBorderColor: "#0d1117", pointHoverBorderWidth: 2,
        },
        ...(datosAnterior.length ? [{
          label: mesAnterior?.nombre || "Anterior",
          data: datosAnterior.map((d) => d.neto),
          borderColor: "rgba(139,148,158,0.4)", borderWidth: 1.5,
          borderDash: [5, 4], backgroundColor: "transparent",
          fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 3,
        }] : []),
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#21262d", borderColor: "#30363d", borderWidth: 1,
          titleColor: "#8b949e", bodyColor: "#e6edf3", padding: 12,
          titleFont: { size: 10.5, family: "monospace" }, bodyFont: { size: 12, family: "monospace" },
          callbacks: { title: (items) => "Día " + items[0].label, label: (item) => "  " + item.dataset.label + ": " + fmt(item.raw) },
        },
      },
      scales: {
        x: { grid: { color: "rgba(48,54,61,0.6)", drawTicks: false }, ticks: { color: "#7d8590", font: { size: 10 }, maxTicksLimit: 8 }, border: { color: "transparent" } },
        y: { grid: { color: "rgba(48,54,61,0.6)", drawTicks: false }, ticks: { color: "#7d8590", font: { size: 10 }, callback: (v) => v >= 1000 ? "S/" + (v / 1000).toFixed(1) + "k" : "S/" + v }, border: { color: "transparent" }, min: 0 },
      },
    },
  });
}

export function actualizarBarraMeta(meta, totalNeto, mes) {
  const seccion = document.getElementById("seccionMetaVentas");
  if (!seccion) return;

  if (!meta || meta <= 0) {
    seccion.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
        <span style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);letter-spacing:0.05em">🎯 META DEL MES</span>
        ${isAdmin() ? `<button data-action="abrirMeta" class="btn btn-sm btn-ghost" style="font-size:0.73rem">+ Definir meta</button>` : ""}
      </div>
      <p style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:1rem 0">No hay meta definida para este mes.</p>`;
    return;
  }

  const pct        = Math.min((totalNeto / meta) * 100, 100);
  const pctDisplay = ((totalNeto / meta) * 100).toFixed(1);
  const falta      = Math.max(meta - totalNeto, 0);
  const color      = pct >= 100 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#7c3aed";
  const emoji      = pct >= 100 ? "🎉" : pct >= 70 ? "🔥" : "📈";

  seccion.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.9rem">
      <span style="font-size:0.78rem;font-weight:600;color:var(--text-secondary);letter-spacing:0.05em">${emoji} META DEL MES</span>
      ${isAdmin() ? `<button data-action="abrirMeta" class="btn btn-sm btn-ghost" style="font-size:0.73rem">Editar</button>` : ""}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.6rem">
      <span style="font-size:1.15rem;font-weight:700;color:${color}">${fmt(totalNeto)}</span>
      <span style="font-size:0.78rem;color:var(--text-muted)">de ${fmt(meta)}</span>
    </div>
    <div style="background:rgba(255,255,255,0.08);border-radius:999px;height:10px;overflow:hidden;margin-bottom:0.55rem">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:999px;transition:width 0.7s ease;box-shadow:0 0 10px ${color}66"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:0.76rem">
      <span style="color:${color};font-weight:600">${pctDisplay}% alcanzado</span>
      ${falta > 0 ? `<span style="color:var(--text-muted)">Faltan ${fmt(falta)}</span>` : `<span style="color:#10b981;font-weight:700">✓ ¡Meta superada!</span>`}
    </div>`;
}

export function initGraficoVentas(getMesActivo) {
  const overlay = document.getElementById("modalMetaOverlay");
  if (!overlay) return;

  const cerrar = () => overlay.classList.remove("active");
  document.getElementById("modalMetaCerrar")?.addEventListener("click", cerrar);
  document.getElementById("modalMetaCancelar")?.addEventListener("click", cerrar);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });

  document.getElementById("modalMetaConfirmar")?.addEventListener("click", async () => {
    const input = document.getElementById("inputMetaVentas");
    const errEl = document.getElementById("err-meta-ventas");
    const val   = parseFloat(input.value);
    if (errEl) errEl.textContent = "";
    input.classList.remove("input-error");
    if (!val || val <= 0) { if (errEl) errEl.textContent = "Ingresa un monto válido mayor a 0."; input.classList.add("input-error"); return; }
    const mesId = getMesActivo();
    if (!mesId) { mostrarToast("Selecciona un mes primero.", "error"); return; }
    try {
      await guardarMetaMes(mesId, val);
      cerrar();
      await renderGraficoVentas(getMesActivo);
      await audit("add", `Meta de ventas definida: ${fmt(val)}`);
      mostrarToast(`✓ Meta de ${fmt(val)} guardada.`, "success");
    } catch (err) {
      console.error(err);
      mostrarToast("Error al guardar la meta.", "error");
    }
  });

  document.getElementById("inputMetaVentas")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter")  document.getElementById("modalMetaConfirmar")?.click();
    if (e.key === "Escape") cerrar();
  });

  // Delegación para el botón de meta (CSP-compliant: sin onclick inline)
  document.getElementById("seccionMetaVentas")?.addEventListener("click", (e) => {
    if (e.target.closest("[data-action='abrirMeta']")) window._abrirModalMeta?.();
  });

  // Exponer la función para que la delegación pueda llamarla
  window._abrirModalMeta = () => {
    if (!isAdmin()) return;
    const input = document.getElementById("inputMetaVentas");
    const errEl = document.getElementById("err-meta-ventas");
    if (!overlay || !input) return;
    input.value = "";
    if (errEl) errEl.textContent = "";
    input.classList.remove("input-error");
    overlay.classList.add("active");
    setTimeout(() => input.focus(), 80);
  };
}
