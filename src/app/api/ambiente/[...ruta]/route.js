import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Proxy con caché para los datos en vivo (SIATA, USGS y el clima de Open-Meteo). El SIATA no envía cabeceras CORS,
// así que el navegador no puede llamarlo directo; y su geoportal se cae a ratos. Cada recurso se guarda en memoria y en
// disco con la hora de la lectura: si la fuente falla, se responde con la última copia y `obsoleto: true`, para que la
// interfaz pueda decir de cuándo es el dato en vez de quedarse vacía. El clima pasa por aquí para que todos los
// visitantes compartan una lectura cada 15 minutos en vez de pedirle cada uno a Open-Meteo.
//
// Los identificadores de recurso son los mismos que usa ingesta/pull_ambiente.py.
const SIATA = 'https://geoportal.siata.gov.co/fastgeoapi';
const USGS = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const SISMOS = `${USGS}?${new URLSearchParams({
  format: 'geojson',
  starttime: 'now-365days',
  latitude: '6.2476',
  longitude: '-75.5686',
  maxradiuskm: '300',
  minmagnitude: '4',
  orderby: 'time'
})}`;

// Clima actual de la cabecera (issue #16). Open-Meteo responde con su modelo meteorológico para el punto pedido, el
// mismo centro de Medellín de los sismos; no es la lectura de una estación.
const CLIMA = `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
  latitude: '6.2476',
  longitude: '-75.5686',
  current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
  timezone: 'America/Bogota'
})}`;

const RECURSOS = {
  pm25: `${SIATA}/geodata/geodataJson/1/pm25_minio`,
  pluvios: `${SIATA}/geodata/geodataJson/3/pluvios_v2`,
  niveles: `${SIATA}/geodata/geodataJson/2/niveles`,
  meteo: `${SIATA}/geodata/geodataJson/3/tempVient`,
  ruido: `${SIATA}/geodata/geodataJson/1/ruido_oficial`,
  alertas: `${SIATA}/alerts/active/citizen`,
  sismos: SISMOS,
  clima: CLIMA
};

// Recursos con el código de una estación: /api/ambiente/pm25-serie/81
const SERIES = {
  'pm25-serie': (codigo) => `${SIATA}/geodata/geographJson/1/pm25_30d/${codigo}`,
  'lluvia-mes': (codigo) => `${SIATA}/geodata/geographJson/2/pluvio_30d/${codigo}`,
  'lluvia-dia': (codigo) => `${SIATA}/geodata/geographJson/2/pluvio_24h/${codigo}`
};

// Segundos. Las lecturas del SIATA se refrescan cada 10 minutos; el clima de Open-Meteo, cada 15.
const TTL = { sismos: 1800, clima: 900 };
const TTL_DEFECTO = 600;
// La caché es local (fuera de git): el comentario evita que el build la meta en el paquete de la ruta.
const CACHE_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), '.cache', 'ambiente');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/128 medellin-modelo-digital';

const memoria = new Map();
const enCurso = new Map();

function destino(ruta) {
  const [recurso, codigo] = ruta;
  if (ruta.length === 1 && RECURSOS[recurso]) return { clave: recurso, url: RECURSOS[recurso] };
  if (ruta.length === 2 && SERIES[recurso] && /^\d{1,6}$/.test(codigo)) {
    return { clave: `${recurso}-${codigo}`, url: SERIES[recurso](codigo) };
  }
  return null;
}

async function desdeDisco(clave) {
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIR, `${clave}.json`), 'utf-8'));
  } catch {
    return null;
  }
}

async function guardar(clave, copia) {
  memoria.set(clave, copia);
  // En un despliegue con disco de solo lectura la escritura falla; entonces solo queda la copia en memoria.
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, `${clave}.json`), JSON.stringify(copia));
  } catch {
    /* sin disco: la caché vive lo que viva el proceso */
  }
}

async function leerArriba(clave, url) {
  if (enCurso.has(clave)) return enCurso.get(clave);
  const peticion = (async () => {
    const respuesta = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store'
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const copia = { leido: new Date().toISOString(), datos: await respuesta.json() };
    await guardar(clave, copia);
    return copia;
  })().finally(() => enCurso.delete(clave));
  enCurso.set(clave, peticion);
  return peticion;
}

const edad = (copia) => Math.max(0, Math.round((Date.now() - Date.parse(copia.leido)) / 1000));

function respuesta(recurso, copia, ttl, error) {
  const segundos = edad(copia);
  const restante = Math.max(0, ttl - segundos);
  return Response.json(
    { recurso, leido: copia.leido, edad_s: segundos, obsoleto: Boolean(error), ...(error ? { error } : {}), datos: copia.datos },
    { headers: { 'Cache-Control': error ? 'no-store' : `public, max-age=${restante}, s-maxage=${restante}` } }
  );
}

export async function GET(request, { params }) {
  const { ruta } = await params;
  const objetivo = destino(ruta ?? []);
  if (!objetivo) {
    return Response.json(
      { error: 'Recurso no válido', recursos: [...Object.keys(RECURSOS), ...Object.keys(SERIES).map((s) => `${s}/<código>`)] },
      { status: 404 }
    );
  }
  const { clave, url } = objetivo;
  const ttl = TTL[clave] ?? TTL_DEFECTO;
  const recurso = ruta.join('/');
  // ?forzar=1 (botón "Actualizar ahora") salta la ventana de caché y pide un dato nuevo; si el SIATA falla, igual
  // se responde con la última copia.
  const forzar = new URL(request.url).searchParams.get('forzar') === '1';

  const guardada = memoria.get(clave) ?? (await desdeDisco(clave));
  if (guardada) {
    memoria.set(clave, guardada);
    if (!forzar && edad(guardada) < ttl) return respuesta(recurso, guardada, ttl);
  }
  try {
    return respuesta(recurso, await leerArriba(clave, url), ttl);
  } catch (error) {
    // Sin dato nuevo: se sirve la última copia, marcada como obsoleta, y solo se falla si nunca hubo una.
    if (guardada) return respuesta(recurso, guardada, ttl, error.message);
    return Response.json(
      { recurso, error: `No se pudo leer ${recurso}: ${error.message}`, datos: null },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
