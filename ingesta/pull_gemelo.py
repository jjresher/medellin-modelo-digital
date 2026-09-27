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
import csv
import json
import subprocess
import sys

import numpy as np
import shapely

from lago import RAIZ, Tema, arcgis_geojson, descargar, json_url

IDEM = 'https://portalidem.metropol.gov.co/server/rest/services/DISTRITO_MEDELLIN_CATASTRO/MapServer'
CAPA_URBANA, CAPA_RURAL = 8, 7
LOTE = 2000  # maxRecordCount del servicio
ALTURA_PISO = 2.3  # ALTURAPISO del catastro: el mismo valor en todos los registros
CAMPOS = 'OBJECTID,NUMERO_PISOS,NUMERO_SOTANOS,ALTURA,ANIOCONSTRUCCION,AREA_CONSTRUIDA,TIPO_CONSTRUCCION,CBML'

DIR_GEO = RAIZ / 'public' / 'data' / 'geo'
DIR_CRUDOS = RAIZ / 'datos' / 'crudos'
PMTILES = RAIZ / 'public' / 'data' / 'edificios.pmtiles'
PUNTOS = DIR_CRUDOS / 'construcciones_puntos.csv'  # centroide + atributos clave, para lentes y análisis
POT = 'https://portalidem.metropol.gov.co/server/rest/services/DISTRITO_MEDELLIN_POT/MapServer'
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
    capas = {'comunas': 0, 'barrios': 1, 'veredas': 2}
    conteos = {}
    for nombre, capa in capas.items():
        datos = arcgis_geojson(f'{IDEM}/{capa}', offset=0.00002)
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


def centroide(geometria):
    """Promedio de los vértices del anillo exterior: basta para ubicar construcciones de pocos metros."""
    anillo = geometria['coordinates'][0] if geometria['type'] == 'Polygon' else geometria['coordinates'][0][0]
    return sum(c[0] for c in anillo) / len(anillo), sum(c[1] for c in anillo) / len(anillo)


def construcciones(t):
    t.fuente('catastro-construcciones', 'Construcciones urbanas y rurales del catastro distrital',
             'Área Metropolitana del Valle de Aburrá · Portal IDEM (catastro del Distrito)', f'{IDEM}/{CAPA_URBANA}')
    DIR_CRUDOS.mkdir(parents=True, exist_ok=True)
    salida = DIR_CRUDOS / 'construcciones.ndjson'
    pisos = collections.Counter()
    altos, n_estimadas, conteo = [], 0, {0: 0, 1: 0}
    xs, ys = [], []

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
                    x, y = centroide(f['geometry'])
                    xs.append(x)
                    ys.append(y)
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
    enriquecer(t, salida, np.array(xs), np.array(ys))
    return salida


def poligonos(geojson, campo):
    """Geometrías shapely y el valor de `campo` de cada polígono de un GeoJSON."""
    feats = [f for f in geojson['features'] if f.get('geometry')]
    return [shapely.geometry.shape(f['geometry']) for f in feats], [f['properties'].get(campo) for f in feats]


def ubicar(xs, ys, geoms, valores):
    """Para cada punto, el valor del polígono que lo contiene (o None)."""
    puntos = shapely.points(xs, ys)
    arbol = shapely.STRtree(geoms)
    idx_punto, idx_poligono = arbol.query(puntos, predicate='within')
    salida = [None] * len(xs)
    for i, j in zip(idx_punto, idx_poligono):
        salida[i] = valores[j]
    return salida


def enriquecer(t, ndjson, xs, ys):
    """Agrega a cada construcción su comuna (k) y la altura normativa del POT en pisos (n), si es numérica."""
    t.fuente('pot-tratamientos', 'POT (Acuerdo 48 de 2014) · tratamientos urbanos con altura normativa',
             'Área Metropolitana del Valle de Aburrá · Portal IDEM', f'{POT}/5')
    comunas = json.loads((DIR_GEO / 'comunas.geojson').read_text(encoding='utf-8'))
    geoms_c, codigos = poligonos(comunas, 'CODIGO')
    tratamientos = arcgis_geojson(f'{POT}/5', 'ALTURANORMATIVA')
    con_altura = [f for f in tratamientos['features'] if str(f['properties'].get('ALTURANORMATIVA')).isdigit()]
    geoms_t, alturas = poligonos({'features': con_altura}, 'ALTURANORMATIVA')
    comuna = ubicar(xs, ys, geoms_c, codigos)
    norma = ubicar(xs, ys, geoms_t, [int(a) for a in alturas])

    temporal = ndjson.with_suffix('.tmp')
    sobre = con_norma = 0
    with ndjson.open(encoding='utf-8') as entrada, temporal.open('w', encoding='utf-8') as salida, \
            PUNTOS.open('w', newline='', encoding='utf-8') as puntos:
        escritor = csv.writer(puntos)
        escritor.writerow(['x', 'y', 'p', 'a', 'k', 'n'])
        for i, linea in enumerate(entrada):
            f = json.loads(linea)
            p = f['properties']
            if comuna[i]:
                p['k'] = comuna[i]
            if norma[i] is not None:
                p['n'] = norma[i]
                con_norma += 1
                sobre += p['p'] > norma[i]
            salida.write(json.dumps(f, separators=(',', ':')) + '\n')
            escritor.writerow([f'{xs[i]:.6f}', f'{ys[i]:.6f}', p['p'], p['a'], comuna[i] or '', norma[i] if norma[i] is not None else ''])
    temporal.replace(ndjson)

    fuente = 'pot-tratamientos'
    t.cifra('construcciones_con_altura_normativa', con_norma, 'construcciones',
            'Construcciones en zonas con altura normativa en pisos', fuente, 'POT vigente (Acuerdo 48 de 2014)',
            estado='derivado',
            nota=f'Construcciones cuyo centroide cae en un tratamiento del POT con ALTURANORMATIVA numérica '
                 f'({len(con_altura)} de {len(tratamientos["features"])} polígonos). En el resto la norma es '
                 '"N/A" o "Variable".')
    t.cifra('construcciones_sobre_altura_normativa', sobre, 'construcciones',
            'Construcciones con más pisos que la altura normativa', fuente, 'POT vigente (Acuerdo 48 de 2014)',
            estado='derivado',
            nota='Pisos del catastro mayores que la altura normativa del tratamiento donde está su centroide. '
                 'Es un cruce geométrico: no considera licencias, reconocimientos ni normas anteriores al POT.')
    print(f'  · cruce espacial: {sum(1 for c in comuna if c):,} con comuna, {con_norma:,} con altura normativa')


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
    if solo_limites:
        # Lo que no se vuelve a ingestar se conserva de la corrida anterior, en lugar de desaparecer del lago.
        for fuente in ('catastro-construcciones', 'pot-tratamientos'):
            t._heredar(fuente)
    else:
        with t.bloque('catastro-construcciones'):
            teselas(construcciones(t))
    for capa in CAPAS_BASE:
        with t.bloque(capa[0]):
            capa_base(t, *capa)
    t.escribir()
    return t


if __name__ == '__main__':
    main(solo_limites='--solo-limites' in sys.argv)
