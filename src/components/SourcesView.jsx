'use client';

import { sources } from '../data/urbanData';

export default function SourcesView({ focusId }) {
  return (
    <section className="view sources-view">
      <div className="view-intro"><p className="eyebrow">TRAZABILIDAD DEL DATO</p><h1>Fuentes <em>abiertas.</em></h1><p>Los valores del tablero son cortes documentados, no lecturas en vivo. Consulta la fuente primaria, el período y el alcance de cada indicador.</p></div>
      <div className="source-list">
        {sources.map((source, index) => <article key={source.id} id={`source-${source.id}`} className={`source-card ${focusId === source.id ? 'focused' : ''}`}>
          <div className="source-number">{String(index + 1).padStart(2, '0')}</div>
          <div><p className="source-org">{source.organisation}</p><h2>{source.name}</h2><p>{source.description}</p></div>
          <div className="source-meta"><span>{source.period}</span><a href={source.url} target="_blank" rel="noreferrer">Abrir fuente ↗</a></div>
        </article>)}
      </div>
    </section>
  );
}
