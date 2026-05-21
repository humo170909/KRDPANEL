// ================================================================
// utils/geolocalizacion.js — KRD Importaciones
// Geolocalización para control de asistencia por sucursal.
// ================================================================

// Obtiene la posición GPS del dispositivo
export function obtenerPosicion(opciones = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalización no soportada en este navegador."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat:       pos.coords.latitude,
        lng:       pos.coords.longitude,
        precision: Math.round(pos.coords.accuracy),
      }),
      (err) => reject(new Error(_geoErrMsg(err))),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0, ...opciones }
    );
  });
}

// Fórmula de Haversine — distancia en metros entre dos coordenadas GPS
export function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R  = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Valida si la posición está dentro del radio de alguna sucursal activa
// sucursales: array de { id, nombre, lat, lng, radio_metros }
// Devuelve: { valida, sucursal, distancia }
export function validarUbicacion(lat, lng, sucursales) {
  if (!sucursales || !sucursales.length) {
    return { valida: true, sucursal: null, distancia: null };
  }
  let cercana = null;
  let distMin = Infinity;
  for (const s of sucursales) {
    const d = calcularDistancia(lat, lng, s.lat, s.lng);
    if (d < distMin) { distMin = d; cercana = s; }
  }
  return {
    valida:    distMin <= (cercana?.radio_metros ?? 200),
    sucursal:  cercana,
    distancia: distMin,
  };
}

// Genera un enlace a Google Maps con las coordenadas
export function linkMaps(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function _geoErrMsg(err) {
  switch (err.code) {
    case 1:  return "Permiso de ubicación denegado. Actívalo en la configuración del navegador.";
    case 2:  return "No se pudo obtener la ubicación. Verifica que el GPS esté activo.";
    case 3:  return "Tiempo de espera agotado. Intenta de nuevo en un lugar con mejor señal.";
    default: return "Error de geolocalización desconocido.";
  }
}
