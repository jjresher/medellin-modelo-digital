"""Gente: población del DANE (total oficial, pirámide), proyecciones del DAP por comuna y corregimiento, condiciones de
vida de la Encuesta de Calidad de Vida, estratos del catastro y eventos de salud del SIVIGILA.

Por territorio (16 comunas y 5 corregimientos) se guardan dos listas que alimentan la sección Gente y, más adelante,
el Atlas (#11):
    indicadores: [{clave, etiqueta, unidad, fuente, estado, vigencia, decimales, nota}]
    territorios: [{codigo, nombre, tipo, valores: {clave: {anio: valor}}}]
"""

import json
import re
import urllib.request
from collections import Counter

from lago import RAIZ, UA, Tema, arcgis, descargar, excel, hoy

DANE_BASE = 'https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/'
DANE_AREA = DANE_BASE + 'PPED-AreaMun-2018-2042_VP.xlsx'
DANE_EDAD = DANE_BASE + 'PPED-AreaSexoEdadMun-2018-2042_VP.xlsx'
ALC = 'https://www.medellin.gov.co/servidormapas/rest/services'
DAP = f'{ALC}/mapas_nacionales/VC_Distribucion_Poblacional/MapServer'
ECV = f'{ALC}/estadisticas/VC_Indicadores_ECV/MapServer'
ESTRATOS = f'{ALC}/ServiciosCatastro/ConsultaOperadorCatastral_geo/MapServer/23'
SALUD = f'{ALC}/salud_protec_soc/VC_Datos_Enfermedades/MapServer'
DIR_CRUDOS = RAIZ / 'datos' / 'crudos'
MEDELLIN = '05001'
ESTRATO_NOMBRE = {1: 'Bajo-bajo', 2: 'Bajo', 3: 'Medio-bajo', 4: 'Medio', 5: 'Medio-alto', 6: 'Alto'}


def miles(n):
    return f'{n:,}'.replace(',', '.')


def archivo_dane(url):
    """El archivo por sexo y edad pesa 131 MB: se guarda en datos/crudos y solo se vuelve a bajar si cambia de tamaño."""
    destino = DIR_CRUDOS / url.rsplit('/', 1)[1]
    req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        tamano = int(r.headers.get('Content-Length') or 0)
    if not destino.exists() or destino.stat().st_size != tamano:
        DIR_CRUDOS.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(descargar(url, timeout=900))
    return destino.read_bytes()


def filas_medellin(libro):
    """Filas de Medellín de la hoja de datos (la última del libro), más la fila de encabezados de columna."""
    hoja = libro.worksheets[-1]
    encabezado, filas = None, []
    for fila in hoja.iter_rows(values_only=True):
        if encabezado is None and len(fila) > 6 and fila[6] == 'Total':
            encabezado = fila
        if len(fila) > 6 and str(fila[2]).strip() == MEDELLIN and isinstance(fila[4], int):
            filas.append(fila)
    return encabezado, filas


def poblacion_dane(t, anio):
    t.fuente('dane-pped', 'Proyecciones de población municipal por área 2018–2042 (PPED, actualización de julio de 2025)',
             'DANE', DANE_AREA)
    _, filas = filas_medellin(excel(descargar(DANE_AREA, timeout=300)))
    por = {(f[4], str(f[5]).strip()): f[6] for f in filas}
    if (anio, 'Total') not in por:
        raise RuntimeError(f'El archivo PPED del DANE no trae {anio} para Medellín')
    nota = ('Proyección vigente del DANE (PPED), publicada en julio de 2025 con base en el CNPV 2018. Reemplaza la serie '
            '2020–2035 post-COVID, que daba 2.650.662 habitantes para 2026. Cifra oficial del total municipal.')
    t.cifra('poblacion', por[(anio, 'Total')], 'habitantes', 'Población proyectada', 'dane-pped', str(anio),
            ancla=True, nota=nota)
    t.cifra('poblacion_cabecera', por[(anio, 'Cabecera Municipal')], 'habitantes', 'Población urbana (cabecera)',
            'dane-pped', str(anio))
    t.cifra('poblacion_rural', por[(anio, 'Centros Poblados y Rural Disperso')], 'habitantes',
            'Población rural (centros poblados y rural disperso)', 'dane-pped', str(anio))
    t.serie('poblacion_total', [[a, v] for (a, area), v in sorted(por.items()) if area == 'Total'],
            'habitantes', 'Población de Medellín 2018–2042', 'dane-pped',
            nota='DANE, PPED (julio de 2025). 2018 es el año base del censo; el resto son proyecciones.')
    return {a: v for (a, area), v in por.items() if area == 'Total'}


