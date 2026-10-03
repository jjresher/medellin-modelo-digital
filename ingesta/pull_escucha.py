"""Escucha social: visitas en Wikipedia (Wikimedia Pageviews) y cobertura de prensa (GDELT DOC 2.0).

Wikipedia mide demanda de información: cuántas personas abren el artículo de Medellín, el de cada comuna y
corregimiento y el de sus lugares. GDELT mide oferta: cuántos artículos de prensa del mundo nombran a Medellín y de
qué temas tratan. Ninguna de las dos mide opinión.

  - Las visitas son las de personas (agent=user) desde cualquier plataforma, al artículo **y a sus redirecciones**:
    quien llega por "Popular (Medellín)" queda registrado con ese título y no con el de "Comuna 1 Popular".
  - GDELT pide una consulta cada 5 segundos y responde 429 a menudo aunque se le pregunte más despacio. Por eso no se
    consulta desde el navegador: la ingesta lo lee una vez, espaciando y reintentando cada consulta, guarda cada respuesta
    del día en datos/crudos/gdelt y el lago es la copia en el servidor.
"""

import datetime as dt
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from lago import MESES, RAIZ, Tema, Territorios, hoy

# Wikimedia limita a los clientes que no se identifican: su política pide un User-Agent con un contacto.
UA_WIKI = 'medellin-modelo-digital/1.0 (https://github.com/jjresher/medellin-modelo-digital; ingesta del lago)'
PAGEVIEWS = 'https://wikimedia.org/api/rest_v1/metrics/pageviews'
DESDE = '2015070100'  # primer mes de la API de Pageviews

# Artículo de cada comuna y corregimiento en es.wikipedia. Los nombres de los límites no sirven de título: "Popular",
# "Santa Cruz" o "San Javier" son desambiguaciones. La ingesta comprueba que cada uno exista y no sea una desambiguación.
ARTICULOS_TERRITORIO = {
    '01': 'Comuna 1 Popular', '02': 'Comuna 2 Santa Cruz', '03': 'Comuna 3 Manrique', '04': 'Aranjuez (Medellín)',
    '05': 'Castilla (Medellín)', '06': 'Doce de Octubre (Medellín)', '07': 'Robledo (Medellín)',
    '08': 'Villa Hermosa (Medellín)', '09': 'Buenos Aires (Medellín)', '10': 'La Candelaria (Medellín)',
    '11': 'Laureles-Estadio (Medellín)', '12': 'La América', '13': 'San Javier (Medellín)',
    '14': 'El Poblado (Medellín)', '15': 'Guayabal (Medellín)', '16': 'Belén (Medellín)',
    '50': 'Palmitas (Medellín)', '60': 'San Cristóbal (Medellín)', '70': 'Altavista (Medellín)',
    '80': 'San Antonio de Prado', '90': 'Santa Elena (Medellín)',
}
# Lugares: los artículos de la categoría "Turismo en Medellín" y de sus subcategorías directas (museos, parques,
# plazas, edificios y estructuras, centros comerciales). Una lista que no se escribe a mano: la mantiene Wikipedia.
CATEGORIA_LUGARES = 'Categoría:Turismo en Medellín'
SUBCATEGORIAS_FUERA = {'Categoría:Festivales y ferias de Medellín': 'son eventos, no lugares'}
LUGARES_EN_LISTA = 15


def _wiki(url, intentos=5):
    """GET a Wikimedia con su User-Agent. 404 en Pageviews significa "sin visitas registradas": devuelve None. Un 429
    se espera el tiempo que pide el servidor (Retry-After) o, si no lo dice, cada vez más."""
    for intento in range(intentos):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA_WIKI, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code not in (429, 500, 502, 503, 504):
                raise
            espera = int(e.headers.get('Retry-After') or 0) or 5 * (intento + 1)
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            espera = 5 * (intento + 1)
        time.sleep(espera)
    raise RuntimeError(f'Wikimedia no respondió: {url}')


def _accion(proyecto, **params):
    """API de MediaWiki (action=query), siguiendo las continuaciones."""
    base = {'action': 'query', 'format': 'json', 'formatversion': 2, **params}
    continuar, paginas, redirecciones = {}, {}, []
    while True:
        datos = _wiki(f'https://{proyecto}.org/w/api.php?' + urllib.parse.urlencode({**base, **continuar}))
        consulta = datos.get('query', {})
        redirecciones += consulta.get('redirects', [])
        for p in consulta.get('pages', []):
            previa = paginas.setdefault(p['title'], p)
            if previa is not p:  # una continuación trae más redirecciones de la misma página
                previa.setdefault('redirects', []).extend(p.get('redirects', []))
        for m in consulta.get('categorymembers', []):
            paginas[m['title']] = m
        if 'continue' not in datos:
            return paginas, redirecciones
        continuar = datos['continue']


