"""Economía y vivienda: mercado laboral (GEIH del DANE), precios de oferta de vivienda (OIME), valor catastral del
suelo, licencias urbanísticas, establecimientos de Industria y Comercio y estructura empresarial (Cámara de Comercio).

Por territorio se guardan las listas `indicadores` y `territorios`, con el mismo contrato que Gente (ver
lago.Territorios), para la sección y, más adelante, el Atlas (#11).

Fuentes que miden cosas parecidas y **no se mezclan**: el registro de Industria y Comercio de la Alcaldía (contratos
activos del impuesto) y la estructura empresarial de la Cámara de Comercio (empresas matriculadas) cuentan unidades
distintas, con cortes distintos.
"""

import collections
import datetime as dt
import json
import math
import re
import statistics

import shapely
from shapely.geometry import mapping, shape

from lago import (MESES, RAIZ, Tema, Territorios, arcgis, arcgis_geojson, arcgis_por_ids, consulta_arcgis,
                  descargar, excel, existe, hoy, socrata)

ALC = 'https://www.medellin.gov.co/servidormapas/rest/services'
DIR_GEO = RAIZ / 'public' / 'data' / 'geo'
DIR_CAPAS = DIR_GEO / 'capas'
# Clave de año para fuentes que no publican su corte: el año de la consulta haría pasar el dato por uno de ese año.
SIN_ANIO = 'vigente'


def miles(n):
    return f'{n:,.0f}'.replace(',', '.')


# ---------------------------------------------------------------- mercado laboral (GEIH)

GEIH = 'https://www.dane.gov.co/files/operaciones/GEIH'
HOJA = 'Total 23 ciudades A.M. Trim'
CIUDAD = 'Medellín A.M.'
INDICADORES_GEIH = [
    # (clave, fila en el anexo, etiqueta, en el Panorama)
    ('desempleo', 'Tasa de Desocupación (TD)', 'Desempleo · Medellín A.M.', True),
    ('ocupacion', 'Tasa de Ocupación (TO)', 'Tasa de ocupación · Medellín A.M.', False),
    ('participacion', 'Tasa Global de Participación (TGP)', 'Participación laboral · Medellín A.M.', False),
    ('subocupacion', 'Tasa de Subocupación (TS)', 'Subocupación · Medellín A.M.', False),
]


def anexo_reciente():
    """El DANE publica cada mes un archivo anex-GEIH-<mes><año>.xlsx; se busca el más reciente hacia atrás."""
    fecha = hoy()
    for _ in range(6):
        url = f'{GEIH}/anex-GEIH-{MESES[fecha.month - 1]}{fecha.year}.xlsx'
        if existe(url):
            return url
        fecha = fecha.replace(day=1) - dt.timedelta(days=1)
    raise RuntimeError('No se encontró un anexo GEIH en los últimos 6 meses')


def etiqueta_trimestre(texto, anio):
    """Rótulo uniforme de un trimestre móvil del anexo: "Ene - Mar*" → "ene–mar 2020"; los que cruzan de año ya
    traen el suyo, "Nov 19 - Ene 20" → "nov 2019–ene 2020" (la columna los rotula con el año de inicio)."""
    partes = [p.strip() for p in re.split(r'\s*-\s*', texto.replace('*', '').strip().lower())]
    meses = [re.fullmatch(r'([a-z]{3})\s*(\d{2})?', p) for p in partes]
    if len(meses) != 2 or not all(meses):
        raise RuntimeError(f'Trimestre del anexo GEIH con un formato inesperado: {texto!r}')
    (m1, a1), (m2, a2) = meses[0].groups(), meses[1].groups()
    return f'{m1} 20{a1}–{m2} 20{a2}' if a1 and a2 else f'{m1}–{m2} {anio}'


