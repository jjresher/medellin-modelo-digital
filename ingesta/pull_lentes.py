"""Lentes y capas temáticas del gemelo 3D.

Requiere haber corrido antes pull_gemelo (usa public/data/geo/comunas.geojson y datos/crudos/construcciones_puntos.csv).

Genera:
  public/data/geo/capas/*.geojson     capas temáticas del panel Explorar
  public/data/siniestros.pmtiles      víctimas en siniestros viales georreferenciadas (mapa de calor)
  public/data/geo/analisis.json       rejilla de ~110 m para "Analizar punto"
  public/data/lago/lentes.json        indicadores por comuna y corregimiento, e índices 0–100 de cada lente

Índices: cada indicador se escala de 0 a 100 entre las 21 comunas y corregimientos (0 = valor mínimo observado,
100 = máximo). El índice de una lente es el promedio de sus indicadores disponibles y el cruce urbano es el
promedio de las tres lentes. Son posiciones relativas entre territorios, no umbrales ni calificaciones.
"""

import collections
import csv
import io
import json
import math
import subprocess
import urllib.parse

import shapely
from shapely.geometry import mapping, shape

from lago import RAIZ, Tema, arcgis_geojson as geojson_arcgis, descargar, json_url, leer_csv, numero

IDEM = 'https://portalidem.metropol.gov.co/server/rest/services'
POT = f'{IDEM}/DISTRITO_MEDELLIN_POT/MapServer'
ENERGIA = f'{IDEM}/Hosted/{urllib.parse.quote("Riesgo_Tecnológico")}/FeatureServer'
METRO = 'https://utility.arcgis.com/usrsvcs/servers'
METRO_ESTACIONES = f'{METRO}/b97b082ae9b44544b579f9e4d7a97d4c/rest/services/Hosted/ServiciosOpenData_gdb/FeatureServer/1'
METRO_LINEAS = f'{METRO}/0fe716dbf9ce4c2ebd63d56810b4c61b/rest/services/Hosted/ServiciosOpenData_gdb/FeatureServer/3'
ALC = 'https://www.medellin.gov.co/servidormapas/rest/services'
MEDATA = 'http://medata.gov.co/sites/default/files/distribution'
VICTIMAS_URL = f'{MEDATA}/1-023-25-000360/Mede_Victimas_inci.csv'
AFOROS_URL = f'{MEDATA}/1-023-25-000301/Aforos_Vehiculares.csv'

DIR_GEO = RAIZ / 'public' / 'data' / 'geo'
DIR_CAPAS = DIR_GEO / 'capas'
DIR_CRUDOS = RAIZ / 'datos' / 'crudos'
PUNTOS = DIR_CRUDOS / 'construcciones_puntos.csv'
SINIESTROS = RAIZ / 'public' / 'data' / 'siniestros.pmtiles'
TIPPECANOE = RAIZ / '.herramientas' / 'bin' / 'tippecanoe'
CELDA = 0.001  # grados, ~110 m en Medellín
ANIOS_VIAL = 3  # años recientes de siniestralidad usados en el índice


# ---------------------------------------------------------------- utilidades geográficas

def metros(geom):
    """Proyección equirectangular local (latitud de Medellín): suficiente para áreas y longitudes urbanas."""
    k = math.cos(math.radians(6.25))
    return shapely.transform(geom, lambda c: c * [111_320 * k, 110_574])


def area_km2(geom):
    return metros(geom).area / 1e6


def guardar_capa(nombre, features):
    DIR_CAPAS.mkdir(parents=True, exist_ok=True)
    salida = {'type': 'FeatureCollection', 'features': features}
    (DIR_CAPAS / f'{nombre}.geojson').write_text(json.dumps(salida, ensure_ascii=False, separators=(',', ':')),
                                                 encoding='utf-8')
    print(f'  · capa {nombre}: {len(features):,} elementos')


def punto(geom, props):
    centro = shape(geom).representative_point()
    return {'type': 'Feature', 'properties': props, 'geometry': {'type': 'Point', 'coordinates':
                                                                   [round(centro.x, 6), round(centro.y, 6)]}}


def limpiar(props, campos):
    return {nuevo: (props.get(viejo).strip() if isinstance(props.get(viejo), str) else props.get(viejo))
            for viejo, nuevo in campos.items() if props.get(viejo) not in (None, '', ' ')}


