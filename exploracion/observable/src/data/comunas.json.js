import { readFileSync } from 'node:fs';
process.stdout.write(readFileSync(new URL('../../../../public/data/geo/comunas.geojson', import.meta.url)));
