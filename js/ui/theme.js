// ================================================================
// ui/theme.js — KRD Importaciones
// Modo claro/oscuro con [data-theme] en <html>.
// Se aplica antes del DOMContentLoaded para evitar parpadeo (FOUC).
// ================================================================

const THEME_KEY   = "krd_theme";
const DARK_VALUE  = "dark";
const LIGHT_VALUE = "light";

// Aplicar tema guardado antes del primer render
const _saved = localStorage.getItem(THEME_KEY) || DARK_VALUE;
document.documentElement.setAttribute("data-theme", _saved);

export function initTheme() {
  const btn = document.getElementById("btnThemeToggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next    = current === LIGHT_VALUE ? DARK_VALUE : LIGHT_VALUE;
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });
}

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") || DARK_VALUE;
}
