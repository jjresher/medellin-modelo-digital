"""Servicios públicos: cobertura de acueducto, alcantarillado y aseo por comuna y estrato; suscriptores, subsidios y
contribuciones de EPM, Emvarias y los pequeños prestadores (MEData); tarifas de EPM de acueducto y alcantarillado
(datos.gov.co), gas natural (datos.gov.co) y energía (publicación mensual de EPM, en PDF); ECAS (Superservicios) y organizaciones
recicladoras (MEData); accesos a internet fijo (MinTIC).

La cobertura de internet fijo por comuna queda como `candidato`: el MinTIC solo la publica por municipio.

Necesita `pdftotext` (poppler-utils) para leer las publicaciones de tarifas de energía de EPM.
"""

import collections
import csv
import io
import re
import subprocess
import urllib.parse
import urllib.request

from lago import MESES, RAIZ, UA, Tema, Territorios, descargar, json_url

MEDATA = 'http://medata.gov.co/sites/default/files/distribution'
COBERTURA = f'{MEDATA}/1-014-26-000256/reporte_de_estratificacion_y_cobertura.csv'
SUSCRIPTORES_EPM = f'{MEDATA}/1-014-26-000261/suscriptores_y_consumos_gran_prestador.csv'
SUSCRIPTORES_PEQUENOS = f'{MEDATA}/1-014-26-000262/suscriptores_y_consumos_pequenos_prestadores.csv'
SUSCRIPTORES_ASEO = f'{MEDATA}/1-014-26-000260/suscriptores_aseo.csv'
SUBSIDIOS_EPM = f'{MEDATA}/1-014-26-000258/subsidios_y_contribuciones_gran_prestador.csv'
SUBSIDIOS_ASEO = f'{MEDATA}/1-014-26-000257/subsidios_y_contribuciones_aseo.csv'
ECAS = 'y97c-tfd9'  # registro de la Superservicios (el de MEData no trae fecha y perdió las tildes)
RECICLADORAS = f'{MEDATA}/1-014-26-000593/Organizaciones_Recicladoras.csv'
TARIFAS_AGUA = 'nfrm-mmfe'
TARIFAS_GAS = 'ekup-y869'
EPM = 'https://www.epm.com.co'
TARIFAS_ENERGIA = f'{EPM}/clientesyusuarios/energia/tarifas-energia/'
INTERNET = 'fwe6-d4hc'  # ficha del MinTIC; el CSV real está en metadata.accessPoints
DIR_CRUDOS = RAIZ / 'datos' / 'crudos'

SERVICIOS = ('Acueducto', 'Alcantarillado', 'Aseo')
MESES_LARGOS = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
                'noviembre', 'diciembre')


def miles(n):
    return f'{n:,.0f}'.replace(',', '.')


def entero(texto):
    """'6.544' (con punto de miles, una fila del reporte de cobertura) o '6544' → 6544."""
    return int(str(texto).replace('.', '').strip() or 0)


def decimal(texto):
    """'858001,231' (coma decimal) o '858001.5' → número."""
    texto = str(texto).strip()
    return float(texto.replace('.', '').replace(',', '.') if ',' in texto else texto or 0)


def csv_medata(url):
    """Los CSV de MEData llegan en utf-8 o en latin-1 según el archivo."""
    crudo = descargar(url, timeout=180)
    for codificacion in ('utf-8-sig', 'latin-1'):
        try:
            return list(csv.DictReader(io.StringIO(crudo.decode(codificacion))))
        except UnicodeDecodeError:
            continue
    raise RuntimeError(f'No se pudo decodificar {url}')


def periodo(texto):
    """'31/08/2023' → (2023, 8)."""
    dia, mes, anio = texto.strip().split('/')
    return int(anio), int(mes)


def etiqueta_mes(anio, mes):
    return f'{MESES[mes - 1]} {anio}'


def mes_de_nombre(nombre):
    return MESES_LARGOS.index(nombre.strip().lower()) + 1


def soql(recurso, **consulta):
    return json_url(f'https://www.datos.gov.co/resource/{recurso}.json', {f'${k}': v for k, v in consulta.items()})


# ---------------------------------------------------------------- cobertura por comuna y estrato (MEData, hasta 2019)

