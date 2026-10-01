import { CAPAS_DIR } from './config.js';
import { distance } from './geo.js';

// "Analizar punto": resume lo que hay a 500 m y a 1 km de un punto del mapa. Los edificios y los siniestros salen de una
// rejilla precalculada de ~110 m (public/data/geo/analisis.json); los equipamientos, estaciones y subestaciones, de capas.
const RADIOS = [500, 1000];
const CAPAS_PUNTUALES = ['servicios_equipamientos', 'movilidad_metro_estaciones', 'energia_subestaciones', 'movilidad_encicla'];

export async function cargarDatosAnalisis() {
  const [grid, ...puntos] = await Promise.all([
    fetch('/data/geo/analisis.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('falta analisis.json')))),
    ...CAPAS_PUNTUALES.map((id) => fetch(`${CAPAS_DIR}/${id}.geojson`).then((r) => (r.ok ? r.json() : { features: [] })))
  ]);
  return { grid, equip: puntos[0].features, metro: puntos[1].features, sub: puntos[2].features, encicla: puntos[3].features };
}

function resumenRadio(center, r, { grid, equip, metro, encicla }) {
  const suma = { construcciones: 0, area: 0, pisos: 0, pisosMax: 0, victimas: 0 };
  const dLat = r / 110574 / grid.celda + 1;
  const dLon = r / (111320 * Math.cos((center[1] * Math.PI) / 180)) / grid.celda + 1;
  const ci = Math.floor((center[0] - grid.x0) / grid.celda);
  const cj = Math.floor((center[1] - grid.y0) / grid.celda);
  for (let i = Math.floor(ci - dLon); i <= ci + dLon; i++) {
    for (let j = Math.floor(cj - dLat); j <= cj + dLat; j++) {
      const celda = grid.celdas[`${i}_${j}`];
      if (!celda) continue;
      const centro = [grid.x0 + (i + 0.5) * grid.celda, grid.y0 + (j + 0.5) * grid.celda];
      if (distance(center, centro) > r) continue;
      suma.construcciones += celda[0];
      suma.area += celda[1];
      suma.pisos += celda[2];
      suma.pisosMax = Math.max(suma.pisosMax, celda[3]);
      suma.victimas += celda[4];
    }
  }
  const dentro = (lista) => lista.filter((f) => distance(center, f.geometry.coordinates) <= r);
  const equipDentro = dentro(equip);
  const conteo = {};
  equipDentro.forEach((f) => {
    const k = f.properties.componente ?? 'Otros';
    conteo[k] = (conteo[k] ?? 0) + 1;
  });
  return {
    ...suma,
    pisosProm: suma.construcciones ? suma.pisos / suma.construcciones : null,
    equipamientos: equipDentro.length,
    porComponente: Object.entries(conteo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4),
    metro: dentro(metro).length,
    encicla: dentro(encicla).length
  };
}

const masCercana = (center, lista, campo) =>
  lista.reduce((mejor, f) => {
    const d = distance(center, f.geometry.coordinates);
    return !mejor || d < mejor.d ? { nombre: f.properties[campo], d } : mejor;
  }, null);

export function resumenAnalisis(center, datos) {
  return {
    center,
    radios: RADIOS.map((r) => resumenRadio(center, r, datos)),
    periodoVictimas: datos.grid.periodo_victimas,
    metroCercana: masCercana(center, datos.metro, 'nombre'),
    subestacionCercana: masCercana(center, datos.sub, 'nombre')
  };
}