# ---------------------------------------------------------------- territorios

def territorios():
    datos = json.loads((DIR_GEO / 'comunas.geojson').read_text(encoding='utf-8'))
    salida = {}
    for f in datos['features']:
        p = f['properties']
        if not p.get('NOMBRE'):
            continue
        geom = shape(f['geometry'])
        salida[p['CODIGO']] = {'codigo': p['CODIGO'], 'nombre': p['NOMBRE'], 'geom': geom,
                               'tipo': 'comuna' if p.get('SUBTIPO_COMUNACORREGIMIENTO') == 1 else 'corregimiento',
                               'area_km2': round(area_km2(geom), 3)}
    return salida


def ubicar(xs, ys, terr):
    codigos = list(terr)
    arbol = shapely.STRtree([terr[c]['geom'] for c in codigos])
    ip, it = arbol.query(shapely.points(xs, ys), predicate='within')
    salida = [None] * len(xs)
    for i, j in zip(ip, it):
        salida[i] = codigos[j]
    return salida


# ---------------------------------------------------------------- lente de energía

def energia(t, terr):
    t.fuente('epm-red-electrica', 'Subestaciones y redes eléctricas del Valle de Aburrá (riesgo tecnológico)',
             'Área Metropolitana del Valle de Aburrá · Portal IDEM (datos de EPM)', f'{ENERGIA}')
    subestaciones = geojson_arcgis(f'{ENERGIA}/8', 'nombre_sub,estado,clasificac,direccion')
    puntos = [punto(f['geometry'], limpiar(f['properties'], {'nombre_sub': 'nombre', 'estado': 'estado',
                                                              'clasificac': 'clasificacion', 'direccion': 'direccion'}))
              for f in subestaciones['features'] if f.get('geometry')]
    guardar_capa('energia_subestaciones', puntos)

    alta = geojson_arcgis(f'{ENERGIA}/4', 'tension,circuito,estado', offset=0.00002)
    lineas = [{'type': 'Feature', 'geometry': f['geometry'],
               'properties': limpiar(f['properties'], {'tension': 'tension_kv', 'circuito': 'circuito', 'estado': 'estado'})}
              for f in alta['features'] if f.get('geometry')]
    guardar_capa('energia_alta_tension', lineas)
    geoms_alta = [shape(f['geometry']) for f in lineas]

    for codigo, ter in terr.items():
        g = ter['geom']
        ter['subestaciones'] = sum(1 for p in puntos if g.contains(shape(p['geometry'])))
        ter['km_alta_tension'] = round(sum(metros(g.intersection(l)).length for l in geoms_alta if l.intersects(g)) / 1000, 2)
        simple = g.simplify(0.0002)
        partes = [simple] if simple.geom_type == 'Polygon' else list(simple.geoms)
        anillos = [[[round(x, 6), round(y, 6)] for x, y in p.exterior.coords] for p in partes]
        stats = json_url(f'{ENERGIA}/2/query', post={
            'where': '1=1', 'geometry': json.dumps({'rings': anillos, 'spatialReference': {'wkid': 4326}}),
            'geometryType': 'esriGeometryPolygon', 'inSR': 4326, 'spatialRel': 'esriSpatialRelIntersects',
            'outStatistics': json.dumps([{'statisticType': 'sum', 'onStatisticField': 'longitud_c',
                                          'outStatisticFieldName': 'm'}]), 'f': 'json'})
        metros_mt = (stats['features'][0]['attributes'].get('m') or 0) if stats.get('features') else 0
        ter['km_media_tension'] = round(metros_mt / 1000, 1)
        ter['km_mt_por_km2'] = round(ter['km_media_tension'] / ter['area_km2'], 2)
        ter['km_at_por_km2'] = round(ter['km_alta_tension'] / ter['area_km2'], 3)

    en_medellin = sum(ter['subestaciones'] for ter in terr.values())
    t.cifra('subestaciones_medellin', en_medellin, 'subestaciones', 'Subestaciones de energía en Medellín',
            'epm-red-electrica', 'Red vigente', nota=f'{len(puntos)} en todo el Valle de Aburrá.')
    t.cifra('km_media_tension', round(sum(ter['km_media_tension'] for ter in terr.values())), 'km',
            'Red de media tensión en Medellín', 'epm-red-electrica', 'Red vigente', estado='derivado',
            nota='Suma de la longitud de los tramos que tocan cada territorio; un tramo en el límite cuenta en ambos.')
    t.cifra('km_alta_tension', round(sum(ter['km_alta_tension'] for ter in terr.values())), 'km',
            'Líneas de alta tensión en Medellín', 'epm-red-electrica', 'Red vigente', estado='derivado')


