"""Corre toda la ingesta: cada tema, luego el catálogo y el índice del lago, y al final la verificación.

    .venv/bin/python ingesta/correr.py            # todos los temas
    .venv/bin/python ingesta/correr.py seguridad  # solo algunos temas (el catálogo se rehace con todo el lago)

Un tema que falla por completo conserva su archivo anterior; el proceso sigue con los demás y termina con
código de salida 1 para que el fallo no pase desapercibido.
"""

import importlib
import json
import sys
import traceback

from lago import DIR_LAGO, hoy

# demografia va primero: seguridad usa su población para calcular tasas.
# lentes, territorio y ambiente van después de gemelo: usan sus límites (ambiente, para recortar el mapa de ruido) y
# territorio además sus construcciones y la población de demografia.
TEMAS = ['demografia', 'economia', 'seguridad', 'turismo', 'municipio', 'servicios', 'movilidad', 'gemelo', 'lentes', 'territorio', 'ambiente', 'escucha']


def vigencia_de(tema, fuente_id):
    series = [s['vigencia'] for s in tema['series'].values() if s['fuente'] == fuente_id]
    if series:
        return max(series, key=len)
    cifras = sorted({c['vigencia'] for c in tema['cifras'].values() if c['fuente'] == fuente_id})
    if cifras:
        return ' · '.join(cifras)
    # Una fuente que solo aporta indicadores por territorio (la ECV, por ejemplo) toma la vigencia de esos indicadores.
    indicadores = sorted({i['vigencia'] for i in tema['listas'].get('indicadores', []) if i['fuente'] == fuente_id})
    return ' · '.join(indicadores)


def construir_catalogo(temas):
    datasets = []
    for tema in temas:
        for f in tema['fuentes']:
            etiquetas = [c['etiqueta'] for c in tema['cifras'].values() if c['fuente'] == f['id']]
            uso = f.get('uso') or ', '.join(etiquetas[:4]) + ('…' if len(etiquetas) > 4 else '')
            datasets.append({**f, 'tema': tema['tema'], 'vigencia': vigencia_de(tema, f['id']) or 'Servicio vigente',
                             'uso': uso})
    por_estado = {}
    for d in datasets:
        por_estado[d['estado']] = por_estado.get(d['estado'], 0) + 1
    catalogo = {'probado': hoy().isoformat(), 'n': len(datasets), 'por_estado': por_estado, 'datasets': datasets}
    (DIR_LAGO / 'catalogo.json').write_text(json.dumps(catalogo, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'  ✓ catálogo · {len(datasets)} datasets · {por_estado}')


def construir_indice(temas):
    indice = {'probado': hoy().isoformat(),
              'temas': [{'tema': t['tema'], 'titulo': t['titulo'], 'probado': t['probado']} for t in temas]}
    (DIR_LAGO / 'indice.json').write_text(json.dumps(indice, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def main(pedidos):
    fallos = []
    for nombre in pedidos or TEMAS:
        print(f'→ {nombre}')
        try:
            tema = importlib.import_module(f'pull_{nombre}').main()
            fallos += [f'{nombre}/{f}' for f in tema.fallos]
        except Exception:
            traceback.print_exc()
            fallos.append(nombre)
            print(f'  ✗ {nombre} falló; se conserva el archivo anterior si existe')

    temas = [json.loads((DIR_LAGO / f'{n}.json').read_text(encoding='utf-8'))
             for n in TEMAS if (DIR_LAGO / f'{n}.json').exists()]
    construir_catalogo(temas)
    construir_indice(temas)

    import verificar
    errores = verificar.main([])
    if fallos:
        print(f'\n⚠ Fuentes con fallo en esta corrida (el detalle de cada una está arriba): {", ".join(fallos)}')
    return 1 if fallos or errores else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