def cobertura(t, terr):
    fuente = t.fuente('medata-cobertura-servicios', 'Reporte de estratificación y cobertura de acueducto, alcantarillado y aseo',
                      'Subsecretaría de Servicios Públicos · Alcaldía de Medellín (MEData)', COBERTURA)
    filas = csv_medata(COBERTURA)
    # La fuente da, por comuna y estrato, los suscriptores y la cobertura (suscriptores sobre viviendas). Las viviendas
    # de cada celda se reconstruyen como suscriptores ÷ cobertura y se suman para obtener la cobertura del territorio.
    suscriptores = collections.defaultdict(int)
    viviendas = collections.defaultdict(float)
    for f in filas:
        anio = periodo(f['periodo'])[0]
        codigo = str(f['comuna']).strip().zfill(2)
        s = entero(f['suscriptores'])
        c = float(f['cobertura'].strip().rstrip('%') or 0) / 100
        for clave in ((anio, codigo, f['servicio'], f['estrato']), (anio, codigo, f['servicio'], '*'),
                      (anio, '*', f['servicio'], f['estrato']), (anio, '*', f['servicio'], '*')):
            suscriptores[clave] += s
            if c > 0:
                viviendas[clave] += s / c
    anios = sorted({k[0] for k in suscriptores})
    ultimo = anios[-1]
    vigencia = f'{anios[0]}–{ultimo} (histórico)'
    nota = ('Suscriptores residenciales sobre las viviendas que estima la fuente. La fuente publica la cobertura por '
            'estrato; la del territorio suma los suscriptores y las viviendas de sus estratos. Corte al 31 de diciembre.')
    for servicio in SERVICIOS:
        clave = f'cobertura_{servicio.lower()}'
        terr.indicador(clave, f'Cobertura de {servicio.lower()}', '% de viviendas', fuente, vigencia, estado='derivado',
                       decimales=1, nota=nota)
        for codigo in terr.filas:
            for anio in anios:
                v = viviendas.get((anio, codigo, servicio, '*'))
                if v:
                    terr.valor(codigo, clave, anio, round(suscriptores[(anio, codigo, servicio, '*')] / v * 100, 1))
        total = suscriptores[(ultimo, '*', servicio, '*')] / viviendas[(ultimo, '*', servicio, '*')] * 100
        t.cifra(clave, round(total, 1), '%', f'Cobertura de {servicio.lower()} {ultimo}', fuente, f'{ultimo} (histórico)',
                estado='derivado', decimales=1,
                nota=f'{miles(suscriptores[(ultimo, "*", servicio, "*")])} suscriptores residenciales. {nota}')
    terr.indicador('suscriptores_acueducto', 'Suscriptores residenciales de acueducto', 'suscriptores', fuente, vigencia,
                   nota='Suscriptores de todos los prestadores (EPM y pequeños prestadores). Corte al 31 de diciembre.')
    for codigo in terr.filas:
        for anio in anios:
            if (anio, codigo, 'Acueducto', '*') in suscriptores:
                terr.valor(codigo, 'suscriptores_acueducto', anio, suscriptores[(anio, codigo, 'Acueducto', '*')])
    por_estrato = []
    for estrato in sorted({k[3] for k in suscriptores if k[0] == ultimo and k[3] != '*'}, key=int):
        fila = {'estrato': estrato, 'anio': ultimo}
        for servicio in SERVICIOS:
            v = viviendas.get((ultimo, '*', servicio, estrato))
            fila[servicio.lower()] = round(suscriptores[(ultimo, '*', servicio, estrato)] / v * 100, 1) if v else None
        fila['suscriptores_acueducto'] = suscriptores[(ultimo, '*', 'Acueducto', estrato)]
        por_estrato.append(fila)
    t.lista('cobertura_por_estrato', por_estrato)


# ---------------------------------------------------------------- suscriptores (MEData, hasta 2023)

