"""Municipio: presupuesto del Distrito (CUIPO, Contraloría), inversión pública por comuna y corregimiento (Alcaldía),
contratación en SECOP II (Colombia Compra Eficiente), acuerdos y proyectos del Concejo y la facturación del impuesto
predial por comuna de cobro (MEData).

Los archivos "Comportamiento de ingresos" y "Comportamiento de gastos de inversión" de MEData no se usan: no traen el
año y su vigencia no se pudo confirmar (ver docs/fuentes-medellin.md). CUIPO publica el mismo presupuesto con año y
trimestre de corte.
"""

import collections
import csv
import io
import re

from lago import MESES, Tema, Territorios, arcgis, descargar, hoy, json_url

ALC = 'https://www.medellin.gov.co/servidormapas/rest/services'
INVERSION = f'{ALC}/hacienda_credi_publ/VM_Inversion_Publica/MapServer/0'
MEDELLIN = '210105001'  # código CHIP del Distrito de Medellín en CUIPO
CUIPO = {'ingresos_programacion': '22ah-ddsj', 'ingresos_ejecucion': '9axr-9gnb',
         'gastos_programacion': 'd9mu-h6ar', 'gastos_ejecucion': '4f7r-epif'}
SECOP = 'jbjy-vk9h'
DISTRITO = 'DISTRITO ESPECIAL DE CIENCIA TECNOLOGIA E INNOVACION DE MEDELLIN'
ACUERDOS, PROYECTOS = '9smt-mgt4', 'sqkr-77ej'
PREDIAL = ('http://medata.gov.co/sites/default/files/distribution/1-016-12-000302/'
           'facturacion_historica_impuesto_predial_unificado_por_concepto_por_comuna_de_cobro.csv')

BILLON = 1e12
MILLON = 1e6
# Vigencia actual del gasto: lo apropiado para el año, incluidas las vigencias futuras que se ejecutan en él. Las
# reservas y cuentas por pagar son compromisos de años anteriores y no se suman.
VIGENCIA_ACTUAL = ('VIGENCIA ACTUAL', 'VIGENCIAS FUTURAS - VIGENCIA ACTUAL')
CUENTAS_INGRESOS = {'1': 'Ingresos totales', '1.1': 'Ingresos corrientes', '1.1.01': 'Tributarios',
                    '1.1.02': 'No tributarios', '1.2': 'Recursos de capital',
                    '1.1.01.01.200': 'Impuesto predial unificado', '1.1.01.02.200': 'Impuesto de industria y comercio'}
CUENTAS_GASTOS = {'2': 'Gastos totales', '2.1': 'Funcionamiento', '2.2': 'Servicio de la deuda', '2.3': 'Inversión'}
# Sectores del catálogo de programas de la MGA (DNP): los dos primeros dígitos del código programático.
SECTORES_MGA = {
    '02': 'Presidencia', '03': 'Planeación', '04': 'Información estadística', '05': 'Función pública',
    '12': 'Justicia y del derecho', '13': 'Hacienda', '15': 'Defensa y policía', '17': 'Agricultura y desarrollo rural',
    '19': 'Salud y protección social', '21': 'Minas y energía', '22': 'Educación',
    '23': 'Tecnologías de la información y las comunicaciones', '24': 'Transporte', '25': 'Organismos de control',
    '32': 'Ambiente y desarrollo sostenible', '33': 'Cultura', '35': 'Comercio, industria y turismo', '36': 'Trabajo',
    '37': 'Interior', '39': 'Ciencia, tecnología e innovación', '40': 'Vivienda, ciudad y territorio',
    '41': 'Inclusión social y reconciliación', '43': 'Deporte y recreación', '45': 'Gobierno territorial',
}
# Comunas de cobro del predial: 1 a 16 son las comunas; los corregimientos tienen códigos propios, y del 21 en adelante
# son otros municipios a los que se envía el cobro (50 es Casanare, no Palmitas). 18 es "San Cristóbal - Palmitas", dos
# corregimientos juntos: no se reparte.
PREDIAL_CODIGOS = {**{str(n): str(n).zfill(2) for n in range(1, 17)}, '17': '80', '19': '90', '20': '70'}
# SECOP II trae valores imposibles (un contrato de 7,7 × 10²⁰ pesos en 2019). Se excluyen los que superan el
# presupuesto anual completo del Distrito.
SECOP_TOPE = 10 * BILLON


