"""Ambiente y satélite: redes del SIATA, sismos del USGS y el mapa de ruido del estudio del AMVA.

Las lecturas del SIATA cambian cada pocos minutos, así que **no se congelan en el lago**: la app las pide en
vivo al proxy `/api/ambiente/<recurso>` (ver src/app/api/ambiente), que además guarda la última copia para
responder cuando el SIATA falla. Aquí se ingesta solo lo estable:

  - el tamaño de cada red de estaciones del SIATA (y cuántas están en Medellín);
  - la serie anual de sismos de magnitud 4 o más cerca de Medellín (USGS);
  - el mapa de ruido del AMVA, recortado a Medellín, en public/data/geo/capas/ruido_amva_{dia,noche}.geojson.

Los identificadores de recurso (`pm25`, `pluvios`, `niveles`, `meteo`, `ruido`, `alertas`) son los mismos que
acepta el proxy: si cambia uno, hay que cambiarlo en los dos lados.
"""

import collections
import datetime as dt
import json
import math
import urllib.parse

import shapely
from shapely.geometry import MultiPolygon, mapping, shape

from lago import RAIZ, Tema, hoy, json_url

SIATA = 'https://geoportal.siata.gov.co/fastgeoapi'
GEOPORTAL = 'https://geoportal.siata.gov.co'
# (recurso del proxy, ruta en el fastgeoapi del SIATA, id de fuente, nombre, etiqueta de la cifra)
REDES = [
    ('pm25', 'geodata/geodataJson/1/pm25_minio', 'siata-pm25', 'PM2.5 e índice ICA por estación (promedio de 24 h)',
     'Estaciones de calidad del aire (PM2.5)'),
    ('pluvios', 'geodata/geodataJson/3/pluvios_v2', 'siata-pluvios', 'Pluviómetros con acumulado de lluvia',
     'Pluviómetros'),
    ('niveles', 'geodata/geodataJson/2/niveles', 'siata-niveles', 'Nivel de quebradas y del río Medellín',
     'Estaciones de nivel de quebradas'),
    ('meteo', 'geodata/geodataJson/3/tempVient', 'siata-meteo', 'Temperatura, viento y humedad por estación',
     'Estaciones meteorológicas'),
    ('ruido', 'geodata/geodataJson/1/ruido_oficial', 'siata-ruido', 'Red oficial de ruido (promedio de 7 días)',
     'Estaciones de ruido'),
]
ALERTAS = 'alerts/active/citizen'

USGS = 'https://earthquake.usgs.gov/fdsnws/event/1/query'
CENTRO = (6.2476, -75.5686)  # centro de Medellín, referencia de la distancia a cada sismo
RADIO_KM = 300
MAGNITUD_MIN = 4
DESDE_SISMOS = 2000

RUIDO_AMVA = ('https://portalidem.metropol.gov.co/server/rest/services/Hosted/'
              'AMVA_GESTION_DEL_RUIDO/FeatureServer')
# Isófonas del ruido total (todas las fuentes juntas), de día y de noche. El servicio publica además una capa
# por fuente (automotor, metro, aeropuerto, industria); no se empaquetan para no cargar el navegador de más.
CAPAS_RUIDO = [('dia', 27, 'diurno (Ld)'), ('noche', 28, 'nocturno (Ln)')]
RUIDO_UMBRAL = 65  # dB(A): límite diurno para uso residencial en la Resolución 627 de 2006
BBOX_MEDELLIN = '-75.72,6.14,-75.46,6.40'
SIMPLIFICAR = 0.0006  # grados, ~66 m: las isófonas vienen a 4 m y sin generalizar pesan más de 12 MB
AREA_MINIMA_HA = 1.0

DIR_GEO = RAIZ / 'public' / 'data' / 'geo'
DIR_CAPAS = DIR_GEO / 'capas'


# ---------------------------------------------------------------- utilidades

def metros(geom):
    """Proyección equirectangular local (latitud de Medellín), igual que en pull_lentes."""
    k = math.cos(math.radians(CENTRO[0]))
    return shapely.transform(geom, lambda c: c * [111_320 * k, 110_574])


def hectareas(geom):
    return metros(geom).area / 1e4


def municipio(props):
    """El municipio de una estación: cada red del SIATA lo publica con un nombre de campo distinto."""
    for clave in ('Municipio', 'municipio', 'ubicacion', 'Ciudad'):
        valor = props.get(clave)
        if isinstance(valor, str) and valor.strip():
            return valor.strip()
    return ''


def es_medellin(props):
    return municipio(props).lower().startswith('medell')


# ---------------------------------------------------------------- redes del SIATA