def grupo_quinquenal(edad):
    return '100+' if edad >= 100 else f'{edad - edad % 5}–{edad - edad % 5 + 4}'


def piramide_dane(t, anio):
    t.fuente('dane-pped-edad', 'Proyecciones de población municipal por área, sexo y edad 2018–2042 (PPED)', 'DANE',
             DANE_EDAD)
    encabezado, filas = filas_medellin(excel(archivo_dane(DANE_EDAD)))
    columnas = []
    for i, nombre in enumerate(encabezado or ()):
        m = re.fullmatch(r'(Hombres|Mujeres) (\d+) años?( y más)?', str(nombre or '').strip())
        if m:
            columnas.append((i, m.group(1).lower(), int(m.group(2))))
    if len(columnas) != 202:
        raise RuntimeError(f'Se esperaban 101 edades por sexo en el archivo del DANE y hay {len(columnas)} columnas')

    totales = {f[4]: f for f in filas if str(f[5]).strip() == 'Total'}
    anios = sorted({2018, anio, max(totales)})
    piramide = []
    for a in anios:
        grupos = {}
        for i, sexo, edad in columnas:
            g = grupos.setdefault(grupo_quinquenal(edad), {'anio': a, 'grupo': grupo_quinquenal(edad), 'hombres': 0, 'mujeres': 0})
            g[sexo] += totales[a][i]
        piramide += grupos.values()
    t.lista('piramide', piramide)

    fila = totales[anio]
    por_edad = Counter()
    for i, _sexo, edad in columnas:
        por_edad[edad] += fila[i]
    total = sum(por_edad.values())
    acumulado, mediana = 0, None
    for edad in sorted(por_edad):
        acumulado += por_edad[edad]
        if acumulado >= total / 2:
            mediana = edad
            break
    mayores = sum(v for e, v in por_edad.items() if e >= 60)
    menores = sum(v for e, v in por_edad.items() if e < 15)
    t.cifra('mujeres', fila[8], 'habitantes', 'Mujeres', 'dane-pped-edad', str(anio))
    t.cifra('hombres', fila[7], 'habitantes', 'Hombres', 'dane-pped-edad', str(anio))
    t.cifra('edad_mediana', mediana, 'años', 'Edad mediana', 'dane-pped-edad', str(anio), estado='derivado',
            nota='Edad en la que la población acumulada, contada desde 0 años, alcanza la mitad del total.')
    t.cifra('poblacion_60_mas', round(mayores / total * 100, 1), '%', 'Población de 60 años o más', 'dane-pped-edad',
            str(anio), estado='derivado', nota=f'{miles(mayores)} de {miles(total)} habitantes.')
    t.cifra('poblacion_menor_15', round(menores / total * 100, 1), '%', 'Población menor de 15 años', 'dane-pped-edad',
            str(anio), estado='derivado', nota=f'{miles(menores)} de {miles(total)} habitantes.')


