// Paleta de las gráficas: mismos tokens Monokai que el resto de la app (globals.css), para que un
// dashboard con datos no se vea distinto de las tarjetas y el gemelo. Colores computados, no al ojo:
// cada serie usa un color de acento fijo (nunca dos acentos saturados uno junto al otro en una misma
// gráfica), y las comparaciones "actual vs anterior" usan color contra gris, no dos acentos.
export const ink = '#272822';
export const surface = '#30312b';
export const line = '#56574d';
export const textPrimary = '#f8f8f2';
export const textSecondary = '#b9b9ac';
export const textMuted = '#898a7d';
export const grid = '#454640';

export const accent = { pink: '#f92672', green: '#a6e22e', cyan: '#66d9ef', yellow: '#e6db74', orange: '#fd971f', purple: '#ae81ff' };

// Rampa secuencial de magnitud para los coropléticos (mismo criterio que indexRamp del gemelo, issue #2):
// un solo tono, de gris oscuro (sin datos / mínimo) a un acento saturado (máximo). No es una paleta
// categórica, así que no le aplica el límite de "3 series en todos los pares" del validador.
export const sequential = (huePrincipal = accent.pink) => [[0, '#3a3b33'], [50, accent.purple], [100, huePrincipal]];
