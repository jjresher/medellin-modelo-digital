"""Utilidades compartidas por los scripts de ingesta del lago.

Cada tema del lago es un JSON en public/data/lago/<tema>.json con este contrato:

    tema, titulo, probado (fecha ISO de la ingesta), ancla (claves de cifras para el Panorama),
    fuentes: [{id, nombre, entidad, url, estado}],
    cifras: {clave: {valor, unidad, etiqueta, fuente, vigencia, estado, nota?, decimales?}},
    series: {clave: {etiqueta, unidad, fuente, vigencia, estado, puntos: [[etiqueta, valor], ...], nota?}},
    listas: {clave: [{...}, ...]}

Estados: observado (dato abierto descargado), declarado (leído de PDF o prensa),
derivado (calculado) y candidato (existe pero no es abierto; no lleva valor).
"""

import csv
import datetime as dt
import http.client
import io
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DIR_LAGO = RAIZ / 'public' / 'data' / 'lago'
ESTADOS = ('observado', 'declarado', 'derivado', 'candidato')
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36 medellin-modelo-digital'
MESES = ('ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic')


def hoy():
    return dt.date.today()


def descargar(url, params=None, intentos=3, timeout=90, post=None):
    """GET (o POST si se pasa `post`) con User-Agent de navegador y reintentos.

    El servidor de la Alcaldía rechaza clientes sin User-Agent. POST sirve para consultas ArcGIS con
    geometrías largas que no caben en una URL.
    """
    if params:
        url += ('&' if '?' in url else '?') + urllib.parse.urlencode(params)
    cuerpo = urllib.parse.urlencode(post).encode() if post else None
    for intento in range(intentos):
        try:
            req = urllib.request.Request(url, data=cuerpo, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (400, 403, 404):
                raise
            error = e
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException) as e:
            error = e
        time.sleep(2 * (intento + 1))
    raise RuntimeError(f'No se pudo descargar {url}: {error}')


def existe(url):
    """¿La URL responde? Se prueba con HEAD y, si el servidor no admite ese método (el SIATA responde 405),
    con un GET que pide solo el primer byte."""
    for metodo, cabeceras in (('HEAD', {}), ('GET', {'Range': 'bytes=0-0'})):
        try:
            req = urllib.request.Request(url, method=metodo, headers={'User-Agent': UA, **cabeceras})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.status < 400
        except urllib.error.HTTPError as e:
            if e.code not in (400, 403, 405, 501):
                return False
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.HTTPException):
            return False
    return False


def json_url(url, params=None, post=None):
    return json.loads(descargar(url, params, post=post))


def socrata(recurso, **soql):
    """Consulta SoQL en datos.gov.co. Ej: socrata('m8fd-ahd9', select='...', where='...', group='...')."""
    params = {f'${k}': v for k, v in soql.items()}
    return json_url(f'https://www.datos.gov.co/resource/{recurso}.json', params)


def arcgis(capa, where='1=1', campos='*', geometria=False):
    """Consulta una capa ArcGIS REST y pagina con resultOffset cuando el servidor lo permite."""
    base = {'where': where, 'outFields': campos, 'returnGeometry': str(geometria).lower(), 'f': 'json'}
    datos = json_url(f'{capa}/query', base)
    if 'error' in datos:
        raise RuntimeError(f'{capa}: {datos["error"]}')
    filas = [f['attributes'] for f in datos.get('features', [])]
    offset = len(filas)
    while datos.get('exceededTransferLimit'):
        datos = json_url(f'{capa}/query', {**base, 'resultOffset': offset})
        lote = [f['attributes'] for f in datos.get('features', [])]
        if not lote:
            break
        filas += lote
        offset += len(lote)
    return filas


def arcgis_geojson(capa, campos='*', where='1=1', offset=None):
    """Descarga una capa completa en GeoJSON, paginando: los servicios cortan cada respuesta en su maxRecordCount."""
    params = {'where': where, 'outFields': campos, 'outSR': 4326, 'geometryPrecision': 6, 'f': 'geojson'}
    if offset:
        params['maxAllowableOffset'] = offset
    features = []
    while True:
        datos = json_url(f'{capa}/query', {**params, 'resultOffset': len(features)})
        if 'error' in datos:
            raise RuntimeError(f'{capa}: {datos["error"]}')
        features += datos.get('features', [])
        # En GeoJSON, ArcGIS avisa del corte en la raíz o dentro de "properties", según la versión.
        cortado = datos.get('exceededTransferLimit') or (datos.get('properties') or {}).get('exceededTransferLimit')
        if not cortado or not datos.get('features'):
            return {'type': 'FeatureCollection', 'features': features}



def leer_csv(url, timeout=300):
    """Descarga un CSV grande y lo decodifica probando utf-8 y luego latin-1 (varios archivos de MEData
    vienen en latin-1, con tildes mal codificadas en utf-8)."""
    crudo = descargar(url, timeout=timeout)
    for codificacion in ('utf-8', 'latin-1'):
        try:
            return list(csv.DictReader(io.StringIO(crudo.decode(codificacion))))
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f'No se pudo decodificar {url} ni en utf-8 ni en latin-1')


