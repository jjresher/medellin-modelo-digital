'use client';

import { Fragment } from 'react';
import { ANIOS_ORTOFOTO, NORM_NONE, bases, floorRamp, indexRamp, lenses, lensFields, normRamp, shortcuts, territoryLayers, thematicLayers } from './config';
import { formatDistance, formatNumber } from './geo';

const gradient = (ramp) => `linear-gradient(90deg, ${ramp.map(([, color]) => color).join(', ')})`;

export function LensBar({ lens, onLens, disabled }) {
  return (
    <div className="lens-bar" role="toolbar" aria-label="Lentes del gemelo">
      {Object.entries(lenses).map(([id, l]) => (
        <button key={id} className={lens === id ? 'active' : ''} disabled={disabled} onClick={() => onLens(lens === id ? null : id)} title={`${l.label} (${l.key})`}>
          <span>{l.icon}</span>{l.label}<kbd>{l.key}</kbd>
        </button>
      ))}
    </div>
  );
}

export function ToolBar({ panel, mode, hud, onPanel, onMode, onHud, onNorth, onShare, onHelp, disabled }) {
  return (
    <div className="tool-bar" role="toolbar" aria-label="Herramientas">
      <button className={panel === 'explorar' ? 'active' : ''} disabled={disabled} onClick={() => onPanel(panel === 'explorar' ? null : 'explorar')}>☰ Explorar <kbd>E</kbd></button>
      <button className={mode === 'analizar' ? 'active' : ''} disabled={disabled} onClick={() => onMode(mode === 'analizar' ? null : 'analizar')}>◎ Analizar <kbd>A</kbd></button>
      <button className={mode === 'medir' ? 'active' : ''} disabled={disabled} onClick={() => onMode(mode === 'medir' ? null : 'medir')}>⌁ Medir <kbd>M</kbd></button>
      <button className={hud ? 'active' : ''} disabled={disabled} onClick={onHud}>⌗ HUD <kbd>H</kbd></button>
      <button disabled={disabled} onClick={onNorth}>⇧ Norte <kbd>N</kbd></button>
      <button disabled={disabled} onClick={onShare}>↗ Compartir vista</button>
      <button onClick={onHelp}>? Ayuda</button>
    </div>
  );
}

export function ExplorePanel({ state, actions, available, onClose }) {
  const { base, anio, compare, terrain, layers, thematic } = state;
  return (
    <aside className="explore-panel" aria-label="Explorador territorial">
      <header><b>Explorador territorial</b><button onClick={onClose} aria-label="Cerrar">×</button></header>
      <section>
        <span>MAPA BASE</span>
        <div className="chips">{Object.entries(bases).map(([key, { label }]) => <button key={key} className={base === key ? 'on' : ''} onClick={() => actions.setBase(key)}>{label}</button>)}</div>
        {base === 'ortofoto' && (
          <div className="ortho-controls">
            <label>Año <select value={anio} onChange={(e) => actions.setAnio(e.target.value)}>{ANIOS_ORTOFOTO.map((a) => <option key={a}>{a}</option>)}</select></label>
            <label className="check"><input type="checkbox" checked={compare.on} onChange={(e) => actions.setCompare({ ...compare, on: e.target.checked })} /> Comparar con</label>
            {compare.on && <>
              <select value={compare.anio} onChange={(e) => actions.setCompare({ ...compare, anio: e.target.value })}>{ANIOS_ORTOFOTO.filter((a) => a !== anio).map((a) => <option key={a}>{a}</option>)}</select>
              <input type="range" min="0" max="1" step="0.05" value={compare.opacity} onChange={(e) => actions.setCompare({ ...compare, opacity: Number(e.target.value) })} aria-label="Mezcla entre años" />
              <small>{anio} ◀ mezcla ▶ {compare.anio}</small>
            </>}
          </div>
        )}
        <label className="check"><input type="checkbox" checked={terrain} onChange={actions.toggleTerrain} /> Relieve 3D</label>
      </section>
      <section>
        <span>TERRITORIO</span>
        {Object.entries(territoryLayers).map(([key, { label }]) => <label key={key} className="check"><input type="checkbox" checked={layers[key]} onChange={() => actions.toggleLayer(key)} /> {label}</label>)}
      </section>
      <section>
        <span>CAPAS TEMÁTICAS</span>
        {Object.entries(thematicLayers).map(([key, { label }]) => (
          <label key={key} className={`check ${available[key] === false ? 'unavailable' : ''}`}>
            <input type="checkbox" checked={thematic.includes(key)} disabled={available[key] === false} onChange={() => actions.toggleThematic(key)} /> {label}
            {available[key] === false && <small> · no disponible en la última ingesta</small>}
          </label>
        ))}
        <button className="reset" onClick={actions.resetLayers}>Restablecer capas</button>
      </section>
    </aside>
  );
}