def suscriptores_epm(t):
    fuente = t.fuente('medata-suscriptores-epm', 'Suscriptores y consumos de acueducto y alcantarillado del gran prestador (EPM)',
                      'Subsecretaría de Servicios Públicos · Alcaldía de Medellín (MEData)', SUSCRIPTORES_EPM)
    filas = [f for f in csv_medata(SUSCRIPTORES_EPM) if f.get('servicio') and f.get('periodo')]
    por_mes = collections.defaultdict(lambda: collections.Counter())
    for f in filas:
        por_mes[f['servicio']][periodo(f['periodo'])] += entero(f['suscriptores'])
    acueducto = por_mes['Acueducto']
    ultimo = max(acueducto)
    fin = etiqueta_mes(*ultimo)
    nota = (f'Histórico: el archivo abierto termina en {fin}. Todos los usos: residencial por estrato, comercial, '
            'industrial, oficial y especial.')
    t.serie('suscriptores_epm_acueducto', [[etiqueta_mes(*k), v] for k, v in sorted(acueducto.items())], 'suscriptores',
            'Suscriptores de acueducto de EPM', fuente, nota=nota)
    for servicio in ('Acueducto', 'Alcantarillado'):
        t.cifra(f'suscriptores_epm_{servicio.lower()}', por_mes[servicio][ultimo], 'suscriptores',
                f'Suscriptores de {servicio.lower()} de EPM', fuente, f'{fin} (histórico)', nota=nota)
    t.lista('suscriptores_epm_por_uso', [
        {'uso': f'Estrato {f["estrato"]}' if f['estrato'].isdigit() else f['estrato'], 'suscriptores': entero(f['suscriptores']),
         'consumo_basico_m3': round(decimal(f['consumo_basico_m3'])), 'periodo': fin}
        for f in filas if f['servicio'] == 'Acueducto' and periodo(f['periodo']) == ultimo])


def suscriptores_pequenos(t, terr):
    fuente = t.fuente('medata-pequenos-prestadores', 'Suscriptores y consumos de los pequeños prestadores de acueducto y alcantarillado',
                      'Subsecretaría de Servicios Públicos · Alcaldía de Medellín (MEData)', SUSCRIPTORES_PEQUENOS)
    filas = [f for f in csv_medata(SUSCRIPTORES_PEQUENOS) if f.get('periodo') and f.get('servicio') == 'Acueducto']
    ultimo = max(periodo(f['periodo']) for f in filas)
    fin = etiqueta_mes(*ultimo)
    recientes = [f for f in filas if periodo(f['periodo']) == ultimo]
    nota = ('Juntas de acción comunal, asociaciones y corporaciones que prestan el acueducto donde no llega la red de '
            f'EPM, sobre todo en los corregimientos. Histórico: el archivo abierto termina en {fin}.')
    t.cifra('suscriptores_pequenos', sum(entero(f['suscriptores']) for f in recientes), 'suscriptores',
            'Suscriptores de acueducto de pequeños prestadores', fuente, f'{fin} (histórico)', nota=nota)
    t.cifra('pequenos_prestadores', len({f['prestador'].strip() for f in recientes}), 'prestadores',
            'Pequeños prestadores de acueducto que reportan', fuente, f'{fin} (histórico)', nota=nota)
    terr.indicador('suscriptores_pequenos', 'Suscriptores de acueducto de pequeños prestadores', 'suscriptores', fuente,
                   f'{fin} (histórico)', nota=f'{nota} Un 0 indica que la fuente no registra pequeños prestadores en el territorio.')
    por_codigo = collections.Counter()
    for f in recientes:
        por_codigo[str(f['id_comuna']).strip().zfill(2)] += entero(f['suscriptores'])
    desconocidos = set(por_codigo) - set(terr.filas)
    if desconocidos:
        raise RuntimeError(f'Códigos de territorio desconocidos en pequeños prestadores: {sorted(desconocidos)}')
    for codigo in terr.filas:
        terr.valor(codigo, 'suscriptores_pequenos', ultimo[0], por_codigo.get(codigo, 0))


def suscriptores_aseo(t):
    fuente = t.fuente('medata-suscriptores-aseo', 'Suscriptores del servicio de aseo (Emvarias)',
                      'Subsecretaría de Servicios Públicos · Alcaldía de Medellín (MEData)', SUSCRIPTORES_ASEO)
    filas = [f for f in csv_medata(SUSCRIPTORES_ASEO) if f.get('periodo')]
    por_mes = collections.Counter()
    for f in filas:
        por_mes[periodo(f['periodo'])] += entero(f['suscriptores'])
    ultimo = max(por_mes)
    fin = etiqueta_mes(*ultimo)
    t.cifra('suscriptores_aseo', por_mes[ultimo], 'suscriptores', 'Suscriptores de aseo de Emvarias', fuente,
            f'{fin} (histórico)', nota=f'Histórico: el archivo abierto termina en {fin}.')


