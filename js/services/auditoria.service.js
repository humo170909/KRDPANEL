// ================================================================
// services/auditoria.service.js — KRD Importaciones
// Capa de datos exclusiva para la tabla "auditoria" en Supabase.
// Solo queries y escritura; sin lógica de UI.
// ================================================================

import { supabaseClient } from "../core/config.js";
import { getSession }     from "../core/session.js";
import { getClientIP, getDispositivoInfo } from "../utils/device.js";

export async function getAudit() {
  const { data, error } = await supabaseClient
    .from("auditoria")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(500);
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function audit(tipo, detalle) {
  const s          = getSession();
  const ip         = await getClientIP();
  const dispositivo = getDispositivoInfo();
  const entry = {
    fecha:      new Date().toISOString(),
    usuario:    s ? s.username : "—",
    rol:        s ? s.role : "—",
    tipo,
    detalle,
    ip_origen:  ip,
    dispositivo,
  };
  const { error } = await supabaseClient.from("auditoria").insert(entry);
  if (error) console.error("Audit error:", error);
}
