// Diagnóstico territorial del Panorama (issue #14): "¿Qué ocurre en esta parte de Medellín?". No tiene tema propio en el
// lago. Combina los índices 0–100 de las tres lentes del gemelo (energía, densificación y presión vial, que publica
// `lentes`) con un peso que depende de la prioridad elegida, y acompaña la lectura con el riesgo y las condiciones de
// vida de cada territorio, que no entran al índice. Todo es posición relativa entre las 16 comunas y 5 corregimientos:
// el puesto ordena de mayor a menor índice y no califica.
//
// Lo usan la vista del Panorama y las pruebas (tests/diagnostico.test.mjs).

import { construirAtlas, puestos } from './atlas.js';

// Las tres dimensiones del índice. Sus indicadores y la forma de escalarlos los declara el lago (lentes.metodo_indices).
export const DIMENSIONES = [
  { id: 'energia', nombre: 'Energía', corto: 'energía' },
  { id: 'densificacion', nombre: 'Densificación', corto: 'densificación' },
  { id: 'vial', nombre: 'Presión vial', corto: 'presión vial' }
];

// La prioridad elegida pesa 60 % y las otras dos, 20 % cada una. Equilibrio es el promedio simple: el mismo índice de la
// lente "Cruce urbano" del gemelo. Los pesos son una decisión de lectura, no un dato.
export const PRIORIDADES = [
  { id: 'equilibrio', nombre: 'Equilibrio', pesos: { energia: 1, densificacion: 1, vial: 1 } },
  { id: 'infraestructura', nombre: 'Infraestructura', pesos: { energia: 3, densificacion: 1, vial: 1 } },
  { id: 'densificacion', nombre: 'Densificación', pesos: { energia: 1, densificacion: 3, vial: 1 } },
  { id: 'movilidad', nombre: 'Movilidad', pesos: { energia: 1, densificacion: 1, vial: 3 } }
];

// Contexto de la lectura: se muestra con su valor, su puesto y su distancia a la mediana, pero no entra al índice. Sumar,
// por ejemplo, el IMCV obligaría a decidir si un valor mayor suma o resta, y eso sería una valoración.
export const CONTEXTO = [
  { id: 'riesgo', nombre: 'Riesgo', metricas: ['territorio.pct_amenaza_alta', 'territorio.construcciones_amenaza_alta'] },
  { id: 'vida', nombre: 'Condiciones de vida', metricas: ['demografia.imcv', 'demografia.pobreza_multidimensional'] }
];

const TIPO = { comuna: 'Comuna', corregimiento: 'Corregimiento' };

/**
 * Arma el diagnóstico a partir de los temas del lago. Devuelve null si falta el tema `lentes`.
 * {
 *   zonas: [{codigo, nombre, tipo, indices: {energia, densificacion, vial}}],
 *   dimensiones: [{id, nombre, corto, indicadores: [{id, tema, clave, ind, valores}]}],
 *   contexto: [{id, nombre, indicadores: [{id, tema, clave, corto, ind, anio, valores}]}]
 * }
 * `valores` va por código de territorio; un territorio sin dato tiene null.
 */
export function construirDiagnostico(temas) {
  const listas = temas?.lentes?.listas;
  if (!listas?.territorios?.length || !listas?.metodo_indices) return null;
  const porClave = Object.fromEntries((listas.indicadores ?? []).map((i) => [i.clave, i]));
  const filas = listas.territorios;
  const zonas = filas.map((t) => ({
    codigo: t.codigo,
    nombre: t.nombre.replace(/^Corregimiento de /, ''),
    tipo: TIPO[t.tipo.toLowerCase()] ?? t.tipo,
    indices: Object.fromEntries(DIMENSIONES.map((d) => [d.id, t[`indice_${d.id}`] ?? null]))
  }));
  const dimensiones = DIMENSIONES.map((d) => {
    const metodo = listas.metodo_indices.find((m) => m.lente === d.id);
    const indicadores = (metodo?.indicadores ?? [])
      .filter(({ campo }) => porClave[campo])
      .map(({ campo }) => ({
        id: `lentes.${campo}`,
        tema: 'lentes',
        clave: campo,
        ind: porClave[campo],
        valores: Object.fromEntries(filas.map((t) => [t.codigo, t[campo] ?? null]))
      }));
    return { ...d, indicadores };
  }).filter((d) => d.indicadores.length && zonas.some((z) => z.indices[d.id] != null));
  const atlas = construirAtlas(temas);
  const contexto = CONTEXTO.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    indicadores: c.metricas
      .map((id) => atlas.metricas.find((m) => m.id === id))
      .filter(Boolean)
      .map(({ id, tema, clave, corto, ind, anio, valores }) => ({ id, tema, clave, corto, ind, anio, valores }))
  })).filter((c) => c.indicadores.length);
  return { zonas, dimensiones, contexto };
}

/** Pesos de una prioridad en proporción (suman 1) entre las dimensiones que existen. */
export function proporciones(prioridad, dimensiones = DIMENSIONES) {
  const total = dimensiones.reduce((s, d) => s + (prioridad.pesos[d.id] ?? 0), 0) || 1;
  return Object.fromEntries(dimensiones.map((d) => [d.id, (prioridad.pesos[d.id] ?? 0) / total]));
}

/** Índice combinado de una zona: promedio ponderado de sus índices. Una dimensión sin dato no cuenta, y su peso se reparte. */
export function indiceCombinado(zona, prioridad, dimensiones = DIMENSIONES) {
  let suma = 0;
  let pesos = 0;
  for (const d of dimensiones) {
    const valor = zona.indices[d.id];
    const peso = prioridad.pesos[d.id] ?? 0;
    if (valor == null || !peso) continue;
    suma += valor * peso;
    pesos += peso;
  }
  return pesos ? suma / pesos : null;
}

