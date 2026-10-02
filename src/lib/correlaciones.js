// Correlaciones: cruza de a dos las métricas del nivel comuna del Atlas (construirAtlas de ./atlas.js) y calcula, para
// cada par, el coeficiente de Spearman entre los territorios que tienen dato en las dos. No hay un tema propio en el
// lago: todo se deriva en el navegador de las métricas que ya publica cada tema, y por eso su estado es `derivado`.
//
// Este módulo no importa nada: lo usan la vista de Correlaciones y las pruebas (tests/correlaciones.test.mjs).

// Con menos territorios no hay coeficiente: dos puntos siempre quedan en línea.
export const MINIMO_TERRITORIOS = 3;

/**
 * Por qué una métrica del Atlas no entra a la matriz. Las de un motivo con `dispersion` sí se pueden elegir en el
 * diagrama de dispersión: quedan fuera de la matriz solo para que se pueda leer.
 */
export const MOTIVOS = {
  tamano: {
    titulo: 'Conteos, montos y participaciones en un total',
    texto:
      'Crecen con el tamaño del territorio (más habitantes, más casos, más construcciones, más inversión): entre ellas la correlación mediría sobre todo ese tamaño. Cuando el Atlas tiene la misma medida como tasa, porcentaje o densidad, entra esa.'
  },
  parcial: {
    titulo: 'No se miden igual en todos los territorios',
    texto:
      'El dato cubre solo una parte de cada territorio (las intersecciones aforadas, el suelo urbano de los corregimientos), así que el orden entre territorios no compara lo mismo.'
  },
  compuesta: {
    titulo: 'Se calcula con otras métricas de la matriz',
    texto: 'Es un cociente de dos métricas que ya están: su correlación con ellas sale de la fórmula, no de los territorios.'
  },
  empates: {
    titulo: 'Más de la mitad de los territorios comparte el mismo valor',
    texto: 'Con la mayoría de los territorios empatados, la métrica casi no los ordena y el coeficiente depende de unos pocos.'
  },
  repetida: {
    titulo: 'Otra métrica de su misma familia ya está en la matriz',
    texto:
      'De cada familia de métricas de una misma fuente (condiciones de vida, hurtos, precios de vivienda, cobertura de servicios) quedan una o dos, para que la matriz se pueda leer con el coeficiente escrito en cada celda. No se descartan: se pueden elegir en el diagrama de dispersión, que calcula su coeficiente de la misma forma.',
    dispersion: true
  }
};

const tamano = { motivo: 'tamano' };
const repetida = (queda) => ({ motivo: 'repetida', queda });

/** Métricas del Atlas (id `tema.clave`) que no entran a la matriz y por qué. `queda` es la métrica que la representa. */
export const FUERA = {
  'demografia.poblacion': tamano,
  'demografia.hogares': tamano,
  'demografia.viviendas': tamano,
  'seguridad.sisc_homicidio': tamano,
  'economia.licencias': tamano,
  'economia.establecimientos_ica': tamano,
  'economia.empresas_camara': tamano,
  'municipio.inversion_publica': tamano,
  'municipio.inversion_participacion': tamano,
  'municipio.predial_facturado': tamano,
  'servicios.suscriptores_acueducto': tamano,
  'territorio.construcciones_amenaza_alta': tamano,
  'territorio.construcciones_riesgo_no_mitigable': tamano,
  'territorio.bic': tamano,
  'lentes.construcciones': tamano,
  'turismo.atractivos': tamano,
  'turismo.hospedajes_osm': tamano,
  'lentes.veh_eq_hora_pico': { motivo: 'parcial' },
  'territorio.m2_verde_hab': { motivo: 'parcial' },
  'economia.rentabilidad_bruta': { motivo: 'compuesta' },
  'demografia.idh': repetida('demografia.imcv'),
  'seguridad.sisc_hurto_carro_tasa': repetida('seguridad.sisc_hurto_persona_tasa'),
  'seguridad.sisc_hurto_moto_tasa': repetida('seguridad.sisc_hurto_persona_tasa'),
  'seguridad.sisc_hurto_comercio_tasa': repetida('seguridad.sisc_hurto_persona_tasa'),
  'economia.arriendo_m2': repetida('economia.venta_m2'),
  'servicios.cobertura_alcantarillado': repetida('servicios.cobertura_acueducto'),
  'servicios.cobertura_aseo': repetida('servicios.cobertura_acueducto')
};

/** Cuántos territorios comparten el valor más repetido de una métrica (los que no tienen dato no cuentan). */
export function masRepetido(valores) {
  const veces = new Map();
  for (const v of Object.values(valores)) if (v != null) veces.set(v, (veces.get(v) ?? 0) + 1);
  return Math.max(0, ...veces.values());
}

