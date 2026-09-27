"""Gemelo 3D: límites territoriales, construcciones del catastro con altura real y capas base del mapa.

Genera:
  public/data/geo/comunas.geojson, barrios.geojson, veredas.geojson  (límites simplificados)
  public/data/edificios.pmtiles                                        (construcciones en teselas vectoriales)
  public/data/lago/gemelo.json                                         (cifras y fuentes del tema)

Las construcciones (más de un millón de polígonos) se descargan del catastro del Distrito publicado en el
portal IDEM del Área Metropolitana y se convierten a PMTiles con tippecanoe (ingesta/instalar_tippecanoe.sh).
"""

import collections
import concurrent.futures as cf
import json
import subprocess
import sys

from lago import RAIZ, Tema, descargar, json_url

IDEM = 'https://portalidem.metropol.gov.co/server/rest/services/DISTRITO_MEDELLIN_CATASTRO/MapServer'
CAPA_URBANA, CAPA_RURAL = 8, 7
LOTE = 2000  # maxRecordCount del servicio
ALTURA_PISO = 2.3  # ALTURAPISO del catastro: el mismo valor en todos los registros
CAMPOS = 'OBJECTID,NUMERO_PISOS,NUMERO_SOTANOS,ALTURA,ANIOCONSTRUCCION,AREA_CONSTRUIDA,TIPO_CONSTRUCCION,CBML'

DIR_GEO = RAIZ / 'public' / 'data' / 'geo'
DIR_CRUDOS = RAIZ / 'datos' / 'crudos'
PMTILES = RAIZ / 'public' / 'data' / 'edificios.pmtiles'
TIPPECANOE = RAIZ / '.herramientas' / 'bin' / 'tippecanoe'

CAPAS_BASE = [
    # (id, nombre, entidad, url de la fuente, url de una tesela de prueba sobre Medellín, uso)
    ('ortofoto-2024', 'Ortofoto 2024 del Distrito', 'Alcaldía de Medellín',
     'https://www.medellin.gov.co/servidormapas/rest/services/ServiciosCiudad/IMAGEN_WEBM_2024/MapServer',
     'https://www.medellin.gov.co/servidormapas/rest/services/ServiciosCiudad/IMAGEN_WEBM_2024/MapServer/tile/15/15817/9505',
     'Mapa base de ortofoto 2024 (teselas hasta el nivel 23).'),
    ('esri-imagery', 'World Imagery', 'Esri, Maxar, Earthstar Geographics',
     'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
     'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/15817/9505',
     'Mapa base satelital fuera de la cobertura de la ortofoto.'),
    ('terreno-aws', 'Terrain Tiles (Terrarium)', 'Mapzen · AWS Open Data',
     'https://registry.opendata.aws/terrain-tiles/',
     'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/1187/1987.png',
     'Relieve 3D del valle (modelo de elevación global, ~30 m en Colombia).'),
    ('openfreemap', 'Cartografía base (OpenFreeMap · OpenMapTiles · OpenStreetMap)', 'OpenFreeMap',
     'https://openfreemap.org/', 'https://tiles.openfreemap.org/styles/dark',
     'Calles, lugares y etiquetas del mapa base oscuro.'),
]


def limites(t):
    t.fuente('idem-limites', 'Comunas, corregimientos, barrios y veredas de Medellín',
             'Área Metropolitana del Valle de Aburrá · Portal IDEM (catastro del Distrito)', IDEM)
    DIR_GEO.mkdir(parents=True, exist_ok=True)
    # maxAllowableOffset en grados (~2 m) simplifica sin cambiar la forma a la escala de la ciudad.
    params = {'where': '1=1', 'outFields': '*', 'outSR': 4326, 'geometryPrecision': 6,
              'maxAllowableOffset': 0.00002, 'f': 'geojson'}
    capas = {'comunas': 0, 'barrios': 1, 'veredas': 2}
    conteos = {}
    for nombre, capa in capas.items():
        datos = json_url(f'{IDEM}/{capa}/query', params)
        for f in datos['features']:
            p = f['properties']
            f['properties'] = {k: v for k, v in p.items() if not k.startswith(('SHAPE', 'SE_ANNO', 'OBJECTID'))}
        datos['features'] = [f for f in datos['features'] if f['geometry']]
        (DIR_GEO / f'{nombre}.geojson').write_text(json.dumps(datos, ensure_ascii=False, separators=(',', ':')),
                                                  encoding='utf-8')
        conteos[nombre] = datos['features']
    comunas = [f for f in conteos['comunas'] if f['properties'].get('NOMBRE')]
    urbanas = [f for f in comunas if f['properties'].get('SUBTIPO_COMUNACORREGIMIENTO') == 1]
    t.cifra('comunas', len(urbanas), 'comunas', 'Comunas urbanas', 'idem-limites', 'Límite vigente')
    t.cifra('corregimientos', len(comunas) - len(urbanas), 'corregimientos', 'Corregimientos', 'idem-limites',
            'Límite vigente')
    t.cifra('barrios', len(conteos['barrios']), 'barrios', 'Barrios', 'idem-limites', 'Límite vigente',
            nota='Incluye los barrios de las cabeceras de corregimiento.')
    t.cifra('veredas', len(conteos['veredas']), 'veredas', 'Veredas', 'idem-limites', 'Límite vigente')
    print(f'  · límites: {len(urbanas)} comunas, {len(comunas) - len(urbanas)} corregimientos, '
          f'{len(conteos["barrios"])} barrios, {len(conteos["veredas"])} veredas')


