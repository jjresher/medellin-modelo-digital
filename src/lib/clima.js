// Reloj y clima de la cabecera (issue #16). Módulo puro: lo usan src/components/RelojClima.jsx y las pruebas.

export const ZONA_MEDELLIN = 'America/Bogota';

// Códigos de tiempo presente de la OMM (tabla 4677, versión que publica Open-Meteo). Es la definición del código, no una
// lectura de la app: "lluvia fuerte" es la intensidad que el código declara.
const WMO = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna ligera',
  53: 'Llovizna moderada',
  55: 'Llovizna densa',
  56: 'Llovizna helada ligera',
  57: 'Llovizna helada densa',
  61: 'Lluvia ligera',
  63: 'Lluvia moderada',
  65: 'Lluvia fuerte',
  66: 'Lluvia helada ligera',
  67: 'Lluvia helada fuerte',
  71: 'Nevada ligera',
  73: 'Nevada moderada',
  75: 'Nevada fuerte',
  77: 'Granos de nieve',
  80: 'Chubascos ligeros',
  81: 'Chubascos moderados',
  82: 'Chubascos violentos',
  85: 'Chubascos de nieve ligeros',
  86: 'Chubascos de nieve fuertes',
  95: 'Tormenta',
  96: 'Tormenta con granizo ligero',
  99: 'Tormenta con granizo fuerte'
};

/** Texto del código de la OMM; un código que no está en la tabla se muestra como código. */
export const describirTiempo = (codigo) => WMO[codigo] ?? (codigo == null ? '' : `Código OMM ${codigo}`);

/** Un símbolo de texto para el código (sin imágenes): sol o luna, nube, lluvia, tormenta, niebla o nieve. */
export function simboloTiempo(codigo, esDeDia = true) {
  if (codigo == null) return '';
  if (codigo >= 95) return '⚡';
  if (codigo >= 71 && codigo <= 77) return '❄';
  if (codigo === 85 || codigo === 86) return '❄';
  if (codigo >= 51) return '☂';
  if (codigo === 45 || codigo === 48) return '≡';
  if (codigo === 3) return '☁';
  return esDeDia ? '☀' : '☾';
}

/** Hora de Medellín (HH:MM, 24 h) para un instante, sin importar la zona horaria de quien mira. */
export const horaMedellin = (fecha) =>
  new Intl.DateTimeFormat('es-CO', { timeZone: ZONA_MEDELLIN, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(fecha);

/** Fecha de Medellín para el título del reloj: "lunes, 6 de octubre de 2026". */
export const fechaMedellin = (fecha) =>
  new Intl.DateTimeFormat('es-CO', { timeZone: ZONA_MEDELLIN, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(fecha);

const decimal = (valor, decimales = 0) =>
  Number(valor).toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/**
 * La respuesta de Open-Meteo (`current`, en la zona de Medellín) como lo muestra la cabecera. Devuelve null si falta la
 * temperatura: sin ella no hay nada que mostrar.
 */
export function leerClima(datos) {
  const c = datos?.current;
  if (c?.temperature_2m == null) return null;
  return {
    temperatura: `${decimal(c.temperature_2m)} °C`,
    sensacion: c.apparent_temperature == null ? null : `${decimal(c.apparent_temperature)} °C`,
    humedad: c.relative_humidity_2m == null ? null : `${decimal(c.relative_humidity_2m)} %`,
    viento: c.wind_speed_10m == null ? null : `${decimal(c.wind_speed_10m, 1)} km/h`,
    lluvia: c.precipitation == null ? null : `${decimal(c.precipitation, 1)} mm`,
    tiempo: describirTiempo(c.weather_code),
    simbolo: simboloTiempo(c.weather_code, c.is_day !== 0),
    // "2026-10-06T14:30": hora local del modelo (la respuesta ya viene en la zona de Medellín), sin reinterpretarla.
    hora: typeof c.time === 'string' ? c.time.slice(11, 16) : '',
    intervalo: c.interval ? Math.round(c.interval / 60) : null,
    celda:
      datos.latitude == null || datos.longitude == null
        ? null
        : `${decimal(Math.abs(datos.latitude), 3)}° ${datos.latitude >= 0 ? 'N' : 'S'}, ${decimal(Math.abs(datos.longitude), 3)}° ${datos.longitude >= 0 ? 'E' : 'O'}${datos.elevation == null ? '' : `, ${decimal(datos.elevation)} m`}`
  };
}
