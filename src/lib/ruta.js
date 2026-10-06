// La sección activa vive en el #hash (issue #16): cada sección tiene su dirección (/#people, /#twin?v=…) y el botón
// atrás del navegador vuelve a la anterior. Sin hash es el Panorama. Lo usan page.jsx y las pruebas.
import { navigation } from '../data/navegacion.js';

const IDS = new Set(navigation.map(([id]) => id));

/** '#twin?v=1,2' → { id: 'twin', query: 'v=1,2' }. Un hash vacío o desconocido es el Panorama. */
export function leerRuta(hash) {
  const [id = '', query = ''] = String(hash ?? '')
    .replace(/^#/, '')
    .split(/\?(.*)/s);
  return IDS.has(id) ? { id, query } : { id: 'panorama', query: '' };
}

/** Dirección relativa de una sección: el Panorama sin consulta es la raíz (sin #). */
export function hashDe(id, query = '') {
  if (id === 'panorama' && !query) return '';
  return `#${id}${query ? `?${query}` : ''}`;
}

/** La fuente pedida a "Fuentes y método" desde una tarjeta: #sources?fuente=<id>. */
export const fuenteDe = (ruta) => (ruta.id === 'sources' ? new URLSearchParams(ruta.query).get('fuente') : null);

/** Título de la pestaña para cada sección. */
export function tituloDe(id) {
  const nombre = navigation.find(([navId]) => navId === id)?.[2];
  return !nombre || id === 'panorama' ? 'Medellín · Modelo Digital' : `${nombre} · Medellín · Modelo Digital`;
}