# ---------------------------------------------------------------- lente de densificación

def densificacion(t, terr):
    t.fuente('catastro-puntos', 'Construcciones del catastro con su comuna y altura normativa (cruce del gemelo)',
             'Área Metropolitana del Valle de Aburrá · Portal IDEM (catastro del Distrito) · POT',
             f'{IDEM}/DISTRITO_MEDELLIN_CATASTRO/MapServer/8')
    if not PUNTOS.exists():
        raise RuntimeError(f'Falta {PUNTOS.name}: corre antes pull_gemelo')
    agregado = collections.defaultdict(lambda: {'n': 0, 'area': 0.0, 'pisos': 0, 'con_norma': 0, 'sobre_norma': 0})
    with PUNTOS.open(encoding='utf-8') as archivo:
        for fila in csv.DictReader(archivo):
            if not fila['k']:
                continue
            a = agregado[fila['k']]
            pisos = int(fila['p'])
            a['n'] += 1
            a['area'] += float(fila['a'])
            a['pisos'] += pisos
            if fila['n']:
                a['con_norma'] += 1
                a['sobre_norma'] += pisos > int(fila['n'])
    for codigo, ter in terr.items():
        a = agregado[codigo]
        ter['construcciones'] = a['n']
        ter['area_construida_ha'] = round(a['area'] / 1e4, 1)
        ter['indice_construccion_bruto'] = round(a['area'] / (ter['area_km2'] * 1e6), 3)
        ter['pisos_promedio'] = round(a['pisos'] / a['n'], 2) if a['n'] else None
        ter['pct_sobre_altura_normativa'] = round(a['sobre_norma'] / a['con_norma'] * 100, 1) if a['con_norma'] else None
        # Base del porcentaje: en muchas zonas el POT fija la altura como "Variable" o no aplica.
        ter['construcciones_con_altura_normativa'] = a['con_norma']
    urbanas = [ter for ter in terr.values() if ter['tipo'] == 'comuna']
    area_urbana = sum(ter['area_km2'] for ter in urbanas) * 1e6
    t.cifra('indice_construccion_urbano', round(sum(agregado[ter['codigo']]['area'] for ter in urbanas) / area_urbana, 3),
            'm²/m²', 'Índice de construcción bruto (16 comunas)', 'catastro-puntos', 'Base catastral vigente',
            estado='derivado', decimales=2,
            nota='Área construida del catastro dividida por el área total de las comunas (incluye vías y espacio público).')


# ---------------------------------------------------------------- lente de presión vial

def victimas_viales(t, terr):
    t.fuente('medata-victimas-viales', 'Víctimas en incidentes viales (georreferenciadas)',
             'Secretaría de Movilidad · Alcaldía de Medellín (MEData)', VICTIMAS_URL)

    victimas = []
    for fila in leer_csv(VICTIMAS_URL):
        lat, lon, anio = numero(fila.get('Latitud')), numero(fila.get('Longitud')), fila.get('Año', '').strip()
        if lat and lon and anio.isdigit() and 5.9 < lat < 6.5 and -75.8 < lon < -75.3:
            victimas.append({'x': lon, 'y': lat, 'anio': int(anio), 'gravedad': fila.get('Gravedad_victima', '').strip(),
                             'condicion': fila.get('Condicion', '').strip()})
    ultimo = max(v['anio'] for v in victimas)
    desde = ultimo - ANIOS_VIAL + 1
    recientes = [v for v in victimas if v['anio'] >= desde]
    comuna = ubicar([v['x'] for v in recientes], [v['y'] for v in recientes], terr)
    por_comuna = collections.Counter(c for c in comuna if c)
    for codigo, ter in terr.items():
        ter['victimas_viales'] = por_comuna[codigo]
        ter['victimas_por_km2_anio'] = round(por_comuna[codigo] / ter['area_km2'] / ANIOS_VIAL, 1)
    periodo = f'{desde}–{ultimo}'
    t.cifra('victimas_viales', len(recientes), 'víctimas', f'Víctimas en siniestros viales {periodo}',
            'medata-victimas-viales', periodo,
            nota=f'Heridos y muertos con coordenadas. La serie abierta llega hasta {ultimo}.')
    t.cifra('victimas_viales_muertos', sum(1 for v in recientes if v['gravedad'] == 'Muertos'), 'víctimas',
            f'Muertos en siniestros viales {periodo}', 'medata-victimas-viales', periodo)
    siniestros_pmtiles(victimas)
    return periodo


