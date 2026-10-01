"""Territorio y cultura: amenazas y zonas de riesgo del POT, usos del suelo, tratamientos y altura normativa, patrimonio,
equipamientos (bibliotecas, sedes educativas y equipamientos del POT), espacio verde urbano y espacio público efectivo.

Requiere haber corrido antes pull_gemelo (usa public/data/geo/comunas.geojson y datos/crudos/construcciones_puntos.csv
para contar las construcciones expuestas) y pull_demografia (población de cada territorio para los m² por habitante).

Genera, además del tema `territorio`, las capas del gemelo cultura_patrimonio, cultura_bibliotecas y educacion_sedes
en public/data/geo/capas/.

Las cifras por territorio se calculan cruzando geometrías: el área de cada polígono que cae dentro de cada comuna o
corregimiento, y cada construcción, bien o sede por el punto donde está. Son cifras `derivado`.
"""

import collections
import csv
import datetime as dt
import json
import re

import shapely
from shapely.geometry import shape

from lago import RAIZ, Tema, Territorios, arcgis, arcgis_geojson, consulta_arcgis, json_url
from pull_lentes import guardar_capa, limpiar, metros, territorios

ALC = 'https://www.medellin.gov.co/servidormapas/rest/services'
RIESGO = f'{ALC}/ambiente_dllo_sost/VC_Gestion_Riesgo/MapServer'
# VM_23_Uso_General_Suelo_Urbano/2 publica la misma capa, pero responde 400 cuando se le piden geometrías.
USOS = f'{ALC}/ordenamiento_ter/VM_POT48_Tematicos/MapServer/5'
TRATAMIENTOS = f'{ALC}/ordenamiento_ter/VM_22_Tratamientos_Urbanos/MapServer/0'
POT_2025 = f'{ALC}/ordenamiento_ter/VM_34_POT_2025/MapServer'
BIC = f'{ALC}/cultura/VC_BIC_Patrimonial/MapServer/0'
BIBLIOTECAS = f'{ALC}/cultura/VM_Red_Bibliotecas/MapServer/0'
SEDES = f'{ALC}/educacion/VC_Sedes/MapServer/0'
EQUIPAMIENTOS = 'https://portalidem.metropol.gov.co/server/rest/services/DISTRITO_MEDELLIN_POT/MapServer/7'
ARBOL = f'{ALC}/ambiente_dllo_sost/VA_SistemaArbolUrbano_Base/MapServer'  # 5: espacio verde urbano; 4: límites
ESPACIO_PUBLICO = f'{ALC}/ordenamiento_ter/VM_Espacio_Publico/MapServer/0'

PUNTOS = RAIZ / 'datos' / 'crudos' / 'construcciones_puntos.csv'
DEMOGRAFIA = RAIZ / 'public' / 'data' / 'lago' / 'demografia.json'
POT = 'POT (Acuerdo 48 de 2014)'
MESES = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre')

# Capas de VC_Gestion_Riesgo: (nombre, capa de amenaza, capa de zonas de riesgo). La capa de inundaciones de
# VM_06_Amenazas_Inundaciones ya no se publica (el servicio solo trae la de avenidas torrenciales); este servicio
# reúne las tres amenazas del POT y sus zonas de riesgo.
AMENAZAS = {'masa': ('Movimientos en masa', 2, 5), 'inundacion': ('Inundaciones', 1, 4), 'torrencial': ('Avenidas torrenciales', 0, 3)}
GRADOS = ('Alta', 'Media', 'Baja', 'Muy Baja')
NOTA_CONSTRUCCION = 'Construcciones del catastro cuyo punto representativo cae dentro del polígono.'


def miles(n):
    return f'{n:,.0f}'.replace(',', '.')


def fecha_ms(valor):
    """Las capas dan sus fechas en milisegundos o, las de tipo DateOnly, como texto ISO ('2014-12-17')."""
    if isinstance(valor, str):
        return dt.date.fromisoformat(valor[:10])
    return dt.datetime.fromtimestamp(valor / 1000, dt.timezone.utc).date()


def texto_fecha(d):
    return f'{d.day} de {MESES[d.month - 1]} de {d.year}'


def ha(geom):
    return metros(geom).area / 1e4


# ---------------------------------------------------------------- geometría compartida

