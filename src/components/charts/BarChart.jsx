'use client';

import { useState } from 'react';

const fmtDefault = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 });

/**
 * Ranking horizontal: un solo color (identidad = "esta métrica"), largo = magnitud, ya viene
 * ordenado por quien llama. Cada barra es su propio objetivo de hover/foco. Incluye una vista de
 * tabla, siempre disponible, para que ningún valor dependa de pasar el mouse.
 *
 * data: [{ label, value, note? }]
 */
export default function BarChart({ data, color, unit = '', formatValue = fmtDefault, ariaLabel, onSelect, selected }) {
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState(null);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="barchart">
      <button className="table-toggle" onClick={() => setTable((v) => !v)}>{table ? 'Ver como gráfica' : 'Ver como tabla'}</button>
      {table ? (
        <table className="chart-table">
          <thead><tr><th>Territorio</th><th>Valor</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td>{formatValue(d.value)}{unit && ` ${unit}`}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className="bar-rows" role="img" aria-label={ariaLabel}>
          {data.map((d, i) => (
            <button key={d.label} className={`bar-row ${selected === d.label ? 'selected' : ''}`}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              onClick={() => onSelect?.(d)}>
              <span className="bar-label">{d.label}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
              </span>
              <span className="bar-value">{formatValue(d.value)}</span>
              {hover === i && <div className="chart-tooltip bar-tooltip"><b>{d.label}</b><span><strong>{formatValue(d.value)}{unit && ` ${unit}`}</strong></span>{d.note && <small>{d.note}</small>}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