def aforos(t, terr):
    t.fuente('medata-aforos', 'Aforos vehiculares por intersección', 'Secretaría de Movilidad · Alcaldía de Medellín (MEData)',
             AFOROS_URL)
    # Aforos: cada fila es un movimiento de giro cada 15 minutos con su volumen horario móvil. Se suman los
    # movimientos de cada intersección por fecha y hora, y se toma la hora de máxima demanda de cada día.
    filas = leer_csv(AFOROS_URL)
    por_nodo_hora = collections.defaultdict(float)
    nodos = {}
    for f in filas:
        ve = numero(f.get('VEHICULO_EQUIVALENTE'))
        x, y = numero(f.get('COORDENADAX')), numero(f.get('COORDENADAY'))
        if ve is None or not x or not y:
            continue
        clave = (f['NODO'], f.get('DIA/MES/AÑO'), f.get('HORA'))
        por_nodo_hora[clave] += ve
        nodos.setdefault(f['NODO'], {'x': x, 'y': y, 'interseccion': f.get('INTERSECCIÓN', '').strip(),
                                     'anios': set()})['anios'].add(f.get('AÑO_ENTERO'))
    pico = collections.defaultdict(float)
    for (nodo, fecha, _hora), total in por_nodo_hora.items():
        pico[(nodo, fecha)] = max(pico[(nodo, fecha)], total)
    por_nodo = collections.defaultdict(list)
    for (nodo, _fecha), total in pico.items():
        por_nodo[nodo].append(total)
    features = []
    for nodo, datos in nodos.items():
        if nodo not in por_nodo:
            continue
        datos['veh_hora_pico'] = round(sum(por_nodo[nodo]) / len(por_nodo[nodo]))
        features.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [datos['x'], datos['y']]},
                         'properties': {'nodo': nodo, 'interseccion': datos['interseccion'],
                                        'veh_eq_hora_pico': datos['veh_hora_pico'],
                                        'anios': ', '.join(sorted(a for a in datos['anios'] if a))}})
    guardar_capa('movilidad_aforos', features)
    comuna = ubicar([f['geometry']['coordinates'][0] for f in features], [f['geometry']['coordinates'][1] for f in features], terr)
    volumenes = collections.defaultdict(list)
    for f, c in zip(features, comuna):
        if c:
            volumenes[c].append(f['properties']['veh_eq_hora_pico'])
    for codigo, ter in terr.items():
        v = volumenes.get(codigo)
        ter['nodos_aforados'] = len(v or [])
        ter['veh_eq_hora_pico'] = round(sum(v) / len(v)) if v else None
    anios = sorted({a for d in nodos.values() for a in d['anios'] if a})
    t.cifra('intersecciones_aforadas', len(features), 'intersecciones', 'Intersecciones con aforo vehicular',
            'medata-aforos', f'{anios[0]}–{anios[-1]}',
            nota='Volumen en vehículos equivalentes en la hora de máxima demanda de cada día aforado, promediado por intersección.')


def siniestros_pmtiles(victimas):
    DIR_CRUDOS.mkdir(parents=True, exist_ok=True)
    ndjson = DIR_CRUDOS / 'victimas_viales.ndjson'
    with ndjson.open('w', encoding='utf-8') as archivo:
        for v in victimas:
            archivo.write(json.dumps({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [round(v['x'], 6), round(v['y'], 6)]},
                                      'properties': {'y': v['anio'], 'm': int(v['gravedad'] == 'Muertos')}}) + '\n')
    temporal = SINIESTROS.with_suffix('.tmp.pmtiles')
    subprocess.run([str(TIPPECANOE), '-o', str(temporal), '--force', '-l', 'siniestros', '-Z10', '-z15', '-r1',
                    '--no-feature-limit', '--no-tile-size-limit', '--no-tile-stats', '--quiet', str(ndjson)], check=True)
    temporal.replace(SINIESTROS)
    print(f'  · {SINIESTROS.relative_to(RAIZ)} · {SINIESTROS.stat().st_size / 1e6:.1f} MB')


