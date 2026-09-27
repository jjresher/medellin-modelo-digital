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
| Municipio | Presupuesto, inversión por comuna, contratación, Concejo | MEData, SECOP II |
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
| Tarifas de energía EPM | datos.gov.co `ytme-6qnu` | Julio de 2026 | |
| Subsidios y contribuciones EPM | datos.gov.co `av6t-m6ju` | Septiembre de 2026 | |
| Estaciones de carga eléctrica EPM | datos.gov.co `qqm3-dw2u`, `bff2-84yc` | 2025 | |

### Gente

| Dato | Endpoint | Vigencia | Valor clave |
|---|---|---|---|
| **Proyección municipal DANE (post-COVID)** | `https://www.dane.gov.co/files/censo2018/proyecciones-de-poblacion/Municipal/DCD-area-proypoblacion-Mun-2020-2035-ActPostCOVID-19.xlsx` | 2020–2035 | **2026: 2.650.662** (cabecera 2.609.841, rural 40.821) |
| Proyección por comuna y corregimiento (DAP) | `ALC/mapas_nacionales/VC_Distribucion_Poblacional/MapServer/1`; hogares en `/2`, viviendas en `/3`, estrato en `/0` | 2018–2030, elaborada en diciembre de 2018 | Suma 2026: **2.787.912** (ver §5) |
| IMCV por comuna | `ALC/estadisticas/VC_Indicadores_ECV/MapServer/2` | 2014–2024 (sin 2020) | Popular 2024: 35,07 |
| Pobreza multidimensional por comuna | `.../VC_Indicadores_ECV/MapServer/1` | 2014–2024 | |
| IDH por comuna | `.../MapServer/3` | 2014–2021 | |
| Desempleo y PIB por comuna | `.../MapServer/4` y `/6` | 2014–2022 | |
| Microdatos de la ECV | `MED/1-002-09-000040/encuesta_calidad_vida.csv` | Por verificar | 367 MB |
| Eventos de salud geográficos | `ALC/salud_protec_soc/VC_Datos_Enfermedades` | El servicio dice "2008-vigente"; no se verificó el corte | Dengue, mortalidad, natalidad, intento de suicidio, violencia de género |

### Economía y vivienda

| Dato | Endpoint | Vigencia | Valor clave |
|---|---|---|---|
| **Mercado laboral, Medellín A.M.** | `https://www.dane.gov.co/files/operaciones/GEIH/anex-GEIH-<mes><año>.xlsx`, hoja `Total 23 ciudades A.M. Trim` | Mayo–julio de 2026 | **Desocupación 6,97 %**, ocupación 62,66 %, participación 67,35 % |
| **Oferta inmobiliaria (OIME)** | `ALC/vivienda_ciudad_terri/VM_Oferta_Comercial_Oime/MapServer/1` | 2023 | 28.425 anuncios (13.877 de venta y 14.547 de arriendo) con precio, área, estrato y coordenadas. Permite derivar el precio por m² por comuna. |
| Valor del suelo por zona | `IDEM/MEDELLIN_Uso_y_Valores_Suelo/MapServer/0` | Vigente | 276 zonas con `VALOR_M2` |
| Licencias urbanísticas | `ALC/vivienda_ciudad_terri/VM_Licencias/MapServer/0`; histórico en MEData `1-002-26-000413` | Por verificar | |
| Establecimientos comerciales | `ALC/ccio_ind_turism/VC_Act_Comercial_Empresarial/MapServer/0` | Por verificar | 443.241 registros |
| Estructura empresarial por comuna | datos.gov.co `pb3w-3vmc` (Cámara de Comercio) | 2023 | |
| Facturación del impuesto predial por comuna | `MED/1-016-12-000302/...csv` | Hasta 2023 | |

### Turismo

