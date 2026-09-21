export default function MetricCard({ metric, onSource }) {
  return (
    <button className="metric-card" onClick={() => onSource(metric.sourceId)}>
      <span className={`metric-dot ${metric.accent}`} aria-hidden="true" />
      <span className="metric-label">{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.note}</small>
      <span className="metric-source">Ver fuente ↗</span>
    </button>
  );
}
