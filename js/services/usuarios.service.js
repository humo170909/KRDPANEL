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
    .select("email, username, display_name, rol")
    .ilike("username", username)
    .single();
}
