import { lenses, thematicLayers } from './config';
import { formatNumber } from './geo';

export const escapar = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Contenido de los popups de capas temáticas y de lentes: dato crudo, sin valoraciones.
export const popupFields = {
  'capa-metro-estaciones': [
    'Estación',
    [
      ['linea', 'Línea'],
      ['sistema', 'Sistema']
    ],
    'nombre'
  ],
  'capa-metro-lineas': [
    'Línea del Sistema Metro',
    [
      ['linea', 'Línea'],
      ['itinerario', 'Itinerario']
    ]
  ],
  'capa-ciclorrutas': [
    'Ciclorruta',
    [
      ['estado', 'Estado'],
      ['tipo_via', 'Tipo'],
      ['longitud_m', 'Longitud (m)']
    ],
    'nombre'
  ],
  'capa-encicla': ['Estación EnCicla', [['direccion', 'Dirección']], 'nombre'],
  'capa-equipamientos': [
    'Equipamiento',
    [
      ['tipo', 'Tipo'],
      ['componente', 'Componente'],
      ['nivel', 'Nivel'],
      ['barrio', 'Barrio']
    ],
    'nombre'
  ],
  'capa-atractivos': [
    'Atractivo turístico',
    [
      ['tipo', 'Tipo'],
      ['comuna', 'Comuna'],
      ['direccion', 'Dirección']
    ],
    'nombre'
  ],
  'capa-informacion': [
    'Punto de información turística',
    [
      ['direccion', 'Dirección'],
      ['comuna', 'Comuna']
    ],
    'nombre'
  ],
  'capa-hospedajes': [
    'Hospedaje (OpenStreetMap)',
    [
      ['tipo', 'Tipo'],
      ['estrellas', 'Estrellas']
    ],
    'nombre'
  ],
  'capa-proteccion-fill': ['Suelo de protección', [['subcategoria', 'Subcategoría']], 'nombre'],
  'capa-tratamientos-fill': [
    'Tratamiento del POT',
    [
      ['codigo', 'Código'],
      ['altura_normativa', 'Altura normativa (pisos)'],
      ['ic_max', 'Índice de construcción máx.'],
      ['densidad_max', 'Densidad máx. (viv/ha)']
    ],
    'tratamiento'
  ],
  'capa-riesgo-fill': [
    'Zona de riesgo (POT)',
    [
      ['riesgo', 'Condición'],
      ['amenaza', 'Amenaza']
    ],
    'nombre'
  ],
  'capa-suelo-fill': ['Valor catastral del suelo', [['valor_m2', 'Pesos por m²']]],
  'capa-patrimonio': [
    'Bien de interés cultural',
    [
      ['grupo', 'Grupo'],
      ['tipo', 'Tipo'],
      ['direccion', 'Dirección'],
      ['sector', 'Sector']
    ],
    'nombre'
  ],
  'capa-bibliotecas': [
    'Biblioteca',
    [
      ['tipo', 'Tipo'],
      ['direccion', 'Ubicación'],
      ['horario', 'Horario']
    ],
    'nombre'
  ],
  'capa-sedes': [
    'Sede educativa',
    [
      ['establecimiento', 'Establecimiento'],
      ['sector', 'Sector'],
      ['direccion', 'Dirección']
    ],
    'nombre'
  ],
  'lente-subestaciones': [
    'Subestación de energía',
    [
      ['estado', 'Estado'],
      ['clasificacion', 'Clasificación'],
      ['direccion', 'Dirección']
    ],
    'nombre'
  ],
  'lente-alta-tension': [
    'Línea de alta tensión',
    [
      ['tension_kv', 'Tensión (kV)'],
      ['circuito', 'Circuito']
    ]
  ],
  'lente-aforos': [
    'Intersección aforada',
    [
      ['veh_eq_hora_pico', 'Veh. equivalentes en hora pico'],
      ['anios', 'Años del aforo']
    ],
    'interseccion'
  ]
};
export const layerSource = {
  ...Object.fromEntries(Object.values(thematicLayers).flatMap((c) => c.layers.map((l) => [l.id, c.fuentes[0]]))),
  ...Object.fromEntries(Object.values(lenses).flatMap((l) => (l.layers ?? []).map((layer) => [layer.id, l.fuentes.at(-1)])))
};
layerSource['capa-hospedajes'] = 'osm-hospedajes';
layerSource['capa-bibliotecas'] = 'alc-bibliotecas';
layerSource['capa-sedes'] = 'alc-sedes-educativas';
export const clickable = Object.keys(popupFields);

export function featurePopup(layerId, props, fuente) {
  const [title, rows, nameField] = popupFields[layerId];
  const name = nameField && props[nameField] ? `<span class="name">${escapar(props[nameField])}</span>` : '';
  const body = rows
    .filter(([k]) => props[k] != null && props[k] !== '')
    .map(([k, label]) => `<span><em>${label}</em> ${escapar(typeof props[k] === 'number' ? formatNumber(props[k]) : props[k])}</span>`)
    .join('');
  return `<strong>${title}</strong>${name}${body}${fuente ? `<small>${escapar(fuente.nombre)}${fuente.vigencia ? ` · ${escapar(fuente.vigencia)}` : ''}</small>` : ''}`;
}

export function buildingPopup(p) {
  const height = `${formatNumber(p.h, 1)} m${p.e ? ' (sin dato: pisos × 2,3 m)' : ''}`;
  const rows = [
    ['Pisos', formatNumber(p.p)],
    p.n != null ? ['Altura normativa POT', `${p.n} pisos`] : null,
    ['Sótanos', formatNumber(p.s)],
    ['Altura catastral', height],
    ['Área construida', `${formatNumber(p.a)} m²`],
    p.y ? ['Año de construcción', p.y] : null,
    ['Tipo (código catastral)', p.t || 'Sin dato'],
    ['CBML', p.c || 'Sin dato']
  ].filter(Boolean);
  return `<strong>Construcción ${p.r ? 'rural' : 'urbana'}</strong>${rows.map(([k, v]) => `<span><em>${k}</em> ${escapar(v)}</span>`).join('')}<small>Catastro distrital · Portal IDEM. La altura catastral se deriva del número de pisos (≈ 2,3 m por piso); no es una medición del edificio.</small>`;
}