def bloque_ciudad(hoja):
    """La hoja trimestral trae un bloque por ciudad: fila de años, fila de trimestres móviles y filas por indicador.
    Devuelve, por columna, el rótulo del trimestre y si el anexo lo marca con asterisco (nota de la pandemia)."""
    filas = [list(f) for f in hoja.iter_rows(values_only=True)]
    inicio = next(i for i, f in enumerate(filas) if f and isinstance(f[0], str) and f[0].strip() == CIUDAD)
    fila_anios = next(f for f in filas[inicio:] if f and f[0] == 'Concepto')
    fila_trim = filas[filas.index(fila_anios, inicio) + 1]
    # Los años solo aparecen en la primera columna de cada año: se arrastran hacia la derecha.
    etiquetas, marcadas, anio = [], set(), None
    for col, (a, trimestre) in enumerate(zip(fila_anios, fila_trim)):
        anio = a if isinstance(a, int) else anio
        etiquetas.append(etiqueta_trimestre(trimestre, anio) if col and trimestre else None)
        if col and trimestre and '*' in trimestre:
            marcadas.add(col)
    indicadores = {}
    for fila in filas[inicio:inicio + 40]:
        if fila and isinstance(fila[0], str):
            indicadores.setdefault(fila[0].strip(), fila)
    return etiquetas, marcadas, indicadores


def mercado_laboral(t):
    url = anexo_reciente()
    t.fuente('dane-geih', 'Gran Encuesta Integrada de Hogares · anexo 23 ciudades', 'DANE', url)
    etiquetas, marcadas, indicadores = bloque_ciudad(excel(descargar(url, timeout=180))[HOJA])
    for clave, fila_nombre, etiqueta, ancla in INDICADORES_GEIH:
        fila = indicadores[fila_nombre]
        # En los trimestres marcados con asterisco (mar–jul de 2020) el anexo pone 0 donde no pudo medir: según su
        # nota, "no fue posible obtener información de la población subocupada". Ese 0 es un hueco, no un dato.
        puntos = [[etiquetas[c], None if c in marcadas and v == 0 else round(v, 2)] for c, v in enumerate(fila)
                  if c and etiquetas[c] and isinstance(v, (int, float))]
        huecos = sum(1 for _, v in puntos if v is None)
        ultimo_periodo, ultimo_valor = puntos[-1]
        t.cifra(clave, ultimo_valor, '%', etiqueta, 'dane-geih', f'{ultimo_periodo} (trimestre móvil)',
                ancla=ancla, decimales=2)
        nota = (f'{huecos} trimestres de 2020 sin dato: por el cambio de operativo de la pandemia, el DANE no pudo '
                'medir la población subocupada entre marzo y julio de 2020.') if huecos else ''
        t.serie(f'{clave}_trimestral', puntos, '%', f'{etiqueta} (trimestre móvil)', 'dane-geih', nota=nota)


# ---------------------------------------------------------------- vivienda (OIME)

OIME = f'{ALC}/vivienda_ciudad_terri/VM_Oferta_Comercial_Oime/MapServer/0'
AREA_MIN, AREA_MAX = 20, 500   # m² de área privada; fuera de ese rango casi siempre es un error de captura
MIN_OFERTAS = 20               # por comuna o estrato; con menos, la mediana no se publica
ANIOS_VENTANA = 2              # años completos que se juntan para tener muestra en todas las comunas
NOTA_OIME = ('Mediana del precio de oferta por m² de área privada de apartamentos y casas, investigados por el '
             f'Catastro. Se excluyen los registros que el Catastro marca como atípicos y las áreas fuera de '
             f'{AREA_MIN}–{AREA_MAX} m². Pesos corrientes, sin ajustar por inflación. Es precio de oferta, no de cierre.')


def mediana(valores):
    return round(statistics.median(valores)) if valores else None


