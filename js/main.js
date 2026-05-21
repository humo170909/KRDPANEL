// ================================================================
// main.js — KRD Importaciones
// Punto de entrada único. Orquesta inicialización de todos los módulos.
// ================================================================

// ── UI inmediata ──
import { initTheme }           from "./ui/theme.js";

// ── Core ──
import { getSession, isAdmin, isRRHH, isSupervisor, touchSession, clearSession } from "./core/session.js";

// ── Utils ──
import { getTodayStr }         from "./utils/helpers.js";

// ── Auth ──
import {
  mostrarApp, mostrarLogin, activarTab,
  initLoginForm, initLogout, initTabNav,
}                              from "./modules/auth.js";

// ── Módulos de negocio ──
import {
  renderAsistencia, renderColabAsistencia, renderSelectMesesAsistencia,
  getMesActivoAsistencia, initAsistencia, toggleAsistenciaMode, delAsistencia,
  abrirModalEditarAsistencia,
}                              from "./modules/asistencia.js";
import {
  renderVentas, renderSelectMeses, renderSelectDescargasVentas,
  renderSelectDescargasAsistencia, getMesActivo, initVentas, delDia,
  actualizarPreview,
}                              from "./modules/ventas.js";
import {
  renderObservaciones, actualizarBadgeObs, marcarObsLeida, eliminarObservacion,
  initObservaciones,
}                              from "./modules/observaciones.js";
import { renderAuditoria, initAuditoria }   from "./modules/auditoria.js";
import {
  renderTablaUsuarios, abrirModalCrearUsuario, abrirModalEditarUsuario,
  toggleActivoUsuario, initUsuarios,
}                              from "./modules/usuarios.js";
import { initCambiarPass }     from "./modules/cambiarpass.js";
import { verificarAusencias }  from "./modules/ausencias.js";
import { renderPanelQuincenas } from "./modules/quincenas.js";

// ── RRHH y Seguridad (nuevos módulos) ──
import { renderRRHH, initRRHH, renderSucursales } from "./modules/rrhh.js";
import { renderLogs, initLogs }                   from "./modules/logs.js";

// ── Gráficos ──
import {
  renderGraficoVentas, initGraficoVentas,
}                              from "./charts/grafico.ventas.js";
import {
  renderGraficoAsistencia, renderTopColaboradores,
}                              from "./charts/grafico.asistencia.js";

// ── Filtros ──
import {
  initFiltrosAsistencia, aplicarFiltrosAsistencia, limpiarFiltrosAsistencia,
  initFiltrosObservaciones, aplicarFiltrosObs, limpiarFiltrosObs,
}                              from "./ui/filters.js";

// ================================================================
// FUNCIONES GLOBALES (event delegation con data-action)
// ================================================================
window._delAsistencia           = (id)         => delAsistencia(id, _asistCallbacks);
window._editarAsistencia        = (id)         => abrirModalEditarAsistencia(id, _asistCallbacks);
window._delDia                  = (mId, id)    => delDia(mId, id, _ventasCallbacks);
window._marcarObsLeida          = (id)         => marcarObsLeida(id);
window._eliminarObservacion     = (id)         => eliminarObservacion(id);
window._abrirModalCrearUsuario  = ()           => abrirModalCrearUsuario();
window._abrirModalEditarUsuario = (id)         => abrirModalEditarUsuario(id);
window._toggleActivoUsuario     = (id, activo) => toggleActivoUsuario(id, activo);
window._aplicarFiltrosAsistencia   = aplicarFiltrosAsistencia;
window._limpiarFiltrosAsistencia   = limpiarFiltrosAsistencia;
window._aplicarFiltrosObs          = aplicarFiltrosObs;
window._limpiarFiltrosObs          = limpiarFiltrosObs;

// ================================================================
// CALLBACKS DE RENDER (evitan dependencias circulares)
// ================================================================

const _asistCallbacks = {
  onRender: async (lista) => {
    if (isAdmin()) {
      await renderGraficoAsistencia(getMesActivoAsistencia);
      await renderTopColaboradores(getMesActivoAsistencia);
      await renderPanelQuincenas(lista);
    }
  },
  onMesChange: async () => { await renderSelectDescargasAsistencia(); },
  onNuevoMes:  async () => { await renderSelectDescargasAsistencia(); },
};

const _ventasCallbacks = {
  onRender: async () => { await renderGraficoVentas(getMesActivo); },
};

// ================================================================
// INICIALIZACIÓN PRINCIPAL
// ================================================================

document.addEventListener("DOMContentLoaded", async () => {
  _crearModalEstadoEntrada();
  initTheme();
  _initIdleTimer();

  const session = getSession();
  if (session) {
    await _inicializarApp(session);
  } else {
    mostrarLogin();
    initLoginForm((s) => _inicializarApp(s));
  }

  initLogout();
});

// ================================================================
// FUNCIÓN DE INICIALIZACIÓN POST-LOGIN
// ================================================================