# ---------------------------------------------------------------- capas del panel Explorar

def capas_pot(t):
    t.fuente('idem-pot', 'POT (Acuerdo 48 de 2014): riesgos, tratamientos, suelo de protección y equipamientos',
             'Área Metropolitana del Valle de Aburrá · Portal IDEM', POT)
    riesgo = geojson_arcgis(f'{POT}/3', 'NOMBRE,RIESGO,TIPO_AMENAZA', offset=0.00001)
    guardar_capa('riesgo_pot', [{'type': 'Feature', 'geometry': f['geometry'],
                                 'properties': limpiar(f['properties'], {'NOMBRE': 'nombre', 'RIESGO': 'riesgo', 'TIPO_AMENAZA': 'amenaza'})}
                                for f in riesgo['features'] if f.get('geometry')])
    trat = geojson_arcgis(f'{POT}/5', 'CODIGO_TRATAMIENTO,TRATAMIENTO,TIPO,ALTURANORMATIVA,INDICECONSTRUCCMAX,DENSIDADMAX',
                          offset=0.00005)
    guardar_capa('planificacion_tratamientos', [{'type': 'Feature', 'geometry': f['geometry'], 'properties': limpiar(f['properties'], {
        'CODIGO_TRATAMIENTO': 'codigo', 'TRATAMIENTO': 'tratamiento', 'TIPO': 'tipo', 'ALTURANORMATIVA': 'altura_normativa',
        'INDICECONSTRUCCMAX': 'ic_max', 'DENSIDADMAX': 'densidad_max'})} for f in trat['features'] if f.get('geometry')])
    # Polígonos rurales muy grandes: ~10 m de simplificación bastan a la escala en que se ven.
    prot = geojson_arcgis(f'{POT}/6', 'CATEGORIA,NOMBRECATEGORIA,SUBCATEGORIAS', offset=0.0001)
    guardar_capa('verde_proteccion', [{'type': 'Feature', 'geometry': f['geometry'], 'properties': limpiar(f['properties'], {
        'CATEGORIA': 'categoria', 'SUBCATEGORIAS': 'subcategoria', 'NOMBRECATEGORIA': 'nombre'})} for f in prot['features'] if f.get('geometry')])
    equip = geojson_arcgis(f'{POT}/7', 'NOMBRE,TIPO,COMPONENTES,NIVEL,NOM_BARRIO')
    puntos = [punto(f['geometry'], limpiar(f['properties'], {'NOMBRE': 'nombre', 'TIPO': 'tipo', 'COMPONENTES': 'componente',
                                                              'NIVEL': 'nivel', 'NOM_BARRIO': 'barrio'}))
              for f in equip['features'] if f.get('geometry')]
    guardar_capa('servicios_equipamientos', puntos)
    no_mitigable = sum(1 for f in riesgo['features'] if f['properties'].get('RIESGO') == 'Alto riesgo no mitigable')
    t.cifra('zonas_riesgo_pot', len(riesgo['features']), 'zonas', 'Zonas con condiciones de riesgo o alto riesgo (POT)',
            'idem-pot', 'POT vigente (Acuerdo 48 de 2014)', nota=f'{no_mitigable} son de alto riesgo no mitigable.')
    t.cifra('equipamientos_pot', len(puntos), 'equipamientos', 'Equipamientos del POT', 'idem-pot', 'POT vigente (Acuerdo 48 de 2014)')
    t.lista('equipamientos_por_componente', [{'nombre': k, 'valor': v} for k, v in collections.Counter(
        p['properties'].get('componente', 'Sin dato') for p in puntos).most_common()])