def vivienda(t, terr):
    t.fuente('oime-ofertas', 'Observatorio Inmobiliario de Medellín (OIME): ofertas de vivienda investigadas por el '
             'Catastro', 'Subsecretaría de Catastro · Alcaldía de Medellín', OIME)
    filas = arcgis(OIME, where="property_type IN ('APARTAMENTO','CASA')",
                   campos='anio,investigation_type,private_area,commercial_value,stratum,codigo_comuna,atypical')
    ofertas = [{'anio': f['anio'], 'tipo': f['investigation_type'], 'estrato': f['stratum'],
                'comuna': (f['codigo_comuna'] or '').strip(), 'm2': f['commercial_value'] / f['private_area']}
               for f in filas
               if not f['atypical'] and f['anio'] and f['commercial_value'] and f['commercial_value'] > 0
               and f['private_area'] and AREA_MIN <= f['private_area'] <= AREA_MAX]
    if not ofertas:
        raise RuntimeError('La OIME no devolvió ofertas de vivienda válidas')

    # Año completo: el último anterior al año en curso. El año en curso queda fuera de las medianas.
    completo = max(o['anio'] for o in ofertas if o['anio'] < hoy().year)
    ventana = list(range(completo - ANIOS_VENTANA + 1, completo + 1))
    periodo = f'{ventana[0]}–{ventana[-1]}'

    def valores(tipo, anios, **filtro):
        return [o['m2'] for o in ofertas if o['tipo'] == tipo and o['anio'] in anios
                and all(o[k] == v for k, v in filtro.items())]

    # Serie anual de ciudad: solo años con muestra amplia (2007 trae 16 registros).
    for tipo, clave, etiqueta, unidad in (('VENTA', 'venta_m2', 'Precio de oferta de vivienda por m²', '$/m²'),
                                          ('ARRENDAMIENTO', 'arriendo_m2', 'Arriendo de oferta de vivienda por m²',
                                           '$/m² al mes')):
        por_anio = {a: valores(tipo, [a]) for a in sorted({o['anio'] for o in ofertas}) if a <= completo}
        puntos = [[str(a), mediana(v)] for a, v in por_anio.items() if len(v) >= 100]
        t.serie(f'{clave}_anual', puntos, unidad, f'{etiqueta} (mediana por año)', 'oime-ofertas', nota=NOTA_OIME)
        ciudad = valores(tipo, ventana)
        t.cifra(clave, mediana(ciudad), unidad, etiqueta, 'oime-ofertas', periodo, ancla=clave == 'venta_m2',
                nota=f'{NOTA_OIME} {miles(len(ciudad))} ofertas en {periodo}.')

    venta, arriendo = t.cifras['venta_m2']['valor'], t.cifras['arriendo_m2']['valor']
    nota_rent = ('Arriendo mensual por m² × 12 ÷ precio de venta por m², con las medianas de oferta del mismo periodo. '
                 'Es un cociente de medianas, no la rentabilidad de un mismo inmueble, y no descuenta administración, '
                 'impuestos ni vacancia.')
    t.cifra('rentabilidad_bruta', round(arriendo * 12 / venta * 100, 2), '%', 'Rentabilidad bruta del arriendo',
            'oime-ofertas', periodo, estado='derivado', decimales=1, nota=nota_rent)

    # Por comuna y corregimiento.
    terr.indicador('venta_m2', 'Precio de oferta por m² (venta)', '$/m²', 'oime-ofertas', periodo,
                   nota=f'{NOTA_OIME} Solo territorios con al menos {MIN_OFERTAS} ofertas en {periodo}.')
    terr.indicador('arriendo_m2', 'Arriendo de oferta por m²', '$/m² al mes', 'oime-ofertas', periodo,
                   nota=f'{NOTA_OIME} Solo territorios con al menos {MIN_OFERTAS} ofertas en {periodo}.')
    terr.indicador('rentabilidad_bruta', 'Rentabilidad bruta del arriendo', '%', 'oime-ofertas', periodo,
                   estado='derivado', decimales=1, nota=nota_rent)
    for codigo in terr.filas:
        v, a = valores('VENTA', ventana, comuna=codigo), valores('ARRENDAMIENTO', ventana, comuna=codigo)
        mv = mediana(v) if len(v) >= MIN_OFERTAS else None
        ma = mediana(a) if len(a) >= MIN_OFERTAS else None
        terr.valor(codigo, 'venta_m2', periodo, mv)
        terr.valor(codigo, 'arriendo_m2', periodo, ma)
        terr.valor(codigo, 'rentabilidad_bruta', periodo, round(ma * 12 / mv * 100, 2) if mv and ma else None)

    # Por estrato (1 a 6), toda la ciudad.
    por_estrato = []
    for e in range(1, 7):
        v, a = valores('VENTA', ventana, estrato=e), valores('ARRENDAMIENTO', ventana, estrato=e)
        mv = mediana(v) if len(v) >= MIN_OFERTAS else None
        ma = mediana(a) if len(a) >= MIN_OFERTAS else None
        por_estrato.append({'estrato': e, 'venta_m2': mv, 'ofertas_venta': len(v), 'arriendo_m2': ma,
                            'ofertas_arriendo': len(a),
                            'rentabilidad_bruta': round(ma * 12 / mv * 100, 2) if mv and ma else None})
    t.lista('vivienda_por_estrato', por_estrato)