def soql(recurso, **consulta):
    """Consulta SoQL en datos.gov.co (como lago.socrata, pero con las claves ya sin el signo $)."""
    params = {f'${k}': v for k, v in consulta.items()}
    return json_url(f'https://www.datos.gov.co/resource/{recurso}.json', params)


def numero(texto):
    try:
        return float(texto)
    except (TypeError, ValueError):
        return 0.0


def billones(valor):
    return round(valor / BILLON, 3)


def corte(periodo):
    """'20250601' → (2025, 'jun 2025'). CUIPO acumula desde enero; el mes es el último del trimestre reportado."""
    anio, mes = int(periodo[:4]), int(periodo[4:6])
    return anio, f'{MESES[mes - 1]} {anio}'


def fmt(valor, decimales=2):
    return f'{valor:,.{decimales}f}'.replace(',', 'X').replace('.', ',').replace('X', '.')


# ---------------------------------------------------------------- presupuesto (CUIPO)

def programacion_ingresos():
    """Presupuesto inicial y definitivo de ingresos por periodo y cuenta.

    La tabla de datos.gov.co publica las columnas corridas: el código de la cuenta llega en `ambito_codigo`, el
    presupuesto inicial en `cod_detalle_sectorial` y el definitivo en `nom_detalle_sectorial`. Se aceptan los dos
    órdenes por si la Contraloría lo corrige.
    """
    cuentas = ', '.join(f"'{c}'" for c in CUENTAS_INGRESOS)
    filas = soql(CUIPO['ingresos_programacion'], where=f"codigo_entidad='{MEDELLIN}' and "
                 f"(cuenta in ({cuentas}) or ambito_codigo in ({cuentas}))", limit=5000)
    datos = {}
    for f in filas:
        if f.get('cuenta') in CUENTAS_INGRESOS:
            cuenta, inicial, definitivo = f['cuenta'], f.get('presupuesto_inicial'), f.get('presupuesto_definitivo')
        else:
            cuenta, inicial, definitivo = f['ambito_codigo'], f.get('cod_detalle_sectorial'), f.get('nom_detalle_sectorial')
        datos[(f['periodo'], cuenta)] = (numero(inicial), numero(definitivo))
    return datos


