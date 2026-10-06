'use client';

// Estado del lago al pie de la barra lateral (issue #16): cuántos temas cargaron y el rango de fechas de prueba; al
// abrirlo, cada tema con su fecha de prueba (la del archivo que llegó, no la del índice) y los que no cargaron.
export default function EstadoLago({ lago, onNavigate }) {
  if (lago.estado === 'cargando')
    return (
      <div className="sidebar-status">
        <i className="loading" /> CARGANDO LAGO…
      </div>
    );
  if (lago.estado === 'error')
    return (
      <div className="sidebar-status" role="alert">
        <i className="failed" /> LAGO NO DISPONIBLE
        <br />
        <small>{lago.error}</small>
      </div>
    );
  const fechas = lago.orden.map((tema) => lago.temas[tema].probado).sort();
  const rango = fechas.length ? (fechas[0] === fechas.at(-1) ? fechas[0] : `${fechas[0]} → ${fechas.at(-1)}`) : '—';
  const completos = lago.orden.length === lago.indice.temas.length;
  return (
    <details
      className="sidebar-status"
      // Al abrirse, la lista queda a la vista aunque la barra lateral tenga que desplazarse.
      onToggle={(e) => e.currentTarget.open && e.currentTarget.scrollIntoView({ block: 'end' })}
    >
      <summary>
        <i className={completos ? undefined : 'loading'} /> LAGO · {lago.orden.length}/{lago.indice.temas.length} TEMAS
        <br />
        <small>PROBADO {rango}</small>
      </summary>
      <ul className="lago-temas">
        {lago.indice.temas.map(({ tema, titulo }) => {
          const datos = lago.temas[tema];
          return (
            <li key={tema} className={datos ? undefined : 'falla'}>
              <span>{titulo}</span>
              <time dateTime={datos?.probado}>{datos ? datos.probado : 'no cargó'}</time>
            </li>
          );
        })}
      </ul>
      {lago.catalogo && (
        <button className="lago-fuentes" onClick={() => onNavigate('sources')}>
          {lago.catalogo.n} fuentes · método →
        </button>
      )}
    </details>
  );
}
