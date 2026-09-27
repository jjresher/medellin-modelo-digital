'use client';

import { useMemo, useState } from 'react';
import BarChart from '../charts/BarChart';
import LineChart from '../charts/LineChart';
import { accent } from '../charts/tokens';

// Ranking y ficha de las 16 comunas y 5 corregimientos para cualquier tema del lago que traiga las listas
// `indicadores` y `territorios` (contrato de lago.Territorios). Lo usan Gente y Economía, y lo usará el Atlas.

export const formato = (valor, decimales = 0) => Number(valor).toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
// Los índices (IMCV 0–100, IDH 0–1) no llevan unidad junto al valor: su escala está en la etiqueta del indicador.
export const unidadCorta = (ind) => (/^(puntos|índice)/.test(ind.unidad) ? '' : ind.unidad);
// Los pesos por m² se leen mejor en millones cuando pasan del millón.
export const formatoIndicador = (valor, ind) => (ind.unidad.startsWith('$') && Math.abs(valor) >= 1e6
  ? `${formato(valor / 1e6, 2)} M` : formato(valor, ind.decimales));

function ultimoAnio(territorios, clave) {
  const anios = territorios.flatMap((t) => Object.keys(t.valores[clave] ?? {}));
  return anios.sort().at(-1);
}

export function Procedencia({ indicador, fuentes, onSource }) {
  const fuente = fuentes.find((f) => f.id === indicador.fuente);
  return (
    <p className="procedencia">
      <span>Vigencia {indicador.vigencia}</span>
      <span className={`estado ${indicador.estado}`}>{indicador.estado}</span>
      {fuente && <button onClick={() => onSource(fuente.id)}>{fuente.entidad} ↗</button>}
    </p>
  );
}

/**
 * selector: [[clave, rótulo corto], ...] indicadores que se pueden ordenar.
 * ficha: claves que se listan en la ficha del territorio (por defecto, las del selector).
 */
export default function PanelTerritorios({ tema, onSource, selector, ficha = selector.map(([k]) => k), color = accent.green,
  eyebrow = '16 COMUNAS Y 5 CORREGIMIENTOS', titulo = 'Cada territorio, con su vigencia',
  nota = 'Cada indicador conserva su fuente y su último año con dato; por eso no todos llegan al mismo año. Elige un indicador para ordenar los territorios y un territorio para ver su ficha.' }) {
  const { indicadores = [], territorios = [] } = tema.listas;
  const porClave = useMemo(() => Object.fromEntries(indicadores.map((i) => [i.clave, i])), [indicadores]);
  const opciones = selector.filter(([clave]) => porClave[clave]);
  const [clave, setClave] = useState(opciones[0]?.[0]);
  const ind = porClave[clave];
  const anio = ind ? ultimoAnio(territorios, clave) : null;
  // La ficha abre en el primer puesto del ranking inicial, no en un territorio que quizá no tiene ese dato.
  const [codigo, setCodigo] = useState(() => {
    const valor = (t) => t.valores[opciones[0]?.[0]]?.[ultimoAnio(territorios, opciones[0]?.[0])];
    return [...territorios].filter((t) => valor(t) != null).sort((a, b) => valor(b) - valor(a))[0]?.codigo ?? territorios[0]?.codigo;
  });

  const ranking = useMemo(() => {
    if (!ind) return [];
    return territorios
      .filter((t) => t.valores[clave]?.[anio] != null)
      .map((t) => ({ label: t.nombre, value: t.valores[clave][anio], codigo: t.codigo, note: `${t.tipo} · ${anio}` }))
      .sort((a, b) => b.value - a.value);
  }, [territorios, clave, anio, ind]);
  const sinDato = territorios.filter((t) => t.valores[clave]?.[anio] == null).map((t) => t.nombre);

  const territorio = territorios.find((t) => t.codigo === codigo);
  const evolucion = territorio && Object.entries(territorio.valores[clave] ?? {}).sort(([a], [b]) => a.localeCompare(b));

  if (!ind) return null;
  const fmt = (v) => formatoIndicador(v, ind);
  return (
    <section className="sec-block">
      <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{titulo}</h2></div></div>
      <p className="sec-note">{nota}</p>
      <div className="chips">{opciones.map(([k, l]) => <button key={k} className={k === clave ? 'on' : ''} onClick={() => setClave(k)}>{l}</button>)}</div>
      <div className="indicador-cabecera">
        <h3>{ind.etiqueta} · {anio}</h3>
        <Procedencia indicador={ind} fuentes={tema.fuentes} onSource={onSource} />
        {ind.nota && <p className="sec-note">{ind.nota}</p>}
      </div>
      <div className="chart-grid gente-grid">
        <div className="chart-card">
          <h3>{ind.etiqueta} ({ind.unidad}), {anio}</h3>
          <BarChart data={ranking} color={color} unit={unidadCorta(ind)} formatValue={fmt} ariaLabel={`${ind.etiqueta} por territorio`}
            selected={territorio?.nombre} onSelect={(d) => setCodigo(d.codigo)} />
          {sinDato.length > 0 && <p className="chart-fuente">Sin dato en {anio}: {sinDato.join(', ')}.</p>}
        </div>
        <div className="chart-card ficha-territorio">
          <label className="selector-estacion">Territorio
            <select value={codigo} onChange={(e) => setCodigo(e.target.value)}>
              {territorios.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre} ({t.tipo.toLowerCase()})</option>)}
            </select>
          </label>
          {evolucion?.length > 1 && (
            <>
              <h3>{ind.etiqueta} en {territorio.nombre}</h3>
              <LineChart series={[{ label: territorio.nombre, color, points: evolucion.map(([a, v]) => [a, v]) }]} unit={unidadCorta(ind)} formatValue={fmt} height={180} />
            </>
          )}
          <table className="chart-table ficha-tabla">
            <thead><tr><th>Indicador</th><th>Año</th><th>Valor</th></tr></thead>
            <tbody>
              {ficha.filter((k) => porClave[k]).map((k) => {
                const serie = Object.entries(territorio?.valores[k] ?? {}).sort(([a], [b]) => a.localeCompare(b));
                const [a, v] = serie.at(-1) ?? [];
                const i = porClave[k];
                return (
                  <tr key={k} className={k === clave ? 'activo' : ''}>
                    <td>{i.etiqueta} <span className={`estado ${i.estado}`}>{i.estado}</span></td>
                    <td>{a ?? '—'}</td>
                    <td>{v == null ? 'sin dato' : `${formatoIndicador(v, i)} ${unidadCorta(i)}`.trim()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