class Cruce:
    """Límites de los 21 territorios y construcciones del catastro, para ubicar puntos y recortar polígonos."""

    def __init__(self, terr):
        self.geo = {c: ter for c, ter in territorios().items() if c in terr.filas}
        self.codigos = list(self.geo)
        self.arbol = shapely.STRtree([self.geo[c]['geom'] for c in self.codigos])
        self._construcciones = None

    def ubicar(self, geoms):
        """Código del territorio donde cae cada punto (o el punto representativo de cada polígono); None si cae fuera."""
        puntos = [g if g.geom_type == 'Point' else g.representative_point() for g in geoms]
        salida = [None] * len(puntos)
        if puntos:
            ip, it = self.arbol.query(puntos, predicate='within')
            for i, j in zip(ip, it):
                salida[i] = self.codigos[j]
        return salida

    def construcciones(self):
        """Puntos de las construcciones del catastro (los genera pull_gemelo) y su territorio."""
        if self._construcciones is None:
            if not PUNTOS.exists():
                raise RuntimeError(f'Falta {PUNTOS.name}: corre antes pull_gemelo')
            xs, ys, ks = [], [], []
            with PUNTOS.open(encoding='utf-8') as archivo:
                for fila in csv.DictReader(archivo):
                    xs.append(float(fila['x']))
                    ys.append(float(fila['y']))
                    ks.append(fila['k'])
            puntos = shapely.points(xs, ys)
            self._construcciones = (puntos, ks, shapely.STRtree(puntos))
        return self._construcciones

    def dentro(self, poligonos):
        """Índices de las construcciones que caen dentro de alguno de los polígonos."""
        if not poligonos:
            return set()
        _, _, arbol = self.construcciones()
        _, ip = arbol.query(poligonos, predicate='contains')
        return set(ip.tolist())

    def area_por_territorio(self, geom):
        """Hectáreas de una geometría dentro de cada territorio."""
        return {c: ha(ter['geom'].intersection(geom)) for c, ter in self.geo.items() if ter['geom'].intersects(geom)}


def poligonos(capa, campos, simplificar=0.00001):
    """Polígonos de una capa, simplificados aquí (~1 m por defecto). Pedirle al servidor de la Alcaldía que los generalice
    (maxAllowableOffset) multiplica por veinte el tiempo de cada página."""
    salida = []
    for f in arcgis_geojson(capa, campos)['features']:
        if f.get('geometry'):
            g = shape(f['geometry'])
            if simplificar:
                g = g.simplify(simplificar)
            salida.append((g if g.is_valid else shapely.make_valid(g), f['properties']))
    return salida


def puntos_capa(capa, campos):
    return [(shape(f['geometry']), f['properties']) for f in arcgis_geojson(capa, campos)['features'] if f.get('geometry')]


def punto_geojson(geom, props):
    p = geom if geom.geom_type == 'Point' else geom.representative_point()
    return {'type': 'Feature', 'properties': props, 'geometry': {'type': 'Point', 'coordinates': [round(p.x, 6), round(p.y, 6)]}}


def poblacion():
    """Población del último año de cada territorio, del tema demografia (proyecciones del DANE)."""
    if not DEMOGRAFIA.exists():
        raise RuntimeError('Falta demografia.json: corre antes pull_demografia')
    datos = json.loads(DEMOGRAFIA.read_text(encoding='utf-8'))
    salida, anios = {}, set()
    for fila in datos['listas'].get('territorios', []):
        serie = fila['valores'].get('poblacion') or {}
        if serie:
            anio = max(serie)
            salida[fila['codigo']] = serie[anio]
            anios.add(anio)
    return salida, max(anios)


# ---------------------------------------------------------------- amenazas y riesgo