def resolver(titulos, proyecto='es.wikipedia', estricto=True):
    """{título pedido: {titulo, redirecciones}} con el título final (si el pedido es una redirección) y las
    redirecciones del espacio de artículos que apuntan a él. Un artículo que no existe o es una desambiguación hace
    fallar la ingesta si `estricto` (los títulos escritos aquí); si no, se omite (los que trae una categoría)."""
    resultado = {}
    for i in range(0, len(titulos), 50):
        lote = titulos[i:i + 50]
        paginas, saltos = _accion(proyecto, titles='|'.join(lote), redirects=1, prop='pageprops|redirects',
                                  rdnamespace=0, rdlimit='max')
        destino = {r['from']: r['to'] for r in saltos}
        for titulo in lote:
            final = destino.get(titulo, titulo)
            pagina = paginas.get(final)
            problema = ('no existe el artículo' if not pagina or pagina.get('missing') else
                        'es una desambiguación' if 'disambiguation' in pagina.get('pageprops', {}) else None)
            if problema and estricto:
                raise RuntimeError(f'{proyecto}: «{final}» {problema}')
            if problema:
                print(f'  · se omite «{final}»: {problema}')
                continue
            resultado[titulo] = {'titulo': final, 'redirecciones': sorted(r['title'] for r in pagina.get('redirects', []))}
    return resultado


def miembros(categoria, proyecto='es.wikipedia'):
    paginas, _ = _accion(proyecto, list='categorymembers', cmtitle=categoria, cmlimit='max', cmnamespace='0|14')
    return [(p['title'], p['ns']) for p in paginas.values()]


def lugares():
    """Artículos de la categoría de lugares y de sus subcategorías directas, sin repetir."""
    titulos, subcategorias = set(), []
    for titulo, ns in miembros(CATEGORIA_LUGARES):
        if ns == 0:
            titulos.add(titulo)
        elif titulo not in SUBCATEGORIAS_FUERA:
            subcategorias.append(titulo)
    for sub in subcategorias:
        titulos.update(t for t, ns in miembros(sub) if ns == 0)
    return sorted(titulos), subcategorias


def mensual(proyecto, titulo, hasta):
    """{'2026-09': visitas} de un título, desde el primer mes de la API. Un título sin visitas registradas da {}."""
    articulo = urllib.parse.quote(titulo.replace(' ', '_'), safe='')
    datos = _wiki(f'{PAGEVIEWS}/per-article/{proyecto}/all-access/user/{articulo}/monthly/{DESDE}/{hasta}')
    return {f'{i["timestamp"][:4]}-{i["timestamp"][4:6]}': i['views'] for i in (datos or {}).get('items', [])}


def mensual_con_redirecciones(proyecto, articulo, hasta):
    total = dict(mensual(proyecto, articulo['titulo'], hasta))
    for redireccion in articulo['redirecciones']:
        for mes, vistas in mensual(proyecto, redireccion, hasta).items():
            total[mes] = total.get(mes, 0) + vistas
    return total


def total_sitio(proyecto, hasta):
    datos = _wiki(f'{PAGEVIEWS}/aggregate/{proyecto}/all-access/user/monthly/{DESDE}/{hasta}')
    return {f'{i["timestamp"][:4]}-{i["timestamp"][4:6]}': i['views'] for i in datos['items']}


def etiqueta_mes(mes):
    anio, m = mes.split('-')
    return f'{MESES[int(m) - 1]} {anio}'


def meses_hacia_atras(ultimo, n):
    """Los n meses que terminan en `ultimo` ('2026-09'), del más antiguo al más reciente."""
    anio, m = map(int, ultimo.split('-'))
    meses = []
    for _ in range(n):
        meses.append(f'{anio:04d}-{m:02d}')
        anio, m = (anio, m - 1) if m > 1 else (anio - 1, 12)
    return meses[::-1]


def suma(serie, meses):
    return sum(serie.get(m, 0) for m in meses)


def variacion(actual, previo):
    return round((actual - previo) / previo * 100, 1) if previo else None


def miles(n):
    return f'{n:,}'.replace(',', '.')


def ventana_texto(meses):
    return f'{etiqueta_mes(meses[0])} – {etiqueta_mes(meses[-1])}'


