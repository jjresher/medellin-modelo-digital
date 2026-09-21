export const navigation = [
  ['panorama', '◎', 'Panorama'],
  ['twin', '△', 'Gemelo 3D'],
  ['people', '●', 'Gente'],
  ['economy', '$', 'Economía y vivienda'],
  ['tourism', '✦', 'Turismo'],
  ['municipality', '⌂', 'Municipio'],
  ['safety', '♙', 'Seguridad'],
  ['culture', '♪', 'Territorio y cultura'],
  ['correlations', '↗', 'Correlaciones'],
  ['atlas', '▦', 'Atlas 43 distritos'],
  ['environment', '☁', 'Ambiente y satélite'],
  ['social', '◉', 'Escucha social'],
  ['sources', '≡', 'Fuentes']
];

export const sources = [
  {
    id: 'ecv',
    name: 'Encuesta de Calidad de Vida',
    organisation: 'Departamento Administrativo de Planeación · Alcaldía de Medellín',
    period: 'Corte 2024',
    url: 'https://www.medellin.gov.co/es/centro-documental/encuesta-calidad-de-vida/',
    description: 'Base anual para población, hogares, vivienda, educación, salud y condiciones socioeconómicas.'
  },
  {
    id: 'quality-2024',
    name: 'Resultados sociales de Medellín',
    organisation: 'Alcaldía de Medellín',
    period: 'Indicadores 2024',
    url: 'https://www.medellin.gov.co/es/?p=397072',
    description: 'Síntesis de pobreza multidimensional, salud, educación, desempleo y seguridad del Distrito.'
  },
  {
    id: 'labour',
    name: 'Estadísticas del mercado laboral',
    organisation: 'Observatorio de Desarrollo Económico · DANE',
    period: 'Series periódicas',
    url: 'https://www.medellin.gov.co/es/centro-documental/estadisticas-mercado-laboral-medellin/',
    description: 'Series de empleo, ocupación y desocupación de Medellín y el Área Metropolitana.'
  },
  {
    id: 'siata',
    name: 'SIATA · Calidad del aire',
    organisation: 'Área Metropolitana del Valle de Aburrá',
    period: 'Red de monitoreo activa',
    url: 'https://www.medellin.gov.co/es/secretaria-medio-ambiente/calidad-del-aire/aire-en-el-valle-de-aburra/',
    description: 'Red de estaciones y metodología del Índice de Calidad del Aire del Valle de Aburrá.'
  },
  {
    id: 'mobility',
    name: 'Observatorio de Movilidad',
    organisation: 'Secretaría de Movilidad · Alcaldía de Medellín',
    period: 'Consolidación semestral',
    url: 'https://www.medellin.gov.co/es/secretaria-de-movilidad/observatorio-de-movilidad/pasajeros-movilizados-en-transporte-publico/',
    description: 'Pasajeros movilizados por día laboral en el transporte público y SITVA.'
  },
  {
    id: 'medata',
    name: 'MEData y GeoMedellín',
    organisation: 'Alcaldía de Medellín',
    period: 'Datos y geoservicios oficiales',
    url: 'https://www.medellin.gov.co/es/transparencia/medata/',
    description: 'Portales públicos para descargar datos, metadatos, indicadores y capas geográficas oficiales.'
  },
  {
    id: 'open-buildings',
    name: 'Google Open Buildings V3',
    organisation: 'Google Research',
    period: 'Inferencia mayo de 2023',
    url: 'https://sites.research.google/gr/open-buildings/',
    description: 'Huellas de edificios derivadas de imágenes satelitales. Esta aplicación usa una muestra geográfica de alta confianza para Medellín.'
  },
  {
    id: 'comunas-amva',
    name: 'Comunas urbanas de Medellín',
    organisation: 'Área Metropolitana del Valle de Aburrá · Portal IDEM',
    period: 'Límite político-administrativo vigente',
    url: 'https://portalidem.metropol.gov.co/server/rest/services/DISTRITO_MEDELLIN_CATASTRO/MapServer/0',
    description: 'Capa geográfica oficial del Distrito. El mapa usa sus 16 comunas urbanas y excluye los corregimientos.'
  },
  {
    id: 'openfreemap',
    name: 'Cartografía base de Medellín',
    organisation: 'OpenFreeMap · OpenMapTiles · OpenStreetMap',
    period: 'Teselas vectoriales de actualización periódica',
    url: 'https://openfreemap.org/',
    description: 'Base cartográfica para el terreno, las calles, los lugares y las etiquetas; su atribución también se mantiene visible dentro del mapa.'
  }
];

export const metrics = [
  { value: '1.005.376', label: 'Hogares', note: 'Medellín · ECV 2024', accent: 'green', sourceId: 'ecv' },
  { value: '11,41', label: 'Pobreza multidimensional', note: 'Puntos · 2024', accent: 'pink', sourceId: 'quality-2024' },
  { value: '6,5%', label: 'Desempleo', note: 'Último trimestre 2024', accent: 'cyan', sourceId: 'labour' },
  { value: '90,4%', label: 'Vacunación infantil', note: 'Menores de 1 año · 2024', accent: 'yellow', sourceId: 'quality-2024' },
  { value: '3,18%', label: 'Deserción escolar', note: 'Medellín · 2024', accent: 'orange', sourceId: 'quality-2024' },
  { value: '12,02', label: 'Tasa de homicidios', note: 'Por 100 mil habitantes · 2024', accent: 'pink', sourceId: 'quality-2024' },
  { value: '22', label: 'Estaciones SIATA', note: 'Calidad del aire acreditada', accent: 'cyan', sourceId: 'siata' },
  { value: '1,16 M', label: 'Viajes SITVA / día', note: 'Referencia oficial · 2024', accent: 'green', sourceId: 'mobility' }
];