# ---------------------------------------------------------------- subsidios y contribuciones (MEData, hasta 2023)

def subsidios(t, fuente_id, nombre, prestador, url, prefijo):
    fuente = t.fuente(fuente_id, nombre, 'Subsecretaría de Servicios Públicos · Alcaldía de Medellín (MEData)', url)
    filas = [f for f in csv_medata(url) if f.get('periodo') and f.get('prestador', '').strip()]
    subs, contr, subsidiados, totales = (collections.Counter() for _ in range(4))
    for f in filas:
        k = periodo(f['periodo'])
        subs[k] += entero(f['total_subsidio'])
        contr[k] += entero(f['total_contribuciones'])
        subsidiados[k] += entero(f['suscriptores_subsidiados'])
        totales[k] += entero(f['suscriptores_totales'])
    ultimo = max(subs)
    fin = etiqueta_mes(*ultimo)
    completo = max(a for a in {a for a, _ in subs} if all((a, m) in subs for m in range(1, 13)))
    nota = (f'Histórico: el archivo abierto termina en {fin}. Los subsidios rebajan la factura de los estratos 1, 2 y 3; '
            'las contribuciones son el recargo que pagan los estratos 5 y 6 y los usos comercial e industrial.')
    t.serie(f'{prefijo}_subsidios_mensual', [[etiqueta_mes(*k), round(v / 1e6)] for k, v in sorted(subs.items())],
            'millones de $', f'Subsidios otorgados por {prestador} por mes', fuente, nota=nota)
    t.serie(f'{prefijo}_contribuciones_mensual', [[etiqueta_mes(*k), round(v / 1e6)] for k, v in sorted(contr.items())],
            'millones de $', f'Contribuciones recibidas por {prestador} por mes', fuente, nota=nota)
    anual = lambda c: sum(v for (a, _), v in c.items() if a == completo)
    t.cifra(f'{prefijo}_subsidios', round(anual(subs) / 1e6), 'millones de $', f'Subsidios {prestador} {completo}', fuente,
            f'{completo} (histórico)', nota=f'Suma de los 12 meses de {completo}. {nota}')
    t.cifra(f'{prefijo}_contribuciones', round(anual(contr) / 1e6), 'millones de $', f'Contribuciones {prestador} {completo}',
            fuente, f'{completo} (histórico)', nota=f'Suma de los 12 meses de {completo}. {nota}')
    t.cifra(f'{prefijo}_subsidiados', round(subsidiados[ultimo] / totales[ultimo] * 100, 1), '%',
            f'Suscriptores con subsidio · {prestador}', fuente, f'{fin} (histórico)', estado='derivado', decimales=1,
            nota=f'{miles(subsidiados[ultimo])} de {miles(totales[ultimo])} suscriptores.')


# ---------------------------------------------------------------- tarifas (EPM)

def tarifas_agua(t):
    fuente = t.fuente('epm-tarifas-agua', 'Tarifas de acueducto y aguas residuales para hogares',
                      'Empresas Públicas de Medellín (EPM)', f'https://www.datos.gov.co/d/{TARIFAS_AGUA}')
    filas = soql(TARIFAS_AGUA, where="municipio='Medellín' and sector='Residencial'", limit=50000)
    por_mes = collections.defaultdict(dict)
    for f in filas:
        k = (int(f['year']), mes_de_nombre(f['mes']))
        por_mes[k][(f['servicio'], f['estrato'])] = f
    ultimo = max(por_mes)
    fin = etiqueta_mes(*ultimo)
    t.lista('tarifas_agua', [{
        'servicio': servicio, 'estrato': estrato, 'periodo': fin,
        'cargo_fijo': float(f['cargofijo']), 'consumo_basico': float(f['cargoporconsumomenor']),
        'consumo_superior': float(f['cargoporconsumomayor'])}
        for (servicio, estrato), f in sorted(por_mes[ultimo].items())])
    nota = ('Pesos por m³ del consumo básico, con el subsidio o la contribución de cada estrato ya aplicado. El estrato 4 '
            'paga la tarifa plena, sin subsidio ni contribución.')
    for estrato in ('1', '4'):
        puntos = [[etiqueta_mes(*k), float(v[('Acueducto', estrato)]['cargoporconsumomenor'])]
                  for k, v in sorted(por_mes.items()) if ('Acueducto', estrato) in v]
        t.serie(f'acueducto_consumo_e{estrato}', puntos, '$/m³', f'Acueducto: cargo por consumo básico, estrato {estrato}',
                fuente, nota=nota)
    for estrato in ('1', '4'):
        f = por_mes[ultimo][('Acueducto', estrato)]
        t.cifra(f'tarifa_acueducto_e{estrato}', float(f['cargoporconsumomenor']), '$/m³',
                f'Acueducto, estrato {estrato}: consumo básico', fuente, fin, decimales=2,
                nota=f'Cargo fijo: ${f["cargofijo"]} al mes. {nota}')


