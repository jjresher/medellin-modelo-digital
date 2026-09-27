"""Verifica el lago antes de desplegar: contrato de cada tema, coherencia del catálogo y del índice.

    .venv/bin/python ingesta/verificar.py         # contrato y coherencia
    .venv/bin/python ingesta/verificar.py --red   # además comprueba que cada URL de fuente responda

Los errores hacen fallar la verificación (código de salida 1). Los avisos (por ejemplo, una fuente que no se
prueba hace más de DIAS_AVISO días) se muestran, pero no la hacen fallar.
"""

import datetime as dt
import json
import math
import sys

from lago import DIR_LAGO, ESTADOS, existe, hoy

DIAS_AVISO = 45
CAMPOS_TEMA = ('tema', 'titulo', 'probado', 'ancla', 'fuentes', 'cifras', 'series', 'listas')
CAMPOS_FUENTE = ('id', 'nombre', 'entidad', 'url', 'estado')
CAMPOS_CIFRA = ('valor', 'unidad', 'etiqueta', 'fuente', 'vigencia', 'estado')


class Informe:
    def __init__(self):
        self.errores, self.avisos = [], []

    def error(self, donde, mensaje):
        self.errores.append(f'{donde}: {mensaje}')

    def aviso(self, donde, mensaje):
        self.avisos.append(f'{donde}: {mensaje}')


def fecha(texto):
    try:
        return dt.date.fromisoformat(texto)
    except (TypeError, ValueError):
        return None


def numero_valido(valor):
    return isinstance(valor, (int, float)) and not isinstance(valor, bool) and math.isfinite(valor)


