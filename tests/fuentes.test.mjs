import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFINICION_ESTADO, ESTADOS, contarPor, dominio, estadosDelLago, filtrarCatalogo, textoUso, usoPorFuente } from '../src/lib/fuentes.js';

const leer = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const catalogo = leer('public/data/lago/catalogo.json');
const indice = leer('public/data/lago/indice.json');
const temas = Object.fromEntries(indice.temas.map(({ tema }) => [tema, leer(`public/data/lago/${tema}.json`)]));

const muestra = [
  {
    id: 'a',
    nombre: 'Homicidios',
    entidad: 'Policía Nacional',
    tema: 'seguridad',
    estado: 'observado',
    uso: 'Tasa',
    url: 'https://www.datos.gov.co/x'
  },
  {
    id: 'b',
    nombre: 'Tarifas de energía',
    entidad: 'EPM',
    tema: 'servicios',
    estado: 'declarado',
    uso: 'Estrato 1',
    url: 'https://www.epm.com.co/y'
  },
  { id: 'c', nombre: 'Cobertura por comuna', entidad: 'MinTIC', tema: 'servicios', estado: 'candidato', uso: '', url: 'https://mintic.gov.co' }
];

test('los filtros de tema, estado y texto se combinan, y el texto ignora tildes y mayúsculas', () => {
  assert.deepEqual(
    filtrarCatalogo(muestra, { tema: 'servicios' }).map((d) => d.id),
    ['b', 'c']
  );
  assert.deepEqual(
    filtrarCatalogo(muestra, { tema: 'servicios', estado: 'declarado' }).map((d) => d.id),
    ['b']
  );
  assert.deepEqual(
    filtrarCatalogo(muestra, { texto: 'POLICIA' }).map((d) => d.id),
    ['a']
  );
  // Todas las palabras, en cualquier campo: nombre, entidad, id, uso o URL.
  assert.deepEqual(
    filtrarCatalogo(muestra, { texto: 'epm estrato' }).map((d) => d.id),
    ['b']
  );
  assert.deepEqual(
    filtrarCatalogo(muestra, { texto: 'datos.gov' }).map((d) => d.id),
    ['a']
  );
  assert.equal(filtrarCatalogo(muestra, { texto: '   ' }).length, 3);
  assert.equal(filtrarCatalogo(muestra, { texto: 'nada parecido' }).length, 0);
});

test('conteos, dominio y texto de uso', () => {
  assert.deepEqual(contarPor(muestra, 'tema'), { seguridad: 1, servicios: 2 });
  assert.equal(dominio('https://www.datos.gov.co/resource/abc.json?x=1'), 'datos.gov.co');
  assert.equal(dominio('no es una url'), 'no es una url');
  assert.equal(textoUso({ cifras: 1, series: 2, indicadores: 0 }), '1 cifra · 2 series');
  assert.equal(textoUso({ cifras: 0, series: 0, indicadores: 1 }), '1 indicador por territorio');
  assert.equal(textoUso(undefined), '');
});

test('el catálogo cuadra con los temas: cada dataset con sus campos, en un tema del índice y con el conteo por estado', () => {
  assert.equal(catalogo.datasets.length, catalogo.n);
  const conteo = contarPor(catalogo.datasets, 'estado');
  assert.deepEqual(conteo, catalogo.por_estado);
  const titulos = new Set(indice.temas.map((t) => t.tema));
  for (const d of catalogo.datasets) {
    for (const campo of ['id', 'nombre', 'entidad', 'url', 'estado', 'tema', 'vigencia', 'probado']) {
      assert.ok(d[campo], `${d.id ?? '?'} sin ${campo}`);
    }
    assert.ok(titulos.has(d.tema), `${d.id}: el tema ${d.tema} no está en el índice`);
    assert.ok(ESTADOS.includes(d.estado), `${d.id}: estado ${d.estado}`);
    assert.doesNotThrow(() => new URL(d.url), `${d.id}: URL inválida`);
  }
  // Los filtros de la vista suman el total con cualquier tema elegido.
  for (const tema of titulos) {
    const n = filtrarCatalogo(catalogo.datasets, { tema }).length;
    assert.equal(
      Object.values(contarPor(filtrarCatalogo(catalogo.datasets, { tema }), 'estado')).reduce((s, x) => s + x, 0),
      n
    );
  }
});

test('lo que la app toma de cada fuente sale del lago, y toda fuente que aporta datos está en el catálogo', () => {
  const uso = usoPorFuente(temas);
  const ids = new Set(catalogo.datasets.map((d) => d.id));
  for (const id of Object.keys(uso)) assert.ok(ids.has(id), `el lago usa la fuente ${id}, que no está en el catálogo`);
  // Una fuente sin cifras, series ni indicadores es una capa del mapa o una lectura en vivo: declara para qué se usa.
  for (const d of catalogo.datasets) {
    if (!textoUso(uso[d.id])) assert.ok(d.uso && !d.uso.endsWith('…'), `${d.id} no aporta datos y no dice para qué se usa`);
  }
  const total = Object.values(uso).reduce((s, u) => s + u.cifras, 0);
  assert.equal(
    total,
    Object.values(temas).reduce((s, t) => s + Object.keys(t.cifras).length, 0)
  );
});

test('cada estado tiene definición, y los conteos del lago suman todas las cifras', () => {
  for (const e of ESTADOS) assert.ok(DEFINICION_ESTADO[e]?.length > 40, e);
  const conteo = estadosDelLago(temas);
  const cifras = ESTADOS.reduce((s, e) => s + conteo[e].cifras, 0);
  assert.equal(
    cifras,
    Object.values(temas).reduce((s, t) => s + Object.keys(t.cifras).length, 0)
  );
  // Ninguna vigencia del catálogo es el genérico "Servicio vigente" si la fuente aporta datos con periodo propio.
  const uso = usoPorFuente(temas);
  for (const d of catalogo.datasets) {
    if (d.vigencia === 'Servicio vigente') assert.ok(!uso[d.id]?.indicadores, `${d.id}: vigencia genérica con indicadores por territorio`);
  }
});