def amenazas(t, terr, cruce):
    fuente = t.fuente('alc-gestion-riesgo', 'Amenazas y zonas de riesgo por movimientos en masa, inundaciones y avenidas torrenciales',
                      'Alcaldía de Medellín · capas protocolizadas del POT (Acuerdo 48 de 2014)', RIESGO)
    capas = {clave: (poligonos(f'{RIESGO}/{a}', 'grado_amenaza,fecha_actualizacion'),
                     poligonos(f'{RIESGO}/{r}', 'nombre,riesgo,fecha_actualizacion'))
             for clave, (_, a, r) in AMENAZAS.items()}
    # Vigencia real: la fecha de actualización más reciente que traen los polígonos, no la del servicio.
    fechas = [p['fecha_actualizacion'] for a, r in capas.values() for _, p in a + r if p.get('fecha_actualizacion')]
    ultima = max(fecha_ms(f) for f in fechas)
    vigencia, anio = f'{POT}, capas actualizadas al {texto_fecha(ultima)}', ultima.year
    _, codigos, _ = cruce.construcciones()

    por_grado, arnm, geoms_alta, expuestas = [], [], [], set()
    for clave, (nombre, _, _) in AMENAZAS.items():
        amenaza, riesgos = capas[clave]
        for grado in GRADOS:
            del_grado = [g for g, p in amenaza if p.get('grado_amenaza') == grado]
            if del_grado:
                por_grado.append({'amenaza': nombre, 'grado': grado, 'zonas': len(del_grado),
                                  'hectareas': round(sum(ha(g) for g in del_grado), 1)})
        alta = [g for g, p in amenaza if p.get('grado_amenaza') == 'Alta']
        union = shapely.union_all(alta)
        geoms_alta.append(union)
        area = cruce.area_por_territorio(union)
        indices = cruce.dentro(alta)
        expuestas |= indices
        conteo = collections.Counter(codigos[i] for i in indices)
        etiqueta = nombre.lower()
        terr.indicador(f'ha_amenaza_alta_{clave}', f'Área en amenaza alta por {etiqueta}', 'ha', fuente, vigencia,
                       estado='derivado', decimales=1, nota='Área de los polígonos de amenaza alta que cae dentro del territorio.')
        terr.indicador(f'construcciones_amenaza_alta_{clave}', f'Construcciones en amenaza alta por {etiqueta}', 'construcciones',
                       fuente, vigencia, estado='derivado', nota=NOTA_CONSTRUCCION)
        for codigo in terr.filas:
            terr.valor(codigo, f'ha_amenaza_alta_{clave}', anio, round(area.get(codigo, 0), 1))
            terr.valor(codigo, f'construcciones_amenaza_alta_{clave}', anio, conteo[codigo])
        t.cifra(f'ha_amenaza_alta_{clave}', round(sum(area.values())), 'ha', f'Área en amenaza alta por {etiqueta}', fuente,
                vigencia, estado='derivado')
        t.cifra(f'construcciones_amenaza_alta_{clave}', len(indices), 'construcciones',
                f'Construcciones en amenaza alta por {etiqueta}', fuente, vigencia, estado='derivado', nota=NOTA_CONSTRUCCION)
        arnm += [(g, p, nombre) for g, p in riesgos if (p.get('riesgo') or '').lower() == 'alto riesgo no mitigable']

    area_alta = cruce.area_por_territorio(shapely.union_all(geoms_alta))
    conteo = collections.Counter(codigos[i] for i in expuestas)
    terr.indicador('pct_amenaza_alta', 'Área del territorio en amenaza alta', '% del área', fuente, vigencia, estado='derivado',
                   decimales=1, nota='Cualquiera de las tres amenazas; un área con dos amenazas altas cuenta una vez.')
    terr.indicador('construcciones_amenaza_alta', 'Construcciones en amenaza alta', 'construcciones', fuente, vigencia,
                   estado='derivado', nota=f'Cualquiera de las tres amenazas; una construcción expuesta a dos cuenta una vez. {NOTA_CONSTRUCCION}')
    for codigo, ter in cruce.geo.items():
        terr.valor(codigo, 'pct_amenaza_alta', anio, round(area_alta.get(codigo, 0) / (ter['area_km2'] * 100) * 100, 1))
        terr.valor(codigo, 'construcciones_amenaza_alta', anio, conteo[codigo])
    t.cifra('construcciones_amenaza_alta', len(expuestas), 'construcciones', 'Construcciones en zonas de amenaza alta', fuente,
            vigencia, estado='derivado', ancla=True,
            nota=f'Construcciones del catastro en amenaza alta por movimientos en masa, inundaciones o avenidas torrenciales; '
                 f'una construcción expuesta a dos amenazas cuenta una vez. El catastro tiene {miles(len(codigos))} construcciones.')
    t.cifra('ha_amenaza_alta', round(sum(area_alta.values())), 'ha', 'Área en amenaza alta (cualquier tipo)', fuente, vigencia,
            estado='derivado', nota='Un área con dos amenazas altas cuenta una vez.')

    geoms_arnm = [g for g, _, _ in arnm]
    area_arnm = cruce.area_por_territorio(shapely.union_all(geoms_arnm))
    expuestas_arnm = cruce.dentro(geoms_arnm)
    conteo = collections.Counter(codigos[i] for i in expuestas_arnm)
    terr.indicador('ha_riesgo_no_mitigable', 'Área en alto riesgo no mitigable', 'ha', fuente, vigencia, estado='derivado', decimales=1)
    terr.indicador('construcciones_riesgo_no_mitigable', 'Construcciones en alto riesgo no mitigable', 'construcciones', fuente,
                   vigencia, estado='derivado', nota=NOTA_CONSTRUCCION)
    for codigo in terr.filas:
        terr.valor(codigo, 'ha_riesgo_no_mitigable', anio, round(area_arnm.get(codigo, 0), 1))
        terr.valor(codigo, 'construcciones_riesgo_no_mitigable', anio, conteo[codigo])
    t.cifra('zonas_riesgo_no_mitigable', len(arnm), 'zonas', 'Zonas de alto riesgo no mitigable', fuente, vigencia,
            nota='Por ' + ', '.join(f'{n.lower()}: {sum(1 for _, _, x in arnm if x == n)}' for n, _, _ in AMENAZAS.values()) + '.')
    t.cifra('ha_riesgo_no_mitigable', round(sum(area_arnm.values()), 1), 'ha', 'Área en alto riesgo no mitigable', fuente,
            vigencia, estado='derivado', decimales=1)
    t.cifra('construcciones_riesgo_no_mitigable', len(expuestas_arnm), 'construcciones',
            'Construcciones en alto riesgo no mitigable', fuente, vigencia, estado='derivado', nota=NOTA_CONSTRUCCION)
    t.lista('amenaza_por_grado', por_grado)
    ubicados = cruce.ubicar(geoms_arnm)
    t.lista('riesgo_no_mitigable', sorted(
        [{'nombre': (p.get('nombre') or 'Sin nombre').strip(), 'amenaza': n, 'hectareas': round(ha(g), 2),
          'territorio': terr.filas[c]['nombre'] if c else '—'} for (g, p, n), c in zip(arnm, ubicados)],
        key=lambda z: -z['hectareas']))


