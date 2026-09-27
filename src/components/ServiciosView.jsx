'use client';

import { useMemo, useState } from 'react';
import BarChart from './charts/BarChart';
import LineChart from './charts/LineChart';
import { accent, textMuted } from './charts/tokens';
import MetricCard from './MetricCard';
import MapaTerritorios from './territorios/MapaTerritorios';
import PanelTerritorios, { formato } from './territorios/PanelTerritorios';

// Sección Servicios públicos. Todo sale del tema `servicios` del lago. Lo vigente (tarifas de EPM, ECA de la
// Superservicios e internet del MinTIC) va arriba; la cobertura (hasta 2019) y los suscriptores y subsidios (hasta 2023)
// de MEData van rotulados como históricos.

const pick = (tema, clave) => (tema.cifras[clave] ? { ...tema.cifras[clave], clave, tema: 'servicios' } : null);
const tarjetas = (tema, claves) => claves.map((k) => pick(tema, k)).filter(Boolean);
const pesos = (v, d = 2) => `$${formato(v, d)}`;
const SERVICIOS = [['acueducto', 'Acueducto'], ['alcantarillado', 'Alcantarillado'], ['aseo', 'Aseo']];

function Tarjetas({ cifras, onSource, compact = true }) {
  if (!cifras.length) return null;
  return <div className={`metrics-grid ${compact ? 'compact' : ''}`}>{cifras.map((c) => <MetricCard key={c.clave} cifra={c} onSource={onSource} />)}</div>;
}

function Encabezado({ eyebrow, titulo, vigencia }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{titulo}</h2></div>{vigencia && <span>{vigencia}</span>}</div>;
}

// Estrato 1 (con subsidio) contra estrato 4 (tarifa plena): acento contra gris, no dos acentos.
function SerieEstratos({ e1, e4, titulo, unidad, nota }) {
  if (!e1 || !e4) return null;
  return (
    <div className="chart-card">
      <h3>{titulo}, {e4.vigencia}</h3>
      <LineChart series={[{ label: 'Estrato 4 (tarifa plena)', color: textMuted, dashed: true, points: e4.puntos }, { label: 'Estrato 1', color: accent.cyan, points: e1.puntos }]}
        unit={unidad} formatValue={(v) => formato(v, 0)} ariaLabel={titulo} />
      <p className="chart-fuente">{nota}</p>
    </div>
  );
}

function Tarifas({ tema, onSource }) {
  const agua = tema.listas.tarifas_agua ?? [];
  const gas = tema.listas.tarifas_gas ?? [];
  const energia = tema.listas.tarifas_energia ?? [];
  const cifras = tarjetas(tema, ['tarifa_acueducto_e1', 'tarifa_acueducto_e4', 'tarifa_energia_e1', 'tarifa_energia_e4', 'tarifa_gas_e1', 'tarifa_gas_e4']);
  if (!cifras.length) return null;
  const aguaDe = (servicio, estrato) => agua.find((a) => a.servicio === servicio && a.estrato === estrato);
  // La publicación de energía junta los estratos 5 y 6 en una sola fila.
  const energiaDe = (estrato) => energia.find((e) => e.estrato.split(' y ').includes(estrato) && e.rango !== 'Rango > CS');
  const gasDe = (estrato) => gas.find((g) => g.estrato === estrato);
  const celda = (v, d = 2) => (v == null ? '—' : pesos(v, d));
  return (
    <section className="sec-block">
      <Encabezado eyebrow="EMPRESAS PÚBLICAS DE MEDELLÍN" titulo="Tarifas vigentes por estrato" vigencia="Última publicación de cada servicio" />
      <p className="sec-note">Lo que cobra EPM a los hogares, con el subsidio o la contribución de cada estrato ya aplicado. Los estratos 1 y 2 reciben subsidio sobre el consumo básico o de subsistencia (el 3 también en agua y energía, no en gas); el estrato 4 paga la tarifa plena, y los estratos 5 y 6, una contribución adicional. La tarifa de energía se toma de la publicación mensual de EPM en PDF (estado <span className="estado declarado">declarado</span>): los datos abiertos de energía de EPM terminan en 2021.</p>
      <Tarjetas cifras={cifras} onSource={onSource} />
      <div className="chart-card tabla-card">
        <h3>Tarifa por estrato</h3>
        <table className="chart-table servicios-tabla">
          <thead>
            <tr><th>Estrato</th><th>Acueducto, consumo básico ($/m³)</th><th>Alcantarillado, vertimiento básico ($/m³)</th><th>Energía, consumo de subsistencia ($/kWh)</th><th>Gas, hasta 20 m³ ($/m³)</th></tr>
            <tr className="periodos"><th /><th>{agua[0]?.periodo}</th><th>{agua[0]?.periodo}</th><th>{energia[0]?.periodo}</th><th>{gas[0]?.periodo}</th></tr>
          </thead>
          <tbody>{['1', '2', '3', '4', '5', '6'].map((e) => (
            <tr key={e}>
              <td>{e}</td>
              <td>{celda(aguaDe('Acueducto', e)?.consumo_basico)}</td>
              <td>{celda(aguaDe('Alcantarillado', e)?.consumo_basico)}</td>
              <td>{celda(energiaDe(e)?.tarifa)}</td>
              <td>{celda(gasDe(e)?.consumo_hasta_20)}</td>
            </tr>
          ))}</tbody>
        </table>
        <p className="chart-fuente">Cada servicio tiene su propia vigencia (fila gris). Energía: hogares en baja tensión conectados a activos de EPM; en los estratos 4, 5 y 6 la tarifa es la misma para todo el consumo. Agua: cargo por el consumo básico; el consumo superior y el cargo fijo mensual están en la fuente. Gas: mercado del Valle de Aburrá.</p>
      </div>
      <div className="chart-grid">
        <SerieEstratos e1={tema.series.acueducto_consumo_e1} e4={tema.series.acueducto_consumo_e4} titulo="Acueducto: consumo básico" unidad="$/m³" nota="Pesos corrientes por m³. La línea gris es la tarifa plena (estrato 4)." />
        <SerieEstratos e1={tema.series.gas_consumo_e1} e4={tema.series.gas_consumo_e4} titulo="Gas natural: hasta 20 m³" unidad="$/m³" nota="Pesos corrientes por m³. La línea gris es la tarifa plena (estrato 4)." />
        <SerieEstratos e1={tema.series.energia_e1} e4={tema.series.energia_e4} titulo="Energía" unidad="$/kWh" nota="Estrato 1: consumo de subsistencia. Estrato 4: costo unitario, sin subsidio ni contribución. Solo los meses publicados en la página de EPM." />
      </div>
    </section>
  );
}

