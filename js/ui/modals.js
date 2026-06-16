// ================================================================
// ui/modals.js — KRD Importaciones
// Todas las funciones de modales como Promises.
// Patrón: abre modal → espera acción del usuario → resuelve Promise.
// ================================================================

import { sanitize, getEstadoAsistencia, getNowTimeStr } from "../utils/helpers.js";

// ── Modal de confirmación crítica (eliminar, limpiar) ──
export function mostrarConfirm(titulo, descripcion, labelConfirmar = "Confirmar") {
  return new Promise((resolve) => {
    document.getElementById("confirmTitle").textContent    = titulo;
    document.getElementById("confirmDesc").textContent     = descripcion;
    document.getElementById("confirmAceptar").textContent  = labelConfirmar;
    const overlay = document.getElementById("modalConfirmOverlay");
    overlay.classList.add("active");

    const cleanup = () => {
      document.getElementById("confirmAceptar").removeEventListener("click", onAceptar);
      document.getElementById("confirmCancelar").removeEventListener("click", onCancelar);
    };
    const onAceptar  = () => { overlay.classList.remove("active"); cleanup(); resolve(true); };
    const onCancelar = () => { overlay.classList.remove("active"); cleanup(); resolve(false); };
    document.getElementById("confirmAceptar").addEventListener("click", onAceptar);
    document.getElementById("confirmCancelar").addEventListener("click", onCancelar);
  });
}

// ── Modal de guardar con preview ──
export function mostrarGuardar(descripcion, previewHtml) {
  return new Promise((resolve) => {
    document.getElementById("guardarDesc").textContent        = descripcion;
    document.getElementById("guardarPreviewBox").innerHTML    = previewHtml;
    const overlay = document.getElementById("modalGuardarOverlay");
    overlay.classList.add("active");

    const cleanup = () => {
      document.getElementById("guardarAceptar").removeEventListener("click", onAceptar);
      document.getElementById("guardarCancelar").removeEventListener("click", onCancelar);
    };
    const onAceptar  = () => { overlay.classList.remove("active"); cleanup(); resolve(true); };
    const onCancelar = () => { overlay.classList.remove("active"); cleanup(); resolve(false); };
    document.getElementById("guardarAceptar").addEventListener("click", onAceptar);
    document.getElementById("guardarCancelar").addEventListener("click", onCancelar);
  });
}

// ── Modal de reautenticación (exportar Excel) ──
export function mostrarReauth(supabaseClient, session) {
  return new Promise((resolve) => {
    const overlay   = document.getElementById("modalReauthOverlay");
    const inputPass = document.getElementById("reauthPass");
    const errEl     = document.getElementById("err-reauth");
    inputPass.value = "";
    errEl.textContent = "";
    inputPass.classList.remove("input-error");
    overlay.classList.add("active");
    setTimeout(() => inputPass.focus(), 80);

    const cleanup = () => {
      document.getElementById("reauthAceptar").removeEventListener("click", onAceptar);
      document.getElementById("reauthCancelar").removeEventListener("click", onCancelar);
      document.getElementById("reauthCerrar").removeEventListener("click", onCerrar);
      inputPass.removeEventListener("keydown", onKeydown);
    };
    const onAceptar = async () => {
      const pass = inputPass.value.trim();
      if (!pass) { errEl.textContent = "Ingresa tu contraseña."; inputPass.classList.add("input-error"); return; }
      if (!session || session.role !== "admin") { errEl.textContent = "No tienes permisos de administrador."; return; }
      const { error } = await supabaseClient.auth.signInWithPassword({ email: session.email, password: pass });
      if (error) {
        errEl.textContent = "Contraseña incorrecta.";
        inputPass.classList.add("input-error");
        inputPass.value = "";
        inputPass.focus();
        return;
      }
      // Sign out immediately so the client doesn't stay in 'authenticated' role
      // and keeps using anon-scoped RLS policies for subsequent queries.
      await supabaseClient.auth.signOut({ scope: "local" }).catch(() => {});
      overlay.classList.remove("active");
      cleanup();
      resolve(true);
    };
    const onCancelar = () => { overlay.classList.remove("active"); cleanup(); resolve(false); };
    const onCerrar   = () => { overlay.classList.remove("active"); cleanup(); resolve(false); };
    const onKeydown  = (e) => { if (e.key === "Enter") onAceptar(); if (e.key === "Escape") onCancelar(); };
    document.getElementById("reauthAceptar").addEventListener("click", onAceptar);
    document.getElementById("reauthCancelar").addEventListener("click", onCancelar);
    document.getElementById("reauthCerrar").addEventListener("click", onCerrar);
    inputPass.addEventListener("keydown", onKeydown);
  });
}

