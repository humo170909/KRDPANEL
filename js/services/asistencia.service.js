// ================================================================
// services/asistencia.service.js — KRD Importaciones
// Capa de datos para las tablas "asistencia" y "meses_asistencia".
// Solo queries y escritura; sin lógica de UI ni DOM.
// ================================================================

import { supabaseClient } from "../core/config.js";
import { getSession }     from "../core/session.js";
import { getTodayStr }    from "../utils/helpers.js";

// ── Meses de asistencia ──

export async function getMesesAsistencia() {
  const { data, error } = await supabaseClient
    .from("meses_asistencia")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function crearMesAsistencia(nuevoMes) {
  return supabaseClient.from("meses_asistencia").insert(nuevoMes);
}

// ── Registros de asistencia ──

export async function getAsistencias(mesId) {
  if (mesId) {
    const { data, error } = await supabaseClient
      .from("asistencia")
      .select("*")
      .eq("mes_asist_id", mesId)
      .order("fecha",   { ascending: true })
      .order("entrada", { ascending: true });
    if (error) { console.error(error); return []; }
    return data || [];
  }
  const hoy = getTodayStr();
  const { data, error } = await supabaseClient
    .from("asistencia")
    .select("*")
    .eq("fecha", hoy)
    .order("entrada", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function getAsistenciasHoy(mesId) {
  const hoy = getTodayStr();
  let query = supabaseClient.from("asistencia").select("*").eq("fecha", hoy);
  if (mesId) query = query.eq("mes_asist_id", mesId);
  const { data, error } = await query.order("entrada", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function getRegistroColabHoy(mesId) {
  const s   = getSession();
  const hoy = getTodayStr();
  let query = supabaseClient
    .from("asistencia")
    .select("*")
    .eq("fecha", hoy)
    .ilike("nombre", s.display);
  if (mesId) query = query.eq("mes_asist_id", mesId);
  const { data, error } = await query.limit(1);
  if (error) { console.error(error); return null; }
  return data && data.length ? data[0] : null;
}

export async function insertarAsistencia(registro) {
  return supabaseClient.from("asistencia").insert(registro);
}

export async function actualizarSalidaAsistencia(id, salida) {
  return supabaseClient.from("asistencia").update({ salida }).eq("id", id);
}

export async function eliminarAsistencia(id) {
  return supabaseClient.from("asistencia").delete().eq("id", id);
}

export async function limpiarAsistenciasMes(mesId) {
  let query = supabaseClient.from("asistencia").delete();
  if (mesId) return query.eq("mes_asist_id", mesId);
  return query.eq("fecha", getTodayStr());
}

export async function actualizarRegistroAsistencia(id, campos) {
  return supabaseClient.from("asistencia").update(campos).eq("id", id);
}
