// ================================================================
// services/usuarios.service.js — KRD Importaciones
// Capa de datos para la tabla "perfiles".
// ================================================================

import { supabaseClient } from "../core/config.js";

// Columnas seguras para listar usuarios (no exponer campos internos innecesarios)
const COLS_LISTA = "id, email, username, display_name, rol, activo, creado_en";

export async function getUsuarios() {
  const { data, error } = await supabaseClient
    .from("perfiles")
    .select(COLS_LISTA)
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
  // Usar .eq() con valor normalizado — .ilike() permite wildcards (%, _)
  // que un atacante podría usar para extraer usuarios arbitrarios.
  const normalized = String(username || "").trim().toLowerCase();
  return supabaseClient
    .from("perfiles")
    .select("id, email, username, display_name, rol, activo")
    .eq("username", normalized)
    .single();
}

