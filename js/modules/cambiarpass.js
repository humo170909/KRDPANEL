// ================================================================
// modules/cambiarpass.js — KRD Importaciones
// Modal para cambio de contraseña (admin y colaboradores).
// ================================================================

import { supabaseClient }  from "../core/config.js";
import { getSession }      from "../core/session.js";
import { mostrarToast }    from "../utils/helpers.js";
import { audit }           from "../services/auditoria.service.js";

export function initCambiarPass() {
  document.getElementById("btnCambiarPass")?.addEventListener("click", () => {
    const overlay = document.getElementById("modalCambiarPassOverlay");
    document.getElementById("passActual").value         = "";
    document.getElementById("passNueva").value          = "";
    document.getElementById("passConfirmar").value      = "";
    document.getElementById("err-pass-actual").textContent   = "";
    document.getElementById("err-pass-nueva").textContent    = "";
    document.getElementById("err-pass-confirmar").textContent = "";
    overlay.classList.add("active");
    setTimeout(() => document.getElementById("passActual").focus(), 80);
  });

  document.getElementById("modalCambiarPassCerrar")?.addEventListener("click", () =>
    document.getElementById("modalCambiarPassOverlay").classList.remove("active"));

  document.getElementById("modalCambiarPassCancelar")?.addEventListener("click", () =>
    document.getElementById("modalCambiarPassOverlay").classList.remove("active"));

  document.getElementById("formCambiarPass")?.addEventListener("submit", async function (e) {
    e.preventDefault();
    const passActual    = document.getElementById("passActual").value;
    const passNueva     = document.getElementById("passNueva").value;
    const passConfirmar = document.getElementById("passConfirmar").value;
    const errActual     = document.getElementById("err-pass-actual");
    const errNueva      = document.getElementById("err-pass-nueva");
    const errConfirmar  = document.getElementById("err-pass-confirmar");
    const btnGuardar    = document.getElementById("btnGuardarPass");

    errActual.textContent = errNueva.textContent = errConfirmar.textContent = "";

    let ok = true;
    if (!passActual)                           { errActual.textContent    = "Ingresa tu contraseña actual."; ok = false; }
    if (!passNueva || passNueva.length < 6)    { errNueva.textContent     = "Mínimo 6 caracteres."; ok = false; }
    if (passNueva !== passConfirmar)           { errConfirmar.textContent = "Las contraseñas no coinciden."; ok = false; }
    if (passActual === passNueva)              { errNueva.textContent     = "La nueva contraseña debe ser diferente a la actual."; ok = false; }
    if (!ok) return;

    btnGuardar.disabled    = true;
    btnGuardar.textContent = "Guardando...";

    try {
      const s = getSession();
      const { error: authErr } = await supabaseClient.auth.signInWithPassword({ email: s.email, password: passActual });
      if (authErr) { errActual.textContent = "Contraseña actual incorrecta."; return; }

      const { error: updateErr } = await supabaseClient.auth.updateUser({ password: passNueva });
      if (updateErr) { errNueva.textContent = "Error al actualizar: " + updateErr.message; return; }

      await supabaseClient.from("perfiles").update({
        ultimo_cambio_pass: new Date().toISOString(),
        pass_cambiada_por:  s.display,
      }).eq("username", s.username);

      await audit("add", `Contraseña cambiada por: ${s.display}`);
      document.getElementById("modalCambiarPassOverlay").classList.remove("active");
      mostrarToast("✓ Contraseña actualizada correctamente.", "success");
    } catch (err) {
      console.error(err);
      mostrarToast("Error inesperado. Intenta de nuevo.", "error");
    } finally {
      btnGuardar.disabled    = false;
      btnGuardar.textContent = "Guardar nueva contraseña";
    }
  });
}