def presupuesto(t):
    fuente_ing = t.fuente('cuipo-ingresos', 'CUIPO · programación y ejecución de ingresos del Distrito de Medellín',
                          'Contraloría General de la República', f'https://www.datos.gov.co/d/{CUIPO["ingresos_ejecucion"]}')
    fuente_gas = t.fuente('cuipo-gastos', 'CUIPO · programación y ejecución de gastos del Distrito de Medellín',
                          'Contraloría General de la República', f'https://www.datos.gov.co/d/{CUIPO["gastos_ejecucion"]}')
    entidad = f"codigo_entidad='{MEDELLIN}'"

    recaudo = {}
    for f in soql(CUIPO['ingresos_ejecucion'], select='periodo, cuenta, sum(total_recaudo) as r',
                  where=f"{entidad} and cuenta in ({', '.join(repr(c) for c in CUENTAS_INGRESOS)})",
                  group='periodo, cuenta', limit=5000):
        recaudo[(f['periodo'], f['cuenta'])] = numero(f['r'])
    prog_ing = programacion_ingresos()

    vigencia = ', '.join(repr(v) for v in VIGENCIA_ACTUAL)
    apropiacion = collections.defaultdict(lambda: [0.0, 0.0])
    for f in soql(CUIPO['gastos_programacion'], select='periodo, cuenta, sum(apropiacion_inicial) as i, '
                  'sum(apropiacion_definitiva) as d', where=f"{entidad} and cuenta in ('2', '2.1', '2.2') and "
                  f"nom_vigencia_del_gasto in ({vigencia})", group='periodo, cuenta', limit=5000):
        apropiacion[(f['periodo'], f['cuenta'])] = [numero(f['i']), numero(f['d'])]
    ejecucion = {}
    for f in soql(CUIPO['gastos_ejecucion'], select='periodo, cuenta, sum(compromisos) as c, sum(obligaciones) as o, '
                  'sum(pagos) as p', where=f"{entidad} and cuenta in ('2', '2.1', '2.2', '2.3') and "
                  f"nom_vigencia_del_gasto in ({vigencia})", group='periodo, cuenta', limit=5000):
        ejecucion[(f['periodo'], f['cuenta'])] = [numero(f['c']), numero(f['o']), numero(f['p'])]

    # Último periodo de cada año: CUIPO acumula de enero al corte, así que el último trimestre reportado es el dato
    # del año. Un año está completo cuando llega el corte de diciembre.
    periodos = sorted({p for p, c in recaudo if c == '1'} & {p for p, c in ejecucion if c == '2'})
    if not periodos:
        raise RuntimeError('CUIPO no devolvió periodos con ingresos y gastos para Medellín')
    ultimo_por_anio = {}
    for p in periodos:
        ultimo_por_anio[int(p[:4])] = p
    completos = [a for a, p in ultimo_por_anio.items() if p.endswith('1201')]
    if not completos:
        raise RuntimeError('CUIPO no tiene ningún año completo para Medellín')
    completo = max(completos)
    actual = max(ultimo_por_anio)

    filas = []
    for anio, p in sorted(ultimo_por_anio.items()):
        # La programación de la inversión no llega agregada en la cuenta 2.3: es el total menos funcionamiento y deuda.
        ini = {c: apropiacion[(p, c)][0] for c in ('2', '2.1', '2.2')}
        dfn = {c: apropiacion[(p, c)][1] for c in ('2', '2.1', '2.2')}
        fila = {'anio': anio, 'corte': corte(p)[1], 'completo': p.endswith('1201'),
                'ingresos_inicial': prog_ing.get((p, '1'), (0, 0))[0], 'ingresos_definitivo': prog_ing.get((p, '1'), (0, 0))[1],
                'recaudo': recaudo.get((p, '1'), 0),
                'gastos_inicial': ini['2'], 'gastos_definitivo': dfn['2'],
                'compromisos': ejecucion.get((p, '2'), [0, 0, 0])[0], 'pagos': ejecucion.get((p, '2'), [0, 0, 0])[2]}
        for cuenta, clave in (('2.1', 'funcionamiento'), ('2.2', 'deuda'), ('2.3', 'inversion')):
            fila[f'{clave}_inicial'] = ini['2'] - ini['2.1'] - ini['2.2'] if cuenta == '2.3' else ini[cuenta]
            fila[f'{clave}_definitivo'] = dfn['2'] - dfn['2.1'] - dfn['2.2'] if cuenta == '2.3' else dfn[cuenta]
            fila[f'{clave}_compromisos'] = ejecucion.get((p, cuenta), [0, 0, 0])[0]
        filas.append({k: (round(v) if isinstance(v, float) else v) for k, v in fila.items()})
    t.lista('presupuesto_anual', filas)

    nota_billon = 'Billones de pesos corrientes (un billón es un millón de millones).'
    por_anio = {f['anio']: f for f in filas}
    a, c = por_anio[actual], por_anio[completo]
    t.cifra('presupuesto_inicial', billones(a['gastos_inicial']), 'billones de $', f'Presupuesto inicial de gastos {actual}',
            fuente_gas, str(actual), ancla=True, decimales=2,
            nota=f'Apropiación inicial del Distrito para {actual}, tal como la reporta a CUIPO: administración central, '
                 f'Concejo, Personería y Contraloría. Los establecimientos públicos (Aeropuerto Olaya Herrera, Biblioteca '
                 f'Pública Piloto…) reportan por separado y no están incluidos. {nota_billon}')
    if a['gastos_definitivo'] and not a['completo']:
        t.cifra('presupuesto_definitivo_actual', billones(a['gastos_definitivo']), 'billones de $',
                f'Presupuesto definitivo de gastos {actual}', fuente_gas, f'corte {a["corte"]}', decimales=2,
                nota=f'Apropiación con las adiciones y reducciones hechas hasta el corte. {nota_billon}')
    t.cifra('presupuesto_definitivo', billones(c['gastos_definitivo']), 'billones de $',
            f'Presupuesto definitivo de gastos {completo}', fuente_gas, str(completo), decimales=2,
            nota=f'Apropiación al cierre del año, con adiciones y reducciones. {nota_billon}')
    t.cifra('gastos_comprometidos', billones(c['compromisos']), 'billones de $', f'Gastos comprometidos {completo}',
            fuente_gas, str(completo), decimales=2,
            nota=f'Compromisos (contratos y demás obligaciones adquiridas) de la vigencia {completo}. {nota_billon}')
    t.cifra('inversion_comprometida', billones(c['inversion_compromisos']), 'billones de $',
            f'Inversión comprometida {completo}', fuente_gas, str(completo), decimales=2,
            nota=f'Compromisos del presupuesto de inversión de {completo}. {nota_billon}')
    if c['gastos_definitivo']:
        t.cifra('ejecucion_gastos', round(c['compromisos'] / c['gastos_definitivo'] * 100, 1), '%',
                f'Gastos comprometidos sobre el presupuesto definitivo {completo}', fuente_gas, str(completo),
                estado='derivado', decimales=1,
                nota=f'{fmt(c["compromisos"] / BILLON)} ÷ {fmt(c["gastos_definitivo"] / BILLON)} billones de pesos.')
    t.cifra('ingresos_recaudados', billones(c['recaudo']), 'billones de $', f'Ingresos recaudados {completo}', fuente_ing,
            str(completo), decimales=2,
            nota=f'Recaudo total de la vigencia, incluidos los recursos de capital (crédito, excedentes de EPM y '
                 f'rendimientos). {nota_billon}')
    if not a['completo']:
        t.cifra('ingresos_recaudados_actual', billones(a['recaudo']), 'billones de $', f'Ingresos recaudados {actual}',
                fuente_ing, f'ene–{a["corte"]}', decimales=2, nota=f'Acumulado del año hasta el corte. {nota_billon}')
        t.cifra('gastos_comprometidos_actual', billones(a['compromisos']), 'billones de $',
                f'Gastos comprometidos {actual}', fuente_gas, f'ene–{a["corte"]}', decimales=2,
                nota=f'Acumulado del año hasta el corte. {nota_billon}')

    p = ultimo_por_anio[completo]
    composicion = [{'cuenta': cuenta, 'nombre': CUENTAS_INGRESOS[cuenta], 'recaudo': round(recaudo.get((p, cuenta), 0))}
                   for cuenta in ('1.1.01', '1.1.02', '1.2', '1.1.01.01.200', '1.1.01.02.200')]
    t.lista('ingresos_composicion', composicion)
    for cuenta, clave in (('1.1.01.01.200', 'predial_recaudo'), ('1.1.01.02.200', 'ica_recaudo')):
        if recaudo.get((p, cuenta)):
            t.cifra(clave, billones(recaudo[(p, cuenta)]), 'billones de $', f'{CUENTAS_INGRESOS[cuenta]}: recaudo {completo}',
                    fuente_ing, str(completo), decimales=2, nota=f'Vigencia actual y anteriores. {nota_billon}')

    # Inversión por sector: el sector es el prefijo del código programático de la MGA en las filas de detalle.
    sectores = collections.Counter()
    for f in soql(CUIPO['gastos_ejecucion'], select='cod_programatico_mga as mga, sum(compromisos) as c',
                  where=f"{entidad} and periodo='{p}' and starts_with(cuenta, '2.3') and "
                        f"nom_vigencia_del_gasto in ({vigencia}) and cod_programatico_mga not in ('NO APLICA', '0')",
                  group='mga', limit=5000):
        sectores[f['mga'][:2]] += numero(f['c'])
    total_sectores = sum(sectores.values())
    if total_sectores and abs(total_sectores - c['inversion_compromisos']) > 0.01 * c['inversion_compromisos']:
        raise RuntimeError(f'La inversión por sector ({total_sectores:,.0f}) no cuadra con la cuenta 2.3 '
                           f'({c["inversion_compromisos"]:,.0f})')
    t.lista('inversion_por_sector', [{'codigo': k, 'sector': SECTORES_MGA.get(k, f'Sector MGA {k}'), 'anio': completo,
                                      'compromisos': round(v)} for k, v in sectores.most_common() if v > 0])


