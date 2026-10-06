import { ANIOS_ORTOFOTO, bases, lenses, thematicLayers } from './config';

// Capas del territorio que el mapa muestra al abrirse (y que una vista compartida puede activar o apagar).
export const defaultLayers = { buildings: true, comunas: true, barrios: false, veredas: false, labels: true };

// Lee una vista compartida del hash: #twin?v=lon,lat,zoom,rumbo,inclinación&base=…&anio=…&lente=…&capas=…&terr=…
// El buscador general agrega p=lon,lat y lugar=<nombre> para marcar un punto.
export function readSharedView() {
  const [, query = ''] = window.location.hash.split('?');
  const p = new URLSearchParams(query);
  const v = p.get('v')?.split(',').map(Number);
  const camera = v?.length === 5 && v.every(Number.isFinite) ? { center: [v[0], v[1]], zoom: v[2], bearing: v[3], pitch: v[4] } : null;
  const p0 = p.get('p')?.split(',').map(Number);
  const list = (clave) => (p.get(clave) ? p.get(clave).split(',').filter(Boolean) : null);
  return {
    camera,
    base: bases[p.get('base')] ? p.get('base') : null,
    anio: ANIOS_ORTOFOTO.includes(p.get('anio')) ? p.get('anio') : null,
    lens: lenses[p.get('lente')] ? p.get('lente') : null,
    thematic: list('capas')?.filter((k) => thematicLayers[k]) ?? null,
    layers: list('terr') ? Object.fromEntries(Object.keys(defaultLayers).map((k) => [k, list('terr').includes(k)])) : null,
    punto: p0?.length === 2 && p0.every(Number.isFinite) ? p0 : null,
    lugar: p.get('lugar')?.slice(0, 120) || null,
    any: Boolean(query)
  };
}