# ---------------------------------------------------------------- valor catastral del suelo

SUELO = 'https://portalidem.metropol.gov.co/server/rest/services/MEDELLIN_Uso_y_Valores_Suelo/MapServer/0'
COBERTURA_MIN = 0.5  # fracción del territorio cubierta por zonas de valor para publicar su promedio
CIERRE_CALLES = 0.0002  # grados, ~22 m: ancho de calle que se cierra entre manzanas de una misma zona


def metros(geom):
    k = math.cos(math.radians(6.25))
    return shapely.transform(geom, lambda c: c * [111_320 * k, 110_574])


def para_mapa(geom):
    """Geometría liviana para la capa del gemelo: cada zona viene partida en manzanas (10.842 polígonos para 276
    zonas, 4 MB). Se cierran los huecos de calle dentro de la zona y se simplifica a ~17 m; a escala de ciudad se ve
    igual y la capa baja a ~1 MB. El promedio por comuna se calcula con la geometría original."""
    cerrada = geom.buffer(CIERRE_CALLES, join_style='mitre').buffer(-CIERRE_CALLES, join_style='mitre')
    return shapely.set_precision(shapely.make_valid(cerrada.simplify(0.00015)), 1e-5, mode='pointwise')


def suelo(t, terr):
    t.fuente('idem-valor-suelo', 'Zonas de valor catastral del suelo de Medellín',
             'Área Metropolitana del Valle de Aburrá · Portal IDEM (catastro del Distrito)', SUELO)
    datos = arcgis_geojson(SUELO, 'VALOR_M2,TIPO_VALOR', offset=0.00002)
    zonas = [(shape(f['geometry']).buffer(0), f['properties']['VALOR_M2']) for f in datos['features']
             if f.get('geometry') and f['properties'].get('VALOR_M2')]
    if not zonas:
        raise RuntimeError('El IDEM no devolvió zonas de valor del suelo')
    DIR_CAPAS.mkdir(parents=True, exist_ok=True)
    capa = [{'type': 'Feature', 'properties': {'valor_m2': round(v)}, 'geometry': mapping(para_mapa(g))} for g, v in zonas]
    (DIR_CAPAS / 'economia_valor_suelo.geojson').write_text(
        json.dumps({'type': 'FeatureCollection', 'features': capa}, separators=(',', ':')), encoding='utf-8')
    print(f'  · capa economia_valor_suelo: {len(capa)} zonas')

    vigencia = f'Base catastral consultada el {hoy().isoformat()}'
    nota = ('Valor catastral del suelo por m² de cada zona geoeconómica homogénea; no es precio de mercado. El '
            'servicio no publica el año de la base catastral.')
    valores = sorted(v for _, v in zonas)
    t.cifra('valor_suelo_mediana', round(statistics.median(valores)), '$/m²', 'Valor catastral del suelo (zona mediana)',
            'idem-valor-suelo', vigencia, nota=f'{nota} Mediana de las {len(zonas)} zonas, sin ponderar por área.')
    t.cifra('valor_suelo_zonas', len(zonas), 'zonas', 'Zonas de valor catastral del suelo', 'idem-valor-suelo', vigencia)

    limites = json.loads((DIR_GEO / 'comunas.geojson').read_text(encoding='utf-8'))['features']
    arbol = shapely.STRtree([g for g, _ in zonas])
    terr.indicador('valor_suelo', 'Valor catastral del suelo (promedio por área)', '$/m²', 'idem-valor-suelo', vigencia,
                   estado='derivado',
                   nota=f'{nota} Promedio de las zonas que tocan el territorio, ponderado por el área de cada una dentro '
                        f'de él. Solo territorios cubiertos al menos en un {round(COBERTURA_MIN * 100)} %.')
    for f in limites:
        codigo = f['properties'].get('CODIGO')
        if codigo not in terr.filas:
            continue
        territorio = shape(f['geometry']).buffer(0)
        suma = area = 0.0
        for i in arbol.query(territorio, predicate='intersects'):
            geom, valor = zonas[i]
            parte = metros(geom.intersection(territorio)).area
            suma, area = suma + parte * valor, area + parte
        cubierto = area / metros(territorio).area
        terr.valor(codigo, 'valor_suelo', SIN_ANIO, round(suma / area) if area and cubierto >= COBERTURA_MIN else None)