def tarifas_gas(t):
    fuente = t.fuente('epm-tarifas-gas', 'Tarifas de gas natural para hogares', 'Empresas Públicas de Medellín (EPM)',
                      f'https://www.datos.gov.co/d/{TARIFAS_GAS}')
    filas = soql(TARIFAS_GAS, where="sector='Residencial'", limit=50000)
    por_mes = collections.defaultdict(dict)
    for f in filas:
        por_mes[(int(f['year']), mes_de_nombre(f['mes']))][f['estrato']] = f
    ultimo = max(por_mes)
    fin = etiqueta_mes(*ultimo)
    t.lista('tarifas_gas', [{'estrato': e, 'periodo': fin, 'cargo_fijo': float(f['cargo_fijo']),
                             'consumo_hasta_20': float(f['cargo_por_consumo_menor']),
                             'consumo_mas_de_20': float(f['cargo_por_consumo_mayor'])}
                            for e, f in sorted(por_mes[ultimo].items())])
    nota = ('Mercado del Valle de Aburrá. Pesos por m³ de los primeros 20 m³ del mes, con el subsidio o la contribución '
            'del estrato ya aplicado; el cargo fijo es por usuario.')
    for estrato in ('1', '4'):
        t.serie(f'gas_consumo_e{estrato}', [[etiqueta_mes(*k), float(v[estrato]['cargo_por_consumo_menor'])]
                                           for k, v in sorted(por_mes.items()) if estrato in v],
                '$/m³', f'Gas natural: consumo hasta 20 m³, estrato {estrato}', fuente, nota=nota)
        t.cifra(f'tarifa_gas_e{estrato}', float(por_mes[ultimo][estrato]['cargo_por_consumo_menor']), '$/m³',
                f'Gas natural, estrato {estrato}: hasta 20 m³', fuente, fin, decimales=2, nota=nota)


def numero_pdf(texto):
    """'1150.06' → 1150.06; '9,576' (coma de miles) → 9576."""
    return float(texto.replace(',', ''))


def leer_publicacion_energia(url):
    """Tarifa residencial por estrato (nivel I, propiedad EPM) de una publicación mensual de EPM."""
    contenido = descargar(url, timeout=120)
    texto = subprocess.run(['pdftotext', '-layout', '-', '-'], input=contenido, capture_output=True, check=True).stdout.decode('utf-8')
    fecha = re.search(r'Mercado Regulado\s*-\s*([A-Za-zé]+) de (\d{4})', texto)
    if not fecha:
        raise RuntimeError(f'No se encontró el mes en {url}')
    residencial = texto[texto.index('Tarifa Residencial'):texto.index('Tarifa No Residencial')]
    tarifas, estrato = {}, None
    for linea in residencial.splitlines():
        m = re.match(r'\s*(?:Estrato ([\d y]+)\.)?\s*(Rango 0 - CS|Rango > CS|Todo el consumo)\s+([\d.,]+)', linea)
        if m:
            estrato = (m.group(1) or estrato).replace(' y ', ' y ')
            tarifas[(estrato, m.group(2))] = numero_pdf(m.group(3))
    cu = re.search(r'CU Total\s+([\d.,]+)', texto)
    fijo = re.search(r'Cfm,j \(\$/factura\)\s+([\d.,]+)', texto)
    if len(tarifas) < 7 or not cu:
        raise RuntimeError(f'No se pudieron leer las tarifas residenciales de {url}')
    return {'anio': int(fecha.group(2)), 'mes': mes_de_nombre(fecha.group(1)), 'tarifas': tarifas,
            'cu': numero_pdf(cu.group(1)), 'cargo_fijo': numero_pdf(fijo.group(1)) if fijo else None}


