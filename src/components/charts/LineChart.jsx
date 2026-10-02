'use client';

import { useEffect, useRef, useState } from 'react';
import { grid, textMuted, textPrimary, textSecondary } from './tokens';

const H = 220;
const FUENTE = 11; // px: el texto del eje se dibuja en píxeles reales, no escalado con la tarjeta
const ANCHO_LETRA = 6.2; // px por carácter a 11 px; alcanza para reservar márgenes sin medir el DOM
const PAD_TOP = 14;
const PAD_BOTTOM = 26;

const fmtDefault = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const anchoTexto = (texto) => String(texto).length * ANCHO_LETRA;

/**
 * Eje Y con pasos "redondos" (1, 2, 5 × 10ⁿ) que siempre cubre el mínimo y el máximo de los datos. Con desdeCero
 * empieza en 0; si no, cerca del mínimo: una tasa que se mueve entre 58 y 68 % se vería plana contra un eje desde 0.
 * Empezar lejos de cero es válido en líneas (no en barras), y el rótulo del eje deja ver dónde empieza.
 */
export function escalaY(minDato, maxDato, desdeCero, pasos = 5) {
  let bajo = desdeCero ? Math.min(0, minDato) : minDato;
  let alto = Math.max(maxDato, desdeCero ? 0 : maxDato);
  if (alto === bajo) {
    alto += Math.abs(alto) * 0.1 || 1;
    bajo -= desdeCero ? 0 : Math.abs(bajo) * 0.1 || 1;
  }
  const crudo = (alto - bajo) / pasos;
  const magnitud = Math.pow(10, Math.floor(Math.log10(crudo)));
  const paso = [1, 2, 5, 10].find((m) => m * magnitud >= crudo) * magnitud;
  const inicio = Math.floor(bajo / paso) * paso;
  const fin = Math.ceil(alto / paso) * paso;
  const ticks = [];
  for (let k = 0; inicio + k * paso <= fin + paso * 1e-9; k++) ticks.push(Number((inicio + k * paso).toPrecision(12)));
  return ticks;
}

/**
 * Posiciones del eje X que caben sin encimarse. El primer rótulo se alinea a la izquierda, el último a la derecha y
 * los demás al centro, así que cada uno ocupa un tramo distinto alrededor de su punto: se reparte un rótulo cada tantos
 * puntos y se descarta el que pisaría al anterior o al último, que siempre se muestra.
 */
function ticksX(etiquetas, anchoPlot) {
  const n = etiquetas.length;
  if (n <= 1) return n ? [0] : [];
  const separacion = anchoPlot / (n - 1);
  const tramo = (i) => {
    const w = anchoTexto(etiquetas[i]);
    const x = i * separacion;
    return i === 0 ? [x, x + w] : i === n - 1 ? [x - w, x] : [x - w / 2, x + w / 2];
  };
  const hueco = Math.max(...etiquetas.map(anchoTexto)) + 18;
  const cada = Math.max(1, Math.ceil(hueco / separacion));
  const ultimo = tramo(n - 1);
  const marcas = [];
  for (let i = 0; i < n - 1; i += cada) {
    const [ini, fin] = tramo(i);
    const previo = marcas.length ? tramo(marcas.at(-1))[1] : -Infinity;
    if (ini >= previo + 12 && fin <= ultimo[0] - 12) marcas.push(i);
  }
  return [...marcas, n - 1];
}

/**
 * Gráfica de línea, una o dos series. Pensada para "serie anual/mensual" (una línea) y para
 * "año en curso vs año anterior" (dos líneas: la actual en color sólido, la anterior en gris
 * punteado — color contra gris, no dos acentos compitiendo por identidad).
 *
 * series: [{ label, color, dashed?, points: [[etiquetaX, valor | null], ...] }] — null deja un hueco en la línea.
 */
