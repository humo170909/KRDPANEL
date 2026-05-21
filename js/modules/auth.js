// ================================================================
// modules/auth.js — KRD Importaciones
// Login, logout, navegación por tabs e inicialización de vistas.
// Roles: admin > rrhh > supervisor > colaborador
// ================================================================

import { supabaseClient, MAX_LOGIN_TRIES }                          from "../core/config.js";
import {
  getSession, setSession, clearSession,
  isAdmin, isRRHH, isSupervisor,
  isLoginBlocked, getBlockSecondsLeft, incrementLoginFails,
  blockLogin, resetLoginFails,
}                                                                   from "../core/session.js";
import { sanitize, mostrarToast, iniciarRelojPeru }                 from "../utils/helpers.js";
import { setError, clearErrors }                                    from "../utils/helpers.js";
import { mostrarConfirm }                                           from "../ui/modals.js";
import { audit }                                                    from "../services/auditoria.service.js";
import { getPorUsername }                                           from "../services/usuarios.service.js";
import { logAsync }                                                 from "../services/logs.service.js";
import {
  notificarSeguridad, msgLoginFallido, msgCuentaBloqueada,
}                                                                   from "../services/notificaciones.service.js";
import { getClientIP }                                              from "../utils/device.js";

// ── Navegación por tabs ───────────────────────────────────────────

export function activarTab(nombre) {
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === nombre));
  document.querySelectorAll(".tab-panel").forEach((p) =>
    p.classList.toggle("active", p.id === "tab-" + nombre));
}

// ── Mostrar pantalla de app (con visibilidad por rol) ─────────────

export async function mostrarApp(session, callbacks = {}) {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");

  document.getElementById("userBadgeName").textContent = session.display;

  const roleTag = document.getElementById("userRoleTag");
  const roleLabels = {
    admin:       "Admin",
    rrhh:        "RRHH",
    supervisor:  "Supervisor",
    colaborador: "Colaborador",
  };
  roleTag.textContent = roleLabels[session.role] || session.role;
  roleTag.className = `role-tag role-${session.role || "colaborador"}`;

  // ── Visibilidad por rol ────────────────────────────────────────
  // admin-only: solo para rol "admin"
  document.querySelectorAll(".admin-only, .tab-admin-only").forEach((el) =>
    el.classList.toggle("hidden", !isAdmin()));

  // rrhh-only: admin + rrhh
  document.querySelectorAll(".rrhh-only, .tab-rrhh-only").forEach((el) =>
    el.classList.toggle("hidden", !isRRHH()));

  // supervisor-only: admin + rrhh + supervisor
  document.querySelectorAll(".supervisor-only, .tab-supervisor-only").forEach((el) =>
    el.classList.toggle("hidden", !isSupervisor()));

  // colab-only: solo el rol "colaborador"
  document.querySelectorAll(".colab-only").forEach((el) =>
    el.classList.toggle("hidden", isSupervisor()));

  document.getElementById("headerDate").textContent = new Date().toLocaleDateString("es-PE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  iniciarRelojPeru();

  if (callbacks.onAppMostrada) await callbacks.onAppMostrada(session);
}

export function mostrarLogin() {
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("appScreen").classList.add("hidden");
}

// ── Navegación por tabs ───────────────────────────────────────────

export function initTabNav(tabHandlers = {}) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tab = btn.dataset.tab;
      activarTab(tab);
      if (tabHandlers[tab]) await tabHandlers[tab]();
    });
  });
}

// ── Login ─────────────────────────────────────────────────────────