def rango_ids(capa):
    stats = json_url(f'{IDEM}/{capa}/query', {
        'where': '1=1', 'f': 'json', 'outStatistics': json.dumps([
            {'statisticType': 'min', 'onStatisticField': 'OBJECTID', 'outStatisticFieldName': 'mn'},
            {'statisticType': 'max', 'onStatisticField': 'OBJECTID', 'outStatisticFieldName': 'mx'}])})
    a = {k.lower(): v for k, v in stats['features'][0]['attributes'].items()}
    return int(a['mn']), int(a['mx'])


def lote(capa, desde):
    datos = json.loads(descargar(f'{IDEM}/{capa}/query', {
        'where': f'OBJECTID>={desde} AND OBJECTID<{desde + LOTE}', 'outFields': CAMPOS, 'outSR': 4326,
        'geometryPrecision': 6, 'f': 'geojson'}, intentos=5, timeout=180))
    if 'error' in datos:
        raise RuntimeError(f'capa {capa}, lote {desde}: {datos["error"]}')
    return datos['features']


def propiedades(p, rural):
    """Propiedades compactas para las teselas (claves de una letra para reducir el peso del PMTiles)."""
    pisos = int(p.get('NUMERO_PISOS') or 0)
    altura = p.get('ALTURA')
    estimada = not altura
    if estimada:
        altura = max(pisos, 1) * ALTURA_PISO
    salida = {'p': pisos, 'h': round(float(altura), 1), 's': int(p.get('NUMERO_SOTANOS') or 0),
              'a': round(float(p.get('AREA_CONSTRUIDA') or 0), 1), 't': p.get('TIPO_CONSTRUCCION') or '',
              'c': p.get('CBML') or '', 'r': int(rural)}
    if estimada:
        salida['e'] = 1
    if p.get('ANIOCONSTRUCCION'):
        salida['y'] = int(p['ANIOCONSTRUCCION'])
    return salida


