"""Lee la licencia de cada fuente del catálogo en la propia fuente y la guarda, copiada tal cual, en el registro.

    .venv/bin/python ingesta/licencias.py            # todas las fuentes
    .venv/bin/python ingesta/licencias.py sisc-homicidio epm-tarifas-agua   # solo algunas

Una licencia no se supone nunca. Según dónde publique la fuente, se lee de:

- datos.gov.co (Socrata): el campo `license` de la ficha del conjunto (API pública, sin llave).
- MEData: la ficha del conjunto, que se arma en el navegador; se lee con un Chrome sin ventana.
- Servidores ArcGIS de la Alcaldía y del Área Metropolitana: solo traen `copyrightText`, que es un crédito y no una
  licencia. Se registra «No declarada en el servicio» junto con ese crédito.
- Todo lo demás (DANE, SIATA, OpenStreetMap…): `licencias_manuales.json`, donde cada licencia es el texto que se leyó
  en la página citada, con la fecha en que se leyó.

Lo que una fuente no responde queda como estaba en el registro, con su fecha de lectura original. El script no escribe
nada en el lago: la licencia llega al catálogo cuando corre `correr.py`.
"""

import datetime as dt
import json
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

import registro
from lago import DIR_LAGO, RAIZ, hoy, json_url

MANUALES = RAIZ / 'ingesta' / 'licencias_manuales.json'
SIN_DECLARAR = 'No declarada en la fuente'


def socrata(url):
    recurso = re.search(r'datos\.gov\.co/(?:d|resource)/([a-z0-9]{4}-[a-z0-9]{4})', url).group(1)
    ficha = json_url(f'https://www.datos.gov.co/api/views/{recurso}.json')
    lic = ficha.get('license') or {}
    nombre = lic.get('name') or SIN_DECLARAR
    datos = {'licencia': nombre, 'licencia_url': lic.get('termsLink') or f'https://www.datos.gov.co/d/{recurso}',
             'licencia_origen': 'Ficha del conjunto en datos.gov.co (API)'}
    actualizado = ficha.get('rowsUpdatedAt')
    datos['ficha'] = {'publicador': ficha.get('attribution'), 'categoria': ficha.get('category'),
                      'actualizado': dt.datetime.fromtimestamp(actualizado, dt.timezone.utc).date().isoformat() if actualizado else None}
    return datos


def medata(url):
    ident = re.search(r'/distribution/([\d-]+)/', url).group(1)
    ficha_url = f'https://medata.app.medellin.gov.co/dataset/{ident}'
    with tempfile.TemporaryDirectory() as perfil:
        salida = subprocess.run(
            ['google-chrome', '--headless=new', '--disable-gpu', '--no-sandbox', f'--user-data-dir={perfil}',
             '--virtual-time-budget=25000', '--dump-dom', ficha_url],
            capture_output=True, text=True, timeout=120).stdout
    texto = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', re.sub(r'<script.*?</script>|<style.*?</style>', '', salida, flags=re.S)))
    lic = re.search(r'Licencia (.+?) La Alcaldía de Medellín no será responsable', texto)
    if not lic:
        raise RuntimeError(f'la ficha {ficha_url} no mostró la licencia')

    def campo(nombre, hasta):
        m = re.search(rf'{nombre} (.+?) {hasta}', texto)
        return m.group(1).strip() if m else None

    return {'licencia': lic.group(1).strip(), 'licencia_url': ficha_url, 'licencia_origen': 'Ficha técnica del conjunto en MEData',
            'ficha': {'publicador': campo('Dependencias', 'Fecha de modificación'),
                      'modificacion_declarada': campo('Fecha de modificación', 'Fecha de publicación'),
                      'cobertura_declarada': campo('Cobertura temporal', 'Licencia'),
                      'frecuencia': campo('Frecuencia', 'Identificador'),
                      'nivel_de_acceso': campo('Nivel de acceso', 'Vista previa')}}


def arcgis(url):
    base = re.sub(r'/(MapServer|FeatureServer)(/.*)?$', r'/\1', url.split('?')[0])
    servicio = json_url(base, {'f': 'json'})
    credito = (servicio.get('copyrightText') or '').strip()
    if not credito and re.search(r'/(MapServer|FeatureServer)/\d+', url):
        credito = (json_url(url.split('?')[0], {'f': 'json'}).get('copyrightText') or '').strip()
    texto = f'{SIN_DECLARAR}. El servicio solo trae un crédito (copyrightText): «{credito}»' if credito else \
        f'{SIN_DECLARAR}. El servicio ArcGIS tiene el campo copyrightText vacío'
    return {'licencia': texto, 'licencia_url': base, 'licencia_origen': 'Servicio ArcGIS REST (copyrightText)'}


def sonda(fuente):
    url = fuente['url']
    if 'datos.gov.co' in url:
        return socrata(url)
    if 'medata.gov.co' in url:
        return medata(url)
    if 'servidormapas' in url or 'portalidem' in url:
        return arcgis(url)
    return None


def main(pedidos):
    catalogo = json.loads((DIR_LAGO / 'catalogo.json').read_text(encoding='utf-8'))
    datasets = [d for d in catalogo['datasets'] if not pedidos or d['id'] in pedidos]
    manuales = json.loads(MANUALES.read_text(encoding='utf-8')) if MANUALES.exists() else {}
    reg = registro.asignar_codigos(registro.leer(), [d['id'] for d in catalogo['datasets']])

    def leer(d):
        if d['id'] in manuales:
            m = manuales[d['id']]
            return d['id'], {'licencia': m['licencia'], 'licencia_url': m['url'],
                             'licencia_origen': 'Texto de la fuente, leído a mano', 'licencia_probada': m['leida']}, None
        try:
            return d['id'], sonda(d), None
        except Exception as e:
            return d['id'], None, str(e)[:140]

    # El navegador de MEData tarda ~20 s por ficha: se leen de a cuatro.
    with ThreadPoolExecutor(max_workers=4) as pool:
        resultados = list(pool.map(leer, datasets))
    sin_leer = []
    for fuente_id, datos, error in resultados:
        if error or not datos:
            sin_leer.append(f'{fuente_id}: {error or "ninguna sonda aplica; falta en licencias_manuales.json"}')
            # Sin lectura previa, el registro lo dice en vez de dejar la licencia en blanco ni suponerla.
            if not reg[fuente_id].get('licencia'):
                reg[fuente_id].update({'licencia': f'Sin verificar: la fuente no respondió al consultarla ({error or "sin sonda"})',
                                       'licencia_url': next(d['url'] for d in datasets if d['id'] == fuente_id),
                                       'licencia_origen': 'Consulta fallida', 'licencia_probada': hoy().isoformat()})
            continue
        datos.setdefault('licencia_probada', hoy().isoformat())
        reg[fuente_id].update(datos)
        print(f'  ✓ {reg[fuente_id]["codigo"]} {fuente_id}: {datos["licencia"][:90]}')
    registro.guardar(reg)
    for s in sin_leer:
        print(f'  ✗ {s}')
    return 1 if sin_leer else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