# ---------------------------------------------------------------- usos del suelo, tratamientos y altura normativa

def fecha_pot(filas):
    fechas = [fecha_ms(p['fecha_adopcion']) for _, p in filas if p.get('fecha_adopcion')]
    return f'{POT}, adoptado el {texto_fecha(max(fechas))}' if fechas else POT


def usos_suelo(t, terr, cruce):
    fuente = t.fuente('alc-usos-suelo', 'Usos generales del suelo urbano', 'Departamento Administrativo de Planeación · Alcaldía de Medellín',
                      USOS)
    filas = poligonos(USOS, 'areagraluso,fecha_adopcion', simplificar=0.00002)
    vigencia = fecha_pot(filas)
    ubicados = cruce.ubicar([g for g, _ in filas])
    por_territorio = collections.defaultdict(lambda: collections.defaultdict(float))
    total = collections.defaultdict(float)
    for (g, p), codigo in zip(filas, ubicados):
        uso = (p.get('areagraluso') or 'Sin categoría').strip()
        area = ha(g)
        total[uso] += area
        if codigo:
            por_territorio[codigo][uso] += area
    categorias = sorted(total, key=lambda u: -total[u])
    t.lista('usos_suelo', [{'uso': u, 'hectareas': round(total[u], 1)} for u in categorias])
    t.lista('usos_por_territorio', [{'codigo': c, 'nombre': terr.filas[c]['nombre'],
                                     **{u: round(por_territorio[c].get(u, 0), 1) for u in categorias}}
                                    for c in sorted(por_territorio)])
    urbano = sum(total.values())
    residencial = total.get('Áreas de baja mixtura', 0)
    t.cifra('ha_suelo_urbano_usos', round(urbano), 'ha', 'Suelo urbano con uso general asignado', fuente, vigencia,
            estado='derivado', nota=f'{len(filas):,} polígonos en {len(categorias)} categorías.'.replace(',', '.'))
    t.cifra('pct_baja_mixtura', round(residencial / urbano * 100, 1), '%', 'Suelo urbano en áreas de baja mixtura',
            fuente, vigencia, estado='derivado', decimales=1,
            nota='Áreas predominantemente residenciales, sobre el suelo urbano con uso general asignado.')


def tratamientos(t):
    fuente = t.fuente('alc-tratamientos', 'Tratamientos urbanos y altura normativa', 'Departamento Administrativo de Planeación · Alcaldía de Medellín',
                      TRATAMIENTOS)
    filas = poligonos(TRATAMIENTOS, 'tratamiento,alturanormativa,fecha_adopcion', simplificar=0.00002)
    vigencia = fecha_pot(filas)
    por_tratamiento, por_altura = collections.defaultdict(lambda: [0, 0.0]), collections.defaultdict(lambda: [0, 0.0])
    for g, p in filas:
        area = ha(g)
        for acumulado, clave in ((por_tratamiento, p.get('tratamiento')), (por_altura, p.get('alturanormativa'))):
            acumulado[(clave or 'Sin dato').strip()][0] += 1
            acumulado[(clave or 'Sin dato').strip()][1] += area
    t.lista('tratamientos', [{'tratamiento': k, 'poligonos': n, 'hectareas': round(a, 1)}
                             for k, (n, a) in sorted(por_tratamiento.items(), key=lambda x: -x[1][1])])

    def orden(altura):
        # Numéricas primero, de menor a mayor; luego "Variable n" y al final "N/A".
        m = re.fullmatch(r'\d+', altura)
        return (0, int(altura)) if m else (1, altura) if altura.startswith('Variable') else (2, altura)

    t.lista('altura_normativa', [{'altura': k, 'poligonos': n, 'hectareas': round(a, 1)}
                                 for k, (n, a) in sorted(por_altura.items(), key=lambda x: orden(x[0]))])
    total = sum(a for _, a in por_tratamiento.values())
    t.cifra('poligonos_tratamiento', len(filas), 'polígonos', 'Polígonos de tratamiento urbano', fuente, vigencia,
            nota=f'{len(por_tratamiento)} tratamientos sobre {miles(total)} ha de suelo urbano y de expansión.')
    numericas = sum(a for k, (_, a) in por_altura.items() if k.isdigit())
    t.cifra('pct_altura_numerica', round(numericas / total * 100, 1), '%', 'Suelo con altura normativa en pisos', fuente,
            vigencia, estado='derivado', decimales=1,
            nota='El resto tiene altura "Variable" o no aplica (N/A), por ejemplo en áreas de preservación de infraestructura.')


