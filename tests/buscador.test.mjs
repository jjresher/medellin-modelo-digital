import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { navigation } from '../src/data/navegacion.js';
import { SECCION_DE_TEMA, buscarGeneral, consultaGemelo, indiceGeneral } from '../src/lib/buscador.js';
import { describirTiempo, horaMedellin, leerClima, simboloTiempo } from '../src/lib/clima.js';
import { fuenteDe, hashDe, leerRuta, tituloDe } from '../src/lib/ruta.js';

const leer = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
const indice = leer('public/data/lago/indice.json');
const lago = {
  orden: indice.temas.map(({ tema }) => tema),
  temas: Object.fromEntries(indice.temas.map(({ tema }) => [tema, leer(`public/data/lago/${tema}.json`)]))
};
const ids = new Set(navigation.map(([id]) => id));

test('ruta: el hash da la sección y su consulta; sin hash o desconocido es el Panorama', () => {
  assert.deepEqual(leerRuta(''), { id: 'panorama', query: '' });
  assert.deepEqual(leerRuta('#'), { id: 'panorama', query: '' });
  assert.deepEqual(leerRuta('#people'), { id: 'people', query: '' });
  assert.deepEqual(leerRuta('#twin?v=-75.5,6.2,12,0,55&lente=cruce'), { id: 'twin', query: 'v=-75.5,6.2,12,0,55&lente=cruce' });
  // Un "?" dentro de la consulta no la corta.
  assert.deepEqual(leerRuta('#twin?lugar=¿Qué?'), { id: 'twin', query: 'lugar=¿Qué?' });
  assert.deepEqual(leerRuta('#no-existe'), { id: 'panorama', query: '' });
  assert.equal(hashDe('panorama'), '');
  assert.equal(hashDe('people'), '#people');
  assert.equal(hashDe('sources', 'fuente=dane-pped'), '#sources?fuente=dane-pped');
  for (const id of ids) assert.deepEqual(leerRuta(hashDe(id)), { id, query: '' });
});

test('ruta: la fuente pedida y el título de la pestaña', () => {
  assert.equal(fuenteDe(leerRuta('#sources?fuente=dane-pped')), 'dane-pped');
  assert.equal(fuenteDe(leerRuta('#sources')), null);
  assert.equal(fuenteDe(leerRuta('#people?fuente=x')), null);
  assert.equal(tituloDe('panorama'), 'Medellín · Modelo Digital');
  assert.equal(tituloDe('people'), 'Gente · Medellín · Modelo Digital');
});

test('buscador: cada tema del lago tiene sección y cada cifra entra al índice', () => {
  for (const { tema } of indice.temas) assert.ok(ids.has(SECCION_DE_TEMA[tema]), `${tema} sin sección`);
  const { secciones, cifras } = indiceGeneral(lago);
  assert.equal(secciones.length, navigation.length);
  const total = Object.values(lago.temas).reduce((s, t) => s + Object.keys(t.cifras).length, 0);
  assert.equal(cifras.length, total);
  for (const c of cifras) {
    assert.ok(c.etiqueta && c.vigencia && c.estado && c.fuente, `${c.tema}/${c.clave} incompleta`);
    assert.ok(ids.has(c.seccion));
  }
});

test('buscador: sin texto, todas las secciones; las cifras piden dos letras', () => {
  const ind = indiceGeneral(lago);
  assert.equal(buscarGeneral(ind, '').secciones.length, navigation.length);
  assert.equal(buscarGeneral(ind, '').cifras.length, 0);
  assert.equal(buscarGeneral(ind, 'h').cifras.length, 0);
  assert.deepEqual(buscarGeneral(null, 'x'), { secciones: [], cifras: [] });
});

