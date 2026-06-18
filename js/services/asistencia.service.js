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
  // Buscar por user_id (UUID del usuario) en vez de por display_name.
  // .ilike("nombre", s.display) era vulnerable: dos nombres parecidos podían
  // cruzar registros, y display_name puede contener wildcards de LIKE.
  // Si la tabla no tiene columna user_id aún, usar eq exacto en su lugar.
  let query = supabaseClient
    .from("asistencia")
    .select("*")
    .eq("fecha", hoy);
  if (s.uid) {
    query = query.eq("user_id", s.uid);
  } else {
    // Fallback: eq exacto (no ilike) sobre display_name normalizado
    query = query.eq("nombre", s.display);
  }
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
  // Guard explícito: nunca ejecutar un DELETE sin filtro de mes o de fecha.
  // Un mesId vacío/null sin este control podría eliminar TODA la tabla.
  if (mesId) {
    return supabaseClient.from("asistencia").delete().eq("mes_asist_id", mesId);
  }
  return supabaseClient.from("asistencia").delete().eq("fecha", getTodayStr());
}

export async function actualizarRegistroAsistencia(id, campos) {
  return supabaseClient.from("asistencia").update(campos).eq("id", id);
}