def ingestar_wikipedia(t):
    # El último mes completo: el agregado del sitio se publica unos días después de que el mes cierra.
    hasta = (hoy().replace(day=1) - dt.timedelta(days=1)).strftime('%Y%m%d') + '00'
    t.fuente('wikimedia-pageviews', 'Vistas mensuales de artículos (Pageviews API, agent=user)', 'Wikimedia Foundation',
             f'{PAGEVIEWS}/per-article/es.wikipedia/all-access/user/Medell%C3%ADn/monthly/{DESDE}/{hasta}')
    sitio = {p: total_sitio(f'{p}.wikipedia', hasta) for p in ('es', 'en')}
    ultimo = max(sitio['es'])
    doce, previos = meses_hacia_atras(ultimo, 12), meses_hacia_atras(ultimo, 24)[:12]
    veinticuatro = previos + doce
    vig12, vig_previos = ventana_texto(doce), ventana_texto(previos)
    definicion = ('Vistas de personas (sin bots identificados) desde cualquier plataforma al artículo y a sus redirecciones. '
                  'Mide cuántas veces se abrió el artículo, no cuántas personas distintas lo leyeron.')

    # Medellín, en español y en inglés.
    ciudad = {}
    for proyecto, titulo, idioma in (('es', 'Medellín', 'español'), ('en', 'Medellín', 'inglés')):
        articulo = resolver([titulo], f'{proyecto}.wikipedia')[titulo]
        serie = mensual_con_redirecciones(f'{proyecto}.wikipedia', articulo, hasta)
        ciudad[proyecto] = serie
        nota = f'{definicion} Artículo «{articulo["titulo"]}» de Wikipedia en {idioma} y {len(articulo["redirecciones"])} redirecciones.'
        actual, anterior = suma(serie, doce), suma(serie, previos)
        t.cifra(f'wiki_medellin_{proyecto}_12m', actual, 'vistas', f'Vistas del artículo Medellín · Wikipedia en {idioma}',
                'wikimedia-pageviews', vig12, ancla=proyecto == 'es', nota=nota)
        t.cifra(f'wiki_medellin_{proyecto}_variacion_12m', variacion(actual, anterior), '%',
                f'Variación de las vistas · Wikipedia en {idioma}', 'wikimedia-pageviews', f'{vig12} frente a {vig_previos}',
                estado='derivado', decimales=1,
                nota=f'Vistas de los últimos 12 meses ({miles(actual)}) frente a las de los 12 anteriores ({miles(anterior)}).')
        meses = sorted(m for m in serie if m <= ultimo)
        t.serie(f'wiki_medellin_{proyecto}_mensual', [[etiqueta_mes(m), serie[m]] for m in meses], 'vistas',
                f'Vistas mensuales del artículo Medellín · Wikipedia en {idioma}', 'wikimedia-pageviews', nota=nota)
        t.serie(f'wiki_medellin_{proyecto}_por_millon', [[etiqueta_mes(m), round(serie[m] / sitio[proyecto][m] * 1e6, 2)]
                                                         for m in meses if sitio[proyecto].get(m)],
                'vistas por millón', f'Vistas del artículo Medellín por millón de vistas de Wikipedia en {idioma}',
                'wikimedia-pageviews', estado='derivado', decimales=2,
                nota=f'Vistas del artículo divididas por las vistas de personas de toda la Wikipedia en {idioma} en el mismo mes. '
                     'Separa el interés por el artículo de los cambios en el uso de Wikipedia.')

    for proyecto, idioma in (('es', 'español'), ('en', 'inglés')):
        actual, anterior = suma(sitio[proyecto], doce), suma(sitio[proyecto], previos)
        t.cifra(f'wiki_sitio_{proyecto}_variacion_12m', variacion(actual, anterior), '%',
                f'Variación de las vistas de toda la Wikipedia en {idioma}', 'wikimedia-pageviews',
                f'{vig12} frente a {vig_previos}', estado='derivado', decimales=1,
                nota=f'Vistas de personas de todo el sitio: {miles(round(actual / 1e6))} millones en los últimos 12 meses y '
                     f'{miles(round(anterior / 1e6))} millones en los 12 anteriores.')
    t.cifra('wiki_medellin_es_variacion_12m_norm',
            variacion(suma(ciudad['es'], doce) / suma(sitio['es'], doce), suma(ciudad['es'], previos) / suma(sitio['es'], previos)),
            '%', 'Variación de las vistas a Medellín por millón de vistas del sitio', 'wikimedia-pageviews',
            f'{vig12} frente a {vig_previos}', estado='derivado', decimales=1,
            nota='La misma comparación con las vistas del artículo divididas por las de toda la Wikipedia en español.')
    t.serie('wiki_sitio_es_mensual', [[etiqueta_mes(m), round(sitio['es'][m] / 1e6, 1)] for m in sorted(sitio['es'])],
            'millones de vistas', 'Vistas mensuales de toda la Wikipedia en español', 'wikimedia-pageviews', decimales=1,
            nota='Vistas de personas de todo el sitio, la base con que se normalizan las vistas de cada artículo.')

    # Comunas, corregimientos y lugares: los últimos 24 meses de cada artículo, para su total de 12 meses y su variación.
    terr = Territorios()
    resueltos = resolver(list(ARTICULOS_TERRITORIO.values()))
    articulos = []
    for codigo, titulo in ARTICULOS_TERRITORIO.items():
        fila = terr.filas[codigo]
        articulos.append({'grupo': 'territorio', 'codigo': codigo, 'nombre': fila['nombre'], 'tipo': fila['tipo'],
                          **resueltos[titulo]})
    titulos_lugares, subcategorias = lugares()
    vistos = {a['titulo'] for a in articulos}
    for articulo in resolver(titulos_lugares, estricto=False).values():
        if articulo['titulo'] in vistos:  # dos títulos de la categoría que llevan al mismo artículo
            continue
        vistos.add(articulo['titulo'])
        articulos.append({'grupo': 'lugar', 'nombre': re.sub(r' \(Medellín\)$', '', articulo['titulo']), **articulo})

    sitio_12, sitio_previos = suma(sitio['es'], doce), suma(sitio['es'], previos)
    filas = []
    for a in articulos:
        serie = mensual_con_redirecciones('es.wikipedia', a, hasta)
        actual, anterior = suma(serie, doce), suma(serie, previos)
        filas.append({**{k: v for k, v in a.items() if k != 'redirecciones'}, 'redirecciones': len(a['redirecciones']),
                      'url': 'https://es.wikipedia.org/wiki/' + urllib.parse.quote(a['titulo'].replace(' ', '_')),
                      'vistas_12m': actual, 'vistas_12m_previos': anterior, 'variacion_12m': variacion(actual, anterior),
                      'variacion_12m_norm': variacion(actual / sitio_12, anterior / sitio_previos),
                      'mensual': [[etiqueta_mes(m), serie.get(m, 0)] for m in veinticuatro]})
    territorios = sorted((f for f in filas if f['grupo'] == 'territorio'), key=lambda f: -f['vistas_12m'])
    todos_lugares = sorted((f for f in filas if f['grupo'] == 'lugar'), key=lambda f: -f['vistas_12m'])
    t.lista('wiki_territorios', territorios)
    t.lista('wiki_lugares', todos_lugares[:LUGARES_EN_LISTA])
    t.lista('wiki_definicion', [{
        'ventana': vig12, 'ventana_previa': vig_previos,
        'lugares_categoria': CATEGORIA_LUGARES.removeprefix('Categoría:'),
        'lugares_subcategorias': [s.removeprefix('Categoría:') for s in subcategorias],
        'lugares_fuera': [{'categoria': c.removeprefix('Categoría:'), 'motivo': m} for c, m in SUBCATEGORIAS_FUERA.items()],
        'lugares_articulos': len(todos_lugares),
    }])
    suma_territorios = sum(f['vistas_12m'] for f in territorios)
    t.cifra('wiki_territorios_12m', suma_territorios, 'vistas', 'Vistas de los artículos de las 21 comunas y corregimientos',
            'wikimedia-pageviews', vig12, nota=f'{definicion} Suma de los 21 artículos.')
    t.cifra('wiki_lugares_12m', sum(f['vistas_12m'] for f in todos_lugares), 'vistas',
            f'Vistas de los {len(todos_lugares)} artículos de lugares', 'wikimedia-pageviews', vig12,
            nota=f'{definicion} Artículos de la categoría «{CATEGORIA_LUGARES.removeprefix("Categoría:")}» y de sus subcategorías directas, '
                 'salvo festivales y ferias.')
    print(f'  · Wikipedia: {len(territorios)} territorios, {len(todos_lugares)} lugares, hasta {etiqueta_mes(ultimo)}')


