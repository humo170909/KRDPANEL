// ================================================================
// services/ventas.service.js — KRD Importaciones
// Capa de datos para las tablas "meses", "dias" y "metas_ventas".
// ================================================================

import { supabaseClient } from "../core/config.js";
import { uid }            from "../utils/helpers.js";
import { getSession }     from "../core/session.js";

// ── Meses de ventas ──

export async function getMeses() {
  const { data, error } = await supabaseClient
    .from("meses")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function crearMes(nombre) {
  const nuevoMes = { id: uid(), nombre };
  return supabaseClient.from("meses").insert(nuevoMes).then((res) => ({ ...res, nuevoMes }));
}

// ── Días de ventas ──

export async function getDias(mesId) {
  const { data, error } = await supabaseClient
    .from("dias")
    .select("*")
    .eq("mes_id", mesId)
    .order("fecha", { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function insertarDia(dia) {
  return supabaseClient.from("dias").insert(dia);
}

export async function actualizarDia(id, campos) {
  return supabaseClient.from("dias").update(campos).eq("id", id);
}

export async function eliminarDia(id) {
  return supabaseClient.from("dias").delete().eq("id", id);
}

export async function limpiarDiasMes(mesId) {
  return supabaseClient.from("dias").delete().eq("mes_id", mesId);
}

// ── Meta de ventas ──

export async function getMetaMes(mesId) {
  if (!mesId) return null;
  const { data, error } = await supabaseClient
    .from("metas_ventas")
    .select("*")
    .eq("mes_id", mesId)
    .order("creado_en", { ascending: false })
    .limit(1);
  if (error) { console.error(error); return null; }
  return data && data.length ? data[0] : null;
}

export async function guardarMetaMes(mesId, meta) {
  const s           = getSession();
  const metaExistente = await getMetaMes(mesId);
  if (metaExistente) {
    return supabaseClient
      .from("metas_ventas")
      .update({ meta, creado_por: s?.display || "—" })
      .eq("id", metaExistente.id);
  }
  return supabaseClient
    .from("metas_ventas")
    .insert({ id: uid(), mes_id: mesId, meta, creado_por: s?.display || "—" });
}
