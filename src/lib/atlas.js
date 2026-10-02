// Atlas: junta en una sola lista las métricas por territorio de todos los temas del lago. Cada tema publica las suyas
// con el mismo contrato (listas `indicadores` y `territorios` de lago.Territorios); aquí solo se elige cuáles entran al
// Atlas y con qué rótulo corto. Una métrica que no esté en el lago no se muestra.
//
// Este módulo no importa nada: lo usan la vista del Atlas y las pruebas (tests/atlas.test.mjs).

export const GRUPOS = [
  {
    id: 'gente',
    titulo: 'Gente',
    tema: 'demografia',
    metricas: [
      ['poblacion', 'Población'],
      ['densidad', 'Densidad'],
      ['hogares', 'Hogares'],
      ['viviendas', 'Viviendas'],
      ['imcv', 'IMCV'],
      ['pobreza_multidimensional', 'Pobreza multidimensional'],
      ['idh', 'IDH'],
      ['estrato_1', 'Estrato 1'],
      ['estrato_6', 'Estrato 6'],
      ['natalidad_tasa', 'Natalidad'],
      ['mortalidad_tasa', 'Mortalidad'],
      ['dengue_tasa', 'Dengue']
    ]
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad',
    tema: 'seguridad',
    metricas: [
      ['sisc_homicidio', 'Homicidios'],
      ['sisc_homicidio_tasa', 'Homicidios por 10.000 hab.'],
      ['sisc_hurto_persona_tasa', 'Hurto a persona'],
      ['sisc_hurto_carro_tasa', 'Hurto de carro'],
      ['sisc_hurto_moto_tasa', 'Hurto de moto'],
      ['sisc_hurto_residencia_tasa', 'Hurto a residencia'],
      ['sisc_hurto_comercio_tasa', 'Hurto a comercio'],
      ['sisc_extorsion_sisc_tasa', 'Extorsión'],
      ['sisc_lesion_dolosa_tasa', 'Lesiones dolosas']
    ]
  },
  {
    id: 'economia',
    titulo: 'Economía y vivienda',
    tema: 'economia',
    metricas: [
      ['venta_m2', 'Precio de venta por m²'],
      ['arriendo_m2', 'Arriendo por m²'],
      ['rentabilidad_bruta', 'Rentabilidad bruta'],
      ['valor_suelo', 'Valor del suelo'],
      ['licencias', 'Licencias'],
      ['establecimientos_ica', 'Industria y Comercio'],
      ['empresas_camara', 'Empresas']
    ]
  },
  {
    id: 'municipio',
    titulo: 'Municipio',
    tema: 'municipio',
    metricas: [
      ['inversion_publica', 'Inversión pública'],
      ['inversion_participacion', 'Participación en la inversión'],
      ['predial_facturado', 'Predial facturado']
    ]
  },
  {
    id: 'servicios',
    titulo: 'Servicios públicos',
    tema: 'servicios',
    metricas: [
      ['cobertura_acueducto', 'Acueducto'],
      ['cobertura_alcantarillado', 'Alcantarillado'],
      ['cobertura_aseo', 'Aseo'],
      ['suscriptores_acueducto', 'Suscriptores de acueducto']
    ]
  },
  {
    id: 'territorio',
    titulo: 'Territorio y cultura',
    tema: 'territorio',
    metricas: [
      ['pct_amenaza_alta', 'Área en amenaza alta'],
      ['construcciones_amenaza_alta', 'Construcciones en amenaza alta'],
      ['construcciones_riesgo_no_mitigable', 'Alto riesgo no mitigable'],
      ['m2_verde_hab', 'Verde por habitante'],
      ['m2_espacio_publico_hab', 'Espacio público por habitante'],
      ['equipamientos_por_10mil', 'Equipamientos'],
      ['sedes_por_10mil', 'Sedes educativas'],
      ['bic', 'Patrimonio']
    ]
  },
  {
    id: 'construccion',
    titulo: 'Construcción y redes',
    tema: 'lentes',
    metricas: [
      ['pisos_promedio', 'Pisos promedio'],
      ['indice_construccion_bruto', 'Índice de construcción'],
      ['pct_sobre_altura_normativa', 'Sobre la altura normativa'],
      ['construcciones', 'Construcciones'],
      ['victimas_por_km2_anio', 'Víctimas viales'],
      ['km_mt_por_km2', 'Red de media tensión'],
      ['veh_eq_hora_pico', 'Volumen en hora pico']
    ]
  },
  {
    id: 'turismo',
    titulo: 'Turismo',
    tema: 'turismo',
    metricas: [
      ['atractivos', 'Atractivos'],
      ['hospedajes_osm', 'Hospedajes']
    ]
  }
];

// El último año (o periodo: "2021–2023", "vigente") con dato de un indicador entre todos los territorios.
function ultimoAnio(filas, clave) {
  return (
    filas
      .flatMap((t) => Object.keys(t.valores?.[clave] ?? {}))
      .sort()
      .at(-1) ?? null
  );
}

const TIPO = { comuna: 'Comuna', corregimiento: 'Corregimiento' };