# ---------------------------------------------------------------- inversión pública por comuna (Alcaldía)

def inversion_comunas(t, terr):
    fuente = t.fuente('alcaldia-inversion-comunas', 'Inversión pública por comuna y corregimiento',
                      'Departamento Administrativo de Planeación · Alcaldía de Medellín', INVERSION)
    filas = arcgis(INVERSION)
    anios = sorted(int(m.group(1)) for campo in filas[0] if (m := re.fullmatch(r'inversion_(\d{4})', campo)))
    if len(filas) != 21 or not anios:
        raise RuntimeError(f'La capa de inversión trae {len(filas)} territorios y los años {anios}')
    totales = {a: sum(f[f'inversion_{a}'] or 0 for f in filas) for a in anios}
    anios = [a for a in anios if totales[a] > 0]
    vigencia = f'{anios[0]}–{anios[-1]}'
    nota = ('Inversión ordenada (facturada o pagada) de cada vigencia, con corte al 31 de diciembre, según la ubicación '
            'de los proyectos. Pesos corrientes, sin ajustar por inflación.')
    terr.indicador('inversion_publica', 'Inversión pública', 'millones de $', fuente, vigencia, nota=nota)
    terr.indicador('inversion_participacion', 'Participación en la inversión de la ciudad', '%', fuente, vigencia,
                   estado='derivado', decimales=1,
                   nota='Inversión del territorio sobre la suma de los 21 territorios en el mismo año.')
    for f in filas:
        for a in anios:
            valor = f[f'inversion_{a}']
            if valor is not None:
                terr.valor(f['codigo'], 'inversion_publica', a, round(valor / MILLON))
                terr.valor(f['codigo'], 'inversion_participacion', a, round(valor / totales[a] * 100, 2))
    ultimo = anios[-1]
    t.serie('inversion_comunas_anual', [[str(a), billones(totales[a])] for a in anios], 'billones de $',
            'Inversión pública localizada en comunas y corregimientos', fuente, nota=nota)
    t.cifra('inversion_comunas', billones(totales[ultimo]), 'billones de $',
            f'Inversión localizada en comunas y corregimientos {ultimo}', fuente, str(ultimo), decimales=2,
            nota=f'Suma de los 21 territorios. {nota}')


