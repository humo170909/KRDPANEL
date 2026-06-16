// ================================================================
// services/sucursales.service.js — KRD Importaciones
// CRUD para la tabla "sucursales" (geolocalización de sedes).
// ================================================================

import { supabaseClient } from "../core/config.js";

const TABLE = "sucursales";

export async function getSucursales(soloActivas = true) {
  let q = supabaseClient.from(TABLE).select("*").order("nombre");
  if (soloActivas) q = q.eq("activa", true);
  const { data, error } = await q;
  if (error) { console.error("sucursales.service:", error); return []; }
  return data || [];
}

export async function crearSucursal(sucursal) {
  return supabaseClient.from(TABLE).insert(sucursal).select().single();
}

export async function actualizarSucursal(id, cambios) {
  return supabaseClient.from(TABLE).update(cambios).eq("id", id).select().single();
}

export async function eliminarSucursal(id) {
  return supabaseClient.from(TABLE).delete().eq("id", id);
}
