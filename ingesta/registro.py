"""Registro de fuentes: el código F001, F002… de cada una (los mismos IDs del Excel de la entrega 1) y lo que se leyó en la propia fuente sobre su uso.

Vive en ingesta/registro_fuentes.json (se versiona) y lo completan dos pasos:

- `licencias.py` lee la licencia de cada fuente donde la fuente la declara y la copia tal cual.
- `correr.py` lo une al catálogo del lago (`catalogo.json`), que es lo que ve la app.

El código de una fuente no cambia nunca: una fuente nueva recibe el siguiente número libre, y una que se retira
deja su número vacío. Así los F001… que aparecen en la app, el Excel del diccionario y el README siguen siendo los mismos.
"""

import json

from lago import RAIZ

RUTA = RAIZ / 'ingesta' / 'registro_fuentes.json'

# Qué guarda el registro de cada fuente, además del código.
CAMPOS = ('codigo', 'licencia', 'licencia_url', 'licencia_origen', 'licencia_probada', 'ficha', 'personas', 'proteccion')

NIVELES = ('Abierto', 'Abierto, solo agregados', 'No se publica')


def leer():
    return json.loads(RUTA.read_text(encoding='utf-8')) if RUTA.exists() else {}


def guardar(registro):
    RUTA.write_text(json.dumps(registro, ensure_ascii=False, indent=1, sort_keys=True) + '\n', encoding='utf-8')


def asignar_codigos(registro, ids):
    """Da un código a cada id que aún no tiene, en el orden recibido, sin tocar los que ya existen."""
    usados = {e['codigo'] for e in registro.values() if e.get('codigo')}
    siguiente = max((int(c[1:]) for c in usados), default=0) + 1
    for fuente_id in ids:
        entrada = registro.setdefault(fuente_id, {})
        if not entrada.get('codigo'):
            entrada['codigo'] = f'F{siguiente:03d}'
            siguiente += 1
    return registro


def unir(datasets):
    """Los datasets del catálogo con lo que dice el registro de cada uno (código, licencia, personas, protección)."""
    registro = asignar_codigos(leer(), [d['id'] for d in datasets])
    guardar(registro)
    return [{**d, **{k: v for k, v in registro[d['id']].items() if k in CAMPOS and v not in (None, '')}} for d in datasets]