/**
 * Métricas del nivel comuna a partir de los temas del lago (lago.temas).
 * Devuelve { territorios: [{codigo, nombre, tipo}], metricas: [{id, grupo, tema, clave, corto, ind, anio, valores, series}] }
 *   valores: {código: valor del último año | null}    series: {código: [[año, valor], ...]}
 */
export function construirAtlas(temas) {
  const metricas = [];
  const territorios = new Map();
  for (const grupo of GRUPOS) {
    const listas = temas?.[grupo.tema]?.listas;
    if (!listas?.indicadores || !listas?.territorios) continue;
    const porClave = Object.fromEntries(listas.indicadores.map((i) => [i.clave, i]));
    const filas = listas.territorios.filter((t) => t.valores);
    for (const t of filas) {
      if (!territorios.has(t.codigo)) {
        territorios.set(t.codigo, {
          codigo: t.codigo,
          nombre: t.nombre.replace(/^Corregimiento de /, ''),
          tipo: TIPO[t.tipo.toLowerCase()] ?? t.tipo
        });
      }
    }
    for (const [clave, corto] of grupo.metricas) {
      const ind = porClave[clave];
      const anio = ind && ultimoAnio(filas, clave);
      if (!anio) continue;
      metricas.push({
        id: `${grupo.tema}.${clave}`,
        grupo: grupo.id,
        tema: grupo.tema,
        clave,
        corto,
        ind,
        anio,
        valores: Object.fromEntries(filas.map((t) => [t.codigo, t.valores[clave]?.[anio] ?? null])),
        series: Object.fromEntries(filas.map((t) => [t.codigo, Object.entries(t.valores[clave] ?? {}).sort(([a], [b]) => a.localeCompare(b))]))
      });
    }
  }
  return { territorios: [...territorios.values()].sort((a, b) => a.codigo.localeCompare(b.codigo)), metricas };
}

const titulo = (texto) =>
  String(texto ?? '')
    .toLowerCase()
    .replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

/**
 * Barrios y veredas de los límites del gemelo (barrios.geojson y veredas.geojson) como [{codigo, nombre, tipo, comuna}].
 * Un código repetido (una vereda partida en dos polígonos) cuenta una sola vez.
 */
export function lugaresDeBarrios(barrios, veredas, territorios = []) {
  const comuna = Object.fromEntries(territorios.map((t) => [t.codigo, t.nombre]));
  const porCodigo = new Map();
  for (const [geo, tipo] of [
    [barrios, 'Barrio'],
    [veredas, 'Vereda']
  ]) {
    for (const { properties: p } of geo?.features ?? []) {
      if (!porCodigo.has(p.CODIGO)) {
        porCodigo.set(p.CODIGO, { codigo: p.CODIGO, nombre: p.NOMBRE_BARRIO, tipo, comuna: comuna[p.COMUNA] ?? titulo(p.NOMBRE_COMUNA) });
      }
    }
  }
  return [...porCodigo.values()];
}

/**
 * Métricas del nivel barrio. `archivos` son los JSON de public/data/geo con { indicadores, barrios: {código: {clave: valor}} }
 * y `lugares`, los barrios y veredas de los límites ([{codigo, nombre, tipo, comuna}]). Un indicador con `faltante`
 * (por ejemplo 0 en los conteos del SISC) usa ese valor para los lugares que no aparecen en su archivo.
 */
export function construirBarrios(archivos, lugares) {
  const metricas = [];
  for (const [grupo, archivo] of archivos) {
    if (!archivo?.indicadores || !archivo?.barrios) continue;
    for (const ind of archivo.indicadores) {
      const faltante = ind.faltante ?? null;
      metricas.push({
        id: `barrio.${grupo}.${ind.clave}`,
        grupo,
        clave: ind.clave,
        corto: ind.etiqueta.replace(/ \(SISC\)$/, ''),
        ind,
        // La vigencia hace de "año" ("2021–2023", "Base catastral vigente"); el rótulo de histórico va en la procedencia.
        anio: ind.vigencia.replace(' (histórico)', ''),
        valores: Object.fromEntries(lugares.map((l) => [l.codigo, archivo.barrios[l.codigo]?.[ind.clave] ?? faltante]))
      });
    }
  }
  return metricas;
}

/**
 * Puesto de cada territorio en una métrica, de mayor a menor valor. Los empates comparten puesto (1, 2, 2, 4).
 * Devuelve { de: territorios con dato, puesto: {código: n} }. Es una posición, no una calificación.
 */
export function puestos(valores) {
  const conDato = Object.entries(valores)
    .filter(([, v]) => v != null)
    .sort(([, a], [, b]) => b - a);
  const puesto = {};
  conDato.forEach(([codigo, v], i) => {
    puesto[codigo] = i > 0 && conDato[i - 1][1] === v ? puesto[conDato[i - 1][0]] : i + 1;
  });
  return { de: conDato.length, puesto };
}

/** Filas del ranking de una métrica: [{codigo, nombre, valor, puesto}], de mayor a menor. */
export function ranking(metrica, lugares) {
  const { puesto } = puestos(metrica.valores);
  return lugares
    .filter((l) => metrica.valores[l.codigo] != null)
    .map((l) => ({ ...l, valor: metrica.valores[l.codigo], puesto: puesto[l.codigo] }))
    .sort((a, b) => a.puesto - b.puesto || a.nombre.localeCompare(b.nombre, 'es'));
}
