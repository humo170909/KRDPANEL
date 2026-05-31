// ================================================================
// ui/theme.js — KRD Importaciones
// Modo claro/oscuro con persistencia en localStorage.
// Se aplica inmediatamente al cargar (antes del DOMContentLoaded)
// para evitar el parpadeo de tema.
// ================================================================

const THEME_KEY = "krd_theme";

// Aplicar tema guardado de inmediato (antes del render)
if (localStorage.getItem(THEME_KEY) === "light") {
  document.body.classList.add("light-mode");
}

export function initTheme() {
  const btn = document.getElementById("btnThemeToggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-mode");
    localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
  });
}
