// Configuración declarativa del gemelo: mapas base, capas temáticas, lentes y la fuente de cada capa.

export const initialView = { center: [-75.5686, 6.2476], zoom: 13.65, pitch: 58, bearing: -18 };
export const PMTILES_EDIFICIOS = '/data/edificios.pmtiles';
export const PMTILES_SINIESTROS = '/data/siniestros.pmtiles';
export const CAPAS_DIR = '/data/geo/capas';
export const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const TERRENO = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
// Las ortofotos pasan por un proxy propio con caché (ver src/app/api/ortofoto).
export const ortofotoTiles = (anio) => `${window.location.origin}/api/ortofoto/${anio}/{z}/{y}/{x}`;
export const ANIOS_ORTOFOTO = ['2016', '2019', '2021', '2024'];

// Capas raster visibles en cada mapa base. En "Ortofoto", ESRI queda debajo para cubrir fuera de Medellín.
export const bases = {
  oscuro: { label: 'Oscuro', layers: [], fuentes: ['openfreemap'] },
  ortofoto: { label: 'Ortofoto', layers: ['base-esri', 'base-ortofoto'], fuentes: ['ortofoto-2024', 'esri-imagery'] },
  satelite: { label: 'Satélite', layers: ['base-esri'], fuentes: ['esri-imagery'] }
};

export const territoryLayers = {
  buildings: { label: 'Edificación 3D', layers: ['edificios-3d'], fuentes: ['catastro-construcciones'] },
  comunas: { label: 'Comunas', layers: ['comunas-fill', 'comunas-line'], fuentes: ['idem-limites'] },
  barrios: { label: 'Barrios', layers: ['barrios-fill', 'barrios-line'], fuentes: ['idem-limites'] },
  veredas: { label: 'Veredas', layers: ['veredas-line'], fuentes: ['idem-limites'] },
  labels: { label: 'Nombres', layers: ['comunas-label', 'barrios-label', 'veredas-label'], fuentes: [] }
};

// Rampa por número de pisos, en la paleta Monokai de la app.
export const floorRamp = [[1, '#75715e'], [3, '#ae81ff'], [6, '#66d9ef'], [12, '#a6e22e'], [20, '#e6db74'], [30, '#f92672']];
export const floorColor = ['interpolate', ['linear'], ['get', 'p'], ...floorRamp.flat()];

// Densificación: pisos construidos menos la altura normativa del POT (en pisos) del tratamiento donde está la construcción.
export const normRamp = [[-3, '#4a78a8'], [0, '#9aa7b3'], [1, '#fd971f'], [4, '#f92672']];
// Sin altura normativa numérica ("Variable" o no aplica en el POT): gris oscuro, fuera de la rampa.
export const NORM_NONE = '#34352f';
export const normColor = ['case', ['has', 'n'], ['interpolate', ['linear'], ['-', ['get', 'p'], ['get', 'n']], ...normRamp.flat()], NORM_NONE];

const componentes = {
  'Equipamiento de Educación': '#66d9ef',
  'Equipamiento de Salud': '#f92672',
  'Equipamiento de Recreación y Deporte': '#a6e22e',
  'Equipamientos Culturales': '#ae81ff',
  'Equipamientos Comunitarios': '#e6db74',
  'Equipamiento de Asistencia Social': '#fd971f'
};

const tratamientos = [
  ['Consolidación', ['CN1', 'CN2', 'CN3', 'CN4', 'CN5', 'CNS1', 'CNS2', 'CNS3', 'CNS4'], '#66d9ef'],
  ['Renovación urbana', ['R'], '#f92672'],
  ['Mejoramiento integral', ['MI', 'MIE'], '#fd971f'],
  ['Desarrollo', ['D', 'DE'], '#e6db74'],
  ['Conservación', ['C1', 'C2', 'C3', 'CS', 'CRNM'], '#ae81ff'],
  ['Rural y protección', ['GARS', 'RAR', 'TP'], '#a6e22e'],
  ['Infraestructura pública (API)', ['API'], '#75715e']
];

const amenazas = [['Movimientos en masa', '#fd971f'], ['Inundaciones', '#66d9ef'], ['Avenidas Torrenciales', '#ae81ff']];

// Valor catastral del suelo por m²: rampa secuencial de un tono, en escala logarítmica (va de miles a millones de pesos).
const sueloRamp = [[3, '#3a3b33'], [5, '#66d9ef'], [6, '#ae81ff'], [7, '#f92672']];

