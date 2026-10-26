"""¿Cuántos registros del SISC son únicos si se cruzan unas pocas columnas? Evidencia de la reflexión «Público no es inocuo».

    .venv/bin/python exploracion/k_anonimato_sisc.py

Descarga el archivo de homicidios del SISC (MEData, CC BY 4.0), toma los registros de 2019 a 2023 y cuenta, para cada cruce de
columnas, cuántos registros son los únicos de su grupo (k = 1). Un registro único se puede reconocer: quien conoce el barrio, la edad
y el año de una persona sabe qué fila es la suya. Por eso el lago nunca guarda estas columnas: solo conteos por comuna y por año.
El archivo se baja a la memoria y no se guarda en disco ni en el repositorio.
"""

import collections
import csv
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'ingesta'))
from lago import descargar  # noqa: E402

URL = 'http://medata.gov.co/sites/default/files/distribution/1-027-23-000008/homicidio.csv'
CRUCES = [('codigo_comuna', 'sexo'), ('codigo_comuna', 'sexo', 'edad'), ('codigo_barrio', 'sexo', 'edad'),
          ('anio', 'codigo_comuna', 'sexo', 'edad'), ('anio', 'codigo_barrio', 'sexo', 'edad'), ('fecha_hecho', 'codigo_barrio')]


def unicos(registros, columnas):
    grupos = collections.Counter(tuple(r[c] for c in columnas) for r in registros)
    return sum(1 for r in registros if grupos[tuple(r[c] for c in columnas)] == 1)


def main():
    filas = list(csv.DictReader(io.StringIO(descargar(URL, timeout=300).decode('utf-8', 'replace'))))
    recientes = [{**r, 'anio': r['fecha_hecho'][:4]} for r in filas if r['fecha_hecho'][:4] in {'2019', '2020', '2021', '2022', '2023'}]
    print(f'{len(filas)} registros en el archivo; {len(recientes)} de 2019 a 2023')
    for columnas in CRUCES:
        n = unicos(recientes, columnas)
        print(f'  únicos con {" + ".join(columnas)}: {n} de {len(recientes)} ({n / len(recientes) * 100:.1f} %)')


if __name__ == '__main__':
    main()
