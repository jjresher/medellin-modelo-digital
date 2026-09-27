"""Turismo: extranjeros no residentes (MinCIT), pasajeros del aeropuerto José María Córdova (Aerocivil), el histórico
de ocupación hotelera, museos y sitios de interés (MEData), los atractivos y puntos de información de la Alcaldía y
los hospedajes mapeados en OpenStreetMap.

Genera además las capas del gemelo en public/data/geo/capas/turismo_{atractivos,informacion,hospedajes}.geojson.
"""

import collections
import csv
import datetime as dt
import io
import json
import re
import urllib.parse

import shapely
from shapely.geometry import shape

from lago import MESES, RAIZ, Tema, Territorios, arcgis_geojson, descargar, hoy, socrata

MINCIT = '7wm8-w5ad'
AEROCIVIL = 'gb6w-ynu4'
AEROPUERTO = "(origen='MDE' or destino='MDE')"
ALC = 'https://www.medellin.gov.co/servidormapas/rest/services'
TURISMO = f'{ALC}/ccio_ind_turism/VC_Turismo/MapServer'
MEDATA = 'http://medata.gov.co/sites/default/files/distribution'
OCUPACION = f'{MEDATA}/1-010-04-000201/porcentaje_ocupacion_hotelera_mensual_de_medellin.csv'
OCUPACION_ZONA = f'{MEDATA}/1-010-04-000202/porcentaje_ocupacion_hotelera_mensual_por_zona.csv'
MUSEOS = f'{MEDATA}/1-010-04-000192/ingreso_mensual_de_visitantes_a_museos.csv'
SITIOS = f'{MEDATA}/1-010-04-000193/ingreso_mensual_de_visitantes_a_sitios_de_interes.csv'
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.private.coffee/api/interpreter']
HOSPEDAJES = {'hotel': 'Hotel', 'hostel': 'Hostal', 'guest_house': 'Casa de huéspedes', 'apartment': 'Apartamento turístico',
              'motel': 'Motel'}
BBOX = (6.14, -75.72, 6.40, -75.46)  # sur, oeste, norte, este
DIR_GEO = RAIZ / 'public' / 'data' / 'geo'
DIR_CAPAS = DIR_GEO / 'capas'

# Nombres para mostrar de los museos y sitios de MEData, que vienen como MUSEO_ANTIOQUIA.
NOMBRES = {
    'MUSEO_AGUA': 'Museo del Agua EPM', 'MUSEO_ANTIOQUIA': 'Museo de Antioquia', 'MUSEO_ARTE_MODERNO': 'Museo de Arte Moderno',
    'MUSEO_CASA_GARDELIANA': 'Casa Gardeliana', 'MUSEO_CASA_MEMORIA': 'Museo Casa de la Memoria',
    'MUSEO_CASTILLO': 'Museo El Castillo', 'MUSEO_CIUDAD': 'Museo de la Ciudad', 'MUSEO_ENTOMOLOGICO': 'Museo Entomológico',
    'MUSEO_MADRE_LAURA': 'Museo Madre Laura', 'MUSEO_PEDRO_NEL_GOMEZ': 'Casa Museo Pedro Nel Gómez',
    'MUSEO_SAN_PEDRO': 'Museo Cementerio San Pedro', 'MUSEO_UNIVERSITARIO': 'Museo Universitario (U. de A.)',
    'AEROPARQUE_JUAN_PABLO': 'Aeroparque Juan Pablo II', 'ESCALERAS_COMUNA_13': 'Escaleras Comuna 13',
    'JARDIN_BOTANICO': 'Jardín Botánico', 'PARQUE_ARVI': 'Parque Arví', 'PARQUE_EXPLORA': 'Parque Explora',
    'PARQUE_NORTE': 'Parque Norte', 'PLANETARIO_MEDELLIN': 'Planetario de Medellín',
    'SANTUARIO_MADRE_LAURA': 'Santuario Madre Laura', 'ZOOLOGICO_SANTA_FE': 'Zoológico Santa Fe',
}


def miles(n):
    return f'{n:,.0f}'.replace(',', '.')


