// ================================================================
// utils/exports.js — KRD Importaciones
// Toda la lógica de exportación a Excel (.xlsx) centralizada aquí.
// Depende de la librería global XLSX (cargada vía CDN en index.html).
// ================================================================

import { mostrarToast } from "./helpers.js";

/**
 * Exporta datos a un archivo .xlsx.
 * @param {string} filename   - Nombre del archivo sin extensión
 * @param {string} sheetName  - Nombre de la hoja
 * @param {string[]} headers  - Fila de encabezados
 * @param {any[][]} rows      - Filas de datos
 */
export function exportarExcel(filename, sheetName, headers, rows) {
  if (typeof XLSX === "undefined") {
    mostrarToast("Error: librería Excel no cargada.", "error");
    return;
  }
  const wsData  = [headers, ...rows];
  const ws      = XLSX.utils.aoa_to_sheet(wsData);
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      String(h).length,
      ...rows.map((r) => String(r[i] ?? "").length),
    );
    return { wch: Math.min(maxLen + 4, 40) };
  });
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename + ".xlsx");
}

/**
 * Genera y descarga el Excel de asistencias con 2 hojas:
 * - Detalle completo por registro
 * - Resumen por trabajador (quincenas)
 */
export async function descargarExcelAsistencia({
  lista,
  mesNombre,
  calcularQuincenas,
  calcMinutos,
  getEstadoAsistencia,
  getQuincena,
  audit,
}) {
  if (!lista.length) {
    mostrarToast("No hay datos para exportar.", "error");
    return;
  }

  mostrarToast("Generando Excel...", "info");

  const q     = calcularQuincenas(lista);
  const filas = lista.map((r) => {
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    const min    = calcMinutos(r.entrada, r.salida);
    const horas  = min > 0 ? (min / 60).toFixed(2) : "0.00";
    const qNum   = getQuincena(r.fecha);
    return [
      r.nombre      || "",
      r.fecha       || "",
      r.entrada     || "",
      r.salida      || "",
      estado,
      horas,
      r.justificacion || "",
      qNum === 1 ? "Q1 (1-15)" : "Q2 (16-fin)",
      r.registrado_por || "",
    ];
  });

  const resumen = [
    [],
    ["RESUMEN POR QUINCENA"],
    ["Período", "Total registros", "Tardanzas", "Horas trabajadas"],
    ["Q1 (días 1-15)",  q[1].registros.length, q[1].tardanzas, (q[1].minutos / 60).toFixed(2)],
    ["Q2 (días 16-fin)", q[2].registros.length, q[2].tardanzas, (q[2].minutos / 60).toFixed(2)],
  ];

  const wb     = XLSX.utils.book_new();
  const wsData = [
    ["Nombre", "Fecha", "Hora Ingreso", "Hora Salida", "Estado", "Horas Trabajadas", "Justificación", "Quincena", "Registrado por"],
    ...filas,
    ...resumen,
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 22 }, { wch: 12 }, { wch: 13 }, { wch: 13 },
    { wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Asistencia");

  const porUsuario = {};
  lista.forEach((r) => {
    if (!porUsuario[r.nombre]) porUsuario[r.nombre] = { q1_tard: 0, q1_min: 0, q2_tard: 0, q2_min: 0, total: 0 };
    const estado = r.estado || getEstadoAsistencia(r.entrada);
    const min    = calcMinutos(r.entrada, r.salida);
    const qNum   = getQuincena(r.fecha);
    porUsuario[r.nombre].total++;
    if (qNum === 1) {
      porUsuario[r.nombre].q1_min += min;
      if (estado === "Tardanza") porUsuario[r.nombre].q1_tard++;
    } else {
      porUsuario[r.nombre].q2_min += min;
      if (estado === "Tardanza") porUsuario[r.nombre].q2_tard++;
    }
  });

  const ws2Data = [
    ["Trabajador", "Registros", "Tardanzas Q1", "Horas Q1", "Tardanzas Q2", "Horas Q2", "Total Horas"],
    ...Object.entries(porUsuario).map(([nom, d]) => [
      nom,
      d.total,
      d.q1_tard,
      (d.q1_min / 60).toFixed(2),
      d.q2_tard,
      (d.q2_min / 60).toFixed(2),
      ((d.q1_min + d.q2_min) / 60).toFixed(2),
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  ws2["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 13 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Resumen por Trabajador");

  XLSX.writeFile(wb, `KRD_Asistencia_${mesNombre.replace(/\s+/g, "_")}.xlsx`);
  mostrarToast("✓ Excel descargado correctamente.", "success");
  await audit("export", `Exportación Excel asistencia: ${mesNombre}`);
}
