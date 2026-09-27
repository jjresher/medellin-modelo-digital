'use client';

import { useMemo, useState } from 'react';
import { grid, textMuted, textPrimary, textSecondary } from './tokens';

const W = 640;
const H = 220;
const PAD = { top: 14, right: 40, bottom: 22, left: 44 };

const fmtDefault = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 });

function niceTicks(min, max, n = 4) {
  if (min === max) return [min];
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / n)));
  const mult = span / n / step;
  const niceStep = (mult >= 5 ? 5 : mult >= 2 ? 2 : 1) * step;
  const start = Math.floor(min / niceStep) * niceStep;
  const ticks = [];
  for (let v = start; v <= max + niceStep * 0.001; v += niceStep) if (v >= min - niceStep * 0.001) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/**
 * Gráfica de línea, una o dos series. Pensada para "serie anual/mensual" (una línea) y para
 * "año en curso vs año anterior" (dos líneas: la actual en color sólido, la anterior en gris
 * punteado — color contra gris, no dos acentos compitiendo por identidad).
 *
 * series: [{ label, color, dashed?, points: [[etiquetaX, valor], ...] }]
 */
export default function LineChart({ series, unit = '', formatValue = fmtDefault, height = H, ariaLabel }) {
  const [hover, setHover] = useState(null);
  const labels = series[0]?.points.map((p) => p[0]) ?? [];
  const n = labels.length;
  const allValues = series.flatMap((s) => s.points.map((p) => p[1])).filter((v) => v != null);
  const min = Math.min(0, ...allValues);
  const max = Math.max(...allValues, 1);
  const ticks = useMemo(() => niceTicks(min, max), [min, max]);
  const topTick = ticks[ticks.length - 1] ?? max;

  const x = (i) => PAD.left + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.left - PAD.right));
  const y = (v) => height - PAD.bottom - ((v - min) / (topTick - min || 1)) * (height - PAD.top - PAD.bottom);

  const path = (points) => points.map(([, v], i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${v == null ? y(min) : y(v).toFixed(1)}`).join(' ');

  const xTickEvery = Math.max(1, Math.ceil(n / 7));
  // Siempre se marca el último punto; se omite el múltiplo regular anterior si quedaría pegado a él.
  const xTicks = new Set();
  for (let i = 0; i < n; i += xTickEvery) xTicks.add(i);
  if (n > 1) {
    const anterior = [...xTicks].filter((i) => i !== n - 1).pop();
    if (anterior != null && n - 1 - anterior < xTickEvery / 2) xTicks.delete(anterior);
    xTicks.add(n - 1);
  }

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1))));
    setHover(i);
  };

  return (
    <div className="linechart" role="img" aria-label={ariaLabel ?? series.map((s) => s.label).join(' vs ')}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.label}><i className={s.dashed ? 'dashed' : ''} style={{ borderTopColor: s.color }} />{s.label}</span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchMove={(e) => onMove(e.touches[0] ?? e)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={grid} strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t)} dy="3" textAnchor="end" fontSize="9" fill={textMuted}>{formatValue(t)}</text>
          </g>
        ))}
        {labels.map((lab, i) => xTicks.has(i) && (
          <text key={lab} x={x(i)} y={height - 6} textAnchor={i === n - 1 ? 'end' : 'middle'} fontSize="9" fill={textMuted}>{lab}</text>
        ))}
        {series.map((s) => (
          <path key={s.label} d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={s.dashed ? '5 4' : undefined} opacity={s.dashed ? 0.85 : 1} />
        ))}
        {series.map((s) => {
          const last = [...s.points].reverse().find((p) => p[1] != null);
          if (!last) return null;
          const i = s.points.indexOf(last);
          return (
            <g key={`${s.label}-end`}>
              <circle cx={x(i)} cy={y(last[1])} r="4" fill={s.color} stroke="#272822" strokeWidth="2" />
              <text x={x(i) + 7} y={y(last[1])} dy="3" fontSize="10" fontFamily="ui-monospace, Menlo, monospace" fill={textPrimary}>{formatValue(last[1])}</text>
            </g>
          );
        })}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={height - PAD.bottom} stroke={textSecondary} strokeWidth="1" strokeDasharray="2 2" />
            {series.map((s) => s.points[hover]?.[1] != null && (
              <circle key={s.label} cx={x(hover)} cy={y(s.points[hover][1])} r="4" fill={s.color} stroke="#272822" strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="chart-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <b>{labels[hover]}</b>
          {series.map((s) => s.points[hover]?.[1] != null && (
            <span key={s.label}><i style={{ background: s.color }} />{s.label}: <strong>{formatValue(s.points[hover][1])}{unit && ` ${unit}`}</strong></span>
          ))}
        </div>
      )}
    </div>
  );
}
