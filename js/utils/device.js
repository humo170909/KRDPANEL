// ================================================================
// utils/device.js — KRD Importaciones
// Información del dispositivo y red para auditoría.
// ================================================================

import { supabaseClient } from "../core/config.js";

// Obtiene la IP pública del cliente.
// Estrategia:
//   1. Supabase RPC get_client_ip() — server-side, no spoofeable, sin CSP
//   2. Fallback: api.ipify.org — requiere connect-src en CSP
//   3. Fallback final: "desconocida"
export async function getClientIP() {
  // Intento 1: RPC de Supabase (sin dominio externo, IP real del servidor)
  try {
    const { data, error } = await supabaseClient.rpc("get_client_ip");
    if (!error && data) return data;
  } catch { /* continúa al fallback */ }

  // Intento 2: api.ipify.org (requiere https://api.ipify.org en connect-src)
  try {
    const res  = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    if (data.ip) return data.ip;
  } catch { /* continúa al fallback */ }

  return "desconocida";
}

export function getDispositivoInfo() {
  const ua = navigator.userAgent;
  let sistema   = "Desconocido";
  let navegador = "Desconocido";

  if      (/Windows/.test(ua))      sistema = "Windows";
  else if (/Android/.test(ua))      sistema = "Android";
  else if (/iPhone|iPad/.test(ua))  sistema = "iOS";
  else if (/Mac/.test(ua))          sistema = "Mac";
  else if (/Linux/.test(ua))        sistema = "Linux";

  if      (/Chrome/.test(ua) && !/Edg/.test(ua)) navegador = "Chrome";
  else if (/Firefox/.test(ua))                    navegador = "Firefox";
  else if (/Edg/.test(ua))                        navegador = "Edge";
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) navegador = "Safari";

  return `${sistema} — ${navegador}`;
}