class Territorios:
    """Acumula por código de comuna o corregimiento los valores de cada indicador, con su definición. Los 21
    territorios y sus nombres salen de los límites del gemelo (comunas.geojson), no de cada fuente."""

    def __init__(self):
        self.filas, self.indicadores = {}, {}
        limites = json.loads((RAIZ / 'public' / 'data' / 'geo' / 'comunas.geojson').read_text(encoding='utf-8'))
        for f in limites['features']:
            p = f['properties']
            if p.get('NOMBRE') and p['CODIGO'].isdigit():
                self.filas[p['CODIGO']] = {'codigo': p['CODIGO'],
                                           'nombre': re.sub(r'^Corregimiento de ', '', p['NOMBRE']),
                                           'tipo': 'Corregimiento' if int(p['CODIGO']) >= 50 else 'Comuna',
                                           'valores': {}}
        if len(self.filas) != 21:
            raise RuntimeError(f'comunas.geojson trae {len(self.filas)} comunas y corregimientos con nombre, no 21')

    def indicador(self, clave, etiqueta, unidad, fuente, vigencia, estado='observado', decimales=0, nota=None):
        self.indicadores[clave] = {'clave': clave, 'etiqueta': etiqueta, 'unidad': unidad, 'fuente': fuente,
                                   'estado': estado, 'vigencia': vigencia, 'decimales': decimales,
                                   **({'nota': nota} if nota else {})}

    def valor(self, codigo, clave, anio, valor):
        fila = self.filas.get(str(codigo).zfill(2))
        if fila is None:
            raise RuntimeError(f'Código de territorio desconocido: {codigo!r}')
        if valor is not None:
            fila['valores'].setdefault(clave, {})[str(anio)] = valor

    def heredar(self, previo, fuente):
        """Si una fuente falla, se conservan sus indicadores y valores de la ingesta anterior."""
        listas = (previo or {}).get('listas', {})
        claves = [i['clave'] for i in listas.get('indicadores', []) if i['fuente'] == fuente]
        for ind in listas.get('indicadores', []):
            if ind['clave'] in claves:
                self.indicadores[ind['clave']] = ind
        for fila in listas.get('territorios', []):
            for clave in claves:
                if clave in fila['valores'] and fila['codigo'] in self.filas:
                    self.filas[fila['codigo']]['valores'][clave] = fila['valores'][clave]

    def escribir(self, t):
        t.lista('indicadores', list(self.indicadores.values()))
        t.lista('territorios', sorted(self.filas.values(), key=lambda f: f['codigo']))


def columnas_anio(fila, prefijo):
    """{anio: campo} para campos como i_2024, total_2024, i2024 o casos_2024."""
    return {int(m.group(1)): c for c in fila if (m := re.fullmatch(rf'{prefijo}(\d{{4}})', c))}


def vigencia_real(filas, campos):
    """Primer y último año con al menos un valor: los servicios dicen "vigente", pero el dato tiene su propio corte."""
    anios = sorted(a for a, c in campos.items() if any(f.get(c) is not None for f in filas))
    return anios, f'{anios[0]}–{anios[-1]}' if len(anios) > 1 else str(anios[0])


def proyeccion_dap(t, terr, anio, dane_total):
    t.fuente('dap-proyecciones', 'Proyecciones de población, hogares y viviendas 2018–2030 por comuna y corregimiento',
             'Departamento Administrativo de Planeación · Alcaldía de Medellín', DAP)
    poblacion = arcgis(f'{DAP}/1')
    hogares, viviendas = arcgis(f'{DAP}/2'), arcgis(f'{DAP}/3')
    # La capa de población no trae código; se toma el de hogares, que usa los mismos nombres.
    codigo_de = {h['nombre'].strip(): h['codigo'] for h in hogares}
    campo = f'total_{anio}'
    total_dap = sum(f[campo] for f in poblacion)
    nota_dap = ('Proyección 2018–2030 del DAP, elaborada en diciembre de 2018, antes de las actualizaciones del DANE. '
                'Úsese para repartir por territorio, no como total oficial.')
    t.cifra('poblacion_dap', total_dap, 'habitantes', 'Población proyectada (DAP)', 'dap-proyecciones', str(anio),
            nota=nota_dap)
    t.lista('poblacion_dap_por_territorio', sorted(
        ({'nombre': f['nombre'], 'valor': f[campo]} for f in poblacion), key=lambda x: -x['valor']))

    terr.indicador('poblacion', 'Población (DANE repartido por el DAP)', 'habitantes', 'dap-proyecciones', str(anio),
                   estado='derivado',
                   nota=f'Total DANE {anio} ({miles(dane_total)}) × la proporción de cada territorio en la proyección '
                        f'del DAP ({miles(total_dap)} en total, '
                        f'{str(round((total_dap / dane_total - 1) * 100, 1)).replace(".", ",")} % más que el DANE).')
    for f in poblacion:
        codigo = codigo_de.get(f['nombre'].strip())
        if not codigo:
            raise RuntimeError(f'Sin código para el territorio del DAP "{f["nombre"]}"')
        terr.valor(codigo, 'poblacion', anio, round(dane_total * f[campo] / total_dap))

    # Hogares y viviendas parten San Cristóbal, Altavista, San Antonio de Prado y Santa Elena en su parte urbana y
    # rural (mismo código): se suman para tener un valor por corregimiento.
    for clave, filas, etiqueta, unidad, ancla in (('hogares', hogares, 'Hogares proyectados', 'hogares', True),
                                                   ('viviendas', viviendas, 'Viviendas proyectadas', 'viviendas', False)):
        por_codigo = Counter()
        for f in filas:
            por_codigo[f['codigo']] += f[f'i{anio}'] or 0
        t.cifra(clave, sum(por_codigo.values()), unidad, etiqueta, 'dap-proyecciones', str(anio), ancla=ancla,
                nota=nota_dap)
        terr.indicador(clave, etiqueta, unidad, 'dap-proyecciones', str(anio), nota=nota_dap)
        for codigo, v in por_codigo.items():
            terr.valor(codigo, clave, anio, v)
        t.lista(f'{clave}_por_territorio', sorted(
            ({'nombre': terr.filas[c]['nombre'], 'valor': v} for c, v in por_codigo.items()), key=lambda x: -x['valor']))
    t.cifra('personas_por_hogar', round(total_dap / t.cifras['hogares']['valor'], 2), 'personas', 'Personas por hogar',
            'dap-proyecciones', str(anio), estado='derivado', decimales=2,
            nota='Población DAP ÷ hogares DAP, ambos de la misma serie para que sean comparables.')


