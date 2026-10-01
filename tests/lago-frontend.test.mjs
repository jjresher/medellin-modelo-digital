// Coherencia entre el lago (public/data/lago) y el código que lo lee. verificar.py valida el lago por dentro; esto valida
// que el frontend no pida cifras ni fuentes que el lago no tiene (una tarjeta sin dato se omite en silencio).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const LAGO = 'public/data/lago';
const leer = (archivo) => JSON.parse(readFileSync(join(LAGO, archivo), 'utf8'));
const indice = leer('indice.json');
const catalogo = leer('catalogo.json');
const temas = Object.fromEntries(indice.temas.map(({ tema }) => [tema, leer(`${tema}.json`)]));
const idsCatalogo = new Set(catalogo.datasets.map((d) => d.id));

function archivosFuente(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && /\.jsx?$/.test(e.name))
    .map((e) => join(e.parentPath, e.name));
}
const codigo = archivosFuente('src')
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

test('cada tema del índice existe y declara su nombre', () => {
  for (const { tema } of indice.temas) assert.equal(temas[tema].tema, tema);
});

test('toda fuente de un tema está en el catálogo, y el catálogo no trae huérfanas', () => {
  const usadas = new Set();
  for (const [tema, datos] of Object.entries(temas)) {
    for (const f of datos.fuentes) {
      usadas.add(f.id);
      assert.ok(idsCatalogo.has(f.id), `${tema}: la fuente ${f.id} no está en el catálogo`);
    }
    for (const [clave, cifra] of Object.entries(datos.cifras)) {
      assert.ok(
        datos.fuentes.some((f) => f.id === cifra.fuente),
        `${tema}.${clave}: fuente ${cifra.fuente} no declarada en el tema`
      );
    }
  }
  for (const id of idsCatalogo) assert.ok(usadas.has(id), `el catálogo trae ${id}, que ningún tema usa`);
});

test('las cifras ancla de cada tema existen', () => {
  for (const [tema, datos] of Object.entries(temas)) {
    for (const clave of datos.ancla ?? []) assert.ok(datos.cifras[clave], `${tema}: la cifra ancla ${clave} no existe`);
  }
});

test('el catálogo cuenta bien sus datasets por estado', () => {
  assert.equal(catalogo.n, catalogo.datasets.length);
  const porEstado = {};
  for (const d of catalogo.datasets) porEstado[d.estado] = (porEstado[d.estado] ?? 0) + 1;
  assert.deepEqual(porEstado, catalogo.por_estado);
});

test('los ids de fuente que el código pasa a onSource() o a las capas del mapa existen en el catálogo', () => {
  const ids = new Set();
  for (const m of codigo.matchAll(/onSource\(\s*'([a-z0-9-]+)'\s*\)/g)) ids.add(m[1]);
  for (const m of codigo.matchAll(/layerSource\[[^\]]+\]\s*=\s*'([a-z0-9-]+)'/g)) ids.add(m[1]);
  for (const m of codigo.matchAll(/fuentes:\s*\[([^\]]*)\]/g)) for (const id of m[1].matchAll(/'([a-z0-9-]+)'/g)) ids.add(id[1]);
  assert.ok(ids.size > 5, 'no se encontró ningún id: ¿cambió la forma de referenciarlos?');
  for (const id of ids) assert.ok(idsCatalogo.has(id), `el código referencia la fuente ${id}, que no está en el catálogo`);
});

test('las claves de cifra que las vistas piden por nombre existen en su tema', () => {
  // `tema.cifras.<clave>` o `tema.cifras['<clave>']` en las vistas; se buscan en el tema que la vista recibe.
  const vistas = {
    'src/components/TerritorioView.jsx': 'territorio',
    'src/components/MunicipioView.jsx': 'municipio',
    'src/components/ServiciosView.jsx': 'servicios',
    'src/components/TurismoView.jsx': 'turismo',
    'src/components/EconomiaView.jsx': 'economia',
    'src/components/GenteView.jsx': 'demografia',
    'src/components/SeguridadView.jsx': 'seguridad'
  };
  for (const [archivo, tema] of Object.entries(vistas)) {
    const texto = readFileSync(archivo, 'utf8');
    for (const m of texto.matchAll(/tema\.cifras\.([a-z0-9_]+)/g)) {
      assert.ok(temas[tema].cifras[m[1]], `${archivo}: tema.cifras.${m[1]} no existe en ${tema}.json`);
    }
  }
});