test('buscador: busca sin tildes ni mayúsculas, por nombre o palabra clave, y ordena por coincidencia', () => {
  const ind = indiceGeneral(lago);
  assert.equal(buscarGeneral(ind, 'ECONOMIA').secciones[0].id, 'economy');
  assert.equal(buscarGeneral(ind, 'aire').secciones[0].id, 'environment');
  assert.equal(buscarGeneral(ind, 'gemelo').secciones[0].id, 'twin');
  const { secciones, cifras } = buscarGeneral(ind, 'homicid');
  assert.equal(secciones[0].id, 'safety');
  assert.ok(cifras.length > 0);
  for (const c of cifras) {
    assert.equal(c.seccion, 'safety');
    assert.match(c.llave, /homicid/);
  }
  // Varias palabras: todas deben estar.
  const tasa = buscarGeneral(ind, 'tasa homicidios').cifras;
  assert.ok(tasa.length > 0 && tasa.every((c) => c.llave.includes('tasa') && c.llave.includes('homicidios')));
  // Lo que empieza por la búsqueda va antes que lo que la contiene en otra parte.
  const desempleo = buscarGeneral(ind, 'desempleo').cifras;
  assert.ok(desempleo[0].llave.startsWith('desempleo'));
  assert.equal(buscarGeneral(ind, 'zzxxqq').cifras.length, 0);
});

test('buscador: un lugar abre el gemelo marcado (punto) o encuadrado (polígono)', () => {
  const punto = new URLSearchParams(
    consultaGemelo({ nombre: 'Estación Estadio (Línea B)', tipo: 'Sistema Metro', geometry: { type: 'Point', coordinates: [-75.588256, 6.253336] } })
  );
  assert.equal(punto.get('p'), '-75.588256,6.253336');
  assert.equal(punto.get('lugar'), 'Estación Estadio (Línea B)');
  assert.equal(punto.get('v').split(',').length, 5);
  const cuadro = {
    type: 'Polygon',
    coordinates: [
      [
        [-75.6, 6.24],
        [-75.58, 6.24],
        [-75.58, 6.26],
        [-75.6, 6.26],
        [-75.6, 6.24]
      ]
    ]
  };
  const barrio = new URLSearchParams(consultaGemelo({ nombre: 'El Estadio', tipo: 'Barrio', geometry: cuadro }));
  assert.equal(barrio.get('p'), null);
  assert.equal(barrio.get('terr'), 'buildings,comunas,barrios,labels');
  const [lon, lat, zoom] = barrio.get('v').split(',').map(Number);
  assert.ok(Math.abs(lon + 75.59) < 1e-6 && Math.abs(lat - 6.25) < 1e-6 && zoom >= 11.5 && zoom <= 16);
  assert.equal(new URLSearchParams(consultaGemelo({ nombre: 'Laureles Estadio', tipo: 'Comuna', geometry: cuadro })).get('terr'), null);
});

test('clima: códigos de la OMM, hora de Medellín y lectura de Open-Meteo', () => {
  assert.equal(describirTiempo(0), 'Despejado');
  assert.equal(describirTiempo(51), 'Llovizna ligera');
  assert.equal(describirTiempo(95), 'Tormenta');
  assert.equal(describirTiempo(42), 'Código OMM 42');
  assert.equal(simboloTiempo(0, true), '☀');
  assert.equal(simboloTiempo(0, false), '☾');
  assert.equal(simboloTiempo(63), '☂');
  // 19:30 UTC son las 14:30 en Medellín (UTC−5, sin horario de verano), sin importar la zona de quien mira.
  assert.equal(horaMedellin(new Date('2026-10-06T19:30:00Z')), '14:30');
  assert.equal(horaMedellin(new Date('2026-10-07T04:05:00Z')), '23:05');
  const clima = leerClima({
    latitude: 6.2214413,
    longitude: -75.55185,
    elevation: 1486,
    current: {
      time: '2026-10-06T14:30',
      interval: 900,
      temperature_2m: 22.1,
      relative_humidity_2m: 89,
      apparent_temperature: 26,
      is_day: 1,
      precipitation: 0.1,
      weather_code: 51,
      wind_speed_10m: 0.7
    }
  });
  assert.equal(clima.temperatura, '22 °C');
  assert.equal(clima.humedad, '89 %');
  assert.equal(clima.viento, '0,7 km/h');
  assert.equal(clima.lluvia, '0,1 mm');
  assert.equal(clima.tiempo, 'Llovizna ligera');
  assert.equal(clima.hora, '14:30');
  assert.equal(clima.intervalo, 15);
  assert.equal(clima.celda, '6,221° N, 75,552° O, 1.486 m');
  assert.equal(leerClima({ current: { temperature_2m: null } }), null);
  assert.equal(leerClima(null), null);
});
