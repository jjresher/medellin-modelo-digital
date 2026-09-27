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

**Ortofotos.** El mapa las pide a `/api/ortofoto/<año>/{z}/{y}/{x}`, un proxy que guarda cada tesela en `.cache/ortofoto/`. El servidor de la Alcaldía se cae con frecuencia; cuando falla, se ve la imagen satelital de Esri debajo.

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
