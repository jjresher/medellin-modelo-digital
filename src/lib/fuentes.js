// Fuentes y método (issue #15): filtros y conteos sobre el catálogo del lago (catalogo.json, que genera
// ingesta/correr.py) y cuánto usa la app cada fuente, contado en los temas del lago.
//
// Este módulo no importa nada: lo usan la vista de Fuentes y las pruebas (tests/fuentes.test.mjs).

// Orden de los estados en filtros y explicaciones: del más directo al que no tiene dato.
export const ESTADOS = ['observado', 'declarado', 'derivado', 'candidato'];

export const DEFINICION_ESTADO = {
  observado:
    'Dato abierto que la ingesta descarga de la fuente primaria. Puede venir resumido (los casos de un año, la mediana de las ofertas), pero no se combina con otros datos.',
  declarado: 'Leído de un PDF, un boletín, una nota de prensa o la descripción de un servicio: la fuente lo publica, pero no como dato abierto.',
  derivado:
    'Calculado por la app a partir de otros datos: una tasa por habitante, un precio por m², un cruce con los límites de cada territorio o un índice.',
  candidato: 'La fuente existe o se buscó, pero el dato no es abierto. Se guarda la URL probada y la cifra no lleva valor, para no inventarlo.'
};

/** "Ernesto Pérez" → "ernesto perez": sin tildes ni mayúsculas, para filtrar por texto. */
const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Datasets que cumplen los tres filtros: tema (o null), estado (o null) y un texto que debe aparecer, palabra por palabra,
 * en el nombre, la entidad, el id, el uso o la URL.
 */
export function filtrarCatalogo(datasets, { tema = null, estado = null, texto = '' } = {}) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  return datasets.filter((d) => {
    if (tema && d.tema !== tema) return false;
    if (estado && d.estado !== estado) return false;
    if (!palabras.length) return true;
    const pajar = normalizar([d.nombre, d.entidad, d.id, d.uso, d.url].join(' '));
    return palabras.every((p) => pajar.includes(p));
  });
}

/** Cuántos datasets hay por valor de un campo ('tema' o 'estado'), contando solo los que pasan los demás filtros. */
export function contarPor(datasets, campo) {
  const conteo = {};
  for (const d of datasets) conteo[d[campo]] = (conteo[d[campo]] ?? 0) + 1;
  return conteo;
}

/**
 * Lo que la app toma de cada fuente, contado en los temas del lago: {id: {cifras, series, indicadores}}.
 * Un indicador es una métrica por comuna y corregimiento (listas.indicadores).
 */
export function usoPorFuente(temas) {
  const uso = {};
  const sumar = (id, tipo) => {
    uso[id] ??= { cifras: 0, series: 0, indicadores: 0 };
    uso[id][tipo] += 1;
  };
  for (const tema of Object.values(temas ?? {})) {
    for (const c of Object.values(tema.cifras ?? {})) sumar(c.fuente, 'cifras');
    for (const s of Object.values(tema.series ?? {})) sumar(s.fuente, 'series');
    for (const i of tema.listas?.indicadores ?? []) sumar(i.fuente, 'indicadores');
  }
  return uso;
}

/** Cuántas cifras, series e indicadores por territorio hay en cada estado, en todo el lago. */
export function estadosDelLago(temas) {
  const conteo = Object.fromEntries(ESTADOS.map((e) => [e, { cifras: 0, series: 0, indicadores: 0 }]));
  for (const tema of Object.values(temas ?? {})) {
    for (const c of Object.values(tema.cifras ?? {})) if (conteo[c.estado]) conteo[c.estado].cifras += 1;
    for (const s of Object.values(tema.series ?? {})) if (conteo[s.estado]) conteo[s.estado].series += 1;
    for (const i of tema.listas?.indicadores ?? []) if (conteo[i.estado]) conteo[i.estado].indicadores += 1;
  }
  return conteo;
}

/** "https://www.datos.gov.co/resource/…" → "datos.gov.co". */
export function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** "3 cifras · 1 serie · 5 indicadores por territorio", o "" si la fuente no aporta datos (una capa del mapa). */
export function textoUso({ cifras = 0, series = 0, indicadores = 0 } = {}) {
  const partes = [];
  if (cifras) partes.push(`${cifras} ${cifras === 1 ? 'cifra' : 'cifras'}`);
  if (series) partes.push(`${series} ${series === 1 ? 'serie' : 'series'}`);
  if (indicadores) partes.push(`${indicadores} ${indicadores === 1 ? 'indicador' : 'indicadores'} por territorio`);
  return partes.join(' · ');
}