def pot_2025(t):
    fuente = t.fuente('alc-pot-2025', 'Capa "POT 2025" (mapa provisional de la revisión de mediano plazo)',
                      'Departamento Administrativo de Planeación · Alcaldía de Medellín', POT_2025, estado='declarado')
    servicio = json_url(POT_2025, {'f': 'json'})
    descripcion = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', servicio.get('serviceDescription') or '')).strip()
    if 'provisional' not in descripcion.lower() or '48' not in descripcion:
        raise RuntimeError(f'La descripción de la capa POT 2025 cambió; revisar su estado normativo: {descripcion[:200]}')
    t.cifra('pot_vigente', 'Acuerdo 48 de 2014', '', 'POT vigente', fuente, f'Consultado el {texto_fecha(dt.date.today())}',
            estado='declarado',
            nota='La capa "POT 2025" es un mapa provisional con las capas del Acuerdo 48 de 2014 que no cambian en la '
                 'revisión de mediano plazo; no es un POT nuevo. Descripción del servicio: ' + descripcion)


# ---------------------------------------------------------------- patrimonio y equipamientos

def contar(terr, cruce, clave, etiqueta, unidad, fuente, vigencia, anio, geoms, filtro=None, nota=None):
    ubicados = cruce.ubicar(geoms)
    conteo = collections.Counter(c for c, g in zip(ubicados, geoms) if c and (filtro is None or filtro(g)))
    terr.indicador(clave, etiqueta, unidad, fuente, vigencia, nota=nota)
    for codigo in terr.filas:
        terr.valor(codigo, clave, anio, conteo[codigo])
    return ubicados


def patrimonio(t, terr, cruce):
    fuente = t.fuente('alc-bic', 'Bienes de interés cultural (BIC)', 'Secretaría de Cultura Ciudadana · Alcaldía de Medellín', BIC)
    filas = poligonos(BIC, 'grupo,subgrupo,tipo,nombre,direccion,nombre_sector,fecha_actualizacion', simplificar=None)
    ultima = max(fecha_ms(p['fecha_actualizacion']) for _, p in filas if p.get('fecha_actualizacion'))
    vigencia = f'Listado del {POT}, actualizado al {texto_fecha(ultima)}'
    ubicados = contar(terr, cruce, 'bic', 'Bienes de interés cultural', 'bienes', fuente, vigencia, ultima.year,
                      [g for g, _ in filas], nota='Cada bien se ubica por el punto representativo de su polígono.')
    # "Arquitectonico" sin tilde es el mismo grupo que "Arquitectónico".
    grupo = lambda p: (p.get('grupo') or 'Sin grupo').strip().replace('Arquitectonico', 'Arquitectónico')
    t.cifra('bic', len(filas), 'bienes', 'Bienes de interés cultural', fuente, vigencia, ancla=True,
            nota=', '.join(f'{k}: {v}' for k, v in collections.Counter(grupo(p) for _, p in filas).most_common()) + '.')
    t.lista('bic_por_grupo', [{'grupo': k, 'bienes': v} for k, v in collections.Counter(grupo(p) for _, p in filas).most_common()])
    t.lista('bic', sorted([{'nombre': (p.get('nombre') or 'Sin nombre').strip(), 'grupo': grupo(p),
                            'tipo': (p.get('tipo') or '').strip().replace('N.A', '') or (p.get('subgrupo') or '').strip(),
                            'direccion': (p.get('direccion') or '').strip(), 'sector': (p.get('nombre_sector') or '').strip(),
                            'territorio': terr.filas[c]['nombre'] if c else '—'}
                           for (_, p), c in zip(filas, ubicados)], key=lambda b: (b['territorio'], b['nombre'])))
    guardar_capa('cultura_patrimonio', [punto_geojson(g, limpiar(p, {'nombre': 'nombre', 'grupo': 'grupo', 'tipo': 'tipo',
                                                                     'direccion': 'direccion', 'nombre_sector': 'sector'}))
                                        for g, p in filas])


