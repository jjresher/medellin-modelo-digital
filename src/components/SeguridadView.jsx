'use client';

import { useMemo, useState } from 'react';
import BarChart from './charts/BarChart';
import LineChart from './charts/LineChart';
import { accent } from './charts/tokens';
import MetricCard from './MetricCard';
import BarrioMap from './seguridad/BarrioMap';
import { useJsonEstatico } from '../lib/lago';

const POLICIA = [
  ['homicidios', 'Homicidios'],
  ['hurto_personas', 'Hurto a personas'],
  ['hurto_vehiculos', 'Hurto de vehículos'],
  ['extorsion', 'Extorsión'],
  ['violencia_intrafamiliar', 'Violencia intrafamiliar'],
  ['delitos_sexuales', 'Delitos sexuales'],
  ['lesiones_personales', 'Lesiones personales']
];
const SISC = [
  ['homicidio', 'Homicidio'],
  ['hurto_persona', 'Hurto a persona'],
  ['hurto_moto', 'Hurto de moto'],
  ['hurto_carro', 'Hurto de carro'],
  ['hurto_residencia', 'Hurto a residencia'],
  ['hurto_comercio', 'Hurto a comercio'],
  ['extorsion_sisc', 'Extorsión'],
  ['lesion_dolosa', 'Lesión no fatal']
];

const numero = (v) => Number(v).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const pick = (cifras, clave) => (cifras[clave] ? { ...cifras[clave], clave, tema: 'seguridad' } : null);

function PoliciaSection({ tema, onSource }) {
  const [clave, nombre] = useChipSelector(POLICIA);
  const c = tema.cifras;
  const anuales = [pick(c, `${clave.v}_anio_curso`), pick(c, `${clave.v}_variacion`), pick(c, `${clave.v}_tasa`)].filter(Boolean);
  const anual = tema.series[`${clave.v}_anual`];
  const mensual = tema.series[`${clave.v}_mensual`];
  return (
    <section className="sec-block">
      <div className="section-heading"><div><p className="eyebrow">POLICÍA NACIONAL · 2018 AL ÚLTIMO MES PUBLICADO</p><h2>Series por delito</h2></div></div>
      <div className="chips">{POLICIA.map(([k, l]) => <button key={k} className={clave.v === k ? 'on' : ''} onClick={() => clave.set(k)}>{l}</button>)}</div>
      {anuales.length > 0 && <div className="metrics-grid compact">{anuales.map((cifra) => <MetricCard key={cifra.clave} cifra={cifra} onSource={onSource} />)}</div>}
      <div className="chart-grid">
        {anual && <div className="chart-card"><h3>{nombre} por año</h3><LineChart series={[{ label: nombre, color: accent.pink, points: anual.puntos }]} formatValue={numero} /><p className="chart-fuente">{anual.nota}</p></div>}
        {mensual && <div className="chart-card"><h3>{nombre} por mes (últimos 2 años)</h3><LineChart series={[{ label: nombre, color: accent.pink, points: mensual.puntos }]} formatValue={numero} /></div>}
      </div>
    </section>
  );
}

function useChipSelector(opciones) {
  const [v, set] = useState(opciones[0][0]);
  const nombre = opciones.find(([k]) => k === v)?.[1];
  return [{ v, set }, nombre];
}

function SiscSection({ tema }) {
  const [clave, nombre] = useChipSelector(SISC);
  const { datos: barrios } = useJsonEstatico('/data/geo/seguridad_barrios.json');
  const ranking = tema.listas[`sisc_ranking_${clave.v}`] ?? [];
  const barData = useMemo(() => ranking.map((r) => ({
    label: r.nombre, value: r.casos, note: r.tasa_x10mil != null ? `${r.tasa_x10mil} por 10.000 hab. (DAP)` : 'población no disponible para esta comuna'
  })), [ranking]);
  const ventana = tema.cifras[`sisc_${clave.v}_ventana`];

  return (
    <section className="sec-block">
      <div className="section-heading"><div><p className="eyebrow">SISC · HISTÓRICO GEORREFERENCIADO</p><h2>Ranking por comuna y mapa por barrio</h2></div>{ventana && <span>{ventana.vigencia}</span>}</div>
      <p className="sec-note">Registros del Sistema de Información para la Seguridad y la Convivencia (Alcaldía de Medellín), con coordenadas, barrio y comuna. Su serie más reciente llega hasta 2023: es un histórico, no un dato en vivo, y usa una taxonomía propia que no coincide 1 a 1 con las categorías de la Policía de arriba.</p>
      <div className="chips">{SISC.map(([k, l]) => <button key={k} className={clave.v === k ? 'on' : ''} onClick={() => clave.set(k)}>{l}</button>)}</div>
      <div className="sisc-grid">
        <div className="chart-card">
          <h3>{nombre}: casos por comuna, {ventana?.vigencia}</h3>
          <BarChart data={barData} color={accent.pink} ariaLabel={`${nombre} por comuna`} />
        </div>
        <div className="chart-card">
          <h3>{nombre}: mapa por barrio y vereda</h3>
          <BarrioMap datos={barrios} categoria={clave.v} />
        </div>
      </div>
    </section>
  );
}

export default function SeguridadView({ tema, onSource }) {
  if (!tema) return <section className="view"><p className="lake-message">El tema de seguridad no está disponible. Genera el lago con la ingesta (ver README).</p></section>;
  return (
    <section className="view seguridad-view">
      <div className="view-intro"><p className="eyebrow">MEDELLÍN · SEGURIDAD</p><h1>Seguridad <em>en dos fuentes.</em></h1><p>Cada cifra viene de una sola fuente, con su fuente, su vigencia y su estado. La Policía Nacional y el SISC de la Alcaldía no se mezclan nunca en una misma serie: cúbrelas por separado abajo.</p></div>
      <div className="warning-note"><span>⚠</span><p>La serie de la Policía (2018–hoy) y el histórico del SISC (2003–2023) miden delitos con metodologías distintas y no son comparables entre sí. Una diferencia entre ambas para el mismo año no es un error de captura.</p></div>
      <PoliciaSection tema={tema} onSource={onSource} />
      <SiscSection tema={tema} />
    </section>
  );
}