def capas_movilidad(t):
    t.fuente('metro-red', 'Estaciones y líneas del Sistema Metro', 'Metro de Medellín · datos abiertos', METRO_ESTACIONES)
    est = geojson_arcgis(METRO_ESTACIONES, 'label,linea,sistema')
    guardar_capa('movilidad_metro_estaciones', [{'type': 'Feature', 'geometry': f['geometry'], 'properties': limpiar(
        f['properties'], {'label': 'nombre', 'linea': 'linea', 'sistema': 'sistema'})} for f in est['features'] if f.get('geometry')])
    lin = geojson_arcgis(METRO_LINEAS, 'linea,itinerario,sistema', offset=0.00002)
    guardar_capa('movilidad_metro_lineas', [{'type': 'Feature', 'geometry': f['geometry'], 'properties': limpiar(
        f['properties'], {'linea': 'linea', 'itinerario': 'itinerario', 'sistema': 'sistema'})} for f in lin['features'] if f.get('geometry')])
    t.cifra('estaciones_metro', len(est['features']), 'estaciones', 'Estaciones del Sistema Metro', 'metro-red', 'Red vigente',
            nota='Incluye metro, tranvía, metrocables y buses del sistema en todo el Valle de Aburrá.')


def capas_bicicleta(t):
    t.fuente('idem-bicicleta', 'Estaciones EnCicla y ciclorrutas', 'Área Metropolitana del Valle de Aburrá · Portal IDEM',
             f'{IDEM}/Hosted/Ciclorrutas/FeatureServer/0')
    encicla = geojson_arcgis(f'{IDEM}/Hosted/Estaciones_EnCicla/FeatureServer/1', 'name,popupinfo')
    puntos = []
    for f in encicla['features']:
        info = f['properties'].get('popupinfo') or ''
        direccion = next((p.split(':', 1)[1].strip() for p in info.split('<br>') if p.startswith('S_DIRECCION')), '')
        puntos.append({'type': 'Feature', 'geometry': f['geometry'], 'properties': {'nombre': f['properties'].get('name'), 'direccion': direccion}})
    guardar_capa('movilidad_encicla', puntos)
    ciclo = geojson_arcgis(f'{IDEM}/Hosted/Ciclorrutas/FeatureServer/0', 'name,estado,tipo,tipo_pmb,longitud', offset=0.00001)
    guardar_capa('movilidad_ciclorrutas', [{'type': 'Feature', 'geometry': f['geometry'], 'properties': limpiar(
        f['properties'], {'name': 'nombre', 'estado': 'estado', 'tipo': 'tipo', 'tipo_pmb': 'tipo_via', 'longitud': 'longitud_m'})}
        for f in ciclo['features'] if f.get('geometry')])
    construidas = [f for f in ciclo['features'] if (f['properties'].get('estado') or '').startswith('Constru')]
    t.cifra('estaciones_encicla', len(puntos), 'estaciones', 'Estaciones EnCicla', 'idem-bicicleta', 'Red vigente')
    t.cifra('km_ciclorrutas', round(sum(f['properties'].get('longitud') or 0 for f in construidas) / 1000, 1), 'km',
            'Ciclorrutas construidas', 'idem-bicicleta', 'Red vigente',
            nota='Suma del campo de longitud de los tramos en estado "Construida"; hay tramos proyectados que no se suman.')


def capas_turismo(t):
    t.fuente('alcaldia-turismo', 'Atractivos turísticos y puntos de información turística',
             'Secretaría de Turismo · Alcaldía de Medellín', f'{ALC}/ccio_ind_turism/VC_Turismo/MapServer/0')
    atractivos = geojson_arcgis(f'{ALC}/ccio_ind_turism/VC_Turismo/MapServer/0')
    guardar_capa('turismo_atractivos', [punto(f['geometry'], {k.lower(): v for k, v in f['properties'].items()
                                                              if isinstance(v, str) and v.strip()})
                                        for f in atractivos['features'] if f.get('geometry')])
    t.cifra('atractivos_turisticos', len(atractivos['features']), 'atractivos', 'Atractivos turísticos registrados',
            'alcaldia-turismo', 'Registro vigente')


# ---------------------------------------------------------------- índices y rejilla de análisis

INDICADORES = {
    # lente: [(campo, etiqueta, unidad)]
    'energia': [('km_mt_por_km2', 'Red de media tensión', 'km/km²'), ('km_at_por_km2', 'Líneas de alta tensión', 'km/km²')],
    'densificacion': [('indice_construccion_bruto', 'Índice de construcción bruto', 'm²/m²'), ('pisos_promedio', 'Pisos promedio', 'pisos')],
    'vial': [('victimas_por_km2_anio', 'Víctimas viales por km² al año', 'víctimas/km²·año'), ('veh_eq_hora_pico', 'Volumen en hora pico (aforos)', 'veh. eq./hora')],
}


