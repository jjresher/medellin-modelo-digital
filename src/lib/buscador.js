// Buscador general (⌘K / Ctrl+K, issue #16): secciones, cifras del lago y lugares del mapa. Este módulo arma el índice de
// secciones y cifras y las busca; los lugares los busca src/lib/lugares.js. Lo usan el buscador y las pruebas
// (tests/buscador.test.mjs).
import { navigation } from '../data/navegacion.js';
import { limites, normalizar } from './lugares.js';

// Sección donde se muestra cada tema del lago. `movilidad` no tiene sección propia: su cifra ancla está en el Panorama.
export const SECCION_DE_TEMA = {
  demografia: 'people',
  economia: 'economy',
  seguridad: 'safety',
  turismo: 'tourism',
  municipio: 'municipality',
  servicios: 'services',
  movilidad: 'panorama',
  gemelo: 'twin',
  lentes: 'twin',
  territorio: 'culture',
  ambiente: 'environment',
  escucha: 'social'
};

// Palabras con que alguien buscaría cada sección sin saber su nombre. Describen el contenido, no lo valoran.
const PALABRAS = {
  panorama: 'portada inicio diagnóstico prioridad comparar zonas',
  twin: 'mapa 3d edificios construcciones lentes energía densificación presión vial ortofoto',
  people: 'población demografía hogares edad pirámide calidad de vida pobreza',
  economy: 'empleo desempleo vivienda precio arriendo licencias empresas',
  tourism: 'visitantes extranjeros aeropuerto hoteles hospedajes museos',
  municipality: 'alcaldía presupuesto ingresos gasto contratos impuestos predial',
  services: 'agua acueducto energía gas internet reciclaje residuos',
  safety: 'homicidios hurtos delitos violencia',
  culture: 'pot riesgo amenaza patrimonio espacio público equipamientos',
  correlations: 'relación pares dispersión',
  atlas: 'comunas corregimientos barrios ficha territorio',
  environment: 'aire calidad pm2.5 lluvia ruido sismos quebradas siata',
  social: 'wikipedia prensa menciones noticias',
  sources: 'método catálogo datasets estado vigencia'
};

const ORDEN_SECCION = Object.fromEntries(navigation.map(([id], i) => [id, i]));

/** Índice de secciones y cifras. `lago` es el que devuelve useLago (o uno con la misma forma). */
export function indiceGeneral(lago) {
  const secciones = navigation.map(([id, icono, nombre]) => ({
    tipo: 'seccion',
    id,
    icono,
    nombre,
    clave: normalizar(nombre),
    texto: normalizar(`${nombre} ${PALABRAS[id] ?? ''}`)
  }));
  const cifras = (lago?.orden ?? []).flatMap((tema) => {
    const datos = lago.temas[tema];
    const seccion = SECCION_DE_TEMA[tema] ?? 'panorama';
    const nombreSeccion = navigation.find(([id]) => id === seccion)?.[2] ?? '';
    return Object.entries(datos.cifras ?? {}).map(([clave, cifra]) => ({
      ...cifra,
      tipo: 'cifra',
      clave,
      tema,
      seccion,
      nombreSeccion,
      llave: normalizar(cifra.etiqueta),
      texto: normalizar(`${cifra.etiqueta} ${datos.titulo} ${nombreSeccion}`)
    }));
  });
  return { secciones, cifras };
}

// 0: el nombre empieza por la búsqueda; 1: una palabra del nombre empieza por ella; 2: coincide en otra parte.
function nivel(clave, q, primera) {
  if (clave.startsWith(q)) return 0;
  return ` ${clave}`.includes(` ${primera}`) ? 1 : 2;
}

/**
 * Secciones y cifras que contienen todas las palabras de la búsqueda (sin tildes ni mayúsculas), las secciones en su
 * nombre o sus palabras clave y las cifras en su etiqueta, su tema o su sección. Sin búsqueda, todas las secciones.
 */
export function buscarGeneral(indice, texto, { secciones: maxSecciones = 5, cifras: maxCifras = 8 } = {}) {
  const q = normalizar(texto);
  if (!indice) return { secciones: [], cifras: [] };
  if (!q) return { secciones: indice.secciones, cifras: [] };
  const palabras = q.split(' ');
  const coincide = (item) => palabras.every((p) => item.texto.includes(p));
  const secciones = indice.secciones
    .filter(coincide)
    .sort((a, b) => nivel(a.clave, q, palabras[0]) - nivel(b.clave, q, palabras[0]) || ORDEN_SECCION[a.id] - ORDEN_SECCION[b.id])
    .slice(0, maxSecciones);
  // Las cifras piden al menos dos letras: con una sola coincidirían casi todas.
  const cifras =
    q.length < 2
      ? []
      : indice.cifras
          .filter(coincide)
          .sort(
            (a, b) =>
              nivel(a.llave, q, palabras[0]) - nivel(b.llave, q, palabras[0]) || a.llave.length - b.llave.length || a.llave.localeCompare(b.llave)
          )
          .slice(0, maxCifras);
  return { secciones, cifras };
}

/**
 * Consulta del gemelo 3D para un lugar (formato de "Compartir vista": #twin?v=lon,lat,zoom,rumbo,inclinación). Un punto
 * se marca (`p`, con su nombre en `lugar`); un barrio o una vereda encienden su capa de límites; un territorio se encuadra.
 */
export function consultaGemelo(lugar) {
  const params = new URLSearchParams();
  if (lugar.geometry.type === 'Point') {
    const [lon, lat] = lugar.geometry.coordinates;
    params.set('v', `${lon.toFixed(5)},${lat.toFixed(5)},16.2,-18,58`);
    params.set('p', `${lon.toFixed(6)},${lat.toFixed(6)}`);
    params.set('lugar', lugar.nombre);
  } else {
    const [[o, s], [e, n]] = limites(lugar.geometry);
    const lado = Math.max(e - o, n - s);
    const zoom = Math.min(16, Math.max(11.5, Math.log2(360 / lado)));
    params.set('v', `${((o + e) / 2).toFixed(5)},${((s + n) / 2).toFixed(5)},${zoom.toFixed(2)},-18,55`);
    if (lugar.tipo === 'Barrio') params.set('terr', 'buildings,comunas,barrios,labels');
    if (lugar.tipo === 'Vereda') params.set('terr', 'buildings,comunas,veredas,labels');
  }
  return params.toString();
}