# ---------------------------------------------------------------- contratación (SECOP II)

def secop(t):
    fuente = t.fuente('secop2-distrito', 'SECOP II · contratos electrónicos del Distrito de Medellín',
                      'Colombia Compra Eficiente', f'https://www.datos.gov.co/d/{SECOP}')
    base = (f"nombre_entidad='{DISTRITO}' and estado_contrato not in ('Cancelado', 'Borrador') and "
            'fecha_de_firma is not null')
    valido = f'{base} and valor_del_contrato < {SECOP_TOPE:.0f}'
    por_anio = soql(SECOP, select='date_extract_y(fecha_de_firma) as a, count(*) as n, sum(valor_del_contrato) as v, '
                    'max(fecha_de_firma) as ultima', where=valido, group='a', order='a', limit=100)
    anios = {int(f['a']): (int(f['n']), numero(f['v']), f['ultima'][:10]) for f in por_anio if f.get('a')}
    excluidos = int(soql(SECOP, select='count(*) as n', where=f'{base} and valor_del_contrato >= {SECOP_TOPE:.0f}')[0]['n'])
    ultima = max(u for _, _, u in anios.values())
    actual = int(ultima[:4])
    completo = actual - 1 if ultima[5:] < '12-15' else actual
    # El Distrito empezó a usar SECOP II en 2017 con unos pocos contratos: la serie empieza en el primer año con más
    # de 500.
    inicio = min(a for a, (n, _, _) in anios.items() if n > 500)
    excluido = (f'Se excluye{"n" if excluidos > 1 else ""} {excluidos} contrato{"s" if excluidos > 1 else ""} con un valor '
                f'registrado mayor que el presupuesto anual del Distrito (errores de digitación).' if excluidos else '')
    nota = (f'Contratos firmados por la administración central del Distrito en SECOP II, sin los cancelados ni los '
            f'borradores. {excluido} No incluye al Concejo, la Personería ni las entidades descentralizadas, que '
            f'contratan por separado.')
    t.serie('contratos_secop_anual', [[str(a), anios[a][0]] for a in sorted(anios) if inicio <= a <= completo],
            'contratos', 'Contratos firmados por año', fuente, nota=nota)
    t.serie('valor_secop_anual', [[str(a), billones(anios[a][1])] for a in sorted(anios) if inicio <= a <= completo],
            'billones de $', 'Valor de los contratos firmados por año', fuente, nota=f'Pesos corrientes. {nota}')
    t.cifra('contratos_secop', anios[completo][0], 'contratos', f'Contratos firmados en SECOP II {completo}', fuente,
            str(completo), nota=nota)
    t.cifra('valor_secop', billones(anios[completo][1]), 'billones de $', f'Valor contratado en SECOP II {completo}',
            fuente, str(completo), decimales=2, nota=f'Valor inicial de los contratos, en pesos corrientes. {nota}')
    if actual > completo:
        vigencia = f'ene–{MESES[int(ultima[5:7]) - 1]} {actual}'
        t.cifra('contratos_secop_actual', anios[actual][0], 'contratos', f'Contratos firmados en SECOP II {actual}',
                fuente, vigencia, nota=nota)

    del_anio = f"{valido} and fecha_de_firma >= '{completo}-01-01' and fecha_de_firma < '{completo + 1}-01-01'"
    tipos = soql(SECOP, select='tipo_de_contrato as tipo, count(*) as n, sum(valor_del_contrato) as v', where=del_anio,
                 group='tipo', order='v desc', limit=50)
    t.lista('secop_por_tipo', [{'tipo': f['tipo'], 'anio': completo, 'contratos': int(f['n']), 'valor': round(numero(f['v']))}
                               for f in tipos])
    mayores = soql(SECOP, select='objeto_del_contrato, descripcion_del_proceso, tipo_de_contrato, modalidad_de_contratacion, '
                   'valor_del_contrato, fecha_de_firma, proveedor_adjudicado, urlproceso', where=del_anio,
                   order='valor_del_contrato desc', limit=10)
    t.lista('secop_mayores', [{
        'objeto': (f.get('objeto_del_contrato') or f.get('descripcion_del_proceso') or '').strip()[:400],
        'tipo': f.get('tipo_de_contrato'), 'modalidad': f.get('modalidad_de_contratacion'),
        'valor': round(numero(f['valor_del_contrato'])), 'fecha': f['fecha_de_firma'][:10],
        'proveedor': f.get('proveedor_adjudicado'),
        'url': (f.get('urlproceso') or {}).get('url') if isinstance(f.get('urlproceso'), dict) else f.get('urlproceso'),
    } for f in mayores])