function RampLegend({ title, ramp, ticks, note }) {
  return (
    <div className="legend-block">
      <span>{title}</span>
      <div className="legend-ramp" style={{ background: gradient(ramp) }} />
      <div className="legend-ticks">{ticks.map((t) => <i key={t}>{t}</i>)}</div>
      {note && <em><i className="square" style={{ background: note[1] }} />{note[0]}</em>}
    </div>
  );
}

export function Legend({ lens, layers, thematic }) {
  const blocks = [];
  if (lens) blocks.push(<RampLegend key="indice" title={`ÍNDICE ${lenses[lens].label.toUpperCase()} (0–100)`} ramp={indexRamp} ticks={['0', '50', '100']} />);
  if (layers.buildings) {
    blocks.push(lens === 'densificacion'
      ? <RampLegend key="norma" title="PISOS SOBRE LA ALTURA NORMATIVA" ramp={normRamp} ticks={['≤ −3', '0', '+1', '+4']} note={['Sin altura normativa numérica', NORM_NONE]} />
      : <RampLegend key="pisos" title="PISOS" ramp={floorRamp} ticks={floorRamp.map(([f]) => (f === 30 ? '30+' : String(f)))} />);
  }
  const swatches = [...(lens && lenses[lens].legend ? lenses[lens].legend : []), ...thematic.flatMap((k) => thematicLayers[k].legend)];
  if (swatches.length) {
    blocks.push(<div key="swatches" className="legend-block">{swatches.map(([label, color]) => <em key={label}><i style={{ background: color }} />{label}</em>)}</div>);
  }
  if (!blocks.length) return null;
  return <div className="map-legend" aria-label="Leyenda">{blocks}</div>;
}

export function LensMethod({ lens, periodos }) {
  if (!lens) return null;
  return (
    <div className="lens-method">
      <b>{lenses[lens].label}</b>
      <p>{lenses[lens].method}</p>
      {lens === 'vial' && periodos && <p className="periods">Siniestros: {periodos.victimas} · Aforos: {periodos.aforos}</p>}
    </div>
  );
}

export function WhatYouSee({ items, open, onToggle }) {
  return (
    <div className={`what-you-see ${open ? 'open' : ''}`}>
      <button onClick={onToggle}>Qué estás viendo {open ? '▾' : '▸'}</button>
      {open && <ul>{items.map((item) => (
        <li key={item.label}><b>{item.label}</b>{item.fuentes.map((f) => (
          <span key={f.id}>{f.nombre}{f.vigencia ? ` · ${f.vigencia}` : ''} {f.estado && <em className={`estado ${f.estado}`}>{f.estado}</em>}</span>
        ))}</li>
      ))}</ul>}
    </div>
  );
}

export function SelectionCard({ selection, lens, territory, onFocus, onClose }) {
  if (!selection) return null;
  return (
    <div className="comuna-card">
      <span>{selection.kind}</span>
      <strong>{selection.name}</strong>
      <p>{selection.detail}</p>
      {lens && territory && (
        <dl>
          <dt>Índice {lenses[lens].label.toLowerCase()}</dt><dd>{territory[lenses[lens].index] == null ? 'sin dato' : `${formatNumber(territory[lenses[lens].index], 1)} /100`}</dd>
          {lensFields[lens].map(([campo, etiqueta, unidad]) => (
            <Fragment key={campo}><dt>{etiqueta}</dt><dd>{territory[campo] == null ? 'sin dato' : `${formatNumber(territory[campo], 2)} ${unidad}`}</dd></Fragment>
          ))}
        </dl>
      )}
      <div className="card-actions"><button onClick={onFocus}>Enfocar →</button><button onClick={onClose}>Cerrar</button></div>
    </div>
  );
}