async function _inicializarApp(session) {
  await mostrarApp(session, {
    onAppMostrada: async () => {

      // Inicializar todos los módulos
      initAsistencia(_asistCallbacks);
      initVentas(_ventasCallbacks);
      initObservaciones();
      initAuditoria();
      initUsuarios();
      initCambiarPass();
      initRRHH();
      initLogs();
      initGraficoVentas(getMesActivo);
      initFiltrosAsistencia();
      initFiltrosObservaciones();

      // Navegación por tabs
      initTabNav({
        auditoria:    () => renderAuditoria(),
        observaciones: () => renderObservaciones(),
        usuarios: async () => {
          await renderTablaUsuarios();
          await _actualizarResumenUsuarios();
        },
        asistencia: async () => {
          if (isAdmin()) {
            await renderGraficoAsistencia(getMesActivoAsistencia);
            await renderTopColaboradores(getMesActivoAsistencia);
          }
        },
        rrhh: async () => {
          await renderRRHH();
          if (isAdmin()) await renderSucursales();
        },
        seguridad: () => renderLogs(),
      });

      // Carga inicial según rol
      if (isAdmin()) {
        activarTab("asistencia");
        await renderSelectMesesAsistencia();
        await renderAsistencia(_asistCallbacks);
        toggleAsistenciaMode();
        await renderSelectDescargasVentas();
        await renderSelectDescargasAsistencia();
        await actualizarBadgeObs();
        document.getElementById("gridGraficoAsistencia")?.classList.remove("hidden");
        setTimeout(async () => {
          await renderGraficoAsistencia(getMesActivoAsistencia);
          await renderTopColaboradores(getMesActivoAsistencia);
          await verificarAusencias();
        }, 600);

      } else if (isRRHH()) {
        activarTab("asistencia");
        await renderSelectMesesAsistencia();
        await renderAsistencia(_asistCallbacks);
        await actualizarBadgeObs();

      } else if (isSupervisor()) {
        activarTab("asistencia");
        await renderSelectMesesAsistencia();
        await renderAsistencia(_asistCallbacks);

      } else {
        // Colaborador
        activarTab("asistencia");
        await renderSelectMesesAsistencia();
        await renderColabAsistencia();
        await renderAsistencia(_asistCallbacks);
      }

      await renderVentas(_ventasCallbacks);
      await renderSelectMeses();

      const fechaVentaEl = document.getElementById("fechaVenta");
      if (fechaVentaEl) fechaVentaEl.value = getTodayStr();

      const obsLabel = document.getElementById("obsTableLabel");
      if (obsLabel) obsLabel.textContent = isAdmin() ? "TODAS LAS OBSERVACIONES" : "MIS OBSERVACIONES";

      setInterval(() => verificarAusencias(), 20 * 60 * 1000);
    },
  });
}

// ================================================================
// HELPERS INTERNOS
// ================================================================

async function _actualizarResumenUsuarios() {
  const { getUsuarios } = await import("./services/usuarios.service.js");
  const lista     = await getUsuarios();
  const activos   = lista.filter((u) => u.activo !== false).length;
  const inactivos = lista.filter((u) => u.activo === false).length;
  const admins    = lista.filter((u) => u.rol === "admin").length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("totalUsuariosCount",  lista.length);
  set("totalActivosCount",   activos);
  set("totalInactivosCount", inactivos);
  set("totalAdminsCount",    admins);
}

function _initIdleTimer() {
  const EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "click"];
  let _throttleTs = 0;
  const handler = () => {
    const now = Date.now();
    if (now - _throttleTs > 60_000) {
      _throttleTs = now;
      touchSession();
    }
    const s = getSession();
    if (!s && !document.getElementById("loginScreen").classList.contains("hidden") === false) {
      clearSession();
      location.reload();
    }
  };
  EVENTS.forEach((evt) => document.addEventListener(evt, handler, { passive: true }));
}

function _crearModalEstadoEntrada() {
  if (document.getElementById("modalEstadoEntradaOverlay")) return;
  const div = document.createElement("div");
  div.id        = "modalEstadoEntradaOverlay";
  div.className = "modal-overlay";
  div.style.cssText = "display:none;align-items:center;justify-content:center;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);";
  div.innerHTML = `
    <div class="modal-card" style="max-width:380px;text-align:center;padding:2rem;background:var(--surface,#1e1e2e);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div id="estadoEntradaIcon" style="font-size:3.5rem;margin-bottom:12px"></div>
      <h3 id="estadoEntradaTitle" style="margin-bottom:10px;font-size:1.15rem;font-weight:700"></h3>
      <p id="estadoEntradaDesc" style="color:var(--text-secondary,#94a3b8);font-size:0.88rem;margin-bottom:22px;line-height:1.6"></p>
      <button id="estadoEntradaOk" class="btn btn-primary" style="width:100%;font-size:0.95rem">Aceptar</button>
    </div>`;
  document.body.appendChild(div);
}
