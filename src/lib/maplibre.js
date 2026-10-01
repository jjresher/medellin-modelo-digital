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

export { maplibregl };