# ---------------------------------------------------------------- prensa (GDELT DOC 2.0)

GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc'
UA_GDELT = UA_WIKI
CONSULTA = '(medellín OR medellin)'
DIAS = 90
CORTES = 3  # la lista de artículos trae como máximo 250 por consulta: se pide un corte de 30 días a la vez
POR_CORTE = 250
FORMATO_GDELT = '%Y%m%d%H%M%S'
DIR_GDELT = RAIZ / 'datos' / 'crudos' / 'gdelt'
# GDELT dice aceptar una consulta cada 5 segundos, pero en la práctica responde 429 a ráfagas mucho más lentas y el
# bloqueo dura minutos. Cada consulta se reintenta con esperas largas; si aun así no responde, el bloque conserva la
# ingesta anterior.
PAUSA = 20
ESPERAS_429 = (60, 90, 120, 180, 240, 300, 300, 300)

# GDELT busca en el texto completo: casi todos los artículos que encuentra nombran a Medellín de pasada (la ciudad de la
# fuente, un menú del sitio, una lista de destinos). El filtro deja solo los titulares que tratan de Medellín. Las reglas
# se aplican en este orden y cada titular cuenta en la primera que lo saca.
REGLAS_RUIDO = [
    ('sin_mencion', 'El titular no nombra a Medellín', 'la ciudad aparece solo en el cuerpo de la nota o en el sitio'),
    ('homonimo', 'Otra Medellín', 'el titular habla de Medellín (Cebú, Filipinas), Medellín de Bravo (Veracruz, México) '
                                  'o Medellín (Badajoz, España)'),
    ('otro_sujeto', 'Medellín como nombre propio', 'el titular habla de la Lotería de Medellín o de los resultados de '
                                                   'las loterías, no de la ciudad'),
    ('duplicado', 'Titular repetido', 'el mismo titular ya está en la lista, publicado por otro medio o en otra fecha'),
]
NOMBRA_MEDELLIN = re.compile(r'\bmedell[ií]n\b', re.I)
OTRO_SUJETO = re.compile(r'\blo?ter[ií]as?\b', re.I)
HOMONIMOS = re.compile(r'\b(cebu|cebú|filipinas|philippines|veracruz|medell[ií]n de bravo|badajoz|extremadura)\b', re.I)

