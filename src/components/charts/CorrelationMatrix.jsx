'use client';

import { Fragment, useState } from 'react';
import { diverging, divergingColor } from './tokens';

// Sobre un fondo ya claro el número va en negro; si no, en blanco. Los umbrales salen de calcular el contraste contra la
// mezcla de divergingColor: con blanco y negro puros todas las celdas llegan a 4,5:1 (WCAG AA); con la tinta y el papel
// de la paleta, las de intensidad media no llegaban. El naranja a media intensidad es más oscuro que el cian, así que
// cambia de color más tarde.
const colorTexto = (valor) => (Math.min(1, Math.abs(valor)) >= (valor < 0 ? 0.44 : 0.53) ? '#000' : '#fff');

/**
 * Matriz simétrica de coeficientes entre −1 y +1. Cada celda es su propio botón: muestra el coeficiente, se colorea con
 * la rampa divergente (tono = signo, intensidad = magnitud) y al pasar el cursor o enfocarla llena la franja de lectura
 * de arriba con el par, su coeficiente, su n y el periodo de cada métrica. Las columnas se nombran con el número de su
 * fila para que la matriz quepa. Incluye una vista de tabla con todos los pares.
 *
 * metricas: [{ id, corto, anio, grupo }]     celdas[i][j]: { rho, n } | null (diagonal)
 * seleccion: [id de la fila, id de la columna]     total: unidades posibles (una celda con menos lleva una marca)
 */
export default function CorrelationMatrix({ metricas, celdas, total, seleccion, onSelect, formatValue, tituloGrupo = {}, accion }) {
  const [tabla, setTabla] = useState(false);
  const [hover, setHover] = useState(null);
  const indice = (id) => metricas.findIndex((m) => m.id === id);
  const elegido = seleccion ? [indice(seleccion[0]), indice(seleccion[1])] : [-1, -1];
  const enMatriz = elegido[0] >= 0 && elegido[1] >= 0;
  const [fila, columna] = hover ?? (enMatriz ? elegido : [-1, -1]);
  const par = fila >= 0 ? celdas[fila][columna] : null;
  const esElegida = (i, j) => enMatriz && ((i === elegido[0] && j === elegido[1]) || (i === elegido[1] && j === elegido[0]));
  const nombre = (m) => `${m.corto} (${m.anio})`;
  // Entre un tema y el siguiente va una pista angosta vacía, en filas y en columnas: cada celda se ubica por su posición.
  const nuevoGrupo = (k) => k > 0 && metricas[k - 1].grupo !== metricas[k].grupo;
  const separadores = metricas.map((_, k) => metricas.slice(0, k + 1).filter((__, q) => nuevoGrupo(q)).length);
  const pista = (k) => k + 2 + separadores[k];
  const pistas = (medida) => metricas.map((_, k) => `${nuevoGrupo(k) ? 'var(--separador) ' : ''}${medida}`).join(' ');
  const rejilla = {
    gridTemplateColumns: `var(--rotulo) ${pistas('minmax(var(--celda), 1fr)')}`,
    gridTemplateRows: `22px ${pistas('minmax(var(--celda), auto)')}`
  };
  const pares = metricas.flatMap((a, i) => metricas.slice(i + 1).map((b, k) => ({ a, b, i, j: i + 1 + k, ...celdas[i][i + 1 + k] })));

  return (
    <div className="matriz-correlacion">
      <div className="matriz-barra">
        <p className="matriz-lectura" aria-live="polite">
          {par ? (
            <>
              <b>
                {nombre(metricas[fila])} × {nombre(metricas[columna])}
              </b>
              <span>
                ρ = <strong>{formatValue(par.rho)}</strong> · n = <strong>{par.n}</strong>
                {par.n < total && ` de ${total}`}
              </span>
            </>
          ) : (
            <span>Pasa por una celda para leer el par; tócala para elegirlo.</span>
          )}
        </p>
        <button className="table-toggle" onClick={() => setTabla((v) => !v)}>
          {tabla ? 'Ver como matriz' : 'Ver como tabla'}
        </button>
      </div>
      {tabla ? (
        <div className="tabla-scroll matriz-tabla">
          <table className="chart-table">
            <thead>
              <tr>
                <th>Métrica</th>
                <th>Periodo</th>
                <th>Métrica</th>
                <th>Periodo</th>
                <th>ρ</th>
                <th>n</th>
              </tr>
            </thead>
            <tbody>
              {pares.map((p) => (
                <tr key={`${p.a.id}|${p.b.id}`} className={esElegida(p.j, p.i) ? 'activo' : ''}>
                  <td>
                    <button onClick={() => onSelect(p.b, p.a)}>
                      {p.i + 1}. {p.a.corto}
                    </button>
                  </td>
                  <td>{p.a.anio}</td>
                  <td>
                    {p.j + 1}. {p.b.corto}
                  </td>
                  <td>{p.b.anio}</td>
                  <td>{formatValue(p.rho)}</td>
                  <td>{p.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="matriz-scroll">
          <div className="matriz" style={rejilla} onMouseLeave={() => setHover(null)}>
            <span className="matriz-esquina" />
            {metricas.map((m, j) => (
              <span
                key={m.id}
                className={`matriz-columna ${j === columna ? 'activa' : ''}`}
                style={{ gridColumn: pista(j), gridRow: 1 }}
                title={nombre(m)}
              >
                {j + 1}
              </span>
            ))}
            {metricas.map((a, i) => (
              <Fragment key={a.id}>
                <span
                  className={`matriz-fila ${i === fila ? 'activa' : ''}`}
                  style={{ gridColumn: 1, gridRow: pista(i) }}
                  title={tituloGrupo[a.grupo] ? `${tituloGrupo[a.grupo]} · ${nombre(a)}` : nombre(a)}
                >
                  <i>{i + 1}</i>
                  {a.corto}
                </span>
                {metricas.map((b, j) => {
                  if (i === j) return null;
                  const { rho, n: unidades } = celdas[i][j];
                  const lugar = { gridColumn: pista(j), gridRow: pista(i) };
                  return (
                    <button
                      key={b.id}
                      className={`matriz-celda ${unidades < total ? 'parcial' : ''} ${esElegida(i, j) ? 'elegida' : ''}`}
                      style={rho == null ? lugar : { ...lugar, background: divergingColor(rho), color: colorTexto(rho) }}
                      aria-label={`${nombre(a)} con ${nombre(b)}: coeficiente ${formatValue(rho)}, ${unidades} territorios`}
                      aria-pressed={esElegida(i, j)}
                      onMouseEnter={() => setHover([i, j])}
                      onFocus={() => setHover([i, j])}
                      onBlur={() => setHover(null)}
                      onClick={() => onSelect(a, b)}
                    >
                      {formatValue(rho)}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
      <div className="matriz-pie">
        <div className="matriz-leyenda">
          <span>−1</span>
          <i style={{ background: `linear-gradient(90deg, ${diverging.negative}, ${diverging.neutral}, ${diverging.positive})` }} />
          <span>+1</span>
          <span className="matriz-marca">
            <i className="parcial" /> calculada con menos de {total} territorios
          </span>
        </div>
        {accion}
      </div>
    </div>
  );
}