def tarifas_energia(t):
    fuente = t.fuente('epm-tarifas-energia', 'Tarifas y costo de energía eléctrica, mercado regulado (publicación mensual)',
                      'Empresas Públicas de Medellín (EPM)', TARIFAS_ENERGIA, estado='declarado')
    pagina = descargar(TARIFAS_ENERGIA, timeout=60).decode('utf-8', errors='replace')
    # Una publicación por mes para el mercado de Antioquia (_ANT_); si EPM la reemplaza, la página enlaza la nueva.
    enlaces = sorted({urllib.parse.urljoin(EPM, h) for h in re.findall(r'href="([^"]*_ANT_[^"]*\.pdf)"', pagina)})
    if not enlaces:
        raise RuntimeError('La página de tarifas de energía de EPM no enlaza publicaciones')
    meses = {}
    for url in enlaces:
        p = leer_publicacion_energia(url)
        meses[(p['anio'], p['mes'])] = p
    ultimo = max(meses)
    fin = etiqueta_mes(*ultimo)
    p = meses[ultimo]
    nota = ('Pesos por kWh para hogares conectados a la red de EPM en baja tensión (nivel I, activos de EPM), con el '
            'subsidio o la contribución del estrato ya aplicados. Los estratos 1 a 3 tienen subsidio solo en el consumo '
            'de subsistencia (CS); el consumo por encima de él y el estrato 4 pagan el costo unitario.')
    t.lista('tarifas_energia', [{'estrato': e, 'rango': r, 'tarifa': v, 'periodo': fin} for (e, r), v in p['tarifas'].items()])
    for estrato in ('1', '4'):
        rango = 'Rango 0 - CS' if estrato == '1' else 'Todo el consumo'
        t.serie(f'energia_e{estrato}', [[etiqueta_mes(*k), v['tarifas'][(estrato, rango)]] for k, v in sorted(meses.items())],
                '$/kWh', f'Energía, estrato {estrato}{" (consumo de subsistencia)" if estrato == "1" else ""}', fuente,
                estado='declarado', nota=nota)
        t.cifra(f'tarifa_energia_e{estrato}', p['tarifas'][(estrato, rango)], '$/kWh',
                f'Energía, estrato {estrato}{": consumo de subsistencia" if estrato == "1" else ""}', fuente, fin,
                estado='declarado', decimales=2, nota=nota)
    if p['cargo_fijo']:
        t.cifra('energia_cargo_fijo', p['cargo_fijo'], '$/factura', 'Energía: cargo fijo por factura', fuente, fin,
                estado='declarado', nota='Componente fijo del costo unitario, igual para todos los estratos.')


# ---------------------------------------------------------------- aprovechamiento: ECAS y recicladoras (MEData)