def construcciones(t):
    t.fuente('catastro-construcciones', 'Construcciones urbanas y rurales del catastro distrital',
             'Área Metropolitana del Valle de Aburrá · Portal IDEM (catastro del Distrito)', f'{IDEM}/{CAPA_URBANA}')
    DIR_CRUDOS.mkdir(parents=True, exist_ok=True)
    salida = DIR_CRUDOS / 'construcciones.ndjson'
    pisos = collections.Counter()
    altos, n_estimadas, conteo = [], 0, {0: 0, 1: 0}

    with salida.open('w', encoding='utf-8') as archivo, cf.ThreadPoolExecutor(6) as pool:
        for capa, rural in ((CAPA_URBANA, 0), (CAPA_RURAL, 1)):
            minimo, maximo = rango_ids(capa)
            desdes = range(minimo, maximo + 1, LOTE)
            for i, features in enumerate(pool.map(lambda d: lote(capa, d), desdes)):
                for f in features:
                    if not f.get('geometry'):
                        continue
                    f['properties'] = propiedades(f['properties'], rural)
                    p = f['properties']
                    pisos[p['p']] += 1
                    n_estimadas += p.get('e', 0)
                    conteo[rural] += 1
                    if p['p'] >= 25:
                        altos.append(p)
                    archivo.write(json.dumps(f, separators=(',', ':')) + '\n')
                if i % 50 == 0:
                    print(f'    capa {capa}: lote {i + 1}/{len(desdes)} · {sum(conteo.values()):,} construcciones',
                          flush=True)

    total = sum(conteo.values())
    fuente = 'catastro-construcciones'
    t.cifra('construcciones', total, 'construcciones', 'Construcciones en el catastro', fuente,
            'Base catastral vigente', ancla=True,
            nota='Polígonos de construcción del catastro distrital, urbanos y rurales. Un predio puede tener '
                 'varias construcciones (torres, bloques, mejoras). El campo ALTURA del catastro equivale a '
                 f'≈ pisos × {ALTURA_PISO} m: se deriva del número de pisos, no es una medición del edificio.')
    t.cifra('construcciones_urbanas', conteo[0], 'construcciones', 'Construcciones urbanas', fuente,
            'Base catastral vigente')
    t.cifra('construcciones_rurales', conteo[1], 'construcciones', 'Construcciones rurales', fuente,
            'Base catastral vigente')
    t.cifra('pisos_promedio', round(sum(k * v for k, v in pisos.items()) / total, 2), 'pisos',
            'Pisos promedio por construcción', fuente, 'Base catastral vigente', estado='derivado', decimales=2)
    t.cifra('pisos_maximo', max(pisos), 'pisos', 'Construcción con más pisos', fuente, 'Base catastral vigente')
    t.cifra('construcciones_10_pisos', sum(v for k, v in pisos.items() if k >= 10), 'construcciones',
            'Construcciones de 10 pisos o más', fuente, 'Base catastral vigente', estado='derivado')
    t.cifra('alturas_estimadas', n_estimadas, 'construcciones', 'Construcciones sin altura en el catastro', fuente,
            'Base catastral vigente',
            nota=f'Para estas construcciones el mapa estima la altura como pisos × {ALTURA_PISO} m '
                 f'(ALTURAPISO del catastro) y lo indica al consultarlas.')
    grupos = [('0', 0, 0), ('1', 1, 1), ('2', 2, 2), ('3', 3, 3), ('4–5', 4, 5), ('6–9', 6, 9),
              ('10–19', 10, 19), ('20–29', 20, 29), ('30 o más', 30, 999)]
    t.lista('construcciones_por_pisos', [
        {'nombre': etiqueta, 'valor': sum(v for k, v in pisos.items() if lo <= k <= hi)} for etiqueta, lo, hi in grupos])
    t.lista('construcciones_mas_altas', [
        {'cbml': p['c'], 'pisos': p['p'], 'altura_m': p['h'], 'tipo': p['t']}
        for p in sorted(altos, key=lambda p: (-p['p'], -p['h']))[:15]])
    print(f'  · {total:,} construcciones ({conteo[0]:,} urbanas, {conteo[1]:,} rurales) → {salida.name}')
    return salida


def teselas(ndjson):
    if not TIPPECANOE.exists():
        raise RuntimeError('Falta tippecanoe: corre ingesta/instalar_tippecanoe.sh')
    temporal = PMTILES.with_suffix('.tmp.pmtiles')
    orden = [
        str(TIPPECANOE), '-o', str(temporal), '--force', '-l', 'edificios',
        '-Z12', '-z15',
        # En los niveles 12 y 13 solo entran construcciones de 4 pisos o más: la silueta de la ciudad.
        '-j', json.dumps({'edificios': ['any', ['>=', '$zoom', 14], ['>=', 'p', 4]]}),
        '--drop-densest-as-needed', '--extend-zooms-if-still-dropping',
        '--no-tile-stats', '--quiet', str(ndjson)]
    subprocess.run(orden, check=True)
    temporal.replace(PMTILES)
    print(f'  · {PMTILES.relative_to(RAIZ)} · {PMTILES.stat().st_size / 1e6:.0f} MB')


def capa_base(t, fuente_id, nombre, entidad, url, prueba, uso):
    t.fuente(fuente_id, nombre, entidad, url)
    t.fuentes[fuente_id]['uso'] = uso
    descargar(prueba, intentos=2, timeout=40)  # si la tesela de prueba no responde, el bloque lo registra


def main(solo_limites=False):
    t = Tema('gemelo', 'Gemelo 3D')
    with t.bloque('idem-limites'):
        limites(t)
    if not solo_limites:
        with t.bloque('catastro-construcciones'):
            teselas(construcciones(t))
    for capa in CAPAS_BASE:
        with t.bloque(capa[0]):
            capa_base(t, *capa)
    t.escribir()
    return t


if __name__ == '__main__':
    main(solo_limites='--solo-limites' in sys.argv)
