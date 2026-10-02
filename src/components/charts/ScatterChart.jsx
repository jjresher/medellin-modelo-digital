'use client';

import { useEffect, useRef, useState } from 'react';
import { escalaY } from './LineChart';
import { grid, ink, textMuted, textPrimary, textSecondary } from './tokens';

const H = 340;
const FUENTE = 11; // px: el texto de los ejes se dibuja en píxeles reales, como en LineChart
const ANCHO_LETRA = 6.2;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;
const RADIO = 5;
const ALCANCE = 28; // px: el punto más cercano al cursor responde aunque no se le atine

const fmtDefault = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 1 });
const anchoTexto = (texto) => String(texto).length * ANCHO_LETRA;

// Un rombo del mismo tamaño aparente que el círculo: la forma distingue dos tipos de punto sin gastar un color.
const rombo = (cx, cy, r) => `M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} Z`;

function Marca({ shape, cx, cy, r, ...resto }) {
  return shape === 'diamond' ? <path d={rombo(cx, cy, r * 1.25)} {...resto} /> : <circle cx={cx} cy={cy} r={r} {...resto} />;
}

/**
 * Diagrama de dispersión: un punto por unidad, todos del mismo gris, y el elegido en el color de acento con su nombre
 * (color contra gris, como la comparación "actual vs anterior" de LineChart). El punto más cercano al cursor muestra sus
 * valores y un clic lo elige. Los ejes empiezan cerca del mínimo de los datos, no en cero.
 *
 * points: [{ id, label, x, y, shape?: 'circle' | 'diamond', lines?: [[rótulo, valor ya formateado], ...] }]
 * legend: [{ shape, label }] cuando hay más de una forma.
 */
