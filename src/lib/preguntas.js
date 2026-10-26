// Preguntas que el sistema responde por comuna y corregimiento (entrega 2). Cada pregunta nombra los indicadores del lago que
// la contestan; la vista dibuja el ranking y el mapa de cada uno con su código de fuente, su periodo y su fecha de prueba.
// Ninguna cifra se escribe aquí: este archivo dice qué indicador mirar y qué cuidados tener al leerlo, no cuánto vale.
//
// Sin imports: lo usan la vista de Preguntas y las pruebas (tests/preguntas.test.mjs).

export const PREGUNTAS = [
  {
    id: 'homicidios',
    origen: 'Entrega 1 · pregunta 2',
    pregunta: '¿Cuáles son las zonas con más homicidios?',
    tema: 'seguridad',
    color: 'pink',
    indicadores: [
      ['sisc_homicidio_tasa', 'Por 10.000 habitantes'],
      ['sisc_homicidio', 'Casos (cantidad)']
    ],
    lectura: [
      'La tasa divide los homicidios de UN año completo entre los habitantes de ese mismo año. No suma años ni usa la población de hoy.',
      'El archivo del SISC llega hasta noviembre de 2023, así que el último año completo es el que se muestra. La serie de la Policía llega a hoy, pero solo para toda la ciudad, no por comuna.',
      'La población de cada comuna es una estimación (el DANE publica el total de la ciudad; el reparto por comuna sigue la proyección del DAP), por eso la tasa lleva el rótulo PROXY.',
      'La tasa cuenta solo a quienes viven en la comuna: donde llega mucha gente que no vive allí (el Centro), el cociente sube sin que eso diga qué le pasa a un residente.'
    ],
    noResponde:
      'No dice quién fue la víctima ni dónde exactamente: el archivo de origen trae sexo, edad, ocupación y coordenadas de cada víctima, y esos campos se quedan en el equipo que procesó el archivo. El mapa por barrio de Seguridad no publica los barrios con menos de 5 casos.'
  },
  {
    id: 'natalidad',
    origen: 'Entrega 1 · pregunta 3',
    pregunta: '¿Cuál es la comuna con mayor natalidad?',
    tema: 'demografia',
    color: 'green',
    indicadores: [
      ['natalidad_tasa', 'Por 100.000 habitantes'],
      ['natalidad_casos', 'Nacidos vivos (cantidad)']
    ],
    lectura: [
      'La tasa la calcula la Secretaría de Salud con sus propias proyecciones de población del DAP: aquí no se divide nada, se muestra como la publica la fuente.',
      'El servicio se rotula «vigente», pero el último año con dato es el que aparece en el título: no es la natalidad de hoy.',
      'En los corregimientos los conteos son pequeños: un cambio de pocos nacimientos mueve mucho la tasa de un año a otro.'
    ],
    noResponde: 'No dice la edad de las madres ni la natalidad por barrio: la fuente solo publica el total por comuna y corregimiento.'
  },
  {
    id: 'verde',
    origen: 'Pregunta nueva de la entrega 2',
    pregunta: '¿Cuánto espacio verde urbano hay por habitante en cada comuna?',
    tema: 'territorio',
    color: 'cyan',
    indicadores: [
      ['m2_verde_hab', 'm² por habitante'],
      ['ha_espacio_verde', 'Hectáreas de espacio verde']
    ],
    lectura: [
      'El inventario es de 2019, así que los m² se dividen entre los habitantes de 2019, no entre los de hoy (en la entrega 1 se dividían entre la población de 2026).',
      'Cuenta zonas verdes públicas y privadas (parques, retiros de quebrada, antejardines, separadores y zonas de unidades residenciales).',
      'El inventario cubre el suelo urbano: en los corregimientos solo aparecen sus centros poblados, así que su valor no mide todo su territorio.'
    ],
    noResponde: 'No dice si el verde es accesible al público ni cuánto es arbolado; el verde público por habitante está en Territorio y cultura.'
  }
];

// Preguntas de la primera entrega que el lago todavía no responde por comuna, y por qué.
export const PENDIENTES = [
  {
    pregunta: '¿Qué comunas tienen mejor acceso a internet fijo?',
    motivo: 'El dato abierto llega por municipio; el de comuna existe pero no es abierto.',
    fuente: 'internet-fijo-comuna'
  },
  {
    pregunta: '¿Cómo es el aire que respira cada comuna?',
    motivo: 'El SIATA mide en estaciones, no en comunas, y sus lecturas en vivo no se guardan en el lago; falta un cruce espacial que no se hizo.',
    fuente: 'siata-pm25'
  },
  {
    pregunta: '¿Cuánta energía demanda cada comuna?',
    motivo: 'No hay datos abiertos de demanda eléctrica por comuna; el gemelo solo muestra la infraestructura.',
    fuente: 'epm-red-electrica'
  }
];

/** Último año con dato de un indicador entre los territorios, o null. */
export function anioDe(territorios, clave) {
  const anios = territorios.flatMap((t) => Object.keys(t.valores?.[clave] ?? {}));
  return anios.sort().at(-1) ?? null;
}

/** {código de territorio: valor} del indicador en ese año; los territorios sin dato no aparecen. */
export function valoresDe(territorios, clave, anio) {
  return Object.fromEntries(territorios.filter((t) => t.valores?.[clave]?.[anio] != null).map((t) => [t.codigo, t.valores[clave][anio]]));
}

/** Ranking de mayor a menor: [{codigo, label, value}], listo para BarChart. */
export function ranking(territorios, clave, anio) {
  return territorios
    .filter((t) => t.valores?.[clave]?.[anio] != null)
    .map((t) => ({ codigo: t.codigo, label: t.nombre, value: t.valores[clave][anio], note: `${t.tipo} · ${anio}` }))
    .sort((a, b) => b.value - a.value);
}
