import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CONTEXTO,
  DIMENSIONES,
  PRIORIDADES,
  clasificar,
  conclusion,
  construirDiagnostico,
  frenteAMediana,
  indiceCombinado,
  mediana,
  proporciones,
  sensibilidad
} from '../src/lib/diagnostico.js';
import { CAPAS_LUGARES, buscarLugares, indiceDeLugares, normalizar, puntoEnGeometria, territorioDe } from '../src/lib/lugares.js';

const leer = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const indice = leer('public/data/lago/indice.json');
const temas = Object.fromEntries(indice.temas.map(({ tema }) => [tema, leer(`public/data/lago/${tema}.json`)]));
const diagnostico = construirDiagnostico(temas);
const prioridad = (id) => PRIORIDADES.find((p) => p.id === id);

// ---------------------------------------------------------------- cálculo

test('los pesos de cada prioridad: Equilibrio reparte por igual y las demás dan 60 % a su dimensión', () => {
  for (const p of Object.values(proporciones(prioridad('equilibrio')))) assert.ok(Math.abs(p - 1 / 3) < 1e-9);
  assert.deepEqual(proporciones(prioridad('infraestructura')), { energia: 0.6, densificacion: 0.2, vial: 0.2 });
  assert.deepEqual(proporciones(prioridad('densificacion')), { energia: 0.2, densificacion: 0.6, vial: 0.2 });
  assert.deepEqual(proporciones(prioridad('movilidad')), { energia: 0.2, densificacion: 0.2, vial: 0.6 });
  assert.deepEqual(
    PRIORIDADES.map((p) => p.nombre),
    ['Equilibrio', 'Infraestructura', 'Densificación', 'Movilidad']
  );
});

test('el índice combinado pondera, y una dimensión sin dato reparte su peso entre las demás', () => {
  const zona = { indices: { energia: 80, densificacion: 20, vial: 50 } };
  assert.equal(indiceCombinado(zona, prioridad('equilibrio')), 50);
  assert.ok(Math.abs(indiceCombinado(zona, prioridad('infraestructura')) - (80 * 3 + 20 + 50) / 5) < 1e-9);
  assert.equal(indiceCombinado({ indices: { energia: 80, densificacion: null, vial: 50 } }, prioridad('equilibrio')), 65);
  assert.equal(indiceCombinado({ indices: { energia: null, densificacion: null, vial: null } }, prioridad('equilibrio')), null);
});

test('dos índices que se ven iguales (un decimal) comparten puesto', () => {
  const zonas = [
    { codigo: 'a', indices: { energia: 50.01, densificacion: 50, vial: 50 } },
    { codigo: 'b', indices: { energia: 50, densificacion: 50, vial: 50 } },
    { codigo: 'c', indices: { energia: 10, densificacion: 10, vial: 10 } }
  ];
  const { puesto, de } = clasificar(zonas, prioridad('equilibrio'));
  assert.deepEqual(puesto, { a: 1, b: 1, c: 3 });
  assert.equal(de, 3);
});

test('mediana y distancia a la mediana, sin calificar', () => {
  assert.equal(mediana([3, null, 1, 2]), 2);
  assert.equal(mediana([4, 1, 3, 2]), 2.5);
  assert.equal(mediana([null]), null);
  assert.equal(frenteAMediana(12, 10), '20 % sobre la mediana');
  assert.equal(frenteAMediana(8, 10), '20 % bajo la mediana');
  assert.equal(frenteAMediana(10, 10), 'igual a la mediana');
  assert.equal(frenteAMediana(10.01, 10), 'menos de 1 % sobre la mediana');
  assert.equal(frenteAMediana(3, 0), 'sobre la mediana, que es 0');
  assert.equal(frenteAMediana(null, 10), 'sin dato');
});

test('sin el tema lentes no hay diagnóstico', () => {
  assert.equal(construirDiagnostico({ demografia: temas.demografia }), null);
  assert.equal(construirDiagnostico({}), null);
});

// ---------------------------------------------------------------- contra el lago real

test('el diagnóstico tiene los 21 territorios, las tres dimensiones y el contexto, todo del lago', () => {
  assert.ok(diagnostico);
  assert.equal(diagnostico.zonas.length, temas.lentes.listas.territorios.length);
  assert.equal(diagnostico.zonas.length, 21);
  assert.deepEqual(
    diagnostico.dimensiones.map((d) => d.id),
    DIMENSIONES.map((d) => d.id)
  );
  for (const d of diagnostico.dimensiones) {
    assert.ok(d.indicadores.length >= 1, `${d.id} sin indicadores`);
    for (const i of d.indicadores) {
      assert.ok(i.ind.fuente && i.ind.vigencia && i.ind.estado, `${i.id}: falta fuente, vigencia o estado`);
      assert.ok(
        temas.lentes.fuentes.some((f) => f.id === i.ind.fuente),
        `${i.id}: la fuente no está en el tema`
      );
    }
    for (const z of diagnostico.zonas) assert.ok(z.indices[d.id] != null, `${z.nombre} sin índice de ${d.id}`);
  }
  // Cada métrica de contexto existe en el lago: si una cambia de nombre, la prueba lo dice en vez de omitirla en silencio.
  assert.deepEqual(
    diagnostico.contexto.flatMap((c) => c.indicadores.map((i) => i.id)),
    CONTEXTO.flatMap((c) => c.metricas)
  );
});