# Temas: palabras clave en el titular, en español y algunas en inglés. Cada palabra es un comienzo de palabra ("homicid"
# atrapa "homicidio" y "homicidios"); con "$" al final tiene que ser la palabra completa ("gol$" no atrapa "golpe"). Un
# titular puede tener varios temas o ninguno. Es una clasificación gruesa y se publica con sus palabras para revisarla.
TEMAS_PRENSA = [
    ('seguridad', 'Seguridad y justicia', ['homicid', 'asesin', 'sicari', 'captur', 'crimen', 'criminal', 'delincu', 'hurto',
                                           'robo', 'extorsi', 'polic', 'fiscal', 'cárcel', 'carcel', 'banda', 'combo$',
                                           'narco', 'cartel', 'cártel', 'disparo', 'balacera', 'armad', 'explosiv', 'muert',
                                           'farc', 'disidencia', 'contrabando', 'incaut', 'maltrat', 'desaparec', 'sin vida', 'corrupci',
                                           'megacárcel', 'murder', 'police', 'arrest', 'crime', 'killed', 'drug']),
    ('movilidad', 'Movilidad y transporte', ['metro$', 'metrocable', 'tranvía', 'tranvia', 'vial', 'vías', 'tránsito',
                                             'transito', 'tráfico', 'trafico', 'movilidad', 'aeropuerto', 'vuelo', 'volar',
                                             'aerol', 'avianca', 'bus$', 'buses', 'túnel', 'tunel', 'pico y placa', 'moto',
                                             'terminal', 'viajer', 'ruta$', 'rutas', 'cierres', 'hueco', 'soterrado',
                                             'airport', 'flight']),
    ('gobierno', 'Gobierno y política', ['alcald', 'concejo', 'concejal', 'gobern', 'gobierno', 'elecci', 'candidat',
                                         'petro$', 'presidente', 'presupuesto', 'contrat', 'procurad', 'personería',
                                         'contralor', 'congreso', 'senad', 'decreto', 'pot$', 'gabinete', 'política',
                                         'politica', 'election']),
    ('economia', 'Economía y empleo', ['económ', 'econom', 'empresa', 'empleo', 'desemple', 'desocupa', 'inversi',
                                       'export', 'comercio', 'dólar', 'dolar', 'precio', 'negocio', 'emprend', 'banco',
                                       'bancolombia', 'inmobil', 'vivienda', 'arriendo', 'crédito', 'credito', 'gasolina',
                                       'vacante', 'salari', 'trabajador', 'mercado', 'automotr',
                                       'business', 'invest']),
    ('servicios', 'Servicios públicos', ['agua$', 'acueducto', 'racionamiento', 'energía', 'energia', 'luz$', 'gas$',
                                         'epm$', 'internet', 'basura', 'aseo', 'servicios públicos']),
    ('turismo', 'Turismo y cultura', ['turis', 'festival', 'concierto', 'feria', 'museo', 'cine$', 'película', 'pelicula',
                                      'música', 'musica', 'arte$', 'artista', 'libro', 'exposici', 'gastronom', 'tango', 'cultura',
                                      'patrimonio', 'escénic', 'fiesta', 'destino', 'airbnb', 'pueblos', 'platos',
                                      'planetario', 'parque',
                                      'tour', 'concert', 'music', 'film']),
    ('deporte', 'Deporte', ['fútbol', 'futbol', 'atlético nacional', 'atletico nacional', 'independiente medell', 'dim$',
                            'gol$', 'goles', 'liga$', 'betplay', 'torneo', 'copa$', 'empate', 'estadio', 'ciclis', 'sudamericana',
                            'sul-americana', 'libertadores', 'bmx', 'maratón', 'maraton', 'corredor', 'atleta',
                            'debut', 'expulsi', 'jugar', 'empata',
                            'carrera', 'selección colombia', 'football', 'soccer']),
    ('ambiente', 'Ambiente y riesgo', ['lluvia', 'aguacero', 'inundaci', 'deslizamiento', 'calidad del aire', 'contamina',
                                       'clima', 'calor', 'árbol', 'arbol', 'quebrada', 'incendio', 'sismo', 'temblor', 'terremoto',
                                       'ambient', 'el niño', 'riesgo', 'rain', 'flood', 'climate']),
    ('salud', 'Salud', ['salud', 'hospital', 'clínica', 'clinica', 'dengue', 'vacun', 'eps$', 'médic', 'medic', 'cáncer',
                        'cancer', 'ambulancia', 'embarazo', 'cardi', 'health']),
    ('educacion', 'Educación y ciencia', ['colegio', 'universidad', 'estudiant', 'educa', 'escuela', 'ciencia', 'investigador',
                                          'innovaci', 'tecnolog', 'school', 'university']),
]
IDIOMAS = {'Spanish': 'español', 'English': 'inglés', 'Portuguese': 'portugués', 'French': 'francés',
           'German': 'alemán', 'Italian': 'italiano'}


