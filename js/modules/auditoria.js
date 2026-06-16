// ================================================================
// modules/auditoria.js — KRD Importaciones
// Visualización del historial de auditoría (solo admin).
// ================================================================

import { isAdmin }          from "../core/session.js";
import { sanitize, mostrarToast } from "../utils/helpers.js";
import { mostrarConfirm }   from "../ui/modals.js";
import { getAudit, audit }  from "../services/auditoria.service.js";
import { supabaseClient }   from "../core/config.js";

export async function renderAuditoria() {
  if (!isAdmin()) return;
  const lista = await getAudit();
  const tbody = document.getElementById("bodyAuditoria");
  const empty = document.getElementById("emptyAuditoria");

  if (!lista.length) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const claseMap = { login:"audit-login", logout:"audit-logout", add:"audit-add", delete:"audit-delete", clear:"audit-clear" };
  const labelMap = { login:"LOGIN", logout:"LOGOUT", add:"REGISTRO", delete:"ELIMINACIÓN", clear:"LIMPIEZA" };

  tbody.innerHTML = lista.map((e, i) => {
    const fecha = new Date(e.fecha).toLocaleString("es-PE");
    return `
    <tr>
      <td>${i + 1}</td>
      <td class="val-mono" style="font-size:0.75rem">${sanitize(fecha)}</td>
      <td>${sanitize(e.usuario)}</td>
      <td><span class="role-tag ${e.rol === "employee" ? "role-employee" : ""}">${e.rol === "admin" ? "Admin" : "Colaborador"}</span></td>
      <td><span class="audit-action ${claseMap[e.tipo] || ""}">${labelMap[e.tipo] || sanitize(e.tipo)}</span></td>
      <td style="color:var(--text-secondary);font-size:0.8rem">${sanitize(e.detalle)}</td>
      <td style="font-size:0.75rem;color:var(--text-muted)">${sanitize(e.ip_origen || "—")}</td>
      <td style="font-size:0.75rem;color:var(--text-muted)">${sanitize(e.dispositivo || "—")}</td>
    </tr>`;
  }).join("");
}

export function initAuditoria() {
  document.getElementById("clearAuditoria")?.addEventListener("click", async () => {
    if (!isAdmin()) return;
    if (!(await mostrarConfirm(
      "¿Eliminar historial de auditoría?",
      "Se borrará todo el registro de acciones. Esta operación es irreversible.",
      "Eliminar historial",
    ))) return;
    await audit("clear", "Historial de auditoría limpiado");
    const { error } = await supabaseClient.from("auditoria").delete().neq("id", "dummy");
    if (error) { console.error(error); mostrarToast("Error al limpiar auditoría.", "error"); return; }
    await renderAuditoria();
    mostrarToast("Historial limpiado.", "info");
  });
}