def redes(t):
    conteos = []
    for recurso, ruta, fuente, nombre, etiqueta in REDES:
        with t.bloque(fuente):
            t.fuente(fuente, nombre, 'SIATA · Área Metropolitana del Valle de Aburrá', f'{SIATA}/{ruta}')
            datos = json_url(f'{SIATA}/{ruta}')
            estaciones = datos.get('features') or []
            if not estaciones:
                raise RuntimeError(f'{recurso}: el SIATA respondió sin estaciones')
            en_medellin = sum(1 for f in estaciones if es_medellin(f['properties']))
            t.cifra(f'estaciones_{recurso}', len(estaciones), 'estaciones', etiqueta, fuente, 'Red en operación',
                    nota=f'{en_medellin} en Medellín y el resto en el Valle de Aburrá. Las lecturas de cada '
                         'estación se piden en vivo, no se guardan en el lago.')
            conteos.append((etiqueta, len(estaciones), fuente))

    with t.bloque('siata-alertas'):
        t.fuente('siata-alertas', 'Alertas activas del geoportal ciudadano',
                 'SIATA · Área Metropolitana del Valle de Aburrá', f'{SIATA}/{ALERTAS}',
                 uso='Aviso de alertas activas en la sección Ambiente (lectura en vivo)')
        if not isinstance(json_url(f'{SIATA}/{ALERTAS}'), list):
            raise RuntimeError('el servicio de alertas no devolvió una lista')

    if conteos:
        # Una misma torre puede tener varios sensores: la suma cuenta estaciones por red, no torres distintas.
        detalle = ', '.join(f'{etiqueta.lower()} {n}' for etiqueta, n, _ in conteos)
        t.cifra('estaciones_siata', sum(n for _, n, _ in conteos), 'estaciones',
                'Estaciones de monitoreo del SIATA', conteos[0][2], 'Red en operación', estado='derivado',
                ancla=True, nota=f'Suma de las redes consultadas ({detalle}). Una misma torre puede tener '
                                 'sensores de varias redes y contarse más de una vez.')


# ---------------------------------------------------------------- sismos (USGS)

def sismos(t):
    with t.bloque('usgs-sismos'):
        params = {'format': 'geojson', 'starttime': f'{DESDE_SISMOS}-01-01', 'latitude': CENTRO[0],
                  'longitude': CENTRO[1], 'maxradiuskm': RADIO_KM, 'minmagnitude': MAGNITUD_MIN, 'orderby': 'time'}
        t.fuente('usgs-sismos', f'Sismos de magnitud {MAGNITUD_MIN} o más a menos de {RADIO_KM} km de Medellín',
                 'Servicio Geológico de Estados Unidos (USGS) · web service FDSN',
                 f'{USGS}?{urllib.parse.urlencode(params)}')
        eventos = json_url(USGS, params).get('features') or []
        if not eventos:
            raise RuntimeError('el USGS respondió sin eventos')
        registros = []
        for f in eventos:
            p = f['properties']
            if p.get('mag') is None or not p.get('time'):
                continue
            fecha = dt.datetime.fromtimestamp(p['time'] / 1000, dt.timezone.utc).date()
            registros.append({'fecha': fecha, 'magnitud': round(p['mag'], 1), 'lugar': p.get('place') or '',
                              'profundidad_km': round((f['geometry']['coordinates'][2] or 0), 1)})
        por_anio = collections.Counter(r['fecha'].year for r in registros)
        ultimo = max(r['fecha'] for r in registros)
        t.serie('sismos_anual', [[str(a), por_anio[a]] for a in sorted(por_anio)], 'sismos',
                f'Sismos de magnitud {MAGNITUD_MIN} o más a menos de {RADIO_KM} km', 'usgs-sismos',
                nota=f'{ultimo.year} parcial: hasta el {ultimo.isoformat()}, último evento publicado. '
                     f'Distancia medida al centro de Medellín.')

        anio_pasado = hoy() - dt.timedelta(days=365)
        recientes = [r for r in registros if r['fecha'] > anio_pasado]
        t.cifra('sismos_12m', len(recientes), 'sismos', f'Sismos de magnitud {MAGNITUD_MIN} o más (12 meses)',
                'usgs-sismos', f'{anio_pasado.isoformat()} – {ultimo.isoformat()}',
                nota=f'Con epicentro a menos de {RADIO_KM} km del centro de Medellín.')
        mayor = max(registros, key=lambda r: r['magnitud'])
        t.cifra('sismo_magnitud_maxima', mayor['magnitud'], 'magnitud',
                f'Sismo más fuerte desde {DESDE_SISMOS}', 'usgs-sismos',
                f'{DESDE_SISMOS}–{ultimo.year}', decimales=1,
                nota=f'{mayor["fecha"].isoformat()}, {mayor["lugar"]}, a {mayor["profundidad_km"]} km de profundidad.')


# ---------------------------------------------------------------- mapa de ruido del AMVA

def limite_medellin():
    """Polígono de Medellín para recortar las isófonas; sin él, el mapa cubriría todo el Valle de Aburrá."""
    ruta = DIR_GEO / 'comunas.geojson'
    if not ruta.exists():
        print('  ⚠ falta comunas.geojson (lo genera pull_gemelo): el ruido queda sin recortar a Medellín')
        return None
    features = json.loads(ruta.read_text(encoding='utf-8'))['features']
    return shapely.union_all([shape(f['geometry']) for f in features if f['properties'].get('NOMBRE')])


