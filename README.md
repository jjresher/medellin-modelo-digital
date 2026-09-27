# Modelo Digital de Medellín

Gemelo territorial de Medellín: indicadores urbanos verificables y un gemelo 3D explorable. Sigue la estructura de [Cerebro Lima](https://cerebro-lima.vercel.app/).

- Plan de trabajo: [docs/issues.md](docs/issues.md)
- Fuentes investigadas y verificadas: [docs/fuentes-medellin.md](docs/fuentes-medellin.md)

## Ver la app

```bash
npm install      # solo la primera vez
npm run dev      # abre http://localhost:3000
```

## Lago de datos

La app no tiene cifras escritas a mano: todas salen de `public/data/lago/`, que generan los scripts de `ingesta/`. Cada tema es un JSON con este contrato:

| Campo | Contenido |
|---|---|
| `cifras` | `valor`, `unidad`, `etiqueta`, `fuente`, `vigencia` y `estado`, más `nota` y `decimales` opcionales |
| `series` | Puntos `[etiqueta, valor]` con su fuente y su vigencia |
| `listas` | Rankings o tablas |
| `fuentes` | Entidad, URL, estado y fecha `probado` de cada fuente |
| `ancla` | Cifras que el tema aporta al Panorama |

Estados: `observado` (dato abierto descargado), `declarado` (leído de un PDF o de prensa), `derivado` (calculado) y `candidato` (existe pero no es abierto).

Archivos generados además de los temas:
- `indice.json`: lista de temas.
- `catalogo.json`: todas las fuentes; alimenta la sección Fuentes.

### Actualizar los datos

Solo la primera vez, prepara el entorno de Python y compila tippecanoe (se instala dentro del proyecto, en `.herramientas/`, sin sudo; necesita `build-essential`):

```bash
python3 -m venv .venv
.venv/bin/pip install -r ingesta/requirements.txt
ingesta/instalar_tippecanoe.sh
```

**Gemelo 3D.** Las construcciones del catastro (más de un millón) se descargan a `datos/crudos/` y se convierten a `public/data/edificios.pmtiles` (unos 57 MB). Ni los datos crudos ni el PMTiles se guardan en git: después de clonar el proyecto hay que generarlos con `npm run ingesta` (o solo `.venv/bin/python ingesta/correr.py gemelo`, unos 6 minutos). Sin ese archivo, el mapa muestra los límites y avisa que faltan los edificios.

**Lentes y capas temáticas.** `ingesta/pull_lentes.py` depende de lo que genera el gemelo: los límites y el cruce espacial de las construcciones. Por eso `correr.py` lo ejecuta después de `gemelo`. Produce:
- las capas del panel Explorar, en `public/data/geo/capas/`;
- el mapa de calor de siniestros viales, en `public/data/siniestros.pmtiles` (no se guarda en git);
- la rejilla para "Analizar punto", en `public/data/geo/analisis.json`;
- los índices 0–100 por comuna, en el tema `lentes` del lago.

Para regenerar solo esto: `.venv/bin/python ingesta/correr.py lentes`, unos 6 minutos.

**Ortofotos.** El mapa las pide a `/api/ortofoto/<año>/{z}/{y}/{x}`, un proxy que guarda cada tesela en `.cache/ortofoto/`. El servidor de la Alcaldía se cae con frecuencia; cuando falla, se ve la imagen satelital de Esri debajo.

**Gente.** `pull_demografia.py` descarga una vez el archivo del DANE por sexo y edad (131 MB) a `datos/crudos/` y lo reutiliza mientras no cambie de tamaño. Necesita `public/data/geo/comunas.geojson` (lo genera `gemelo`) para los nombres de los 21 territorios. Tarda unos 2 minutos.

**Economía.** `pull_economia.py` descarga unas 154.000 ofertas de vivienda de la OIME y las 92.000 licencias de las curadurías. La capa de licencias no admite paginación y el servidor de la Alcaldía falla a ratos, así que se baja por rangos de id con reintentos; puede tardar 5 minutos o más. También escribe `public/data/geo/capas/economia_valor_suelo.geojson` para el gemelo.

**Seguridad.** `pull_seguridad.py` descarga además 8 archivos del SISC (MEData), hasta 124 MB el más pesado, y necesita `public/data/geo/comunas.geojson` (lo genera `gemelo`) y `demografia.json` para la tasa por comuna. Con buena conexión tarda unos 5 minutos; produce `public/data/geo/seguridad_barrios.json` para el mapa por barrio.

**Ambiente.** Lo que cambia cada pocos minutos (calidad del aire, lluvia, niveles, temperatura, ruido, alertas y sismos) **no se guarda en el lago**: la app lo pide en vivo a `/api/ambiente/<recurso>`, un proxy que cachea 10 minutos en `.cache/ambiente/` y, si el SIATA no responde, sirve la última copia marcada como obsoleta con su hora. `pull_ambiente.py` solo ingesta lo estable: el tamaño de cada red del SIATA, la serie anual de sismos del USGS y el mapa de ruido del AMVA (`public/data/geo/capas/ruido_amva_{dia,noche}.geojson`, unos 735 KB cada uno). Necesita `public/data/geo/comunas.geojson` (lo genera `gemelo`) para recortar las isófonas al Distrito y tarda unos 2 minutos y medio, casi todo en unirlas.

Para actualizar:

```bash
npm run ingesta                                # todos los temas, luego catálogo, índice y verificación
.venv/bin/python ingesta/correr.py seguridad   # solo un tema
npm run verificar                              # solo verificar el lago
.venv/bin/python ingesta/verificar.py --red    # verificar además que cada URL de fuente responda
```

Si una fuente no responde, su script conserva lo que esa fuente aportó en la ingesta anterior, con su fecha `probado` original. La corrida termina con código de salida 1 y lista las fuentes que fallaron. El servidor de mapas de la Alcaldía, en particular, se cae con frecuencia.

### Agregar un tema o una fuente

1. Crea `ingesta/pull_<tema>.py` con una función `main()`. Usa `Tema` de `ingesta/lago.py` y ingesta cada fuente dentro de `with tema.bloque('<id-fuente>'):`.
2. Agrega el tema a `TEMAS` en `ingesta/correr.py` y su color a `accentByTheme` en `src/data/navegacion.js`.
3. Corre `npm run ingesta`. La verificación debe terminar en `✓ lago válido`.