# ---------------------------------------------------------------- Concejo de Medellín

def concejo(t):
    f_acu = t.fuente('concejo-acuerdos', 'Acuerdos sancionados', 'Concejo de Medellín', f'https://www.datos.gov.co/d/{ACUERDOS}')
    f_pro = t.fuente('concejo-proyectos', 'Proyectos de acuerdo', 'Concejo de Medellín', f'https://www.datos.gov.co/d/{PROYECTOS}')
    acuerdos = soql(ACUERDOS, limit=50000)
    proyectos = soql(PROYECTOS, limit=50000)
    anio_hoy = hoy().year

    def anio(fila):
        # Hay años mal digitados ("5006", "2204"): solo se aceptan los del periodo con registro completo.
        texto = str(fila.get('a_o') or '')
        return int(texto) if texto.isdigit() and 2008 <= int(texto) <= anio_hoy else None

    acu_anio = collections.Counter(a for f in acuerdos if (a := anio(f)))
    pro_anio = collections.Counter(a for f in proyectos if (a := anio(f)))
    sanciones = sorted(f['fecha_de_sancion'].replace('/', '-') for f in acuerdos
                       if re.fullmatch(r'20\d\d/\d\d/\d\d', f.get('fecha_de_sancion') or '') and f['fecha_de_sancion'][:4] <= str(anio_hoy))
    ultima_sancion = sanciones[-1]
    completo = max(a for a in acu_anio if a < anio_hoy)
    nota_acu = ('El año es el del acuerdo; se sanciona semanas después de aprobado, así que los de diciembre pueden '
                'quedar firmados en enero.')
    t.serie('acuerdos_anual', [[str(a), acu_anio.get(a, 0)] for a in range(2008, completo + 1)], 'acuerdos',
            'Acuerdos sancionados por año', f_acu, nota=nota_acu)
    t.serie('proyectos_anual', [[str(a), pro_anio.get(a, 0)] for a in range(2008, completo + 1)], 'proyectos',
            'Proyectos de acuerdo radicados por año', f_pro)
    t.cifra('acuerdos', acu_anio[completo], 'acuerdos', f'Acuerdos sancionados {completo}', f_acu, str(completo),
            nota=f'{nota_acu} Último acuerdo sancionado en la fuente: {ultima_sancion}.')
    t.cifra('proyectos', pro_anio[completo], 'proyectos', f'Proyectos de acuerdo radicados {completo}', f_pro,
            str(completo))
    if pro_anio.get(anio_hoy):
        t.cifra('proyectos_actual', pro_anio[anio_hoy], 'proyectos', f'Proyectos de acuerdo radicados {anio_hoy}', f_pro,
                f'{anio_hoy} (parcial)', nota='La fuente no publica la fecha de radicación, solo el año.')

    # Periodo constitucional en curso: 2024–2027, 2028–2031… (empiezan en años bisiestos desde 2008).
    inicio = anio_hoy - (anio_hoy - 2008) % 4
    temas = collections.Counter(f.get('tema') or 'Sin tema' for f in acuerdos if (a := anio(f)) and a >= inicio)
    t.lista('acuerdos_por_tema', [{'tema': k, 'acuerdos': n, 'desde': inicio} for k, n in temas.most_common()])
    recientes = sorted((f for f in acuerdos if anio(f) and re.fullmatch(r'\d{4}/\d\d/\d\d', f.get('fecha_de_sancion') or '')),
                       key=lambda f: (f['fecha_de_sancion'], int(f['numero_de_acuerdo']) if f['numero_de_acuerdo'].isdigit() else 0),
                       reverse=True)[:10]
    t.lista('acuerdos_recientes', [{'numero': f['numero_de_acuerdo'], 'anio': anio(f), 'titulo': f['titulo'].strip(),
                                    'tema': f.get('tema'), 'sancion': f['fecha_de_sancion'].replace('/', '-')}
                                   for f in recientes])