def ecas(t):
    fuente = t.fuente('superservicios-ecas', 'Registro de estaciones de clasificación y aprovechamiento (ECA)',
                      'Superintendencia de Servicios Públicos Domiciliarios', f'https://www.datos.gov.co/d/{ECAS}')
    filas = soql(ECAS, where="upper(municipio) like '%MEDELL%'", limit=5000)
    # El registro guarda una fila por certificación: el estado vigente de cada ECA es el de su última certificación.
    ultima = {}
    for f in filas:
        clave = (f.get('fecha_de_certificaci_n', ''), f.get('fecha_estado', ''))
        if f['nueca'] not in ultima or clave > ultima[f['nueca']][0]:
            ultima[f['nueca']] = (clave, f)
    operando = [f for _, f in ultima.values() if f['estado_nueca'] == 'EN OPERACION']
    if not operando:
        raise RuntimeError('El registro de la Superservicios no trae ECA en operación en Medellín')
    corte = max(f.get('fecha_de_certificaci_n', '') for f in filas)[:10]
    vigencia = f'Certificado hasta {corte}'
    nota = ('Estaciones donde los prestadores de aprovechamiento (en su mayoría organizaciones de recicladores de oficio) '
            'pesan, clasifican y venden el material reciclable. Estado según la última certificación de cada ECA ante la '
            'Superservicios.')
    capacidad = sum(float(f.get('capacidad_de_operacion') or 0) for f in operando)
    t.cifra('ecas', len(operando), 'estaciones', 'ECA en operación', fuente, vigencia,
            nota=f'{nota} Otras {len(ultima) - len(operando)} registradas figuran inactivas.')
    t.cifra('ecas_capacidad', round(capacidad), 't/mes', 'Capacidad de operación de las ECA', fuente, vigencia,
            nota=f'Suma de la capacidad de operación declarada por las {len(operando)} ECA en operación, en toneladas al mes.')
    t.cifra('ecas_prestadores', len({f['id_de_la_empresa'] for f in operando}), 'prestadores',
            'Prestadores de aprovechamiento con ECA en operación', fuente, vigencia, nota=nota)
    t.cifra('ecas_suelo_compatible', sum(f.get('suelo_compatible') == 'SI' for f in operando), 'estaciones',
            'ECA en operación con uso del suelo compatible', fuente, vigencia,
            nota='Según lo que declara cada prestador: el POT permite la actividad en el predio.')
    t.lista('ecas', sorted(({'nombre': f['nombre_de_la_eca'].strip(), 'prestador': re.sub(r'\s+', ' ', f['nombre_empresa']).strip(),
                             'inicio': (f.get('fecha_inicio_de_operaci_n') or '')[:10],
                             'capacidad': float(f.get('capacidad_de_operacion') or 0),
                             'suelo_compatible': f.get('suelo_compatible') == 'SI',
                             'autorizacion_ambiental': f.get('autorizaci_n_ambiental') == 'SI'} for f in operando),
                           key=lambda e: -e['capacidad']))


def recicladoras(t):
    fuente = t.fuente('medata-recicladoras', 'Organizaciones recicladoras',
                      'Subsecretaría de Servicios Públicos · Alcaldía de Medellín (MEData)', RECICLADORAS)
    orgs = [f for f in csv_medata(RECICLADORAS) if (f.get('nombre_organizacion') or '').strip()]
    t.cifra('organizaciones_recicladoras', len(orgs), 'organizaciones', 'Organizaciones de recicladores registradas', fuente,
            'Registro sin fecha (MEData lo fecha en noviembre de 2023)',
            nota='Organizaciones de recicladores de oficio registradas ante la Alcaldía. El archivo no trae fecha.')
    t.lista('organizaciones_recicladoras', [{'nombre': f['nombre_organizacion'].strip(), 'direccion': f['direccion'].strip()}
                                            for f in orgs])


# ---------------------------------------------------------------- internet fijo (MinTIC)

def archivo_internet(url):
    """El CSV de accesos pesa unos 130 MB y el servidor es lento (5 minutos): se guarda en datos/crudos y solo se
    vuelve a bajar si cambia de tamaño."""
    destino = DIR_CRUDOS / url.rsplit('/', 1)[1]
    req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        tamano = int(r.headers.get('Content-Length') or 0)
    if not destino.exists() or destino.stat().st_size != tamano:
        DIR_CRUDOS.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(descargar(url, timeout=1200))
    return destino


