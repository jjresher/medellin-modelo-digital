"""Saca del lago la misma tabla para todas las herramientas de visualización que se prueban en esta carpeta.

    .venv/bin/python exploracion/preparar_datos.py

Escribe exploracion/datos/preguntas_por_comuna.csv (una fila por comuna o corregimiento, una columna por indicador de las tres
preguntas de la app) y exploracion/datos/fuentes.json (código F, periodo, fecha de prueba y licencia de cada columna). Así cada
herramienta recibe exactamente los mismos números y la misma procedencia, y se puede comparar lo que resolvió cada una.
"""

import csv
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
LAGO = RAIZ / 'public' / 'data' / 'lago'
SALIDA = Path(__file__).resolve().parent / 'datos'

# (columna, tema, clave del indicador)
COLUMNAS = [
    ('hurto_persona_por_10mil_2022', 'seguridad', 'sisc_hurto_persona_tasa'),
    ('hurto_persona_casos_2022', 'seguridad', 'sisc_hurto_persona'),
    ('verde_m2_por_habitante_2019', 'territorio', 'm2_verde_hab'),
    ('venta_pesos_m2_2024_2025', 'economia', 'venta_m2'),
    ('arriendo_pesos_m2_mes_2024_2025', 'economia', 'arriendo_m2'),
    ('rentabilidad_bruta_apartamentos_2024_2025', 'economia', 'rentabilidad_bruta'),
]


def main():
    catalogo = {d['id']: d for d in json.loads((LAGO / 'catalogo.json').read_text(encoding='utf-8'))['datasets']}
    temas = {t: json.loads((LAGO / f'{t}.json').read_text(encoding='utf-8')) for t in {c[1] for c in COLUMNAS}}
    territorios = {}
    fuentes = {}
    for columna, tema, clave in COLUMNAS:
        ind = next(i for i in temas[tema]['listas']['indicadores'] if i['clave'] == clave)
        ficha = catalogo[ind['fuente']]
        fuentes[columna] = {'indicador': ind['etiqueta'], 'unidad': ind['unidad'], 'fuente': ficha['codigo'], 'periodo': ind['vigencia'],
                            'estado': ind['estado'], 'proxy': ind.get('proxy'), 'probada': ficha['probado'], 'licencia': ficha['licencia']}
        for t in temas[tema]['listas']['territorios']:
            fila = territorios.setdefault(t['codigo'], {'codigo': t['codigo'], 'territorio': t['nombre'], 'tipo': t['tipo']})
            valores = t['valores'].get(clave, {})
            fila[columna] = valores[max(valores)] if valores else ''
    SALIDA.mkdir(exist_ok=True)
    with (SALIDA / 'preguntas_por_comuna.csv').open('w', newline='', encoding='utf-8') as f:
        escritor = csv.DictWriter(f, fieldnames=['codigo', 'territorio', 'tipo'] + [c[0] for c in COLUMNAS])
        escritor.writeheader()
        escritor.writerows(sorted(territorios.values(), key=lambda r: r['codigo']))
    (SALIDA / 'fuentes.json').write_text(json.dumps(fuentes, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'  ✓ {SALIDA.relative_to(RAIZ)} · {len(territorios)} territorios · {len(COLUMNAS)} indicadores')


if __name__ == '__main__':
    main()
