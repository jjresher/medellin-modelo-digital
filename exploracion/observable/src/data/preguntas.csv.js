// Cargador de datos: corre al construir el sitio y deja una instantánea dentro del sitio publicado.
import { readFileSync } from 'node:fs';
process.stdout.write(readFileSync(new URL('../../../datos/preguntas_por_comuna.csv', import.meta.url)));