# ---------------------------------------------------------------- licencias urbanísticas

LICENCIAS = f'{ALC}/vivienda_ciudad_terri/VM_Licencias/MapServer/2'
ANIOS_LICENCIAS = 5  # últimos años de la serie que se suman por comuna


def licencias(t, terr):
    t.fuente('curadurias-licencias', 'Licencias urbanísticas expedidas por las curadurías (archivo digitalizado)',
             'Departamento Administrativo de Planeación · Alcaldía de Medellín', LICENCIAS)
    # La capa no admite paginación: se descarga por rangos de objectid.
    filas = arcgis_por_ids(LICENCIAS, 'anio,objeto,g__comuna')
    registros = []
    for f in filas:
        # "anio" es texto libre: "2008", "2003-1998", "20'04"… Se toma el primer año de cuatro cifras.
        m = re.match(r'\s*(\d{4})', str(f['anio'] or ''))
        if m and 1990 <= int(m.group(1)) <= hoy().year:
            registros.append({'anio': int(m.group(1)), 'objeto': (f['objeto'] or 'No definido').strip(),
                              'codigo': terr.codigo(f['g__comuna'])})
    por_anio = collections.Counter(r['anio'] for r in registros)
    # El archivo deja de alimentarse: el último año con muestra comparable corta la serie (2021 trae 127 registros).
    tipico = statistics.median(por_anio.values())
    corte = max(a for a, n in por_anio.items() if n >= 0.2 * tipico)
    anios = [a for a in sorted(por_anio) if a <= corte]
    nota = (f'Archivo histórico de las cuatro curadurías y el DAP, georreferenciado por la Alcaldía. Llega hasta {corte}: '
            f'{corte + 1} y posteriores traen muy pocos registros y no se muestran. "Varias" agrupa licencias con más de '
            'un objeto.')
    t.serie('licencias_anual', [[str(a), por_anio[a]] for a in anios], 'licencias', 'Licencias urbanísticas por año',
            'curadurias-licencias', nota=nota)

    ventana = list(range(corte - ANIOS_LICENCIAS + 1, corte + 1))
    periodo = f'{ventana[0]}–{ventana[-1]} (histórico)'
    recientes = [r for r in registros if r['anio'] in ventana]
    por_objeto = collections.Counter(r['objeto'] for r in recientes)
    t.lista('licencias_por_objeto', [{'objeto': o, 'licencias': n} for o, n in por_objeto.most_common()])
    t.cifra('licencias_ventana', len(recientes), 'licencias', f'Licencias urbanísticas {ventana[0]}–{ventana[-1]}',
            'curadurias-licencias', periodo, nota=nota)
    t.cifra('licencias_obra_nueva', por_objeto.get('Obra nueva', 0), 'licencias',
            f'Licencias de obra nueva {ventana[0]}–{ventana[-1]}', 'curadurias-licencias', periodo)

    sin_comuna = sum(1 for r in recientes if not r['codigo'])
    nota_terr = f'{nota} {miles(sin_comuna)} licencias del periodo no tienen comuna reconocible y no se asignan.'
    terr.indicador('licencias', 'Licencias urbanísticas', 'licencias', 'curadurias-licencias', periodo, nota=nota_terr)
    terr.indicador('licencias_obra_nueva', 'Licencias de obra nueva', 'licencias', 'curadurias-licencias', periodo,
                   nota=nota_terr)
    etiqueta = f'{ventana[0]}–{ventana[-1]}'
    for codigo in terr.filas:
        mias = [r for r in recientes if r['codigo'] == codigo]
        terr.valor(codigo, 'licencias', etiqueta, len(mias))
        terr.valor(codigo, 'licencias_obra_nueva', etiqueta, sum(1 for r in mias if r['objeto'] == 'Obra nueva'))