| Dato | Endpoint | Vigencia | Valor clave |
|---|---|---|---|
| **Extranjeros no residentes en Medellín** | datos.gov.co `7wm8-w5ad` (MinCIT), filtro `ciudad='Medellín'` | Junio de 2026 | **2025: 1.143.678**; 2024: 1.048.471; enero–junio de 2026: 551.226 |
| **Pasajeros del aeropuerto JMC** | datos.gov.co `gb6w-ynu4` (Aerocivil), `origen='MDE' or destino='MDE'` | Junio de 2026 | **2025: 13.261.826** |
| Ocupación hotelera, museos y sitios de interés | MEData, tema Comercio, Industria y Turismo | **Hasta octubre de 2023** | Sirve solo como serie histórica |
| Atractivos turísticos y puntos de información | `ALC/ccio_ind_turism/VC_Turismo/MapServer/0` y `/1` | Vigente | 92 atractivos |

### Municipio

| Dato | Endpoint | Vigencia | Notas |
|---|---|---|---|
| Inversión pública por comuna | `ALC/hacienda_credi_publ/VM_Inversion_Publica/MapServer/{0..16}` | 2008–2024 | Popular 2024: $521.337 millones |
| Ingresos y gastos de inversión | `MED/1-016-12-000238/comportamiento_de_ingresos.csv` y `.../000236/...gastos_de_inversion.csv` | Falta confirmar a qué vigencia corresponden | |
| Contratación (SECOP II) | datos.gov.co `jbjy-vk9h`, entidad `DISTRITO ESPECIAL DE CIENCIA TECNOLOGIA E INNOVACION DE MEDELLIN` | Continua | 14.518 contratos del Distrito central, más sus entidades descentralizadas |
| Acuerdos y proyectos del Concejo | datos.gov.co `9smt-mgt4`, `sqkr-77ej` | Julio de 2026 | |

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

Tasa de homicidios derivada con la población del DANE: **11,81 por 100.000 habitantes en 2024** y **12,64 en 2025**.

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

