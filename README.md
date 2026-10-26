# Medellín · sistema de información

**Grupo:** Samuel Madrid Ossa y Juan Jose Restrepo · **Curso:** Tópicos de Sistemas de Información (Taller de datos) · **Enlace:** _pendiente de desplegar en Vercel_ · **Revisado:** 24 de octubre de 2026

Gemelo territorial de Medellín: un lago de datos abiertos (93 fuentes con su ID, de F001 a F093), un sitio que lo muestra en 15 secciones y un gemelo 3D. Sigue la estructura de [Cerebro Lima](https://cerebro-lima.vercel.app/).

- Entrega 1: [Excel del diccionario](docs/entrega1/Diccionario_de_datos_TallerDatos_completo.xlsx) y [Word «Por qué estos datos»](docs/entrega1/Preguntas_por_que_estos_datos.docx), tal como se entregaron.
- Entrega 2: [Excel del diccionario actualizado](docs/Diccionario_de_datos_TallerDatos_entrega2.xlsx). Lo genera `ingesta/diccionario.py` desde el lago; la hoja «Cambios entrega 2» lista cada cambio.
- Plan de trabajo: [docs/issues.md](docs/issues.md) · Fuentes investigadas: [docs/fuentes-medellin.md](docs/fuentes-medellin.md) · Guion de la presentación: [docs/presentacion.md](docs/presentacion.md)

## Qué cambió por la retroalimentación de la entrega 1

| Lo que dijo el profesor | Qué hicimos |
|---|---|
| El Word casi no cita IDs | El Word ya se entregó y no se reescribe. En este README, en el Excel actualizado y en la app cada fuente se nombra con su ID (F001…), el mismo de la entrega 1. Open-Meteo no estaba en el Excel y entra como F093. |
| La pregunta 5 no nombra ningún campo | Abajo, en [Protección](#protección), están los campos con nombre propio: `sexo`, `edad`, `estado_civil`, `ocupacion`, `discapacidad`, `grupo_especial`, `latitud` y `longitud` del SISC (F020–F027), y `Sexo`, `Edad`, `Direccion_incidente` y `Radicado` de las víctimas viales (F065). |
| La bitácora no registra ni un error de la IA | La [bitácora de IA](#bitácora-de-ia) de esta entrega registra 12 encargos, y casi todos dicen qué hizo mal la IA. También se agregaron tres errores de la entrega 1 que no se habían anotado. |
| La contradicción del SISC | La columna «¿Trae datos de personas?» de F020–F027 decía «Solo conteos por zona», pero el archivo SÍ trae sexo, edad y coordenadas de cada víctima (se comprobó leyendo la cabecera del CSV). La columna describía el lago y no la fuente. En el Excel actualizado dice «Personas identificables», y la hoja «Protección» separa lo que trae la fuente de lo que llega al lago. |
| Dos o tres preguntas por comuna, con ID de fuente y periodo a la vista | Sección nueva **Preguntas**: homicidios (pregunta 2 de la entrega 1), natalidad (pregunta 3) y espacio verde por habitante. Cada gráfico muestra su ID de fuente, el periodo, el estado (y PROXY si aplica), la fecha de prueba y la licencia. La pregunta 1 (ICA por zona) queda pendiente, con su razón. |
| Cifras que mezclan años: el verde por habitante, la tasa del SISC sobre tres años | Verde: el inventario de 2019 se dividía entre la población de 2026; ahora se divide entre la de 2019. SISC: la tasa sumaba 2021–2023 (y 2023 llega solo hasta el 29 de noviembre) y la dividía entre la población del DAP de 2026, un 10,3 % más alta que la del DANE. Ahora usa el último año completo (2022) entre la población de 2022. Para eso el lago guarda la población de cada comuna año por año. |
| La rentabilidad de 18 % en estrato 1 | Nos preguntamos por qué. De las 31 ofertas de arriendo de estrato 1, 29 eran apartamentos; de las 366 de venta, 303 eran casas que se ofrecen a la mitad del precio por m² de un apartamento. Se dividía el arriendo de un tipo de vivienda entre la venta de otro. Ahora la rentabilidad compara apartamentos con apartamentos y solo se publica con 30 ofertas o más de cada lado; estrato 1 queda sin dato (29 arriendos). Con el mismo criterio, Villa Hermosa sigue arriba (11,2 %, con 87 ofertas de venta y 90 de arriendo); nuestra hipótesis, sin verificar, es que el arriendo por m² baja menos que el precio de venta en vivienda pequeña. |
| Que el repositorio muestre el trabajo de los dos | Ver [Quién hizo qué](#quién-hizo-qué). |

## Para quién y qué pregunta

- **Usuario:** quien decide sobre una comuna: un concejal, un equipo de planeación de la Alcaldía o una junta de acción comunal que quiere comparar su territorio con los demás.
- **Preguntas** (las tres de la entrega 1 y una nueva):

| Pregunta | Estado | Fuentes |
|---|---|---|
| ¿Cuáles son las zonas con más homicidios? (entrega 1, pregunta 2) | **Respondida** por comuna, tasa por 10.000 habitantes del último año completo | F020, con la población de F001 y F003 |
| ¿Cuál es la comuna con mayor natalidad? (entrega 1, pregunta 3) | **Respondida** por comuna, tasa calculada por la fuente | F006 |
| ¿Cuánto espacio verde urbano hay por habitante? (nueva) | **Respondida** por comuna, inventario y población del mismo año | F078, F001, F003 |
| ¿Cuáles son las zonas con peor ICA? (entrega 1, pregunta 1) | **Pendiente.** El SIATA (F080) mide el ICA por estación y la app lo lee en vivo, sin guardarlo. La sección Ambiente lo muestra por estación; para responder por comuna habría que guardar la serie y asignar cada estación a una zona, y una comuna sin estación quedaría sin dato. | F080 |

- **Escala y comparación:** las 16 comunas y 5 corregimientos entre sí. En el Atlas se comparan también los 271 barrios y los 10 municipios del Área Metropolitana.
- **Lo que decidimos no mostrar, y por qué:**
  - Los registros por víctima del SISC (F020–F027) y de víctimas viales (F065). Cruzando año, barrio, sexo y edad, el 93 % de los homicidios de 2019–2023 son únicos (ver [Nuestra posición](#nuestra-posición)).
  - Los conteos de un barrio con menos de 5 casos en el mapa por barrio: en homicidios eran 161 de 239 barrios.
  - El punto exacto de cada siniestro vial y si hubo muertos: el mapa de calor usa celdas de ~110 m y el año.
  - Los titulares de prensa (F092) que cuentan una muerte, una captura o un ataque a alguien.
  - El documento y el tipo de documento de los contratistas de SECOP (F040).

## La réplica

- **Lo que replicamos de Lima:** el lago con un JSON por tema, las cifras con fuente, vigencia y estado, el catálogo, el gemelo 3D con MapLibre, las lentes y la sección de fuentes y método.
- **Lo que cambió para Medellín:** las fuentes; la tasa por comuna con la población repartida (el DANE no publica población por comuna); el SIATA en vivo a través de un proxy, porque no permite CORS; y no usamos compuerta (ver Protección).
- **Fuentes:** 93 catalogadas, 92 integradas y 1 candidata (F054, internet fijo por comuna, que no es abierta). Las 10 del portal del Área Metropolitana (F009, F056–F058, F063, F064, F067, F069, F077, F087) respondían 502 el 24 de octubre de 2026: la app usa lo que trajo la última ingesta que funcionó, y su licencia queda «sin verificar».
- **Huecos:**
  - El ICA por comuna.
  - La cobertura de internet fijo por comuna (F054).
  - La demanda de energía por comuna (no es abierta).
  - Los precios de cierre de vivienda: solo hay precios de oferta (F008, rotulados PROXY).

## ¿Se puede usar?

La licencia de cada fuente se leyó en la propia fuente y está copiada tal cual en la sección Fuentes de la app y en el Excel. Lo hace `ingesta/licencias.py`, sin suponer ninguna.

| Fuentes | Licencia (como la dice la fuente) | Personas | Condición para nosotros |
|---|---|---|---|
| F012–F019, F028, F029, F035–F038, F040, F048, F049, F051 (datos.gov.co) | Creative Commons Attribution \| Share Alike 4.0 International | F013, F018, F019 traen el sexo de la víctima por evento; F040 puede traer personas naturales | Atribuir y **compartir igual**: lo que el lago deriva de ellas se publica bajo CC BY-SA 4.0 |
| F020–F027, F030–F032, F041–F047, F052, F065, F066 (MEData) | Atribución 4.0 Internacional (CC BY 4.0) | F020–F027 y F065: **personas identificables** | Atribuir; lo de personas se agrega por zona |
| F001, F002, F007 (DANE) | «Se autoriza el uso… siempre y cuando se haga la siguiente cita textual: “Fuente: Departamento Administrativo Nacional de Estadística: www.dane.gov.co”» | No | Citar al DANE con esa frase |
| F034 (OpenStreetMap) | Licencia de Base de Datos Abierta de Open Data Commons (ODbL) | No | Atribuir y compartir igual lo derivado |
| F086 (USGS), F088 (NASA), F090 (Wikimedia, CC0), F091–F092 (GDELT) | Dominio público, uso abierto o «unlimited and unrestricted use», según cada una | F092: los titulares pueden nombrar personas | Citar a GDELT con enlace; F092 se publica con filtro |
| F093 (Open-Meteo) | CC BY 4.0, y la API gratuita **solo para uso no comercial** | No | Sirve para un trabajo académico; no para un uso comercial |
| F060 (Esri World Imagery) | «This work is licensed under the Esri Master License Agreement» | No | **No es abierta**: es solo un fondo opcional del gemelo, con su atribución |
| F089 (EOX Sentinel-2) | «Just feel free to use them. We just ask for a link back to EOX::Maps as well as appropriate attribution» | No | Enlazar y atribuir |
| F003–F006, F008, F010, F011, F033, F039, F050, F053–F055, F059, F068, F070–F076, F078–F085 | **No declara** (servidores ArcGIS de la Alcaldía, SIATA, Metro, EPM) | No | Se usan como información pública con crédito a la entidad. Es un riesgo conocido: la fuente no dice qué se puede hacer |
| F009, F056–F058, F063, F064, F067, F069, F077, F087 | **Sin verificar**: el portal del Área Metropolitana no respondía | No | Volver a correr `ingesta/licencias.py` cuando el portal vuelva |

## Bitácora de exploración

Una advertencia honesta: la herramienta de las vistas (Next.js con MapLibre) se eligió en la entrega 1, antes de explorar. En esta entrega llevamos la misma tabla a otras herramientas para poner a prueba esa elección. Todas recibieron los mismos datos: `exploracion/preparar_datos.py` saca del lago una tabla de 21 comunas con los indicadores de las preguntas y un `fuentes.json` con el ID, el periodo, la fecha de prueba y la licencia de cada columna. Cada prueba deja su código y sus capturas en `exploracion/`.

| Tramo | Herramienta | Qué pidió para empezar | Licencia | Dónde quedan los datos | ¿Se rehace con un comando? | Estado del proyecto | Qué resolvió de nuestra pregunta | Qué no pudo | ¿Quedó? ¿Por qué? |
|---|---|---|---|---|---|---|---|---|---|
| Vistas | Streamlit 1.66.1 | Python y pip. El entorno virtual falló con Python 3.14 (sin `ensurepip`) y se usó 3.12. Instaló 36 paquetes, 470 MB, en 56 s. Sin cuenta para correr; publicar en Community Cloud pide cuenta de GitHub (no lo probamos) | Apache-2.0 | En el servidor de la app y en el repositorio. El mapa de pydeck pide teselas a un servidor externo | Sí: `streamlit run app.py` | Activo: versión del 21-oct-2026 | Selector de indicador, barras, mapa por comuna y tabla en 40 líneas de Python. La procedencia queda como texto bajo el título | `st.bar_chart` ordenó las barras por nombre y no por valor; el mapa por comuna pidió instalar pydeck y armar los colores a mano; la fuente no queda «a un clic»; desde un repositorio público, la app publicada es pública | **No.** Funciona, pero cada gráfico «a un clic de su fuente» y el gemelo 3D habría que construirlos aparte, y el servidor tiene que estar siempre encendido |
| Vistas | Observable Framework 1.13.4 | Node 18 o más y `npm install`: 13 s, 88 MB. Sin cuenta | ISC | Los cargadores de datos corren al construir y dejan una instantánea en `dist/_file/data/`, descargable por cualquiera | Sí: `npx observable build` (9 s, sitio de 1,2 MB) | Última versión del 6-abr-2026: más de seis meses sin publicar | Ranking, mapa por comuna y procedencia en una página Markdown, como sitio estático | El mapa salió como un rectángulo lleno: los polígonos de ArcGIS vienen con el giro contrario al que espera d3, y se resolvió con la proyección `reflect-y`. Ordenar las barras tomó dos intentos. No aloja ni protege nada | **Casi.** Es la que casi elegimos: estática, liviana y con los datos a la vista. Quedó fuera por el gemelo 3D (no maneja 1 millón de edificios en PMTiles) y porque el proyecto lleva medio año sin versión nueva |
| Vistas | kepler.gl 3.3.0-alpha.18 (demo web) | Nada: ni cuenta ni instalación | MIT (proyecto abierto) | Según la propia página, solo en el navegador de quien lo abre («No information or map data is sent to any server») | No: se carga a mano | Alfa | Aceptó el GeoJSON de comunas con las seis columnas (283 KB) | El clic en «Add Data» no se completó en Chrome sin ventana. **Prueba sin terminar**: falta hacerla a mano | Sin decidir; sirve para explorar, no para publicar |
| Vistas | **Next.js 16 + MapLibre GL JS 6** (elegida) | Node y `npm install`; ni llave ni tarjeta (mapa base de OpenFreeMap) | MIT (Next.js) y BSD-3-Clause (MapLibre, PMTiles) | En `public/` del repositorio y en el despliegue de Vercel | Sí: `npm run ingesta && npm run build` | Activos: Next 16.4.3 y MapLibre 6.15.0, de octubre de 2026 | Todo: las 15 secciones, cada cifra con su ficha, el mapa por comuna, el gemelo 3D con 1.078.553 construcciones | Es mucho código propio (unas 12.000 líneas que hay que mantener). El plan gratis de Vercel es solo para uso no comercial | **Sí:** es la única que muestra a la vez el gemelo 3D y la fuente de cada cifra a un clic |

## Protección

- **Nivel: abierto, solo agregados.** Lo publicado es dato abierto agregado por zona, así que una clave en el navegador sería teatro (lo decidimos en la issue 16, ver `docs/issues.md`). Lo delicado no se publica: los archivos por persona se descargan a `datos/crudos/`, que está en `.gitignore` y no llega ni al repositorio ni al despliegue.
- **Qué protegemos, y de quién:**
  - A las víctimas del SISC y de los siniestros viales, de que alguien que conoce su barrio, su edad o la fecha las reconozca.
  - A las personas que nombra la prensa.
- **Cómo:**
  - El lago solo guarda conteos: por comuna para un año y por barrio para tres años.
  - Los barrios con menos de 5 casos no se publican.
  - Los siniestros van en celdas de ~110 m, solo con el año.
  - Los titulares sobre una persona se filtran.
  - `ingesta/verificar.py` falla si cualquier archivo publicado (el lago o las capas del mapa) trae un campo llamado `sexo`, `edad`, `estado_civil`, `ocupacion`, `discapacidad`, `grupo_especial`, `radicado`, `telefono`, `correo`, `documento`…, o si una fuente con personas queda «Abierto» a secas.
- **Pruebas de terminal** (`scripts/prueba-terminal.sh <url>`, corrida contra el build local el 24-oct-2026: 15 de 15 OK):
  - Lo público responde 200.
  - Los crudos (`/datos/crudos/…`), el código de ingesta, `/.env`, `/.git/config` y el build interno responden 404.
  - `seguridad.json` publicado no trae campos de persona.
  - El historial de git no tiene claves.
- **Revisión de secretos en el historial:** `git log -p --all | grep -i -E "clave|secret|password|api_key|token"` solo encuentra la palabra «clave» como nombre de variable y los «tokens» de diseño de las gráficas. El sistema no usa ninguna llave.
- **Lo que queda, sabido:** las versiones anteriores de `public/data/siniestros.pmtiles` siguen en el historial de git con el punto exacto y la marca de muerte. Sacarlas exige reescribir el historial. No lo hicimos, porque es el mismo dato que publica MEData (F065), pero lo dejamos escrito.

## Herramienta elegida para las vistas

- **Qué necesitábamos mostrar:** un mapa por comuna, el gemelo 3D con un millón de construcciones y, a un clic de cada cifra, su ID de fuente, su periodo, su fecha de prueba y su licencia, también en el teléfono.
- **Qué teníamos que proteger:** nada detrás de una clave. Lo que hay que proteger son los registros por persona, y eso se resuelve en la ingesta (no salen del equipo), no en la herramienta.
- **Por qué esta:** con código propio en Next.js y MapLibre los datos publicados son exactamente los archivos de `public/`, que la verificación revisa uno por uno, y la ficha de fuente es un componente propio. **Casi elegimos Observable Framework**; nos detuvieron el gemelo 3D y que el proyecto lleva medio año sin versión nueva.

## Nuestra posición

> Las dos posiciones las redactamos con ayuda de la IA a partir de la evidencia de nuestro sistema; las firmamos los dos después de revisarlas.

**Gestión y gobierno de datos: «Público no es inocuo».** El archivo de homicidios del SISC (F020) es público, tiene licencia CC BY 4.0 y no trae nombres. Aun así, `exploracion/k_anonimato_sisc.py` cuenta que de los 2.101 homicidios de 2019 a 2023:

- 1.957 (93,1 %) son los únicos de su grupo si se cruzan año, barrio, sexo y edad;
- 1.940 (92,3 %) lo son con solo la fecha y el barrio.

Quien conoce a una víctima encuentra su fila, y con ella su ocupación, si tenía una discapacidad o si pertenecía a un grupo especial. Por eso no basta con «no tiene nombres». La columna de la entrega 1 que decía «Solo conteos por zona» era justamente la confusión entre lo que publica la fuente y lo que publicamos nosotros. Nuestro mínimo es 5 casos por barrio: es la primera cifra que deja de señalar un hecho puntual en los barrios pequeños. A cambio, el mapa de homicidios por barrio pierde 161 de 239 barrios, y lo aceptamos.

**Ciberseguridad: «La herramienta que ayuda también puede actuar».** El agente de IA con que construimos el sistema (Claude Code) trabajó con permiso para escribir en el repositorio, usar la terminal y salir a internet; nunca tuvo credenciales, porque el sistema no usa ninguna. Dos veces, al intentar apagar un servidor de prueba con `pkill -f`, el agente cerró su propia terminal: el patrón coincidía con su propio comando. Fue inofensivo, pero muestra que actuó con todo el permiso que tenía, sin distinguir. Además leyó texto de afuera (titulares de prensa, páginas de términos) que podría traer instrucciones escondidas. Nuestras reglas:

- Ninguna llave en el entorno del agente.
- Ningún dato personal en la conversación: el cálculo de k-anonimato corre en la máquina y solo devuelve conteos.
- Los commits los hace una persona después de leer el cambio.

## Bitácora de IA

El detalle está en la hoja «3. Bitácora IA» del [Excel actualizado](docs/Diccionario_de_datos_TallerDatos_entrega2.xlsx), filas 19 a 30. Resumen de lo que la IA hizo mal y cómo nos dimos cuenta:

| Tramo | Herramienta | Qué le encargamos | Qué entregó | Qué le corregimos |
|---|---|---|---|---|
| Diccionario (entrega 1) | Claude | Llenar «¿Trae datos de personas?» | «Solo conteos por zona» para el SISC | El archivo trae sexo, edad y coordenadas: la columna describe la fuente, no el lago |
| Ingesta (entrega 1) | Claude | Rentabilidad por estrato | 18 % en estrato 1 | Mezclaba arriendos de apartamentos con ventas de casas |
| Ingesta (entrega 1) | Claude | Tasa del SISC por comuna | Tres años sumados entre la población de 2026, con la advertencia «No es una tasa anual» | Un año completo entre la población de ese año |
| Ingesta (entrega 1) | Claude | Afluencia del Metro | 1,99 millones de entradas por día | Sumaba dos veces la columna de total: son 997.000 |
| Vistas (entrega 1) | Claude | Dividir el mapa 3D en archivos | Una función sin importar: el mapa no abría fichas | Lo encontró la prueba con clics, no el lint |
| Licencias | Claude Code | Leer la licencia de 93 fuentes | Propuso leer `copyrightText` de ArcGIS | Es un crédito, no una licencia: queda «no declara» |
| Catálogo | Claude Code | Numerar las fuentes | F01–F93, distinto del Excel desde F057 | Volvimos a los IDs de la entrega 1 |
| Protección | Claude Code | Buscar datos de personas a la vista | Encontró titulares con víctimas y barrios con 1 a 4 homicidios | Filtro de titulares y mínimo de 5 por barrio |
| Exploración | Claude Code | Llevar la tabla a Streamlit, Observable y kepler.gl | Las tres arrancaron | Barras mal ordenadas, un mapa invertido y kepler.gl sin terminar |

## Revisión cruzada

_Pendiente: se hace en clase con otro grupo._

- Tres cifras auditadas por el grupo ___: resultado y correcciones.
- Ataque del grupo ___: qué intentó, qué consiguió, qué cambiamos. Deben correr `scripts/prueba-terminal.sh` contra nuestro enlace.
- Vueltas atrás en la ruta: del tramo de vistas al de lago, para corregir la tasa del SISC, el verde por habitante y la rentabilidad.

## Quién hizo qué

_Por completar por el grupo: qué hizo cada uno (fuentes, preguntas, protección, exploración de herramientas, presentación)._

## Ver la app

```bash
npm install      # solo la primera vez
npm run dev      # abre http://localhost:3000
```

En la app: **⌘K / Ctrl+K** busca secciones, cifras del lago y lugares del mapa; cada sección tiene su dirección (`/#people`, `/#twin?v=…`) y el botón atrás del navegador vuelve a la anterior; **▶ Presentar** recorre las secciones a pantalla completa (← →, P para pausar, Esc para salir).

## Calidad del código

```bash
npm run check    # lint + pruebas + verificación del lago (correr antes de cada commit)
npm run lint     # ESLint (reglas de Next y de hooks de React)
npm test         # pruebas de las utilidades del frontend (node:test) y de la ingesta (unittest), sin red
npm run format   # Prettier sobre src/, tests/ y scripts/ (config en .prettierrc.json; twin/config.js queda fuera a propósito)
npm run qa       # prueba cada sección en un Chrome sin ventana (necesita la app corriendo: npm run build && npm start)
```

`npm run qa` abre cada sección, hace clic en sus controles y avisa de errores de consola, peticiones fallidas, desbordes, huecos en las rejillas, tarjetas desniveladas, textos cortados, tarjetas con mucho espacio vacío y franjas vacías de más de 160 px entre bloques; deja una captura por sección en `.cache/qa/`. Acepta el ancho y las secciones (`npm run qa -- 390 atlas,services`; conviene pasar por 1400, 1024, 768 y 390, porque la barra lateral se pliega a íconos hasta 1180 px y se esconde en el celular) y otra dirección con `QA_URL`. Los cambios que mueven código entre archivos se prueban así, con clics: el lint y las pruebas unitarias no ejecutan la interfaz.

`tests/lago-frontend.test.mjs` comprueba que el código no pida cifras ni fuentes que el lago no tiene. `npm install` copia el worker de MapLibre a `public/maplibre/` (`scripts/copiar-maplibre.mjs`), así que siempre coincide con la versión instalada.

## Lago de datos

La app no tiene cifras escritas a mano: todas salen de `public/data/lago/`, que generan los scripts de `ingesta/`. Cada tema es un JSON con este contrato:

| Campo | Contenido |
|---|---|
| `cifras` | `valor`, `unidad`, `etiqueta`, `fuente`, `vigencia` y `estado`, más `nota` y `decimales` opcionales |
| `series` | Puntos `[etiqueta, valor]` con su fuente y su vigencia |
| `listas` | Rankings o tablas |
| `fuentes` | Entidad, URL, estado y fecha `probado` de cada fuente |
| `ancla` | Cifras que el tema aporta al Panorama |

Estados: `observado` (dato abierto descargado), `declarado` (leído de un PDF o de prensa), `derivado` (calculado) y `candidato` (existe pero no es abierto). Una cifra, serie o indicador puede llevar además `proxy`: qué cosa aproxima, cuando esa cosa no se mide directo (un precio de oferta en lugar del de cierre). La app la rotula PROXY.

Archivos generados además de los temas:
- `indice.json`: lista de temas.
- `catalogo.json`: todas las fuentes, cada una con su ID (F001…), la licencia leída en la fuente, la fecha en que se leyó, qué trae sobre personas y su nivel de protección; alimenta la sección Fuentes y la ficha de cada cifra. El ID y la licencia vienen de `ingesta/registro_fuentes.json`, que se versiona.

### Actualizar los datos

Solo la primera vez, prepara el entorno de Python y compila tippecanoe (se instala dentro del proyecto, en `.herramientas/`, sin sudo; necesita `build-essential`):

```bash
python3 -m venv .venv
.venv/bin/pip install -r ingesta/requirements.txt
ingesta/instalar_tippecanoe.sh
```

**Gemelo 3D.** Las construcciones del catastro (más de un millón) se descargan a `datos/crudos/` y se convierten a `public/data/edificios.pmtiles` (unos 57 MB). Los datos crudos no se guardan en git; el PMTiles sí, porque el despliegue (Vercel) sirve lo que hay en el repositorio y no corre la ingesta. Para regenerarlo: `npm run ingesta` (o solo `.venv/bin/python ingesta/correr.py gemelo`, unos 6 minutos). Sin ese archivo, el mapa muestra los límites y avisa que faltan los edificios.

**Lentes y capas temáticas.** `ingesta/pull_lentes.py` depende de lo que genera el gemelo: los límites y el cruce espacial de las construcciones. Por eso `correr.py` lo ejecuta después de `gemelo`. Produce:
- las capas del panel Explorar, en `public/data/geo/capas/`;
- el mapa de calor de siniestros viales, en `public/data/siniestros.pmtiles`;
- la rejilla para "Analizar punto", en `public/data/geo/analisis.json`;
- los índices 0–100 por comuna, en el tema `lentes` del lago.

Para regenerar solo esto: `.venv/bin/python ingesta/correr.py lentes`, unos 6 minutos.

**Ortofotos.** El mapa las pide a `/api/ortofoto/<año>/{z}/{y}/{x}`, un proxy que guarda cada tesela en `.cache/ortofoto/`. El servidor de la Alcaldía se cae con frecuencia; cuando falla, se ve la imagen satelital de Esri debajo.

**Gente.** `pull_demografia.py` descarga una vez el archivo del DANE por sexo y edad (131 MB) a `datos/crudos/` y lo reutiliza mientras no cambie de tamaño. Necesita `public/data/geo/comunas.geojson` (lo genera `gemelo`) para los nombres de los 21 territorios. Tarda unos 2 minutos.

**Economía.** `pull_economia.py` descarga unas 154.000 ofertas de vivienda de la OIME y las 92.000 licencias de las curadurías. La capa de licencias no admite paginación y el servidor de la Alcaldía falla a ratos, así que se baja por rangos de id con reintentos; puede tardar 5 minutos o más. También escribe `public/data/geo/capas/economia_valor_suelo.geojson` para el gemelo.

**Turismo.** `pull_turismo.py` genera las capas `turismo_{atractivos,informacion,hospedajes}.geojson` del gemelo. Los hospedajes salen de OpenStreetMap vía Overpass, que a veces está saturado: el script prueba tres servidores y, si ninguno responde, conserva los hospedajes de la ingesta anterior. Tarda 1 o 2 minutos.

**Municipio.** `pull_municipio.py` consulta CUIPO (Contraloría) y SECOP II en datos.gov.co con consultas agregadas (SoQL), la capa de inversión por comuna del servidor de la Alcaldía, los acuerdos y proyectos del Concejo y el CSV del predial de MEData. Necesita `public/data/geo/comunas.geojson` (lo genera `gemelo`). Tarda menos de un minuto.

**Servicios públicos.** `pull_servicios.py` descarga el CSV de accesos a internet fijo del MinTIC (unos 130 MB, desde un servidor lento: la primera vez tarda unos 5 minutos) a `datos/crudos/` y lo reutiliza mientras no cambie de tamaño. Lee las tarifas de energía de las publicaciones mensuales en PDF de EPM, así que necesita `pdftotext` (paquete `poppler-utils`). Necesita `public/data/geo/comunas.geojson` (lo genera `gemelo`).

**Atlas.** No tiene script propio: lee las listas `indicadores` y `territorios` de cada tema (el contrato de `lago.Territorios`). Las métricas que se muestran se eligen en `src/lib/atlas.js`. El nivel barrio usa `public/data/geo/seguridad_barrios.json` (lo genera `seguridad`) y `public/data/geo/construcciones_barrios.json` (lo genera `lentes`); la comparación con el Área Metropolitana, la lista `amva` de `demografia`.

**Correlaciones.** Tampoco tiene script ni tema en el lago: toma las métricas del nivel comuna del Atlas y calcula en el navegador el coeficiente de Spearman de cada par (`src/lib/correlaciones.js`). Qué métricas entran a la matriz y por qué las demás quedan fuera se decide en ese mismo archivo (`FUERA` y `MOTIVOS`); una métrica nueva del Atlas entra a la matriz salvo que se agregue ahí.

**Territorio y cultura.** `pull_territorio.py` necesita `public/data/geo/comunas.geojson` y `datos/crudos/construcciones_puntos.csv` (los genera `gemelo`) para recortar las amenazas del POT por territorio y contar las construcciones expuestas, y `demografia.json` para los m² de espacio verde por habitante. Lee los atributos de los 195.000 polígonos de espacio verde del Área Metropolitana (unas 100 páginas) y las geometrías de las amenazas y los usos del suelo sin pedirle al servidor que las generalice, porque así cada página tarda veinte veces más. Genera las capas `cultura_patrimonio`, `cultura_bibliotecas` y `educacion_sedes` del gemelo.

**Seguridad.** `pull_seguridad.py` descarga además 8 archivos del SISC (MEData), hasta 124 MB el más pesado, y necesita `public/data/geo/comunas.geojson` (lo genera `gemelo`) y `demografia.json` para la tasa por comuna. Con buena conexión tarda unos 5 minutos; produce `public/data/geo/seguridad_barrios.json` para el mapa por barrio.

**Escucha social.** `pull_escucha.py` lee las vistas mensuales de Wikipedia (Wikimedia Pageviews) del artículo de Medellín en español y en inglés, de las 21 comunas y corregimientos y de los lugares de la categoría «Turismo en Medellín», sumando las de sus redirecciones (unas 600 consultas, 2 minutos). Usa un User-Agent con el repositorio como contacto, porque Wikimedia limita a los clientes que no se identifican. Luego hace 4 consultas a GDELT: el volumen diario de 90 días y los titulares más relevantes en 3 cortes de 30 días. GDELT responde 429 a menudo aunque se le pregunte despacio; el script reintenta con esperas de hasta 5 minutos (la corrida puede tardar 20 minutos) y, si aun así no responde, conserva la prensa de la ingesta anterior. El navegador nunca consulta GDELT: el lago es la copia en el servidor. Necesita `public/data/geo/comunas.geojson` (lo genera `gemelo`) para los nombres de los territorios.

**Ambiente.** Lo que cambia cada pocos minutos (calidad del aire, lluvia, niveles, temperatura, ruido, alertas y sismos) **no se guarda en el lago**: la app lo pide en vivo a `/api/ambiente/<recurso>`, un proxy que cachea 10 minutos en `.cache/ambiente/` y, si el SIATA no responde, sirve la última copia marcada como obsoleta con su hora. `pull_ambiente.py` solo ingesta lo estable: el tamaño de cada red del SIATA, la serie anual de sismos del USGS y el mapa de ruido del AMVA (`public/data/geo/capas/ruido_amva_{dia,noche}.geojson`, unos 735 KB cada uno). Necesita `public/data/geo/comunas.geojson` (lo genera `gemelo`) para recortar las isófonas al Distrito y tarda unos 2 minutos y medio, casi todo en unirlas.

Para actualizar:

```bash
npm run ingesta                                # todos los temas, luego catálogo, índice y verificación
.venv/bin/python ingesta/correr.py seguridad   # solo un tema
npm run verificar                              # solo verificar el lago
.venv/bin/python ingesta/verificar.py --red    # verificar además que cada URL de fuente responda
```

Licencias, diccionario y protección (entrega 2):

```bash
.venv/bin/python ingesta/licencias.py          # lee la licencia de cada fuente en la fuente (3 min; usa Chrome sin ventana para MEData)
.venv/bin/python ingesta/diccionario.py        # regenera docs/Diccionario_de_datos_TallerDatos_entrega2.xlsx desde el lago
scripts/prueba-terminal.sh http://localhost:3000   # pruebas de terminal de la protección (o la URL publicada)
.venv/bin/python exploracion/preparar_datos.py # la tabla común para las pruebas de herramientas de exploracion/
```

Si una fuente no responde, su script conserva lo que esa fuente aportó en la ingesta anterior, con su fecha `probado` original. La corrida termina con código de salida 1 y lista las fuentes que fallaron. El servidor de mapas de la Alcaldía, en particular, se cae con frecuencia.

### Agregar un tema o una fuente

1. Crea `ingesta/pull_<tema>.py` con una función `main()`. Usa `Tema` de `ingesta/lago.py` y ingesta cada fuente dentro de `with tema.bloque('<id-fuente>'):`.
2. Agrega el tema a `TEMAS` en `ingesta/correr.py` y su color a `accentByTheme` en `src/data/navegacion.js`.
3. Corre `npm run ingesta`. La verificación debe terminar en `✓ lago válido`.