class Gdelt:
    """Consultas espaciadas a GDELT, con reintentos largos ante 429. Cada respuesta buena se guarda en datos/crudos/gdelt
    con la fecha del día: si la corrida falla en otra consulta, la siguiente corrida del mismo día reutiliza esta y solo
    pide lo que falta."""

    def __init__(self):
        self.ultima = 0.0

    def consulta(self, nombre, **params):
        copia = DIR_GDELT / f'{nombre}-{hoy().isoformat()}.json'
        if copia.exists():
            print(f'  · GDELT {nombre}: copia de hoy en {copia.relative_to(RAIZ)}')
            return json.loads(copia.read_text(encoding='utf-8'))
        url = f'{GDELT}?' + urllib.parse.urlencode({**params, 'format': 'json'})
        for espera in (0, *ESPERAS_429):
            time.sleep(max(espera, self.ultima + PAUSA - time.monotonic()))
            try:
                req = urllib.request.Request(url, headers={'User-Agent': UA_GDELT})
                with urllib.request.urlopen(req, timeout=120) as r:
                    texto = r.read().decode('utf-8', 'replace')
                self.ultima = time.monotonic()
                # Sin resultados, GDELT responde un cuerpo vacío en vez de un JSON vacío.
                datos = json.loads(texto) if texto.strip() else {}
                DIR_GDELT.mkdir(parents=True, exist_ok=True)
                copia.write_text(json.dumps(datos, ensure_ascii=False), encoding='utf-8')
                print(f'  · GDELT {nombre}: respondió')
                return datos
            except urllib.error.HTTPError as e:
                self.ultima = time.monotonic()
                if e.code not in (429, 500, 502, 503, 504):
                    raise
                print(f'  · GDELT {nombre}: respondió {e.code}; se reintenta')
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                self.ultima = time.monotonic()
        raise RuntimeError(f'GDELT no respondió tras {len(ESPERAS_429) + 1} intentos: {nombre}')


def limpiar_titular(texto):
    """GDELT separa la puntuación con espacios ("Medellín : imágenes", "30 . 000") y quita las comillas dejando dos espacios."""
    texto = re.sub(r'\s+', ' ', texto or '').strip()
    texto = re.sub(r' ([,.:;?!)%»])', r'\1', texto)
    texto = re.sub(r'(\d)\. (\d{3})\b', r'\1.\2', texto)  # "30 . 000" → "30.000"
    return re.sub(r'([(¿¡«]) ', r'\1', texto)


def clave_titular(texto):
    sin_tildes = ''.join(c for c in unicodedata.normalize('NFD', texto.lower()) if unicodedata.category(c) != 'Mn')
    # Muchos medios agregan su nombre al final ("… – Publinews", "… / Min30"): se compara sin él.
    return re.sub(r'\W+', ' ', re.split(r' [–|/-] ', sin_tildes)[0]).strip()


def temas_de(titulo):
    texto = titulo.lower()
    return [clave for clave, _, palabras in TEMAS_PRENSA
            if any(re.search(r'\b' + re.escape(p.rstrip('$')) + (r'\b' if p.endswith('$') else ''), texto) for p in palabras)]