// Capas del panel Explorar. `archivos` son GeoJSON en CAPAS_DIR; el id del archivo es el id de la fuente de MapLibre.
export const thematicLayers = {
  movilidad: {
    label: 'Movilidad',
    fuentes: ['metro-red', 'idem-bicicleta'],
    archivos: ['movilidad_metro_lineas', 'movilidad_ciclorrutas', 'movilidad_metro_estaciones', 'movilidad_encicla'],
    layers: [
      { id: 'capa-metro-lineas', type: 'line', source: 'movilidad_metro_lineas', paint: { 'line-color': ['match', ['get', 'sistema'], 'M', '#66d9ef', 'C', '#fd971f', 'T', '#a6e22e', 'MPLUS', '#ae81ff', '#f8f8f2'], 'line-width': 3, 'line-opacity': 0.9 } },
      { id: 'capa-ciclorrutas', type: 'line', source: 'movilidad_ciclorrutas', paint: { 'line-color': '#a6e22e', 'line-width': 1.6, 'line-opacity': ['match', ['get', 'estado'], 'Construida', 0.9, 0.35] } },
      { id: 'capa-metro-estaciones', type: 'circle', source: 'movilidad_metro_estaciones', paint: { 'circle-radius': 4.5, 'circle-color': '#f8f8f2', 'circle-stroke-color': '#272822', 'circle-stroke-width': 1.5 } },
      { id: 'capa-encicla', type: 'circle', source: 'movilidad_encicla', paint: { 'circle-radius': 3.2, 'circle-color': '#a6e22e', 'circle-stroke-color': '#272822', 'circle-stroke-width': 1 } }
    ],
    legend: [['Metro', '#66d9ef'], ['Metrocable', '#fd971f'], ['Metroplús', '#ae81ff'], ['Tranvía', '#a6e22e'], ['Ciclorrutas y EnCicla', '#a6e22e']]
  },
  servicios: {
    label: 'Servicios',
    fuentes: ['idem-pot'],
    archivos: ['servicios_equipamientos'],
    layers: [
      { id: 'capa-equipamientos', type: 'circle', source: 'servicios_equipamientos', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 16, 6], 'circle-color': ['match', ['get', 'componente'], ...Object.entries(componentes).flat(), '#b9b9ac'], 'circle-stroke-color': '#272822', 'circle-stroke-width': 1 } }
    ],
    legend: [['Educación', '#66d9ef'], ['Salud', '#f92672'], ['Recreación y deporte', '#a6e22e'], ['Cultura', '#ae81ff'], ['Comunitarios', '#e6db74'], ['Asistencia social', '#fd971f'], ['Otros', '#b9b9ac']]
  },
  turismo: {
    label: 'Turismo',
    fuentes: ['alcaldia-turismo', 'osm-hospedajes'],
    archivos: ['turismo_hospedajes', 'turismo_atractivos', 'turismo_informacion'],
    layers: [
      { id: 'capa-hospedajes', type: 'circle', source: 'turismo_hospedajes', minzoom: 11, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 5], 'circle-color': '#ae81ff', 'circle-opacity': 0.85, 'circle-stroke-color': '#272822', 'circle-stroke-width': 0.8 } },
      { id: 'capa-atractivos', type: 'circle', source: 'turismo_atractivos', paint: { 'circle-radius': ['case', ['boolean', ['get', 'imperdible'], false], 7, 5], 'circle-color': '#e6db74', 'circle-stroke-color': '#272822', 'circle-stroke-width': 1.5 } },
      { id: 'capa-informacion', type: 'circle', source: 'turismo_informacion', paint: { 'circle-radius': 7, 'circle-color': '#66d9ef', 'circle-stroke-color': '#f8f8f2', 'circle-stroke-width': 2 } }
    ],
    legend: [['Atractivo turístico (grande: imperdible)', '#e6db74'], ['Punto de información turística', '#66d9ef'], ['Hospedaje (OpenStreetMap)', '#ae81ff']]
  },
  cultura: {
    label: 'Cultura y educación',
    fuentes: ['alc-bic', 'alc-bibliotecas', 'alc-sedes-educativas'],
    archivos: ['educacion_sedes', 'cultura_patrimonio', 'cultura_bibliotecas'],
    layers: [
      { id: 'capa-sedes', type: 'circle', source: 'educacion_sedes', minzoom: 11, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 5], 'circle-color': ['match', ['get', 'sector'], 'Oficial', '#66d9ef', '#b9b9ac'], 'circle-opacity': 0.85, 'circle-stroke-color': '#272822', 'circle-stroke-width': 0.8 } },
      { id: 'capa-patrimonio', type: 'circle', source: 'cultura_patrimonio', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.5, 16, 6], 'circle-color': '#ae81ff', 'circle-stroke-color': '#272822', 'circle-stroke-width': 1 } },
      { id: 'capa-bibliotecas', type: 'circle', source: 'cultura_bibliotecas', paint: { 'circle-radius': 6.5, 'circle-color': '#e6db74', 'circle-stroke-color': '#272822', 'circle-stroke-width': 1.5 } }
    ],
    legend: [['Bien de interés cultural', '#ae81ff'], ['Biblioteca de la Red', '#e6db74'], ['Sede educativa oficial', '#66d9ef'], ['Sede educativa no oficial', '#b9b9ac']]
  },
  verde: {
    label: 'Verde',
    fuentes: ['idem-pot'],
    archivos: ['verde_proteccion'],
    layers: [
      { id: 'capa-proteccion-fill', type: 'fill', source: 'verde_proteccion', paint: { 'fill-color': '#a6e22e', 'fill-opacity': 0.16 } },
      { id: 'capa-proteccion-line', type: 'line', source: 'verde_proteccion', paint: { 'line-color': '#a6e22e', 'line-width': 1, 'line-opacity': 0.6 } }
    ],
    legend: [['Suelo de protección (POT)', '#a6e22e']]
  },
  planificacion: {
    label: 'Planificación',
    fuentes: ['idem-pot'],
    archivos: ['planificacion_tratamientos'],
    layers: [
      { id: 'capa-tratamientos-fill', type: 'fill', source: 'planificacion_tratamientos', paint: { 'fill-color': ['match', ['get', 'tipo'], ...tratamientos.flatMap(([, tipos, color]) => [tipos, color]), '#56574d'], 'fill-opacity': 0.28 } },
      { id: 'capa-tratamientos-line', type: 'line', source: 'planificacion_tratamientos', paint: { 'line-color': '#f8f8f2', 'line-width': 0.5, 'line-opacity': 0.35 } }
    ],
    legend: tratamientos.map(([label, , color]) => [label, color])
  },
  suelo: {
    label: 'Valor del suelo',
    fuentes: ['idem-valor-suelo'],
    archivos: ['economia_valor_suelo'],
    layers: [
      { id: 'capa-suelo-fill', type: 'fill', source: 'economia_valor_suelo', paint: { 'fill-color': ['interpolate', ['linear'], ['log10', ['max', ['get', 'valor_m2'], 1]], ...sueloRamp.flat()], 'fill-opacity': 0.45 } },
      { id: 'capa-suelo-line', type: 'line', source: 'economia_valor_suelo', paint: { 'line-color': '#f8f8f2', 'line-width': 0.4, 'line-opacity': 0.35 } }
    ],
    legend: [['Hasta $10.000/m²', sueloRamp[0][1]], ['$100.000/m²', sueloRamp[1][1]], ['$1 M/m²', sueloRamp[2][1]], ['$10 M/m² o más', sueloRamp[3][1]]]
  },
  riesgo: {
    label: 'Riesgo',
    fuentes: ['idem-pot'],
    archivos: ['riesgo_pot'],
    layers: [
      { id: 'capa-riesgo-fill', type: 'fill', source: 'riesgo_pot', paint: { 'fill-color': ['match', ['get', 'amenaza'], ...amenazas.flat(), '#b9b9ac'], 'fill-opacity': 0.35 } },
      { id: 'capa-riesgo-line', type: 'line', source: 'riesgo_pot', paint: { 'line-color': ['match', ['get', 'riesgo'], 'Alto riesgo no mitigable', '#f92672', '#f8f8f2'], 'line-width': ['match', ['get', 'riesgo'], 'Alto riesgo no mitigable', 1.8, 0.5], 'line-opacity': 0.8 } }
    ],
    legend: [...amenazas.map(([label, color]) => [label, color]), ['Borde: alto riesgo no mitigable', '#f92672']]
  }
};

