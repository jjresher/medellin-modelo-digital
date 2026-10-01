import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cifrasAncla, formatoUnidad, formatoValor } from '../src/lib/lago.js';
import { categoriaIca, esMedellin, marcaSiata, municipioVisible } from '../src/lib/vivo.js';
import { circle, distance, formatDistance, formatNumber, metersPerPixel } from '../src/components/twin/geo.js';

// Los separadores de miles dependen del ICU de Node; se normalizan los espacios no separables.
const plano = (texto) => texto.replace(/ /g, ' ');

test('formatoValor: porcentaje, millones, enteros y sin dato', () => {
  assert.equal(plano(formatoValor({ valor: 6.97, unidad: '%' })), '7,0 %');
  assert.equal(plano(formatoValor({ valor: 6.97, unidad: '%', decimales: 2 })), '6,97 %');
  assert.equal(plano(formatoValor({ valor: 2526795, unidad: 'personas' })), '2,53 M');
  assert.equal(plano(formatoValor({ valor: 41219, unidad: 'construcciones' })), '41.219');
  assert.equal(formatoValor({ valor: null, estado: 'candidato' }), 'Sin dato abierto');
  assert.equal(formatoValor({ valor: 'Acuerdo 48 de 2014', unidad: '' }), 'Acuerdo 48 de 2014');
});

test('formatoUnidad: el porcentaje y los textos no repiten unidad', () => {
  assert.equal(formatoUnidad({ valor: 5, unidad: '%' }), '');
  assert.equal(formatoUnidad({ valor: 'texto', unidad: 'x' }), '');
  assert.equal(formatoUnidad({ valor: null, unidad: 'x' }), '');
  assert.equal(formatoUnidad({ valor: 5, unidad: 'ha' }), 'ha');
});

test('cifrasAncla sigue el orden del índice y marca el tema de cada cifra', () => {
  const lago = {
    orden: ['a', 'b'],
    temas: {
      a: { ancla: ['x'], cifras: { x: { valor: 1 }, y: { valor: 2 } } },
      b: { ancla: ['z', 'x'], cifras: { x: { valor: 3 }, z: { valor: 4 } } }
    }
  };
  assert.deepEqual(
    cifrasAncla(lago).map((c) => [c.tema, c.clave, c.valor]),
    [
      ['a', 'x', 1],
      ['b', 'z', 4],
      ['b', 'x', 3]
    ]
  );
});

test('categoriaIca respeta los cortes de la Resolución 2254 de 2017', () => {
  assert.equal(categoriaIca(0).nombre, 'Buena');
  assert.equal(categoriaIca(50).nombre, 'Buena');
  assert.equal(categoriaIca(51).nombre, 'Aceptable');
  assert.equal(categoriaIca(150).nombre, 'Dañina a la salud de grupos sensibles');
  assert.equal(categoriaIca(301).nombre, 'Peligrosa');
  assert.equal(categoriaIca(-1), null);
});

test('el SIATA escribe Medellín de varias formas y todas se reconocen', () => {
  for (const nombre of ['Medellín', 'Medellin', 'Medellin ', 'MEDELLÍN']) assert.ok(esMedellin({ Municipio: nombre }), nombre);
  assert.equal(municipioVisible({ municipio: 'Medellin ' }), 'Medellín');
  assert.equal(municipioVisible({ Ciudad: 'Envigado' }), 'Envigado');
  assert.ok(!esMedellin({ Municipio: 'Bello' }));
});

test('marcaSiata no reinterpreta la hora local como UTC', () => {
  assert.equal(marcaSiata('2026-09-26 22:18:03'), '2026-09-26 22:18');
  assert.equal(marcaSiata('2026-09-26T22:18:03'), '2026-09-26 22:18');
  assert.equal(marcaSiata(null), '');
});

test('geometría del gemelo: distancia, círculo y escala', () => {
  const parque = [-75.5686, 6.2476];
  assert.equal(Math.round(distance(parque, parque)), 0);
  // Un grado de latitud son ~111,2 km.
  assert.ok(Math.abs(distance([-75, 6], [-75, 7]) - 111195) < 200);
  const c = circle(parque, 500);
  assert.equal(c.geometry.coordinates[0].length, 73);
  for (const punto of c.geometry.coordinates[0]) assert.ok(Math.abs(distance(parque, punto) - 500) < 1);
  assert.ok(metersPerPixel(6.25, 15) < metersPerPixel(6.25, 14));
  assert.equal(plano(formatDistance(500)), '500 m');
  assert.equal(plano(formatDistance(1500)), '1,5 km');
  assert.equal(plano(formatNumber(1234.5, 1)), '1.234,5');
});