export default function ScatterChart({
  points,
  xLabel,
  yLabel,
  formatX = fmtDefault,
  formatY = fmtDefault,
  color,
  selected,
  onSelect,
  legend,
  height = H,
  ariaLabel
}) {
  const lienzo = useRef(null);
  const [ancho, setAncho] = useState(560);
  const [altoMedido, setAltoMedido] = useState(0);
  const [hover, setHover] = useState(null);

  // Igual que LineChart: el lienzo toma el ancho de la tarjeta y, si la tarjeta de al lado es más alta, también su alto.
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

  if (!points.length) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const ticksY = escalaY(Math.min(...ys), Math.max(...ys), false);
  const todosX = escalaY(Math.min(...xs), Math.max(...xs), false);
  const padLeft = Math.ceil(Math.max(...ticksY.map((t) => anchoTexto(formatY(t))))) + 12;
  const padRight = Math.ceil(anchoTexto(formatX(todosX.at(-1))) / 2) + 8;
  const anchoPlot = Math.max(40, ancho - padLeft - padRight);
  // Si los rótulos del eje X no caben uno al lado del otro, se muestra uno de cada dos.
  const anchoRotulo = Math.max(...todosX.map((t) => anchoTexto(formatX(t)))) + 14;
  const cada = Math.max(1, Math.ceil((anchoRotulo * todosX.length) / anchoPlot));
  const ticksX = todosX.filter((_, i) => i % cada === 0);

  const [x0, x1] = [todosX[0], todosX.at(-1)];
  const [y0, y1] = [ticksY[0], ticksY.at(-1)];
  const px = (v) => padLeft + ((v - x0) / (x1 - x0 || 1)) * anchoPlot;
  const py = (v) => alto - PAD_BOTTOM - ((v - y0) / (y1 - y0 || 1)) * (alto - PAD_TOP - PAD_BOTTOM);

  const cercano = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    let mejor = null;
    for (const p of points) {
      const d = Math.hypot(px(p.x) - cx, py(p.y) - cy);
      if (d <= ALCANCE && (!mejor || d < mejor.d)) mejor = { p, d };
    }
    return mejor?.p ?? null;
  };

  const elegido = points.find((p) => p.id === selected);
  const sobre = points.find((p) => p.id === hover);
  // El elegido y el que está bajo el cursor se dibujan al final, encima de los demás.
  const orden = [
    ...points.filter((p) => p !== elegido && p !== sobre),
    ...(elegido ? [elegido] : []),
    ...(sobre && sobre !== elegido ? [sobre] : [])
  ];
  // El nombre del punto elegido va hacia el lado donde hay espacio.
  const rotuloALaIzquierda = elegido && px(elegido.x) + 12 + anchoTexto(elegido.label) > ancho;
  const tooltipLeft = sobre ? Math.min(Math.max(px(sobre.x), 90), ancho - 90) : 0;
  const tooltipArriba = sobre && py(sobre.y) > alto / 2;

  return (
    <div className="linechart scatterchart" role="img" aria-label={ariaLabel ?? `${yLabel} frente a ${xLabel}`}>
      {legend?.length > 1 && (
        <div className="chart-legend">
          {legend.map((l) => (
            <span key={l.label}>
              <i className={l.shape === 'diamond' ? 'rombo' : 'punto'} style={{ background: textSecondary }} />
              {l.label}
            </span>
          ))}
        </div>
      )}
      <p className="eje-titulo">↑ {yLabel}</p>
      <div ref={lienzo} className="linechart-lienzo" style={{ minHeight: height }}>
        <svg
          width={ancho}
          height={alto}
          viewBox={`0 0 ${ancho} ${alto}`}
          style={{ cursor: sobre && onSelect ? 'pointer' : 'default' }}
          onMouseMove={(e) => setHover(cercano(e)?.id ?? null)}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const p = cercano(e);
            if (p) onSelect?.(p);
          }}
        >
          {ticksY.map((t) => (
            <g key={`y${t}`}>
              <line x1={padLeft} x2={padLeft + anchoPlot} y1={py(t)} y2={py(t)} stroke={grid} strokeWidth="1" />
              <text x={padLeft - 8} y={py(t)} dy="4" textAnchor="end" fontSize={FUENTE} fill={textMuted}>
                {formatY(t)}
              </text>
            </g>
          ))}
          {todosX.map((t) => (
            <line key={`x${t}`} x1={px(t)} x2={px(t)} y1={PAD_TOP} y2={alto - PAD_BOTTOM} stroke={grid} strokeWidth="1" />
          ))}
          {ticksX.map((t) => (
            <text key={`tx${t}`} x={px(t)} y={alto - 8} fontSize={FUENTE} fill={textMuted} textAnchor="middle">
              {formatX(t)}
            </text>
          ))}
          {orden.map((p) => {
            const activo = p === elegido;
            return (
              <Marca
                key={p.id}
                shape={p.shape}
                cx={px(p.x)}
                cy={py(p.y)}
                r={activo ? RADIO + 2 : RADIO}
                fill={activo ? color : p === sobre ? textPrimary : textSecondary}
                fillOpacity={activo || p === sobre ? 1 : 0.8}
                stroke={ink}
                strokeWidth="2"
              />
            );
          })}
          {elegido && (
            <text
              x={px(elegido.x) + (rotuloALaIzquierda ? -12 : 12)}
              y={py(elegido.y)}
              dy="4"
              textAnchor={rotuloALaIzquierda ? 'end' : 'start'}
              fontSize={FUENTE}
              fontWeight="700"
              fill={textPrimary}
              stroke={ink}
              strokeWidth="3"
              paintOrder="stroke"
            >
              {elegido.label}
            </text>
          )}
        </svg>
        {sobre && (
          <div
            className="chart-tooltip"
            style={{
              left: `${tooltipLeft}px`,
              top: `${py(sobre.y)}px`,
              transform: tooltipArriba ? 'translate(-50%, calc(-100% - 12px))' : 'translate(-50%, 12px)'
            }}
          >
            <b>{sobre.label}</b>
            {(sobre.lines ?? []).map(([rotulo, valor]) => (
              <span key={rotulo}>
                {rotulo}: <strong>{valor}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="eje-titulo eje-x">{xLabel} →</p>
    </div>
  );
}
