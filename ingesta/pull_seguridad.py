"""Seguridad: delitos de la Policía Nacional (datos.gov.co, MinDefensa) y el histórico georreferenciado
del SISC (MEData, Secretaría de Seguridad y Convivencia · Alcaldía de Medellín).

Son dos fuentes que **no se mezclan en una misma serie**: la Policía cubre 2018 al último mes publicado,
solo a nivel de ciudad; el SISC llega hasta noviembre de 2023, con coordenadas, barrio y comuna, y sirve
para el ranking por comuna y el mapa por barrio, siempre rotulado como histórico.

Por territorio, el SISC se guarda además con el contrato de lago.Territorios (listas `indicadores` y `territorios`),
que es el que lee el Atlas (#11): casos de la ventana reciente y casos por 10.000 habitantes de cada categoría.
"""

import datetime as dt
import json

from lago import DIR_LAGO, RAIZ, MESES, Tema, Territorios, leer_csv, numero, socrata

MUNICIPIO = "cod_muni='05001'"
DESDE = 2018
MIN_BARRIO = 5  # menos casos que esto en un barrio no se publican: en una zona pequeña, 1 o 2 casos señalan a alguien
ANIOS_VENTANA_SISC = 3  # años recientes de cada archivo SISC usados en el ranking y el mapa por barrio
DELITOS = [
    # (clave, recurso Socrata, nombre)
    ('homicidios', 'm8fd-ahd9', 'Homicidios'),
    ('hurto_personas', '4rxi-8m8d', 'Hurto a personas'),
    ('hurto_vehiculos', 'csb4-y6v2', 'Hurto de vehículos'),
    ('extorsion', 'q2ib-t9am', 'Extorsión'),
    ('violencia_intrafamiliar', 'gepp-dxcs', 'Violencia intrafamiliar'),
    ('delitos_sexuales', 'bz43-8ahq', 'Delitos sexuales'),
    ('lesiones_personales', 'jr6v-i33g', 'Lesiones personales'),
]

MEDATA = 'http://medata.gov.co/sites/default/files/distribution'
SISC = [
    # (clave, nombre, url) — taxonomía propia del SISC, no calcada de las categorías de la Policía.
    ('homicidio', 'Homicidio', f'{MEDATA}/1-027-23-000008/homicidio.csv'),
    ('hurto_persona', 'Hurto a persona', f'{MEDATA}/1-027-23-000011/hurto_a_persona.csv'),
    ('hurto_carro', 'Hurto de carro', f'{MEDATA}/1-027-23-000013/hurto_de_carro.csv'),
    ('hurto_moto', 'Hurto de moto', f'{MEDATA}/1-027-23-000014/hurto_de_moto.csv'),
    ('hurto_residencia', 'Hurto a residencia', f'{MEDATA}/1-027-23-000012/hurto_a_residencia.csv'),
    ('hurto_comercio', 'Hurto a establecimiento comercial', f'{MEDATA}/1-027-23-000010/hurto_a_establecimiento_comercial.csv'),
    ('extorsion_sisc', 'Extorsión', f'{MEDATA}/1-027-23-000007/extorsion.csv'),
    ('lesion_dolosa', 'Lesión no fatal dolosa', f'{MEDATA}/1-027-23-000002/lesion_no_fatal_dolosa_segun_policia.csv'),
]
DIR_GEO = RAIZ / 'public' / 'data' / 'geo'


# ---------------------------------------------------------------- Policía Nacional (series de ciudad)

def fecha_corte(recurso):
    fila = socrata(recurso, select='max(fecha_hecho) as corte', where=MUNICIPIO)[0]
    return dt.date.fromisoformat(fila['corte'][:10])


def suma(recurso, desde, hasta):
    fila = socrata(recurso, select='sum(cantidad) as n',
                   where=f"{MUNICIPIO} and fecha_hecho between '{desde}T00:00:00' and '{hasta}T23:59:59'")[0]
    return int(float(fila.get('n') or 0))


def poblacion_por_anio():
    ruta = DIR_LAGO / 'demografia.json'
    if not ruta.exists():
        return {}
    serie = json.loads(ruta.read_text(encoding='utf-8'))['series'].get('poblacion_total', {})
    return {int(a): v for a, v in serie.get('puntos', [])}