# ---------------------------------------------------------------- establecimientos de Industria y Comercio

ICA = f'{ALC}/ccio_ind_turism/VC_Act_Comercial_Empresarial/MapServer/0'
# El servicio no publica el diccionario de `grupo_actividad`; los rótulos salen del código CIIU que predomina en cada
# grupo (01: confección y alimentos; 02: comercio al por menor; 03: servicios; 04: financieras; 05: asociaciones y arte).
GRUPOS_ICA = {'01': 'Industrial', '02': 'Comercial', '03': 'Servicios', '04': 'Financiero', '05': 'Otras actividades'}


def establecimientos(t, terr):
    t.fuente('alc-industria-comercio', 'Establecimientos de Industria y Comercio activos por actividad',
             'Secretaría de Hacienda · Alcaldía de Medellín', ICA)
    conteo = [{'statisticType': 'count', 'onStatisticField': 'objectid', 'outStatisticFieldName': 'n'}]
    datos = consulta_arcgis(ICA, {'where': '1=1', 'groupByFieldsForStatistics': 'nombre_comuna,grupo_actividad',
                                  'outStatistics': json.dumps(conteo), 'f': 'json'})
    grupos = [f['attributes'] for f in datos.get('features', [])]
    if not grupos:
        raise RuntimeError('El registro de Industria y Comercio no devolvió conteos')
    sin_local = consulta_arcgis(ICA, {'where': "nombre_establecimiento LIKE 'NO POSEE%'", 'returnCountOnly': 'true',
                                      'f': 'json'})['count']
    total = sum(g['n'] for g in grupos)
    vigencia = f'Registro activo consultado el {hoy().isoformat()}'
    nota = ('Contratos activos del impuesto de Industria y Comercio. Incluye contribuyentes registrados sin '
            f'establecimiento físico ({miles(sin_local)} dicen "No posee establecimientos"). No es el número de empresas '
            'de la Cámara de Comercio, que cuenta matrículas mercantiles.')
    t.cifra('establecimientos_ica', total, 'contratos', 'Contribuyentes activos de Industria y Comercio',
            'alc-industria-comercio', vigencia, nota=nota)

    por_codigo, por_grupo, sin_comuna = collections.Counter(), collections.Counter(), 0
    for g in grupos:
        codigo = terr.codigo(g['nombre_comuna'])
        por_grupo[GRUPOS_ICA.get((g['grupo_actividad'] or '').strip(), 'Sin grupo')] += g['n']
        if codigo:
            por_codigo[codigo] += g['n']
        else:
            sin_comuna += g['n']
    t.lista('ica_por_grupo', [{'grupo': k, 'contratos': n} for k, n in por_grupo.most_common()])
    terr.indicador('establecimientos_ica', 'Contribuyentes de Industria y Comercio', 'contratos',
                   'alc-industria-comercio', vigencia,
                   nota=f'{nota} {miles(sin_comuna)} contratos no tienen comuna y no se asignan. Los grupos de actividad '
                        'se rotulan a partir del código CIIU que predomina en cada uno; el servicio no publica su '
                        'diccionario.')
    for codigo in terr.filas:
        terr.valor(codigo, 'establecimientos_ica', SIN_ANIO, por_codigo.get(codigo, 0))


# ---------------------------------------------------------------- estructura empresarial (Cámara de Comercio)

CAMARA = 'pb3w-3vmc'
# Secciones de la CIIU Rev. 4 A.C. por división (dos primeras cifras del código de clase).
SECCIONES = [((1, 3), 'Agropecuario'), ((5, 9), 'Minería'), ((10, 33), 'Industria manufacturera'),
             ((35, 39), 'Energía, agua y residuos'), ((41, 43), 'Construcción'), ((45, 47), 'Comercio'),
             ((49, 53), 'Transporte'), ((55, 56), 'Alojamiento y comida'), ((58, 63), 'Información y comunicaciones'),
             ((64, 66), 'Financieras y seguros'), ((68, 68), 'Inmobiliarias'), ((69, 75), 'Profesionales y técnicas'),
             ((77, 82), 'Servicios administrativos'), ((84, 84), 'Administración pública'), ((85, 85), 'Educación'),
             ((86, 88), 'Salud'), ((90, 93), 'Arte y recreación'), ((94, 99), 'Otros servicios')]