def condiciones_de_vida(t, terr):
    t.fuente('alc-ecv', 'Indicadores de la Encuesta de Calidad de Vida por comuna y corregimiento (IMCV, pobreza '
             'multidimensional, IDH)', 'Departamento Administrativo de Planeación · Alcaldía de Medellín', ECV)
    capas = (
        (2, 'imcv', 'Índice Multidimensional de Condiciones de Vida (IMCV)', 'puntos de 0 a 100', 2,
         'Índice compuesto de la ECV entre 0 y 100; más cerca de 100 indica mejores condiciones de vida según su '
         'metodología. No hay dato de 2020: la encuesta no se hizo ese año.'),
        (1, 'pobreza_multidimensional', 'Pobreza multidimensional (IPM)', '%', 2,
         'Índice de pobreza multidimensional de la ECV: cinco dimensiones medidas en el hogar (educación, niñez y '
         'juventud, salud, trabajo y vivienda), sin ingresos. No hay dato de 2020.'),
        (3, 'idh', 'Índice de Desarrollo Humano (IDH)', 'índice de 0 a 1', 2,
         'Media geométrica de tres dimensiones: vida larga y saludable, educación y nivel de vida.'),
    )
    for capa, clave, etiqueta, unidad, decimales, nota in capas:
        filas = arcgis(f'{ECV}/{capa}')
        campos = columnas_anio(filas[0], 'i_')
        anios, vigencia = vigencia_real(filas, campos)
        terr.indicador(clave, etiqueta, unidad, 'alc-ecv', vigencia, decimales=decimales, nota=nota)
        for f in filas:
            for a in anios:
                terr.valor(f['codigo'], clave, a, f[campos[a]])


def estratos(t, terr):
    t.fuente('catastro-estratos', 'Estadística de estratificación por manzana (catastro)',
             'Subsecretaría de Catastro · Alcaldía de Medellín', ESTRATOS)
    filas = arcgis(ESTRATOS, campos='comuna,estrato')
    validas = [f for f in filas if f['estrato'] in ESTRATO_NOMBRE and f['comuna']]
    vigencia = f'Base catastral consultada el {hoy().isoformat()}'
    nota = ('Cuenta manzanas según su estrato socioeconómico, no viviendas ni personas: una manzana grande y una '
            'pequeña pesan lo mismo.')
    ciudad = Counter(f['estrato'] for f in validas)
    for e, n in sorted(ciudad.items()):
        t.cifra(f'manzanas_estrato_{e}', round(n / len(validas) * 100, 1), '%',
                f'Manzanas de estrato {e} ({ESTRATO_NOMBRE[e].lower()})', 'catastro-estratos', vigencia,
                estado='derivado', nota=f'{miles(n)} de {miles(len(validas))} manzanas. {nota}')
    t.cifra('manzanas_estratificadas', len(validas), 'manzanas', 'Manzanas con estrato asignado', 'catastro-estratos',
            vigencia)
    por_comuna = {}
    for f in validas:
        por_comuna.setdefault(f['comuna'].zfill(2), Counter())[f['estrato']] += 1
    for e in ESTRATO_NOMBRE:
        terr.indicador(f'estrato_{e}', f'Manzanas de estrato {e}', '% de manzanas', 'catastro-estratos', vigencia,
                       estado='derivado', decimales=1, nota=nota)
    for codigo, conteo in por_comuna.items():
        total = sum(conteo.values())
        for e in ESTRATO_NOMBRE:
            terr.valor(codigo, f'estrato_{e}', hoy().year, round(conteo[e] / total * 100, 1))


