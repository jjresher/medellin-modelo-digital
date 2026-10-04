// Buscador de lugares del Panorama (issue #14): comunas, corregimientos, barrios y veredas de los límites del gemelo, y
// los puntos de las capas del mapa (estaciones, atractivos, bibliotecas, patrimonio, equipamientos y sedes educativas).
// Cada resultado dice en qué comuna o corregimiento está; un punto fuera de los 21 territorios no aparece.
//
// Este módulo no importa nada: lo usan la vista del Panorama y las pruebas (tests/diagnostico.test.mjs).

// Capas puntuales de public/data/geo/capas que entran al buscador, con el tipo que se muestra junto al nombre.
export const CAPAS_LUGARES = [
  ['movilidad_metro_estaciones', () => 'Sistema Metro'],
  ['turismo_atractivos', () => 'Atractivo turístico'],
  ['cultura_bibliotecas', (p) => p.tipo || 'Biblioteca'],
  ['cultura_patrimonio', () => 'Bien de interés cultural'],
  ['servicios_equipamientos', (p) => p.tipo || 'Equipamiento'],
  ['educacion_sedes', () => 'Sede educativa']
];

// Orden de los resultados que empatan en cómo coinciden con la búsqueda: primero los territorios y sus barrios.
const ORDEN_TIPO = { Comuna: 0, Corregimiento: 0, Barrio: 1, Vereda: 1 };

/** "Estación San Antonio (Línea B)" → "estacion san antonio linea b": sin tildes, mayúsculas ni signos. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Regla par-impar sobre todos los anillos: un punto dentro de un hueco queda fuera.
function enAnillos(x, y, anillos) {
  let dentro = false;
  for (const anillo of anillos) {
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i];
      const [xj, yj] = anillo[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
}

export function puntoEnGeometria([x, y], geometria) {
  if (geometria?.type === 'Polygon') return enAnillos(x, y, geometria.coordinates);
  if (geometria?.type === 'MultiPolygon') return geometria.coordinates.some((poligono) => enAnillos(x, y, poligono));
  return false;
}

function caja(geometria) {
  const caja = [Infinity, Infinity, -Infinity, -Infinity];
  const recorrer = (c) => {
    if (typeof c[0] === 'number') {
      caja[0] = Math.min(caja[0], c[0]);
      caja[1] = Math.min(caja[1], c[1]);
      caja[2] = Math.max(caja[2], c[0]);
      caja[3] = Math.max(caja[3], c[1]);
    } else c.forEach(recorrer);
  };
  recorrer(geometria.coordinates);
  return caja;
}

/** Límites [[oeste, sur], [este, norte]] de una geometría, para encuadrarla en el mapa. */
export function limites(geometria) {
  const [o, s, e, n] = caja(geometria);
  return [
    [o, s],
    [e, n]
  ];
}

/**
 * Índice de búsqueda. `comunas`, `barrios` y `veredas` son los GeoJSON de public/data/geo; `capas`, pares
 * [archivo de CAPAS_LUGARES, GeoJSON]. Los comunas.geojson sin nombre (dos polígonos que no son territorios) se omiten.
 * Devuelve { territorios: [{codigo, nombre, geometry, caja}], lugares: [{nombre, tipo, codigo?, geometry, clave}] }:
 * los puntos aún no tienen `codigo`; se calcula al buscar (territorioDe), solo para los que coinciden.
 */
export function indiceDeLugares({ comunas, barrios, veredas, capas = [] }) {
  const territorios = (comunas?.features ?? [])
    .filter((f) => f.properties.NOMBRE && /^\d+$/.test(f.properties.CODIGO))
    .map((f) => ({
      codigo: f.properties.CODIGO,
      nombre: f.properties.NOMBRE.replace(/^Corregimiento de /, ''),
      geometry: f.geometry,
      caja: caja(f.geometry)
    }));
  const lugares = territorios.map((t) => ({
    nombre: t.nombre,
    tipo: Number(t.codigo) >= 50 ? 'Corregimiento' : 'Comuna',
    codigo: t.codigo,
    geometry: t.geometry
  }));
  // Un barrio o una vereda partida en varios polígonos con el mismo código (Piedras Blancas Represa) es un solo lugar.
  const porCodigo = new Map();
  for (const [geo, tipo] of [
    [barrios, 'Barrio'],
    [veredas, 'Vereda']
  ]) {
    for (const f of geo?.features ?? []) {
      const p = f.properties;
      const previo = porCodigo.get(p.CODIGO);
      if (previo) {
        const partes = (g) => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]);
        previo.geometry = { type: 'MultiPolygon', coordinates: [...partes(previo.geometry), ...partes(f.geometry)] };
      } else porCodigo.set(p.CODIGO, { nombre: p.NOMBRE_BARRIO, tipo, codigo: p.COMUNA, geometry: f.geometry });
    }
  }
  lugares.push(...porCodigo.values());
  const tipos = Object.fromEntries(CAPAS_LUGARES);
  for (const [archivo, geo] of capas) {
    for (const f of geo?.features ?? []) {
      if (f.geometry?.type !== 'Point' || !f.properties?.nombre) continue;
      lugares.push({ nombre: f.properties.nombre, tipo: tipos[archivo]?.(f.properties) ?? 'Lugar', geometry: f.geometry });
    }
  }
  return { territorios, lugares: lugares.map((l) => ({ ...l, clave: normalizar(l.nombre) })) };
}

/** Código del territorio (comuna o corregimiento) donde cae un punto [lon, lat], o null si está fuera de Medellín. */
export function territorioDe(punto, territorios) {
  const [x, y] = punto;
  const t = territorios.find(({ caja: [o, s, e, n], geometry }) => x >= o && x <= e && y >= s && y <= n && puntoEnGeometria(punto, geometry));
  return t?.codigo ?? null;
}

/**
 * Lugares cuyo nombre contiene todas las palabras de la búsqueda (sin tildes ni mayúsculas), con su territorio.
 * Primero los que empiezan por la búsqueda, luego los que tienen una palabra que empieza por ella y al final el resto;
 * a igualdad, los territorios, barrios y veredas antes que los puntos, y los nombres cortos antes que los largos.
 * Un mismo nombre y tipo en el mismo territorio sale una vez.
 */
export function buscarLugares(indice, texto, limite = 8) {
  const q = normalizar(texto);
  if (q.length < 2 || !indice) return [];
  const palabras = q.split(' ');
  const coincide = indice.lugares.filter((l) => palabras.every((p) => l.clave.includes(p)));
  const nivel = (l) => (l.clave.startsWith(q) ? 0 : ` ${l.clave}`.includes(` ${palabras[0]}`) ? 1 : 2);
  coincide.sort(
    (a, b) =>
      nivel(a) - nivel(b) ||
      (ORDEN_TIPO[a.tipo] ?? 2) - (ORDEN_TIPO[b.tipo] ?? 2) ||
      a.clave.length - b.clave.length ||
      a.clave.localeCompare(b.clave)
  );
  const resultados = [];
  const vistos = new Set();
  for (const l of coincide) {
    const codigo = l.codigo ?? territorioDe(l.geometry.coordinates, indice.territorios);
    if (!codigo || !indice.territorios.some((t) => t.codigo === codigo)) continue;
    const llave = `${l.clave}|${l.tipo}|${codigo}`;
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    resultados.push({ ...l, codigo });
    if (resultados.length === limite) break;
  }
  return resultados;
}
