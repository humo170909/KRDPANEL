// ================================================================
// services/usuarios.service.js — KRD Importaciones
// Capa de datos para la tabla "perfiles".
// ================================================================

import { supabaseClient } from "../core/config.js";

export async function getUsuarios() {
  const { data, error } = await supabaseClient
    .from("perfiles")
    .select("*")
    .order("display_name", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function crearPerfil(perfil) {
  return supabaseClient.from("perfiles").insert(perfil);
}

export async function actualizarPerfil(id, campos) {
  return supabaseClient.from("perfiles").update(campos).eq("id", id);
}

export async function getPorUsername(username) {
  return supabaseClient
    .from("perfiles")
    .select("id, email, username, display_name, rol, activo")
    .ilike("username", username)
    .single();
}

export async function getActivoPorUsername(username) {
  const { data, error } = await supabaseClient
    .from("perfiles")
    .select("activo")
    .ilike("username", username)
    .maybeSingle();
  if (error) return null;
  return data?.activo ?? null;
}