/** Índice y puesto de cada zona con una prioridad. Devuelve { de, indice: {código: n}, puesto: {código: n} }. */
export function clasificar(zonas, prioridad, dimensiones = DIMENSIONES) {
  const indice = Object.fromEntries(zonas.map((z) => [z.codigo, indiceCombinado(z, prioridad, dimensiones)]));
  // Se compara con un decimal, el mismo que se muestra: dos índices que se ven iguales comparten puesto.
  const redondeado = Object.fromEntries(Object.entries(indice).map(([c, v]) => [c, v == null ? null : Math.round(v * 10) / 10]));
  return { indice, ...puestos(redondeado) };
}

export function mediana(valores) {
  const v = valores.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Distancia de un valor a la mediana de los territorios, en texto: "12 % sobre la mediana", "8 % bajo la mediana",
 * "igual a la mediana". Es una posición, no un juicio.
 */
export function frenteAMediana(valor, med) {
  if (valor == null) return 'sin dato';
  if (med == null) return '';
  if (valor === med) return 'igual a la mediana';
  if (med === 0) return 'sobre la mediana, que es 0';
  const pct = (valor / med - 1) * 100;
  const lado = pct > 0 ? 'sobre' : 'bajo';
  const magnitud = Math.abs(pct);
  if (magnitud < 0.5) return `menos de 1 % ${lado} la mediana`;
  return `${Math.round(magnitud).toLocaleString('es-CO')} % ${lado} la mediana`;
}

/** Índice y puesto de una zona con cada una de las cuatro prioridades, y el rango de puestos que ocupa. */
export function sensibilidad(zonas, codigo, dimensiones = DIMENSIONES) {
  const filas = PRIORIDADES.map((prioridad) => {
    const { indice, puesto, de } = clasificar(zonas, prioridad, dimensiones);
    return { prioridad, indice: indice[codigo], puesto: puesto[codigo], de };
  });
  const lista = filas.map((f) => f.puesto).filter((p) => p != null);
  return { filas, min: Math.min(...lista), max: Math.max(...lista) };
}

const decimal = (valor, decimales = 1) =>
  Number(valor).toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

// "Área en amenaza alta" → "área en amenaza alta", pero una sigla ("IMCV") se deja como está.
const minuscula = (texto) => (/^.[a-záéíóúñ]/.test(texto) ? texto.charAt(0).toLowerCase() + texto.slice(1) : texto);

// "52,1 de 100" para los índices de 0 a 100, "3,2 % del área", "4.180 construcciones".
export function conUnidad(valor, ind) {
  const numero = decimal(valor, ind.decimales ?? 0);
  if (/^puntos de 0 a 100/.test(ind.unidad)) return `${numero} de 100`;
  return `${numero} ${ind.unidad}`;
}

/**
 * Conclusión de la zona con la prioridad elegida, en frases sin valoraciones: su índice y su puesto, la dimensión con el
 * índice mayor y la del menor, cuánto cambia el puesto con las otras prioridades y el contexto (riesgo y condiciones de
 * vida) con su puesto. Devuelve { indice, puesto, de, frases: [texto, ...] }.
 */
export function conclusion(diagnostico, codigo, prioridad) {
  const { zonas, dimensiones, contexto } = diagnostico;
  const zona = zonas.find((z) => z.codigo === codigo);
  const { indice, puesto, de } = clasificar(zonas, prioridad, dimensiones);
  if (indice[codigo] == null) return { indice: null, puesto: null, de, frases: [`${zona.nombre} no tiene índices en el lago.`] };
  const frases = [
    `Con la prioridad ${prioridad.nombre}, ${zona.nombre} ocupa el puesto ${puesto[codigo]} de ${de} en el índice combinado (${decimal(indice[codigo])} de 100).`
  ];
  const conDato = dimensiones.filter((d) => zona.indices[d.id] != null).sort((a, b) => zona.indices[b.id] - zona.indices[a.id]);
  if (conDato.length > 1) {
    const [mayor, menor] = [conDato[0], conDato.at(-1)];
    frases.push(
      zona.indices[mayor.id] === zona.indices[menor.id]
        ? `Sus ${conDato.length} índices valen lo mismo (${decimal(zona.indices[mayor.id])}).`
        : `Su índice mayor es el de ${mayor.corto} (${decimal(zona.indices[mayor.id])}) y el menor, el de ${menor.corto} (${decimal(zona.indices[menor.id])}).`
    );
  }
  const { min, max } = sensibilidad(zonas, codigo, dimensiones);
  frases.push(
    min === max
      ? `Ocupa el mismo puesto con las ${PRIORIDADES.length} prioridades.`
      : `Con las ${PRIORIDADES.length} prioridades, su puesto va del ${min} al ${max}.`
  );
  const fuera = (contexto ?? []).flatMap((c) =>
    c.indicadores
      .filter((i) => i.valores[codigo] != null)
      .map((i) => {
        const { de: n, puesto: p } = puestos(i.valores);
        return `${minuscula(i.corto)} (${i.anio}), ${conUnidad(i.valores[codigo], i.ind)}, puesto ${p[codigo]} de ${n}`;
      })
  );
  if (fuera.length) frases.push(`Fuera del índice: ${fuera.join('; ')}.`);
  return { indice: indice[codigo], puesto: puesto[codigo], de, frases };
}
