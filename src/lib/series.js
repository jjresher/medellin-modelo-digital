// Utilidades para series del lago. Sin dependencias: las usan las vistas y las pruebas.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Parte una serie mensual ([["2025-01", n], ...]) en el año en curso y el anterior, mes a mes, para dibujarlos
 * superpuestos. Los meses del año en curso que aún no se publican quedan en null (la línea se corta ahí).
 * Devuelve null si la serie no trae al menos un mes del año anterior.
 */
export function compararAnios(puntos) {
  const porAnio = {};
  for (const [etiqueta, valor] of puntos ?? []) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(etiqueta));
    if (m) (porAnio[m[1]] ??= {})[Number(m[2])] = valor;
  }
  const actual = Object.keys(porAnio).sort().at(-1);
  const anterior = String(Number(actual) - 1);
  if (!actual || !porAnio[anterior]) return null;
  const serie = (anio) => MESES.map((mes, i) => [mes, porAnio[anio][i + 1] ?? null]);
  return { actual: { anio: actual, puntos: serie(actual) }, anterior: { anio: anterior, puntos: serie(anterior) } };
}