def salud(t, terr):
    t.fuente('sivigila-salud', 'Eventos de salud por comuna y corregimiento: natalidad, mortalidad y dengue (SIVIGILA)',
             'Secretaría de Salud · Alcaldía de Medellín', SALUD)
    eventos = ((4, 'natalidad', 'Natalidad', 'naciviv_', 'nacidos vivos'),
               (3, 'mortalidad', 'Mortalidad general', 'casos_', 'defunciones'),
               (0, 'dengue', 'Dengue', 'casos_', 'casos'))
    for capa, clave, etiqueta, prefijo, unidad_casos in eventos:
        filas = arcgis(f'{SALUD}/{capa}')
        casos, tasas = columnas_anio(filas[0], prefijo), columnas_anio(filas[0], 'tasa_')
        anios, vigencia = vigencia_real(filas, casos)
        nota = ('Tasa calculada por la Secretaría de Salud con las proyecciones de población del DAP. El servicio se '
                f'rotula "vigente", pero el dato llega hasta {anios[-1]}.')
        terr.indicador(f'{clave}_tasa', f'{etiqueta}: tasa', 'por 100.000 hab.', 'sivigila-salud', vigencia,
                       decimales=1, nota=nota)
        terr.indicador(f'{clave}_casos', f'{etiqueta}: {unidad_casos}', unidad_casos, 'sivigila-salud', vigencia,
                       nota=nota)
        sin_comuna = 0
        for f in filas:
            codigo = str(f.get('comuna') or '').zfill(2)
            if codigo == '99':
                sin_comuna = int(f[casos[anios[-1]]] or 0)
                continue
            for a in anios:
                terr.valor(codigo, f'{clave}_tasa', a, f.get(tasas.get(a)))
                terr.valor(codigo, f'{clave}_casos', a, f[casos[a]])
        total = int(sum(f[casos[anios[-1]]] or 0 for f in filas))
        t.cifra(f'{clave}_total', total, unidad_casos, f'{etiqueta} en Medellín ({unidad_casos})', 'sivigila-salud',
                str(anios[-1]), estado='derivado',
                nota=f'Suma de las comunas y corregimientos, más {miles(sin_comuna)} registros sin comuna.')


def main():
    anio = hoy().year
    t = Tema('demografia', 'Gente')
    terr = Territorios()
    dane = {}

    with t.bloque('dane-pped'):
        dane = poblacion_dane(t, anio)
    with t.bloque('dane-pped-edad'):
        piramide_dane(t, anio)
    with t.bloque('dap-proyecciones'):
        if anio not in dane:
            raise RuntimeError('Falta el total DANE para repartir la población del DAP')
        proyeccion_dap(t, terr, anio, dane[anio])
    with t.bloque('alc-ecv'):
        condiciones_de_vida(t, terr)
    with t.bloque('catastro-estratos'):
        estratos(t, terr)
    with t.bloque('sivigila-salud'):
        salud(t, terr)

    # Las listas no se heredan solas como las cifras: una fuente caída conserva sus valores por territorio aquí.
    for fuente in t.fallos:
        terr.heredar(t.previo, fuente)
        if fuente == 'dane-pped-edad' and t.previo and 'piramide' in t.previo['listas']:
            t.lista('piramide', t.previo['listas']['piramide'])
        if fuente == 'dap-proyecciones' and t.previo:
            for clave in ('poblacion_dap_por_territorio', 'hogares_por_territorio', 'viviendas_por_territorio'):
                if clave in t.previo['listas']:
                    t.lista(clave, t.previo['listas'][clave])
    terr.escribir(t)
    t.escribir()
    return t


if __name__ == '__main__':
    main()
