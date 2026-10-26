// Las preguntas de la vista Preguntas piden indicadores del lago: que existan, que tengan un año común con dato en casi todos
// los territorios, y que cada fuente tenga su código F y su licencia en el catálogo.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PENDIENTES, PREGUNTAS, anioDe, ranking, valoresDe } from '../src/lib/preguntas.js';

const leer = (archivo) => JSON.parse(readFileSync(`public/data/lago/${archivo}`, 'utf8'));
const catalogo = leer('catalogo.json');
const porId = Object.fromEntries(catalogo.datasets.map((d) => [d.id, d]));

test('cada indicador de cada pregunta existe, tiene fuente con código y licencia, y cubre al menos 15 territorios', () => {
  for (const p of PREGUNTAS) {
    const tema = leer(`${p.tema}.json`);
    for (const [clave] of p.indicadores) {
      const ind = tema.listas.indicadores.find((i) => i.clave === clave);
      assert.ok(ind, `${p.id}: falta el indicador ${clave}`);
      const ficha = porId[ind.fuente];
      assert.match(ficha.codigo, /^F\d{2,}$/, `${clave}: la fuente no tiene código`);
      assert.ok(ficha.licencia && ficha.licencia_probada, `${clave}: la fuente no tiene licencia leída`);
      const anio = anioDe(tema.listas.territorios, clave);
      assert.ok(anio, `${clave}: sin año con dato`);
      assert.ok(ranking(tema.listas.territorios, clave, anio).length >= 15, `${clave}: menos de 15 territorios con dato en ${anio}`);
    }
  }
});

test('los indicadores de una misma pregunta comparten el año con dato', () => {
  for (const p of PREGUNTAS) {
    const tema = leer(`${p.tema}.json`);
    const anios = new Set(p.indicadores.map(([clave]) => anioDe(tema.listas.territorios, clave)));
    assert.equal(anios.size, 1, `${p.id}: mezcla los años ${[...anios].join(', ')}`);
  }
});

test('valoresDe y ranking omiten los territorios sin dato', () => {
  const t = [
    { codigo: '01', nombre: 'A', tipo: 'Comuna', valores: { x: { 2022: 5 } } },
    { codigo: '02', nombre: 'B', tipo: 'Comuna', valores: {} }
  ];
  assert.deepEqual(valoresDe(t, 'x', '2022'), { '01': 5 });
  assert.equal(ranking(t, 'x', '2022').length, 1);
  assert.equal(anioDe(t, 'x'), '2022');
});

test('las preguntas pendientes nombran una fuente del catálogo', () => {
  for (const p of PENDIENTES) assert.ok(porId[p.fuente], p.fuente);
});
