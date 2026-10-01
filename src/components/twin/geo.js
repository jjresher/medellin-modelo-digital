// Utilidades geométricas del gemelo, sin dependencias: etiquetas, límites, distancias y círculos.

export function featureBounds(geometry) {
  const points = [];
  const collect = (value) => {
    if (typeof value[0] === 'number') points.push(value);
    else value.forEach(collect);
  };

  collect(geometry.coordinates);
  return points.reduce(
    (bounds, [longitude, latitude]) => [
      [Math.min(bounds[0][0], longitude), Math.min(bounds[0][1], latitude)],
      [Math.max(bounds[1][0], longitude), Math.max(bounds[1][1], latitude)]
    ],
    [
      [Infinity, Infinity],
      [-Infinity, -Infinity]
    ]
  );
}

// Un punto de etiqueta por territorio. Si las etiquetas salen del polígono, MapLibre repite el nombre
// en cada tesela que el polígono toca. Se traza una línea horizontal por el centroide del anillo exterior
// más grande y se toma el centro del tramo interior más ancho, que siempre cae dentro del polígono.
function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(area / 2);
}

function interiorPoint(geometry) {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  const polygon = polygons.reduce((best, current) => (ringArea(current[0]) > ringArea(best[0]) ? current : best));
  const outer = polygon[0];
  const y = outer.reduce((sum, [, lat]) => sum + lat, 0) / outer.length;
  const crossings = [];
  polygon.forEach((ring) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[i];
      if (y1 > y !== y2 > y) crossings.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
  });
  crossings.sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    if (!best || crossings[i + 1] - crossings[i] > best[1] - best[0]) best = [crossings[i], crossings[i + 1]];
  }
  return best ? [(best[0] + best[1]) / 2, y] : outer[0];
}

export function labelPoints(collection, field) {
  return {
    type: 'FeatureCollection',
    features: collection.features
      .filter((f) => f.properties[field])
      .map((f) => ({
        type: 'Feature',
        properties: { name: String(f.properties[field]).trim() },
        geometry: { type: 'Point', coordinates: interiorPoint(f.geometry) }
      }))
  };
}

const RADIO_TIERRA = 6371008.8;
const rad = (grados) => (grados * Math.PI) / 180;

// Distancia en metros entre dos [lon, lat] (haversine).
export function distance([lon1, lat1], [lon2, lat2]) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.sqrt(a));
}

// Polígono aproximado de un círculo de `metros` alrededor de [lon, lat].
export function circle([lon, lat], metros, pasos = 72) {
  const dLat = (metros / RADIO_TIERRA) * (180 / Math.PI);
  const dLon = dLat / Math.cos(rad(lat));
  const anillo = Array.from({ length: pasos + 1 }, (_, i) => {
    const angulo = (i / pasos) * 2 * Math.PI;
    return [lon + dLon * Math.cos(angulo), lat + dLat * Math.sin(angulo)];
  });
  return { type: 'Feature', properties: { metros }, geometry: { type: 'Polygon', coordinates: [anillo] } };
}

// Metros por píxel en la latitud dada (MapLibre usa teselas de 512 px).
export function metersPerPixel(lat, zoom) {
  return (40075016.686 * Math.cos(rad(lat))) / (512 * 2 ** zoom);
}

export const formatNumber = (value, digits = 0) => Number(value).toLocaleString('es-CO', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export function formatDistance(metros) {
  return metros >= 1000 ? `${formatNumber(metros / 1000, 2)} km` : `${formatNumber(metros)} m`;
}
