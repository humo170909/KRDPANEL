// ================================================================
// services/rrhh.service.js — KRD Importaciones
// CRUD para la tabla rrhh_eventos: vacaciones, permisos,
// licencias, tardanzas, sanciones, horas_extra, justificaciones.
// ================================================================

import { supabaseClient } from "../core/config.js";

const TABLE = "rrhh_eventos";

export async function getEventosRRHH(filtros = {}) {
  let q = supabaseClient.from(TABLE).select("*").order("fecha_inicio", { ascending: false });
  if (filtros.tipo)        q = q.eq("tipo", filtros.tipo);
  if (filtros.estado)      q = q.eq("estado", filtros.estado);
  if (filtros.colaborador) q = q.ilike("colaborador", `%${filtros.colaborador}%`);
  if (filtros.desde)       q = q.gte("fecha_inicio", filtros.desde);
  if (filtros.hasta)       q = q.lte("fecha_inicio", filtros.hasta);
  const { data, error } = await q.limit(500);
  if (error) { console.error("rrhh.service getEventos:", error); return []; }
  return data || [];
}

export async function getEventosColaborador(colaborador) {
  const { data, error } = await supabaseClient
    .from(TABLE).select("*")
    .ilike("colaborador", `%${colaborador}%`)
    .order("fecha_inicio", { ascending: false })
    .limit(200);
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function crearEvento(evento) {
  return supabaseClient.from(TABLE).insert(evento).select().single();
}

export async function actualizarEvento(id, cambios) {
  return supabaseClient.from(TABLE).update(cambios).eq("id", id).select().single();
}

export async function eliminarEvento(id) {
  return supabaseClient.from(TABLE).delete().eq("id", id);
}

export async function getResumenMensual(año, mes) {
  const mesStr  = String(mes).padStart(2, "0");
  const desde   = `${año}-${mesStr}-01`;
  const hasta   = `${año}-${mesStr}-31`;
  const { data, error } = await supabaseClient
    .from(TABLE).select("tipo, estado, horas")
    .gte("fecha_inicio", desde).lte("fecha_inicio", hasta);
  if (error) return {};
  const out = { vacacion: 0, permiso: 0, licencia: 0, tardanza: 0, sancion: 0, horas_extra: 0, justificacion: 0 };
  (data || []).forEach((e) => { if (out[e.tipo] !== undefined) out[e.tipo]++; });
  return out;
}