export function initLoginForm(onSuccess) {
  document.getElementById("formLogin").addEventListener("submit", async function (e) {
    e.preventDefault();
    const submitBtn = this.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const userInput = document.getElementById("loginUser");
    const passInput = document.getElementById("loginPass");
    const errorBox  = document.getElementById("loginErrorBox");

    clearErrors(["err-loginUser", "err-loginPass"], [userInput, passInput]);
    errorBox.classList.remove("show");

    // Verificar bloqueo activo
    if (isLoginBlocked()) {
      const secs = getBlockSecondsLeft();
      const msg  = secs > 60
        ? `Acceso bloqueado. Intenta en ${Math.ceil(secs / 60)} min.`
        : `Acceso bloqueado. Intenta en ${secs} seg.`;
      errorBox.textContent = msg;
      errorBox.classList.add("show");
      if (submitBtn) submitBtn.disabled = false;
      return;
    }

    const user = userInput.value.trim();
    const pass = passInput.value;

    if (!user) { setError("err-loginUser", userInput, "Ingresa tu usuario."); if (submitBtn) submitBtn.disabled = false; return; }
    if (!pass) { setError("err-loginPass", passInput, "Ingresa tu contraseña."); if (submitBtn) submitBtn.disabled = false; return; }

    try {
      const { data: perfil, error: perfilErr } = await getPorUsername(user);

      if (perfilErr || !perfil) {
        await _manejarFallo(user, errorBox);
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      // Verificar si el usuario está activo
      if (perfil.activo === false) {
        errorBox.textContent = "Tu cuenta está desactivada. Contacta al administrador.";
        errorBox.classList.add("show");
        logAsync("login_bloqueado", "warning", `Cuenta inactiva: ${user}`);
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
        email: perfil.email,
        password: pass,
      });

      if (authErr || !authData?.user) {
        await _manejarFallo(user, errorBox);
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      // Login exitoso
      resetLoginFails();
      const session = {
        uid:      authData.user.id,
        email:    perfil.email,
        username: perfil.username,
        display:  perfil.display_name || perfil.username,
        role:     perfil.rol,
      };
      setSession(session);

      // Limpiar el JWT de la memoria de Supabase JS inmediatamente.
      // signInWithPassword() se usa solo para verificar credenciales y
      // obtener el uid. Mantener el JWT en memoria causa que las requests
      // DB vayan como 'authenticated' y, cuando expira (1h), devuelvan 401
      // porque autoRefreshToken:false impide renovarlo.
      // Con scope:'local' solo limpia el estado local sin llamar al servidor.
      await supabaseClient.auth.signOut({ scope: 'local' });

      await audit("login", `Inicio de sesión: ${session.display} [${session.role}]`);
      logAsync("login_exitoso", "info", `Sesión iniciada: ${session.username} [${session.role}]`);

      await onSuccess(session);
    } catch (err) {
      console.error("Error inesperado en login:", err);
      errorBox.textContent = "Error de conexión. Intenta de nuevo.";
      errorBox.classList.add("show");
      logAsync("login_error", "critical", `Error inesperado en login para: ${user}`);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById("togglePass")?.addEventListener("click", () => {
    const inp = document.getElementById("loginPass");
    inp.type  = inp.type === "password" ? "text" : "password";
  });
}

// ── Logout ────────────────────────────────────────────────────────

export function initLogout() {
  document.getElementById("btnLogout").addEventListener("click", async () => {
    const appVisible = !document.getElementById("appScreen").classList.contains("hidden");
    if (appVisible && _tieneDatosSinGuardar()) {
      const confirmar = await mostrarConfirm(
        "¿Cerrar sesión?",
        "Tienes campos con datos sin guardar. Si cierras sesión se perderán.",
        "Cerrar igual",
      );
      if (!confirmar) return;
    }
    const s = getSession();
    if (s) {
      await audit("logout", `Cierre de sesión: ${s.display}`);
      logAsync("logout", "info", `Sesión cerrada: ${s.username}`);
    }
    clearSession();
    await supabaseClient.auth.signOut();
    location.reload();
  });
}

// ── Helpers internos ──────────────────────────────────────────────

async function _manejarFallo(user, errorBox) {
  const fails = incrementLoginFails();
  const ip    = await getClientIP().catch(() => "desconocida");

  if (fails >= MAX_LOGIN_TRIES) {
    const duration = blockLogin();
    const minutos  = Math.ceil(duration / 60000);
    errorBox.textContent = `Acceso bloqueado temporalmente. Intenta en ${minutos} min.`;
    logAsync("cuenta_bloqueada", "critical", `Cuenta bloqueada tras ${fails} intentos: ${user} — IP: ${ip}`);
    // Alerta WhatsApp de seguridad (siempre activa, incluyendo domingos)
    notificarSeguridad(msgCuentaBloqueada(user, minutos, ip));
  } else {
    errorBox.textContent = "Usuario o contraseña incorrectos.";
    logAsync("login_fallido", "warning", `Intento fallido (${fails}/${MAX_LOGIN_TRIES}): ${user} — IP: ${ip}`);
    // Alertar por WhatsApp después del 3er intento
    if (fails >= 3) {
      notificarSeguridad(msgLoginFallido(user, ip));
    }
  }
  errorBox.classList.add("show");
}

function _tieneDatosSinGuardar() {
  return ["obsTexto", "nombreTrabajador", "horaEntrada", "ventaEfectivo", "ventaYape", "ventaPlin", "gananciaDelDia"]
    .some((id) => {
      const el = document.getElementById(id);
      return el && (el.value || "").trim().length > 0;
    });
}
