// ================================================================
// js/core/env.js — KRD Importaciones
// ----------------------------------------------------------------
// ⚠️  ARCHIVO SENSIBLE — NUNCA SUBIR A GIT
//     Ya está incluido en .gitignore. No lo elimines de ahí.
// ----------------------------------------------------------------
// INSTRUCCIONES:
//   1. Este archivo es tu fuente local de credenciales.
//   2. Pega los valores reales de tu proyecto (ver abajo).
//   3. Cuando despliegues en Vercel / Netlify, usa sus paneles
//      de variables de entorno y un Edge Function o build step
//      que inyecte este objeto (ver env.example.js para guía).
// ================================================================

window.KRD_ENV = {
  // ── Supabase ──────────────────────────────────────────────────
  // Obtén estos valores en:
  //   Supabase Dashboard → Settings → API
  SUPABASE_URL: "https://vbphssxbfuthmkcldnkb.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicGhzc3hiZnV0aG1rY2xkbmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NTMzMjIsImV4cCI6MjA5MDEyOTMyMn0.FHbdMKMWT9V2tf-Z0KGbZtKxcM1c30gX7GeRWXdvq10",

  // ── CallMeBot WhatsApp API ────────────────────────────────────
  // Obtén los valores en: https://www.callmebot.com
  WA_PHONE:  "51993100282",   // ej: "51999999999"
  WA_APIKEY: "3956084",
};