def escalar(valores):
    presentes = [v for v in valores.values() if v is not None]
    if not presentes:
        return {k: None for k in valores}
    minimo, maximo = min(presentes), max(presentes)
    return {k: (None if v is None else round((v - minimo) / (maximo - minimo) * 100, 1) if maximo > minimo else 0.0)
            for k, v in valores.items()}


def indices(t, terr):
    for lente, indicadores in INDICADORES.items():
        escalas = [escalar({c: ter.get(campo) for c, ter in terr.items()}) for campo, _, _ in indicadores]
        for codigo, ter in terr.items():
            puntajes = [e[codigo] for e in escalas if e[codigo] is not None]
            ter[f'indice_{lente}'] = round(sum(puntajes) / len(puntajes), 1) if puntajes else None
    for ter in terr.values():
        lentes = [ter[f'indice_{l}'] for l in INDICADORES if ter.get(f'indice_{l}') is not None]
        ter['indice_cruce'] = round(sum(lentes) / len(lentes), 1) if lentes else None
    t.lista('territorios', [{k: v for k, v in ter.items() if k != 'geom'} for ter in
                            sorted(terr.values(), key=lambda x: x['codigo'])])
    t.lista('metodo_indices', [{'lente': lente, 'indicadores': [{'campo': c, 'etiqueta': e, 'unidad': u} for c, e, u in ind]}
                               for lente, ind in INDICADORES.items()])


def rejilla(victimas_periodo):
    """Suma por celda de ~110 m: construcciones, área construida, pisos y víctimas viales recientes."""
    celdas = collections.defaultdict(lambda: [0, 0.0, 0, 0, 0])
    x0, y0 = -75.72, 6.16
    with PUNTOS.open(encoding='utf-8') as archivo:
        for fila in csv.DictReader(archivo):
            i, j = int((float(fila['x']) - x0) / CELDA), int((float(fila['y']) - y0) / CELDA)
            c = celdas[f'{i}_{j}']
            pisos = int(fila['p'])
            c[0] += 1
            c[1] += float(fila['a'])
            c[2] += pisos
            c[3] = max(c[3], pisos)
    desde = int(victimas_periodo.split('–')[0])
    with (DIR_CRUDOS / 'victimas_viales.ndjson').open(encoding='utf-8') as archivo:
        for linea in archivo:
            f = json.loads(linea)
            if f['properties']['y'] >= desde:
                x, y = f['geometry']['coordinates']
                celdas[f'{int((x - x0) / CELDA)}_{int((y - y0) / CELDA)}'][4] += 1
    salida = {'x0': x0, 'y0': y0, 'celda': CELDA, 'campos': ['construcciones', 'area_construida_m2', 'suma_pisos', 'pisos_max', 'victimas_viales'],
              'periodo_victimas': victimas_periodo,
              'celdas': {k: [v[0], round(v[1]), v[2], v[3], v[4]] for k, v in celdas.items()}}
    (DIR_GEO / 'analisis.json').write_text(json.dumps(salida, separators=(',', ':')), encoding='utf-8')
    print(f'  · rejilla de análisis: {len(celdas):,} celdas')


def main():
    t = Tema('lentes', 'Lentes del gemelo')
    terr = territorios()
    with t.bloque('epm-red-electrica'):
        energia(t, terr)
    with t.bloque('catastro-puntos'):
        densificacion(t, terr)
    periodo_vial = None
    with t.bloque('medata-victimas-viales'):
        periodo_vial = victimas_viales(t, terr)
    with t.bloque('medata-aforos'):
        aforos(t, terr)
    for fuente, funcion in (('idem-pot', capas_pot), ('metro-red', capas_movilidad), ('idem-bicicleta', capas_bicicleta),
                            ('alcaldia-turismo', capas_turismo)):
        with t.bloque(fuente):
            funcion(t)
    indices(t, terr)
    if periodo_vial:
        rejilla(periodo_vial)
    t.escribir()
    return t


if __name__ == '__main__':
    main()
