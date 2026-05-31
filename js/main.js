// ================================================================
// main.js — KRD Importaciones
// Punto de entrada único. Orquesta inicialización de todos los módulos.
// ================================================================

// ── UI inmediata ──
import { initTheme }           from "./ui/theme.js";

// ── Seguridad de sesión ──
import { iniciarGuard, detenerGuard } from "./security/guard.js";

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

  // El guard se detiene solo al hacer reload (logout voluntario).
  // Registramos el hook aquí para limpieza explícita ante SPA.
  document.getElementById("btnLogout")?.addEventListener("click", () => detenerGuard(), { once: true, capture: true });

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

      // ── Guard de sesión activa ────────────────────────────────
      // Verifica cada 60 s en Supabase que la cuenta siga activa.
      // Si el admin desactiva al usuario, lo expulsa automáticamente.
      iniciarGuard((nombreUsuario) => {
        _mostrarPantallaExpulsion(nombreUsuario);
      });
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

// ================================================================
// PANTALLA DE EXPULSIÓN — cuenta desactivada por el admin
// ================================================================

function _mostrarPantallaExpulsion(nombreUsuario) {
  // 1. Ocultar toda la app inmediatamente
  document.getElementById("appScreen")?.classList.add("hidden");
  document.getElementById("loginScreen")?.classList.add("hidden");

  // 2. Eliminar pantalla previa si ya existía
  document.getElementById("krd-expulsion-screen")?.remove();

  // 3. Construir pantalla de expulsión
  const wrap = document.createElement("div");
  wrap.id = "krd-expulsion-screen";
  wrap.style.cssText = [
    "position:fixed", "inset:0", "z-index:99999",
    "display:flex", "align-items:center", "justify-content:center",
    "padding:24px",
    "background:var(--bg-base,#04060e)",
    "background-image:radial-gradient(ellipse 80% 65% at 10% 5%, rgba(240,90,110,0.12) 0%, transparent 55%), radial-gradient(ellipse 70% 55% at 90% 95%, rgba(149,117,255,0.10) 0%, transparent 55%)",
  ].join(";");

  wrap.innerHTML = `
    <div style="
      background: var(--bg-card-gradient, linear-gradient(145deg, #0c0f22 0%, #080a1e 100%));
      border: 1px solid rgba(240,90,110,0.22);
      border-radius: 24px;
      padding: 44px 40px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow:
        0 40px 100px rgba(0,0,0,0.75),
        0 0 60px rgba(240,90,110,0.07),
        inset 0 1px 0 rgba(255,255,255,0.06);
      position: relative;
      overflow: hidden;
    ">
      <!-- Línea superior -->
      <div style="
        position:absolute; top:0; left:14px; right:14px; height:2px;
        background:linear-gradient(90deg, transparent, rgba(240,90,110,0.85) 50%, transparent);
        border-radius:999px;
      "></div>

      <!-- Ícono -->
      <div style="
        width:76px; height:76px;
        background:rgba(240,90,110,0.11);
        border:1px solid rgba(240,90,110,0.28);
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        margin:0 auto 22px;
        font-size:2.2rem;
      ">🔒</div>

      <!-- Título -->
      <h2 style="
        font-family:'Rajdhani',sans-serif;
        font-size:1.45rem; font-weight:700;
        letter-spacing:0.06em; text-transform:uppercase;
        color:#f5bacd;
        margin-bottom:14px; line-height:1.2;
      ">Cuenta desactivada</h2>

      <!-- Mensaje -->
      <p style="
        color:var(--text-secondary,#7688aa);
        font-size:0.9rem; line-height:1.7;
        margin-bottom:10px;
      ">
        ${nombreUsuario
          ? `Hola <strong style="color:var(--text-primary,#e8eeff)">${nombreUsuario}</strong>, tu`
          : "Tu"
        }
        cuenta ha sido desactivada por el administrador.
      </p>
      <p style="
        color:var(--text-muted,#5a6888);
        font-size:0.8rem; line-height:1.55;
        margin-bottom:30px;
      ">
        Si crees que esto es un error, comunícate<br>con el administrador del sistema.
      </p>

      <!-- Botón -->
      <button id="btnExpulsionAceptar" style="
        width:100%;
        background:linear-gradient(135deg, #b060ff 0%, #9575ff 45%, #3db4ff 100%);
        border:none; border-radius:9px; padding:13px 24px;
        color:#fff;
        font-family:'Rajdhani',sans-serif; font-weight:700;
        font-size:0.95rem; letter-spacing:0.09em; text-transform:uppercase;
        cursor:pointer;
        box-shadow:0 4px 18px rgba(149,117,255,0.32);
        transition:filter 0.18s ease, transform 0.18s ease;
      ">Ir al inicio de sesión</button>
    </div>`;

  document.body.appendChild(wrap);

  // Hover button
  const btn = document.getElementById("btnExpulsionAceptar");
  if (btn) {
    btn.addEventListener("mouseover",  () => { btn.style.filter = "brightness(1.12)"; btn.style.transform = "translateY(-2px)"; });
    btn.addEventListener("mouseout",   () => { btn.style.filter = ""; btn.style.transform = ""; });
    btn.addEventListener("click", () => {
      clearSession();
      location.reload();
    });
  }
}

// ================================================================
// MODAL ESTADO ENTRADA (helper existente)
// ================================================================

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
