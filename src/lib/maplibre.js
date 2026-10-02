import * as maplibregl from 'maplibre-gl';

// Next/Turbopack mueve el módulo principal de MapLibre, así que el worker oficial se sirve como recurso estático
// (public/maplibre, que copia scripts/copiar-maplibre.mjs desde node_modules). Sin esto, ni las teselas del estilo
// ni las fuentes GeoJSON se procesan y el mapa queda negro. Se fija una sola vez, antes de crear el primer mapa.
let listo = false;

export function prepararMaplibre() {
  if (!listo) {
    maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    listo = true;
  }
  return maplibregl;
}

// El estilo oscuro de OpenFreeMap pide un patrón ("wood-pattern") que su sprite no trae, y MapLibre avisa en la consola
// en cada mapa. Se resuelve con un píxel transparente, que es lo que se vería de todos modos.
export function silenciarImagenesFaltantes(map) {
  map.setMissingStyleImageResolver(async (id) => {
    if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
}

// Ajustes de los mapas pequeños de las secciones: la atribución compacta arranca desplegada y, en una tarjeta angosta,
// tapa la leyenda; se pliega al cargar (sigue a un toque en el botón «i»).
export function ajustesComunes(map) {
  silenciarImagenesFaltantes(map);
  map.once('load', () => map.getContainer().querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'));
}

export { maplibregl };
