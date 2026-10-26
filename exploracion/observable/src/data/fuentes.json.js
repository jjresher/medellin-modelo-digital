import { readFileSync } from 'node:fs';
process.stdout.write(readFileSync(new URL('../../../datos/fuentes.json', import.meta.url)));