def filtrar_titulares(articulos):
    """Aplica las reglas de ruido en orden. Devuelve los titulares que quedan y cuántos saca cada regla."""
    quedan, sacados, vistos = [], {r[0]: 0 for r in REGLAS_RUIDO}, set()
    for a in sorted(articulos, key=lambda a: a['seendate']):
        titulo = limpiar_titular(a.get('title'))
        if not NOMBRA_MEDELLIN.search(titulo):
            sacados['sin_mencion'] += 1
        elif HOMONIMOS.search(titulo):
            sacados['homonimo'] += 1
        elif OTRO_SUJETO.search(titulo):
            sacados['otro_sujeto'] += 1
        elif clave_titular(titulo) in vistos:
            sacados['duplicado'] += 1
        else:
            vistos.add(clave_titular(titulo))
            fecha = dt.datetime.strptime(a['seendate'], '%Y%m%dT%H%M%SZ').date()
            quedan.append({'fecha': fecha.isoformat(), 'titulo': titulo, 'medio': a.get('domain', ''),
                           'idioma': IDIOMAS.get(a.get('language'), a.get('language') or 'sin dato'),
                           'pais': a.get('sourcecountry') or 'sin dato', 'url': a['url'], 'temas': temas_de(titulo)})
    return sorted(quedan, key=lambda q: q['fecha'], reverse=True), sacados


def fecha_corta(fecha):
    return f'{fecha.day} {MESES[fecha.month - 1]} {fecha.year}'