def periodo(desde, hasta):
    if desde.month == 1 and desde.day == 1 and hasta.month == 12 and hasta.day == 31:
        return str(desde.year)
    return f'{MESES[desde.month - 1]}–{MESES[hasta.month - 1]} {hasta.year}'


def policia(t, poblacion):
    for clave, recurso, nombre in DELITOS:
        fuente = f'policia-{clave}'.replace('_', '-')
        with t.bloque(fuente):
            t.fuente(fuente, f'{nombre} · Policía Nacional', 'Ministerio de Defensa Nacional · Policía Nacional',
                     f'https://www.datos.gov.co/d/{recurso}')
            corte = fecha_corte(recurso)
            filas = socrata(recurso, select='date_extract_y(fecha_hecho) as anio, sum(cantidad) as n',
                            where=f"{MUNICIPIO} and fecha_hecho >= '{DESDE}-01-01T00:00:00'",
                            group='anio', order='anio')
            anual = {int(f['anio']): int(float(f['n'])) for f in filas}
            completo = corte.year - 1 if corte < dt.date(corte.year, 12, 31) else corte.year

            t.serie(f'{clave}_anual', [[str(a), n] for a, n in sorted(anual.items())], 'casos',
                    f'{nombre} por año', fuente,
                    nota=f'{corte.year} parcial: hasta el {corte.isoformat()}.' if completo < corte.year else '')
            t.cifra(clave, anual[completo], 'casos', f'{nombre} {completo}', fuente, str(completo))

            # Año en curso frente al mismo periodo del año anterior, con el mismo día de corte.
            inicio = dt.date(corte.year, 1, 1)
            actual = suma(recurso, inicio, corte)
            anterior = suma(recurso, inicio.replace(year=corte.year - 1), corte.replace(year=corte.year - 1))
            t.cifra(f'{clave}_anio_curso', actual, 'casos', f'{nombre} en {corte.year}', fuente,
                    periodo(inicio, corte), ancla=clave == 'homicidios',
                    nota=f'Del 1 de enero al {corte.isoformat()}, último día publicado.')
            if anterior:
                t.cifra(f'{clave}_variacion', round((actual - anterior) / anterior * 100, 1), '%',
                        f'{nombre}: variación frente a {corte.year - 1}', fuente, periodo(inicio, corte),
                        estado='derivado', decimales=1,
                        nota=f'{actual} casos frente a {anterior} en el mismo periodo de {corte.year - 1}.')

            # Serie mensual de los últimos 2 años, para el mismo año en curso frente al anterior mes a mes.
            meses = socrata(recurso, select="date_trunc_ym(fecha_hecho) as mes, sum(cantidad) as n",
                            where=f"{MUNICIPIO} and fecha_hecho >= '{corte.year - 2}-01-01T00:00:00'",
                            group='mes', order='mes')
            t.serie(f'{clave}_mensual', [[m['mes'][:7], int(float(m['n']))] for m in meses], 'casos',
                    f'{nombre} por mes', fuente)

            if completo in poblacion:
                t.cifra(f'{clave}_tasa', round(anual[completo] / poblacion[completo] * 1e5, 2),
                        'por 100 mil hab.', f'Tasa de {nombre.lower()} {completo}', fuente, str(completo),
                        estado='derivado', decimales=2, ancla=clave == 'homicidios',
                        nota=f'{anual[completo]} casos (Policía) ÷ {poblacion[completo]:,} habitantes '
                             f'(proyección DANE) × 100.000.'.replace(',', '.'))


# ---------------------------------------------------------------- SISC (histórico georreferenciado)

def territorios_con_poblacion():
    """Código y nombre de las 21 comunas/corregimientos, con su población año por año (total DANE del año repartido
    según la proyección del DAP de ese año; ver `poblacion_anual_por_territorio` en demografia.json)."""
    comunas = json.loads((DIR_GEO / 'comunas.geojson').read_text(encoding='utf-8'))['features']
    demografia_ruta = DIR_LAGO / 'demografia.json'
    poblacion_por_codigo = {}
    if demografia_ruta.exists():
        listas = json.loads(demografia_ruta.read_text(encoding='utf-8'))['listas']
        poblacion_por_codigo = {f['codigo']: {int(a): v for a, v in f['valores'].items()}
                                for f in listas.get('poblacion_anual_por_territorio', [])}
    terr = {}
    for f in comunas:
        p = f['properties']
        if not p.get('NOMBRE'):
            continue
        terr[p['CODIGO']] = {'codigo': p['CODIGO'], 'nombre': p['NOMBRE'], 'poblacion': poblacion_por_codigo.get(p['CODIGO'], {})}
    return terr