def seccion(ciiu):
    division = int(str(ciiu).zfill(4)[:2]) if str(ciiu).isdigit() and int(ciiu) else None
    return next((nombre for (a, b), nombre in SECCIONES if division and a <= division <= b), 'Sin CIIU')


def empresas(t, terr):
    t.fuente('camara-estructura', 'Estructura empresarial de Medellín según comunas y actividad económica',
             'Cámara de Comercio de Medellín para Antioquia', f'https://www.datos.gov.co/d/{CAMARA}')
    filas = socrata(CAMARA, limit=50000)
    if not filas:
        raise RuntimeError('datos.gov.co no devolvió la estructura empresarial')
    columnas = [c for c in filas[0] if c not in ('a_o', 'ciiu', 'descripci_n')]
    codigo_de = {c: terr.codigo(c.replace('_', ' ')) for c in columnas if c != 'sin_georreferenciar'}
    faltan = [c for c, codigo in codigo_de.items() if not codigo]
    if faltan:
        raise RuntimeError(f'Columnas de comuna sin territorio: {faltan}')

    numero = lambda v: int(float(v or 0))
    por_anio = collections.Counter()
    for f in filas:
        por_anio[int(f['a_o'])] += sum(numero(f[c]) for c in columnas)
    ultimo = max(por_anio)
    nota = ('Empresas con matrícula mercantil en la Cámara de Comercio. Hasta 2020 cerca de 18.000 empresas quedaban '
            '"sin georreferenciar" por año; desde 2021 son unas pocas centenas, así que el conteo por comuna no es '
            'comparable antes y después de 2021. El total de la ciudad sí lo es.')
    t.serie('empresas_anual', [[str(a), n] for a, n in sorted(por_anio.items())], 'empresas',
            'Empresas matriculadas en Medellín', 'camara-estructura', nota=nota)
    t.cifra('empresas_camara', por_anio[ultimo], 'empresas', f'Empresas matriculadas {ultimo}', 'camara-estructura',
            str(ultimo), nota=nota)

    recientes = [f for f in filas if int(f['a_o']) == ultimo]
    por_seccion = collections.Counter()
    for f in recientes:
        por_seccion[seccion(f['ciiu'])] += sum(numero(f[c]) for c in columnas)
    t.lista('empresas_por_sector', [{'sector': s, 'empresas': n} for s, n in por_seccion.most_common()])

    terr.indicador('empresas_camara', 'Empresas matriculadas (Cámara de Comercio)', 'empresas', 'camara-estructura',
                   str(ultimo), nota=nota)
    for columna, codigo in codigo_de.items():
        terr.valor(codigo, 'empresas_camara', ultimo, sum(numero(f[columna]) for f in recientes))


# ---------------------------------------------------------------- principal

# Listas que produce cada fuente, para conservarlas si esa fuente falla (las cifras y series se heredan solas).
LISTAS = {'oime-ofertas': ['vivienda_por_estrato'], 'curadurias-licencias': ['licencias_por_objeto'],
          'alc-industria-comercio': ['ica_por_grupo'], 'camara-estructura': ['empresas_por_sector']}


def main():
    t = Tema('economia', 'Economía y vivienda')
    terr = Territorios()
    with t.bloque('dane-geih'):
        mercado_laboral(t)
    with t.bloque('oime-ofertas'):
        vivienda(t, terr)
    with t.bloque('idem-valor-suelo'):
        suelo(t, terr)
    with t.bloque('curadurias-licencias'):
        licencias(t, terr)
    with t.bloque('alc-industria-comercio'):
        establecimientos(t, terr)
    with t.bloque('camara-estructura'):
        empresas(t, terr)

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