# ---------------------------------------------------------------- predial por comuna de cobro (MEData)

def predial(t, terr):
    fuente = t.fuente('medata-predial-comunas', 'Facturación histórica del impuesto predial unificado por comuna de cobro',
                      'Secretaría de Hacienda · Alcaldía de Medellín (MEData)', PREDIAL)
    crudo = descargar(PREDIAL, timeout=120)
    filas = list(csv.DictReader(io.StringIO(crudo.decode('utf-8', errors='replace'))))
    por_anio = collections.defaultdict(collections.Counter)
    trimestres = collections.defaultdict(set)
    for f in filas:
        mes, anio = f['ano_mes'].split('-')
        anio = 2000 + int(anio)
        trimestres[anio].add(mes)
        codigo = (f['codigo_comuna_cobro'] or '').strip()
        por_anio[anio][PREDIAL_CODIGOS.get(codigo, f'cobro-{codigo}')] += float(f['vlr_fact_impuesto'])
    # Medellín factura el predial por trimestre (enero, abril, julio y octubre): un año completo trae las cuatro.
    anios = sorted(a for a, ms in trimestres.items() if len(ms) == 4)
    if not anios:
        raise RuntimeError('El archivo del predial no trae ningún año con los cuatro trimestres')
    vigencia = f'{anios[0]}–{anios[-1]} (histórico)'
    nota = ('Impuesto facturado (no recaudado) según la comuna a la que se envía el cobro, que no siempre es donde está '
            'el predio. San Cristóbal y Palmitas se facturan juntos y no se reparten.')
    terr.indicador('predial_facturado', 'Impuesto predial facturado (comuna de cobro)', 'millones de $', fuente, vigencia,
                   nota=nota)
    for a in anios:
        for codigo in terr.filas:
            if codigo in por_anio[a]:
                terr.valor(codigo, 'predial_facturado', a, round(por_anio[a][codigo] / MILLON))
    ultimo = anios[-1]
    total = sum(por_anio[ultimo].values())
    en_medellin = sum(v for k, v in por_anio[ultimo].items() if k in terr.filas or k == 'cobro-18')
    t.cifra('predial_facturado', billones(total), 'billones de $', f'Impuesto predial facturado {ultimo}', fuente,
            f'{ultimo} (histórico)', decimales=2,
            nota=f'Suma de las cuatro facturaciones trimestrales de {ultimo}, sin intereses. El '
                 f'{fmt((1 - en_medellin / total) * 100, 1)} % se envía a direcciones de cobro fuera de Medellín o sin '
                 f'identificar.')
    t.lista('predial_san_cristobal_palmitas', [{'anio': a, 'valor': round(por_anio[a].get('cobro-18', 0))} for a in anios])


