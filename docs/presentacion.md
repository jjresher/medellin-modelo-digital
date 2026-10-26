# Presentación en clase · guion

Corta, con el sistema abierto en pantalla y sin diapositivas. Responde las tres preguntas del enunciado. Cada paso dice qué abrir.

## 1. ¿Qué herramienta descartaron que casi eligen?

**Abrir:** `exploracion/observable/captura-observable.png` al lado de la sección **Preguntas** de la app.

- **Observable Framework.** Con la misma tabla armó el ranking y el mapa por comuna en una página Markdown, como sitio estático de 1,2 MB. Es lo más parecido a lo que necesitábamos.
- **Por qué no quedó:**
  - No maneja el gemelo 3D (1 millón de construcciones en PMTiles).
  - Su última versión es de abril de 2026.
  - El mapa salió como un rectángulo hasta corregir la proyección.
- **Streamlit** funcionó, pero ordenó las barras por nombre y pidió un servidor encendido y 470 MB de dependencias.

## 2. ¿Qué decidimos no mostrar?

**Abrir:** Seguridad → mapa por barrio (barrios grises: «Menos de 5: no se publica»), y después Fuentes → buscar «F020» → columna «Personas y protección».

- Los registros por víctima del SISC (F020–F027) y de víctimas viales (F065): la fuente trae sexo, edad, ocupación y coordenadas. El 93 % de los homicidios de 2019–2023 es único si se cruzan año, barrio, sexo y edad (`exploracion/k_anonimato_sisc.py`).
- Los conteos de un barrio con menos de 5 casos.
- El punto exacto de cada siniestro vial: el mapa de calor usa celdas de ~110 m.
- Los titulares de prensa que cuentan algo que le pasó a una persona.
- Mostrar la terminal: `scripts/prueba-terminal.sh <enlace>` devuelve 404 para los crudos y no encuentra campos de persona.

## 3. ¿Qué tendría que cambiar para que la respuesta fuera otra?

- **En la fuente:**
  - Si el SIATA publicara una serie histórica del ICA con estaciones asignadas a comunas, la pregunta 1 de la entrega 1 dejaría de estar pendiente.
  - Si el DANE publicara población por comuna, la tasa de homicidios dejaría de ser PROXY.
  - Si la OIME publicara precios de cierre, la vivienda dejaría de ser PROXY.
- **En la herramienta:** si Observable Framework soportara capas vectoriales grandes (PMTiles) y siguiera publicando versiones, lo habríamos elegido para todo menos el gemelo.
- **En nuestro sistema:** si quisiéramos mostrar el perfil de las víctimas (sexo y edad por comuna), habría que pasar a una compuerta en el servidor o a privacidad diferencial. Hoy decidimos no publicarlo.

## Cifra para la auditoría al azar

Cualquier tarjeta → «Ver fuente» → fila de la fuente con su ID, licencia y enlace a la fuente original.
