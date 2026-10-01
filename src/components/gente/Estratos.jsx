'use client';

import { useState } from 'react';

// Rampa secuencial de un solo tono (morado de la app), de oscuro a claro: el estrato es ordinal, no categórico.
export const RAMPA_ESTRATO = ['#4b3f6b', '#62508f', '#7b62b4', '#9572da', '#ae81ff', '#cdb2ff'];
const NOMBRES = ['Bajo-bajo', 'Bajo', 'Medio-bajo', 'Medio', 'Medio-alto', 'Alto'];
const pct = (v) => `${Number(v).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

/** filas: [{ nombre, valores: [% estrato 1..6] }] — cada fila suma ~100 %. */
export default function Estratos({ filas }) {
  const [hover, setHover] = useState(null);
  const [tabla, setTabla] = useState(false);
  return (
    <div className="estratos">
      <div className="card-controls">
        <div className="chart-legend">
          {NOMBRES.map((n, i) => (
            <span key={n}>
              <i className="cuadro" style={{ background: RAMPA_ESTRATO[i] }} />
              {i + 1} · {n}
            </span>
          ))}
        </div>
        <button className="table-toggle" onClick={() => setTabla((v) => !v)}>
          {tabla ? 'Ver como gráfica' : 'Ver como tabla'}
        </button>
      </div>
      {tabla ? (
        <table className="chart-table estratos-tabla">
          <thead>
            <tr>
              <th>Territorio</th>
              {NOMBRES.map((_, i) => (
                <th key={i}>E{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.nombre}>
                <td>{f.nombre}</td>
                {f.valores.map((v, i) => (
                  <td key={i}>{pct(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="estratos-filas" role="img" aria-label="Distribución de manzanas por estrato en cada territorio">
          {filas.map((f) => (
            <div key={f.nombre} className={`estratos-fila ${f.ciudad ? 'ciudad' : ''}`}>
              <span className="bar-label">{f.nombre}</span>
              <span className="estratos-barra">
                {f.valores.map(
                  (v, i) =>
                    v > 0 && (
                      <button
                        key={i}
                        style={{ flexBasis: `${v}%`, background: RAMPA_ESTRATO[i] }}
                        aria-label={`${f.nombre}, estrato ${i + 1}: ${pct(v)}`}
                        onMouseEnter={() => setHover(`${f.nombre}-${i}`)}
                        onMouseLeave={() => setHover(null)}
                        onFocus={() => setHover(`${f.nombre}-${i}`)}
                        onBlur={() => setHover(null)}
                      >
                        {hover === `${f.nombre}-${i}` && (
                          <span className="chart-tooltip estratos-tooltip">
                            <b>{f.nombre}</b>
                            <span>
                              Estrato {i + 1} ({NOMBRES[i].toLowerCase()}): <strong>{pct(v)}</strong>
                            </span>
                          </span>
                        )}
                      </button>
                    )
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