# ---------------------------------------------------------------- principal

LISTAS = {'cuipo-ingresos': ['ingresos_composicion'], 'cuipo-gastos': ['presupuesto_anual', 'inversion_por_sector'],
          'secop2-distrito': ['secop_por_tipo', 'secop_mayores'], 'concejo-acuerdos': ['acuerdos_por_tema', 'acuerdos_recientes'],
          'medata-predial-comunas': ['predial_san_cristobal_palmitas']}


def main():
    t = Tema('municipio', 'Municipio')
    terr = Territorios()
    # El presupuesto (ingresos y gastos) y el Concejo (acuerdos y proyectos) declaran dos fuentes cada uno pero se
    # calculan juntos: si fallan, cada bloque descarta lo suyo y hereda su versión anterior.
    for funcion, fuentes in ((presupuesto, ('cuipo-ingresos', 'cuipo-gastos')),
                             (concejo, ('concejo-acuerdos', 'concejo-proyectos'))):
        try:
            funcion(t)
            error = None
        except Exception as e:  # se relanza dentro del bloque de cada fuente
            error = e
        for fuente in fuentes:
            with t.bloque(fuente):
                if error:
                    raise error
    with t.bloque('alcaldia-inversion-comunas'):
        inversion_comunas(t, terr)
    with t.bloque('secop2-distrito'):
        secop(t)
    with t.bloque('medata-predial-comunas'):
        predial(t, terr)

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
