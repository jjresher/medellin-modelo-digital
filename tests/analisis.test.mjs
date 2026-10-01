import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resumenAnalisis } from '../src/components/twin/analisis.js';

const punto = (lon, lat, propiedades = {}) => ({ geometry: { coordinates: [lon, lat] }, properties: propiedades });

test('resumenAnalisis suma solo lo que cae dentro de cada radio', () => {
  const centro = [-75.57, 6.25];
  // Rejilla de 0,001° con una celda en el centro (3 construcciones) y otra a ~2,2 km (fuera de ambos radios).
  const celda = 0.001;
  const x0 = -75.6;
  const y0 = 6.2;
  const ci = Math.floor((centro[0] - x0) / celda);
  const cj = Math.floor((centro[1] - y0) / celda);
  const datos = {
    grid: {
      celda,
      x0,
      y0,
      periodo_victimas: '2019–2021',
      celdas: { [`${ci}_${cj}`]: [3, 300, 12, 6, 2], [`${ci + 20}_${cj}`]: [9, 900, 90, 20, 9] }
    },
    equip: [punto(-75.57, 6.2501, { componente: 'Educación' }), punto(-75.57, 6.2502, { componente: 'Educación' }), punto(-75.6, 6.3)],
    metro: [punto(-75.5702, 6.25, { nombre: 'Cercana' }), punto(-75.5, 6.25, { nombre: 'Lejana' })],
    sub: [punto(-75.57, 6.26, { nombre: 'Subestación' })],
    encicla: []
  };
  const r = resumenAnalisis(centro, datos);
  assert.equal(r.periodoVictimas, '2019–2021');
  assert.deepEqual(
    r.radios.map((x) => x.construcciones),
    [3, 3]
  );
  assert.equal(r.radios[0].pisosProm, 4);
  assert.equal(r.radios[0].pisosMax, 6);
  assert.equal(r.radios[0].victimas, 2);
  assert.equal(r.radios[0].equipamientos, 2);
  assert.deepEqual(r.radios[0].porComponente, [['Educación', 2]]);
  assert.equal(r.radios[0].metro, 1);
  assert.equal(r.metroCercana.nombre, 'Cercana');
  assert.equal(r.subestacionCercana.nombre, 'Subestación');
});

test('resumenAnalisis sobre la rejilla real: el centro de Medellín tiene construcciones y el 1 km incluye al de 500 m', () => {
  const grid = JSON.parse(readFileSync('public/data/geo/analisis.json', 'utf8'));
  const r = resumenAnalisis([-75.5686, 6.2476], { grid, equip: [], metro: [], sub: [], encicla: [] });
  assert.ok(r.radios[0].construcciones > 0);
  assert.ok(r.radios[1].construcciones >= r.radios[0].construcciones);
  assert.equal(r.metroCercana, null);
});