def csv_url(url):
    return list(csv.DictReader(io.StringIO(descargar(url, timeout=120).decode('utf-8-sig'))))


def mes_de(periodo):
    """'202310' → (2023, 10)."""
    return int(str(periodo)[:4]), int(str(periodo)[4:6])


def etiqueta_mes(anio, mes):
    return f'{MESES[mes - 1]} {anio}'


def guardar_capa(nombre, features):
    DIR_CAPAS.mkdir(parents=True, exist_ok=True)
    (DIR_CAPAS / f'{nombre}.geojson').write_text(json.dumps({'type': 'FeatureCollection', 'features': features},
                                                            ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'  · capa {nombre}: {len(features)} elementos')


def punto(lon, lat, props):
    return {'type': 'Feature', 'properties': props,
            'geometry': {'type': 'Point', 'coordinates': [round(lon, 6), round(lat, 6)]}}


# ---------------------------------------------------------------- extranjeros no residentes (MinCIT)

def extranjeros(t):
    fuente = t.fuente('mincit-extranjeros', 'Extranjeros no residentes por ciudad de destino',
                      'Ministerio de Comercio, Industria y Turismo', f'https://www.datos.gov.co/d/{MINCIT}')
    donde = "ciudad='Medellín'"
    filas = socrata(MINCIT, select='a_o, mes, sum(cant_extranjeros_no_residentes) as n', where=donde,
                    group='a_o, mes', limit=5000)
    por_mes = {}
    for f in filas:
        mes = f['mes'].strip().lower()[:3]
        if mes in MESES:
            por_mes[(int(f['a_o']), MESES.index(mes) + 1)] = int(float(f['n']))
    por_anio = collections.Counter()
    meses_por_anio = collections.Counter()
    for (a, _m), n in por_mes.items():
        por_anio[a] += n
        meses_por_anio[a] += 1
    completo = max(a for a, m in meses_por_anio.items() if m == 12)
    nota = 'Extranjeros no residentes que declararon Medellín como destino al entrar al país.'
    t.cifra('visitantes_extranjeros', por_anio[completo], 'personas', f'Visitantes extranjeros {completo}', fuente,
            str(completo), ancla=True, nota=nota)
    t.serie('visitantes_extranjeros_anual', [[str(a), n] for a, n in sorted(por_anio.items())], 'personas',
            'Visitantes extranjeros por año', fuente,
            nota=f'{max(por_anio)} parcial: hasta {MESES[max(m for a, m in por_mes if a == max(por_anio)) - 1]}.'
            if max(por_anio) > completo else '')
    t.serie('visitantes_extranjeros_mensual', [[etiqueta_mes(a, m), n] for (a, m), n in sorted(por_mes.items())],
            'personas', 'Visitantes extranjeros por mes', fuente, nota=nota)

    actual = max(por_anio)
    if actual > completo:
        ultimo = max(m for a, m in por_mes if a == actual)
        previo = sum(por_mes.get((actual - 1, m), 0) for m in range(1, ultimo + 1))
        vigencia = f'ene–{MESES[ultimo - 1]} {actual}'
        t.cifra('visitantes_extranjeros_anio_curso', por_anio[actual], 'personas', f'Visitantes extranjeros {actual}',
                fuente, vigencia, nota=nota)
        if previo:
            t.cifra('visitantes_extranjeros_variacion', round((por_anio[actual] / previo - 1) * 100, 1), '%',
                    f'Visitantes extranjeros: variación frente a {actual - 1}', fuente, vigencia, estado='derivado',
                    decimales=1, nota=f'{miles(por_anio[actual])} frente a {miles(previo)} en los mismos meses de '
                                      f'{actual - 1}.')

    paises = socrata(MINCIT, select='paisoeeresidencia as pais, sum(cant_extranjeros_no_residentes) as n',
                     where=f"{donde} and a_o='{completo}'", group='pais', order='n desc', limit=15)
    t.lista('paises_origen', [{'nombre': p['pais'], 'valor': int(float(p['n']))} for p in paises])


# ---------------------------------------------------------------- aeropuerto José María Córdova (Aerocivil)

def aeropuerto(t):
    fuente = t.fuente('aerocivil-origen-destino', 'Transporte aéreo comercial · tráfico origen–destino',
                      'Aeronáutica Civil de Colombia', f'https://www.datos.gov.co/d/{AEROCIVIL}')
    filas = socrata(AEROCIVIL, select='a_o, n_mero_de_mes as mes, tr_fico_n_i as trafico, sum(pasajeros) as p',
                    where=AEROPUERTO, group='a_o, mes, trafico', limit=5000)
    por_mes, por_trafico = collections.Counter(), collections.Counter()
    for f in filas:
        clave = (int(f['a_o']), int(f['mes']))
        por_mes[clave] += int(float(f['p']))
        por_trafico[(clave[0], f['trafico'])] += int(float(f['p']))
    por_anio, meses = collections.Counter(), collections.defaultdict(set)
    for (a, m), p in por_mes.items():
        por_anio[a] += p
        meses[a].add(m)
    completo = max(a for a, ms in meses.items() if len(ms) == 12)
    nota = ('Pasajeros en vuelos comerciales que salen del aeropuerto José María Córdova (Rionegro) o llegan a él: '
            'cada viaje de ida o de vuelta cuenta una vez.')
    t.cifra('pasajeros_aeropuerto', por_anio[completo], 'pasajeros', f'Pasajeros aeropuerto JMC {completo}', fuente,
            str(completo), ancla=True, nota=nota)
    for codigo, clave, etiqueta in (('I', 'pasajeros_internacionales', 'internacionales'),
                                    ('N', 'pasajeros_nacionales', 'nacionales')):
        t.cifra(clave, por_trafico[(completo, codigo)], 'pasajeros', f'Pasajeros {etiqueta} JMC {completo}', fuente,
                str(completo), nota=f'{nota} Tráfico {etiqueta} según la Aerocivil.')
    t.serie('pasajeros_aeropuerto_anual', [[str(a), n] for a, n in sorted(por_anio.items())], 'pasajeros',
            'Pasajeros del aeropuerto por año', fuente, nota=nota)
    t.serie('pasajeros_aeropuerto_mensual', [[etiqueta_mes(a, m), n] for (a, m), n in sorted(por_mes.items())],
            'pasajeros', 'Pasajeros del aeropuerto por mes', fuente, nota=nota)
    actual = max(por_anio)
    if actual > completo:
        t.cifra('pasajeros_aeropuerto_anio_curso', por_anio[actual], 'pasajeros', f'Pasajeros aeropuerto JMC {actual}',
                fuente, f'ene–{MESES[max(meses[actual]) - 1]} {actual}', nota=nota)


# ---------------------------------------------------------------- histórico de MEData (hasta 2023)

def ocupacion(t):
    fuente = t.fuente('medata-ocupacion-hotelera', 'Porcentaje de ocupación hotelera mensual de Medellín',
                      'Secretaría de Turismo · Alcaldía de Medellín (MEData)', OCUPACION)
    filas = csv_url(OCUPACION)
    por_mes = {mes_de(f['ocu_periodo']): float(f['ocu_valor']) for f in filas if f.get('ocu_valor')}
    (ua, um) = max(por_mes)
    fin = etiqueta_mes(ua, um)
    nota = (f'Histórico: la serie abierta termina en {fin}. El descenso de abril a septiembre de 2020 corresponde al '
            'cierre de hoteles por la pandemia.')
    t.serie('ocupacion_hotelera_mensual', [[etiqueta_mes(a, m), round(v, 1)] for (a, m), v in sorted(por_mes.items())],
            '%', 'Ocupación hotelera mensual', fuente, nota=nota)
    t.cifra('ocupacion_hotelera_ultima', round(por_mes[(ua, um)], 1), '%', f'Ocupación hotelera, {fin}', fuente,
            f'{fin} (histórico)', decimales=1, nota=nota)
    completo = max(a for a in {a for a, _ in por_mes} if all((a, m) in por_mes for m in range(1, 13)))
    promedio = sum(por_mes[(completo, m)] for m in range(1, 13)) / 12
    t.cifra('ocupacion_hotelera_anual', round(promedio, 1), '%', f'Ocupación hotelera promedio {completo}', fuente,
            f'{completo} (histórico)', estado='derivado', decimales=1,
            nota=f'Promedio simple de los 12 meses de {completo}. {nota}')

    zonas = csv_url(OCUPACION_ZONA)
    por_zona = collections.defaultdict(dict)
    for f in zonas:
        if f.get('ocu_valor'):
            por_zona[f['ocu_zona'].strip().title()][mes_de(f['ocu_periodo'])] = float(f['ocu_valor'])
    anio_zona = max(a for a in {a for d in por_zona.values() for a, _ in d}
                    if all(all((a, m) in d for m in range(1, 13)) for d in por_zona.values()))
    fin_zona = etiqueta_mes(*max(max(d) for d in por_zona.values()))
    t.lista('ocupacion_por_zona', sorted(
        ({'zona': z, 'anio': anio_zona, 'promedio': round(sum(d[(anio_zona, m)] for m in range(1, 13)) / 12, 1)}
         for z, d in por_zona.items()), key=lambda x: -x['promedio']))
    t.cifra('ocupacion_zona_anio', anio_zona, 'año', 'Último año completo de ocupación por zona', fuente,
            f'{anio_zona} (histórico)', nota=f'La serie por zona termina en {fin_zona}.')


def visitas(t, fuente_id, nombre, url, prefijo, clave):
    """Museos o sitios de interés: visitas por lugar y mes. Los ceros antes de que el lugar reporte por primera vez
    (el Parque Arví abrió en 2010) y los valores negativos (errores de captura) no son visitas: se descartan."""
    fuente = t.fuente(fuente_id, nombre, 'Secretaría de Turismo · Alcaldía de Medellín (MEData)', url)
    filas = csv_url(url)
    lugares = collections.defaultdict(dict)
    for f in filas:
        valor = float(f[f'{prefijo}_totalvisitas'] or 0)
        lugares[f[f'{prefijo}_nombre'].strip()][mes_de(f[f'{prefijo}_periodo'])] = valor
    limpio = {}
    for lugar, datos in lugares.items():
        con_dato = sorted(k for k, v in datos.items() if v > 0)
        if con_dato:
            limpio[lugar] = {k: v for k, v in datos.items() if k >= con_dato[0] and v >= 0}
    todos = {k for d in limpio.values() for k in d}
    fin = etiqueta_mes(*max(todos))
    # Año completo: el último en que la fuente trae los 12 meses.
    completo = max(a for a in {a for a, _ in todos} if all((a, m) in todos for m in range(1, 13)))
    por_lugar = []
    for lugar, datos in limpio.items():
        del_anio = [v for (a, _), v in datos.items() if a == completo]
        if del_anio:
            por_lugar.append({'nombre': NOMBRES.get(lugar, lugar.replace('_', ' ').title()), 'visitas': round(sum(del_anio)),
                              'visitas_2019': round(sum(v for (a, _), v in datos.items() if a == 2019)) or None})
    por_lugar.sort(key=lambda x: -x['visitas'])
    t.lista(f'{clave}_por_lugar', por_lugar)
    anuales = collections.Counter()
    for datos in limpio.values():
        for (a, _), v in datos.items():
            anuales[a] += v
    nota = (f'Histórico: la serie abierta termina en {fin}. La suma es de los lugares que reportan cada año, y el '
            'conjunto cambia (algunos entran en 2012, 2016 o 2018), así que los años no son del todo comparables.')
    t.serie(f'{clave}_anual', [[str(a), round(v)] for a, v in sorted(anuales.items()) if a <= completo], 'visitas',
            f'{nombre} por año', fuente, nota=nota)
    t.cifra(f'{clave}_visitas', round(anuales[completo]), 'visitas', f'{nombre} {completo}', fuente,
            f'{completo} (histórico)', nota=f'{len(por_lugar)} lugares que reportaron en {completo}. {nota}')


# ---------------------------------------------------------------- atractivos y puntos de información (Alcaldía)

def atractivos(t, terr):
    fuente = t.fuente('alcaldia-turismo', 'Atractivos turísticos y puntos de información turística',
                      'Secretaría de Turismo · Alcaldía de Medellín', TURISMO)
    datos = arcgis_geojson(f'{TURISMO}/0')
    lista = [f for f in datos['features'] if f.get('geometry')]
    if not lista:
        raise RuntimeError('El servicio de turismo no devolvió atractivos')
    fechas = [f['properties'].get('fecha_actualizacion') for f in lista if f['properties'].get('fecha_actualizacion')]
    vigencia = (f'Actualizado el {dt.datetime.fromtimestamp(max(fechas) / 1000, dt.timezone.utc).date().isoformat()}'
                if fechas else 'Registro vigente')
    capa = []
    for f in lista:
        p = f['properties']
        lon, lat = f['geometry']['coordinates'][:2]
        capa.append(punto(lon, lat, {k: v for k, v in {
            'nombre': p.get('nombre_sitio'), 'tipo': p.get('tipo_atractivo'), 'imperdible': p.get('imperdible') == 'SI',
            'comuna': p.get('nombre_comuna'), 'direccion': p.get('direccion'), 'web': p.get('sitio_web')}.items()
            if v not in (None, '')}))
    guardar_capa('turismo_atractivos', capa)
    imperdibles = sum(1 for f in capa if f['properties'].get('imperdible'))
    t.cifra('atractivos_turisticos', len(capa), 'atractivos', 'Atractivos turísticos registrados', fuente, vigencia)
    t.cifra('atractivos_imperdibles', imperdibles, 'atractivos', 'Atractivos marcados como "imperdibles"', fuente,
            vigencia, nota='Clasificación de la propia Secretaría de Turismo en su registro de atractivos.')
    por_tipo = collections.Counter(f['properties'].get('tipo', 'Sin tipo') for f in capa)
    t.lista('atractivos_por_tipo', [{'tipo': k, 'atractivos': n} for k, n in por_tipo.most_common()])

    info = arcgis_geojson(f'{TURISMO}/1')
    puntos = [punto(*f['geometry']['coordinates'][:2], {k: v for k, v in {
        'nombre': f['properties'].get('sitio'), 'direccion': f['properties'].get('direccion'),
        'comuna': f['properties'].get('comuna_corregimiento')}.items() if v})
        for f in info['features'] if f.get('geometry')]
    guardar_capa('turismo_informacion', puntos)
    t.cifra('puntos_informacion', len(puntos), 'puntos', 'Puntos de información turística', fuente, vigencia)

    terr.indicador('atractivos', 'Atractivos turísticos', 'atractivos', fuente, vigencia)
    por_comuna = collections.Counter(str(f['properties'].get('cod_comuna') or '').zfill(2) for f in lista)
    for codigo in terr.filas:
        terr.valor(codigo, 'atractivos', 'vigente', por_comuna.get(codigo, 0))


# ---------------------------------------------------------------- hospedajes (OpenStreetMap)

def overpass(consulta):
    """Consulta Overpass probando varios servidores. La consulta pide [timeout:25]: con timeouts largos Overpass reserva
    más recursos y, cuando está cargado, la rechaza con 504."""
    ultimo = None
    for servidor in OVERPASS:
        try:
            datos = json.loads(descargar(servidor, post={'data': consulta}, intentos=2, timeout=180))
            if datos.get('elements') is not None:
                return datos
        except Exception as error:  # 504 o 429 de un servidor saturado, o una respuesta que no es JSON: se prueba el siguiente
            ultimo = error
    raise RuntimeError(f'Ningún servidor de Overpass respondió: {ultimo}')


def hospedajes(t, terr):
    tipos = '|'.join(HOSPEDAJES)
    s, o, n, e = BBOX
    datos = overpass(f'[out:json][timeout:25];nwr["tourism"~"^({tipos})$"]({s},{o},{n},{e});out center tags;')
    corte = (datos.get('osm3s') or {}).get('timestamp_osm_base', '')[:10] or hoy().isoformat()
    consulta_url = 'https://overpass-turbo.eu/?Q=' + urllib.parse.quote(
        f'nwr["tourism"~"^({tipos})$"]({s},{o},{n},{e});out center;')
    fuente = t.fuente('osm-hospedajes', 'Hoteles, hostales y otros hospedajes mapeados en OpenStreetMap',
                      'Colaboradores de OpenStreetMap (ODbL)', consulta_url)
    limites = [f for f in json.loads((DIR_GEO / 'comunas.geojson').read_text(encoding='utf-8'))['features']
               if f['properties'].get('CODIGO') in terr.filas]
    arbol = shapely.STRtree([shape(f['geometry']) for f in limites])

    capa, por_tipo, por_comuna = [], collections.Counter(), collections.Counter()
    for el in datos['elements']:
        lat = el.get('lat', (el.get('center') or {}).get('lat'))
        lon = el.get('lon', (el.get('center') or {}).get('lon'))
        tipo = HOSPEDAJES.get(el['tags'].get('tourism'))
        if lat is None or lon is None or not tipo:
            continue
        dentro = arbol.query(shapely.Point(lon, lat), predicate='within')
        if not len(dentro):
            continue  # la caja cubre también parte de Bello, Envigado e Itagüí
        codigo = limites[dentro[0]]['properties']['CODIGO']
        tags = el['tags']
        capa.append(punto(lon, lat, {k: v for k, v in {'nombre': tags.get('name'), 'tipo': tipo,
                                                       'estrellas': tags.get('stars'), 'web': tags.get('website')}.items() if v}))
        por_tipo[tipo] += 1
        por_comuna[codigo] += 1
    if not capa:
        raise RuntimeError('OpenStreetMap no devolvió hospedajes dentro de Medellín')
    guardar_capa('turismo_hospedajes', capa)
    vigencia = f'OpenStreetMap al {corte}'
    nota = ('OpenStreetMap es un mapa colaborativo: cuenta lo que sus colaboradores han mapeado, no el Registro Nacional '
            'de Turismo. Incluye hoteles, hostales, casas de huéspedes, apartamentos turísticos y moteles.')
    t.cifra('hospedajes_osm', len(capa), 'hospedajes', 'Hospedajes mapeados en OpenStreetMap', fuente, vigencia, nota=nota)
    t.lista('hospedajes_por_tipo', [{'tipo': k, 'hospedajes': v} for k, v in por_tipo.most_common()])
    terr.indicador('hospedajes_osm', 'Hospedajes en OpenStreetMap', 'hospedajes', fuente, vigencia, nota=nota)
    for codigo in terr.filas:
        terr.valor(codigo, 'hospedajes_osm', 'vigente', por_comuna.get(codigo, 0))


# ---------------------------------------------------------------- principal

LISTAS = {'mincit-extranjeros': ['paises_origen'], 'medata-ocupacion-hotelera': ['ocupacion_por_zona'],
          'medata-museos': ['museos_por_lugar'], 'medata-sitios': ['sitios_por_lugar'],
          'alcaldia-turismo': ['atractivos_por_tipo'], 'osm-hospedajes': ['hospedajes_por_tipo']}


def main():
    t = Tema('turismo', 'Turismo')
    terr = Territorios()
    with t.bloque('mincit-extranjeros'):
        extranjeros(t)
    with t.bloque('aerocivil-origen-destino'):
        aeropuerto(t)
    with t.bloque('medata-ocupacion-hotelera'):
        ocupacion(t)
    with t.bloque('medata-museos'):
        visitas(t, 'medata-museos', 'Visitantes a museos', MUSEOS, 'mus', 'museos')
    with t.bloque('medata-sitios'):
        visitas(t, 'medata-sitios', 'Visitantes a sitios de interés', SITIOS, 'sit', 'sitios')
    with t.bloque('alcaldia-turismo'):
        atractivos(t, terr)
    with t.bloque('osm-hospedajes'):
        hospedajes(t, terr)

    for fuente in t.fallos:
        terr.heredar(t.previo, fuente)
        for clave in LISTAS.get(fuente, []):
            if t.previo and clave in t.previo['listas']:
                t.lista(clave, t.previo['listas'][clave])
    terr.escribir(t)
    t.escribir()
    return t


if __name__ == '__main__':
    main()