// Cada lente colorea las comunas y corregimientos por su índice 0–100 y agrega sus capas propias.
export const lenses = {
  cruce: {
    key: '1', label: 'Cruce urbano', icon: '◎', index: 'indice_cruce',
    fuentes: ['epm-red-electrica', 'catastro-puntos', 'medata-victimas-viales', 'medata-aforos'],
    method: 'Promedio de los índices de energía, densificación y presión vial. Cada índice ubica al territorio entre 0 (valor mínimo observado entre las 21 comunas y corregimientos) y 100 (valor máximo). Es una posición relativa, no un umbral.'
  },
  energia: {
    key: '2', label: 'Energía', icon: '⚡', index: 'indice_energia',
    fuentes: ['epm-red-electrica'],
    archivos: ['energia_alta_tension', 'energia_subestaciones'],
    layers: [
      { id: 'lente-alta-tension', type: 'line', source: 'energia_alta_tension', paint: { 'line-color': '#e6db74', 'line-width': 1.6, 'line-opacity': 0.85 } },
      { id: 'lente-subestaciones', type: 'circle', source: 'energia_subestaciones', paint: { 'circle-radius': 7, 'circle-color': '#e6db74', 'circle-stroke-color': '#272822', 'circle-stroke-width': 2 } },
      { id: 'lente-subestaciones-label', type: 'symbol', source: 'energia_subestaciones', minzoom: 12, layout: { 'text-field': ['get', 'nombre'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-offset': [0, 1.3], 'text-anchor': 'top' }, paint: { 'text-color': '#e6db74', 'text-halo-color': '#272822', 'text-halo-width': 1.4 } }
    ],
    legend: [['Subestación', '#e6db74'], ['Línea de alta tensión', '#e6db74']],
    method: 'Densidad de infraestructura eléctrica: kilómetros de red de media tensión y de líneas de alta tensión por km² de territorio. No hay datos abiertos de demanda eléctrica por comuna: la lente muestra infraestructura, no consumo.'
  },
  densificacion: {
    key: '3', label: 'Densificación', icon: '▥', index: 'indice_densificacion',
    fuentes: ['catastro-puntos', 'pot-tratamientos'],
    method: 'Índice de construcción bruto (área construida del catastro ÷ área del territorio) y pisos promedio. En el mapa, cada construcción se colorea por la diferencia entre sus pisos catastrales y la altura normativa (en pisos) del tratamiento del POT donde está. Donde el POT fija la altura como "Variable" o no aplica, la construcción queda en gris oscuro. Es un cruce geométrico: no considera licencias ni normas anteriores.'
  },
  vial: {
    key: '4', label: 'Presión vial', icon: '≋', index: 'indice_vial',
    fuentes: ['medata-victimas-viales', 'medata-aforos'],
    archivos: ['movilidad_aforos'],
    layers: [
      { id: 'lente-siniestros', type: 'heatmap', source: 'siniestros', 'source-layer': 'siniestros', maxzoom: 17, paint: { 'heatmap-weight': 0.12, 'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 13, 7, 16, 18], 'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.35, 13, 0.7, 16, 1.6], 'heatmap-opacity': 0.8, 'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(39,40,34,0)', 0.2, '#ae81ff', 0.5, '#fd971f', 0.8, '#f92672', 1, '#f8f8f2'] } },
      { id: 'lente-aforos', type: 'circle', source: 'movilidad_aforos', paint: { 'circle-radius': ['interpolate', ['linear'], ['get', 'veh_eq_hora_pico'], 500, 4, 4000, 10, 10000, 18], 'circle-color': '#66d9ef', 'circle-opacity': 0.55, 'circle-stroke-color': '#66d9ef', 'circle-stroke-width': 1 } }
    ],
    legend: [['Víctimas en siniestros viales (densidad)', '#f92672'], ['Intersección aforada (tamaño = volumen en hora pico)', '#66d9ef']],
    method: 'Indicador estructural de 0 a 100, no tráfico en vivo: víctimas en siniestros viales por km² al año y volumen vehicular en la hora de máxima demanda de los aforos. Las fuentes abiertas llegan hasta los años indicados abajo.'
  }
};

// Rampa del índice 0–100 en el coroplético de comunas; gris oscuro = sin dato.
export const indexRamp = [[0, '#3a3b33'], [50, '#ae81ff'], [100, '#f92672']];
export const indexColor = (campo) => ['case', ['==', ['typeof', ['get', campo]], 'number'], ['interpolate', ['linear'], ['get', campo], ...indexRamp.flat()], '#30312b'];

// Campos que se muestran en la ficha de un territorio con una lente activa.
export const lensFields = {
  energia: [['subestaciones', 'Subestaciones', ''], ['km_media_tension', 'Red de media tensión', 'km'], ['km_mt_por_km2', 'Media tensión por km²', 'km/km²'], ['km_alta_tension', 'Alta tensión', 'km']],
  densificacion: [['construcciones', 'Construcciones', ''], ['indice_construccion_bruto', 'Índice de construcción bruto', 'm²/m²'], ['pisos_promedio', 'Pisos promedio', ''], ['construcciones_con_altura_normativa', 'Con altura normativa numérica', ''], ['pct_sobre_altura_normativa', '… de ellas, sobre la norma', '%']],
  vial: [['victimas_viales', 'Víctimas viales', ''], ['victimas_por_km2_anio', 'Víctimas por km² al año', ''], ['nodos_aforados', 'Intersecciones aforadas', ''], ['veh_eq_hora_pico', 'Volumen en hora pico', 'veh. eq./h']],
  cruce: [['indice_energia', 'Índice energía', '/100'], ['indice_densificacion', 'Índice densificación', '/100'], ['indice_vial', 'Índice presión vial', '/100']]
};

export const shortcuts = [
  ['1–4', 'Lentes: cruce, energía, densificación, presión vial'],
  ['E', 'Abrir o cerrar Explorar'],
  ['A', 'Analizar un punto (radios de 500 m y 1 km)'],
  ['M', 'Medir distancia'],
  ['H', 'HUD técnico'],
  ['N', 'Orientar al norte'],
  ['?', 'Esta ayuda'],
  ['Esc', 'Salir del modo actual']
];