def bbox_valido(lat, lon):
    return lat is not None and lon is not None and 5.9 < lat < 6.5 and -75.8 < lon < -75.3


def procesar_categoria(url):
    """Una pasada por el CSV: cuenta por año (serie completa), y por comuna/barrio en la ventana reciente."""
    filas = leer_csv(url, timeout=400)
    por_anio, por_comuna, por_barrio, por_comuna_anio = {}, {}, {}, {}
    anio_max, ultimo_dia = 0, ''
    for f in filas:
        anio_texto = (f.get('fecha_hecho') or '')[:4]
        if not anio_texto.isdigit():
            continue
        anio = int(anio_texto)
        anio_max = max(anio_max, anio)
        ultimo_dia = max(ultimo_dia, (f.get('fecha_hecho') or '')[:10])
        cantidad = numero(f.get('cantidad')) or 0
        por_anio[anio] = por_anio.get(anio, 0) + cantidad
    # El último año del archivo está incompleto si no llega a diciembre: una tasa anual solo es honesta con un año entero.
    anio_completo = anio_max if ultimo_dia[5:7] == '12' else anio_max - 1
    desde_ventana = anio_max - ANIOS_VENTANA_SISC + 1
    for f in filas:
        anio_texto = (f.get('fecha_hecho') or '')[:4]
        if not anio_texto.isdigit() or int(anio_texto) < desde_ventana:
            continue
        comuna = (f.get('codigo_comuna') or '').strip()
        barrio = (f.get('codigo_barrio') or '').lstrip('#').strip()
        cantidad = numero(f.get('cantidad')) or 0
        if comuna.isdigit():
            codigo = comuna.zfill(2)
            por_comuna[codigo] = por_comuna.get(codigo, 0) + cantidad
            if int(anio_texto) == anio_completo:
                por_comuna_anio[codigo] = por_comuna_anio.get(codigo, 0) + cantidad
        if barrio.isdigit() and len(barrio) == 4:
            por_barrio[barrio] = por_barrio.get(barrio, 0) + cantidad
    return {'por_anio': por_anio, 'por_comuna': por_comuna, 'por_barrio': por_barrio, 'por_comuna_anio': por_comuna_anio,
            'anio_max': anio_max, 'ultimo_dia': ultimo_dia, 'anio_completo': anio_completo,
            'desde_ventana': desde_ventana, 'total_filas': len(filas)}


