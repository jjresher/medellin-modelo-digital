import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GRUPOS, construirAtlas, construirBarrios, lugaresDeBarrios, puestos, ranking } from '../src/lib/atlas.js';

const leer = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));

test('puestos ordena de mayor a menor, comparte el puesto en los empates y deja fuera los territorios sin dato', () => {
  const { de, puesto } = puestos({ a: 10, b: 30, c: 30, d: null, e: 5 });
  assert.equal(de, 4);
  assert.deepEqual(puesto, { b: 1, c: 1, a: 3, e: 4 });
});

test('ranking devuelve solo los lugares con dato, ya ordenados', () => {
  const lugares = [
    { codigo: 'a', nombre: 'Uno' },
    { codigo: 'b', nombre: 'Dos' },
    { codigo: 'c', nombre: 'Tres' }
  ];
  const filas = ranking({ valores: { a: 1, b: null, c: 7 } }, lugares);
  assert.deepEqual(
    filas.map((f) => [f.nombre, f.valor, f.puesto]),
    [
      ['Tres', 7, 1],
      ['Uno', 1, 2]
    ]
  );
});

test('construirAtlas toma el último año de cada indicador y omite lo que el lago no trae', () => {
  const temas = {
    demografia: {
      listas: {
        indicadores: [{ clave: 'poblacion', etiqueta: 'Población', unidad: 'habitantes' }],
        territorios: [
          { codigo: '01', nombre: 'Popular', tipo: 'Comuna', valores: { poblacion: { 2025: 90, 2026: 100 } } },
          { codigo: '50', nombre: 'Corregimiento de Palmitas', tipo: 'corregimiento', valores: {} }
        ]
      }
    }
  };
  const { metricas, territorios } = construirAtlas(temas);
  assert.deepEqual(territorios, [
    { codigo: '01', nombre: 'Popular', tipo: 'Comuna' },
    { codigo: '50', nombre: 'Palmitas', tipo: 'Corregimiento' }
  ]);
  assert.equal(metricas.length, 1);
  const [m] = metricas;
  assert.equal(m.id, 'demografia.poblacion');
  assert.equal(m.anio, '2026');
  assert.deepEqual(m.valores, { '01': 100, 50: null });
  assert.deepEqual(m.series['01'], [
    ['2025', 90],
    ['2026', 100]
  ]);
});

test('construirBarrios usa `faltante` para los barrios que no aparecen en un conteo', () => {
  const lugares = [{ codigo: '0101' }, { codigo: '0102' }];
  const archivos = [
    [
      'seguridad',
      {
        indicadores: [{ clave: 'homicidio', etiqueta: 'Homicidio (SISC)', vigencia: '2021–2023', faltante: 0 }],
        barrios: { '0101': { homicidio: 3 } }
      }
    ],
    [
      'construccion',
      { indicadores: [{ clave: 'pisos_promedio', etiqueta: 'Pisos promedio', vigencia: 'vigente' }], barrios: { '0101': { pisos_promedio: 2 } } }
    ],
    ['otro', null]
  ];
  const metricas = construirBarrios(archivos, lugares);
  assert.deepEqual(
    metricas.map((m) => [m.id, m.corto, m.valores]),
    [
      ['barrio.seguridad.homicidio', 'Homicidio', { '0101': 3, '0102': 0 }],
      ['barrio.construccion.pisos_promedio', 'Pisos promedio', { '0101': 2, '0102': null }]
    ]
  );
});

// ---- contra el lago real: lo que el Atlas promete tiene que estar en los datos

const temas = Object.fromEntries(leer('public/data/lago/indice.json').temas.map(({ tema }) => [tema, leer(`public/data/lago/${tema}.json`)]));
const catalogo = new Set(leer('public/data/lago/catalogo.json').datasets.map((d) => d.id));

test('todas las métricas elegidas para el Atlas existen en el lago, con las 21 comunas y corregimientos', () => {
  const { metricas, territorios } = construirAtlas(temas);
  assert.equal(territorios.length, 21);
  const esperadas = GRUPOS.flatMap((g) => g.metricas.map(([clave]) => `${g.tema}.${clave}`));
  assert.deepEqual(
    esperadas.filter((id) => !metricas.some((m) => m.id === id)),
    [],
    'métricas de src/lib/atlas.js que el lago no trae'
  );
  for (const m of metricas) {
    assert.ok(catalogo.has(m.ind.fuente), `${m.id}: la fuente ${m.ind.fuente} no está en el catálogo`);
    assert.ok(
      Object.values(m.valores).some((v) => v != null),
      `${m.id}: ningún territorio tiene dato`
    );
    assert.deepEqual(
      Object.keys(m.valores).sort(),
      territorios.map((t) => t.codigo),
      `${m.id}: códigos de territorio distintos`
    );
  }
});

test('los archivos por barrio traen el contrato y sus códigos existen en los límites', () => {
  // 271 barrios y 78 veredas: una vereda viene partida en dos polígonos con el mismo código y cuenta una vez.
  const lugares = lugaresDeBarrios(leer('public/data/geo/barrios.geojson'), leer('public/data/geo/veredas.geojson'), [
    { codigo: '90', nombre: 'Santa Elena' }
  ]);
  assert.equal(lugares.length, 349);
  assert.equal(lugares.filter((l) => l.tipo === 'Barrio').length, 271);
  assert.deepEqual(
    lugares.find((l) => l.codigo === '9011'),
    { codigo: '9011', nombre: 'Piedras Blancas Represa', tipo: 'Vereda', comuna: 'Santa Elena' }
  );
  assert.equal(lugares.find((l) => l.codigo === '0906').comuna, 'Buenos Aires');
  const codigos = new Set(lugares.map((l) => l.codigo));
  for (const nombre of ['seguridad_barrios', 'construcciones_barrios']) {
    const archivo = leer(`public/data/geo/${nombre}.json`);
    assert.ok(archivo.indicadores?.length > 0, `${nombre}: sin indicadores`);
    for (const ind of archivo.indicadores) {
      for (const campo of ['clave', 'etiqueta', 'unidad', 'fuente', 'vigencia', 'estado'])
        assert.ok(ind[campo], `${nombre}.${ind.clave}: sin ${campo}`);
      assert.ok(catalogo.has(ind.fuente), `${nombre}.${ind.clave}: la fuente ${ind.fuente} no está en el catálogo`);
    }
    const conocidos = Object.keys(archivo.barrios).filter((c) => codigos.has(c));
    assert.ok(conocidos.length > 280, `${nombre}: solo ${conocidos.length} códigos coinciden con los límites`);
  }
});

test('el Área Metropolitana trae sus 10 municipios y la participación suma 100 %', () => {
  const amva = temas.demografia.listas.amva;
  assert.equal(amva.length, 10);
  assert.equal(
    temas.demografia.cifras.poblacion_amva.valor,
    amva.reduce((s, m) => s + m.poblacion, 0)
  );
  for (const m of amva) assert.equal(m.poblacion, m.cabecera + m.rural, m.nombre);
  assert.ok(Math.abs(amva.reduce((s, m) => s + m.participacion, 0) - 100) < 0.5);
  assert.equal(amva.find((m) => m.codigo === '05001').poblacion, temas.demografia.cifras.poblacion.valor);
});