def bibliotecas(t, terr, cruce):
    fuente = t.fuente('alc-bibliotecas', 'Red de Bibliotecas de Medellín', 'Secretaría de Cultura Ciudadana · Alcaldía de Medellín',
                      BIBLIOTECAS)
    filas = puntos_capa(BIBLIOTECAS, 'nombre,tipo,barrio,ubicacion,horario')
    vigencia = 'Red vigente'
    ubicados = contar(terr, cruce, 'bibliotecas', 'Bibliotecas de la Red', 'bibliotecas', fuente, vigencia, dt.date.today().year,
                      [g for g, _ in filas])
    tipo = lambda p: (p.get('tipo') or 'Sin tipo').strip().capitalize()
    t.cifra('bibliotecas', len(filas), 'bibliotecas', 'Bibliotecas de la Red de Bibliotecas', fuente, vigencia,
            nota=', '.join(f'{k}: {v}' for k, v in collections.Counter(tipo(p) for _, p in filas).most_common()) + '.')
    t.lista('bibliotecas', sorted([{'nombre': (p.get('nombre') or '').strip(), 'tipo': tipo(p), 'barrio': (p.get('barrio') or '').strip(),
                                    'territorio': terr.filas[c]['nombre'] if c else '—'} for (_, p), c in zip(filas, ubicados)],
                                  key=lambda b: (b['tipo'], b['nombre'])))
    guardar_capa('cultura_bibliotecas', [punto_geojson(g, {**limpiar(p, {'nombre': 'nombre', 'ubicacion': 'direccion', 'horario': 'horario'}),
                                                           'tipo': tipo(p)}) for g, p in filas])


def sedes(t, terr, cruce, pob, anio_pob):
    fuente = t.fuente('alc-sedes-educativas', 'Sedes educativas', 'Secretaría de Educación · Alcaldía de Medellín', SEDES)
    filas = puntos_capa(SEDES, 'sede_educa,nombre_est,sector,clasificac,vigencia,direccion,estado')
    filas = [(g, p) for g, p in filas if (p.get('estado') or 'Activo') == 'Activo']
    anios = sorted({str(p.get('vigencia')) for _, p in filas if p.get('vigencia')})
    vigencia = f'Directorio {anios[-1]}' if anios else 'Directorio vigente'
    anio = anios[-1] if anios else dt.date.today().year
    geoms = [g for g, _ in filas]
    oficial = {id(g) for g, p in filas if p.get('sector') == 'Oficial'}
    contar(terr, cruce, 'sedes_educativas', 'Sedes educativas', 'sedes', fuente, vigencia, anio, geoms,
           nota='Sedes activas de colegios oficiales y privados (educación preescolar, básica y media).')
    ubicados = contar(terr, cruce, 'sedes_oficiales', 'Sedes educativas oficiales', 'sedes', fuente, vigencia, anio, geoms,
                      filtro=lambda g: id(g) in oficial)
    conteo = collections.Counter(c for c in ubicados if c)
    terr.indicador('sedes_por_10mil', 'Sedes educativas por 10.000 habitantes', 'sedes/10.000 hab.', fuente,
                   f'{vigencia}; población {anio_pob}', estado='derivado', decimales=1,
                   nota=f'Sedes activas sobre la población proyectada por el DANE para {anio_pob}.')
    for codigo in terr.filas:
        if pob.get(codigo):
            terr.valor(codigo, 'sedes_por_10mil', anio, round(conteo[codigo] / pob[codigo] * 1e4, 1))
    sector = collections.Counter((p.get('sector') or 'Sin dato') for _, p in filas)
    t.cifra('sedes_educativas', len(filas), 'sedes', 'Sedes educativas activas', fuente, vigencia,
            nota=', '.join(f'{k}: {v}' for k, v in sector.most_common()) + '.')
    t.lista('sedes_por_clasificacion', [{'clasificacion': k, 'sedes': v} for k, v in
                                        collections.Counter((p.get('clasificac') or 'Sin dato') for _, p in filas).most_common()])
    guardar_capa('educacion_sedes', [punto_geojson(g, limpiar(p, {'sede_educa': 'nombre', 'nombre_est': 'establecimiento',
                                                                  'sector': 'sector', 'direccion': 'direccion'})) for g, p in filas])


def equipamientos(t, terr, cruce, pob, anio_pob):
    fuente = t.fuente('idem-pot-equipamientos', 'Equipamientos del POT', 'Área Metropolitana del Valle de Aburrá · Portal IDEM (POT de Medellín)',
                      EQUIPAMIENTOS)
    filas = puntos_capa(EQUIPAMIENTOS, 'NOMBRE,COMPONENTES')
    vigencia = f'{POT}, capa vigente'
    anio = dt.date.today().year
    ubicados = contar(terr, cruce, 'equipamientos', 'Equipamientos del POT', 'equipamientos', fuente, vigencia, anio,
                      [g for g, _ in filas])
    conteo = collections.Counter(c for c in ubicados if c)
    terr.indicador('equipamientos_por_10mil', 'Equipamientos del POT por 10.000 habitantes', 'equip./10.000 hab.', fuente,
                   f'{vigencia}; población {anio_pob}', estado='derivado', decimales=1,
                   nota=f'Equipamientos sobre la población proyectada por el DANE para {anio_pob}.')
    for codigo in terr.filas:
        if pob.get(codigo):
            terr.valor(codigo, 'equipamientos_por_10mil', anio, round(conteo[codigo] / pob[codigo] * 1e4, 1))
    componente = lambda p: (p.get('COMPONENTES') or 'Sin componente').strip()
    t.cifra('equipamientos', len(filas), 'equipamientos', 'Equipamientos del POT', fuente, vigencia,
            nota='Educación, salud, recreación y deporte, cultura, comunitarios, asistencia social y otros.')
    t.lista('equipamientos_por_componente', [{'componente': k, 'equipamientos': v}
                                             for k, v in collections.Counter(componente(p) for _, p in filas).most_common()])