def numero(texto):
    """Convierte a float admitiendo coma decimal; None si no es un número (p. ej. "NaN" o "Sin dato")."""
    try:
        return float(str(texto).replace(',', '.'))
    except (TypeError, ValueError):
        return None


def excel(contenido):
    import openpyxl  # dependencia de ingesta/requirements.txt
    return openpyxl.load_workbook(io.BytesIO(contenido), read_only=True, data_only=True)


class Tema:
    """Acumula fuentes, cifras, series y listas de un tema y lo escribe con el contrato del lago.

    Cada fuente se ingesta dentro de `with tema.bloque(id):`. Si la fuente falla, el bloque
    conserva lo que esa fuente aportó en la ingesta anterior (con su fecha `probado` original)
    en lugar de borrar el dato o detener todo el tema.
    """

    def __init__(self, tema, titulo):
        self.tema, self.titulo = tema, titulo
        self.fuentes, self.cifras, self.series, self.listas, self.ancla = {}, {}, {}, {}, []
        self.fallos = []
        ruta = DIR_LAGO / f'{tema}.json'
        self.previo = json.loads(ruta.read_text(encoding='utf-8')) if ruta.exists() else None

    def fuente(self, id, nombre, entidad, url, estado='observado', **extra):
        """Declara una fuente. `uso` describe para qué se usa cuando la fuente no aporta cifras (por ejemplo,
        una capa satelital del mapa): sin él, la verificación avisa de una fuente declarada y no usada."""
        self.fuentes[id] = {'id': id, 'nombre': nombre, 'entidad': entidad, 'url': url, 'estado': estado,
                            'probado': hoy().isoformat(), **extra}
        return id

    def bloque(self, fuente_id):
        return _Bloque(self, fuente_id)

    def _heredar(self, fuente_id):
        previo = self.previo or {}
        fuente = next((f for f in previo.get('fuentes', []) if f['id'] == fuente_id), None)
        if not fuente:
            return False
        self.fuentes[fuente_id] = fuente
        for clave, cifra in previo.get('cifras', {}).items():
            if cifra['fuente'] == fuente_id:
                self.cifras[clave] = cifra
                if clave in previo.get('ancla', []) and clave not in self.ancla:
                    self.ancla.append(clave)
        for clave, serie in previo.get('series', {}).items():
            if serie['fuente'] == fuente_id:
                self.series[clave] = serie
        return True

    def cifra(self, clave, valor, unidad, etiqueta, fuente, vigencia, estado='observado', ancla=False, **extra):
        self.cifras[clave] = {'valor': valor, 'unidad': unidad, 'etiqueta': etiqueta, 'fuente': fuente,
                              'vigencia': vigencia, 'estado': estado, **extra}
        if ancla:
            self.ancla.append(clave)

    def serie(self, clave, puntos, unidad, etiqueta, fuente, estado='observado', **extra):
        self.series[clave] = {'etiqueta': etiqueta, 'unidad': unidad, 'fuente': fuente, 'estado': estado,
                              'vigencia': f'{puntos[0][0]} – {puntos[-1][0]}', 'puntos': puntos, **extra}

    def lista(self, clave, filas):
        self.listas[clave] = filas

    def escribir(self):
        DIR_LAGO.mkdir(parents=True, exist_ok=True)
        # El orden de `ancla` sigue el orden en que el script declara las cifras, también si alguna se heredó.
        self.ancla.sort(key=list(self.cifras).index)
        salida = {'tema': self.tema, 'titulo': self.titulo, 'probado': hoy().isoformat(), 'ancla': self.ancla,
                  'fuentes': list(self.fuentes.values()), 'cifras': self.cifras, 'series': self.series,
                  'listas': self.listas}
        ruta = DIR_LAGO / f'{self.tema}.json'
        ruta.write_text(json.dumps(salida, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'  ✓ {ruta.relative_to(RAIZ)} · {len(self.cifras)} cifras · {len(self.series)} series')
        return salida


class _Bloque:
    def __init__(self, tema, fuente_id):
        self.tema, self.fuente_id = tema, fuente_id

    def __enter__(self):
        return self

    def __exit__(self, tipo, error, _traza):
        if error is None:
            return False
        # Se descarta lo que la fuente alcanzó a escribir a medias antes de heredar su versión anterior.
        t = self.tema
        t.cifras = {k: v for k, v in t.cifras.items() if v['fuente'] != self.fuente_id}
        t.series = {k: v for k, v in t.series.items() if v['fuente'] != self.fuente_id}
        t.ancla = [k for k in t.ancla if k in t.cifras]
        t.fuentes.pop(self.fuente_id, None)
        heredado = t._heredar(self.fuente_id)
        t.fallos.append(self.fuente_id)
        print(f'  ⚠ {self.fuente_id}: {str(error)[:160]} → '
              f'{"se conserva la ingesta anterior" if heredado else "sin versión anterior; se omite"}')
        return True
