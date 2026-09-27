"""Movilidad: afluencia del Metro de Medellín por línea y día (portal de datos abiertos del Metro).

El Metro publica un Excel por año ("Afluencia Metro <año>") con una fila por día y línea, columnas por hora y
una columna final de total. Se usa solo esa columna de total.
"""

import collections
import datetime as dt

from lago import MESES, Tema, descargar, excel, hoy, json_url

HUB = 'https://datosabiertos-metrodemedellin.opendata.arcgis.com'
COLUMNA_TOTAL = 'Total general'


def item_afluencia(anio):
    datos = json_url(f'{HUB}/api/search/v1/collections/all/items', {'q': f'Afluencia Metro {anio}', 'limit': 20})
    for item in datos.get('features', []):
        p = item['properties']
        if p.get('title', '').strip() == f'Afluencia Metro {anio}' and p.get('url'):
            return p['url']
    return None


def afluencia_diaria(url):
    """Devuelve {fecha: total del sistema} y {línea: total} a partir del Excel anual."""
    filas = list(excel(descargar(url, timeout=180)).worksheets[0].iter_rows(values_only=True))
    encabezado = next(f for f in filas[:5] if any(isinstance(c, str) and c.startswith(COLUMNA_TOTAL) for c in f))
    col = next(i for i, c in enumerate(encabezado) if isinstance(c, str) and c.startswith(COLUMNA_TOTAL))
    por_dia, por_linea = collections.Counter(), collections.Counter()
    for fila in filas:
        if isinstance(fila[0], dt.datetime) and isinstance(fila[col], (int, float)):
            por_dia[fila[0].date()] += fila[col]
            por_linea[str(fila[1]).strip().title()] += fila[col]
    if not por_dia:
        raise RuntimeError(f'El Excel de afluencia no trae filas diarias: {url}')
    return por_dia, por_linea


def promedio_habil(por_dia):
    habiles = [v for d, v in por_dia.items() if d.weekday() < 5]
    return round(sum(habiles) / len(habiles))


def main():
    t = Tema('movilidad', 'Movilidad')
    anio = hoy().year
    with t.bloque('metro-afluencia'):
        url = item_afluencia(anio) or item_afluencia(anio - 1)
        if not url:
            raise RuntimeError('No se encontró el Excel de afluencia del año en curso ni del anterior')
        t.fuente('metro-afluencia', 'Afluencia Metro por línea y hora', 'Metro de Medellín', url)
        por_dia, por_linea = afluencia_diaria(url)
        desde, hasta = min(por_dia), max(por_dia)
        vigencia = f'{MESES[desde.month - 1]}–{MESES[hasta.month - 1]} {hasta.year}'
        nota = ('Promedio de lunes a viernes, festivos incluidos. Afluencia = entradas registradas por línea: '
                'un pasajero que transborda puede contarse en más de una línea.')
        t.cifra('afluencia_metro_dia_habil', promedio_habil(por_dia), 'entradas/día', 'Afluencia Metro · día hábil',
                'metro-afluencia', vigencia, ancla=True, nota=nota)
        t.cifra('afluencia_metro_maximo', max(por_dia.values()), 'entradas', 'Día de mayor afluencia',
                'metro-afluencia', max(por_dia, key=por_dia.get).isoformat())

        mensual = collections.defaultdict(list)
        for d, v in por_dia.items():
            if d.weekday() < 5:
                mensual[d.strftime('%Y-%m')].append(v)
        t.serie('afluencia_metro_mensual', [[m, round(sum(v) / len(v))] for m, v in sorted(mensual.items())],
                'entradas/día', 'Afluencia promedio en día hábil por mes', 'metro-afluencia', nota=nota)
        t.lista('afluencia_por_linea', [{'nombre': k, 'valor': v} for k, v in por_linea.most_common()])
    t.escribir()
    return t


if __name__ == '__main__':
    main()