# ---------------------------------------------------------------- espacio verde y espacio público

def espacio_verde(t, terr, pob, anio_pob):
    fuente = t.fuente('amva-espacio-verde', 'Espacio verde urbano (EVU) del Sistema Árbol Urbano',
                      'Área Metropolitana del Valle de Aburrá y Universidad Nacional (Alcaldía de Medellín)', f'{ARBOL}/5')
    # La capa cubre todo el Valle de Aburrá y no dice en qué municipio está cada polígono. Traer sus 195.000 geometrías
    # es lento, así que se leen solo los atributos (área y coordenadas del centro, en MAGNA-SIRGAS Bogotá, EPSG:3116)
    # y se ubican en los límites de las comunas y corregimientos de la misma capa base, pedidos en ese sistema.
    limites = consulta_arcgis(f'{ARBOL}/4', {'where': "limitemunicipioid = '001'", 'outFields': 'codigo', 'outSR': 3116,
                                             'f': 'geojson'})
    codigos = [f['properties']['codigo'] for f in limites['features']]
    faltan = set(terr.filas) - set(codigos)
    if faltan:
        raise RuntimeError(f'Los límites de la capa base no traen los territorios {sorted(faltan)}')
    arbol = shapely.STRtree([shape(f['geometry']) for f in limites['features']])
    filas = arcgis(f'{ARBOL}/5', campos='area_ha,coord_x_mb,coord_y_mb,propiedad')
    filas = [f for f in filas if f.get('coord_x_mb') and f.get('area_ha')]
    ip, it = arbol.query(shapely.points([f['coord_x_mb'] for f in filas], [f['coord_y_mb'] for f in filas]), predicate='within')
    total, publico = collections.defaultdict(float), collections.defaultdict(float)
    for i, j in zip(ip, it):
        f, codigo = filas[i], codigos[j]
        if codigo not in terr.filas:
            continue
        total[codigo] += f['area_ha']
        if f.get('propiedad') in ('Publico', 'Fiscal'):
            publico[codigo] += f['area_ha']
    vigencia = 'Inventario de 2019 (ortofotos de 2016 a 2019)'
    nota = ('Incluye zonas verdes públicas y privadas: parques, retiros de quebrada, antejardines, separadores y zonas verdes '
            'de unidades residenciales, entre otras. Polígonos desde 4 m². El inventario cubre el suelo urbano: en los '
            'corregimientos solo aparecen las zonas verdes de sus centros poblados urbanos, si las hay.')
    terr.indicador('ha_espacio_verde', 'Espacio verde urbano', 'ha', fuente, vigencia, decimales=1, nota=nota)
    terr.indicador('m2_verde_hab', 'Espacio verde urbano por habitante', 'm²/hab.', fuente, f'{vigencia}; población {anio_pob}',
                   estado='derivado', decimales=1,
                   nota=f'Espacio verde de 2019 sobre la población proyectada por el DANE para {anio_pob}: los dos datos no son del mismo año. {nota}')
    terr.indicador('m2_verde_publico_hab', 'Espacio verde público por habitante', 'm²/hab.', fuente, f'{vigencia}; población {anio_pob}',
                   estado='derivado', decimales=1, nota='Solo los polígonos de propiedad pública o fiscal.')
    for codigo in terr.filas:
        terr.valor(codigo, 'ha_espacio_verde', 2019, round(total[codigo], 1))
        if pob.get(codigo):
            terr.valor(codigo, 'm2_verde_hab', 2019, round(total[codigo] * 1e4 / pob[codigo], 1))
            terr.valor(codigo, 'm2_verde_publico_hab', 2019, round(publico[codigo] * 1e4 / pob[codigo], 1))
    ha_total, ha_publico, habitantes = sum(total.values()), sum(publico.values()), sum(pob.values())
    t.cifra('ha_espacio_verde', round(ha_total), 'ha', 'Espacio verde urbano', fuente, vigencia,
            nota=f'{miles(ha_publico)} ha son de propiedad pública o fiscal. {nota}')
    t.cifra('m2_verde_hab', round(ha_total * 1e4 / habitantes, 1), 'm²/hab.', 'Espacio verde urbano por habitante', fuente,
            f'{vigencia}; población {anio_pob}', estado='derivado', decimales=1, ancla=True,
            nota=f'Espacio verde de 2019 sobre la población proyectada por el DANE para {anio_pob}.')
    t.cifra('m2_verde_publico_hab', round(ha_publico * 1e4 / habitantes, 1), 'm²/hab.', 'Espacio verde público por habitante',
            fuente, f'{vigencia}; población {anio_pob}', estado='derivado', decimales=1)


