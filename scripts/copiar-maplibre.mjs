// Copia el worker y el módulo compartido de MapLibre a public/maplibre para servirlos como recursos estáticos
// (ver src/lib/maplibre.js). Se corre solo tras `npm install`, así la copia siempre coincide con la versión instalada.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const origen = 'node_modules/maplibre-gl/dist';
const destino = 'public/maplibre';
const archivos = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

if (!existsSync(origen)) {
  console.warn(`copiar-maplibre: no existe ${origen}; se omite.`);
} else {
  mkdirSync(destino, { recursive: true });
  for (const archivo of archivos) copyFileSync(`${origen}/${archivo}`, `${destino}/${archivo}`);
  console.log(`copiar-maplibre: ${archivos.length} archivos en ${destino}`);
}
