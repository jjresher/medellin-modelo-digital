import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { construirAtlas } from '../src/lib/atlas.js';
import {
  FUERA,
  MINIMO_TERRITORIOS,
  MOTIVOS,
  clasificar,
  correlacion,
  formatoCoeficiente,
  masRepetido,
  matrizDeCorrelacion,
  pearson,
  rangoDeAnios,
  rangos,
  spearman
} from '../src/lib/correlaciones.js';

const leer = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('rangos va de menor a mayor y los empates comparten el rango medio', () => {
  assert.deepEqual(rangos([30, 10, 20]), [3, 1, 2]);
  assert.deepEqual(rangos([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
  assert.deepEqual(rangos([5, 5, 5]), [2, 2, 2]);
  assert.deepEqual(rangos([]), []);
});

test('pearson: recta perfecta, recta inversa y lista sin variación', () => {
  cerca(pearson([1, 2, 3], [10, 20, 30]), 1);
  cerca(pearson([1, 2, 3], [30, 20, 10]), -1);
  assert.equal(pearson([1, 2, 3], [7, 7, 7]), null);
});

test('spearman mide el orden, no los valores', () => {
  // Una relación creciente pero no lineal da 1; Pearson, no.
  const x = [1, 2, 3, 4, 5];
  const cubos = x.map((v) => v ** 3);
  assert.equal(spearman(x, cubos), 1);
  assert.ok(pearson(x, cubos) < 1);
  assert.equal(spearman(x, [50, 40, 30, 20, 10]), -1);
  // Sin empates coincide con 1 − 6·Σd² / (n·(n² − 1)): d² = 1+1+1+1+0 → 1 − 24/120 = 0,8.
  cerca(spearman(x, [2, 1, 4, 3, 5]), 0.8);
  // Con empates: rangos [1, 2.5, 2.5, 4] y [1, 2, 3, 4] → 4,5 / √(4,5 × 5).
  cerca(spearman([1, 2, 2, 3], [1, 2, 3, 4]), 4.5 / Math.sqrt(22.5));
});

test('spearman no cambia con un valor extremo; pearson sí', () => {
  const x = [1, 2, 3, 4, 5, 6];
  const y = [2, 1, 4, 3, 6, 5];
  const yExtremo = [2, 1, 4, 3, 600, 5];
  cerca(spearman(x, y), spearman(x, yExtremo));
  assert.ok(Math.abs(pearson(x, y) - pearson(x, yExtremo)) > 0.3);
});

test('spearman devuelve null cuando no se puede calcular', () => {
  assert.equal(MINIMO_TERRITORIOS, 3);
  assert.equal(spearman([1, 2], [2, 1]), null);
  assert.equal(spearman([1, 2, 3], [4, 4, 4]), null);
  assert.equal(spearman([1, 2, 3], [1, 2]), null);
});

test('correlacion usa solo los territorios con dato en las dos métricas y dice cuántos fueron', () => {
  const codigos = ['01', '02', '03', '04', '05'];
  const a = { valores: { '01': 1, '02': 2, '03': 3, '04': 4, '05': null } };
  const b = { valores: { '01': 10, '02': null, '03': 30, '04': 20, '05': 50 } };
  const par = correlacion(a, b, codigos);
  assert.equal(par.n, 3);
  assert.deepEqual(par.usados, ['01', '03', '04']);
  assert.deepEqual(par.sinDato, ['02', '05']);
  cerca(par.rho, 0.5);
  // El orden de las dos métricas no cambia el resultado.
  assert.deepEqual(correlacion(b, a, codigos), par);
  // Con dos territorios en común no hay coeficiente, pero sí el n.
  const c = { valores: { '01': 1, '02': 2 } };
  assert.deepEqual(correlacion(a, c, codigos), { rho: null, n: 2, usados: ['01', '02'], sinDato: ['03', '04', '05'] });
});

test('matrizDeCorrelacion es simétrica y deja la diagonal vacía', () => {
  const codigos = ['a', 'b', 'c', 'd'];
  const metricas = [{ valores: { a: 1, b: 2, c: 3, d: 4 } }, { valores: { a: 4, b: 3, c: 2, d: 1 } }, { valores: { a: 1, b: 3, c: 2, d: null } }];
  const celdas = matrizDeCorrelacion(metricas, codigos);
  assert.equal(celdas[0][0], null);
  assert.equal(celdas[0][1].rho, -1);
  assert.equal(celdas[1][0], celdas[0][1]);
  assert.equal(celdas[0][2].n, 3);
  cerca(celdas[2][0].rho, 0.5);
});

test('clasificar separa la matriz, el diagrama y lo que queda fuera, y detecta los empates', () => {
  const valores = (lista) => Object.fromEntries(lista.map((v, i) => [String(i), v]));
  const metricas = [
    { id: 'demografia.imcv', valores: valores([1, 2, 3, 4]) },
    { id: 'demografia.poblacion', valores: valores([1, 2, 3, 4]) },
    { id: 'demografia.idh', valores: valores([1, 2, 3, 4]) },
    { id: 'tema.nueva', valores: valores([0, 0, 0, 4]) },
    { id: 'tema.mitad', valores: valores([0, 0, 3, null, 4]) }
  ];
  const { matriz, dispersion, fuera } = clasificar(metricas);
  assert.deepEqual(
    matriz.map((m) => m.id),
    ['demografia.imcv', 'tema.mitad']
  );
  assert.deepEqual(
    dispersion.map((m) => m.id),
    ['demografia.imcv', 'demografia.idh', 'tema.mitad']
  );
  assert.deepEqual(
    fuera.map((f) => [f.metrica.id, f.motivo, f.queda ?? f.repetidos ?? null]),
    [
      ['demografia.poblacion', 'tamano', null],
      ['demografia.idh', 'repetida', 'demografia.imcv'],
      ['tema.nueva', 'empates', 3]
    ]
  );
  assert.equal(masRepetido(valores([null, null, 1, 1, 2])), 2);
  assert.equal(masRepetido({}), 0);
});

test('rangoDeAnios y formatoCoeficiente', () => {
  assert.deepEqual(rangoDeAnios([{ anio: '2021–2023' }, { anio: 'vigente' }, { anio: '2019' }, { anio: '2026' }]), ['2019', '2026']);
  assert.equal(rangoDeAnios([{ anio: 'vigente' }]), null);
  assert.equal(formatoCoeficiente(0.618), '+0,62');
  assert.equal(formatoCoeficiente(-0.618), '−0,62');
  assert.equal(formatoCoeficiente(-0.004), '0,00');
  assert.equal(formatoCoeficiente(1), '+1,00');
  assert.equal(formatoCoeficiente(null), '—');
});

// ---- contra el lago real: lo que la sección promete tiene que salir de los datos

const temas = Object.fromEntries(leer('public/data/lago/indice.json').temas.map(({ tema }) => [tema, leer(`public/data/lago/${tema}.json`)]));
const atlas = construirAtlas(temas);
const codigos = atlas.territorios.map((t) => t.codigo);

test('cada métrica del Atlas está en la matriz o queda fuera con un motivo, y las reglas no nombran métricas que ya no existen', () => {
  const ids = new Set(atlas.metricas.map((m) => m.id));
  assert.deepEqual(
    Object.keys(FUERA).filter((id) => !ids.has(id)),
    [],
    'métricas de FUERA que el Atlas ya no trae'
  );
  const { matriz, dispersion, fuera } = clasificar(atlas.metricas);
  assert.equal(matriz.length + fuera.length, atlas.metricas.length);
  const enMatriz = new Set(matriz.map((m) => m.id));
  for (const f of fuera) {
    assert.ok(MOTIVOS[f.motivo], `${f.metrica.id}: motivo desconocido`);
    assert.equal(f.motivo === 'repetida', Boolean(f.queda), `${f.metrica.id}: solo una métrica repetida nombra a la que queda`);
    if (f.queda) assert.ok(enMatriz.has(f.queda), `${f.metrica.id}: ${f.queda} no está en la matriz`);
  }
  assert.equal(dispersion.length, matriz.length + fuera.filter((f) => f.motivo === 'repetida').length);
  // Con más de 24 métricas el coeficiente ya no cabe escrito en cada celda a 1400 px.
  assert.ok(matriz.length >= 2 && matriz.length <= 24, `la matriz tiene ${matriz.length} métricas`);
  // Ninguna métrica de la matriz se mide en una unidad de conteo o de monto (las que quedaron fuera por tamaño).
  const unidadesDeTamano = new Set(fuera.filter((f) => f.motivo === 'tamano' && f.metrica.ind.unidad !== '%').map((f) => f.metrica.ind.unidad));
  for (const m of matriz) assert.ok(!unidadesDeTamano.has(m.ind.unidad), `${m.id}: ${m.ind.unidad}`);
});

test('todos los pares de la matriz tienen coeficiente, n y año de cada métrica', () => {
  const { matriz } = clasificar(atlas.metricas);
  const celdas = matrizDeCorrelacion(matriz, codigos);
  matriz.forEach((a, i) => {
    assert.ok(a.anio, `${a.id}: sin año`);
    matriz.forEach((b, j) => {
      if (i === j) return;
      const { rho, n, usados, sinDato } = celdas[i][j];
      assert.ok(rho >= -1 && rho <= 1, `${a.id} × ${b.id}: ρ = ${rho}`);
      assert.equal(n, codigos.filter((c) => a.valores[c] != null && b.valores[c] != null).length);
      assert.equal(usados.length + sinDato.length, codigos.length);
    });
  });
});

test('un par con territorios sin dato se calcula con menos de 21 y lo dice', () => {
  const { matriz } = clasificar(atlas.metricas);
  const incompleta = matriz.find((m) => Object.values(m.valores).some((v) => v == null));
  assert.ok(incompleta, 'la matriz no tiene ninguna métrica con territorios sin dato');
  const completa = matriz.find((m) => Object.values(m.valores).every((v) => v != null));
  const par = correlacion(incompleta, completa, codigos);
  assert.equal(par.n, Object.values(incompleta.valores).filter((v) => v != null).length);
  assert.ok(par.n < codigos.length);
  assert.deepEqual(
    par.sinDato,
    codigos.filter((c) => incompleta.valores[c] == null)
  );
});