| Dato | Endpoint | Vigencia | Notas |
|---|---|---|---|
| Cobertura y suscriptores de acueducto, alcantarillado y aseo por comuna y estrato | `MED/1-014-26-000256/reporte_de_estratificacion_y_cobertura.csv` | Hasta el 31/12/2019 | Columnas `servicio, comuna, estrato, suscriptores, cobertura, periodo`. Es el único cruce por comuna y estrato que se encontró; no cubre energía ni gas. |
| Suscriptores y consumos de acueducto, por gran prestador y por pequeños prestadores | MEData, tema Vivienda, Ciudad y Territorio (`Suscriptores y consumos gran prestador`, `...pequeños prestadores`, `Suscriptores aseo`) | Por verificar | El portal declara 2025; falta confirmar el corte real del dato, como en el resto de MEData (ver [§5](#5-discrepancias-y-lectura-responsable)). |
| Tarifas de energía y de gas de EPM | datos.gov.co `ytme-6qnu` (energía), `ekup-y869` (gas) | 2025–2026 | Mismos datasets que en [Energía e infraestructura](#energía-e-infraestructura-equivale-a-la-lente-de-energía-de-lima); no repetir la ingesta, solo reutilizarlos aquí. |
| Subsidios y contribuciones de servicios públicos domiciliarios | datos.gov.co `av6t-m6ju` | Septiembre de 2026 | Energía, gas, acueducto y alcantarillado en un mismo dataset |
| Tarifas de acueducto, aseo y aguas residuales | datos.gov.co, `29ba-ken5`, `ri3x-4pu5`, `sqeg-ns6a` (Aguas Nacionales EPM) | 2025 | Aguas Nacionales EPM opera corregimientos y municipios vecinos, no el acueducto central de Medellín; verificar cobertura real antes de usarlo como el dato de la ciudad. |
| Estaciones de clasificación y aprovechamiento (ECAS) y organizaciones recicladoras | MEData, tema Vivienda, Ciudad y Territorio | Por verificar | |
| Cobertura de internet fijo por comuna | No se encontró un dataset abierto | — | `candidato`: ni el MinTIC ni los operadores publican cobertura de internet fija a nivel de comuna para Medellín. |

### Territorio, POT y cultura

| Dato | Endpoint | Notas |
|---|---|---|
| Amenaza por movimientos en masa | `ALC/ordenamiento_ter/VM_05_Amenazas_Movimientos_Masa/MapServer/2` | 2.376 polígonos |
| Inundaciones, avenidas torrenciales y zonas de alto riesgo no mitigable | `VM_06_...`, `VM_07_...`, `VM_08_...` | Lente de riesgo |
| Altura normativa | `VM_28_Altura_Normativa/MapServer/1` | 386 polígonos. Permite comparar la altura permitida con la construida, que es la lente de densificación. |
| Tratamientos urbanos, usos del suelo, densidad e índice de construcción | `VM_22` a `VM_27` | |
| Capa "POT 2025" | `VM_34_POT_2025` | Hay que confirmar su estado normativo frente al Acuerdo 48 de 2014 |
| Equipamientos del POT | `IDEM/DISTRITO_MEDELLIN_POT/MapServer/7` | 2.139 |
| Bienes de interés cultural | `ALC/cultura/VC_BIC_Patrimonial/MapServer/0` | 397 |
| Red de bibliotecas | `ALC/cultura/VM_Red_Bibliotecas/MapServer/0` | 32 |
| Sedes educativas | `ALC/educacion/VC_Sedes/MapServer/0` | 779 |
| Espacio verde urbano | `ALC/ambiente_dllo_sost/VA_SistemaArbolUrbano_Base/MapServer/5` | 194.916 polígonos |
| Coberturas terrestres 2021 | `ALC/ambiente_dllo_sost/VM_CoberturasTerrestres2021` | |

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
| Clima actual | Open-Meteo | En vivo | Sin llave |

**No usar** `siata.gov.co/EntregaData1/*.json`: aunque sigue en línea, el histórico termina el 31 de julio de 2024 y el archivo "Last" el 4 de septiembre de 2024.

**Correcciones al probar los endpoints (26 de septiembre de 2026)**

- La ruta de las series era `geographJson/1/pm25_30d/`; la buena es `geodata/geographJson/1/pm25_30d/{código}`, con el código de la estación. Sin él responde 404.
- Los días sin medición llegan como `null` dentro de `PM25_Diario`, así que la gráfica los deja como hueco y no como caída a cero.
- El campo del municipio cambia de nombre en cada capa (`Municipio`, `municipio`, `ubicacion`, `Ciudad`) y viene con tildes y espacios inconsistentes ("Medellín ", "Medellin").
- Las isófonas del AMVA vienen a 4 m: sin generalizar pesan más de 12 MB por capa. Se unen por banda de dB(A), se recortan al límite del Distrito y se simplifican a ~67 m; quedan en unos 735 KB, con el área de cada banda en hectáreas.

### Escucha social

| Dato | Endpoint | Notas |
|---|---|---|
| Visitas en Wikipedia | `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/all-access/user/Medell%C3%ADn/monthly/...` | Agosto de 2026: 19.552 visitas |
| Cobertura de prensa | GDELT DOC API | Devuelve 429 si se consulta seguido; hay que cachear en el servidor |

## 5. Discrepancias y lectura responsable

1. **Población.** La proyección de Planeación por comuna suma 2.787.912 habitantes en 2026, y el DANE post-COVID da 2.650.662 (−4,9 %). Se propone usar el total del DANE como cifra oficial y la serie de Planeación solo como proporción para repartirlo por comuna, marcando el resultado como `derivado`.
2. **Homicidios 2023.** El SISC registra 343, pero su serie se corta el 29 de noviembre; la Policía registra 359 para el año completo. Cada gráfica debe usar una sola fuente.
3. **Fechas de MEData.** El portal marca varios datasets como actualizados en 2025, pero los datos llegan hasta 2021–2023. La vigencia debe calcularse a partir del dato mismo, no de los metadatos.
4. **Afluencia del Metro.** No equivale a viajes únicos. No debe compararse con la cifra de "1,16 M viajes SITVA/día" que muestra hoy el Panorama.
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