def verificar_tema(ruta, inf):
    donde = ruta.name
    try:
        tema = json.loads(ruta.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        inf.error(donde, f'JSON inválido: {e}')
        return None
    faltan = [campo for campo in CAMPOS_TEMA if campo not in tema]
    if faltan:
        inf.error(donde, f'faltan los campos {", ".join(faltan)}')
        return None
    if tema['tema'] != ruta.stem:
        inf.error(donde, f'"tema" es "{tema["tema"]}" pero el archivo se llama {ruta.stem}')
    if not fecha(tema['probado']):
        inf.error(donde, f'"probado" no es una fecha ISO: {tema["probado"]}')

    fuentes = {}
    for f in tema['fuentes']:
        faltan = [c for c in CAMPOS_FUENTE if not f.get(c)]
        if faltan:
            inf.error(donde, f'fuente {f.get("id", "?")} sin {", ".join(faltan)}')
            continue
        if f['estado'] not in ESTADOS:
            inf.error(donde, f'fuente {f["id"]} con estado desconocido "{f["estado"]}"')
        if not f['url'].startswith(('http://', 'https://')):
            inf.error(donde, f'fuente {f["id"]} con URL inválida')
        probado = fecha(f.get('probado'))
        if not probado:
            inf.error(donde, f'fuente {f["id"]} sin fecha "probado"')
        elif (hoy() - probado).days > DIAS_AVISO:
            inf.aviso(donde, f'fuente {f["id"]} no se prueba desde {probado} ({(hoy() - probado).days} días)')
        fuentes[f['id']] = f

    usadas = set()
    for clave, c in tema['cifras'].items():
        lugar = f'{donde} › cifra {clave}'
        faltan = [k for k in CAMPOS_CIFRA if k not in c or c[k] in (None, '')]
        if c.get('estado') == 'candidato' and faltan == ['valor']:
            faltan = []
        if faltan:
            inf.error(lugar, f'sin {", ".join(faltan)}')
            continue
        if c['estado'] not in ESTADOS:
            inf.error(lugar, f'estado desconocido "{c["estado"]}"')
        if c['fuente'] not in fuentes:
            inf.error(lugar, f'la fuente "{c["fuente"]}" no está declarada en "fuentes"')
        usadas.add(c['fuente'])
        valor = c.get('valor')
        if c['estado'] != 'candidato' and not (numero_valido(valor) or isinstance(valor, str)):
            inf.error(lugar, f'valor no válido: {valor!r}')
        if numero_valido(valor):
            if c['unidad'] == '%' and '_variacion' not in clave and not 0 <= valor <= 100:
                inf.error(lugar, f'porcentaje fuera de 0–100: {valor}')
            if c['unidad'] != '%' and valor < 0:
                inf.error(lugar, f'valor negativo: {valor}')

    for clave, s in tema['series'].items():
        lugar = f'{donde} › serie {clave}'
        if s.get('fuente') not in fuentes:
            inf.error(lugar, f'la fuente "{s.get("fuente")}" no está declarada')
        usadas.add(s.get('fuente'))
        puntos = s.get('puntos') or []
        if len(puntos) < 2:
            inf.error(lugar, 'tiene menos de 2 puntos')
        elif any(len(p) != 2 or not numero_valido(p[1]) for p in puntos):
            inf.error(lugar, 'tiene puntos que no son [etiqueta, número]')
        etiquetas = [str(p[0]) for p in puntos]
        if len(set(etiquetas)) != len(etiquetas):
            inf.error(lugar, 'tiene etiquetas repetidas')

    for clave in tema['ancla']:
        if clave not in tema['cifras']:
            inf.error(donde, f'"ancla" menciona la cifra "{clave}", que no existe')
    # Las capas del mapa (con 'uso') no aportan cifras: se declaran para el catálogo.
    for fid in set(fuentes) - usadas:
        if not fuentes[fid].get('uso'):
            inf.aviso(donde, f'la fuente {fid} está declarada pero ninguna cifra o serie la usa')
    return tema


def verificar_indice_y_catalogo(temas, inf):
    indice_ruta, catalogo_ruta = DIR_LAGO / 'indice.json', DIR_LAGO / 'catalogo.json'
    if not indice_ruta.exists() or not catalogo_ruta.exists():
        inf.error('lago', 'faltan indice.json o catalogo.json (se generan con ingesta/correr.py)')
        return
    indice = json.loads(indice_ruta.read_text(encoding='utf-8'))
    listados = {t['tema'] for t in indice['temas']}
    if listados != set(temas):
        inf.error('indice.json', f'no coincide con los archivos del lago: {sorted(listados ^ set(temas))}')

    catalogo = json.loads(catalogo_ruta.read_text(encoding='utf-8'))
    ids = [d['id'] for d in catalogo['datasets']]
    repetidos = {i for i in ids if ids.count(i) > 1}
    if repetidos:
        inf.error('catalogo.json', f'ids repetidos: {sorted(repetidos)}')
    if catalogo['n'] != len(ids):
        inf.error('catalogo.json', f'"n" dice {catalogo["n"]} pero hay {len(ids)} datasets')
    for t in temas.values():
        for f in t['fuentes']:
            if f['id'] not in ids:
                inf.error('catalogo.json', f'falta la fuente {f["id"]} del tema {t["tema"]}')
    return catalogo


def verificar_red(catalogo, inf):
    for d in catalogo['datasets']:
        if not existe(d['url']):
            inf.error('red', f'{d["id"]} no responde: {d["url"]}')


def main(argumentos):
    inf = Informe()
    temas = {}
    for ruta in sorted(DIR_LAGO.glob('*.json')):
        if ruta.name in ('indice.json', 'catalogo.json'):
            continue
        tema = verificar_tema(ruta, inf)
        if tema:
            temas[tema['tema']] = tema
    if not temas:
        inf.error('lago', f'no hay temas en {DIR_LAGO}')
    catalogo = verificar_indice_y_catalogo(temas, inf)
    if '--red' in argumentos and catalogo:
        verificar_red(catalogo, inf)

    print(f'\nVerificación del lago · {len(temas)} temas · '
          f'{sum(len(t["cifras"]) for t in temas.values())} cifras · '
          f'{sum(len(t["series"]) for t in temas.values())} series')
    for a in inf.avisos:
        print(f'  aviso  {a}')
    for e in inf.errores:
        print(f'  ERROR  {e}')
    print('  ✓ lago válido' if not inf.errores else f'  ✗ {len(inf.errores)} errores')
    return len(inf.errores)


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:]) else 0)