test('con Equilibrio, el índice combinado es el de la lente «Cruce urbano» del lago', () => {
  const porCodigo = Object.fromEntries(temas.lentes.listas.territorios.map((t) => [t.codigo, t.indice_cruce]));
  for (const z of diagnostico.zonas) {
    assert.ok(Math.abs(indiceCombinado(z, prioridad('equilibrio')) - porCodigo[z.codigo]) <= 0.051, `${z.nombre}`);
  }
});

test('la conclusión cambia con la prioridad y nunca califica', () => {
  const valoraciones =
    /\b(bueno|buena|malo|mala|mejor|peor|preocupante|grave|cr[ií]tic[oa]|alarmante|positiv[oa]|negativ[oa]|deficiente|excelente|riesgos[oa])\b/i;
  let cambia = false;
  for (const z of diagnostico.zonas) {
    const puestosZona = new Set();
    for (const p of PRIORIDADES) {
      const c = conclusion(diagnostico, z.codigo, p);
      const texto = c.frases.join(' ');
      assert.ok(c.puesto >= 1 && c.puesto <= c.de, `${z.nombre}: puesto ${c.puesto}`);
      assert.ok(texto.includes(`prioridad ${p.nombre}`) && texto.includes(z.nombre));
      assert.doesNotMatch(texto, /undefined|NaN|null/);
      assert.doesNotMatch(texto, valoraciones, `${z.nombre} · ${p.nombre}: ${texto}`);
      puestosZona.add(c.puesto);
    }
    if (puestosZona.size > 1) cambia = true;
    const s = sensibilidad(diagnostico.zonas, z.codigo, diagnostico.dimensiones);
    assert.equal(s.filas.length, PRIORIDADES.length);
    assert.equal(s.min, Math.min(...puestosZona));
    assert.equal(s.max, Math.max(...puestosZona));
  }
  assert.ok(cambia, 'ningún territorio cambia de puesto con la prioridad');
});

// ---------------------------------------------------------------- buscador de lugares

test('normalizar quita tildes, mayúsculas y signos', () => {
  assert.equal(normalizar('Estación San Antonio (Línea B)'), 'estacion san antonio linea b');
  assert.equal(normalizar('  Belén  '), 'belen');
});

test('un punto dentro de un hueco del polígono queda fuera', () => {
  const cuadrado = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0]
  ];
  const hueco = [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
    [4, 4]
  ];
  const geometria = { type: 'Polygon', coordinates: [cuadrado, hueco] };
  assert.equal(puntoEnGeometria([2, 2], geometria), true);
  assert.equal(puntoEnGeometria([5, 5], geometria), false);
  assert.equal(puntoEnGeometria([12, 5], geometria), false);
  assert.equal(puntoEnGeometria([5, 5], { type: 'MultiPolygon', coordinates: [[hueco]] }), true);
});

const geo = (archivo) => leer(`public/data/geo/${archivo}`);
const lugares = indiceDeLugares({
  comunas: geo('comunas.geojson'),
  barrios: geo('barrios.geojson'),
  veredas: geo('veredas.geojson'),
  capas: CAPAS_LUGARES.map(([archivo]) => [archivo, geo(`capas/${archivo}.geojson`)])
});

test('el índice de lugares tiene los 21 territorios y cada barrio o vereda una sola vez', () => {
  assert.deepEqual(lugares.territorios.map((t) => t.codigo).sort(), diagnostico.zonas.map((z) => z.codigo).sort());
  const codigos = new Set(geo('barrios.geojson').features.map((f) => f.properties.CODIGO));
  for (const f of geo('veredas.geojson').features) codigos.add(f.properties.CODIGO);
  const barriosYVeredas = lugares.lugares.filter((l) => l.tipo === 'Barrio' || l.tipo === 'Vereda');
  assert.equal(barriosYVeredas.length, codigos.size);
});

test('la búsqueda devuelve primero el territorio, ubica cada punto en su comuna y deja fuera lo que no es de Medellín', () => {
  const estadio = buscarLugares(lugares, 'estadio');
  assert.equal(estadio[0].nombre, 'Laureles Estadio');
  assert.equal(estadio[0].tipo, 'Comuna');
  const estacion = estadio.find((l) => l.nombre === 'Estación Estadio (Línea B)');
  assert.equal(estacion?.codigo, '11');
  // Sin tildes ni mayúsculas, y con varias palabras en cualquier orden.
  assert.ok(buscarLugares(lugares, 'arvi parque').some((l) => l.codigo === '90'));
  // Las estaciones del Metro fuera de Medellín (Niquía, en Bello) no tienen territorio y no aparecen.
  assert.ok(
    lugares.lugares.some((l) => l.clave.includes('niquia')),
    'la capa del Metro ya no trae Niquía'
  );
  assert.deepEqual(buscarLugares(lugares, 'niquia'), []);
  assert.deepEqual(buscarLugares(lugares, 'a'), []);
  const codigos = new Set(lugares.territorios.map((t) => t.codigo));
  for (const q of ['san', 'parque', 'biblioteca', 'la']) {
    const r = buscarLugares(lugares, q);
    assert.ok(r.length > 0 && r.length <= 8, q);
    for (const l of r) assert.ok(codigos.has(l.codigo), `${q}: ${l.nombre} sin territorio`);
  }
  assert.equal(territorioDe([0, 0], lugares.territorios), null);
});