def internet(t):
    ficha = json_url(f'https://www.datos.gov.co/api/views/{INTERNET}.json')
    urls = [u for u in (ficha.get('metadata') or {}).get('accessPoints', {}).values() if 'ACCESOS_INTERNET_FIJO' in u]
    if not urls:
        raise RuntimeError('La ficha del MinTIC no enlaza el CSV de accesos de internet fijo')
    fuente = t.fuente('mintic-internet-fijo', 'Accesos a internet fijo por municipio, segmento y tecnología',
                      'Ministerio de Tecnologías de la Información y las Comunicaciones', urls[0])
    por_trimestre, por_segmento = collections.Counter(), collections.Counter()
    with open(archivo_internet(urls[0]), encoding='utf-8-sig', newline='') as archivo:
        lector = csv.DictReader(archivo, delimiter=';')
        for f in lector:
            if f['ID_MUNICIPIO'] == '5001':
                k = (int(f['ANNO']), int(f['TRIMESTRE']))
                accesos = int(f['ACCESOS'] or 0)
                por_trimestre[k] += accesos
                por_segmento[(k, f['SEGMENTO'].strip())] += accesos
    if not por_trimestre:
        raise RuntimeError('El archivo del MinTIC no trae accesos de Medellín')
    ultimo = max(por_trimestre)
    etiqueta = lambda k: f'T{k[1]} {k[0]}'
    nota = ('Accesos (conexiones) de internet fijo reportados por los operadores, no hogares ni personas: un hogar o una '
            'empresa puede tener más de uno.')
    t.cifra('internet_fijo', por_trimestre[ultimo], 'accesos', 'Accesos a internet fijo', fuente, etiqueta(ultimo),
            ancla=True, nota=nota)
    residencial = sum(v for (k, s), v in por_segmento.items() if k == ultimo and s.startswith('Residencial'))
    t.cifra('internet_fijo_residencial', residencial, 'accesos', 'Accesos residenciales a internet fijo', fuente,
            etiqueta(ultimo), nota=f'Estratos 1 a 6. {nota}')
    t.serie('internet_fijo_trimestral', [[etiqueta(k), v] for k, v in sorted(por_trimestre.items())], 'accesos',
            'Accesos a internet fijo por trimestre', fuente, nota=nota)
    t.lista('internet_por_segmento', [{'segmento': s, 'accesos': v, 'periodo': etiqueta(k)}
                                      for (k, s), v in sorted(por_segmento.items(), key=lambda x: -x[1]) if k == ultimo])
    # Por comuna no hay dato abierto: se deja la cifra como candidata, con la fuente probada, para no omitirla en silencio.
    candidata = t.fuente('internet-fijo-comuna', 'Cobertura de internet fijo por comuna', 'MinTIC y operadores',
                         f'https://www.datos.gov.co/d/{INTERNET}', estado='candidato',
                         uso='Cobertura por comuna: no publicada')
    t.cifra('internet_fijo_comuna', None, 'accesos', 'Internet fijo por comuna', candidata, 'No publicada', estado='candidato',
            nota='El MinTIC publica los accesos por municipio, segmento y tecnología, no por comuna, y los operadores no '
                 'publican su cobertura por barrio. Queda como candidata hasta que exista un dato abierto.')


# ---------------------------------------------------------------- principal

LISTAS = {'medata-cobertura-servicios': ['cobertura_por_estrato'], 'medata-suscriptores-epm': ['suscriptores_epm_por_uso'],
          'epm-tarifas-agua': ['tarifas_agua'], 'epm-tarifas-gas': ['tarifas_gas'], 'epm-tarifas-energia': ['tarifas_energia'],
          'superservicios-ecas': ['ecas'], 'medata-recicladoras': ['organizaciones_recicladoras'], 'mintic-internet-fijo': ['internet_por_segmento']}


def main():
    t = Tema('servicios', 'Servicios públicos')
    terr = Territorios()
    with t.bloque('medata-cobertura-servicios'):
        cobertura(t, terr)
    with t.bloque('medata-suscriptores-epm'):
        suscriptores_epm(t)
    with t.bloque('medata-pequenos-prestadores'):
        suscriptores_pequenos(t, terr)
    with t.bloque('medata-suscriptores-aseo'):
        suscriptores_aseo(t)
    with t.bloque('medata-subsidios-epm'):
        subsidios(t, 'medata-subsidios-epm', 'Subsidios y contribuciones de acueducto y alcantarillado del gran prestador (EPM)',
                  'EPM', SUBSIDIOS_EPM, 'epm')
    with t.bloque('medata-subsidios-aseo'):
        subsidios(t, 'medata-subsidios-aseo', 'Subsidios y contribuciones del servicio de aseo (Emvarias)', 'Emvarias',
                  SUBSIDIOS_ASEO, 'aseo')
    with t.bloque('epm-tarifas-agua'):
        tarifas_agua(t)
    with t.bloque('epm-tarifas-gas'):
        tarifas_gas(t)
    with t.bloque('epm-tarifas-energia'):
        tarifas_energia(t)
    with t.bloque('superservicios-ecas'):
        ecas(t)
    with t.bloque('medata-recicladoras'):
        recicladoras(t)
    # Internet fijo declara dos fuentes (la observada y la candidata por comuna): si falla, cada bloque hereda lo suyo.
    try:
        internet(t)
        error = None
    except Exception as e:  # se relanza dentro del bloque de cada fuente
        error = e
    for fuente in ('mintic-internet-fijo', 'internet-fijo-comuna'):
        with t.bloque(fuente):
            if error:
                raise error

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
