'use client';

import { useEffect } from 'react';

export default function SourcesView({ catalogo, focusId }) {
  useEffect(() => {
    if (focusId) document.getElementById(`source-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId]);

  const datasets = catalogo?.datasets ?? [];
  return (
    <section className="view sources-view">
      <div className="view-intro">
        <p className="eyebrow">TRAZABILIDAD DEL DATO</p>
        <h1>
          Fuentes <em>abiertas.</em>
        </h1>
        <p>
          Cada cifra del tablero sale del lago de datos, que se genera con scripts de ingesta reproducibles y se verifica antes de publicarse.
          Consulta aquí la fuente primaria, su vigencia real y su estado.
        </p>
      </div>
      {catalogo && (
        <p className="sources-summary">
          {catalogo.n} datasets · probados el {catalogo.probado} ·{' '}
          {Object.entries(catalogo.por_estado).map(([estado, n]) => (
            <span key={estado}>
              <span className={`estado ${estado}`}>{estado}</span> {n}
            </span>
          ))}
        </p>
      )}
      <div className="source-list">
        {datasets.map((source, index) => (
          <article key={source.id} id={`source-${source.id}`} className={`source-card ${focusId === source.id ? 'focused' : ''}`}>
            <div className="source-number">{String(index + 1).padStart(2, '0')}</div>
            <div>
              <p className="source-org">
                {source.entidad} · {source.tema}
              </p>
              <h2>{source.nombre}</h2>
              <p>{source.uso}</p>
            </div>
            <div className="source-meta">
              <span>{source.vigencia}</span>
              <span className={`estado ${source.estado}`}>{source.estado}</span>
              {source.probado && <small>probado {source.probado}</small>}
              <a href={source.url} target="_blank" rel="noreferrer">
                Abrir fuente ↗
              </a>
            </div>
          </article>
        ))}
      </div>
      {!catalogo && <p className="sources-summary">El catálogo no está disponible. Genera el lago con la ingesta (ver README).</p>}
    </section>
  );
}
