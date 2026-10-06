# Fuentes de datos · Modelo Digital de Medellín

Investigación de fuentes para replicar, con datos de Medellín, la estructura de [Cerebro Lima](https://cerebro-lima.vercel.app/). **Cada endpoint de este documento se probó en vivo el 26 de septiembre de 2026.** La columna *vigencia* indica hasta qué fecha llega realmente el dato, que no siempre coincide con la fecha de "actualización" que declara el portal.

## 1. Cómo funciona la referencia

Cerebro Lima no escribe cifras a mano. Tiene un **lago de datos**: un JSON por tema (`demografia`, `social`, `economia`, `turismo`, `seguridad`, `municipio`, `sensores`, `geo`, `edificios`, `atlas_distritos`, `atlas_zonas`, `infraestructura`, `correlaciones`, `escucha`, `catalogo`) generado por scripts reproducibles (`ingesta/pull_<tema>.py`) y validado por `verificar.py` antes de cada despliegue. Si una cifra no está en el lago, su tarjeta no se muestra.

Cada cifra guarda `valor`, `unidad`, `etiqueta`, `fuente`, `vigencia` y un **estado**:

| Estado | Significado |
|---|---|
| `observado` | Dato abierto descargado y consultado en vivo |
| `declarado` | Leído de un PDF, boletín o nota de prensa |
| `derivado` | Calculado a partir de otros datos, por ejemplo una tasa o un precio por m² |
| `candidato` | La fuente existe, pero no es abierta o no se pudo descargar; se guarda la URL probada para no inventar el dato |

Se propone adoptar el mismo contrato para Medellín.

## 2. Equivalencias por sección

| Sección Lima | Medellín | Fuentes principales |
|---|---|---|
| Panorama + diagnóstico de 14 zonas | Diagnóstico de **21 unidades**: 16 comunas y 5 corregimientos | Todas las secciones |
| Gemelo 3D (575 subestaciones, 8.004 edificios) | **1.022.432 construcciones catastrales con pisos reales**, 26 subestaciones, terreno y ortofoto 2024 | Catastro, IDEM, Alcaldía |
| Gente | Población, hogares, IMCV, pobreza multidimensional, IDH | DANE, DAP, ECV |
| Economía y vivienda | Mercado laboral, oferta inmobiliaria, valor del suelo, licencias | DANE GEIH, OIME, IDEM |
| Turismo | Visitantes extranjeros, pasajeros del aeropuerto, ocupación hotelera, atractivos | MinCIT, Aerocivil, MEData |
| Municipio | Presupuesto, inversión por comuna, contratación, Concejo | CUIPO (Contraloría), Alcaldía, SECOP II, Concejo |
| Seguridad | Delitos 2018–2026 (Policía) y mapa georreferenciado 2003–2023 (SISC) | datos.gov.co, MEData |
| *(sin equivalente directo en Lima)* | **Servicios públicos**: cobertura y tarifas de acueducto, energía, gas y aseo por comuna | MEData, EPM, datos.gov.co |
| Territorio y cultura | POT, amenazas, patrimonio, bibliotecas, equipamientos, espacio verde | Servidor de mapas de la Alcaldía |
| Correlaciones | Cruces entre indicadores de las 21 comunas y corregimientos | Derivado |
| Atlas de 43 distritos | **Atlas de comunas y barrios** (271 barrios urbanos), más comparación con los 10 municipios del Área Metropolitana | Catastro, DANE |
| Ambiente y satélite | SIATA en vivo, luces nocturnas, temperatura de superficie, sismos | SIATA, NASA GIBS, USGS |
| Escucha social | Visitas en Wikipedia y cobertura de prensa | Wikimedia, GDELT |

## 3. Portales base

| Portal | Tipo | Acceso programático |
|---|---|---|
| **Servidor de mapas de la Alcaldía** | ArcGIS 11.5, unos 300 servicios | `https://www.medellin.gov.co/servidormapas/rest/services` (requiere User-Agent de navegador) |
| **IDEM · Área Metropolitana** | ArcGIS 11.3 | `https://portalidem.metropol.gov.co/server/rest/services` |
| **MEData** | DKAN (Drupal), 433 datasets; 457 de 459 CSV descargan | Catálogo completo: `https://medata.gov.co/api/1/metastore/schemas/dataset/items` |
| **datos.gov.co** | Socrata | `https://www.datos.gov.co/resource/<id>.json` con SoQL |
| **SIATA geoportal** | API propia, en vivo | `https://geoportal.siata.gov.co/fastgeoapi/geodata/...` |
| **Metro de Medellín** | ArcGIS Hub, 21 ítems | `https://datosabiertos-metrodemedellin.opendata.arcgis.com/api/search/v1/collections/all/items` |

## 4. Catálogo verificado

Convenciones: `ALC` = `https://www.medellin.gov.co/servidormapas/rest/services`, `IDEM` = `https://portalidem.metropol.gov.co/server/rest/services`, `MED` = `http://medata.gov.co/sites/default/files/distribution`.

### Gemelo 3D y cartografía

| Dato | Endpoint | Vigencia | Notas |
|---|---|---|---|
| **Construcciones urbanas del catastro** | `IDEM/DISTRITO_MEDELLIN_CATASTRO/MapServer/8` | Base catastral vigente | 1.022.432 registros (`OBJECTID` continuos de 1 a 1.022.432) con `NUMERO_PISOS`, `ALTURA`, `NUMERO_SOTANOS`, `AREA_CONSTRUIDA` y `TIPO_CONSTRUCCION`. Máximo 39 pisos. Se sirve como teselas vectoriales (PMTiles), no como GeoJSON. |
| Construcciones rurales | `IDEM/DISTRITO_MEDELLIN_CATASTRO/MapServer/7` | Vigente | 56.121 registros, mismos campos |

**Sobre la altura del catastro** (verificado el 26 de septiembre de 2026):
- `ALTURA` está en metros, pero **no es una medición del edificio**: equivale a ≈ `NUMERO_PISOS × 2,3 m` (el campo `ALTURAPISO` vale 2,3 en todos los registros). Por ejemplo, 39 pisos dan 90 m y 33 pisos, 76 m. Los edificios reales suelen tener pisos más altos, así que la altura catastral tiende a quedar por debajo de la real.
- `ALTURA` falta o vale 0 en 61.633 construcciones; ahí el mapa estima `pisos × 2,3 m` y lo indica.
- `ANIOCONSTRUCCION` solo está diligenciado en 94 de 1.022.432 construcciones: en la práctica, el catastro abierto no trae el año de construcción.
- Las capas `Hosted/CONSTRUCCIONESCOTAS` y `Hosted/construcciones_msnm` del servidor de la Alcaldía (777.555 polígonos) **no son alturas de edificio**: su campo `alturas` es la cota del terreno en metros sobre el nivel del mar (1.655–1.660 m), tomada de curvas de nivel cada 5 m (`Hosted/COTAS5M`).
- Una altura medida (fotogrametría o LiDAR) queda como `candidato`: no se encontró publicada en abierto. Google Open Buildings 2.5D Temporal es la alternativa por evaluar.
| Predios urbanos | `IDEM/.../MapServer/6` | Vigente | 289.506 predios |
| Comunas, barrios y veredas | `IDEM/.../MapServer/0`, `/1` (271 barrios), `/2` | Vigente | La app ya usa la capa 0 |
| Comunas y corregimientos (Alcaldía) | `ALC/mapas_nacionales/VC_Limite_Politico_Admtivo/MapServer/1` | Vigente | 23 polígonos: 21 con nombre y 2 sin nombre (`SN01`, `SN02`) |
| Barrios y veredas (Alcaldía) | `.../VC_Limite_Politico_Admtivo/MapServer/0` | Vigente | 332 polígonos |
| **Ortofoto 2024 en teselas** | `ALC/ServiciosCiudad/IMAGEN_WEBM_2024/MapServer/tile/{z}/{y}/{x}` | 2024 | Web Mercator, hasta el nivel 23 (unos 2 cm por píxel). También hay 2016, 2019 y 2021, lo que permite **comparar fechas**. El servidor se cae con frecuencia y sus respuestas de error no traen cabecera CORS, así que la app la sirve por un proxy propio con caché en disco (`/api/ortofoto/<año>/{z}/{y}/{x}`). |
| Modelo digital de elevación 2024 | `ALC/ServiciosImagen/Modelo_digital_de_elevacion_medellin_2024/ImageServer` | 2024 | Terreno oficial. Es un ImageServer, no teselas `raster-dem`: usarlo en MapLibre exige convertirlo antes a Terrarium o Mapbox RGB. |
| Terreno global | `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png` | Estático | **En uso** como relieve del gemelo 3D (`raster-dem`, codificación Terrarium) |
| Cartografía base | OpenFreeMap (ya integrada) | Continua | |

### Notas de uso en las lentes del gemelo (issue #2, 26 sep 2026)

- **Paginación.** Los servicios ArcGIS cortan cada respuesta en su `maxRecordCount` (2.000 en el IDEM). Sin paginar, las líneas de alta tensión (2.231) y los equipamientos (2.139) llegaban truncados en 2.000 sin error visible. `lago.arcgis_geojson` pagina con `resultOffset`.
- **Red de media tensión** (`Riesgo_Tecnológico/FeatureServer/2`, 79.537 tramos). No se descarga: se suma `longitud_c` por comuna con una consulta estadística espacial (POST con la geometría de la comuna). Un tramo que cruza un límite cuenta en ambos territorios.
- **No hay demanda eléctrica abierta por comuna.** MEData solo publica consumos de acueducto por estrato o prestador. La lente de energía muestra infraestructura, no consumo.
- **Altura normativa del POT.** Los tratamientos del IDEM (`DISTRITO_MEDELLIN_POT/MapServer/5`, 522 polígonos) traen `ALTURANORMATIVA`, pero solo 177 tienen un número de pisos; el resto dice "N/A" o "Variable". De las construcciones, 685.555 caen en zonas con altura numérica. En Laureles son apenas 536 de 60.835, así que todo porcentaje "sobre la norma" debe mostrar su base.
- **Víctimas en incidentes viales** (MEData): 1.048.317 filas, de las cuales 235.840 son registros reales con coordenadas (el resto son filas vacías). Cubren 2014–2021. Las coordenadas usan coma decimal.
- **Aforos vehiculares** (MEData): 2017–2019. Cada fila es un movimiento de giro cada 15 minutos con un volumen horario móvil (`VEHICULO_EQUIVALENTE`). El volumen de una intersección es la suma de sus movimientos en la hora de máxima demanda de cada día. Hay 152 intersecciones con datos válidos.
- **Estaciones del Sistema Metro** (portal del Metro): 167 elementos, que incluyen metro, cables (`sistema = C`), Metroplús (`MPLUS`) y tranvía (`T`).

### Energía e infraestructura (equivale a la lente de energía de Lima)

| Dato | Endpoint | Vigencia | Notas |
|---|---|---|---|
| Subestaciones de energía | `IDEM/Hosted/Riesgo_Tecnológico/FeatureServer/8` | Vigente | 26 en el Valle de Aburrá: Poblado, Guayabal, San Diego, Villa Hermosa, San Cristóbal, etc. |
| Redes de alta, media y baja tensión | Mismo servicio, capas 4, 2 y 3 | Vigente | |
| Tarifas de energía EPM | Publicación mensual en PDF de EPM (vigente); datos abiertos `sfcd-b3ey` hasta 2021 | Septiembre de 2026 | Ver [Servicios públicos](#servicios-públicos): `ytme-6qnu` no es el mercado de Antioquia. |
| Subsidios y contribuciones EPM | datos.gov.co `av6t-m6ju` | Septiembre de 2026 | |
| Estaciones de carga eléctrica EPM | datos.gov.co `qqm3-dw2u`, `bff2-84yc` | 2025 | |

### Gente

| Dato | Endpoint | Vigencia | Valor clave |
|---|---|---|---|
| **Proyección municipal DANE (PPED, julio de 2025)** | `https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/PPED-AreaMun-2018-2042_VP.xlsx` | 2018–2042 | **2026: 2.526.795** (cabecera 2.478.217, rural 48.578). **En uso desde la issue #5.** |
| Proyección DANE por área, sexo y edad (PPED) | `.../Municipal/PPED-AreaSexoEdadMun-2018-2042_VP.xlsx` | 2018–2042 | 131 MB; edades simples de 0 a 100+ por sexo. Alimenta la pirámide. |
| Proyección municipal DANE post-COVID (reemplazada) | `.../Municipal/DCD-area-proypoblacion-Mun-2020-2035-ActPostCOVID-19.xlsx` | 2020–2035 | 2026: 2.650.662. Sigue en línea, pero la página del DANE ya no la enlaza: la reemplazó la serie PPED. |
| Proyección por comuna y corregimiento (DAP) | `ALC/mapas_nacionales/VC_Distribucion_Poblacional/MapServer/1`; hogares en `/2`, viviendas en `/3`, estrato en `/0` | 2018–2030, elaborada en diciembre de 2018 | Suma 2026: **2.787.912** (ver §5) |
| IMCV por comuna | `ALC/estadisticas/VC_Indicadores_ECV/MapServer/2` | 2014–2024 (sin 2020) | Popular 2024: 35,07 |
| Pobreza multidimensional por comuna | `.../VC_Indicadores_ECV/MapServer/1` | 2014–2024 (sin 2020) | |
| IDH por comuna | `.../MapServer/3` | 2014–2021 | |
| Inseguridad alimentaria y esperanza de vida por comuna | `.../MapServer/0` y `/5` | 2014–2024 y 2018–2023 | Esperanza de vida solo cubre las 16 comunas. No se usan todavía. |
| Desempleo y PIB por comuna | `.../MapServer/4` y `/6` | 2014–2022 | |
| **Estratificación por manzana** | `ALC/ServiciosCatastro/ConsultaOperadorCatastral_geo/MapServer/23` | Base catastral vigente | 32.384 manzanas con `comuna`, `codigo_barrio` y `estrato`. Mismo esquema que la capa `/0` del DAP, que respondía con error de base de datos. **En uso.** |
| Microdatos de la ECV | `MED/1-002-09-000040/encuesta_calidad_vida.csv` | Por verificar | 367 MB |
| Eventos de salud geográficos | `ALC/salud_protec_soc/VC_Datos_Enfermedades` | **2008–2022** (natalidad y mortalidad desde 2012), aunque el servicio diga "vigente" | Casos y tasa por 100.000 habitantes por comuna (con población del DAP), del SIVIGILA. Hay una fila "99" de registros sin comuna. |

### Notas de uso en la sección Gente (issue #5, 27 sep 2026)

- **Cambio de total oficial.** El DANE publicó en julio de 2025 una actualización de las proyecciones (PPED 2018–2042) que reemplaza la serie post-COVID 2020–2035. Para 2026 da 2.526.795 habitantes, 123.867 menos (−4,7 %). El lago usa ahora la PPED, y por eso cambian las tasas por 100.000 habitantes de Seguridad: homicidios 2025 pasa de 12,64 a **13,17**.
- **Hogares y viviendas del DAP** traen 25 filas: San Cristóbal, Altavista, San Antonio de Prado y Santa Elena vienen partidos en parte urbana y rural con el mismo código. Se suman por código para tener 21 territorios. La capa de población no trae código; se cruza por nombre con la de hogares.
- **Estratos:** la unidad es la manzana, no la vivienda. Una manzana grande y una pequeña pesan lo mismo, y así se rotula en pantalla.
- **El servidor de la Alcaldía** responde a veces `200` con `{"error": "Unable to complete operation"}` (fallo pasajero de su base de datos). `lago.consulta_arcgis` reintenta hasta 4 veces antes de dar la capa por caída.

### Notas de uso en el Atlas (issue #11, 1 oct 2026)

- **Área Metropolitana:** el archivo PPED por área del DANE (el mismo de la población de Medellín) trae los 10 municipios: Barbosa `05079`, Girardota `05308`, Copacabana `05212`, Bello `05088`, Medellín `05001`, Envigado `05266`, Itagüí `05360`, Sabaneta `05631`, La Estrella `05380` y Caldas `05129`. Para 2026 suman 4.212.261 habitantes.
- **Densidad de población:** población por territorio ÷ área según los límites del gemelo (`derivado`). En los corregimientos el área incluye el suelo rural.
- **Sin población por barrio:** no hay en el lago una proyección abierta por barrio, así que el nivel barrio del Atlas no calcula tasas por habitante.
- **Barrios y veredas:** los límites traen 271 barrios y 79 polígonos de vereda, pero 78 veredas: Piedras Blancas Represa (`9011`) viene en dos polígonos. Nueve códigos de barrio del SISC (`5008`, `7003` a `7008`, `9009` y `9010`) no existen en los límites.

### Notas de uso en el Panorama (issue #14, 4 oct 2026)

- **Sin fuentes nuevas.** El diagnóstico usa los índices de las lentes (`lentes.json`) y, como contexto, cuatro métricas del Atlas: área y construcciones en amenaza alta (POT, `territorio.json`), IMCV y pobreza multidimensional (ECV, `demografia.json`). Cada indicador conserva su vigencia: la red eléctrica y el catastro son vigentes, las víctimas viales llegan a 2021, los aforos a 2019 y la ECV a 2024.
- **Buscador de lugares:** usa los límites del gemelo (`barrios.geojson`, `veredas.geojson`) y seis capas puntuales del panel Explorar. La capa del Sistema Metro incluye estaciones de otros municipios del Valle de Aburrá (12 puntos de las seis capas caen fuera de Medellín); el buscador las omite porque no tienen comuna ni corregimiento.

### Economía y vivienda

| Dato | Endpoint | Vigencia | Valor clave |
|---|---|---|---|
| **Mercado laboral, Medellín A.M.** | `https://www.dane.gov.co/files/operaciones/GEIH/anex-GEIH-<mes><año>.xlsx`, hoja `Total 23 ciudades A.M. Trim` | Mayo–julio de 2026 | **Desocupación 6,97 %**, ocupación 62,66 %, participación 67,35 %. Serie trimestral móvil desde ene–mar 2007. **En uso.** |
| **Oferta de vivienda investigada por el Catastro (OIME)** | `ALC/vivienda_ciudad_terri/VM_Oferta_Comercial_Oime/MapServer/0` | **2008–2026** (2026 parcial) | 193.920 registros de venta y arriendo, unos 10.000 por año, con precio, área privada, estrato, comuna y marca de atípico. `commercial_value` es el precio total en venta y el canon **mensual** en arriendo. **En uso** (apartamentos y casas). |
| Anuncios de vivienda en internet (OIME) | `.../VM_Oferta_Comercial_Oime/MapServer/1` | 2023 | 28.425 anuncios (13.878 de venta y 14.547 de arriendo). No se usa: la capa 0 es más reciente y la investiga el Catastro. |
| Valor catastral del suelo por zona | `IDEM/MEDELLIN_Uso_y_Valores_Suelo/MapServer/0` | Base catastral vigente; **el servicio no publica el año** | 276 zonas geoeconómicas con `VALOR_M2` (tipo "Valor Catastral"), de $3.835 a $10,8 M por m². Es avalúo catastral, no precio de mercado. **En uso.** |
| Licencias urbanísticas (curadurías) | `ALC/vivienda_ciudad_terri/VM_Licencias/MapServer/2` | **2003–2020**; 2021 trae 127 registros | 92.308 licencias con `anio` (texto libre: "2008", "2003-1998", "20'04"…), `objeto` y `g__comuna`. **No admite paginación**: se descarga por rangos de `objectid`. **En uso.** |
| Licencias (capa 0) | `.../VM_Licencias/MapServer/0` | 2006 | 835 registros sin fecha ni tipo; el año sale del código (`C4-00383-06-LC`). No se usa. |
| Establecimientos de Industria y Comercio | `ALC/ccio_ind_turism/VC_Act_Comercial_Empresarial/MapServer/0` | Registro activo; sin fecha | 443.241 contratos activos del impuesto, 63.897 de ellos "No posee establecimientos". `comuna` viene vacía en la mitad; `nombre_comuna` sirve, con tildes mal codificadas ("BelÃ©n"). `grupo_actividad` 01–05 sin diccionario publicado. **En uso.** |
| **Estructura empresarial por comuna** | datos.gov.co `pb3w-3vmc` (Cámara de Comercio) | **2018–2022** | Empresas por clase CIIU y comuna; 110.843 en 2022. **En uso.** |
| Facturación del impuesto predial por comuna | `MED/1-016-12-000302/...csv` | **2019–2020** (no 2023) | En uso en Municipio (#8); ver sus notas. |

**Notas de uso en Economía y vivienda (issue #6, 27 sep 2026)**

- **OIME:** se usa la capa de investigaciones del Catastro (2008–2026) en vez de los anuncios de 2023. Mediana del precio de oferta por m² de área privada, sin atípicos y con áreas entre 20 y 500 m². Para que las comunas tengan muestra se juntan los dos últimos años completos (hoy 2024–2025) y se exige un mínimo de 20 ofertas; Popular, Santa Cruz y Palmitas no llegan. Los promedios simples no sirven: los apartamentos en venta de 2025 promedian 741 m² por unos pocos registros erróneos.
- **Rentabilidad bruta** = arriendo mensual por m² × 12 ÷ precio de venta por m², con medianas del mismo periodo: es un cociente de medianas, no la rentabilidad de un mismo inmueble.
- **Industria y Comercio y Cámara de Comercio no se mezclan:** el primero cuenta contratos del impuesto (443.241, con contribuyentes sin local); la segunda, matrículas mercantiles (110.843 en 2022).
- **Cámara de Comercio:** hasta 2020 unas 18.000 empresas por año quedaban "sin georreferenciar"; desde 2021, unas pocas centenas. El conteo por comuna no es comparable antes y después de 2021; el total de la ciudad sí.
- **Servidor de la Alcaldía:** además del error pasajero ya conocido, las consultas por rango de `objectid` de licencias fallan a veces varias veces seguidas. `lago.arcgis_por_ids` reintenta hasta 8 veces cada lote.

### Turismo

| Dato | Endpoint | Vigencia | Valor clave |
|---|---|---|---|
| **Extranjeros no residentes en Medellín** | datos.gov.co `7wm8-w5ad` (MinCIT), filtro `ciudad='Medellín'` | Junio de 2026 | **2025: 1.143.678**; enero–junio de 2026: 551.226. Por mes y país de residencia. **En uso.** |
| **Pasajeros del aeropuerto JMC** | datos.gov.co `gb6w-ynu4` (Aerocivil), `origen='MDE' or destino='MDE'` | Junio de 2026 | **2025: 13.261.826** (9.022.653 nacionales y 4.239.173 internacionales, campo `tr_fico_n_i`). Por mes. **En uso.** |
| Ocupación hotelera mensual | `MED/1-010-04-000201/porcentaje_ocupacion_hotelera_mensual_de_medellin.csv` (ficha datos.gov.co `9uyb-9tt4`) | **Enero de 2007 – octubre de 2023** | Octubre de 2023: 67,1 %; promedio 2022: 77,0 %. **En uso, rotulada como histórica.** |
| Ocupación hotelera por zona | `MED/1-010-04-000202/porcentaje_ocupacion_hotelera_mensual_por_zona.csv` (`r4yu-zpf4`) | Hasta marzo de 2023 | Laureles, Poblado y Centro. **En uso.** |
| Visitantes a museos | `MED/1-010-04-000192/ingreso_mensual_de_visitantes_a_museos.csv` (`ytmq-gp6n`) | Hasta febrero de 2023 | 12 museos; 839.111 visitas en 2022. **En uso.** |
| Visitantes a sitios de interés | `MED/1-010-04-000193/ingreso_mensual_de_visitantes_a_sitios_de_interes.csv` (`pdym-a36z`) | Hasta febrero de 2023 | 9 sitios; 5,26 millones de visitas en 2022. **En uso.** |
| Atractivos turísticos | `ALC/ccio_ind_turism/VC_Turismo/MapServer/0` | Actualizada el 17 de octubre de 2024 (`fecha_actualizacion`) | 92 atractivos, 13 marcados como "imperdibles", 32 tipos. **En uso.** |
| Puntos de información turística | `.../VC_Turismo/MapServer/1` | Vigente | 3 puntos. **En uso.** |
| Hoteles y otros hospedajes | OpenStreetMap vía Overpass, `tourism=hotel|hostel|guest_house|apartment|motel` | Fecha de la copia de OSM del servidor que responde | 381 dentro de Medellín. **En uso**, estado `observado`. |

**Notas de uso en Turismo (issue #7, 27 sep 2026)**

- Las fichas de MEData en datos.gov.co son enlaces, no tablas (la API responde "non-tabular"): el CSV real está en `metadata.accessPoints`.
- **Los archivos de MEData no vienen ordenados** y su vigencia real no es la que parece al leer las primeras filas: la ocupación de la ciudad llega a octubre de 2023, pero la de zonas a marzo de 2023 y museos y sitios a febrero de 2023.
- En museos y sitios, los ceros antes del primer mes con visitas son meses en que el lugar no existía o no reportaba (el Parque Arví abrió en 2010) y se descartan; también un valor negativo del Museo Madre Laura. Los ceros de 2020 (cierre por la pandemia) sí se conservan. El conjunto de lugares cambia entre años, así que la suma anual no es del todo comparable.
- **Overpass:** con `[timeout:90]` o más, los servidores cargados rechazan la consulta con 504; con `[timeout:25]` responde en segundos. Los espejos (`kumi.systems`, `private.coffee`) pueden tener copias de OSM de meses atrás: la vigencia usa la fecha de la copia (`timestamp_osm_base`), no la de la consulta.
- La capa de atractivos la generaba la ingesta de lentes; desde esta issue la genera `pull_turismo.py`.

### Municipio

| Dato | Endpoint | Vigencia | Valor clave |
|---|---|---|---|
| **Presupuesto del Distrito (CUIPO)** | datos.gov.co, Contraloría: programación de ingresos `22ah-ddsj`, ejecución de ingresos `9axr-9gnb`, programación de gastos `d9mu-h6ar`, ejecución de gastos `4f7r-epif`; filtro `codigo_entidad='210105001'` | **2023 – junio de 2026**, por trimestre (`periodo` 20230301 … 20260601) | Presupuesto inicial de gastos 2026: **11,84 billones**; 2025: 10,92 billones (cuadra con los 10,9 billones aprobados por el Concejo) y 8,79 billones de inversión inicial (igual a la cifra aprobada). Compromisos 2025: 11,79 billones. **En uso.** |
| **Inversión pública por comuna y corregimiento** | `hacienda_credi_publ/VM_Inversion_Publica/MapServer/0` (campos `inversion_2008` … `inversion_2024`; las capas 1–16 repiten la misma tabla) | **2008–2024** | Popular 2024: $521.338 millones; suma de los 21 territorios en 2024: 7,84 billones. Inversión ordenada (facturada o pagada) con corte al 31 de diciembre. **En uso.** |
| Inversión por comuna, un archivo por año | MEData `1-002-11-000043` … `000278` | 2008–2019 | No se usa: la capa de la Alcaldía cubre los mismos años y llega a 2024. |
| **Contratación (SECOP II)** | datos.gov.co `jbjy-vk9h`, `nombre_entidad='DISTRITO ESPECIAL DE CIENCIA TECNOLOGIA E INNOVACION DE MEDELLIN'` | Continua (hoy, hasta septiembre de 2026) | 14.518 contratos en total; 2025: **1.471 contratos por 7,59 billones**, sin cancelados ni borradores. **En uso.** |
| **Acuerdos del Concejo** | datos.gov.co `9smt-mgt4` | Último sancionado el 16 de enero de 2026 | 34 acuerdos de 2025. **En uso.** |
| **Proyectos de acuerdo** | datos.gov.co `sqkr-77ej` | 2026 parcial (sin fecha de radicación) | 39 proyectos en 2025. **En uso.** |
| Sesiones plenarias del Concejo | datos.gov.co `i7cm-y3c6` | Abril de 2026 | Filas repetidas (4.710 filas para unas 2.300 sesiones). No se usa. |
| Ingresos y gastos de inversión (MEData) | `MED/1-016-12-000238/comportamiento_de_ingresos.csv` y `.../000236/comportamiento_de_gastos_de_inversion.csv` | **Sin año en el archivo; no se pudo confirmar** | No se usan (ver notas). |

**Notas de uso en Municipio (issue #8, 27 sep 2026)**

- **Vigencia de los archivos de presupuesto de MEData.** No tienen columna de año; los metadatos dicen "2018" y el archivo se modificó en marzo de 2025. Usan los códigos del FUT, que se reportó hasta 2020. Al compararlos con los decretos de liquidación del presupuesto: dos partidas del SGP coinciden al peso con el de 2019 (Decreto 1018 de 2018), pero el total inicial (5,43 billones) no coincide con el de 2019 (5,03 billones); se acerca al de 2020 (5,42 billones) sin ser igual, y ninguna partida coincide con ese decreto. Además, el recaudo (23 % del definitivo) indica un corte de primer trimestre. Con eso no se puede asignar un año con certeza, así que se reemplazan por **CUIPO**, que publica el mismo presupuesto con año y trimestre explícitos.
- **CUIPO · programación de ingresos (`22ah-ddsj`) tiene las columnas corridas**: el código de la cuenta llega en `ambito_codigo`, su nombre en `ambito_nombre`, el presupuesto inicial en `cod_detalle_sectorial` y el definitivo en `nom_detalle_sectorial`. El script acepta los dos órdenes.
- **CUIPO acumula de enero al corte**: el dato de un año es su último trimestre reportado; un año está completo con el corte de diciembre. Solo se suma la vigencia actual (incluidas las vigencias futuras que se ejecutan en el año), no las reservas ni las cuentas por pagar de años anteriores. La programación de gastos no trae agregada la cuenta 2.3 (inversión): se calcula como total menos funcionamiento (2.1) y deuda (2.2). La inversión por sector usa los dos primeros dígitos del código programático MGA; su suma cuadra con la cuenta 2.3.
- **Qué cubre CUIPO:** administración central, Concejo, Personería y Contraloría. Los establecimientos públicos reportan con su propio código, así que el total puede ser menor que el presupuesto general anunciado (2026: 11,84 billones en CUIPO frente a 12,06 anunciados).
- **SECOP II:** el NIT del Distrito (890905211) lo comparten el Concejo y la Personería; se filtra por `nombre_entidad`. Hay valores imposibles (un contrato "Modificado" de 7,7 × 10²⁰ pesos en 2019): se excluyen los que superan 10 billones, más que el presupuesto anual. En 2017 el Distrito firmó solo 91 contratos en SECOP II; la serie empieza en 2018. "Otro" es el tipo de mayor valor: en 2025, el 91 % son contratos o convenios interadministrativos.
- **Concejo:** años mal digitados ("5006", "2204", "0206"); se usa 2008 en adelante, cuando el registro es completo. La numeración de acuerdos y proyectos corre por periodo constitucional (2016–2019, 2020–2023, 2024–2027) y no tiene saltos, así que los conteos por año están completos.
- **Predial por comuna:** el archivo solo trae la facturación trimestral (enero, abril, julio y octubre) de 2019 y 2020, no hasta 2023. Es impuesto **facturado**, no recaudado, y la "comuna de cobro" es la dirección de envío de la factura: del código 21 en adelante son otros municipios (el 50 es Casanare, no Palmitas), y el 18 junta San Cristóbal y Palmitas. Los corregimientos usan los códigos 17 (San Antonio de Prado), 19 (Santa Elena) y 20 (Altavista). El recaudo actual de toda la ciudad sale de CUIPO. `facturacion_historica_impuesto_predial_unificado_por_concepto.csv` (`000263`) trae el total de la ciudad de 2013 a 2017 y no se usa.
- **Inversión por comuna** está en pesos corrientes: los montos de años distintos no se comparan en términos reales. No se calcula por habitante porque la población por comuna del lago es solo la de 2026.

### Seguridad

Hay dos fuentes que se complementan y no deben mezclarse en una misma serie:

**Policía Nacional (MinDefensa) en datos.gov.co.** Cubre hasta agosto de 2026, filtrando `cod_muni='05001'`. Solo tiene nivel municipal, sin coordenadas.

| Delito | ID | 2024 | 2025 | Enero–agosto de 2026 |
|---|---|---|---|---|
| Homicidio | `m8fd-ahd9` | 309 | 333 | 176 |
| Hurto a personas | `4rxi-8m8d` | 25.172 | 24.924 | 16.630 |
| Hurto de vehículos | `csb4-y6v2` | 7.618 | 6.000 | 3.214 |
| Extorsión | `q2ib-t9am` | 950 | 972 | 719 |
| Violencia intrafamiliar | `gepp-dxcs` | 10.959 | 10.638 | 7.624 |
| Delitos sexuales | `bz43-8ahq` | 1.841 | 2.380 | 1.435 |
| Lesiones personales | `jr6v-i33g` | 4.751 | 4.690 | 3.323 |

También hay hurto a residencias (`7mn7-vzqp`), hurto a comercio (`7i2x-h5vp`) y secuestro (`d7zw-hpf4`).

Tasa de homicidios derivada con la población del DANE: **13,17 por 100.000 habitantes en 2025** con la proyección PPED vigente (con la serie post-COVID anterior daba 12,64; ver [notas de Gente](#notas-de-uso-en-la-sección-gente-issue-5-27-sep-2026)).

**SISC en MEData.** Registros georreferenciados con latitud, longitud, barrio y comuna, de 2003 a **noviembre de 2023**. Por ejemplo, `MED/1-027-23-000008/homicidio.csv` tiene 19.647 registros, 18.598 de ellos con coordenadas. Hay archivos equivalentes para cada tipo de hurto, extorsión, llamadas al 123 y otros. Sirve para el ranking por comuna y el mapa por barrio.

### Notas de uso en la sección Seguridad (issue #3, 26 sep 2026)

- **Ocho archivos SISC en uso**, con taxonomía propia (no calcada de la Policía): homicidio (7.070.197 B), hurto a persona (**124.482.690 B**, el más pesado), hurto de carro, hurto de moto, hurto a residencia, hurto a establecimiento comercial, extorsión y lesión no fatal dolosa. Violencia intrafamiliar y delitos sexuales no tienen un archivo SISC equivalente directo (el SISC solo publica "Reincidencia" y "Solicitud de medidas de protección" para violencia intrafamiliar, indicadores distintos a un conteo total), así que el ranking y el mapa por barrio cubren 8 categorías propias del SISC, no las 7 de la Policía.
- **Formato de los campos:** `codigo_comuna` viene sin ceros a la izquierda ("6", "10") y a veces "SIN DATO" o vacío; `codigo_barrio` viene con "#" al inicio ("#0603"): al quitarlo, coincide con el `CODIGO` de `barrios.geojson` y `veredas.geojson` que ya usa el gemelo (issue #1).
- **Ventana reciente:** el ranking por comuna y el mapa por barrio usan los últimos 3 años de cada archivo (2021–2023 en la mayoría), el mismo criterio que ya usaba `pull_lentes.py` para las víctimas viales. La serie anual completa (2003 al último año) también se guarda, para quien quiera ver la tendencia larga.
- **Tasa por comuna:** se cruza el conteo SISC con la población por comuna del DAP (`demografia.json`, lista `poblacion_dap_por_territorio`), que solo trae nombre y valor. El cruce por nombre exige quitarle "Corregimiento de " al nombre de `comunas.geojson` antes de comparar; los 16 nombres de comuna coinciden tal cual.
- **Mapa por barrio: es un coropletico, no un mapa de calor de puntos.** Se agregan los casos de la ventana reciente al polígono de cada barrio o vereda (271 + 79, del catastro) y se colorea con la misma rampa secuencial gris→morado→rosa de los índices del gemelo (issue #2). Un kernel de densidad sobre los puntos crudos habría sido más fiel al término "mapa de calor", pero exige generar un PMTiles nuevo solo para esta sección; el coropletico reutiliza los polígonos que ya existían y es igual de legible a la escala de la ciudad. Se documenta aquí para que quede claro que es una decisión de diseño, no un dato distinto.
- **Homicidio, ventana 2021–2023:** La Candelaria concentra 225 casos (el resto de comunas no pasa de 100), y dentro de ella el barrio Guayaquil concentra 1.931 casos de hurto a persona en la misma ventana — consistente con ser el centro comercial y de mayor afluencia peatonal de la ciudad.

### Movilidad

| Dato | Endpoint | Vigencia | Notas |
|---|---|---|---|
| **Afluencia del Metro por línea y hora** | Metro Datos Abiertos, ítem `Afluencia Metro 2026` (xlsx) | 1 de enero–31 de julio de 2026 | 12 líneas. Unas 997.000 entradas por día hábil. La hoja trae una columna final "Total general" por fila, que no debe sumarse junto con las horas. Hay que confirmar la metodología: la afluencia por línea puede contar dos veces a quien transborda. |
| Estaciones y líneas del Metro | `https://utility.arcgis.com/usrsvcs/servers/b97b082ae9b44544b579f9e4d7a97d4c/rest/services/Hosted/ServiciosOpenData_gdb/FeatureServer/1` (estaciones) y `/3` (líneas) | Vigente | 167 estaciones |
| GTFS | Hub del Metro (2025); `github.com/ColombiaTransit/gtfs-medellin`, release del 25 de septiembre de 2026 | 2025–2026 | |
| EnCicla y ciclorrutas | `IDEM/Hosted/Estaciones_EnCicla/FeatureServer/1` (119) y `IDEM/Hosted/Ciclorrutas/FeatureServer/0` (292) | Vigente | |
| Rutas y paradas de transporte público colectivo | `ALC/transporte/VM_Movilidad/MapServer` | Vigente | |
| Aforos vehiculares con coordenadas | `MED/1-023-25-000301/Aforos_Vehiculares.csv` | Por verificar | |
| Velocidad por corredor | `MED/1-023-25-000287/Velocidad_y_tiempo_de_viaje_GT.csv` | Por verificar | Útil para la lente de "presión vial" |
| Víctimas de incidentes viales con coordenadas | `MED/1-023-25-000360/Mede_Victimas_inci.csv` | Por verificar | |
| Pasajeros SITVA (MEData) | `MED/1-023-25-000292/Pasajeros_movilizados.csv` | **Hasta diciembre de 2021** | Usar la afluencia del Metro en su lugar |

### Servicios públicos

| Dato | Endpoint | Vigencia | Valor clave |
|---|---|---|---|
| **Cobertura y suscriptores de acueducto, alcantarillado y aseo por comuna y estrato** | `MED/1-014-26-000256/reporte_de_estratificacion_y_cobertura.csv` | **31/12/2017, 2018 y 2019** | Columnas `servicio, comuna, estrato, suscriptores, cobertura, periodo`. 2019: cobertura de la ciudad 95,3 % (acueducto), 94,0 % (alcantarillado) y 95,5 % (aseo); Palmitas, 19,3 % en acueducto. No cubre energía ni gas. **En uso.** |
| **Suscriptores y consumos de EPM (gran prestador)** | `MED/1-014-26-000261/suscriptores_y_consumos_gran_prestador.csv` | **Dic 2017 – ago 2023**, mensual (el portal dice 2025) | 872.157 suscriptores de acueducto en agosto de 2023, por estrato y uso. **En uso.** |
| **Suscriptores de pequeños prestadores** | `MED/1-014-26-000262/suscriptores_y_consumos_pequenos_prestadores.csv` | **Dic 2017 – sep 2023** | 18 prestadores, 15.292 suscriptores de acueducto; `id_comuna` usa los códigos oficiales (60 San Cristóbal, 70 Altavista…). **En uso.** |
| **Suscriptores de aseo (Emvarias)** | `MED/1-014-26-000260/suscriptores_aseo.csv` | Dic 2017 – ago 2023 | 957.580 suscriptores. **En uso.** |
| **Subsidios y contribuciones** | `MED/1-014-26-000258/...gran_prestador.csv` (EPM), `.../000257/...aseo.csv` (Emvarias), `.../000259/...pequenos_prestadores.csv` | Dic 2017 – ago/sep 2023 | EPM 2022: 150.745 millones en subsidios y 129.169 en contribuciones. **En uso** (EPM y Emvarias). |
| **Tarifas de acueducto y alcantarillado de EPM** | datos.gov.co `nfrm-mmfe`, `municipio='Medellín'` | **Abr 2017 – ago 2026**, mensual | Estrato 1: $1.991,32/m³ de consumo básico; estrato 4: $4.978,29. **En uso.** |
| **Tarifas de gas natural de EPM** | datos.gov.co `ekup-y869` | **Ene 2020 – oct 2026** | Mercado del Valle de Aburrá (la publicación en PDF lo dice; el dataset no trae municipio). **En uso.** |
| **Tarifas de energía de EPM (vigentes)** | Publicación mensual en PDF, enlazada desde `https://www.epm.com.co/clientesyusuarios/energia/tarifas-energia/` (archivos `*_ANT_*.pdf`) | **Ene – sep 2026** | Estrato 1, consumo de subsistencia: $425,51/kWh; costo unitario (estrato 4): $958,38. Estado `declarado`. **En uso.** |
| Tarifas de energía de EPM (datos abiertos) | datos.gov.co `sfcd-b3ey` (y su espejo en MEData `1-061-26-000364`) | **Dic 2016 – dic 2021** | No se usa: termina en 2021 y la publicación mensual trae la tarifa vigente. |
| Tarifas y costos de energía del mercado regulado | datos.gov.co `ytme-6qnu` | 2024 – sep 2025 | **No es Antioquia**: solo trae los mercados de ENEL (Bogotá), EMCALI y CELSIA donde comercializa EPM. No se usa. |
| Tarifas de acueducto, aseo y aguas residuales de Aguas Nacionales EPM | datos.gov.co `29ba-ken5`, `ri3x-4pu5`, `sqeg-ns6a` | 2019–2025 | **Solo Quibdó.** No se usa. |
| Subsidios y contribuciones de EPM (porcentajes) | datos.gov.co `av6t-m6ju` | Gas: oct 2019 – oct 2026; acueducto de Medellín: 2019–2021; energía: 2019–2020 | Porcentajes por estrato. No se usa: las tarifas por estrato ya los traen aplicados. |
| **Registro de estaciones de clasificación y aprovechamiento (ECA)** | datos.gov.co `y97c-tfd9` (Superservicios), `municipio like '%MEDELL%'` | Certificaciones hasta el 22/07/2024 | 142 ECA registradas, 75 en operación, 25.794 t/mes de capacidad. Una fila por certificación: el estado vigente es el de la última. **En uso.** |
| ECAS (Alcaldía) | `MED/1-014-26-000592/ECAS_...csv` | Sin fecha | 50 estaciones, sin fecha y con las tildes perdidas en el propio archivo ("ASOCIACIï¿½N"). Se reemplaza por el registro de la Superservicios. |
| **Organizaciones recicladoras** | `MED/1-014-26-000593/Organizaciones_Recicladoras.csv` | Sin fecha (MEData la fecha en noviembre de 2023) | 31 organizaciones. **En uso.** |
| **Accesos a internet fijo** | CSV del MinTIC en postdata.gov.co (`ACCESOS_INTERNET_FIJO_3_5.csv`, enlazado desde la ficha `fwe6-d4hc`) | **T1 2024 – T1 2026** | 866.296 accesos en Medellín en el primer trimestre de 2026, por segmento (estrato) y tecnología. **En uso.** |
| Cobertura de internet fijo por comuna | No existe un dataset abierto | — | `candidato`: el MinTIC publica por municipio y los operadores no publican su cobertura por barrio. |

**Notas de uso en Servicios públicos (issue #9, 27 sep 2026)**

- **Vigencia real de MEData:** el portal fecha estos archivos en 2025, pero la cobertura por comuna llega al 31/12/2019 y los suscriptores y subsidios a agosto (EPM y Emvarias) o septiembre de 2023 (pequeños prestadores).
- **Cobertura por territorio:** la fuente publica la cobertura por comuna y estrato. La del territorio se reconstruye sumando suscriptores y viviendas (viviendas = suscriptores ÷ cobertura) de sus estratos, así que queda como `derivado`. Por estrato hay celdas por encima de 100 % (hasta 1.300 % en estratos con 3 o 4 viviendas estimadas); por territorio ninguna pasa de 100 %. Una fila trae el punto de miles ("6.544").
- **Consumos de EPM** con coma decimal ("858001,231").
- **Energía:** la página de tarifas de EPM enlaza una publicación por mes del año en curso para el mercado de Antioquia (`_ANT_`); si EPM corrige un mes, la página enlaza el reemplazo. Se lee la tarifa residencial de nivel I con activos de EPM (la de la mayoría de hogares) con `pdftotext`. Los estratos 5 y 6 aparecen en una sola fila.
- **Subsidios por servicio:** en agua y energía los estratos 1 a 3 tienen subsidio en el consumo básico o de subsistencia; en gas, solo los estratos 1 y 2.
- **Internet fijo:** son accesos (conexiones), no hogares. El archivo pesa unos 130 MB y el servidor tarda unos 5 minutos en entregarlo: la ingesta lo guarda en `datos/crudos/` y solo lo vuelve a bajar si cambia de tamaño. El nombre del archivo se lee de la ficha `fwe6-d4hc`, no se fija en el código.

### Territorio, POT y cultura

| Dato | Endpoint | Vigencia | Notas |
|---|---|---|---|
| **Amenazas y zonas de riesgo** | `ALC/ambiente_dllo_sost/VC_Gestion_Riesgo/MapServer`: amenaza por avenidas torrenciales `/0`, inundaciones `/1` y movimientos en masa `/2`; zonas de riesgo `/3`, `/4` y `/5` | POT de 2014, capas actualizadas al 17/07/2026 (`fecha_actualizacion`) | 2.376, 716 y 115 polígonos de amenaza; 305 zonas de alto riesgo no mitigable. Amenaza alta: 2.951 ha por movimientos en masa, 453 por inundaciones y 395 por avenidas torrenciales. **En uso.** |
| Amenaza por movimientos en masa, inundaciones y avenidas torrenciales (mapas protocolizados) | `ALC/ordenamiento_ter/VM_05_...`, `VM_06_...`, `VM_07_...`, `VM_08_...` | 2014 | **`VM_06_Amenazas_Inundaciones` ya no trae la capa de inundaciones**: solo la de avenidas torrenciales. Se usa `VC_Gestion_Riesgo`. |
| **Usos generales del suelo urbano** | `ALC/ordenamiento_ter/VM_POT48_Tematicos/MapServer/5` | Adoptado el 17/12/2014 | 25.446 polígonos. La misma capa en `VM_23_Uso_General_Suelo_Urbano/MapServer/2` **responde 400 cuando se le piden geometrías**. **En uso.** |
| **Tratamientos urbanos y altura normativa** | `ALC/ordenamiento_ter/VM_22_Tratamientos_Urbanos/MapServer/0` (`alturanormativa` va en la misma capa; `VM_28_Altura_Normativa/1` es igual) | Adoptado el 17/12/2014 | 386 polígonos, 14 tratamientos. Fechas de tipo `DateOnly`: llegan como texto ISO, no en milisegundos. **En uso.** |
| **Capa "POT 2025"** | `ALC/ordenamiento_ter/VM_34_POT_2025/MapServer` | — | Según su descripción, es un **mapa provisional** con las capas del Acuerdo 48 de 2014 que no se actualizan en la revisión de mediano plazo de 2025; se reestructurará cuando esa revisión se adopte. El POT vigente sigue siendo el Acuerdo 48 de 2014. **En uso** (estado `declarado`). |
| **Equipamientos del POT** | `IDEM/DISTRITO_MEDELLIN_POT/MapServer/7` | Capa vigente | 2.139, en 22 componentes. **En uso** (también en el gemelo, capa Servicios). |
| **Bienes de interés cultural** | `ALC/cultura/VC_BIC_Patrimonial/MapServer/0` | Listado del POT, 17/12/2014 | 397 polígonos: 389 arquitectónicos, 5 arqueológicos y 3 urbanísticos ("Arquitectonico" sin tilde en 2). 369 están en La Candelaria. **En uso.** |
| **Red de bibliotecas** | `ALC/cultura/VM_Red_Bibliotecas/MapServer/0` | Red vigente | 32. **En uso.** |
| **Sedes educativas** | `ALC/educacion/VC_Sedes/MapServer/0` | Directorio 2024 (`vigencia`) | 779 sedes activas: 423 oficiales y 356 no oficiales. **En uso.** |
| **Espacio verde urbano** | `ALC/ambiente_dllo_sost/VA_SistemaArbolUrbano_Base/MapServer/5` | Inventario de 2019 (AMVA y Universidad Nacional; ortofotos de 2016 a 2019) | 194.916 polígonos de **todo el Valle de Aburrá**, sin campo de municipio; 3.737 ha en Medellín. Con geometría es muy lento: se leen los atributos `area_ha`, `coord_x_mb` y `coord_y_mb` (EPSG:3116, MAGNA-SIRGAS Bogotá) y se ubican en los límites de la capa `/4` pedidos en ese sistema. Solo suelo urbano. **En uso.** |
| **Espacio público efectivo** | `ALC/ordenamiento_ter/VM_Espacio_Publico/MapServer/0` | Inventario 2023 (lo dice la descripción de la capa) | 1.507 polígonos con `cod_comuna` (dos códigos `SN` sin comuna); 1.296 ha. **En uso.** |
| Coberturas terrestres 2021 | `ALC/ambiente_dllo_sost/VM_CoberturasTerrestres2021` | 2021 | No se usa. |

**Notas de uso en Territorio y cultura (issue #10, 30 sep 2026)**

- **IPv6:** `www.medellin.gov.co` publica una dirección IPv6 que a ratos no responde. `curl` pasa a IPv4 enseguida, pero `urllib` esperaba el tiempo máximo en cada intento. `lago.py` prueba primero las direcciones IPv4.
- **Generalización:** con `maxAllowableOffset` cada página de estas capas tarda unos 90 s en vez de 4 s. Las geometrías se piden completas y se simplifican en la ingesta (~1 m).
- **Cruces:** las hectáreas por territorio recortan los polígonos con los límites del gemelo; las construcciones, bienes, sedes y equipamientos se asignan por su punto (o el punto representativo de su polígono). Todo lo recortado o dividido por población es `derivado`.

### Ambiente y satélite

`SIATA` = `https://geoportal.siata.gov.co/fastgeoapi`. El catálogo de capas está en `SIATA/geodata/geodataJson/`
y el esquema completo de la API en `SIATA/openapi.json`. **El SIATA no envía cabeceras CORS**: el navegador no
puede llamarlo directo, así que la app lo consulta por el proxy `/api/ambiente/<recurso>`, que cachea 10 minutos
y conserva la última copia (ver `src/app/api/ambiente`).

| Dato | Endpoint | Vigencia | Notas |
|---|---|---|---|
| **PM2.5 e índice ICA, promedio de 24 h** | `SIATA/geodata/geodataJson/1/pm25_minio` | **En vivo** | 23 estaciones, 12 en Medellín. Trae `PM25_24H_prom`, `ICA_24H_prom`, la ventana `fechaInicio`–`fechaFin` y el `color` oficial del ICA |
| Pluviómetros | `SIATA/geodata/geodataJson/3/pluvios_v2` | En vivo | 183 (103 en Medellín). La capa solo publica `acumulado_15min`: el acumulado de 24 h o de 30 días hay que pedirlo por estación |
| Niveles de quebradas | `SIATA/geodata/geodataJson/2/niveles` | En vivo | 165. `nivelActual` puede ser negativo o el texto "No hay datos en el tiempo consultado"; **la capa no publica la unidad** |
| Temperatura, viento y humedad | `SIATA/geodata/geodataJson/3/tempVient` | En vivo | 45. No trae la hora de cada medición: la vigencia es la hora de la lectura |
| Ruido | `SIATA/geodata/geodataJson/1/ruido_oficial` | Semanal | 8 estaciones, con promedio de 7 días, de día y de noche |
| Series por estación | `SIATA/geodata/geographJson/{equipo}/{variable}/{código}` | En vivo | `1/pm25_30d` (PM2.5 diario, 30 días), `2/pluvio_30d` (lluvia diaria y acumulada) y `2/pluvio_24h` (cada 5 minutos, con `Ptt_Total_Acum_P1`). Equipos en `SIATA/geodata/teams/` |
| Alertas activas | `SIATA/alerts/active/citizen` | En vivo | Lista (vacía si no hay alertas) con `title`, `description`, `start_date` y `end_date`. **No usar `SIATA/alerts/`**: devuelve también avisos de prueba con texto *lorem ipsum* |
| Mapas de ruido del AMVA | `IDEM/Hosted/AMVA_GESTION_DEL_RUIDO/FeatureServer` | Estudio | Isófonas cada 5 dB(A) desde 35. Capas 11/12 automotor, 21/22 aeropuerto, 23/24 metro, 25/26 industria y **27/28 total día/noche** (unos 8.400 polígonos cada una) |
| Luces nocturnas VIIRS | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_At_Sensor_Radiance/default/{fecha}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png` | Diaria | Con CORS. Solo hay teselas hasta el nivel 8 (~2 km por píxel): se lee a escala del valle, no de barrio |
| Sentinel-2 sin nubes | `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg` | 2023 | Con CORS. Licencia **CC BY-NC-SA**: solo uso no comercial |
| Sismos | USGS FDSN `https://earthquake.usgs.gov/fdsnws/event/1/query` | En vivo | Con CORS. `latitude`/`longitude`/`maxradiuskm` para el radio y `minmagnitude`; 1.533 eventos de magnitud 4 o más a 300 km desde 2000. La web del SGC devuelve 403 a clientes automáticos |
| **Clima actual (cabecera)** | `https://api.open-meteo.com/v1/forecast?latitude=6.2476&longitude=-75.5686&current=…&timezone=America/Bogota` | **En vivo**, cada 15 min | Sin llave y con CORS, pero se pide por el proxy (`/api/ambiente/clima`, caché de 15 minutos) para que todos los visitantes compartan una lectura. Es la **salida de modelos meteorológicos** para la celda que contiene el punto (responde 6,221° N, 75,552° O, a 1.486 m), no una estación: la cabecera lo dice. Trae temperatura, sensación térmica, humedad, viento a 10 m, precipitación de los 15 minutos previos y el código de tiempo de la OMM. Estado `observado` (dato abierto consultado en vivo). **En uso** (issue #16) |

**No usar** `siata.gov.co/EntregaData1/*.json`: aunque sigue en línea, el histórico termina el 31 de julio de 2024 y el archivo "Last" el 4 de septiembre de 2024.

**Correcciones al probar los endpoints (26 de septiembre de 2026)**

- **Valor centinela:** el SIATA marca una lectura sin dato con `-999` (por ejemplo, una estación de ruido fuera de servicio). La app lo cambia por "sin dato" en toda lectura en vivo y no lo promedia.
- La ruta de las series era `geographJson/1/pm25_30d/`; la buena es `geodata/geographJson/1/pm25_30d/{código}`, con el código de la estación. Sin él responde 404.
- Los días sin medición llegan como `null` dentro de `PM25_Diario`, así que la gráfica los deja como hueco y no como caída a cero.
- El campo del municipio cambia de nombre en cada capa (`Municipio`, `municipio`, `ubicacion`, `Ciudad`) y viene con tildes y espacios inconsistentes ("Medellín ", "Medellin").
- Las isófonas del AMVA vienen a 4 m: sin generalizar pesan más de 12 MB por capa. Se unen por banda de dB(A), se recortan al límite del Distrito y se simplifican a ~67 m; quedan en unos 735 KB, con el área de cada banda en hectáreas.

### Escucha social

| Dato | Endpoint | Notas |
|---|---|---|
| Visitas en Wikipedia | `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/all-access/user/Medell%C3%ADn/monthly/...` | Agosto de 2026: 19.552 visitas |
| Cobertura de prensa | GDELT DOC API | Devuelve 429 si se consulta seguido; hay que cachear en el servidor |

### Notas de uso en la sección Escucha social (issue #13, 2 oct 2026)

- **Pageviews:** se piden con `agent=user` (sin bots identificados) y se suman las vistas de las redirecciones del artículo: quien llega por «Popular (Medellín)» queda registrado con ese título. Las redirecciones aportan del 1 al 12 % según el artículo (2 % en el de Medellín; 12 % en el de Popular).
- **Títulos de los territorios:** el nombre del límite no sirve como título ("Popular", "Santa Cruz", "San Javier" o "Altavista" son desambiguaciones). Los 21 títulos están en `pull_escucha.py` y la ingesta falla si alguno deja de existir o pasa a ser una desambiguación.
- **Wikimedia limita a los clientes sin User-Agent propio** (respondió 429 a la segunda consulta con un User-Agent genérico): se usa uno con el repositorio como contacto, como pide su política.
- **El uso de Wikipedia cae:** la Wikipedia en español tuvo un 20,5 % menos vistas de personas entre oct 2025 y sep 2026 que en los 12 meses anteriores. Por eso cada variación se da también por millón de vistas del sitio.
- **GDELT busca en el texto completo:** de 250 artículos recientes que "nombran a Medellín", solo 42 lo hacían en el titular; el resto la menciona de pasada (la ciudad de la agencia, un menú del sitio, notas de farándula). El operador `repeat3:` (la palabra 3 veces) es demasiado estricto: deja cerca de un artículo por día. El filtro de ruido se aplica al titular.
- **GDELT responde 429 al azar**, no solo cuando se le consulta seguido: hubo consultas rechazadas tras 7 minutos sin preguntar nada y otras aceptadas 25 segundos después de un rechazo. La ingesta reintenta con esperas de hasta 5 minutos.
- **Huecos de GDELT:** en la ventana del 5 de julio al 2 de octubre de 2026 no publica datos del 14 al 19 de septiembre ni del 26 de septiembre (tampoco su total de artículos monitoreados): es una falla de la fuente, no días sin noticias.
- **El GKG de GDELT no tiene un tema de deporte**, y sus temas se asignan sobre el texto completo, que en estos artículos casi nunca trata de Medellín. Los temas se clasifican por palabras clave del titular.

## 5. Discrepancias y lectura responsable

1. **Población.** La proyección de Planeación por comuna suma 2.787.912 habitantes en 2026, y el DANE vigente (PPED, julio de 2025) da 2.526.795 (−9,4 %; con la serie post-COVID anterior eran 2.650.662). Se propone usar el total del DANE como cifra oficial y la serie de Planeación solo como proporción para repartirlo por comuna, marcando el resultado como `derivado`.
2. **Homicidios 2023.** El SISC registra 343, pero su serie se corta el 29 de noviembre; la Policía registra 359 para el año completo. Cada gráfica debe usar una sola fuente.
3. **Fechas de MEData.** El portal marca varios datasets como actualizados en 2025, pero los datos llegan hasta 2021–2023. La vigencia debe calcularse a partir del dato mismo, no de los metadatos.
4. **Afluencia del Metro.** No equivale a viajes únicos. No debe compararse con la cifra de "1,16 M viajes SITVA/día" que mostraba el Panorama antes del lago (issue #0).
5. **Cifras actuales de la app.** El desempleo "6,5 %, último trimestre de 2024" ya tiene dato más reciente: **6,97 % en mayo–julio de 2026**.

## 6. Arquitectura propuesta

- `ingesta/pull_<tema>.py`: descarga, normaliza y escribe `public/data/lago/<tema>.json` con el contrato de §1, incluido el campo `probado` con la fecha de la prueba.
- `ingesta/verificar.py`: comprueba esquemas, rangos y vigencias antes de cada despliegue.
- **Datos en vivo** del SIATA, el clima y los sismos: una ruta de Next.js que actúe como proxy con caché corta. El SIATA no envía cabeceras CORS, así que no se puede consultar directo desde el navegador.
- **Edificios**: construir PMTiles con `tippecanoe` a partir del catastro y cargarlos en MapLibre con el protocolo `pmtiles`. Un GeoJSON de un millón de polígonos no es viable en el navegador.
- **Lentes del gemelo**:
  - Energía: subestaciones y redes.
  - Densificación: pisos catastrales frente a la altura normativa.
  - Presión vial: aforos, velocidad por corredor y siniestros.
  - Riesgo: amenazas del POT y niveles del SIATA en vivo.