function Cobertura({ tema, onSource }) {
  const territorios = tema.listas.territorios ?? [];
  const estratos = tema.listas.cobertura_por_estrato ?? [];
  const [servicio, setServicio] = useState('acueducto');
  const [codigo, setCodigo] = useState(null);
  const clave = `cobertura_${servicio}`;
  const anio = useMemo(() => territorios.flatMap((t) => Object.keys(t.valores[clave] ?? {})).sort().at(-1), [territorios, clave]);
  const valores = useMemo(() => Object.fromEntries(territorios.map((t) => [t.codigo, t.valores[clave]?.[anio] ?? null])), [territorios, clave, anio]);
  const cifras = tarjetas(tema, SERVICIOS.map(([k]) => `cobertura_${k}`));
  if (!cifras.length) return null;
  const fmt = (v) => `${formato(v, 1)} %`;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="SUBSECRETARÍA DE SERVICIOS PÚBLICOS · MEDATA" titulo="Cobertura de acueducto, alcantarillado y aseo" vigencia="Histórico" />
      <div className="warning-note"><span>⚠</span><p>Histórico: el reporte abierto de cobertura por comuna y estrato llega al 31 de diciembre de {anio}. Es la proporción de viviendas con suscripción al servicio, según las viviendas que estima la fuente; no incluye energía ni gas.</p></div>
      <Tarjetas cifras={cifras} onSource={onSource} compact={false} />
      <div className="chart-grid">
        <div className="chart-card">
          <div className="card-controls">
            <h3>Cobertura por territorio, {anio}</h3>
            <div className="chips">{SERVICIOS.map(([k, l]) => <button key={k} className={servicio === k ? 'on' : ''} onClick={() => setServicio(k)}>{l}</button>)}</div>
          </div>
          <MapaTerritorios valores={valores} etiqueta={`Cobertura ${anio}`} formatValue={fmt} color={accent.cyan} seleccionado={codigo} onSelect={setCodigo} height={380} />
          <p className="chart-fuente">Toca un territorio para ver su valor. La cobertura del territorio suma los suscriptores y las viviendas de todos sus estratos.</p>
        </div>
        {estratos.length > 0 && (
          <div className="chart-card tabla-card">
            <h3>Cobertura de la ciudad por estrato, {estratos[0].anio}</h3>
            <table className="chart-table servicios-tabla">
              <thead><tr><th>Estrato</th>{SERVICIOS.map(([k, l]) => <th key={k}>{l}</th>)}<th>Suscriptores de acueducto</th></tr></thead>
              <tbody>{estratos.map((e) => <tr key={e.estrato}><td>{e.estrato}</td>{SERVICIOS.map(([k]) => <td key={k}>{e[k] == null ? '—' : fmt(e[k])}</td>)}<td>{formato(e.suscriptores_acueducto)}</td></tr>)}</tbody>
            </table>
            <p className="chart-fuente">Un valor por encima de 100 % significa que hay más suscriptores que viviendas estimadas en ese estrato: la base de viviendas es una estimación y la estratificación de las facturas no siempre coincide con la de la vivienda. La fuente publica así el dato.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function SuscriptoresSubsidios({ tema, onSource }) {
  const usos = tema.listas.suscriptores_epm_por_uso ?? [];
  const serie = (prefijo, nombre) => {
    const s = tema.series[`${prefijo}_subsidios_mensual`];
    const c = tema.series[`${prefijo}_contribuciones_mensual`];
    if (!s || !c) return null;
    return (
      <div className="chart-card">
        <h3>{nombre}: subsidios y contribuciones por mes, {s.vigencia}</h3>
        <LineChart series={[{ label: 'Contribuciones', color: textMuted, dashed: true, points: c.puntos }, { label: 'Subsidios', color: accent.cyan, points: s.puntos }]} unit="millones de $" formatValue={(v) => formato(v)} ariaLabel={`${nombre}: subsidios y contribuciones`} />
        <p className="chart-fuente">Millones de pesos corrientes. Las contribuciones financian parte de los subsidios; la diferencia la cubre el Fondo de Solidaridad y Redistribución de Ingresos del Distrito.</p>
      </div>
    );
  };
  const cifras = tarjetas(tema, ['suscriptores_epm_acueducto', 'suscriptores_epm_alcantarillado', 'suscriptores_aseo', 'suscriptores_pequenos', 'pequenos_prestadores']);
  if (!cifras.length) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="SUBSECRETARÍA DE SERVICIOS PÚBLICOS · MEDATA" titulo="Suscriptores, subsidios y contribuciones" vigencia="Histórico" />
      <div className="warning-note"><span>⚠</span><p>Histórico: los reportes abiertos de suscriptores, subsidios y contribuciones terminan en {tema.cifras.suscriptores_epm_acueducto?.vigencia.replace(' (histórico)', '') ?? 'agosto de 2023'}. Acueducto y alcantarillado son de EPM (y de los pequeños prestadores de los corregimientos); aseo, de Emvarias.</p></div>
      <Tarjetas cifras={cifras} onSource={onSource} />
      <Tarjetas cifras={tarjetas(tema, ['epm_subsidios', 'epm_contribuciones', 'epm_subsidiados', 'aseo_subsidios', 'aseo_contribuciones', 'aseo_subsidiados'])} onSource={onSource} />
      <div className="chart-grid">
        {serie('epm', 'EPM, acueducto y alcantarillado')}
        {serie('aseo', 'Emvarias, aseo')}
        {tema.series.suscriptores_epm_acueducto && <div className="chart-card"><h3>Suscriptores de acueducto de EPM, {tema.series.suscriptores_epm_acueducto.vigencia}</h3><LineChart series={[{ label: 'Suscriptores', color: accent.cyan, points: tema.series.suscriptores_epm_acueducto.puntos }]} formatValue={(v) => formato(v)} desdeCero={false} ariaLabel="Suscriptores de acueducto de EPM por mes" /><p className="chart-fuente">El eje no empieza en cero. Todos los usos: residencial, comercial, industrial, oficial y especial.</p></div>}
        {usos.length > 0 && <div className="chart-card"><h3>Suscriptores de acueducto de EPM por uso, {usos[0].periodo}</h3><BarChart data={usos.map((u) => ({ label: u.uso, value: u.suscriptores, note: `Consumo básico: ${formato(u.consumo_basico_m3)} m³ en el mes` }))} color={accent.cyan} formatValue={(v) => formato(v)} ariaLabel="Suscriptores de acueducto por uso" /><p className="chart-fuente">Pasa el cursor por cada barra para ver el consumo básico del mes.</p></div>}
      </div>
    </section>
  );
}

function Aprovechamiento({ tema, onSource }) {
  const ecas = tema.listas.ecas ?? [];
  const orgs = tema.listas.organizaciones_recicladoras ?? [];
  const [todas, setTodas] = useState(false);
  const cifras = tarjetas(tema, ['ecas', 'ecas_capacidad', 'ecas_prestadores', 'ecas_suelo_compatible', 'organizaciones_recicladoras']);
  if (!cifras.length) return null;
  const visibles = todas ? ecas : ecas.slice(0, 12);
  return (
    <section className="sec-block">
      <Encabezado eyebrow="SUPERSERVICIOS · MEDATA" titulo="Reciclaje y aprovechamiento" vigencia={tema.cifras.ecas?.vigencia} />
      <p className="sec-note">Las estaciones de clasificación y aprovechamiento (ECA) son las bodegas donde se pesa, clasifica y vende el material reciclable que recogen los recicladores de oficio. El registro es de la Superservicios; las organizaciones de recicladores, de la Alcaldía.</p>
      <Tarjetas cifras={cifras} onSource={onSource} />
      {ecas.length > 0 && (
        <div className="chart-card tabla-card">
          <h3>ECA en operación, por capacidad</h3>
          <table className="chart-table servicios-ecas">
            <thead><tr><th>ECA</th><th>Prestador</th><th>En operación desde</th><th>Suelo compatible</th><th>Capacidad (t/mes)</th></tr></thead>
            <tbody>{visibles.map((e, i) => <tr key={i}><td>{e.nombre}</td><td>{e.prestador}</td><td>{e.inicio}</td><td>{e.suelo_compatible ? 'Sí' : 'No'}</td><td>{formato(e.capacidad)}</td></tr>)}</tbody>
          </table>
          {ecas.length > 12 && <button className="link-fuente" onClick={() => setTodas((v) => !v)}>{todas ? 'Ver solo las 12 de mayor capacidad' : `Ver las ${ecas.length}`}</button>}
          <p className="chart-fuente">Capacidad de operación declarada por cada prestador, en toneladas al mes.</p>
        </div>
      )}
      {orgs.length > 0 && (
        <div className="chart-card tabla-card">
          <h3>Organizaciones de recicladores registradas ante la Alcaldía ({orgs.length})</h3>
          <ul className="lista-organizaciones">{orgs.map((o) => <li key={o.nombre}>{o.nombre}<small>{o.direccion}</small></li>)}</ul>
          <p className="chart-fuente">{tema.cifras.organizaciones_recicladoras?.vigencia}.</p>
        </div>
      )}
    </section>
  );
}

function Internet({ tema, onSource }) {
  const serie = tema.series.internet_fijo_trimestral;
  const segmentos = tema.listas.internet_por_segmento ?? [];
  const cifras = tarjetas(tema, ['internet_fijo', 'internet_fijo_residencial', 'internet_fijo_comuna']);
  if (!cifras.length) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="MINISTERIO TIC" titulo="Internet fijo" vigencia={tema.cifras.internet_fijo?.vigencia} />
      <p className="sec-note">Accesos (conexiones) reportados por los operadores cada trimestre: no son hogares ni personas. El MinTIC los publica por municipio; por comuna no hay un dato abierto, así que esa cifra aparece como <span className="estado candidato">candidato</span> en vez de omitirse.</p>
      <Tarjetas cifras={cifras} onSource={onSource} compact={false} />
      <div className="chart-grid">
        {serie && <div className="chart-card"><h3>Accesos a internet fijo, {serie.vigencia}</h3><LineChart series={[{ label: 'Accesos', color: accent.cyan, points: serie.puntos }]} formatValue={(v) => formato(v)} desdeCero={false} ariaLabel="Accesos a internet fijo por trimestre" /><p className="chart-fuente">El eje no empieza en cero. Un punto por trimestre.</p></div>}
        {segmentos.length > 0 && <div className="chart-card"><h3>Accesos por segmento, {segmentos[0].periodo}</h3><BarChart data={segmentos.map((s) => ({ label: s.segmento, value: s.accesos }))} color={accent.cyan} formatValue={(v) => formato(v)} ariaLabel="Accesos a internet fijo por segmento" /><p className="chart-fuente">El estrato es el que reporta el operador para cada conexión residencial.</p></div>}
      </div>
    </section>
  );
}

export default function ServiciosView({ tema, onSource }) {
  if (!tema) return <section className="view"><p className="lake-message">El tema de servicios públicos no está disponible. Genera el lago con la ingesta (ver README).</p></section>;
  return (
    <section className="view servicios-view">
      <div className="view-intro"><p className="eyebrow">MEDELLÍN · SERVICIOS PÚBLICOS</p><h1>Agua, luz, gas, <em>aseo e internet.</em></h1><p>Tarifas vigentes por estrato, cobertura por comuna, suscriptores y subsidios, reciclaje y conexiones a internet. Cada cifra muestra su fuente, su vigencia y su estado.</p></div>
      <Tarifas tema={tema} onSource={onSource} />
      <Cobertura tema={tema} onSource={onSource} />
      <PanelTerritorios tema={tema} onSource={onSource} color={accent.cyan} titulo="Cobertura y suscriptores por territorio"
        selector={[['cobertura_acueducto', 'Acueducto'], ['cobertura_alcantarillado', 'Alcantarillado'], ['cobertura_aseo', 'Aseo'], ['suscriptores_acueducto', 'Suscriptores'], ['suscriptores_pequenos', 'Pequeños prestadores']]} />
      <SuscriptoresSubsidios tema={tema} onSource={onSource} />
      <Aprovechamiento tema={tema} onSource={onSource} />
      <Internet tema={tema} onSource={onSource} />
    </section>
  );
}
