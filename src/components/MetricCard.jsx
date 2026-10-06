import { accentByTheme } from '../data/navegacion';
import { formatoUnidad, formatoValor } from '../lib/lago';

// `seccion` (opcional) rotula la tarjeta con el tema del lago de donde sale, junto al punto de color (Panorama).
export default function MetricCard({ cifra, onSource, seccion }) {
  const unidad = formatoUnidad(cifra);
  const punto = <span className={`metric-dot ${accentByTheme[cifra.tema] ?? 'green'}`} aria-hidden="true" />;
  return (
    <button
      className="metric-card"
      // El buscador general (⌘K) encuentra la tarjeta de una cifra por su tema y su clave.
      data-cifra={cifra.tema && cifra.clave ? `${cifra.tema}/${cifra.clave}` : undefined}
      onClick={() => onSource(cifra.fuente)}
      title={cifra.nota || ''}
    >
      {seccion ? (
        <span className="metric-seccion">
          {punto}
          {seccion}
        </span>
      ) : (
        punto
      )}
      <span className="metric-label">{cifra.etiqueta}</span>
      <strong className={typeof cifra.valor === 'string' ? 'texto' : undefined}>
        {formatoValor(cifra)}
        {unidad && <span className="metric-unit"> {unidad}</span>}
      </strong>
      <small>
        {cifra.vigencia} · <span className={`estado ${cifra.estado}`}>{cifra.estado}</span>
      </small>
      <span className="metric-source">Ver fuente ↗</span>
    </button>
  );
}
