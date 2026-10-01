'use client';

import { useMemo, useState } from 'react';
import { accent } from '../charts/tokens';

const numero = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const porcentaje = (v) => `${Number(v).toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
export const COLOR_SEXO = { hombres: accent.cyan, mujeres: accent.orange };

// Pirámide por grupos de 5 años. La escala es común a todos los años disponibles, para que al cambiar de año se vea
// cómo cambia la forma y no solo la proporción.
export default function Piramide({ filas }) {
  const anios = useMemo(() => [...new Set(filas.map((f) => f.anio))].sort(), [filas]);
  const [anio, setAnio] = useState(() => anios.find((a) => a === new Date().getFullYear()) ?? anios.at(-1));
  const [hover, setHover] = useState(null);
  const [tabla, setTabla] = useState(false);
  const max = Math.max(...filas.flatMap((f) => [f.hombres, f.mujeres]));
  const grupos = filas.filter((f) => f.anio === anio).reverse();
  const total = grupos.reduce((s, g) => s + g.hombres + g.mujeres, 0);

  return (
    <div className="piramide">
      <div className="card-controls">
        <div className="chips">
          {anios.map((a) => (
            <button key={a} className={a === anio ? 'on' : ''} onClick={() => setAnio(a)}>
              {a}
            </button>
          ))}
        </div>
        <button className="table-toggle" onClick={() => setTabla((v) => !v)}>
          {tabla ? 'Ver como gráfica' : 'Ver como tabla'}
        </button>
      </div>
      {tabla ? (
        <table className="chart-table">
          <thead>
            <tr>
              <th>Edad</th>
              <th>Hombres</th>
              <th>Mujeres</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={g.grupo}>
                <td>{g.grupo}</td>
                <td>{numero(g.hombres)}</td>
                <td>{numero(g.mujeres)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <div className="chart-legend piramide-leyenda">
            <span>
              <i style={{ background: COLOR_SEXO.hombres }} />
              Hombres
            </span>
            <span>
              <i style={{ background: COLOR_SEXO.mujeres }} />
              Mujeres
            </span>
          </div>
          <div className="piramide-filas" role="img" aria-label={`Pirámide de población de Medellín, ${anio}`}>
            {grupos.map((g) => (
              <button
                key={g.grupo}
                className="piramide-fila"
                onMouseEnter={() => setHover(g.grupo)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(g.grupo)}
                onBlur={() => setHover(null)}
              >
                <span className="piramide-lado izq">
                  <span style={{ width: `${(g.hombres / max) * 100}%`, background: COLOR_SEXO.hombres }} />
                </span>
                <span className="piramide-grupo">{g.grupo}</span>
                <span className="piramide-lado">
                  <span style={{ width: `${(g.mujeres / max) * 100}%`, background: COLOR_SEXO.mujeres }} />
                </span>
                {hover === g.grupo && (
                  <div className="chart-tooltip piramide-tooltip">
                    <b>
                      {g.grupo} años · {anio}
                    </b>
                    <span>
                      <i style={{ background: COLOR_SEXO.hombres }} />
                      Hombres: <strong>{numero(g.hombres)}</strong> ({porcentaje((g.hombres / total) * 100)})
                    </span>
                    <span>
                      <i style={{ background: COLOR_SEXO.mujeres }} />
                      Mujeres: <strong>{numero(g.mujeres)}</strong> ({porcentaje((g.mujeres / total) * 100)})
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