def isofonas(capa, limite):
    """Descarga una capa de isófonas y la reduce a un polígono por banda de dB(A), recortado a Medellín."""
    datos = json_url(f'{RUIDO_AMVA}/{capa}/query', {
        'where': '1=1', 'outFields': 'isovalue,rango_db', 'geometry': BBOX_MEDELLIN,
        'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects',
        'outSR': 4326, 'geometryPrecision': 5, 'maxAllowableOffset': 0.002, 'f': 'geojson'})
    if 'error' in datos:
        raise RuntimeError(f'ruido {capa}: {datos["error"]}')
    por_banda = collections.defaultdict(list)
    rangos = {}
    for f in datos.get('features') or []:
        if not f.get('geometry'):
            continue
        geom = shape(f['geometry'])
        iso = f['properties']['isovalue']
        por_banda[iso].append(geom if geom.is_valid else geom.buffer(0))
        rangos[iso] = f['properties'].get('rango_db') or str(iso)
    if not por_banda:
        raise RuntimeError(f'ruido {capa}: el servicio respondió sin isófonas')

    features, bandas = [], []
    for iso in sorted(por_banda):
        unido = shapely.union_all(por_banda[iso])
        if limite is not None:
            unido = unido.intersection(limite)
        unido = unido.simplify(SIMPLIFICAR).buffer(0)
        partes = [p for p in (unido.geoms if unido.geom_type == 'MultiPolygon' else [unido])
                  if not p.is_empty and hectareas(p) >= AREA_MINIMA_HA]
        if not partes:
            continue
        unido = MultiPolygon(partes) if len(partes) > 1 else partes[0]
        ha = round(hectareas(unido), 1)
        features.append({'type': 'Feature', 'properties': {'iso': iso, 'rango_db': rangos[iso], 'ha': ha},
                         'geometry': mapping(shapely.set_precision(unido, 1e-5))})
        bandas.append({'iso': iso, 'rango_db': rangos[iso], 'ha': ha})
    return features, bandas


def ruido_amva(t, limite):
    with t.bloque('amva-ruido'):
        t.fuente('amva-ruido', 'Mapa de ruido del Valle de Aburrá (isófonas de ruido total, día y noche)',
                 'Área Metropolitana del Valle de Aburrá · Portal IDEM', RUIDO_AMVA, estado='declarado')
        DIR_CAPAS.mkdir(parents=True, exist_ok=True)
        for clave, capa, periodo in CAPAS_RUIDO:
            features, bandas = isofonas(capa, limite)
            archivo = DIR_CAPAS / f'ruido_amva_{clave}.geojson'
            archivo.write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                                          ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
            print(f'  · capa ruido_amva_{clave}: {len(features)} bandas · {archivo.stat().st_size // 1024} KB')
            t.lista(f'ruido_amva_{clave}', bandas)
            sobre = round(sum(b['ha'] for b in bandas if b['iso'] >= RUIDO_UMBRAL), 1)
            t.cifra(f'ruido_area_{clave}', sobre, 'ha',
                    f'Área de Medellín con {RUIDO_UMBRAL} dB(A) o más, nivel {periodo}', 'amva-ruido',
                    'Estudio del AMVA', estado='derivado', decimales=0,
                    nota=f'Suma de las bandas de la isófona modelada desde {RUIDO_UMBRAL} dB(A). El estudio '
                         f'modela desde 35 dB(A): fuera de las isófonas no hay dato. {RUIDO_UMBRAL} dB(A) es el '
                         'límite diurno para uso residencial de la Resolución 627 de 2006. Isófonas '
                         f'generalizadas a ~{round(SIMPLIFICAR * 111_320)} m y recortadas al límite del Distrito.')


# ---------------------------------------------------------------- capas satelitales (solo catálogo)

def satelite(t):
    t.fuente('nasa-gibs-viirs', 'Luces nocturnas VIIRS (Day/Night Band, radiancia diaria)',
             'NASA · Global Imagery Browse Services (GIBS)',
             'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_At_Sensor_Radiance/'
             'default/default/GoogleMapsCompatible_Level8/0/0/0.png',
             uso='Capa satelital del mapa de Ambiente (teselas hasta el nivel 8, ~2 km por píxel)')
    t.fuente('eox-sentinel2', 'Mosaico Sentinel-2 sin nubes (s2cloudless 2023)', 'EOX IT Services · ESA Sentinel-2',
             'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/0/0/0.jpg',
             estado='declarado',
             uso='Capa satelital del mapa de Ambiente. Licencia CC BY-NC-SA: solo uso no comercial')


def main():
    t = Tema('ambiente', 'Ambiente y satélite')
    redes(t)
    sismos(t)
    ruido_amva(t, limite_medellin())
    satelite(t)
    t.escribir()
    return t


if __name__ == '__main__':
    main()
