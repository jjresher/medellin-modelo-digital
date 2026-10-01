import { accentByTheme } from '../data/navegacion';
import { formatoUnidad, formatoValor } from '../lib/lago';

export default function MetricCard({ cifra, onSource }) {
  const unidad = formatoUnidad(cifra);
  return (
    <button className="metric-card" onClick={() => onSource(cifra.fuente)} title={cifra.nota || ''}>
      <span className={`metric-dot ${accentByTheme[cifra.tema] ?? 'green'}`} aria-hidden="true" />
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