def espacio_publico(t, terr, pob, anio_pob):
    fuente = t.fuente('alc-espacio-publico', 'Inventario de espacio público de esparcimiento y encuentro (espacio público efectivo)',
                      'Departamento Administrativo de Planeación · Alcaldía de Medellín', ESPACIO_PUBLICO)
    servicio = json_url(ESPACIO_PUBLICO, {'f': 'json'})
    anio = re.search(r'vigencia (\d{4})', servicio.get('description') or '')
    if not anio:
        raise RuntimeError('La capa de espacio público ya no declara su vigencia en la descripción')
    anio = anio.group(1)
    vigencia = f'Inventario {anio}'
    datos = consulta_arcgis(ESPACIO_PUBLICO, {
        'where': '1=1', 'groupByFieldsForStatistics': 'cod_comuna', 'f': 'json',
        'outStatistics': json.dumps([{'statisticType': 'sum', 'onStatisticField': 'st_area(shape)', 'outStatisticFieldName': 'm2'}])})
    area = {f['attributes']['cod_comuna']: f['attributes']['m2'] for f in datos['features']}
    sin_comuna = sum(v for k, v in area.items() if k not in terr.filas)
    terr.indicador('m2_espacio_publico_hab', 'Espacio público efectivo por habitante', 'm²/hab.', fuente,
                   f'{vigencia}; población {anio_pob}', estado='derivado', decimales=1,
                   nota=f'Parques, plazas, plazoletas y zonas verdes públicas permanentes de la comuna o corregimiento, sobre la '
                        f'población proyectada por el DANE para {anio_pob}.')
    for codigo in terr.filas:
        if pob.get(codigo):
            terr.valor(codigo, 'm2_espacio_publico_hab', anio, round(area.get(codigo, 0) / pob[codigo], 1))
    total = sum(area.values())
    t.cifra('ha_espacio_publico', round(total / 1e4), 'ha', 'Espacio público efectivo', fuente, vigencia,
            nota=f'{miles(sin_comuna / 1e4)} ha no tienen comuna asignada en la fuente.' if sin_comuna else None)
    t.cifra('m2_espacio_publico_hab', round(total / sum(pob.values()), 1), 'm²/hab.', 'Espacio público efectivo por habitante',
            fuente, f'{vigencia}; población {anio_pob}', estado='derivado', decimales=1,
            nota=f'Inventario {anio} sobre la población proyectada por el DANE para {anio_pob}.')


# ---------------------------------------------------------------- principal

LISTAS = {'alc-gestion-riesgo': ['amenaza_por_grado', 'riesgo_no_mitigable'], 'alc-usos-suelo': ['usos_suelo', 'usos_por_territorio'],
          'alc-tratamientos': ['tratamientos', 'altura_normativa'], 'alc-bic': ['bic_por_grupo', 'bic'],
          'alc-bibliotecas': ['bibliotecas'], 'alc-sedes-educativas': ['sedes_por_clasificacion'],
          'idem-pot-equipamientos': ['equipamientos_por_componente']}


def main():
    t = Tema('territorio', 'Territorio y cultura')
    terr = Territorios()
    cruce = Cruce(terr)
    pob, anio_pob = poblacion()
    with t.bloque('alc-gestion-riesgo'):
        amenazas(t, terr, cruce)
    with t.bloque('alc-usos-suelo'):
        usos_suelo(t, terr, cruce)
    with t.bloque('alc-tratamientos'):
        tratamientos(t)
    with t.bloque('alc-pot-2025'):
        pot_2025(t)
    with t.bloque('alc-bic'):
        patrimonio(t, terr, cruce)
    with t.bloque('alc-bibliotecas'):
        bibliotecas(t, terr, cruce)
    with t.bloque('alc-sedes-educativas'):
        sedes(t, terr, cruce, pob, anio_pob)
    with t.bloque('idem-pot-equipamientos'):
        equipamientos(t, terr, cruce, pob, anio_pob)
    with t.bloque('amva-espacio-verde'):
        espacio_verde(t, terr, pob, anio_pob)
    with t.bloque('alc-espacio-publico'):
        espacio_publico(t, terr, pob, anio_pob)

    for fuente in t.fallos:
        # Lo que la fuente alcanzó a escribir antes de fallar se descarta y se hereda la ingesta anterior.
        for ind in [k for k, i in terr.indicadores.items() if i['fuente'] == fuente]:
            del terr.indicadores[ind]
            for fila in terr.filas.values():
                fila['valores'].pop(ind, None)
        terr.heredar(t.previo, fuente)
        for clave in LISTAS.get(fuente, []):
            t.listas.pop(clave, None)
            if t.previo and clave in t.previo['listas']:
                t.lista(clave, t.previo['listas'][clave])
    terr.escribir(t)
    t.escribir()
    return t


if __name__ == '__main__':
    main()
