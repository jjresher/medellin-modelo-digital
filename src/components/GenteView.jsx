'use client';

import LineChart from './charts/LineChart';
import { accent } from './charts/tokens';
import Estratos from './gente/Estratos';
import Piramide from './gente/Piramide';
import MetricCard from './MetricCard';
import PanelTerritorios, { Procedencia } from './territorios/PanelTerritorios';

// Sección Gente. Todo sale del tema `demografia` del lago: cifras de ciudad, la pirámide del DANE y, por cada
// comuna y corregimiento, los indicadores con su propia fuente, vigencia y estado (listas `indicadores` y `territorios`).

const CIFRAS_CIUDAD = ['poblacion', 'poblacion_cabecera', 'poblacion_rural', 'hogares', 'viviendas', 'personas_por_hogar', 'edad_mediana', 'poblacion_60_mas'];
const CIFRAS_SALUD = ['natalidad_total', 'mortalidad_total', 'dengue_total'];
const SELECTOR = [
  ['poblacion', 'Población'],
  ['hogares', 'Hogares'],
  ['viviendas', 'Viviendas'],
  ['imcv', 'IMCV'],
  ['pobreza_multidimensional', 'Pobreza multidimensional'],
  ['idh', 'IDH'],
  ['natalidad_tasa', 'Natalidad'],
  ['mortalidad_tasa', 'Mortalidad'],
  ['dengue_tasa', 'Dengue']
];
const FICHA = ['poblacion', 'hogares', 'viviendas', 'imcv', 'pobreza_multidimensional', 'idh', 'natalidad_tasa', 'mortalidad_tasa', 'dengue_tasa'];

const pick = (tema, clave) => (tema.cifras[clave] ? { ...tema.cifras[clave], clave, tema: 'demografia' } : null);
const formato = (valor, decimales = 0) => Number(valor).toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

function BloqueEstratos({ tema, onSource }) {
  const { indicadores = [], territorios = [] } = tema.listas;
  const ind = indicadores.find((i) => i.clave === 'estrato_1');
  if (!ind) return null;
  const valores = (t) => [1, 2, 3, 4, 5, 6].map((e) => {
    const serie = t.valores[`estrato_${e}`] ?? {};
    return serie[Object.keys(serie).sort().at(-1)] ?? 0;
  });
  const ciudad = [1, 2, 3, 4, 5, 6].map((e) => tema.cifras[`manzanas_estrato_${e}`]?.valor ?? 0);
  const filas = [
    ...(ciudad.some(Boolean) ? [{ nombre: 'Medellín', valores: ciudad, ciudad: true }] : []),
    ...territorios.filter((t) => t.valores.estrato_1).map((t) => ({ nombre: t.nombre, valores: valores(t) }))
  ];
  const total = pick(tema, 'manzanas_estratificadas');
  return (
    <section className="sec-block">
      <div className="section-heading"><div><p className="eyebrow">CATASTRO · ESTRATIFICACIÓN POR MANZANA</p><h2>Estratos socioeconómicos</h2></div></div>
      <p className="sec-note">Proporción de manzanas de cada estrato, del 1 (bajo-bajo) al 6 (alto). Cuenta manzanas, no viviendas ni personas: una manzana grande y una pequeña pesan lo mismo.{total && ` Base: ${formato(total.valor)} manzanas con estrato asignado.`}</p>
      <Procedencia indicador={ind} fuentes={tema.fuentes} onSource={onSource} />
      <div className="chart-card"><Estratos filas={filas} /></div>
    </section>
  );
}

export default function GenteView({ tema, onSource }) {
  if (!tema) return <section className="view"><p className="lake-message">El tema de gente no está disponible. Genera el lago con la ingesta (ver README).</p></section>;
  const ciudad = CIFRAS_CIUDAD.map((k) => pick(tema, k)).filter(Boolean);
  const salud = CIFRAS_SALUD.map((k) => pick(tema, k)).filter(Boolean);
  const serie = tema.series.poblacion_total;
  const piramide = tema.listas.piramide ?? [];
  const dap = tema.cifras.poblacion_dap;
  const dane = tema.cifras.poblacion;

  return (
    <section className="view gente-view">
      <div className="view-intro"><p className="eyebrow">MEDELLÍN · GENTE</p><h1>Quién vive <em>en Medellín.</em></h1><p>Población, edades, hogares y condiciones de vida de la ciudad y de cada comuna y corregimiento. Cada cifra muestra su fuente, su vigencia y su estado.</p></div>
      {dap && dane && (
        <div className="warning-note"><span>⚠</span><p>El total oficial es la proyección del DANE ({formato(dane.valor)} habitantes en {dane.vigencia}). La proyección del DAP por comuna, hecha en 2018, suma {formato(dap.valor)}: se usa solo para repartir el total del DANE entre los territorios, y ese reparto se marca como <span className="estado derivado">derivado</span>.</p></div>
      )}
      {ciudad.length > 0 && <div className="metrics-grid">{ciudad.map((c) => <MetricCard key={c.clave} cifra={c} onSource={onSource} />)}</div>}

      {(serie || piramide.length > 0) && (
        <section className="sec-block">
          <div className="section-heading"><div><p className="eyebrow">DANE · PROYECCIONES PPED (JULIO DE 2025)</p><h2>Población y edades</h2></div></div>
          <div className="chart-grid">
            {serie && <div className="chart-card"><h3>Población de Medellín, {serie.vigencia}</h3><LineChart series={[{ label: 'Población', color: accent.green, points: serie.puntos }]} formatValue={(v) => (v ? `${formato(v / 1e6, 2)} M` : '0')} /><p className="chart-fuente">{serie.nota}</p></div>}
            {piramide.length > 0 && <div className="chart-card"><h3>Pirámide de población por grupos de edad</h3><Piramide filas={piramide} /></div>}
          </div>
        </section>
      )}

      <PanelTerritorios tema={tema} onSource={onSource} selector={SELECTOR} ficha={FICHA} />
      <BloqueEstratos tema={tema} onSource={onSource} />

      {salud.length > 0 && (
        <section className="sec-block">
          <div className="section-heading"><div><p className="eyebrow">SECRETARÍA DE SALUD · SIVIGILA</p><h2>Eventos de salud</h2></div><span>{salud[0].vigencia}</span></div>
          <p className="sec-note">El servicio de la Alcaldía se rotula "vigente", pero sus datos llegan hasta {salud[0].vigencia}. La tasa por comuna está en el selector de territorios (Natalidad, Mortalidad y Dengue).</p>
          <div className="metrics-grid compact">{salud.map((c) => <MetricCard key={c.clave} cifra={c} onSource={onSource} />)}</div>
        </section>
      )}
    </section>
  );
}
