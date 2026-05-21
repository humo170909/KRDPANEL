// ================================================================
// services/observaciones.service.js — KRD Importaciones
// Capa de datos para la tabla "observaciones_mercaderia".
// ================================================================

import { supabaseClient } from "../core/config.js";
import { getSession }     from "../core/session.js";

export async function getObservaciones() {
  const s = getSession();
  let query = supabaseClient
    .from("observaciones_mercaderia")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(200);
  if (s?.role !== "admin") {
    query = query.eq("usuario", s.username);
  }
  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function getCountObsPendientes() {
  const { count, error } = await supabaseClient
    .from("observaciones_mercaderia")
    .select("id", { count: "exact", head: true })
    .eq("leida_admin", false);
  if (error) return 0;
  return count || 0;
}

export async function insertarObservacion(obs) {
  return supabaseClient.from("observaciones_mercaderia").insert(obs);
}

export async function marcarObservacionLeida(id) {
  return supabaseClient
    .from("observaciones_mercaderia")
    .update({ leida_admin: true })
    .eq("id", id);
}

export async function marcarTodasObservacionesLeidas() {
  return supabaseClient
    .from("observaciones_mercaderia")
    .update({ leida_admin: true })
    .eq("leida_admin", false);
}

export async function eliminarObservacionById(id) {
  return supabaseClient
    .from("observaciones_mercaderia")
    .delete()
    .eq("id", id);
}
