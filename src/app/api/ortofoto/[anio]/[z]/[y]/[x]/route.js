import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Proxy con caché para las ortofotos de la Alcaldía. Su servidor de mapas se cae con frecuencia y, cuando
// falla, responde sin cabeceras CORS, así que el navegador no puede usarlo directo. Cada tesela descargada
// se guarda en disco y se sirve con caché larga: una ortofoto publicada no cambia.
const SERVICIO = (anio) => `https://www.medellin.gov.co/servidormapas/rest/services/ServiciosCiudad/IMAGEN_WEBM_${anio}/MapServer/tile`;
const ANIOS = new Set(['2016', '2019', '2021', '2024']);
// La caché es local (fuera de git): el comentario evita que el build la meta en el paquete de la ruta.
const CACHE = path.join(/* turbopackIgnore: true */ process.cwd(), '.cache', 'ortofoto');
const UN_ANIO = 60 * 60 * 24 * 365;

const entero = (valor) => /^\d{1,8}$/.test(valor);

function imagen(cuerpo, tipo) {
  return new Response(cuerpo, {
    headers: {
      'Content-Type': tipo,
      'Cache-Control': `public, max-age=${UN_ANIO}, s-maxage=${UN_ANIO}, immutable`
    }
  });
}

export async function GET(request, { params }) {
  const { anio, z, y, x } = await params;
  if (!ANIOS.has(anio) || ![z, y, x].every(entero) || Number(z) > 23) {
    return new Response('Tesela no válida', { status: 400 });
  }

  const archivo = path.join(CACHE, anio, z, y, `${x}.jpg`);
  try {
    return imagen(await readFile(archivo), 'image/jpeg');
  } catch {
    // No está en caché: se pide al servidor de la Alcaldía.
  }

  try {
    const respuesta = await fetch(`${SERVICIO(anio)}/${z}/${y}/${x}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/128 medellin-modelo-digital' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store'
    });
    const tipo = respuesta.headers.get('content-type') ?? '';
    if (!respuesta.ok || !tipo.startsWith('image/')) throw new Error(`HTTP ${respuesta.status}`);
    const cuerpo = Buffer.from(await respuesta.arrayBuffer());
    // En un despliegue con disco de solo lectura la escritura falla; entonces solo queda la caché HTTP.
    mkdir(path.dirname(archivo), { recursive: true })
      .then(() => writeFile(archivo, cuerpo))
      .catch(() => {});
    return imagen(cuerpo, tipo);
  } catch (error) {
    // Sin tesela, MapLibre deja ver la capa satelital de debajo.
    return new Response(`Ortofoto no disponible: ${error.message}`, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
