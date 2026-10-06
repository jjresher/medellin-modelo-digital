# Issues · Modelo Digital de Medellín

Hoja de ruta para llevar la app a la estructura de [Cerebro Lima](https://cerebro-lima.vercel.app/), con datos de Medellín. Las issues se hacen **una por una, en el orden de la tabla**. Cada una indica qué construir, qué datos usar (con enlace a su sección en [fuentes-medellin.md](fuentes-medellin.md)) y cuándo se considera terminada.

**Reglas para todas las issues**

- **Next.js:** antes de escribir código, leer la guía correspondiente en `node_modules/next/dist/docs/`. Este proyecto usa Next.js 16 y su API cambia respecto de versiones anteriores (ver [AGENTS.md](../AGENTS.md)).
- **Sin cifras a mano:** toda cifra sale del lago de datos (#0). Si un dato falta, su tarjeta no se muestra.
- **Trazabilidad:** cada cifra muestra fuente, vigencia y estado (`observado`, `declarado`, `derivado` o `candidato`).
- **Vigencia real:** se calcula a partir del dato mismo, no de la fecha que declara el portal (ver [Discrepancias](fuentes-medellin.md#5-discrepancias-y-lectura-responsable)).
- **Cero juicios de valor:** el dato se presenta crudo, con su unidad, su vigencia y su fuente; nunca con una valoración de si es "bueno", "malo" o "preocupante". La única excepción es una definición técnica del indicador (por ejemplo, "tasa de homicidios por 100.000 habitantes"), nunca una lectura de lo que significa.
- **Estilo:** oscuro Monokai, como el actual; debe funcionar en móvil.

## Resumen

| # | Issue | Depende de | Estado |
|---|---|---|---|
| 0 | [Lago de datos, ingesta y verificación](#0-lago-de-datos-ingesta-y-verificación) | — | ☑ |
| 1 | [Gemelo 3D con alturas reales](#1-gemelo-3d-con-alturas-reales) | 0 | ☑ |
| 2 | [Lentes y herramientas del gemelo](#2-lentes-y-herramientas-del-gemelo) | 1 | ☑ |
| 3 | [Seguridad](#3-seguridad) | 0 | ☑ |
| 4 | [Ambiente y satélite](#4-ambiente-y-satélite) | 0 | ☑ |
| 5 | [Gente](#5-gente) | 0 | ☑ |
| 6 | [Economía y vivienda](#6-economía-y-vivienda) | 0 | ☑ |
| 7 | [Turismo](#7-turismo) | 0 | ☑ |
| 8 | [Municipio](#8-municipio) | 0 | ☑ |
| 9 | [Servicios públicos](#9-servicios-públicos) | 0 | ☑ |
| 10 | [Territorio y cultura](#10-territorio-y-cultura) | 0, 1 | ☑ |
| 11 | [Atlas de comunas y barrios](#11-atlas-de-comunas-y-barrios) | 3, 5, 6, 9 | ☑ |
| 12 | [Correlaciones](#12-correlaciones) | 11 | ☑ |
| 13 | [Escucha social](#13-escucha-social) | 0 | ☑ |
| 14 | [Panorama y diagnóstico territorial](#14-panorama-y-diagnóstico-territorial) | 1–12 | ☑ |
| 15 | [Fuentes y método](#15-fuentes-y-método) | 0 | ☑ |
| 16 | [Experiencia general: buscador, clima y presentación](#16-experiencia-general-buscador-clima-y-presentación) | 14 | ☑ |

Panorama va casi al final porque resume las cifras ancla de todas las demás secciones.

### Revisión general de las issues 0 a 11 (1 oct 2026)

Se probó cada sección en un Chrome sin ventana, a 1400 y a 390 px, haciendo clic en todos sus controles (`npm run qa`, ver README). Lo que salió y se corrigió:

- **Gemelo 3D:** al tocar el mapa saltaba `popupFields is not defined` y no abría ninguna ficha de capa ni de construcción. Venía de dividir `Map3D.jsx` en la auditoría (commit "fix small detaills"). ESLint no lo veía porque la configuración de Next no incluye `no-undef`; ahora está activa.
- **Ambiente:** una estación de ruido sin lectura mostraba "-999,0 dB(A)" (el valor con que el SIATA marca "sin dato") y habría entrado a los promedios; ahora ese valor se descarta en toda lectura en vivo y se rotula "sin dato". La tarjeta de sismos de 12 meses decía 101 (última ingesta) junto a una tabla que decía 106 (en vivo): la tarjeta usa la lectura en vivo.
- **Rejillas:** las tarjetas de cifras de a cuatro dejaban huecos con 1, 2, 3 o 5 tarjetas (Municipio); ahora llenan su fila. Las gráficas de línea y los mapas crecen hasta llenar su tarjeta cuando la de al lado es más alta. En Economía y Municipio se reorganizaron dos pares de gráficas que dejaban media tarjeta vacía.
- **Tablas que se salían de su tarjeta** en escritorio (contratos de Municipio, sismos, cobertura por estrato, espacio verde por territorio).
- **Detalles:** barras de desplazamiento blancas sobre el fondo oscuro; la atribución del mapa tapaba la leyenda en Seguridad y Ambiente; valores largos de las barras partidos en dos líneas; nombres largos cortados en los rankings; la serie sólida sin muestra de color en la leyenda de las gráficas de dos series; el aviso de consola `wood-pattern` de cada mapa; la etiqueta "derivado" más grande dentro de los avisos; nombres de corregimientos con y sin "Corregimiento de" en Seguridad.
- **Lo que se dejó igual:** una tarjeta con una tabla o unas pocas barras al lado de otra más alta conserva espacio libre debajo (por ejemplo, la ficha por territorio cuando el indicador tiene un solo año). *Corregido el 2 de octubre; ver abajo.*
- **Tarjetas con espacio vacío (2 oct 2026):** `npm run qa` avisaba de 11 tarjetas con más de 90 px vacíos a 1400 px, en Gente, Economía, Turismo, Servicios y Territorio. Ya no queda ninguna, tampoco después de hacer clic en cada control:
  - Regla general en `globals.css`, la misma que ya tenían las gráficas de línea y los mapas: cuando la tarjeta de al lado es más alta, las barras de un ranking se reparten en la altura que sobra y las filas de una tabla crecen por igual. Sin altura de sobra, nada cambia; en el celular, a una columna, tampoco.
  - **Turismo:** el bloque por territorio tenía una ficha de solo dos filas junto a un ranking de 21. Ahora son los dos rankings lado a lado (atractivos y hospedajes), cada uno con su vigencia, su estado y su fuente; el territorio que se toca se resalta en los dos.
  - **Territorio:** la tabla de hectáreas por amenaza y grado (4 filas) estaba junto al mapa. Ahora el mapa va junto a las zonas de alto riesgo no mitigable y las hectáreas, debajo, a lo ancho. Con "Ver las 305", las zonas se desplazan dentro de su tarjeta para no estirar el mapa.
  - De paso: la tabla de ocupación hotelera por zona decía "79,6 % %".
- **Sigue pendiente de revisar a mano:** la fluidez del gemelo en un portátil normal (issues 1, 2 y 4).


---

## 0. Lago de datos, ingesta y verificación

**Objetivo:** construir la base que alimenta toda la app, con el mismo modelo que Cerebro Lima.

**Tareas**
- [x] Definir el contrato de cada tema en `public/data/lago/<tema>.json`:
  - `cifras`, cada una con `valor`, `unidad`, `etiqueta`, `fuente`, `vigencia` y `estado`.
  - `series`: gráficas con puntos, unidad, vigencia y fuente.
  - `listas`: tablas o rankings.
  - `fuentes`: `id`, `nombre`, `url`, `estado`.
  - `probado`: fecha de la última ingesta.
- [x] Crear la carpeta `ingesta/` con un script por tema (`pull_<tema>.py`), sin llaves ni credenciales.
- [x] Crear `ingesta/verificar.py`, que valida esquema, rangos, vigencias y URLs, y falla si algo no cumple.
- [x] Generar `catalogo.json` con cada dataset y su estado. Alimenta la sección Fuentes (#15).
- [x] Crear un cargador en el frontend que lea el lago y omita las tarjetas sin dato.
- [x] Reemplazar `src/data/urbanData.js` por el lago. Incluye actualizar el desempleo a 6,97 % (mayo–julio de 2026).
- [x] Documentar en el README cómo correr la ingesta.

**Datos:** todo [fuentes-medellin.md](fuentes-medellin.md), en especial [§1 Cómo funciona la referencia](fuentes-medellin.md#1-cómo-funciona-la-referencia) y [§6 Arquitectura](fuentes-medellin.md#6-arquitectura-propuesta).

**Terminada cuando:** `python ingesta/verificar.py` pasa, y el Panorama actual se muestra leyendo el lago, sin cifras escritas en el código.

**Resultado (26 sep 2026)**
- 5 temas en el lago: demografía, economía, seguridad, turismo y movilidad.
- 36 cifras y 16 series, con 7 cifras ancla en el Panorama.
- Cada issue temática amplía el script de su tema (`ingesta/pull_<tema>.py`) en vez de crear uno nuevo.
- **Pendiente externo:** hogares y viviendas (DAP) no se han podido ingestar porque el servidor de mapas de la Alcaldía está caído. El script ya está listo; aparecerán al correr `npm run ingesta` cuando el servidor vuelva.
- **Corrección:** la afluencia del Metro es de unas 997.000 entradas por día hábil, no 1,99 millones. La hoja trae una columna de total que se había sumado dos veces; ya está corregido también en `fuentes-medellin.md`.

---

## 1. Gemelo 3D con alturas reales

**Objetivo:** reemplazar la muestra de 19.000 edificios con extrusión visual por el catastro completo, con alturas reales.

**Tareas**
- [x] Script de ingesta que descargue las construcciones urbanas del catastro, paginando de 2.000 en 2.000 (1.022.432 registros).
- [x] Convertirlas a PMTiles con `tippecanoe` y cargarlas en MapLibre con el protocolo `pmtiles`.
- [x] Calcular la extrusión con `ALTURA` o, si falta, `NUMERO_PISOS × ALTURAPISO`, y colorear por número de pisos.
- [x] Al hacer clic en un edificio, mostrar pisos, sótanos, altura, área construida, año de construcción y CBML.
- [x] Mapas base intercambiables: oscuro (OpenFreeMap), ortofoto 2024 de la Alcaldía y satélite ESRI.
- [x] Terreno 3D con `raster-dem`: el DEM de la Alcaldía de 2024 o las teselas de terreno de AWS.
- [x] Capas de barrios (271) y de corregimientos, además de las comunas.
- [x] Quitar el archivo `medellin-open-buildings.geojson` o dejarlo como capa opcional.

**Datos:** [Gemelo 3D y cartografía](fuentes-medellin.md#gemelo-3d-y-cartografía).

**Terminada cuando:** El Poblado y el Centro muestran torres con su altura real, el mapa fluye en un portátil normal y la ortofoto 2024 funciona como base.

**Resultado (26 sep 2026)**
- 1.078.553 construcciones del catastro (1.022.432 urbanas y 56.121 rurales) en `public/data/edificios.pmtiles`, de 57 MB. Se genera en unos 6 minutos con `correr.py gemelo` y no se guarda en git.
- Límites del IDEM, más fiable que el servidor de la Alcaldía: 16 comunas, 5 corregimientos, 271 barrios y 79 veredas.
- Tres mapas base (oscuro, ortofoto 2024 y satélite Esri), relieve 3D, popups de construcción y selección de comuna o barrio. El panel de conteos lee sus cifras del lago.
- tippecanoe se compila dentro del proyecto con `ingesta/instalar_tippecanoe.sh`, sin sudo.
- **Corrección de alcance:** el catastro no publica una altura medida. `ALTURA` ≈ pisos × 2,3 m, así que el mapa la llama "altura catastral" y lo explica en el popup y en las notas. Una altura medida queda como `candidato` (ver [fuentes](fuentes-medellin.md#gemelo-3d-y-cartografía)).
- El servidor de la Alcaldía estuvo caído buena parte de la tarde. La ortofoto se sirve por un proxy con caché en disco (`/api/ortofoto/<año>/…`) y, cuando falta, se ve Esri debajo. El proxy ya acepta 2016, 2019 y 2021 para "comparar fechas" (#2).
- No se usó el DEM 2024 de la Alcaldía: es un ImageServer y habría que convertirlo a teselas Terrarium. El relieve viene de AWS Terrain Tiles.
- De paso: navegación por `#hash` (por ejemplo `/#twin`, que es parte de #16) y un ícono para la app.
- **Pendiente de revisar a mano:** la fluidez en un portátil normal. Solo se probó con Chrome sin GPU.

---

## 2. Lentes y herramientas del gemelo

**Objetivo:** que el mapa responda preguntas, como las lentes de Cerebro Lima.

**Tareas**
- [x] Cuatro lentes en la barra superior del mapa:
  - **Cruce urbano:** combina las otras tres lentes en un índice por comuna.
  - **Energía:** 26 subestaciones y redes de alta y media tensión.
  - **Densificación:** pisos construidos frente a la altura normativa del POT.
  - **Presión vial:** aforos, velocidad por corredor y siniestros. Es un indicador estructural de 0 a 100, no tráfico en vivo, y debe decirlo en pantalla.
- [x] Panel **Explorar** con capas temáticas: Movilidad, Servicios, Turismo, Verde, Planificación, Edificación 3D y Riesgo.
- [x] **Analizar punto:** radios de 500 m y 1 km que resumen edificios, energía, equipamientos y siniestros cercanos.
- [x] Herramientas: medir distancia, comparar fechas (ortofotos 2016, 2019, 2021 y 2024), HUD técnico, norte, pantalla completa y compartir vista (cámara, base y capas en la URL).
- [x] Atajos de teclado: `1`–`4` lentes, `E` explorar, `A` analizar, `M` medir, `H` HUD, `Esc` salir.
- [x] Guía inicial "Empieza aquí" y ayuda rápida con los atajos.
- [x] Recuadro "Qué estás viendo" con la fuente, la vigencia y el estado de cada capa.

**Datos:**
- [Energía](fuentes-medellin.md#energía-e-infraestructura-equivale-a-la-lente-de-energía-de-lima)
- [Movilidad](fuentes-medellin.md#movilidad)
- [Territorio, POT y cultura](fuentes-medellin.md#territorio-pot-y-cultura)
- Ortofotos 2016–2024 en [Gemelo 3D](fuentes-medellin.md#gemelo-3d-y-cartografía)

**Terminada cuando:** cada lente cambia el mapa y explica su método, "Analizar" devuelve cifras con fuente, y un enlace compartido abre la misma vista.

**Resultado (26 sep 2026)**
- Nuevo tema del lago `lentes` (`ingesta/pull_lentes.py`), con 13 cifras. Índices 0–100 para las 21 comunas y corregimientos, calculados como posición relativa entre ellas:
  - **Energía:** km de red de media tensión y de alta tensión por km². No hay demanda eléctrica abierta por comuna, así que la lente muestra infraestructura.
  - **Densificación:** índice de construcción bruto y pisos promedio. En el mapa, cada construcción se colorea por pisos frente a la altura normativa del POT.
  - **Presión vial:** víctimas viales por km² al año (2019–2021) y volumen en hora pico de los aforos (2017–2019). Son las series abiertas más recientes.
  - **Cruce urbano:** promedio de las tres.
- Panel Explorar con 6 capas temáticas (Movilidad, Servicios, Turismo, Verde, Planificación, Riesgo) más la edificación 3D. Cada capa se descarga solo cuando se activa.
- Herramientas:
  - Analizar (radios de 500 m y 1 km sobre una rejilla de ~110 m).
  - Medir, comparar ortofotos 2016–2024 con mezcla y HUD.
  - Norte y compartir vista (cámara, base, lente y capas en la URL).
  - Atajos, ayuda, guía inicial y "Qué estás viendo" con fuente, vigencia y estado de cada capa.
- Con base fotográfica se ocultan los rellenos y las líneas del estilo oscuro, que tapaban la imagen, y se dejan solo las etiquetas.
- Correcciones que salieron al probar:
  - Descargas ArcGIS truncadas en 2.000 elementos: se agregó paginación en la librería compartida.
  - Mapa de calor saturado: se ajustaron el peso y el radio.
  - Porcentaje "sobre la norma" sin base: ahora se muestra el conteo, por ejemplo 536 construcciones en Laureles.
- `Map3D.jsx` se dividió en `src/components/twin/`: `Map3D`, `config`, `Paneles` y `geo`.
- **Pendiente de revisar a mano:** la fluidez con varias capas y el relieve activos en un portátil normal. La interfaz ya se revisó en un celular real.

---

## 3. Seguridad

**Objetivo:** mostrar la seguridad de la ciudad con series actuales y un mapa histórico por barrio.

**Tareas**
- [x] Series anuales y mensuales 2018–2026 (Policía): homicidio, hurto a personas, hurto de vehículos, extorsión, violencia intrafamiliar, delitos sexuales y lesiones personales.
- [x] Tasas por 100.000 habitantes con la población del DANE (estado `derivado`): homicidios 2024 = 11,81 y 2025 = 12,64 (2025 = 13,17 desde la issue #5, con la proyección PPED del DANE).
- [x] Comparación del año en curso con el mismo periodo del año anterior.
- [x] Mapa de calor por barrio con el SISC de 2003 a noviembre de 2023, rotulado como histórico.
- [x] Ranking de comunas por tipo de delito (SISC).
- [x] Nota visible: la Policía y el SISC no se mezclan en una misma serie (ver discrepancia de 2023).

**Datos:** [Seguridad](fuentes-medellin.md#seguridad) y la [discrepancia 2](fuentes-medellin.md#5-discrepancias-y-lectura-responsable).

**Terminada cuando:** las cifras de 2026 llegan hasta el último mes publicado y el mapa de calor carga por barrio.

**Resultado (26 sep 2026)**
- `pull_seguridad.py` ahora ingesta también el SISC: 8 archivos de MEData (hasta 124 MB el más pesado), agregados por comuna (ranking, 21 territorios) y por barrio/vereda (350 polígonos, `public/data/geo/seguridad_barrios.json`). El tema `seguridad` del lago pasó de 8 a 36 cifras y de 2 a 22 series.
- Tasa por 100.000 habitantes ahora se calcula para los 7 delitos de la Policía, no solo homicidios; y la serie mensual (2 años) también se generó para los 7, no solo homicidios.
- Nueva sección `Seguridad` (`src/components/SeguridadView.jsx`): selector de delito para las series de la Policía, aviso visible de que Policía y SISC no se mezclan, selector de categoría SISC con un ranking de comunas (gráfica de barras, con vista de tabla) y un mapa por barrio lado a lado.
- Dos componentes de gráficas nuevos y reutilizables para las issues siguientes: `LineChart` y `BarChart` (`src/components/charts/`), siguiendo la skill de dataviz: un acento por gráfica (nunca dos acentos saturados compitiendo en una misma serie), leyenda solo con 2+ series, tooltip por hover/foco y vista de tabla en el ranking.
- **Decisión de diseño, documentada en `fuentes-medellin.md`:** el "mapa de calor por barrio" se implementó como un coropletico (casos agregados al polígono del barrio, coloreados con la misma rampa secuencial de los índices del gemelo), no como un mapa de calor de puntos (kernel de densidad). Reutiliza los polígonos que ya existían del catastro y no exige generar un PMTiles nuevo.
- **Corrección encontrada al probar:** el mapa por barrio se veía negro por completo. Faltaba `maplibregl.setWorkerUrl(...)`, la misma corrección para Next/Turbopack que ya tiene `Map3D.jsx`; sin ella, ni el estilo base ni las fuentes GeoJSON se procesan. Quedó igual en `BarrioMap.jsx`.
- **Año en curso frente al anterior (1 oct 2026):** la gráfica mensual dibuja ahora dos líneas, el año en curso (sólida) y el mismo mes del año anterior (punteada). La serie mensual que ya se ingestaba trae los dos años; se separan en `src/lib/series.js`. La cifra de variación % sigue al lado.

---

## 4. Ambiente y satélite

**Objetivo:** mostrar datos ambientales en vivo del Valle de Aburrá y capas satelitales.

**Tareas**
- [x] Ruta de Next.js que funcione como proxy del SIATA con caché de 10 minutos, porque el SIATA no permite CORS. Capas: PM2.5 e ICA, pluviómetros, niveles de quebradas, temperatura y viento, y ruido.
- [x] Tarjetas en vivo: ICA promedio, estación con peor aire, lluvia acumulada y alertas activas.
- [x] Capas en el mapa: estaciones coloreadas por ICA y niveles de quebradas.
- [x] Serie de PM2.5 de los últimos 30 días.
- [x] Capas satelitales: luces nocturnas VIIRS (NASA GIBS) y Sentinel-2 (solo uso no comercial).
- [x] Sismos cercanos con magnitud 4 o más, desde el USGS.
- [x] Mapa de ruido del AMVA.

**Datos:** [Ambiente y satélite](fuentes-medellin.md#ambiente-y-satélite). **No usar** `EntregaData1`, que está congelado desde 2024.

**Terminada cuando:** las cifras muestran la hora de la última lectura y el proxy responde aunque el SIATA falle, usando la última copia en caché.

**Resultado (26 sep 2026)**
- Proxy `/api/ambiente/<recurso>` (`src/app/api/ambiente`): 7 recursos del SIATA y del USGS, más tres series por estación (`pm25-serie`, `lluvia-dia`, `lluvia-mes`). Cachea 10 minutos (30 el USGS) en memoria y en `.cache/ambiente/`, y **cada respuesta trae la hora de la lectura**. Probado: con el servicio caído y una copia guardada responde 200 con `obsoleto: true` y la copia; sin copia previa, 502 con el motivo.
- Nueva sección `Ambiente` (`src/components/AmbienteView.jsx` y `src/components/ambiente/`): barra de estado con la hora de lectura y botón de actualizar, tarjetas en vivo, series de PM2.5 y de lluvia por estación, mapa de estaciones, ruido y sismos. Se refresca sola cada 10 minutos.
- Nuevo tema del lago `ambiente` (`ingesta/pull_ambiente.py`): 10 cifras, la serie anual de sismos y 10 fuentes. **Las lecturas del SIATA no se congelan en el lago**: el lago guarda lo estable (tamaño de cada red, sismos, mapa de ruido) y lo que cambia cada minuto se lee del proxy con su hora.
- Decisiones de alcance, todas visibles en pantalla:
  - **"Lluvia acumulada":** la capa en vivo de pluviómetros solo publica el acumulado de los últimos 15 minutos. La tarjeta de ciudad muestra ese máximo entre los 103 pluviómetros de Medellín, y el acumulado real de 24 horas y de 30 días se pide por estación a `pluvio_24h` y `pluvio_30d`, dos endpoints que no estaban en la investigación y aparecieron en el esquema de la API.
  - **"Estación con peor aire":** se rotula como el ICA más alto y se acompaña de la categoría oficial del índice (Resolución 2254 de 2017) con los colores del propio SIATA. Es la definición del indicador, no una lectura de la app.
  - **Niveles de quebradas:** la capa no publica la unidad y el valor puede ser negativo (es la lectura del sensor frente a su punto de referencia). Se muestra crudo en el mapa, sin ranking ni comparación entre estaciones, y la ficha lo explica.
  - **Capas satelitales:** viven en el mapa de Ambiente y no en el gemelo 3D. VIIRS solo tiene teselas hasta el nivel 8 (~2 km por píxel), así que se lee a escala del valle; y el mosaico Sentinel-2 de 2023 no agrega nada sobre la ortofoto 2024 del gemelo. Sentinel-2 queda rotulado con su licencia CC BY-NC-SA.
  - **Mapa de ruido del AMVA:** se empaquetan las dos capas de ruido total (día y noche), unidas por banda de dB(A), recortadas al Distrito y generalizadas a ~67 m: 735 KB cada una en vez de más de 12 MB. Las capas por fuente (automotor, metro, aeropuerto, industria) quedan en el servicio, sin empaquetar.
- Correcciones que salieron al probar los endpoints:
  - La ruta de series documentada (`geographJson/1/pm25_30d/`) responde 404: la buena es `geodata/geographJson/{equipo}/{variable}/{código}`. Corregido en [fuentes-medellin.md](fuentes-medellin.md#ambiente-y-satélite).
  - `alerts/` devuelve avisos de prueba con texto *lorem ipsum*; las alertas reales están en `alerts/active/citizen`.
  - `verificar.py --red` daba por caídas todas las fuentes del SIATA: su API responde 405 a `HEAD`. `lago.existe()` ahora reintenta con un `GET` del primer byte.
  - `LineChart` hundía hasta cero los puntos sin dato; ahora corta la línea y deja el hueco, que es lo que hace falta con series en vivo (días sin medición).
- **`metro-red` (resuelto el 1 oct 2026):** el servicio de ArcGIS del Metro responde 403 a quien lo abre directo y solo atiende su ruta `/query`. La fuente enlaza ahora al portal de datos abiertos del Metro; la ingesta sigue consultando el servicio. Con eso `verificar.py --red` pasa completo.
- **Pendiente de revisar a mano:** la fluidez del mapa con las isófonas de ruido encendidas (la sección ya se revisó en un celular real). Chrome sin GPU dibuja las estaciones y la leyenda, pero no alcanza a pintar el mapa base vectorial.

## 5. Gente

**Objetivo:** mostrar quién vive en Medellín y cómo vive, por comuna.

**Tareas**
- [x] Población total del DANE ~~2020–2035; 2026 = 2.650.662~~ → PPED 2018–2042; 2026 = 2.526.795 (ver resultado).
- [x] Población por comuna y corregimiento: la proporción del DAP aplicada al total del DANE (estado `derivado`), con nota explicativa.
- [x] Hogares y viviendas por comuna (DAP).
- [x] IMCV y pobreza multidimensional por comuna 2014–2024, e IDH 2014–2021.
- [x] Estratos socioeconómicos.
- [x] Eventos de salud geográficos (natalidad, mortalidad, dengue), después de verificar su vigencia.
- [x] Pirámide poblacional si el archivo del DANE trae edades; si no, dejarla como `candidato`.

**Datos:** [Gente](fuentes-medellin.md#gente) y la [discrepancia 1](fuentes-medellin.md#5-discrepancias-y-lectura-responsable).

**Terminada cuando:** las 21 comunas y corregimientos tienen población, IMCV y pobreza con vigencia visible.

**Resultado (27 sep 2026)**
- **Cambio de total oficial:** el DANE publicó en julio de 2025 la serie PPED 2018–2042, que reemplaza la post-COVID 2020–2035 (su página ya no enlaza el archivo anterior). Para 2026 da **2.526.795** habitantes, no 2.650.662. El lago usa la PPED; al reingestar Seguridad, la tasa de homicidios de 2025 pasa de 12,64 a **13,17** por 100.000 habitantes, y el resto de tasas de la Policía cambia en la misma proporción.
- `pull_demografia.py` ahora ingesta 6 fuentes: DANE por área, DANE por sexo y edad (131 MB, se guarda en `datos/crudos/` y solo se vuelve a bajar si cambia), DAP, ECV (IMCV, pobreza multidimensional, IDH), estratos del catastro y SIVIGILA. El tema pasó de 7 a 22 cifras.
- Dos listas nuevas en el tema, pensadas también para el Atlas (#11): `indicadores` (16, cada uno con fuente, vigencia real y estado) y `territorios` (21, con los valores por año). `verificar.py` valida su contrato.
- Nueva sección `Gente` (`src/components/GenteView.jsx` y `src/components/gente/`): cifras de ciudad, serie 2018–2042, pirámide por grupos de 5 años (2018, 2026 y 2042, con escala común), ranking por territorio con selector de indicador, ficha de cada territorio con el año de cada dato, distribución de estratos y eventos de salud.
- Decisiones de alcance:
  - **Estratos:** la capa `/0` del DAP responde con error de base de datos; se usa la capa equivalente del catastro (`ConsultaOperadorCatastral_geo/MapServer/23`, 32.384 manzanas). La unidad es la manzana, no la vivienda, y así se dice en pantalla.
  - **Salud:** el servicio se rotula "vigente", pero los datos llegan a 2022. Las tasas son las que publica la Secretaría de Salud (por 100.000 habitantes, con población del DAP).
  - **Pirámide:** el archivo PPED trae edades simples, así que no quedó como `candidato`. Edad mediana, población de 60+ y menor de 15 son `derivado`.
- Correcciones que salieron al probar:
  - Hogares y viviendas del DAP traían 25 filas (4 corregimientos partidos en urbano y rural); ahora se suman a 21.
  - El servidor de la Alcaldía responde a veces `200` con un error de base de datos. `lago.consulta_arcgis` reintenta antes de dar la capa por caída; beneficia a todos los temas.
- Revisada en un celular real el 27 sep 2026.

---

## 6. Economía y vivienda

**Tareas**
- [x] Mercado laboral de Medellín A.M. desde la GEIH: desocupación, ocupación y participación, en serie trimestral 2007–2026. Último dato: 6,97 %.
- [x] Precio por m² de venta y de arriendo por comuna y estrato, derivado de la OIME ~~2023~~ → 2024–2025 (ver resultado).
- [x] Valor del suelo por zona (IDEM).
- [x] Licencias urbanísticas por comuna y tipo.
- [x] Establecimientos comerciales y estructura empresarial por comuna.
- [x] Rentabilidad bruta (arriendo × 12 / precio) por comuna, estado `derivado`.

**Datos:** [Economía y vivienda](fuentes-medellin.md#economía-y-vivienda).

**Terminada cuando:** la serie laboral se actualiza sola con el anexo mensual del DANE y los precios muestran su vigencia (2023).

**Resultado (27 sep 2026)**
- `pull_economia.py` pasa de 1 a 6 fuentes: GEIH, OIME, valor catastral del suelo (IDEM), licencias de las curadurías, Industria y Comercio y Cámara de Comercio. El tema tiene 13 cifras, 8 series y las listas `indicadores` (8) y `territorios` (21), con el mismo contrato que Gente.
- Nueva sección `Economía y vivienda` (`src/components/EconomiaView.jsx`): mercado laboral con selector de tasa, precios de vivienda (serie 2008–2025 y tabla por estrato), ranking y ficha por territorio, valor del suelo, licencias y empresas. Nueva capa **Valor del suelo** en el panel Explorar del gemelo (1,1 MB).
- La serie laboral ya se actualizaba sola (busca el anexo GEIH más reciente hacia atrás); se conserva.
- Decisiones de alcance:
  - **Precios de vivienda:** en vez de los anuncios de internet de 2023 (capa 1 de la OIME), se usa la capa 0, *investigaciones del Catastro*, que cubre 2008–2026 con unos 10.000 registros por año. Mediana del precio de oferta por m² de apartamentos y casas, sin atípicos, con áreas de 20 a 500 m². Para que haya muestra por comuna se juntan los dos últimos años completos (hoy 2024–2025) y se exige un mínimo de 20 ofertas; Popular, Santa Cruz y Palmitas no llegan y se muestran como "sin dato". Pesos corrientes, sin ajustar por inflación.
  - **Rentabilidad bruta:** cociente de medianas del mismo periodo (arriendo mensual × 12 ÷ venta); así se explica en pantalla.
  - **Licencias:** el archivo de curadurías llega a 2020. Se muestra como histórico: serie 2003–2020 y, por comuna, las licencias de 2016–2020.
  - **Empresas:** el registro de Industria y Comercio (443.241 contratos activos, incluidos 63.897 sin local) y la Cámara de Comercio (110.843 empresas en 2022) se muestran por separado, con un aviso de que no se suman ni se comparan.
  - **Fuentes sin año publicado** (valor del suelo e Industria y Comercio) se guardan con la clave `vigente`, no con el año de la consulta.
- Correcciones que salieron al probar:
  - Las etiquetas del anexo GEIH venían sucias ("nov 19–ene 20 2019", "ene–mar* 2020", "ago- oct"); ahora son uniformes ("nov 2019–ene 2020").
  - La subocupación tenía siete trimestres de 2020 en 0. Según la nota del propio anexo, el DANE no pudo medirla entre marzo y julio de 2020: ahora son hueco (`null`) y la gráfica lo explica. `verificar.py` acepta `null` en las series.
  - **`LineChart`** (compartido con Gente, Seguridad y Ambiente) tenía tres fallos: el eje terminaba por debajo del máximo y la línea se salía por arriba, el texto se escalaba con la tarjeta (enorme a ancho completo, diminuto en media tarjeta) y los rótulos del eje X se encimaban. Ahora mide su ancho real y dibuja en píxeles, el eje siempre cubre los datos y reparte solo las etiquetas que caben. Las tasas laborales ya no arrancan en 0: participación, entre 58 y 68 %, se veía plana.
  - Los rankings de barras cortaban las últimas filas (tope de 460 px); se quitó el tope.
  - La capa de licencias no admite paginación y el servidor falla al azar: `lago.arcgis_por_ids` descarga por rangos de `objectid` y parte en mitades los lotes que fallan.
  - La capa del valor del suelo pesaba 4 MB (cada zona viene partida en manzanas); se cierran los huecos de calle y se simplifica a ~17 m.
- Refactor: la clase `Territorios` pasó de `pull_demografia.py` a `lago.py` (la usan Gente y Economía), con un método para reconocer comunas escritas con nombre y tildes mal codificadas. El ranking y la ficha por territorio pasaron a `src/components/territorios/PanelTerritorios.jsx`, que usan Gente y Economía y usará el Atlas (#11).
- Revisada en un celular real el 27 sep 2026.

---

## 7. Turismo

**Tareas**
- [x] Extranjeros no residentes por año y mes, 2015–2026 (MinCIT), con los países de origen principales.
- [x] Pasajeros del aeropuerto José María Córdova, 2020–2026 (Aerocivil).
- [x] Ocupación hotelera, museos y sitios de interés hasta octubre de 2023, rotulados como históricos.
- [x] Mapa de los 92 atractivos turísticos y los puntos de información turística.
- [x] Hoteles y hospedajes desde OSM, estado `observado`, con la fecha de consulta.

**Datos:** [Turismo](fuentes-medellin.md#turismo).

**Resultado (27 sep 2026)**
- `pull_turismo.py` pasa de 2 a 7 fuentes. El tema tiene 16 cifras, 7 series (extranjeros y pasajeros por mes y por año, ocupación hotelera mensual, museos y sitios por año) y las listas `indicadores` y `territorios` (atractivos y hospedajes por comuna), con el contrato de Gente y Economía.
- Nueva sección `Turismo` (`src/components/TurismoView.jsx`): visitantes extranjeros (por mes o por año, y países de residencia), aeropuerto (nacional e internacional), atractivos y hospedajes, ranking por territorio y el histórico de ocupación, museos y sitios, en un bloque aparte con aviso.
- La capa Turismo del gemelo muestra ahora atractivos (los imperdibles más grandes), puntos de información y hospedajes de OSM, cada uno con su ficha y su fuente.
- Decisiones de alcance:
  - **Vigencias del histórico**, calculadas del dato: ocupación de la ciudad hasta octubre de 2023; por zona, hasta marzo de 2023; museos y sitios, hasta febrero de 2023. Los rankings usan 2022, último año completo, con 2019 al pasar el cursor.
  - **Hospedajes de OSM:** 381 dentro de Medellín (la consulta usa una caja y se filtra con el límite del Distrito). La vigencia es la fecha de la copia de OSM del servidor que respondió (hoy, 1 de junio de 2026), no la de la consulta. Se explica que no es el Registro Nacional de Turismo.
  - **Pasajeros:** se aclara en pantalla que cuentan cada viaje de ida o de vuelta y que no es turismo.
- Correcciones que salieron al probar:
  - Las fichas de MEData en datos.gov.co no se consultan por API; se descarga el CSV enlazado.
  - Museos y sitios traían ceros antes de que el lugar existiera y un valor negativo; se descartan.
  - Overpass rechazaba la consulta con 504 por pedir un timeout largo; con 25 s responde.
  - `LineChart`: el último rótulo del eje X se pegaba al anterior porque se alinea a la derecha; ahora se calcula el tramo real de cada rótulo. En el panel por territorio, "Vigencia Actualizado el…" pasó a "Vigencia: actualizado el…".
- La capa de atractivos pasó de `pull_lentes.py` a `pull_turismo.py` (al reingestar lentes, su cifra de atractivos desaparece de ese tema).
- Revisada en un celular real el 27 sep 2026.

---

## 8. Municipio

**Tareas**
- [x] Presupuesto: ingresos y gastos de inversión ~~(MEData), después de confirmar a qué vigencia corresponden~~ → CUIPO (ver resultado).
- [x] Inversión pública por comuna, 2008–2024, en serie y en mapa.
- [x] Contratación en SECOP II: número y valor por año y principales objetos.
- [x] Actividad del Concejo: acuerdos y proyectos.
- [x] ~~Recaudo~~ Facturación del impuesto predial por comuna, ~~hasta 2023~~ 2019–2020 (ver resultado).

**Datos:** [Municipio](fuentes-medellin.md#municipio).

**Resultado (27 sep 2026)**
- Nuevo tema `municipio` con `ingesta/pull_municipio.py` y 7 fuentes: CUIPO (ingresos y gastos, Contraloría), inversión por comuna (Planeación), SECOP II, acuerdos y proyectos del Concejo, y el predial por comuna de cobro (MEData). 19 cifras, 5 series y las listas `indicadores` y `territorios` (inversión, participación en la inversión y predial facturado), con el contrato de Gente, Economía y Turismo. La cifra ancla del Panorama es el presupuesto inicial de gastos del año en curso (2026: 11,84 billones).
- Nueva sección `Municipio` (`src/components/MunicipioView.jsx`): presupuesto (año en curso y último año completo, tabla 2023–2026, ingresos por tipo e inversión por sector), inversión por comuna (serie 2008–2024 y mapa por año, en monto o participación), ranking y ficha por territorio, el predial histórico, contratación (serie, valor por tipo y los 10 contratos de mayor valor con enlace a SECOP) y el Concejo (proyectos y acuerdos por año, acuerdos por tema del periodo en curso y los últimos sancionados).
- Nuevo mapa coroplético de los 21 territorios, `src/components/territorios/MapaTerritorios.jsx`, que recibe los valores por código: lo podrá usar el Atlas (#11).
- Decisiones de alcance:
  - **Presupuesto:** los archivos de MEData no traen el año y no se pudo confirmar su vigencia: dos partidas del SGP coinciden con el decreto de 2019, pero el total no coincide con el de ningún año y el recaudo indica un corte de primer trimestre. Se usa CUIPO, que publica lo mismo con año y trimestre (2023 a junio de 2026) y cuadra con lo aprobado por el Concejo en 2025. Detalle en [fuentes-medellin.md](fuentes-medellin.md#municipio).
  - **Predial por comuna:** el archivo abierto solo llega a 2020 (no a 2023), es facturación y no recaudo, y agrupa por la dirección a la que se envía el cobro. Se muestra como histórico, con esas tres advertencias; San Cristóbal y Palmitas, que se facturan juntos, quedan sin dato. El recaudo actual de la ciudad sale de CUIPO.
  - **SECOP II:** solo la administración central (el Concejo y la Personería comparten NIT y se excluyen, igual que las entidades descentralizadas). Sin contratos cancelados ni borradores, y sin el único valor imposible (7,7 × 10²⁰ pesos). La serie empieza en 2018.
  - **Inversión por comuna:** pesos corrientes; se agrega la participación de cada territorio en el total del año (`derivado`), que sí se puede comparar entre años. No se calcula por habitante: la población por comuna del lago es solo la de 2026.
- Correcciones que salieron al probar:
  - La tabla de programación de ingresos de CUIPO en datos.gov.co tiene las columnas corridas (la cuenta llega en `ambito_codigo`); el script acepta los dos órdenes.
  - En el predial, los códigos 50–90 de "comuna de cobro" son otros municipios (50 es Casanare), no los corregimientos: se mapean solo 1–16, 17, 19 y 20.
  - El mapa se dibujaba con un ancho equivocado en móvil (MapLibre mide el contenedor antes de que la grilla termine de maquetarse): ahora se reajusta con un `ResizeObserver`. La atribución desplegada tapaba la leyenda: se pliega al cargar.
- Revisada en un celular real el 27 sep 2026 (además de la prueba a 390 px). Para abrir el servidor de desarrollo desde el celular, `next.config.mjs` agrega la IP del computador a `allowedDevOrigins`.

---

## 9. Servicios públicos

**Objetivo:** cobertura y tarifas de acueducto, alcantarillado, energía, gas y aseo por comuna. Cerebro Lima no tiene una sección equivalente; se agrega porque MEData y EPM sí publican este cruce para Medellín.

**Tareas**
- [x] Cobertura y suscriptores de acueducto, alcantarillado y aseo por comuna y estrato, hasta 2019.
- [x] Suscriptores de acueducto por gran prestador y por pequeños prestadores, después de confirmar su vigencia real (agosto y septiembre de 2023).
- [x] Tarifas de energía y de gas de EPM ~~(mismos datasets que ya usa la issue #6, reutilizados aquí, no reingestados)~~ → la issue #6 no los ingestó; se ingestan aquí, y la energía sale de la publicación mensual de EPM (ver resultado).
- [x] Subsidios y contribuciones de servicios públicos domiciliarios.
- [x] Estaciones de clasificación y aprovechamiento (ECAS) y organizaciones recicladoras.
- [x] Dejar la cobertura de internet fijo como `candidato`: no se encontró un dataset abierto por comuna.

**Datos:** [Servicios públicos](fuentes-medellin.md#servicios-públicos).

**Terminada cuando:** cada servicio muestra su cobertura o su tarifa más reciente por comuna, con su vigencia, y la cobertura de internet aparece marcada como `candidato` en vez de omitirse en silencio.

**Resultado (27 sep 2026)**
- Nuevo tema `servicios` con `ingesta/pull_servicios.py` y 13 fuentes: cobertura, suscriptores (EPM, pequeños prestadores y Emvarias) y subsidios (EPM y Emvarias) de MEData; tarifas de EPM de acueducto y alcantarillado, gas y energía; ECA de la Superservicios; organizaciones recicladoras (MEData); internet fijo del MinTIC, y la cobertura de internet por comuna como `candidato`. 29 cifras, 12 series y las listas `indicadores` y `territorios` (cobertura de los tres servicios, suscriptores de acueducto y suscriptores de pequeños prestadores). La cifra ancla del Panorama son los accesos a internet fijo (866.296 en el primer trimestre de 2026).
- Nueva sección `Servicios públicos` (`src/components/ServiciosView.jsx`), con su entrada en el menú (no existía): tarifas vigentes por estrato (tabla de los cuatro servicios y series de estrato 1 frente a estrato 4), cobertura por territorio (mapa por servicio y tabla por estrato), ranking y ficha por territorio, suscriptores y subsidios (histórico), reciclaje y aprovechamiento, e internet fijo.
- Una cifra `candidato` se muestra como "Sin dato abierto" en su tarjeta (`src/lib/lago.js`).
- Decisiones de alcance:
  - **Tarifas de energía:** `ytme-6qnu` no sirve (trae los mercados de Bogotá, Cali, Tolima y Valle, no Antioquia) y los datos abiertos de EPM para Antioquia terminan en 2021. Se lee la tarifa vigente de la publicación mensual en PDF que enlaza la página de EPM (estado `declarado`), con la serie de los meses del año en curso.
  - **Tarifas de agua:** las de Aguas Nacionales EPM son de Quibdó. Se usan las de EPM para Medellín (`nfrm-mmfe`, hasta agosto de 2026).
  - **ECA:** el archivo de MEData no tiene fecha y perdió las tildes en el origen; se usa el registro de la Superservicios (75 ECA en operación, certificado hasta julio de 2024). Las organizaciones recicladoras siguen saliendo de MEData.
  - **Internet fijo:** el MinTIC sí publica accesos por municipio y estrato (hasta el primer trimestre de 2026): se muestra el dato de la ciudad como `observado` y el de las comunas como `candidato`.
  - **Cobertura por territorio:** se reconstruye sumando suscriptores y viviendas de los estratos (`derivado`). La tabla por estrato muestra los valores por encima de 100 % tal como vienen, con su explicación.
- Correcciones que salieron al probar: un número con punto de miles en la cobertura ("6.544") y consumos de EPM con coma decimal; en gas solo los estratos 1 y 2 tienen subsidio (el texto decía 1 a 3).
- Probada a 1400 y a 390 px, sin desbordamiento horizontal: las tablas anchas se desplazan dentro de su tarjeta.

---

## 10. Territorio y cultura

**Tareas**
- [x] Amenazas del POT: movimientos en masa, inundaciones, avenidas torrenciales y zonas de alto riesgo no mitigable. Indicador: hectáreas y construcciones expuestas por comuna.
- [x] Usos del suelo, tratamientos y altura normativa.
- [x] Patrimonio: 397 bienes de interés cultural.
- [x] Equipamientos: 32 bibliotecas, 779 sedes educativas y 2.139 equipamientos del POT.
- [x] Espacio verde urbano en m² por habitante y por comuna (estado `derivado`).
- [x] Confirmar el estado normativo de la capa "POT 2025" frente al Acuerdo 48 de 2014.

**Datos:** [Territorio, POT y cultura](fuentes-medellin.md#territorio-pot-y-cultura).

**Resultado (30 sep 2026)**
- Nuevo tema `territorio` con `ingesta/pull_territorio.py` y 10 fuentes: amenazas y zonas de riesgo (Alcaldía, capas del POT), usos generales del suelo, tratamientos y altura normativa, la capa "POT 2025", bienes de interés cultural, Red de Bibliotecas, sedes educativas, equipamientos del POT (IDEM), espacio verde urbano (AMVA y Universidad Nacional) y espacio público efectivo. 25 cifras y 21 indicadores por territorio. Cifras ancla del Panorama: construcciones en amenaza alta (41.219), bienes de interés cultural (397) y espacio verde urbano por habitante (14,8 m²).
- Nueva sección `Territorio y cultura` (`src/components/TerritorioView.jsx`): amenazas y riesgo (mapa por territorio, hectáreas por amenaza y grado y las 305 zonas de alto riesgo no mitigable), usos del suelo, tratamientos y altura normativa (con el porcentaje de construcciones por encima de la norma que ya calcula la lente de densificación), patrimonio (mapa y listado con buscador), equipamientos, espacio verde y espacio público, y el ranking y la ficha por territorio.
- Nueva capa "Cultura y educación" en el panel Explorar del gemelo: bienes de interés cultural, bibliotecas y sedes educativas (oficiales y no oficiales).
- Decisiones de alcance:
  - **"POT 2025":** la descripción del servicio `VM_34_POT_2025` dice que es un mapa provisional con las capas del Acuerdo 48 de 2014 que no se actualizan en la revisión de mediano plazo de 2025, y que se reestructurará cuando esa revisión se adopte. El POT vigente sigue siendo el Acuerdo 48 de 2014 (cifra `declarado`). La ingesta falla, y conserva el dato anterior, si esa descripción cambia.
  - **Amenazas:** la capa de inundaciones de `VM_06_Amenazas_Inundaciones` ya no se publica (el servicio solo trae la de avenidas torrenciales). Se usa `VC_Gestion_Riesgo`, que reúne las tres amenazas y sus zonas de riesgo, actualizadas al 17 de julio de 2026.
  - **Construcciones expuestas:** son las del catastro (las del gemelo) cuyo punto representativo cae en un polígono de amenaza alta o de alto riesgo no mitigable. Una construcción expuesta a dos amenazas cuenta una vez en el total.
  - **Usos del suelo:** `VM_23_Uso_General_Suelo_Urbano/2` responde 400 cuando se le piden geometrías; se usa la misma capa en `VM_POT48_Tematicos/5`.
  - **Espacio verde:** la capa cubre todo el Valle de Aburrá y sus 195.000 polígonos tardan mucho con geometría. Se leen solo sus atributos (área y coordenadas, en EPSG:3116) y se ubican en los límites de la misma capa base. El inventario es de 2019 y la población, la proyección del DANE para 2026: la nota lo dice. Cubre solo suelo urbano, así que en los corregimientos cuenta solo sus centros poblados (Palmitas da 0).
  - **Espacio público efectivo:** además del espacio verde, se agrega el inventario de 2023 de Planeación (m² por habitante), que es el indicador que usa el POT. Son dos medidas distintas y la sección lo explica.
- Correcciones que salieron al probar: el servidor de la Alcaldía publica una dirección IPv6 que a ratos no responde y `urllib` esperaba el tiempo máximo en cada intento; `lago.py` ahora prueba primero IPv4. Pedirle al servidor que generalice las geometrías (`maxAllowableOffset`) multiplica por veinte el tiempo de cada página, así que se simplifican en la ingesta. Algunas capas dan sus fechas como texto ISO y no en milisegundos. La vigencia en la ficha de procedencia ya no pasa a minúscula una sigla ("pOT").
- Probada a 1400 y a 390 px, sin desbordamiento horizontal: las tablas anchas se desplazan dentro de su tarjeta.

---

## 11. Atlas de comunas y barrios

**Objetivo:** equivale al "Atlas 43 distritos" de Lima. Es un mapa coroplético que compara territorios con cualquier métrica.

**Tareas**
- [x] Nivel comuna (21 unidades) y nivel barrio (271 barrios urbanos) cuando haya dato disponible.
- [x] Selector de métrica: población, IMCV, pobreza, homicidios, precio por m², inversión, verde por habitante, pisos promedio, cobertura de acueducto y aseo, etc.
- [x] Ranking y ficha de cada comuna con su puesto en cada métrica.
- [x] Comparación regional con los 10 municipios del Área Metropolitana (población DANE).

**Datos:** secciones [Gente](fuentes-medellin.md#gente), [Seguridad](fuentes-medellin.md#seguridad), [Economía](fuentes-medellin.md#economía-y-vivienda), [Municipio](fuentes-medellin.md#municipio) y [Servicios públicos](fuentes-medellin.md#servicios-públicos).

**Resultado (1 oct 2026)**
- Nueva sección `Atlas de comunas` (`src/components/AtlasView.jsx`). El Atlas no tiene un tema propio en el lago: junta las métricas por territorio que ya publica cada tema con el contrato de `lago.Territorios` (listas `indicadores` y `territorios`). Cuáles entran y con qué rótulo se elige en `src/lib/atlas.js`; una métrica que no esté en el lago no se muestra.
- **Nivel comuna:** 52 métricas de 8 temas (Gente, Seguridad, Economía y vivienda, Municipio, Servicios públicos, Territorio y cultura, Construcción y redes, Turismo) para las 16 comunas y los 5 corregimientos. Selector por tema y por métrica, mapa coroplético, ranking con el puesto de cada territorio y ficha por territorio: una tarjeta por tema con el año, el valor y el puesto ("3 de 21") de cada métrica, y la evolución de la métrica elegida cuando tiene más de un año.
- **Nivel barrio:** 13 métricas para los 271 barrios y las 78 veredas: los 8 conteos del SISC (2021–2023, histórico) y 5 medidas del catastro (construcciones, área construida, índice de construcción, pisos promedio y construcciones por encima de la altura normativa). Mapa, ranking (los 25 primeros o todos) y ficha del barrio con su puesto.
- **Comparación regional:** población proyectada por el DANE para los 10 municipios del Área Metropolitana (2026: 4.212.261 habitantes; Medellín es el 60,0 %), con cabecera y rural de cada uno.
- Cambios en la ingesta para que todos los temas hablen el mismo contrato:
  - `pull_seguridad.py`: el SISC por comuna pasa también a `indicadores` y `territorios` (casos y casos por 10.000 habitantes de las 8 categorías); `seguridad_barrios.json` trae ahora la fuente, la vigencia y el estado de cada categoría.
  - `pull_lentes.py`: 11 indicadores por territorio (construcciones, pisos promedio, índice de construcción, víctimas viales, redes eléctricas y aforos) con el contrato, sin quitar los campos que lee el gemelo. Genera además `public/data/geo/construcciones_barrios.json`.
  - `pull_demografia.py`: lista `amva`, dos cifras nuevas (población del Área Metropolitana y participación de Medellín) y el indicador de densidad de población (hab./km²) por territorio.
  - Se reingestaron los tres temas; ninguna cifra existente cambió. El lago queda en 199 cifras.
- `MapaTerritorios` acepta `nivel="barrios"` y `BarChart` muestra el puesto y admite etiquetas repetidas (hay barrios homónimos).
- Decisiones de alcance:
  - **Puesto:** ordena de mayor a menor valor y los empates comparten puesto. Es una posición, no una calificación, y así se dice en pantalla.
  - **Tasas del SISC:** son los casos de los tres años de la ventana por 10.000 habitantes (población del DAP), la misma definición de la sección Seguridad. No es una tasa anual; la nota del indicador lo dice.
  - **Barrios sin tasas:** el lago no tiene población por barrio, así que a ese nivel solo hay conteos y medidas físicas. Un barrio que no aparece en un archivo del SISC cuenta como 0 casos; uno sin construcciones queda "sin dato".
  - **Códigos del SISC fuera de los límites:** 9 códigos de barrio del SISC (368 de 141.313 registros de la ventana, el 0,26 %) no existen en los límites del catastro y no se dibujan.
  - **Índices 0–100 de las lentes:** no entran al Atlas. Son posiciones relativas calculadas a partir de las mismas métricas que sí están.
- Correcciones que salieron al probar: la vereda Piedras Blancas Represa viene partida en dos polígonos con el mismo código (hay 79 polígonos y 78 veredas); se unen en la ingesta y cuentan una vez en el ranking. Si una categoría del SISC fallaba, su ranking por comuna se perdía en vez de conservarse de la ingesta anterior; ahora se hereda.
- Pruebas: `tests/atlas.test.mjs` comprueba el cálculo de puestos y que todas las métricas elegidas existan en el lago con sus 21 territorios y su fuente en el catálogo.
- La ficha reparte sus tarjetas en dos columnas de altura parecida; el popup del mapa nombra la métrica y no repite la unidad; si el barrio elegido queda fuera de los 25 primeros, se agrega al ranking con su puesto.
- Probada a 1400 y a 390 px, en los dos niveles, con clics en el mapa, el ranking, la ficha y los selectores, sin desbordamiento horizontal ni errores en consola.

---

## 12. Correlaciones

**Tareas**
- [x] Matriz de correlación entre las métricas del atlas (21 unidades).
- [x] Diagrama de dispersión interactivo al elegir dos métricas, con la comuna resaltada.
- [x] Advertencias visibles: con n = 21, correlación no implica causalidad y las vigencias pueden diferir entre métricas.

**Datos:** derivado de la issue #11.

**Resultado (2 oct 2026)**
- Nueva sección `Correlaciones` (`src/components/CorrelacionesView.jsx`). No tiene tema en el lago ni toca la ingesta: toma las 52 métricas del nivel comuna del Atlas (`construirAtlas`) y calcula cada coeficiente en el navegador; por eso todo va rotulado `derivado`. El cálculo está en `src/lib/correlaciones.js` (módulo puro) y la sección solo muestra el coeficiente, el n y el periodo de cada métrica, sin calificarlo.
- **Advertencias:** tres tarjetas antes de la matriz: son 21 territorios (16 comunas y 5 corregimientos, contados del lago) y un solo territorio puede cambiar el coeficiente; correlación no implica causalidad (y las cifras son por territorio, no describen hogares ni personas); las vigencias difieren (las de la matriz van de 2019 a 2026).
- **Matriz:** 24 métricas, 276 pares. Cada celda trae el coeficiente escrito y un color (cian si es negativo, naranja si es positivo, más intenso cuanto mayor la magnitud); al pasar por ella, la franja de arriba dice el par, el periodo de cada métrica, ρ y n. Un clic elige el par. "Ver como tabla" lista los 276 pares con sus dos periodos, ρ y n, sin depender del cursor. Las columnas llevan el número de su fila para que quepa.
- **Diagrama de dispersión** (`src/components/charts/ScatterChart.jsx`, nuevo): un punto por territorio, círculo si es comuna y rombo si es corregimiento, todos grises y el elegido en verde con su nombre. Se elige con el selector, con un clic en el punto o en la tabla de al lado, que trae los 21 territorios con sus dos valores. Dos selectores de métrica (elegir en un eje la que ya está en el otro los intercambia) y un conmutador `Valores` / `Orden`: en `Orden` cada territorio va en su rango de menor a mayor, que es lo que compara el coeficiente.
- Decisiones de alcance:
  - **Coeficiente: Spearman, no Pearson.** Compara el orden de los territorios, no sus valores. Con 21 unidades y tasas por residente muy desiguales, un solo territorio domina el de Pearson: entre el IMCV y el hurto a persona, Pearson da 0,53 con los 21 y 0,90 sin La Candelaria (3.102 hurtos por 10.000 habitantes; el siguiente tiene 1.217); Spearman da 0,71 y 0,69. Además es coherente con el Atlas, que ya compara por puesto. Se calcula como el Pearson de los rangos, con rango medio en los empates.
  - **Subconjunto de la matriz (24 de 52):** Gente (densidad, IMCV, pobreza multidimensional, estrato 1, natalidad, mortalidad, dengue), Seguridad (tasas de homicidio, hurto a persona, hurto a residencia, extorsión y lesiones dolosas), Economía (precio de venta por m², valor del suelo), Servicios (cobertura de acueducto), Territorio (área en amenaza alta, espacio público por habitante, equipamientos y sedes educativas por 10.000 habitantes) y Construcción (pisos promedio, índice de construcción, construcciones sobre la altura normativa, víctimas viales por km² y red de media tensión por km²). Con 24 el coeficiente cabe escrito en cada celda a 1400 px; una prueba falla si la matriz pasa de ahí.
  - **Fuera, 28 métricas** (la sección las lista con su motivo en un desplegable bajo la matriz):
    - 17 conteos, montos y participaciones en un total, que crecen con el tamaño del territorio: población, hogares, viviendas, homicidios (casos), licencias, contratos de Industria y Comercio, empresas, inversión pública y su participación, predial facturado, suscriptores de acueducto, construcciones en amenaza alta y en alto riesgo no mitigable, bienes de interés cultural, construcciones, atractivos y hospedajes. Por eso Municipio y Turismo no tienen ninguna métrica en la matriz.
    - 2 que no se miden igual en todos los territorios: el volumen en hora pico (promedio de las intersecciones aforadas, 16 territorios) y el verde por habitante (el inventario cubre solo suelo urbano; ver issue 10).
    - 1 compuesta: la rentabilidad bruta es arriendo ÷ venta.
    - 1 por empates: el estrato 6 vale 0 % en 13 de los 21 territorios. Esta regla no es una lista: se calcula (más de la mitad de los territorios con el mismo valor).
    - 7 que tienen otra métrica de su misma familia en la matriz: IDH (queda el IMCV, de la misma encuesta y más reciente), hurto de carro, de moto y a comercio (queda hurto a persona), arriendo por m² (queda venta) y cobertura de alcantarillado y de aseo (queda acueducto). Su coeficiente con la que queda va de 0,68 a 0,97. **No se descartan:** se pueden elegir en el diagrama de dispersión, que ofrece 31 métricas.
  - **Métricas sin dato en los 21:** cada par se calcula con los territorios que tienen dato en las dos métricas y dice con cuántos. En la matriz son 45 pares con menos de 21 (el precio de venta por m² tiene 18 territorios y las construcciones sobre la altura normativa, 20): llevan una esquina marcada, y el n aparece en la franja de lectura y en la tabla. El par elegido muestra "n = 18 de 21", qué territorios faltan en cada métrica, y la tabla los atenúa. Con menos de 3 territorios en común, o si una métrica no varía, no hay coeficiente y se muestra "—".
  - **Periodo de cada métrica:** el último con dato de cada una (el mismo `anio` del Atlas: "2024", "2021–2023", "vigente"). Va en la franja de lectura, en la tabla de pares, en el resumen del par, en los ejes y en las fichas de procedencia, que traen la fuente, la vigencia, el estado y la nota de cada una de las dos métricas.
  - **Sin intervalos ni valores p:** los 21 territorios son toda la ciudad, no una muestra, y la issue pide coeficiente, n y años.
  - **Par inicial:** las dos primeras métricas de la matriz (densidad e IMCV), sin elegir un par "interesante".
- `LineChart` exporta su escala de ejes para el diagrama; `tokens.js` suma la rampa divergente. `CorrelationMatrix` queda en `charts/` como componente aparte.
- `scripts/qa.mjs`: la sección entra a la lista por defecto; revisa las tres rejillas nuevas (advertencias, resumen y fichas del par), y ya no cuenta como "salido" lo que está dentro de un contenedor con desplazamiento propio (la matriz en el celular).
- Correcciones que salieron al probar:
  - Los pisos promedio se habían dejado fuera como repetidos del índice de construcción, pero su coeficiente con él es 0,53: no ordenan igual a los territorios. Entraron a la matriz y salió la cobertura de alcantarillado (0,91 con la de acueducto).
  - En el celular, al desplazar la matriz, el nombre fijo de la fila desaparecía pasado el ancho de la tarjeta, y los números de columna asomaban sobre la columna fija.
  - Los ejes del diagrama mostraban los decimales del indicador en marcas redondas ("4.000,00"); la tabla del par repetía la unidad en cada fila (ahora va en el encabezado); el número oscuro no se leía sobre el naranja a media intensidad.
- Pruebas: `tests/correlaciones.test.mjs` (12): rangos con empates, Spearman contra valores calculados a mano, que un valor extremo no lo cambie y sí al de Pearson, pares con territorios sin dato y, contra el lago real, que cada métrica del Atlas esté en la matriz o fuera con un motivo, que ninguna regla nombre una métrica que ya no existe y que los 276 pares tengan coeficiente, n y periodo.
- Probada a 1400 y a 390 px con clics reales (pasar por una celda y elegirla, par con territorios sin dato, selectores, punto del diagrama, fila de la tabla, selector de territorio, `Valores`/`Orden`, matriz como tabla, desplegable, enlace a la fuente), sin desbordamiento horizontal ni errores en consola. `npm run qa` sale sin hallazgos en las 13 secciones y en los dos anchos, una vez corregidas las tarjetas con espacio vacío que ya traían otras secciones (ver la revisión general).

---

## 13. Escucha social

**Tareas**
- [x] Visitas mensuales en Wikipedia a los artículos de Medellín, sus comunas y sus lugares emblemáticos, y su tendencia a 12 meses.
- [x] Cobertura de prensa desde GDELT: volumen y temas dominantes de los últimos 90 días, con caché en el servidor.
- [x] Filtro de ruido para titulares irrelevantes.

**Datos:** [Escucha social](fuentes-medellin.md#escucha-social).

**Resultado (2 oct 2026)**
- Nueva sección `Escucha social` (`src/components/EscuchaView.jsx`) y nuevo tema `escucha` del lago (`ingesta/pull_escucha.py`, 14 cifras, 7 series). Mide dos cosas y lo dice: cuánto se busca Medellín (Wikipedia) y cuánto se publica sobre ella (GDELT). Ninguna mide opinión ni tono, y la sección no califica ninguna cifra.
- **Wikipedia (Wikimedia Pageviews):**
  - Artículo de Medellín en español (230.067 vistas entre oct 2025 y sep 2026) y en inglés (438.660). Serie mensual desde julio de 2015 y la comparación mes a mes de los últimos 12 meses con los 12 anteriores, en vistas o por millón de vistas del sitio.
  - **Tendencia a 12 meses:** variación de los últimos 12 meses frente a los 12 anteriores, en bruto y por millón de vistas de toda la Wikipedia en español (−28,6 % y −10,2 % para Medellín). La normalización es necesaria: la Wikipedia en español entera tuvo un 20,5 % menos vistas de personas en el mismo periodo, y la sección muestra esa serie.
  - **Comunas y corregimientos:** ranking de los 21 artículos por vistas de 12 meses y la ficha de cada uno con sus dos ventanas, las dos variaciones, las redirecciones sumadas y la gráfica de 12 meses contra 12.
  - **Lugares:** los 15 con más vistas de los 53 artículos de la categoría «Turismo en Medellín» y de sus subcategorías directas (museos, parques, plazas, edificios y estructuras, centros comerciales), con la misma ficha.
- **Prensa (GDELT DOC 2.0):**
  - **Volumen:** 9.674 artículos que nombran a Medellín entre el 5 de julio y el 2 de octubre de 2026 (117 por día), con la serie diaria en artículos o por millón de artículos monitoreados. GDELT no publica 7 días de esa ventana: van como hueco y la nota los nombra.
  - **Filtro de ruido:** GDELT busca en el texto completo, así que casi todo lo que encuentra nombra a Medellín de pasada. Se revisan los titulares de los 250 artículos más relevantes de cada corte de 30 días (739) con cuatro reglas, en orden: el titular no nombra a Medellín (219), otra Medellín (Cebú, Veracruz o Badajoz: 7), la Lotería de Medellín (21) y titulares repetidos entre medios (47). Quedan 445 titulares; la sección muestra la tabla con cada regla y lo que saca.
  - **Temas dominantes:** clasificación por palabras clave del titular en 10 temas que siguen las secciones de la app (movilidad, seguridad, deporte, turismo y cultura, gobierno, ambiente, economía, servicios, educación, salud). Un titular puede tener varios o ninguno (70 sin tema). Va rotulada `derivado` y la lista de titulares, que se filtra por tema, muestra las palabras de cada uno.
  - **Titulares:** los 445, con enlace a la nota, medio, fecha, país e idioma.
- Decisiones de alcance:
  - **Caché en el servidor:** GDELT no se consulta desde el navegador ni desde una ruta en vivo. La ingesta lo lee y el lago es la copia en el servidor; además, cada respuesta buena se guarda en `datos/crudos/gdelt/` con la fecha del día, y una nueva corrida ese día solo pide lo que falta. Una ruta en vivo no sirve: GDELT respondió 429 a la gran mayoría de las consultas de hoy, también a consultas separadas por 7 minutos, y desde un despliegue con IP compartida sería peor. La ingesta reintenta cada consulta con esperas de hasta 5 minutos; volumen y titulares son dos fuentes con su propio bloque, así que una puede conservar la ingesta anterior sin arrastrar a la otra.
  - **Temas por palabras clave y no por los temas GKG de GDELT:** los temas GKG se asignan sobre el texto completo, que casi nunca trata de Medellín, no tienen deporte y exigían una consulta más por tema a una API que rechaza la mayoría. Las palabras clave son una clasificación gruesa, publicada para que se pueda revisar.
  - **Vistas con redirecciones:** quien llega por «Popular (Medellín)» queda registrado con ese título, no con el de «Comuna 1 Popular». Sumarlas cambia del 1 al 12 % según el artículo.
  - **Lugares por categoría y no por una lista propia:** "emblemático" sería una elección de la app. Se usa una categoría que mantienen los editores de Wikipedia; quedan fuera «Festivales y ferias», que son eventos. El Metro y el Metrocable no están en esa categoría.
  - **Medellín en inglés** solo para el artículo de la ciudad: las comunas casi no tienen artículo en inglés.
  - **El orden por relevancia de GDELT** (`hybridrel`) deja un 60 % de titulares que nombran a Medellín, frente a un 17 % del orden por fecha. El operador `repeat3:` (la palabra tres veces) dejaba cerca de un artículo por día y se descartó.
- Correcciones que salieron al probar: GDELT separa la puntuación con espacios ("30 . 000", "Medellín : imágenes") y se limpia; las palabras clave daban falsos positivos ("Buenos Aires" como ambiente, "Policía Nacional" como deporte, "vs." en una nota judicial) y ahora admiten palabra completa; los encabezados de sección no dejaban espacio entre un título largo y su vigencia en el celular (regla general en `globals.css`).
- Pruebas: `tests/test_escucha.py` (12): ventanas de 12 y 24 meses, variación, limpieza de titulares, las cuatro reglas de ruido en orden, que el filtro conserve el primer titular que vio GDELT, temas por comienzo y por palabra completa, y los 21 artículos de territorio. `tests/lago-frontend.test.mjs` revisa también las cifras que pide la nueva vista.
- Probada con `npm run qa` a 1400 y a 390 px con clics en todos sus controles (idioma, medida y periodo de la gráfica de Medellín, rankings y selectores de territorio y de lugar, medida del volumen, filtro de titulares por tema, vistas como tabla), sin hallazgos.

---

## 14. Panorama y diagnóstico territorial

**Objetivo:** la portada. Equivale al "¿Qué ocurre en esta parte de Miraflores?" de Lima.

**Tareas**
- [x] Cifras ancla de cada tema, tomadas del lago.
- [x] **Diagnóstico de las 21 comunas y corregimientos:** combina energía, densificación y presión vial, y agrega riesgo y condiciones de vida.
- [x] Selector de prioridad: Equilibrio, Infraestructura, Densificación o Movilidad. La conclusión se recalcula con la prioridad elegida.
- [x] Opción de comparar dos zonas y de buscar un lugar en el mapa.
- [x] Enlace "Ver cifras generales de Medellín".

**Datos:** todas las secciones anteriores.

**Resultado (4 oct 2026)**
- El Panorama sale de `page.jsx` a su propia vista (`src/components/PanoramaView.jsx`), que se carga como las demás secciones. No hay tema nuevo en el lago ni cambios en la ingesta: el diagnóstico se calcula en el navegador (`src/lib/diagnostico.js`) con los índices que ya publica `lentes`, y por eso va rotulado `derivado`.
- **Diagnóstico "¿Qué ocurre en esta parte de Medellín?":**
  - **Índice combinado:** promedio ponderado de los índices 0–100 de energía, densificación y presión vial de las lentes del gemelo. Cada índice ubica al territorio entre el valor mínimo (0) y el máximo (100) de los 21, y sus indicadores los declara el lago (`lentes.metodo_indices`). Con Equilibrio pesan lo mismo y el resultado es el de la lente "Cruce urbano"; con Infraestructura, Densificación o Movilidad, la dimensión elegida pesa 60 % y las otras dos, 20 % cada una. La sección dice que los pesos son una decisión de lectura, no un dato.
  - **Lectura:** el índice de la zona, su puesto de 21, la dimensión con el índice mayor y la de menor, el rango de puestos que ocupa con las cuatro prioridades y, fuera del índice, el riesgo y las condiciones de vida con su puesto. Son frases armadas con las cifras, sin adjetivos.
  - **Riesgo y condiciones de vida, como contexto:** área en amenaza alta y construcciones en amenaza alta (POT), IMCV y pobreza multidimensional (ECV 2024). Se muestran con su valor, su puesto y su distancia a la mediana, pero **no entran al índice**.
  - **Mapa y ranking** de los 21 territorios por índice combinado, con la zona principal resaltada; un clic en el mapa o en una barra la elige.
  - **Evidencia por dimensión:** cinco tarjetas (las tres del índice y las dos de contexto). Cada indicador de origen trae su valor, su distancia a la mediana de los 21 ("42 % sobre la mediana"), su puesto, su vigencia, su estado y el enlace a la fuente. Un territorio sin aforos dice que su índice de presión vial usa solo las víctimas viales.
  - **"Ver … en el gemelo 3D"** abre el gemelo centrado en la zona, con la lente "Cruce urbano" (el mismo formato de "Compartir vista"). "Copiar diagnóstico" copia la lectura con la fecha del lago.
- **Selector de prioridad:** al cambiarla se recalculan el índice, el puesto, la lectura, el mapa y el ranking. Debajo, la tabla "¿Cambia el puesto con la prioridad?" da el índice y el puesto de las dos zonas con cada prioridad (18 de los 21 territorios cambian de puesto; el que más, en 11 puestos). Con Equilibrio e Infraestructura el primero es Castilla; con Densificación y Movilidad, La Candelaria.
- **Comparar dos zonas:** selectores "Zona principal" y "Comparar con" (con botón para intercambiarlas; elegir en uno la zona del otro también las intercambia), barras de los cuatro índices de las dos y la tabla "Indicadores de origen" con los dos valores y la mediana de los 21. El par inicial son los dos primeros territorios por código (Popular y Santa Cruz), sin elegir uno "interesante".
- **Buscar un lugar** (`src/lib/lugares.js`): 3.934 nombres, que son los 21 territorios, 271 barrios, 78 veredas y 3.564 puntos de las capas del gemelo (estaciones del Sistema Metro, atractivos turísticos, bibliotecas, bienes de interés cultural, equipamientos del POT y sedes educativas). Busca sin tildes ni mayúsculas y por varias palabras; cada resultado dice en qué comuna o corregimiento está (un punto se ubica por su polígono). Elegirlo fija esa zona como principal y marca el lugar en el mapa. Los 12 puntos que caen fuera de Medellín (estaciones de Bello, Envigado, Itagüí…) no aparecen. Los archivos (1,9 MB) se descargan la primera vez que se usa el buscador, no al abrir la portada.
- **Cifras ancla:** las 18 cifras que declaran 11 temas del lago, cada tarjeta rotulada con su tema. `lentes` no declara ancla: sus cifras son el diagnóstico. El enlace "Ver cifras generales de Medellín ↓", junto al selector de prioridad, baja hasta ellas.
- Decisiones de alcance:
  - **Sin las frases de Cerebro Lima que califican** ("concentración urbana muy alta", "intensidad relativa baja"): la regla de cero juicios de valor las excluye. La lectura dice puesto, índice y distancia a la mediana.
  - **Riesgo y condiciones de vida fuera del índice:** sumarlos obligaría a decidir si un IMCV mayor suma o resta al índice, y eso sería una valoración. La sección lo explica en "Cómo se calcula".
  - **Energía como infraestructura, no demanda:** Lima usa demanda eléctrica (kW/ha). No hay demanda abierta por comuna en Medellín (issue #2), así que la dimensión es la red de media y alta tensión por km², y la sección lo dice.
  - **Sin los deslizadores de pesos de Lima:** la issue pide el selector de cuatro prioridades; la tabla de sensibilidad responde a la misma pregunta ("¿se sostiene la conclusión?") sin pesos inventados por quien mira.
  - **Empates:** el puesto se calcula con el índice a un decimal, el mismo que se ve; dos índices iguales comparten puesto (con Movilidad, Popular y El Poblado dan 38,3 y los dos quedan en el 9).
- Correcciones que salieron al probar:
  - Las tarjetas de cifras de los temas con acento morado (Gemelo 3D, Escucha social) no tenían punto de color: faltaba `.metric-dot.purple`.
  - Al abrir el gemelo desde el diagnóstico, el botón atrás del navegador dejaba la app en el gemelo con la dirección de la portada. Ahora una dirección sin `#` es el Panorama.
  - El buscador no cargaba los lugares si se enfocaba antes de que llegaran los límites de las comunas; ahora carga todo lo que necesita al enfocarlo o al escribir, y reintenta si falla.
  - En el celular, la tabla de indicadores de origen se salía de su tarjeta por unidades largas ("víctimas/km²·año"): la unidad va una vez bajo el nombre del indicador y, en el celular, la vigencia queda en las tarjetas de evidencia.
- `MapaTerritorios` acepta un `lugar` que marca un punto o un polígono y lo encuadra. `MetricCard` acepta `seccion` para rotular la tarjeta con su tema.
- Pruebas: `tests/diagnostico.test.mjs` (12): pesos de las prioridades, índice ponderado y reparto del peso cuando falta una dimensión, empates a un decimal, mediana y distancia a la mediana, que con Equilibrio el índice sea el "Cruce urbano" del lago en los 21 territorios, que las métricas de contexto existan, que la lectura cambie con la prioridad y no contenga palabras que califiquen, punto en polígono con huecos y la búsqueda contra los límites y capas reales (territorio primero, puntos fuera de Medellín excluidos, cada barrio y vereda una vez).
- `scripts/qa.mjs` revisa también las dos rejillas nuevas (lectura y evidencia). `npm run qa` sale sin hallazgos en las 14 secciones a 1400 y a 390 px. Además se probó con clics reales: las cuatro prioridades, el intercambio de zonas, elegir en "Comparar con" la zona principal, una barra del ranking, una fila de la tabla de sensibilidad, el buscador ("estadio" → la estación Estadio deja Laureles Estadio como zona principal y la marca en el mapa), "Ver … en el gemelo 3D" y el botón atrás.

---

## 15. Fuentes y método

**Tareas**
- [x] Tabla generada desde `catalogo.json`: dataset, entidad, tema, vigencia, estado, uso y URL.
- [x] Filtros por tema y conteo de datasets por estado.
- [x] Explicación del método: ingesta reproducible, verificación antes de cada despliegue y significado de cada estado.
- [x] Mantener el enlace "Ver fuente" desde cada tarjeta, como funciona hoy.

**Datos:** [fuentes-medellin.md](fuentes-medellin.md) completo.

**Resultado (4 oct 2026)**
- La sección `Fuentes` (`src/components/SourcesView.jsx`) pasa de una lista a **Fuentes y método**: primero el método y después el catálogo completo. Los filtros y conteos están en `src/lib/fuentes.js` (módulo puro).
- **Método:**
  - Tres pasos tal como ocurren hoy: la ingesta (un script por tema, sin llaves; si una fuente falla, el tema conserva la ingesta anterior y la corrida termina con error), la verificación (lo que revisa `verificar.py`, que corre al final de cada ingesta y en `npm run check`) y la publicación (el lago son archivos JSON públicos, con enlace a cada uno; el despliegue sirve los del repositorio).
  - Qué significa cada estado, con cuántos datasets, cifras, series e indicadores por territorio hay en cada uno: 87 datasets observados, 4 declarados y 1 candidato; ningún dataset es `derivado`, porque derivado es lo que la app calcula (72 cifras, 3 series y 48 indicadores por territorio).
  - Cómo leer la vigencia y la fecha de prueba.
- **Catálogo:** la tabla de los 92 datasets con número, dataset (nombre e id), entidad, tema, vigencia (con la fecha de prueba), estado, uso en la app y la URL (se muestra el dominio y enlaza a la dirección completa). El uso dice cuántas cifras, series e indicadores por territorio toma la app de esa fuente, contados en el lago, y debajo lo que declara el catálogo. Las 7 fuentes que no aportan datos dicen "Capa del mapa o lectura en vivo" y para qué se usan.
- **Filtros:** estado y tema, cada opción con su conteo, y una búsqueda por texto (nombre, entidad, id, uso o dominio, sin tildes ni mayúsculas). Los tres se combinan, y cada conteo dice cuántas filas quedan al elegir esa opción con los otros filtros puestos. "Quitar filtros" los limpia.
- **"Ver fuente":** sigue funcionando desde cada tarjeta. Abre la sección sin filtros (la vista se monta de nuevo con cada fuente pedida), baja hasta la fila y la resalta.
- **En el celular** cada fila es una ficha con el rótulo de cada campo, sin la lista larga de usos (queda el conteo) ni el número.
- Decisiones de alcance:
  - **"Verificación antes de cada despliegue":** la sección dice lo que pasa de verdad. `verificar.py` corre al final de cada ingesta y en `npm run check`, antes de cada commit. El despliegue (Vercel) sirve los archivos del repositorio y no la corre de nuevo, porque no corre la ingesta.
  - **Método antes que la tabla,** para que los estados estén explicados antes de aparecer en ella.
- Correcciones que salieron al probar:
  - La vigencia de la Encuesta de Calidad de Vida decía "Servicio vigente": `correr.py` tomaba la vigencia de cada fuente solo de sus cifras y series, y esa fuente aporta solo indicadores por territorio. Ahora la toma también de ellos ("2014–2021 · 2014–2024"). El catálogo se regeneró a partir del lago (sin correr la ingesta), y no cambió nada más que esa vigencia y su fecha.
  - Se quitó el CSS de la lista anterior, que ya no usaba nada.
- Pruebas: `tests/fuentes.test.mjs` (5): filtros combinados y sin tildes, conteos, dominio y texto de uso; contra el catálogo real, que cada dataset tenga sus campos, un tema del índice, un estado conocido y una URL válida, que el conteo por estado cuadre, que toda fuente que el lago usa esté en el catálogo y que una fuente sin datos diga para qué se usa. `tests/test_ingesta.py` suma 3 pruebas de la vigencia del catálogo.
- `scripts/qa.mjs` revisa las dos rejillas nuevas del método. `npm run qa` no tiene hallazgos en las 14 secciones a 1400 y a 390 px. Además se probó con clics: el filtro por tema y por estado, los dos combinados con la búsqueda, el estado vacío, "Quitar filtros" y "Ver fuente" desde dos tarjetas de Economía, en escritorio y en el celular.

---

## 16. Experiencia general: buscador, clima y presentación

**Tareas**
- [x] Buscador `⌘K` / `Ctrl+K` que encuentre secciones, cifras y lugares del mapa.
- [x] Reloj y clima actual de Medellín en la cabecera (Open-Meteo).
- [x] Estado del lago en la barra lateral, con temas cargados y fecha de prueba.
- [x] Modo presentación que recorra las secciones a pantalla completa.
- [x] Navegación con `#hash` por sección y botón atrás funcional.
- [x] Revisión de accesibilidad y rendimiento en móvil.
- [x] Cerebro Lima tiene una pantalla de clave de acceso. Decidir si se quiere una; por ahora no se implementa.

**Resultado (6 oct 2026)**
- La cabecera, la barra lateral y la navegación salen de `page.jsx` a `src/components/shell/` (buscador, reloj y clima, estado del lago y presentación). La lógica sin interfaz está en tres módulos puros: `src/lib/ruta.js` (hash ↔ sección), `src/lib/buscador.js` (índice de secciones y cifras) y `src/lib/clima.js` (códigos de la OMM, hora de Medellín).
- **Buscador (`⌘K` / `Ctrl+K`, o el botón "Buscar" de la cabecera):**
  - Busca en tres grupos: las 14 secciones (por su nombre o por palabras de su contenido: "aire" lleva a Ambiente, "presupuesto" a Municipio), las 213 cifras de los 12 temas del lago (por su etiqueta, su tema o su sección; cada resultado trae su valor, su unidad, su vigencia y su estado) y los 3.934 lugares del buscador del Panorama. Sin tildes ni mayúsculas y por varias palabras. Sin texto, lista las secciones.
  - Los lugares se descargan la primera vez que se abre (1,9 MB) y quedan para el buscador del Panorama, y al revés: `cargarLugares()` en `lugares.js` guarda una sola descarga.
  - Al elegir una **sección**, va a ella. Una **cifra** abre su sección, baja hasta su tarjeta y la resalta; 131 de las 213 cifras tienen tarjeta. Las demás titulan una gráfica, están detrás de un selector (los delitos de Seguridad distintos del que está elegido) o son del gemelo: en ese caso la sección se abre arriba y un aviso repite la cifra con su vigencia y su estado. Un **lugar** abre el gemelo 3D: un punto queda marcado con su nombre, un barrio o una vereda enciende la capa de sus límites y una comuna o un corregimiento se encuadra.
  - Es un `<dialog>` nativo (el foco queda adentro y vuelve al cerrarlo) con la lista como `combobox`/`listbox`: ↑ ↓ eligen, Enter abre, Esc o un clic afuera cierran.
- **Reloj y clima:** la hora es la de Medellín aunque quien mira esté en otra zona horaria. El clima es Open-Meteo pedido por el proxy en vivo (`/api/ambiente/clima`, caché de 15 minutos, la frecuencia del modelo), así que todos los visitantes comparten una lectura. En la cabecera van la hora, un símbolo y la temperatura; al tocarla se abre el detalle: tiempo (código de la OMM), sensación térmica, humedad, viento, precipitación de los 15 minutos previos, la hora del valor, la celda del modelo (6,221° N, 75,552° O, 1.486 m), que es un modelo meteorológico y no una estación, su estado, "Ver fuente" y un enlace a las estaciones del SIATA en Ambiente. Si Open-Meteo no responde, se ve la última lectura guardada y lo dice.
  - Open-Meteo entra al catálogo como fuente de Ambiente (`open-meteo`, `observado`, con su uso): ahora son 93 datasets, 88 observados. `pull_ambiente.py` la declara y prueba que responda con temperatura. Para no correr toda la ingesta de Ambiente (que habría cambiado todas sus cifras en vivo) se corrió solo ese bloque, se agregó la fuente a `ambiente.json` y se regeneró el catálogo con `construir_catalogo`; la próxima ingesta completa la produce igual.
- **Estado del lago:** al pie de la barra lateral sigue el resumen (temas cargados de los del índice y el rango de fechas de prueba); al tocarlo se despliega cada tema con la fecha de prueba del archivo que llegó, o "no cargó" en rosa, y un enlace a "93 fuentes · método". Si el lago no carga, dice por qué. En el celular está en el menú.
- **Modo presentación ("▶ Presentar"):** recorre las 14 secciones, 25 segundos cada una, y vuelve a empezar. Pide pantalla completa (donde el navegador no la permite, como Safari en el iPhone, sigue sin ella) y esconde la barra lateral y la cabecera. Abajo queda una barra con anterior, la sección y su número, pausa, siguiente, salir y el avance. Teclas: ← → (y Av Pág / Re Pág, las de un control de diapositivas), P para pausar y Esc para salir; salir de la pantalla completa también sale de la presentación. Se pausa sola si alguien toca la pantalla o se desplaza, para no cambiarle la sección mientras la mira. No llena el historial.
- **Navegación con `#hash`:** cada sección es una entrada del historial (antes se reemplazaba la dirección y el botón atrás salía de la app). Atrás y adelante vuelven a la sección y a la altura donde se dejó, también después de "Ver fuente", que ahora es `#sources?fuente=<id>`. El "Ver … en el gemelo 3D" del Panorama usa la misma navegación, la pestaña lleva el nombre de la sección y una dirección como `/#tourism` abre esa sección.
  - Next.js guarda su propio estado en cada entrada del historial y recarga la página si al volver encuentra un estado que no es suyo: la altura se guarda junto al de Next, nunca en su lugar.
- **Accesibilidad y rendimiento en móvil** (Lighthouse 13, emulación de celular, antes → después):

  | Sección | Rendimiento | Accesibilidad | Bloqueo del hilo principal |
  |---|---|---|---|
  | Panorama | 57 → 79 | 92 → 100 | 1.260 → 160 ms |
  | Gente | 92 → 91 | 91 → 96 | 40 → 40 ms |
  | Municipio | 77 (después) | 100 (después) | 220 ms (después) |

  - **Contraste:** el gris de texto secundario (`--dim`) pasa de `#898a7d` a `#a4a598`: tenía 3,7:1 sobre las tarjetas y ahora pasa de 4,5:1 sobre el fondo y las tarjetas. Las gráficas usan el mismo gris. En la fila elegida de la tabla de sensibilidad el texto chico tampoco llegaba.
  - **Mapas de territorios:** se crean cuando su tarjeta está a menos de 300 px de verse. En el celular casi todos quedan más abajo, y crearlos al abrir la sección era lo que bloqueaba el Panorama. Se probó que los mapas de Panorama, Municipio, Servicios, Territorio (4) y Atlas se crean al bajar y se dibujan.
  - **Teclado y lectores de pantalla:** enlace "Saltar al contenido", la sección activa marcada con `aria-current`, el foco pasa al contenido al cambiar de sección, botones de la cabecera con nombre accesible, botones de la tabla de sensibilidad de 24 px de alto, `prefers-reduced-motion` sin transiciones, y `viewport` con el color del tema y esquema oscuro (controles nativos oscuros).
  - **Lo que queda:** las filas de la pirámide de Gente miden 12 px (Lighthouse pide 24); la misma información está en "Ver como tabla", que es la excepción de control equivalente de WCAG 2.5.8. El LCP sigue en unos 5 s en la emulación de 4G lento: las secciones se arman en el navegador después de leer el índice del lago y luego sus 12 temas y el catálogo (160 KB comprimidos). Bajarlo pide armar la portada en el servidor o partir el lago, y no se hizo en esta issue.
- **Clave de acceso: no se implementa.** Todo lo que muestra la app son datos abiertos, y el lago son archivos públicos (`/data/lago/*.json`): una clave en la interfaz no protegería nada, porque los archivos se pueden abrir sin pasar por ella. Si alguna vez hace falta restringir el acceso, la forma que sí protege es la del despliegue (la protección por contraseña de Vercel o un proxy con autenticación), no una pantalla dentro de la app.
- Correcciones que salieron al probar:
  - En el buscador, Esc solo borraba el texto: un campo de búsqueda usa la primera Esc para eso. Ahora cierra de una vez.
  - En el celular el nombre de la sección quedaba cortado ("Panor…"): la cabecera del celular deja el nombre, el buscador, la hora con la temperatura y la presentación; "Fuentes" sigue en el menú.
- Pruebas: `tests/buscador.test.mjs` (7): leer y escribir la ruta (incluido un `?` dentro de la consulta y un hash desconocido), la fuente pedida y el título; que cada tema del lago tenga sección y cada cifra entre al índice con sus campos; la búsqueda sin tildes, por palabra clave, con varias palabras y su orden; la consulta del gemelo para un punto, un barrio y una comuna; los códigos de la OMM, la hora de Medellín desde UTC y la lectura de una respuesta de Open-Meteo.
- `npm run qa` sale sin hallazgos en las 14 secciones a 1400 y a 390 px. Además se probó con clics y teclas reales, en las dos anchuras: `Ctrl+K`, buscar y elegir con flechas y Enter una cifra con tarjeta (desempleo: baja hasta la tarjeta y la resalta) y una sin tarjeta (homicidios 2025: aviso), un lugar (la estación Estadio: el gemelo la marca), una búsqueda sin resultados y Esc; el detalle del clima y Esc; abrir el estado del lago (en el celular, desde el menú); Gente → Economía, bajar, "Ver fuente", atrás (vuelve a Economía a la misma altura), atrás, atrás y adelante; una dirección directa (`/#tourism`); la presentación con pantalla completa, → ←, P, el avance automático y Esc. También en modo desarrollo, sin avisos de React.
- Visto una vez al probar: el aviso `wood-pattern` de MapLibre puede salir si el gemelo se cierra antes de terminar de cargar su estilo (la presentación pasa por él en un segundo y medio en la prueba). No afecta lo que se ve y no siempre sale.