// ── Modal de hora para colaboradores (entrada/salida) ──
export function mostrarColabHoraModal(tipo) {
  return new Promise((resolve) => {
    const overlay   = document.getElementById("modalColabHoraOverlay");
    const iconEl    = document.getElementById("colabModalIcon");
    const titleEl   = document.getElementById("colabModalTitle");
    const descEl    = document.getElementById("colabModalDesc");
    const horaInput = document.getElementById("colabModalHora");
    const errEl     = document.getElementById("err-colab-modal-hora");
    const esEntrada = tipo === "entrada";

    iconEl.className = "colab-modal-icon-wrap" + (esEntrada ? "" : " modal-icon-exit");
    iconEl.innerHTML = esEntrada
      ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`
      : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;
    titleEl.textContent = esEntrada ? "Registrar entrada" : "Registrar salida";
    descEl.textContent  = esEntrada ? "Confirma tu hora de entrada al trabajo." : "Confirma tu hora de salida del trabajo.";
    horaInput.value = getNowTimeStr();
    errEl.textContent = "";
    horaInput.classList.remove("input-error");
    overlay.classList.add("active");
    setTimeout(() => horaInput.focus(), 80);

    const cleanup = () => {
      document.getElementById("colabModalConfirmar").removeEventListener("click", onConfirmar);
      document.getElementById("colabModalCancelar").removeEventListener("click", onCancelar);
      horaInput.removeEventListener("keydown", onKeydown);
    };
    const onConfirmar = () => {
      const hora = horaInput.value.trim();
      if (!hora) { errEl.textContent = "Ingresa la hora."; horaInput.classList.add("input-error"); return; }
      overlay.classList.remove("active");
      cleanup();
      resolve(hora);
    };
    const onCancelar = () => { overlay.classList.remove("active"); cleanup(); resolve(null); };
    const onKeydown  = (e) => { if (e.key === "Enter") onConfirmar(); if (e.key === "Escape") onCancelar(); };
    document.getElementById("colabModalConfirmar").addEventListener("click", onConfirmar);
    document.getElementById("colabModalCancelar").addEventListener("click", onCancelar);
    horaInput.addEventListener("keydown", onKeydown);
  });
}

// ── Modal de justificación de tardanza ──
export function mostrarJustificacionTardanzaModal(hora) {
  return new Promise((resolve) => {
    const overlay     = document.getElementById("modalTardanzaOverlay");
    const descEl      = document.getElementById("tardanzaModalDesc");
    const reasonInput = document.getElementById("tardanzaReasonInput");
    const errEl       = document.getElementById("err-tardanza-reason");

    descEl.textContent = `Tu hora de entrada es ${hora}. Por favor describe brevemente el motivo de la tardanza.`;
    reasonInput.value  = "";
    errEl.textContent  = "";
    reasonInput.classList.remove("input-error");
    overlay.classList.add("active");
    setTimeout(() => reasonInput.focus(), 80);

    const cleanup = () => {
      document.getElementById("tardanzaAceptar").removeEventListener("click", onAceptar);
      document.getElementById("tardanzaCancelar").removeEventListener("click", onCancelar);
    };
    const onAceptar = () => {
      const text = reasonInput.value.trim();
      if (!text) { errEl.textContent = "Ingresa la justificación de la tardanza."; reasonInput.classList.add("input-error"); return; }
      overlay.classList.remove("active");
      cleanup();
      resolve(text);
    };
    const onCancelar = () => { overlay.classList.remove("active"); cleanup(); resolve(null); };
    document.getElementById("tardanzaAceptar").addEventListener("click", onAceptar);
    document.getElementById("tardanzaCancelar").addEventListener("click", onCancelar);
  });
}

// ── Modal de confirmación de observación enviada ──
export function mostrarObsConfirm(texto, nombreColab) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modalObsConfirmOverlay");
    const preview = document.getElementById("obsConfirmPreview");
    preview.innerHTML = `
      <strong>Colaborador:</strong> ${sanitize(nombreColab)}<br>
      <strong>Fecha:</strong> ${new Date().toLocaleString("es-PE")}<br>
      <strong>Mensaje:</strong> ${sanitize(texto)}
    `;
    overlay.classList.add("active");
    const btn  = document.getElementById("obsConfirmOk");
    const onOk = () => { overlay.classList.remove("active"); btn.removeEventListener("click", onOk); resolve(); };
    btn.addEventListener("click", onOk);
  });
}

// ── Modal de estado de entrada (puntual / tardanza) ──
export function mostrarEstadoEntradaModal(horaEntrada, nombreColab) {
  return new Promise((resolve) => {
    const estado    = getEstadoAsistencia(horaEntrada);
    const esTardanza = estado === "Tardanza";
    const modal    = document.getElementById("modalEstadoEntradaOverlay");
    const iconEl   = document.getElementById("estadoEntradaIcon");
    const titleEl  = document.getElementById("estadoEntradaTitle");
    const descEl   = document.getElementById("estadoEntradaDesc");
    const btnOk    = document.getElementById("estadoEntradaOk");

    if (esTardanza) {
      iconEl.textContent   = "⏰";
      titleEl.textContent  = "¡Llegaste tarde!";
      titleEl.style.color  = "#ef4444";
      descEl.innerHTML     = `<strong>${sanitize(nombreColab)}</strong>, tu hora de entrada es <strong>${horaEntrada}</strong>.<br>El límite es <strong>10:20 AM</strong>.<br><br>Tu registro queda marcado como <span style="color:#ef4444;font-weight:700">TARDANZA</span>.`;
    } else {
      iconEl.textContent   = "✅";
      titleEl.textContent  = "¡Llegaste a tiempo!";
      titleEl.style.color  = "#10b981";
      descEl.innerHTML     = `<strong>${sanitize(nombreColab)}</strong>, tu hora de entrada es <strong>${horaEntrada}</strong>.<br><br>Tu registro queda marcado como <span style="color:#10b981;font-weight:700">ASISTENCIA</span>.`;
    }

    modal.style.display = "flex";
    const onOk = () => { modal.style.display = "none"; resolve(estado); };
    btnOk.addEventListener("click", onOk, { once: true });
  });
}

// ── Modal de eliminar observación ──
export function mostrarEliminarObsModal() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("modalEliminarObsOverlay");
    overlay.classList.add("active");
    const cleanup    = () => {
      document.getElementById("elimObsAceptar").removeEventListener("click", onAceptar);
      document.getElementById("elimObsCancelar").removeEventListener("click", onCancelar);
    };
    const onAceptar  = () => { overlay.classList.remove("active"); cleanup(); resolve(true); };
    const onCancelar = () => { overlay.classList.remove("active"); cleanup(); resolve(false); };
    document.getElementById("elimObsAceptar").addEventListener("click", onAceptar);
    document.getElementById("elimObsCancelar").addEventListener("click", onCancelar);
  });
}
