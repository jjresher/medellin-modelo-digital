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
| 4 | [Ambiente y satélite](#4-ambiente-y-satélite) | 0 | ☐ |
| 5 | [Gente](#5-gente) | 0 | ☐ |
| 6 | [Economía y vivienda](#6-economía-y-vivienda) | 0 | ☐ |
| 7 | [Turismo](#7-turismo) | 0 | ☐ |
| 8 | [Municipio](#8-municipio) | 0 | ☐ |
| 9 | [Servicios públicos](#9-servicios-públicos) | 0 | ☐ |
| 10 | [Territorio y cultura](#10-territorio-y-cultura) | 0, 1 | ☐ |
| 11 | [Atlas de comunas y barrios](#11-atlas-de-comunas-y-barrios) | 3, 5, 6, 9 | ☐ |
| 12 | [Correlaciones](#12-correlaciones) | 11 | ☐ |
| 13 | [Escucha social](#13-escucha-social) | 0 | ☐ |
| 14 | [Panorama y diagnóstico territorial](#14-panorama-y-diagnóstico-territorial) | 1–12 | ☐ |
| 15 | [Fuentes y método](#15-fuentes-y-método) | 0 | ☐ |
| 16 | [Experiencia general: buscador, clima y presentación](#16-experiencia-general-buscador-clima-y-presentación) | 14 | ☐ |

Panorama va casi al final porque resume las cifras ancla de todas las demás secciones.

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
- **Pendiente de revisar a mano:** la fluidez con varias capas y el relieve activos en un portátil normal, y la interfaz en un móvil real.

---

## 3. Seguridad

**Objetivo:** mostrar la seguridad de la ciudad con series actuales y un mapa histórico por barrio.

**Tareas**
- [x] Series anuales y mensuales 2018–2026 (Policía): homicidio, hurto a personas, hurto de vehículos, extorsión, violencia intrafamiliar, delitos sexuales y lesiones personales.
- [x] Tasas por 100.000 habitantes con la población del DANE (estado `derivado`): homicidios 2024 = 11,81 y 2025 = 12,64.
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
- **Pendiente:** no hay gráfica de "año en curso vs. año anterior" mes a mes con dos líneas (actual sólida, anterior punteada) como se planeó al inicio; los datos que ya se ingestan no traen esa serie pareada. En su lugar, la comparación queda en la cifra de variación % (exacta) y en la gráfica mensual de 24 meses, que muestra el mismo periodo del año anterior en la misma línea.

---

## 4. Ambiente y satélite

**Objetivo:** mostrar datos ambientales en vivo del Valle de Aburrá y capas satelitales.

**Tareas**
- [ ] Ruta de Next.js que funcione como proxy del SIATA con caché de 10 minutos, porque el SIATA no permite CORS. Capas: PM2.5 e ICA, pluviómetros, niveles de quebradas, temperatura y viento, y ruido.
- [ ] Tarjetas en vivo: ICA promedio, estación con peor aire, lluvia acumulada y alertas activas.
- [ ] Capas en el mapa: estaciones coloreadas por ICA y niveles de quebradas.
- [ ] Serie de PM2.5 de los últimos 30 días.
- [ ] Capas satelitales: luces nocturnas VIIRS (NASA GIBS) y Sentinel-2 (solo uso no comercial).
- [ ] Sismos cercanos con magnitud 4 o más, desde el USGS.
- [ ] Mapa de ruido del AMVA.

**Datos:** [Ambiente y satélite](fuentes-medellin.md#ambiente-y-satélite). **No usar** `EntregaData1`, que está congelado desde 2024.

**Terminada cuando:** las cifras muestran la hora de la última lectura y el proxy responde aunque el SIATA falle, usando la última copia en caché.

---

## 5. Gente

**Objetivo:** mostrar quién vive en Medellín y cómo vive, por comuna.

**Tareas**
- [ ] Población total del DANE 2020–2035; 2026 = 2.650.662.
- [ ] Población por comuna y corregimiento: la proporción del DAP aplicada al total del DANE (estado `derivado`), con nota explicativa.
- [ ] Hogares y viviendas por comuna (DAP).
- [ ] IMCV y pobreza multidimensional por comuna 2014–2024, e IDH 2014–2021.
- [ ] Estratos socioeconómicos.
- [ ] Eventos de salud geográficos (natalidad, mortalidad, dengue), después de verificar su vigencia.
- [ ] Pirámide poblacional si el archivo del DANE trae edades; si no, dejarla como `candidato`.

**Datos:** [Gente](fuentes-medellin.md#gente) y la [discrepancia 1](fuentes-medellin.md#5-discrepancias-y-lectura-responsable).

**Terminada cuando:** las 21 comunas y corregimientos tienen población, IMCV y pobreza con vigencia visible.

---

## 6. Economía y vivienda

**Tareas**
- [ ] Mercado laboral de Medellín A.M. desde la GEIH: desocupación, ocupación y participación, en serie trimestral 2007–2026. Último dato: 6,97 %.
- [ ] Precio por m² de venta y de arriendo por comuna y estrato, derivado de la OIME 2023.
- [ ] Valor del suelo por zona (IDEM).
- [ ] Licencias urbanísticas por comuna y tipo.
- [ ] Establecimientos comerciales y estructura empresarial por comuna.
- [ ] Rentabilidad bruta (arriendo × 12 / precio) por comuna, estado `derivado`.

**Datos:** [Economía y vivienda](fuentes-medellin.md#economía-y-vivienda).

**Terminada cuando:** la serie laboral se actualiza sola con el anexo mensual del DANE y los precios muestran su vigencia (2023).

---

## 7. Turismo

**Tareas**
- [ ] Extranjeros no residentes por año y mes, 2015–2026 (MinCIT), con los países de origen principales.
- [ ] Pasajeros del aeropuerto José María Córdova, 2020–2026 (Aerocivil).
- [ ] Ocupación hotelera, museos y sitios de interés hasta octubre de 2023, rotulados como históricos.
- [ ] Mapa de los 92 atractivos turísticos y los puntos de información turística.
- [ ] Hoteles y hospedajes desde OSM, estado `observado`, con la fecha de consulta.

**Datos:** [Turismo](fuentes-medellin.md#turismo).

---

## 8. Municipio

**Tareas**
- [ ] Presupuesto: ingresos y gastos de inversión (MEData), después de confirmar a qué vigencia corresponden.
- [ ] Inversión pública por comuna, 2008–2024, en serie y en mapa.
- [ ] Contratación en SECOP II: número y valor por año y principales objetos.
- [ ] Actividad del Concejo: acuerdos y proyectos.
- [ ] Recaudo del impuesto predial por comuna, hasta 2023.

**Datos:** [Municipio](fuentes-medellin.md#municipio).

---

## 9. Servicios públicos

**Objetivo:** cobertura y tarifas de acueducto, alcantarillado, energía, gas y aseo por comuna. Cerebro Lima no tiene una sección equivalente; se agrega porque MEData y EPM sí publican este cruce para Medellín.

**Tareas**
- [ ] Cobertura y suscriptores de acueducto, alcantarillado y aseo por comuna y estrato, hasta 2019.
- [ ] Suscriptores de acueducto por gran prestador y por pequeños prestadores, después de confirmar su vigencia real.
- [ ] Tarifas de energía y de gas de EPM (mismos datasets que ya usa la issue #6, reutilizados aquí, no reingestados).
- [ ] Subsidios y contribuciones de servicios públicos domiciliarios.
- [ ] Estaciones de clasificación y aprovechamiento (ECAS) y organizaciones recicladoras.
- [ ] Dejar la cobertura de internet fijo como `candidato`: no se encontró un dataset abierto por comuna.

**Datos:** [Servicios públicos](fuentes-medellin.md#servicios-públicos).

**Terminada cuando:** cada servicio muestra su cobertura o su tarifa más reciente por comuna, con su vigencia, y la cobertura de internet aparece marcada como `candidato` en vez de omitirse en silencio.

---

## 10. Territorio y cultura

**Tareas**
- [ ] Amenazas del POT: movimientos en masa, inundaciones, avenidas torrenciales y zonas de alto riesgo no mitigable. Indicador: hectáreas y construcciones expuestas por comuna.
- [ ] Usos del suelo, tratamientos y altura normativa.
- [ ] Patrimonio: 397 bienes de interés cultural.
- [ ] Equipamientos: 32 bibliotecas, 779 sedes educativas y 2.139 equipamientos del POT.
- [ ] Espacio verde urbano en m² por habitante y por comuna (estado `derivado`).
- [ ] Confirmar el estado normativo de la capa "POT 2025" frente al Acuerdo 48 de 2014.

**Datos:** [Territorio, POT y cultura](fuentes-medellin.md#territorio-pot-y-cultura).

---

## 11. Atlas de comunas y barrios

**Objetivo:** equivale al "Atlas 43 distritos" de Lima. Es un mapa coroplético que compara territorios con cualquier métrica.

**Tareas**
- [ ] Nivel comuna (21 unidades) y nivel barrio (271 barrios urbanos) cuando haya dato disponible.
- [ ] Selector de métrica: población, IMCV, pobreza, homicidios, precio por m², inversión, verde por habitante, pisos promedio, cobertura de acueducto y aseo, etc.
- [ ] Ranking y ficha de cada comuna con su puesto en cada métrica.
- [ ] Comparación regional con los 10 municipios del Área Metropolitana (población DANE).

**Datos:** secciones [Gente](fuentes-medellin.md#gente), [Seguridad](fuentes-medellin.md#seguridad), [Economía](fuentes-medellin.md#economía-y-vivienda), [Municipio](fuentes-medellin.md#municipio) y [Servicios públicos](fuentes-medellin.md#servicios-públicos).

---

## 12. Correlaciones

**Tareas**
- [ ] Matriz de correlación entre las métricas del atlas (21 unidades).
- [ ] Diagrama de dispersión interactivo al elegir dos métricas, con la comuna resaltada.
- [ ] Advertencias visibles: con n = 21, correlación no implica causalidad y las vigencias pueden diferir entre métricas.

**Datos:** derivado de la issue #11.

---

## 13. Escucha social

**Tareas**
- [ ] Visitas mensuales en Wikipedia a los artículos de Medellín, sus comunas y sus lugares emblemáticos, y su tendencia a 12 meses.
- [ ] Cobertura de prensa desde GDELT: volumen y temas dominantes de los últimos 90 días, con caché en el servidor.
- [ ] Filtro de ruido para titulares irrelevantes.

**Datos:** [Escucha social](fuentes-medellin.md#escucha-social).

---

## 14. Panorama y diagnóstico territorial

**Objetivo:** la portada. Equivale al "¿Qué ocurre en esta parte de Miraflores?" de Lima.

**Tareas**
- [ ] Cifras ancla de cada tema, tomadas del lago.
- [ ] **Diagnóstico de las 21 comunas y corregimientos:** combina energía, densificación y presión vial, y agrega riesgo y condiciones de vida.
- [ ] Selector de prioridad: Equilibrio, Infraestructura, Densificación o Movilidad. La conclusión se recalcula con la prioridad elegida.
- [ ] Opción de comparar dos zonas y de buscar un lugar en el mapa.
- [ ] Enlace "Ver cifras generales de Medellín".

**Datos:** todas las secciones anteriores.

---

## 15. Fuentes y método

**Tareas**
- [ ] Tabla generada desde `catalogo.json`: dataset, entidad, tema, vigencia, estado, uso y URL.
- [ ] Filtros por tema y conteo de datasets por estado.
- [ ] Explicación del método: ingesta reproducible, verificación antes de cada despliegue y significado de cada estado.
- [ ] Mantener el enlace "Ver fuente" desde cada tarjeta, como funciona hoy.

**Datos:** [fuentes-medellin.md](fuentes-medellin.md) completo.

---

## 16. Experiencia general: buscador, clima y presentación

**Tareas**
- [ ] Buscador `⌘K` / `Ctrl+K` que encuentre secciones, cifras y lugares del mapa.
- [ ] Reloj y clima actual de Medellín en la cabecera (Open-Meteo).
- [ ] Estado del lago en la barra lateral, con temas cargados y fecha de prueba.
- [ ] Modo presentación que recorra las secciones a pantalla completa.
- [ ] Navegación con `#hash` por sección y botón atrás funcional.
- [ ] Revisión de accesibilidad y rendimiento en móvil.
- [ ] Cerebro Lima tiene una pantalla de clave de acceso. Decidir si se quiere una; por ahora no se implementa.