def sisc(t, terr, tt):
    barrios_json = {}
    vigencias = []
    indicadores_barrio = []
    for clave, nombre, url in SISC:
        fuente = f'sisc-{clave}'.replace('_', '-')
        with t.bloque(fuente):
            t.fuente(fuente, f'{nombre} (SISC, georreferenciado)',
                     'Secretaría de Seguridad y Convivencia · Alcaldía de Medellín (SISC / MEData)', url)
            r = procesar_categoria(url)
            vigencia_serie = f'2003–{r["anio_max"]} (histórico)'
            vigencia_ventana = f'{r["desde_ventana"]}–{r["anio_max"]} (histórico)'
            vigencias.append(r['anio_max'])

            t.serie(f'sisc_{clave}_anual', [[str(a), int(v)] for a, v in sorted(r['por_anio'].items())], 'casos',
                    f'{nombre} por año (SISC)', fuente, nota=f'Serie histórica; el SISC llega hasta {r["anio_max"]}.')

            # Un solo año completo: casos de ese año ÷ habitantes de ese mismo año. Sumar tres años (el último a medias)
            # y dividir entre la población de otro no da una tasa, da un número que nadie sabe leer.
            A = r['anio_completo']
            ranking = []
            for codigo, info in terr.items():
                casos = int(r['por_comuna_anio'].get(codigo, 0))
                fila = {'codigo': codigo, 'nombre': info['nombre'], 'casos': casos}
                if info['poblacion'].get(A):
                    fila['tasa_x10mil'] = round(casos / info['poblacion'][A] * 1e4, 2)
                ranking.append(fila)
            ranking.sort(key=lambda x: -x['casos'])
            t.lista(f'sisc_ranking_{clave}', ranking)
            nota_anio = (f'Casos de {A} con comuna diligenciada. El archivo llega hasta el {r["ultimo_dia"]}, así que {A} es el último '
                         f'año completo.' if A < r['anio_max'] else f'Casos de {A} con comuna diligenciada.')
            t.cifra(f'sisc_{clave}_anio', int(sum(r['por_comuna_anio'].values())), 'casos',
                    f'{nombre}, {A}', fuente, str(A), nota=nota_anio + ' Suma de las 21 comunas y corregimientos; '
                    'excluye registros sin comuna asignada.')

            # El mismo dato con el contrato de lago.Territorios, para el Atlas.
            tt.indicador(f'sisc_{clave}', f'{nombre} (SISC)', 'casos', fuente, str(A), nota=nota_anio)
            tt.indicador(f'sisc_{clave}_tasa', f'{nombre} por 10.000 habitantes (SISC)', 'por 10.000 hab.', fuente,
                         str(A), estado='derivado', decimales=2,
                         nota=f'Casos de {A} (año completo) ÷ población de {A} del territorio × 10.000. La población es el total '
                              f'DANE de {A} repartido según la proyección del DAP para {A}.',
                         proxy='la incidencia por habitante: la población de cada comuna es una estimación')
            for fila in ranking:
                if fila['codigo'] in tt.filas:
                    tt.valor(fila['codigo'], f'sisc_{clave}', A, fila['casos'])
                    tt.valor(fila['codigo'], f'sisc_{clave}_tasa', A, fila.get('tasa_x10mil'))

            for barrio, casos in r['por_barrio'].items():
                # null = menos de MIN_BARRIO casos (suprimido); un barrio que no aparece no tuvo registros (0).
                barrios_json.setdefault(barrio, {})[clave] = int(casos) if casos >= MIN_BARRIO else None
            indicadores_barrio.append({'clave': clave, 'etiqueta': f'{nombre} (SISC)', 'unidad': 'casos', 'fuente': fuente,
                                       'vigencia': vigencia_ventana, 'estado': 'observado', 'decimales': 0,
                                       # Un barrio que no aparece en el archivo no tuvo registros en la ventana.
                                       'faltante': 0,
                                       'nota': f'Los barrios con menos de {MIN_BARRIO} casos en la ventana no se publican (sin dato): '
                                               'en una zona pequeña, uno o dos casos señalan a una persona.'})

    (DIR_GEO / 'seguridad_barrios.json').write_text(json.dumps({
        'vigencia': f'{min(vigencias) - ANIOS_VENTANA_SISC + 1}–{max(vigencias)} (histórico, SISC)',
        'categorias': [{'clave': c, 'nombre': n} for c, n, _ in SISC],
        'minimo_publicable': MIN_BARRIO,
        # Contrato del nivel barrio del Atlas: cada indicador con su fuente, vigencia y estado.
        'indicadores': indicadores_barrio,
        'barrios': barrios_json
    }, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'  · mapa por barrio: {len(barrios_json):,} barrios y veredas con al menos un registro reciente')


def main():
    t = Tema('seguridad', 'Seguridad')
    poblacion = poblacion_por_anio()
    policia(t, poblacion)
    terr = territorios_con_poblacion()
    tt = Territorios()
    sisc(t, terr, tt)
    # Las listas no se heredan solas como las cifras: una categoría del SISC caída conserva sus valores por territorio.
    for fuente in t.fallos:
        tt.heredar(t.previo, fuente)
        clave = fuente.removeprefix('sisc-').replace('-', '_')
        if t.previo and f'sisc_ranking_{clave}' in t.previo['listas']:
            t.lista(f'sisc_ranking_{clave}', t.previo['listas'][f'sisc_ranking_{clave}'])
    tt.escribir(t)
    t.escribir()
    return t


if __name__ == '__main__':
    main()
