// ================================================================
// services/logs.service.js — KRD Importaciones
// Registro y consulta de logs de seguridad en Supabase.
// ================================================================

import { supabaseClient } from "../core/config.js";
import { getClientIP, getDispositivoInfo } from "../utils/device.js";
import { getSession } from "../core/session.js";

const TABLE = "logs_seguridad";

export async function getLogs(filtros = {}) {
  let q = supabaseClient.from(TABLE).select("*").order("fecha", { ascending: false });
  if (filtros.nivel)   q = q.eq("nivel", filtros.nivel);
  if (filtros.tipo)    q = q.eq("tipo", filtros.tipo);
  if (filtros.usuario) q = q.ilike("usuario", `%${filtros.usuario}%`);
  if (filtros.desde)   q = q.gte("fecha", filtros.desde);
  const { data, error } = await q.limit(1000);
  if (error) { console.error("logs.service getLogs:", error); return []; }
  return data || [];
}

export async function registrarLog(tipo, nivel = "info", detalle, metadata = {}) {
  try {
    const s   = getSession();
    const ip  = await getClientIP();
    const dev = getDispositivoInfo();
    const entry = {
      tipo,
      nivel,
      detalle,
      usuario:    s?.username || "—",
      ip,
      dispositivo: dev,
      metadata:   Object.keys(metadata).length ? metadata : null,
    };
    await supabaseClient.from(TABLE).insert(entry);
  } catch (err) {
    console.warn("registrarLog error (non-critical):", err);
  }
}

// Versión fire-and-forget: no bloquea el flujo de la app
export function logAsync(tipo, nivel, detalle, metadata = {}) {
  registrarLog(tipo, nivel, detalle, metadata);
}

export async function limpiarLogsAntiguos(diasMax = 90) {
  const corte = new Date(Date.now() - diasMax * 86400000).toISOString();
  return supabaseClient.from(TABLE).delete().lt("fecha", corte);
}