def ventana_prensa():
    fin = dt.datetime.now(dt.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return fin - dt.timedelta(days=DIAS), fin


def ingestar_volumen(t, g):
    """Volumen diario: todos los artículos que nombran a Medellín en algún lugar del texto, y el total que GDELT
    monitoreó ese día (para la proporción)."""
    inicio, fin = ventana_prensa()
    t.fuente('gdelt-volumen', 'Artículos que nombran a Medellín por día (DOC API 2.0, timelinevolraw)', 'GDELT Project',
             f'{GDELT}?' + urllib.parse.urlencode({'query': CONSULTA, 'mode': 'timelinevolraw', 'timespan': '3m'}))
    datos = g.consulta('volumen', query=CONSULTA, mode='timelinevolraw', startdatetime=inicio.strftime(FORMATO_GDELT),
                       enddatetime=(fin - dt.timedelta(seconds=1)).strftime(FORMATO_GDELT))
    puntos = {dt.datetime.strptime(d['date'][:8], '%Y%m%d').date(): d for d in (datos.get('timeline') or [{}])[0].get('data', [])}
    if len(puntos) < DIAS // 2:
        raise RuntimeError(f'GDELT devolvió solo {len(puntos)} días de volumen')
    dias = [(inicio + dt.timedelta(days=i)).date() for i in range(DIAS)]
    # Un día que GDELT no publica (tampoco su total monitoreado) es un hueco de la fuente, no un día sin noticias.
    sin_dato = [d for d in dias if d not in puntos]
    vigencia = f'{fecha_corta(dias[0])} – {fecha_corta(dias[-1])}'
    total = sum(p['value'] for p in puntos.values())
    nota = ('Artículos de prensa en línea, de cualquier país e idioma, que nombran a Medellín en algún lugar del texto, '
            'según el monitoreo de GDELT. Incluye notas que solo la mencionan de pasada.')
    if sin_dato:
        nota += (f' GDELT no publica datos de {len(sin_dato)} días de la ventana ({", ".join(fecha_corta(d) for d in sin_dato)}); '
                 'se muestran como hueco.')
    t.cifra('prensa_menciones_90d', total, 'artículos', f'Artículos de prensa que nombran a Medellín · {DIAS} días',
            'gdelt-volumen', vigencia, ancla=True, nota=nota)
    t.cifra('prensa_menciones_dia', round(total / len(puntos)), 'artículos/día', 'Promedio diario de artículos',
            'gdelt-volumen', vigencia, estado='derivado', nota=f'Total de la ventana dividido por los {len(puntos)} días con dato.')
    t.serie('prensa_menciones_diarias', [[fecha_corta(d), puntos[d]['value'] if d in puntos else None] for d in dias],
            'artículos', 'Artículos de prensa que nombran a Medellín, por día', 'gdelt-volumen', nota=nota)
    t.serie('prensa_menciones_por_millon',
            [[fecha_corta(d), round(puntos[d]['value'] / puntos[d]['norm'] * 1e6) if d in puntos and puntos[d].get('norm') else None]
             for d in dias],
            'por millón', 'Artículos que nombran a Medellín por millón de artículos monitoreados', 'gdelt-volumen',
            estado='derivado', nota='Artículos que nombran a Medellín divididos por todos los que GDELT monitoreó ese día. '
                                    'Separa la atención a Medellín de los cambios en el tamaño del monitoreo.')
    print(f'  · GDELT: {total} artículos en {len(puntos)} días con dato')


def ingestar_titulares(t, g):
    """Titulares: los más relevantes según GDELT en cada corte de 30 días, filtrados y clasificados por tema."""
    inicio, _ = ventana_prensa()
    t.fuente('gdelt-titulares', 'Artículos más relevantes que nombran a Medellín (DOC API 2.0, artlist)', 'GDELT Project',
             f'{GDELT}?' + urllib.parse.urlencode({'query': CONSULTA, 'mode': 'artlist', 'sort': 'hybridrel',
                                                   'maxrecords': POR_CORTE, 'timespan': '1m'}))
    articulos, cortes = [], []
    paso = dt.timedelta(days=DIAS // CORTES)
    for i in range(CORTES):
        desde, hasta = inicio + i * paso, inicio + (i + 1) * paso - dt.timedelta(seconds=1)
        lote = g.consulta(f'titulares-{desde:%Y%m%d}', query=CONSULTA, mode='artlist', sort='hybridrel', maxrecords=POR_CORTE,
                          startdatetime=desde.strftime(FORMATO_GDELT), enddatetime=hasta.strftime(FORMATO_GDELT)).get('articles', [])
        articulos += lote
        cortes.append({'desde': fecha_corta(desde.date()), 'hasta': fecha_corta(hasta.date()), 'articulos': len(lote)})
    # Un artículo puede salir en dos cortes si GDELT lo vio cerca del límite.
    articulos = list({a['url']: a for a in articulos}.values())
    titulares, sacados = filtrar_titulares(articulos)
    if not titulares:
        raise RuntimeError('Ningún titular de GDELT nombra a Medellín')
    vigencia = f'{cortes[0]["desde"]} – {cortes[-1]["hasta"]}'
    t.cifra('prensa_titulares_muestra', len(articulos), 'artículos', 'Artículos revisados por su titular', 'gdelt-titulares',
            vigencia, nota=f'Los {POR_CORTE} más relevantes según GDELT en cada uno de {CORTES} cortes de {DIAS // CORTES} días. '
                           'Es una muestra, no el total de la ventana.')
    t.cifra('prensa_titulares_medellin', len(titulares), 'titulares', 'Titulares que nombran a Medellín', 'gdelt-titulares',
            vigencia, estado='derivado',
            nota='Lo que queda de la muestra tras el filtro de ruido: sin titulares que no nombran a Medellín, sin '
                 'homónimos y sin repetidos.')
    t.cifra('prensa_titulares_pct', round(len(titulares) / len(articulos) * 100, 1), '%',
            'Artículos de la muestra cuyo titular nombra a Medellín', 'gdelt-titulares', vigencia, estado='derivado',
            decimales=1, nota='Titulares que quedan tras el filtro de ruido sobre los artículos revisados.')
    t.lista('prensa_ruido', [{'regla': r, 'etiqueta': e, 'motivo': m, 'articulos': sacados[r]} for r, e, m in REGLAS_RUIDO])
    t.lista('prensa_temas', sorted(
        [{'tema': clave, 'etiqueta': etiqueta, 'palabras': palabras,
          'titulares': sum(clave in q['temas'] for q in titulares),
          'pct': round(sum(clave in q['temas'] for q in titulares) / len(titulares) * 100, 1)}
         for clave, etiqueta, palabras in TEMAS_PRENSA], key=lambda x: -x['titulares']))
    t.lista('prensa_titulares', titulares)
    t.lista('prensa_definicion', [{'ventana': vigencia, 'consulta': CONSULTA, 'cortes': cortes,
                                   'sin_tema': sum(not q['temas'] for q in titulares)}])
    print(f'  · GDELT: {len(titulares)} de {len(articulos)} titulares nombran a Medellín')


def main():
    t = Tema('escucha', 'Escucha social')
    with t.bloque('wikimedia-pageviews'):
        ingestar_wikipedia(t)
    g = Gdelt()
    with t.bloque('gdelt-volumen'):
        ingestar_volumen(t, g)
    with t.bloque('gdelt-titulares'):
        ingestar_titulares(t, g)
    # El bloque conserva las cifras y series de una fuente que falla, pero no sus listas: se heredan aquí.
    for fuente, prefijo in (('wikimedia-pageviews', 'wiki_'), ('gdelt-titulares', 'prensa_')):
        if fuente in t.fallos:
            t.listas.update({k: v for k, v in (t.previo or {}).get('listas', {}).items() if k.startswith(prefijo)})
    t.escribir()
    return t


if __name__ == '__main__':
    main()
