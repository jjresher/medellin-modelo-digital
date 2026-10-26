'use client';

import { useMemo, useState } from 'react';
import { accent } from './charts/tokens';
import BarChart from './charts/BarChart';
import FuenteChip from './FuenteChip';
import { formatoIndicador, unidadCorta } from './territorios/PanelTerritorios';
import MapaTerritorios from './territorios/MapaTerritorios';
import { PENDIENTES, PREGUNTAS, anioDe, ranking, valoresDe } from '../lib/preguntas';
import { useFuente } from '../lib/catalogo';

// Entrega 2: las preguntas que el lago responde por comuna y corregimiento. Cada una dibuja un ranking y un mapa del mismo
// indicador, con el código de su fuente, su periodo y la fecha en que se probó a la vista; y dice qué NO responde.

// El periodo de la gráfica: el año que dibuja y, si el indicador es una serie más larga, de qué serie sale.
const periodo = (anio, vigencia) =>
  anio && /\d{4}\s*[–-]\s*\d{4}/.test(vigencia) && !/[–-]/.test(anio) ? `${anio} (de la serie ${vigencia})` : vigencia;

function Pregunta({ datos, lago, onSource }) {
  const tema = lago.temas[datos.tema];
  const indicadores = useMemo(
    () =>
      datos.indicadores.map(([clave, rotulo]) => [clave, rotulo, tema?.listas.indicadores?.find((i) => i.clave === clave)]).filter(([, , i]) => i),
    [datos, tema]
  );
  const [clave, setClave] = useState(indicadores[0]?.[0]);
  const [codigo, setCodigo] = useState(null);
  if (!tema || !indicadores.length) return null;
  const [, rotulo, ind] = indicadores.find(([k]) => k === clave) ?? indicadores[0];
  const territorios = tema.listas.territorios;
  const anio = anioDe(territorios, ind.clave);
  const filas = ranking(territorios, ind.clave, anio);
  const valores = valoresDe(territorios, ind.clave, anio);
  const sinDato = territorios.filter((t) => t.valores?.[ind.clave]?.[anio] == null).map((t) => t.nombre);
  const fmt = (v) => formatoIndicador(v, ind);
  const color = accent[datos.color];
  return (
    <section className="sec-block pregunta" id={`pregunta-${datos.id}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{datos.origen.toUpperCase()} · POR COMUNA Y CORREGIMIENTO</p>
          <h2>{datos.pregunta}</h2>
        </div>
      </div>
      {indicadores.length > 1 && (
        <div className="chips">
          {indicadores.map(([k, l]) => (
            <button key={k} className={k === ind.clave ? 'on' : ''} aria-pressed={k === ind.clave} onClick={() => setClave(k)}>
              {l}
            </button>
          ))}
        </div>
      )}
      <FuenteChip item={ind} vigencia={periodo(anio, ind.vigencia)} onSource={onSource} />
      <div className="chart-grid">
        <div className="chart-card">
          <h3>
            {ind.etiqueta} ({ind.unidad}), {anio}
          </h3>
          <BarChart
            data={filas}
            color={color}
            unit={unidadCorta(ind)}
            formatValue={fmt}
            ariaLabel={`${ind.etiqueta} por territorio, ${anio}`}
            selected={filas.find((f) => f.codigo === codigo)?.label}
            onSelect={(d) => setCodigo(d.codigo)}
          />
          {sinDato.length > 0 && (
            <p className="chart-fuente">
              Sin dato en {anio}: {sinDato.join(', ')}.
            </p>
          )}
        </div>
        <div className="chart-card">
          <h3>
            {rotulo}: mapa, {anio}
          </h3>
          <MapaTerritorios
            valores={valores}
            etiqueta={ind.unidad}
            rotulo={rotulo}
            formatValue={(v) => `${fmt(v)} ${unidadCorta(ind)}`.trim()}
            formatLegend={fmt}
            color={color}
            seleccionado={codigo}
            onSelect={setCodigo}
          />
          <p className="chart-fuente">Toca un territorio para ver su valor.</p>
        </div>
      </div>
      <div className="lectura-pregunta">
        <div>
          <b>Cómo leerlo</b>
          <ul>
            {datos.lectura.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {ind.nota && <p className="chart-fuente">{ind.nota}</p>}
        </div>
        <div>
          <b>Lo que no responde</b>
          <p>{datos.noResponde}</p>
        </div>
      </div>
    </section>
  );
}

function Pendiente({ p }) {
  const fuente = useFuente(p.fuente);
  return (
    <li>
      <b>{p.pregunta}</b>
      <span>{p.motivo}</span>
      {fuente && (
        <small>
          Fuente consultada: {fuente.codigo} · {fuente.estado}
        </small>
      )}
    </li>
  );
}

export default function PreguntasView({ lago, onSource }) {
  if (lago.estado === 'cargando') return <div className="view-loading">Cargando las preguntas…</div>;
  return (
    <section className="view preguntas-view">
      <div className="view-intro">
        <p className="eyebrow">MEDELLÍN · PREGUNTAS</p>
        <h1>
          Lo que el lago <em>sí responde.</em>
        </h1>
        <p>
          Las preguntas 2 y 3 de la primera entrega, y una nueva, contestadas por comuna y corregimiento. Cada gráfico muestra el código de su fuente
          (F001, F002…), el periodo que cubre el dato y la fecha en que se probó; un clic en el código abre la ficha de la fuente con su licencia. Al
          final, las preguntas que quedan pendientes y por qué.
        </p>
      </div>
      {PREGUNTAS.map((p) => (
        <Pregunta key={p.id} datos={p} lago={lago} onSource={onSource} />
      ))}
      <section className="sec-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PENDIENTES</p>
            <h2>Preguntas que el lago todavía no responde</h2>
          </div>
        </div>
        <ul className="pendientes">
          {PENDIENTES.map((p) => (
            <Pendiente key={p.pregunta} p={p} />
          ))}
        </ul>
      </section>
    </section>
  );
}