export function AnalysisPanel({ result, onClose }) {
  if (!result) return null;
  if (result.loading) return <aside className="side-panel"><header><b>Analizando…</b></header></aside>;
  if (result.error) return <aside className="side-panel"><header><b>Análisis no disponible</b><button onClick={onClose}>×</button></header><p>{result.error}</p></aside>;
  const [r1, r2] = result.radios;
  const row = (label, a, b, fuente) => <tr><th>{label}{fuente && <small>{fuente}</small>}</th><td>{a}</td><td>{b}</td></tr>;
  return (
    <aside className="side-panel" aria-label="Análisis del punto">
      <header><b>Análisis del punto</b><button onClick={onClose} aria-label="Cerrar">×</button></header>
      <p className="coords">{result.center[1].toFixed(5)}, {result.center[0].toFixed(5)}</p>
      <table>
        <thead><tr><th /><td>500 m</td><td>1 km</td></tr></thead>
        <tbody>
          {row('Construcciones', formatNumber(r1.construcciones), formatNumber(r2.construcciones), 'Catastro distrital')}
          {row('Área construida', `${formatNumber(r1.area / 1e4, 1)} ha`, `${formatNumber(r2.area / 1e4, 1)} ha`, 'Catastro distrital')}
          {row('Pisos promedio', r1.pisosProm == null ? '—' : formatNumber(r1.pisosProm, 1), r2.pisosProm == null ? '—' : formatNumber(r2.pisosProm, 1))}
          {row('Pisos máximo', r1.pisosMax || '—', r2.pisosMax || '—')}
          {row('Víctimas viales', formatNumber(r1.victimas), formatNumber(r2.victimas), `MEData · ${result.periodoVictimas}`)}
          {row('Equipamientos', formatNumber(r1.equipamientos), formatNumber(r2.equipamientos), 'POT · IDEM')}
          {row('Estaciones Metro', formatNumber(r1.metro), formatNumber(r2.metro), 'Metro de Medellín')}
          {row('Estaciones EnCicla', formatNumber(r1.encicla), formatNumber(r2.encicla), 'IDEM')}
        </tbody>
      </table>
      {r2.porComponente.length > 0 && <p className="breakdown">Equipamientos a 1 km: {r2.porComponente.map(([k, v]) => `${k.replace(/^Equipamientos? (de |para )?/i, '')} ${v}`).join(' · ')}</p>}
      <ul className="nearest">
        {result.metroCercana && <li>Estación más cercana: <b>{result.metroCercana.nombre}</b> a {formatDistance(result.metroCercana.d)}</li>}
        {result.subestacionCercana && <li>Subestación más cercana: <b>{result.subestacionCercana.nombre}</b> a {formatDistance(result.subestacionCercana.d)}</li>}
      </ul>
      <small className="note">Suma por celdas de ~110 m cuyo centro cae dentro de cada radio. Distancias en línea recta.</small>
    </aside>
  );
}

export function MeasurePanel({ points, total, onClear, onClose }) {
  return (
    <aside className="side-panel measure" aria-label="Medir distancia">
      <header><b>Medir distancia</b><button onClick={onClose} aria-label="Cerrar">×</button></header>
      <p className="total">{points.length < 2 ? 'Haz clic en el mapa para agregar puntos.' : formatDistance(total)}</p>
      {points.length > 1 && <small>{points.length} puntos · distancia en línea recta (fórmula de haversine)</small>}
      <div className="card-actions"><button onClick={onClear}>Limpiar</button><button onClick={onClose}>Terminar (Esc)</button></div>
    </aside>
  );
}

export function Hud({ info }) {
  if (!info) return null;
  return (
    <div className="hud-panel" aria-label="Telemetría del mapa">
      <span>TELEMETRÍA</span>
      <dl>
        <dt>LAT</dt><dd>{info.lat.toFixed(5)}</dd><dt>LON</dt><dd>{info.lon.toFixed(5)}</dd>
        <dt>ZOOM</dt><dd>{info.zoom.toFixed(2)}</dd><dt>RUMBO</dt><dd>{Math.round(info.bearing)}°</dd>
        <dt>INCLINACIÓN</dt><dd>{Math.round(info.pitch)}°</dd><dt>ESCALA</dt><dd>{formatNumber(info.mpp, 2)} m/px</dd>
      </dl>
    </div>
  );
}

export function HelpOverlay({ onClose, onGuide }) {
  return (
    <div className="help-overlay" role="dialog" aria-label="Ayuda rápida">
      <header><b>Ayuda rápida · controla el gemelo</b><button onClick={onClose} aria-label="Cerrar">×</button></header>
      <dl>{shortcuts.map(([k, v]) => <Fragment key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></Fragment>)}</dl>
      <p>Clic: consulta una construcción, capa o territorio. Arrastrar: mover. Clic derecho y arrastrar: rotar e inclinar. Compartir vista copia un enlace con cámara, mapa base, lente y capas.</p>
      <button className="link" onClick={onGuide}>Ver guía inicial</button>
    </div>
  );
}

export function StartGuide({ onStart, onClose }) {
  return (
    <div className="start-guide" role="dialog" aria-label="Guía inicial">
      <button className="close" onClick={onClose} aria-label="Cerrar">×</button>
      <span>EMPIEZA AQUÍ</span>
      <strong>El mapa responde a preguntas.</strong>
      <p>Usa las cuatro lentes de la parte superior para colorear las comunas por energía, densificación o presión vial, y <b>Analizar</b> para medir el entorno de cualquier punto.</p>
      <button className="primary" onClick={onStart}>Empezar con el cruce urbano →</button>
      <small>Las capas especializadas están en <b>Explorar</b>. Pulsa <kbd>?</kbd> para ver los atajos.</small>
    </div>
  );
}
