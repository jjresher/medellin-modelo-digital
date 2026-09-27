"""Demografía: proyecciones del DANE (total oficial) y del DAP de Medellín (hogares y viviendas por comuna)."""

import re

from lago import Tema, arcgis, descargar, excel, hoy

DANE_URL = ('https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/'
            'DCD-area-proypoblacion-Mun-2020-2035-ActPostCOVID-19.xlsx')
DAP = 'https://www.medellin.gov.co/servidormapas/rest/services/mapas_nacionales/VC_Distribucion_Poblacional/MapServer'


def proyeccion_dane(t, anio):
    t.fuente('dane-proyecciones', 'Proyecciones de población municipal 2020–2035 (post-COVID)', 'DANE', DANE_URL)
    libro = excel(descargar(DANE_URL, timeout=180))
    filas = {}
    for fila in libro.worksheets[0].iter_rows(values_only=True):
        if len(fila) > 6 and str(fila[2]).strip() == '05001' and isinstance(fila[4], int):
            filas[(fila[4], str(fila[5]).strip())] = fila[6]
    if not filas:
        raise RuntimeError('El archivo del DANE no trae filas para Medellín (05001)')

    total = filas[(anio, 'Total')]
    t.cifra('poblacion', total, 'habitantes', 'Población proyectada', 'dane-proyecciones', str(anio), ancla=True,
            nota='Proyección DANE con base en el CNPV 2018, ajustada por COVID-19. Cifra oficial del total municipal.')
    t.cifra('poblacion_cabecera', filas[(anio, 'Cabecera Municipal')], 'habitantes', 'Población urbana (cabecera)',
            'dane-proyecciones', str(anio))
    t.cifra('poblacion_rural', filas[(anio, 'Centros Poblados y Rural Disperso')], 'habitantes',
            'Población rural (corregimientos)', 'dane-proyecciones', str(anio))
    t.serie('poblacion_total', [[a, v] for (a, area), v in sorted(filas.items()) if area == 'Total'],
            'habitantes', 'Población de Medellín 2020–2035', 'dane-proyecciones')
    return total


def proyeccion_dap(t, capa, clave, etiqueta, unidad, anio, ancla=False):
    """Suma por comuna y corregimiento una proyección del DAP y guarda también el reparto."""
    filas = arcgis(f'{DAP}/{capa}')
    campo = next((c for c in filas[0] if re.fullmatch(rf'\w*_?{anio}', c)), None)
    if not campo:
        raise RuntimeError(f'La capa {capa} del DAP no trae el año {anio}: {list(filas[0])}')
    total = sum(f[campo] or 0 for f in filas)
    t.cifra(clave, total, unidad, etiqueta, 'dap-proyecciones', str(anio), ancla=ancla,
            nota='Proyección 2018–2030 del DAP, elaborada en 2018, antes del ajuste post-COVID del DANE. '
                 'Úsese para repartir por territorio, no como total oficial.')
    t.lista(f'{clave}_por_territorio', sorted(
        ({'nombre': f['nombre'], 'valor': f[campo]} for f in filas if f.get('nombre')),
        key=lambda x: -(x['valor'] or 0)))
    return total


def main():
    anio = hoy().year
    t = Tema('demografia', 'Demografía')

    with t.bloque('dane-proyecciones'):
        proyeccion_dane(t, anio)

    with t.bloque('dap-proyecciones'):
        t.fuente('dap-proyecciones', 'Proyecciones de población, hogares y viviendas 2018–2030 por comuna y corregimiento',
                 'Departamento Administrativo de Planeación · Alcaldía de Medellín', DAP)
        poblacion_dap = proyeccion_dap(t, 1, 'poblacion_dap', 'Población proyectada (DAP)', 'habitantes', anio)
        hogares = proyeccion_dap(t, 2, 'hogares', 'Hogares proyectados', 'hogares', anio, ancla=True)
        proyeccion_dap(t, 3, 'viviendas', 'Viviendas proyectadas', 'viviendas', anio)
        t.cifra('personas_por_hogar', round(poblacion_dap / hogares, 2), 'personas', 'Personas por hogar',
                'dap-proyecciones', str(anio), estado='derivado', decimales=2,
                nota='Población DAP ÷ hogares DAP, ambos de la misma serie para que sean comparables.')

    t.escribir()
    return t


if __name__ == '__main__':
    main()