const conDato = (valores) => Object.values(valores).filter((v) => v != null).length;

/**
 * Reparte las métricas del Atlas en las que entran a la matriz, las que se pueden elegir en el diagrama de dispersión
 * (las de la matriz y las `repetida`) y las que quedan fuera, con su motivo. Devuelve
 * { matriz: [métrica], dispersion: [métrica], fuera: [{metrica, motivo, queda?, repetidos?}] }.
 */
export function clasificar(metricas) {
  const matriz = [];
  const dispersion = [];
  const fuera = [];
  for (const metrica of metricas) {
    const repetidos = masRepetido(metrica.valores);
    const regla = FUERA[metrica.id] ?? (repetidos * 2 > conDato(metrica.valores) ? { motivo: 'empates', repetidos } : null);
    if (!regla) matriz.push(metrica);
    else fuera.push({ metrica, ...regla });
    if (!regla || MOTIVOS[regla.motivo].dispersion) dispersion.push(metrica);
  }
  return { matriz, dispersion, fuera };
}

/**
 * Rango de cada valor, de menor (1) a mayor (n). Los empates comparten el rango medio: [10, 20, 20, 30] → [1, 2.5, 2.5, 4].
 * No es el puesto del Atlas, que ordena de mayor a menor y no promedia los empates.
 */
export function rangos(valores) {
  const orden = valores.map((v, i) => [v, i]).sort(([a], [b]) => a - b);
  const rango = new Array(valores.length);
  for (let i = 0; i < orden.length;) {
    let j = i;
    while (j + 1 < orden.length && orden[j + 1][0] === orden[i][0]) j++;
    for (let k = i; k <= j; k++) rango[orden[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return rango;
}

/** Coeficiente de Pearson de dos listas del mismo largo; null si alguna no varía. */
export function pearson(x, y) {
  const n = x.length;
  const mediaX = x.reduce((s, v) => s + v, 0) / n;
  const mediaY = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mediaX;
    const dy = y[i] - mediaY;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  // El redondeo de la raíz puede dejar un par perfecto en 1,0000000000000002.
  return Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy)));
}

/**
 * Coeficiente de Spearman: el de Pearson calculado sobre los rangos, que es la definición que vale con empates.
 * null si hay menos de MINIMO_TERRITORIOS pares o si una de las dos listas tiene todos sus valores iguales.
 */
export function spearman(x, y) {
  if (x.length !== y.length || x.length < MINIMO_TERRITORIOS) return null;
  return pearson(rangos(x), rangos(y));
}

/**
 * Correlación de dos métricas entre los territorios que tienen dato en las dos.
 * Devuelve { rho, n, usados: [código], sinDato: [código] }; `rho` es null si no se puede calcular.
 */
export function correlacion(a, b, codigos) {
  const usados = codigos.filter((c) => a.valores[c] != null && b.valores[c] != null);
  return {
    rho: spearman(
      usados.map((c) => a.valores[c]),
      usados.map((c) => b.valores[c])
    ),
    n: usados.length,
    usados,
    sinDato: codigos.filter((c) => a.valores[c] == null || b.valores[c] == null)
  };
}

/** Matriz simétrica de correlaciones: celdas[i][j] es correlacion(metricas[i], metricas[j]) y la diagonal, null. */
export function matrizDeCorrelacion(metricas, codigos) {
  const celdas = metricas.map(() => new Array(metricas.length).fill(null));
  for (let i = 0; i < metricas.length; i++) {
    for (let j = i + 1; j < metricas.length; j++) {
      celdas[i][j] = celdas[j][i] = correlacion(metricas[i], metricas[j], codigos);
    }
  }
  return celdas;
}

/** Primer y último año que aparecen en los periodos de las métricas ("2021–2023", "2026"); "vigente" no cuenta. */
export function rangoDeAnios(metricas) {
  const anios = metricas.flatMap((m) => String(m.anio).match(/\d{4}/g) ?? []).sort();
  return anios.length ? [anios[0], anios.at(-1)] : null;
}

/** "+0,62", "−0,62" o "0,00"; "—" si no se pudo calcular. El signo va siempre: es lo que distingue los dos sentidos. */
export function formatoCoeficiente(rho) {
  if (rho == null) return '—';
  const redondeado = Math.round(rho * 100) / 100;
  const texto = Math.abs(redondeado).toFixed(2).replace('.', ',');
  return redondeado === 0 ? texto : `${redondeado < 0 ? '−' : '+'}${texto}`;
}
