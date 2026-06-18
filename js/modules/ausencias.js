// ================================================================
// modules/ausencias.js — KRD Importaciones
// Detección automática de ausencias y notificación por WhatsApp.
// Se ejecuta si ya son las 11:00 AM (hora Perú) y hay colaboradores
// sin registro de entrada — se notifica UNA SOLA VEZ por día.
// ================================================================

import { supabaseClient }  from "../core/config.js";
import { isAdmin }         from "../core/session.js";
import { mostrarToast }    from "../utils/helpers.js";
import { notificarLaboral } from "../services/notificaciones.service.js";

const AUSENCIAS_KEY_PREFIX = "krd_ausencias_";

function _peruNow() {
  const ahora = new Date();
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
  return new Date(utcMs - 5 * 3600000);
}

export async function verificarAusencias() {
  if (!isAdmin()) return;

  const peru     = _peruNow();
  const hoy      = `${peru.getFullYear()}-${String(peru.getMonth() + 1).padStart(2, "0")}-${String(peru.getDate()).padStart(2, "0")}`;
  const llave    = AUSENCIAS_KEY_PREFIX + hoy;

  if (localStorage.getItem(llave)) return; // ya verificado hoy
  if (peru.getHours() * 60 + peru.getMinutes() < 11 * 60) return; // antes de 11:00 AM

  const { data: perfiles, error: perfilesErr } = await supabaseClient
    .from("perfiles")
    .select("display_name, username")
    .neq("rol", "admin");

  if (perfilesErr || !perfiles?.length) {
    localStorage.setItem(llave, "sin-colaboradores");
    return;
  }

  const { data: entradas } = await supabaseClient
    .from("asistencia")
    .select("nombre")
    .eq("fecha", hoy);

  const presentes = new Set(
    (entradas || []).map((r) => (r.nombre || "").toLowerCase().trim()),
  );

  const ausentes = perfiles.filter((p) => {
    const nombre = (p.display_name || p.username || "").toLowerCase().trim();
    return nombre && !presentes.has(nombre);
  });

  localStorage.setItem(llave, ausentes.length ? "notificado" : "todos-presentes");
  if (!ausentes.length) return;

  const horaStr   = `${String(peru.getHours()).padStart(2, "0")}:${String(peru.getMinutes()).padStart(2, "0")}`;
  const fechaLeg  = peru.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const listaMsg  = ausentes.map((p) => `• ${p.display_name || p.username}`).join("\n");
  const waMsg     = `🚨 *KRD Importaciones — AUSENCIAS*\n\n📅 ${fechaLeg}\n🕐 Verificado: ${horaStr} (PE)\n\n⚠️ Sin registro de entrada:\n\n${listaMsg}\n\n_Notificación automática del sistema_`;

  await notificarLaboral(waMsg);
  mostrarToast(`⚠️ ${ausentes.length} colaborador(es) sin entrada hoy.`, "error");
}