export default function LineChart({ series, unit = '', formatValue = fmtDefault, height = H, ariaLabel, desdeCero = true }) {
  const lienzo = useRef(null);
  const [ancho, setAncho] = useState(560);
  const [altoMedido, setAltoMedido] = useState(0);
  const [hover, setHover] = useState(null);

  // El lienzo mide lo que le deja la tarjeta: su ancho siempre y, si la tarjeta es más alta que la gráfica (porque la
  // de al lado lo es), también ese alto de sobra. El svg va en posición absoluta, así que no empuja la medida.
  useEffect(() => {
    const nodo = lienzo.current;
    if (!nodo) return undefined;
    const observador = new ResizeObserver(([entrada]) => {
      const medido = Math.round(entrada.contentRect.width);
      if (medido > 0) setAncho(medido);
      setAltoMedido(Math.round(entrada.contentRect.height));
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);
  const alto = Math.max(height, altoMedido);

  const labels = series[0]?.points.map((p) => String(p[0])) ?? [];
  const n = labels.length;
  const valores = series.flatMap((s) => s.points.map((p) => p[1])).filter((v) => v != null);
  if (!n || !valores.length) return null;

  const ticks = escalaY(Math.min(...valores), Math.max(...valores), desdeCero);
  const bajo = ticks[0];
  const tope = ticks[ticks.length - 1];
  const finales = series.map((s) => [...s.points].reverse().find((p) => p[1] != null)).filter(Boolean);

  // Márgenes a la medida de los rótulos: los del eje Y a la izquierda, el valor final a la derecha.
  const padLeft = Math.ceil(Math.max(...ticks.map((t) => anchoTexto(formatValue(t))))) + 10;
  const padRight = Math.ceil(Math.max(12, ...finales.map((p) => anchoTexto(formatValue(p[1])) + 14)));
  const anchoPlot = Math.max(40, ancho - padLeft - padRight);

  const x = (i) => padLeft + (n <= 1 ? anchoPlot / 2 : (i / (n - 1)) * anchoPlot);
  const y = (v) => alto - PAD_BOTTOM - ((v - bajo) / (tope - bajo || 1)) * (alto - PAD_TOP - PAD_BOTTOM);

  // Un punto sin dato corta la línea: la serie sigue en el siguiente valor con un hueco, en vez de caer al eje
  // (las series en vivo del SIATA traen días sin medición y la GEIH no midió la subocupación a mediados de 2020).
  const path = (points) => {
    let comando = 'M';
    return points
      .map(([, v], i) => {
        if (v == null) {
          comando = 'M';
          return '';
        }
        const trazo = `${comando}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        comando = 'L';
        return trazo;
      })
      .filter(Boolean)
      .join(' ');
  };
  const marcasX = ticksX(labels, anchoPlot);

  const onMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - padLeft) / anchoPlot) * (n - 1)))));
  };
  // El tooltip se mantiene dentro de la tarjeta aunque el punto esté en un borde.
  const tooltipLeft = hover == null ? 0 : Math.min(Math.max(x(hover), 80), ancho - 80);

  return (
    <div className="linechart" role="img" aria-label={ariaLabel ?? series.map((s) => s.label).join(' vs ')}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.label}>
              <i className={s.dashed ? 'dashed' : ''} style={s.dashed ? { borderTopColor: s.color } : { background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div ref={lienzo} className="linechart-lienzo" style={{ minHeight: height }}>
        <svg
          width={ancho}
          height={alto}
          viewBox={`0 0 ${ancho} ${alto}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onTouchMove={(e) => onMove(e.touches[0] ?? e)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padLeft} x2={padLeft + anchoPlot} y1={y(t)} y2={y(t)} stroke={grid} strokeWidth="1" />
              <text x={padLeft - 8} y={y(t)} dy="4" textAnchor="end" fontSize={FUENTE} fill={textMuted}>
                {formatValue(t)}
              </text>
            </g>
          ))}
          {marcasX.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={alto - 8}
              fontSize={FUENTE}
              fill={textMuted}
              textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            >
              {labels[i]}
            </text>
          ))}
          {series.map((s) => (
            <path
              key={s.label}
              d={path(s.points)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '5 4' : undefined}
              opacity={s.dashed ? 0.85 : 1}
            />
          ))}
          {series.map((s) => {
            const last = [...s.points].reverse().find((p) => p[1] != null);
            if (!last) return null;
            const i = s.points.indexOf(last);
            return (
              <g key={`${s.label}-end`}>
                <circle cx={x(i)} cy={y(last[1])} r="4" fill={s.color} stroke="#272822" strokeWidth="2" />
                <text x={x(i) + 8} y={y(last[1])} dy="4" fontSize={FUENTE} fontFamily="ui-monospace, Menlo, monospace" fill={textPrimary}>
                  {formatValue(last[1])}
                </text>
              </g>
            );
          })}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD_TOP} y2={alto - PAD_BOTTOM} stroke={textSecondary} strokeWidth="1" strokeDasharray="2 2" />
              {series.map(
                (s) =>
                  s.points[hover]?.[1] != null && (
                    <circle key={s.label} cx={x(hover)} cy={y(s.points[hover][1])} r="4" fill={s.color} stroke="#272822" strokeWidth="2" />
                  )
              )}
            </g>
          )}
        </svg>
      </div>
      {hover != null && (
        <div className="chart-tooltip" style={{ left: `${tooltipLeft}px` }}>
          <b>{labels[hover]}</b>
          {series.map((s) => (
            <span key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}: <strong>{s.points[hover]?.[1] == null ? 'sin dato' : `${formatValue(s.points[hover][1])}${unit ? ` ${unit}` : ''}`}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
