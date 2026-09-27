"""Economía: mercado laboral de Medellín A.M. desde el anexo mensual de la GEIH (DANE).

El DANE publica cada mes un archivo `anex-GEIH-<mes><año>.xlsx`; se busca el más reciente hacia atrás.
La hoja trimestral trae un bloque por ciudad: fila de años, fila de trimestres móviles y filas por indicador.
"""

import datetime as dt

from lago import MESES, Tema, descargar, excel, existe, hoy

BASE = 'https://www.dane.gov.co/files/operaciones/GEIH'
HOJA = 'Total 23 ciudades A.M. Trim'
CIUDAD = 'Medellín A.M.'
INDICADORES = [
    # (clave, fila en el anexo, etiqueta, en el Panorama)
    ('desempleo', 'Tasa de Desocupación (TD)', 'Desempleo · Medellín A.M.', True),
    ('ocupacion', 'Tasa de Ocupación (TO)', 'Tasa de ocupación · Medellín A.M.', False),
    ('participacion', 'Tasa Global de Participación (TGP)', 'Participación laboral · Medellín A.M.', False),
    ('subocupacion', 'Tasa de Subocupación (TS)', 'Subocupación · Medellín A.M.', False),
]


def anexo_reciente():
    fecha = hoy()
    for _ in range(6):
        url = f'{BASE}/anex-GEIH-{MESES[fecha.month - 1]}{fecha.year}.xlsx'
        if existe(url):
            return url
        fecha = fecha.replace(day=1) - dt.timedelta(days=1)
    raise RuntimeError('No se encontró un anexo GEIH en los últimos 6 meses')


def bloque_ciudad(hoja):
    filas = [list(f) for f in hoja.iter_rows(values_only=True)]
    inicio = next(i for i, f in enumerate(filas) if f and isinstance(f[0], str) and f[0].strip() == CIUDAD)
    fila_anios = next(f for f in filas[inicio:] if f and f[0] == 'Concepto')
    fila_trim = filas[filas.index(fila_anios, inicio) + 1]
    # Los años solo aparecen en la primera columna de cada año: se arrastran hacia la derecha.
    etiquetas, anio = [], None
    for col, (a, trimestre) in enumerate(zip(fila_anios, fila_trim)):
        anio = a if isinstance(a, int) else anio
        etiquetas.append(f'{trimestre.strip().replace(" - ", "–").lower()} {anio}' if col and trimestre else None)
    indicadores = {}
    for fila in filas[inicio:inicio + 40]:
        if fila and isinstance(fila[0], str):
            indicadores.setdefault(fila[0].strip(), fila)
    return etiquetas, indicadores


def main():
    t = Tema('economia', 'Economía y vivienda')
    with t.bloque('dane-geih'):
        url = anexo_reciente()
        t.fuente('dane-geih', 'Gran Encuesta Integrada de Hogares · anexo 23 ciudades', 'DANE', url)
        etiquetas, indicadores = bloque_ciudad(excel(descargar(url, timeout=180))[HOJA])
        for clave, fila_nombre, etiqueta, ancla in INDICADORES:
            fila = indicadores[fila_nombre]
            puntos = [[etiquetas[c], round(v, 2)] for c, v in enumerate(fila)
                      if c and etiquetas[c] and isinstance(v, (int, float))]
            ultimo_periodo, ultimo_valor = puntos[-1]
            t.cifra(clave, ultimo_valor, '%', etiqueta, 'dane-geih', f'{ultimo_periodo} (trimestre móvil)',
                    ancla=ancla, decimales=2)
            t.serie(f'{clave}_trimestral', puntos, '%', f'{etiqueta} (trimestre móvil)', 'dane-geih')
    t.escribir()
    return t


if __name__ == '__main__':
    main()
