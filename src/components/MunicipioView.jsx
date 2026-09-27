'use client';

import { useMemo, useState } from 'react';
import BarChart from './charts/BarChart';
import LineChart from './charts/LineChart';
import { accent, textMuted } from './charts/tokens';
import MetricCard from './MetricCard';
import MapaTerritorios from './territorios/MapaTerritorios';
import PanelTerritorios, { formato } from './territorios/PanelTerritorios';

// Sección Municipio. Todo sale del tema `municipio` del lago: presupuesto del Distrito (CUIPO), inversión por comuna
// (Planeación), contratación (SECOP II), Concejo y el histórico del predial por comuna de cobro (MEData).

const pick = (tema, clave) => (tema.cifras[clave] ? { ...tema.cifras[clave], clave, tema: 'municipio' } : null);
const tarjetas = (tema, claves) => claves.map((k) => pick(tema, k)).filter(Boolean);
// Pesos con la escala que corresponde: billones (10¹²), miles de millones o millones.
const pesos = (v) => {
  const a = Math.abs(v);
  if (a >= 1e12) return `$${formato(v / 1e12, 2)} billones`;
  if (a >= 1e9) return `$${formato(v / 1e9, 1)} mil millones`;
  return `$${formato(v / 1e6, 0)} millones`;
};

function Tarjetas({ cifras, onSource, compact = true }) {
  if (!cifras.length) return null;
  return <div className={`metrics-grid ${compact ? 'compact' : ''}`}>{cifras.map((c) => <MetricCard key={c.clave} cifra={c} onSource={onSource} />)}</div>;
}

function Encabezado({ eyebrow, titulo, vigencia }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{titulo}</h2></div>{vigencia && <span>{vigencia}</span>}</div>;
}

function Presupuesto({ tema, onSource }) {
  const anual = tema.listas.presupuesto_anual ?? [];
  const composicion = (tema.listas.ingresos_composicion ?? []).filter((c) => ['1.1.01', '1.1.02', '1.2'].includes(c.cuenta));
  const sectores = tema.listas.inversion_por_sector ?? [];
  const actual = anual.at(-1);
  const completo = [...anual].reverse().find((a) => a.completo);
  if (!anual.length) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="CONTRALORÍA · CUIPO" titulo="Presupuesto del Distrito" vigencia={actual && !actual.completo ? `Corte ${actual.corte}` : actual?.corte} />
      <p className="sec-note">Lo que el Distrito reporta cada trimestre a la Contraloría (CUIPO): administración central, Concejo, Personería y Contraloría, sin los establecimientos públicos. El presupuesto <b>inicial</b> es el aprobado por el Concejo; el <b>definitivo</b> suma las adiciones y reducciones del año. Los <b>compromisos</b> son contratos y obligaciones adquiridas, y los <b>pagos</b>, lo girado. Solo cuenta la vigencia de cada año (con las vigencias futuras que se ejecutan en él), no las reservas de años anteriores. Pesos corrientes.</p>
      <Tarjetas cifras={tarjetas(tema, ['presupuesto_inicial', 'presupuesto_definitivo_actual', 'ingresos_recaudados_actual', 'gastos_comprometidos_actual'])} onSource={onSource} compact={false} />
      {completo && <h3 className="subtitulo-bloque">Año completo: {completo.anio}</h3>}
      <Tarjetas cifras={tarjetas(tema, ['presupuesto_definitivo', 'gastos_comprometidos', 'ejecucion_gastos', 'inversion_comprometida', 'ingresos_recaudados', 'predial_recaudo', 'ica_recaudo'])} onSource={onSource} />
      <div className="chart-card tabla-card">
        <h3>Presupuesto por año (billones de pesos)</h3>
        <table className="chart-table municipio-tabla">
          <thead><tr><th>Año</th><th>Inicial</th><th>Definitivo</th><th>Comprometido</th><th>Pagado</th><th>Inversión comprometida</th><th>Ingresos recaudados</th></tr></thead>
          <tbody>{anual.map((a) => (
            <tr key={a.anio}>
              <td>{a.anio}{!a.completo && <small> · hasta {a.corte}</small>}</td>
              {[a.gastos_inicial, a.gastos_definitivo, a.compromisos, a.pagos, a.inversion_compromisos, a.recaudo].map((v, i) => <td key={i}>{formato(v / 1e12, 2)}</td>)}
            </tr>
          ))}</tbody>
        </table>
        <p className="chart-fuente">El año en curso es acumulado de enero al último trimestre reportado. El recaudo puede superar el presupuesto inicial porque incluye recursos de capital (crédito, excedentes de EPM, rendimientos) que se adicionan durante el año.</p>
      </div>
      <div className="chart-grid">
        {composicion.length > 0 && <div className="chart-card"><h3>Ingresos recaudados por tipo, {completo?.anio}</h3><BarChart data={composicion.map((c) => ({ label: c.nombre, value: c.recaudo }))} color={accent.orange} formatValue={pesos} ariaLabel="Ingresos recaudados por tipo" /><p className="chart-fuente">Tributarios: impuestos (predial, industria y comercio…). No tributarios: transferencias de la Nación, tasas, multas y contribuciones. Recursos de capital: crédito, excedentes de EPM y rendimientos financieros.</p></div>}
        {sectores.length > 0 && <div className="chart-card"><h3>Inversión comprometida por sector, {sectores[0].anio}</h3><BarChart data={sectores.map((s) => ({ label: s.sector, value: s.compromisos }))} color={accent.orange} formatValue={pesos} ariaLabel="Inversión comprometida por sector" /><p className="chart-fuente">Sector según el catálogo de programas de la MGA (DNP), que es como se clasifica cada proyecto de inversión.</p></div>}
      </div>
    </section>
  );
}

function InversionTerritorial({ tema, onSource }) {
  const serie = tema.series.inversion_comunas_anual;
  const territorios = tema.listas.territorios ?? [];
  const anios = useMemo(() => [...new Set(territorios.flatMap((t) => Object.keys(t.valores.inversion_publica ?? {})))].sort(), [territorios]);
  const [anio, setAnio] = useState(anios.at(-1));
  const [medida, setMedida] = useState('inversion_publica');
  const [codigo, setCodigo] = useState(null);
  const valores = useMemo(() => Object.fromEntries(territorios.map((t) => [t.codigo, t.valores[medida]?.[anio] ?? null])), [territorios, medida, anio]);
  if (!serie || !anios.length) return null;
  const esMonto = medida === 'inversion_publica';
  const fmt = esMonto ? (v) => pesos(v * 1e6) : (v) => `${formato(v, 1)} %`;
  // La leyenda es angosta: montos en miles de millones sin la palabra completa.
  const corto = esMonto ? (v) => `$${formato(v / 1e3, 0)} mil M` : fmt;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="DEPARTAMENTO ADMINISTRATIVO DE PLANEACIÓN" titulo="Inversión pública por comuna y corregimiento" vigencia={serie.vigencia} />
      <p className="sec-note">Inversión ordenada (facturada o pagada) de cada año, con corte al 31 de diciembre, repartida según dónde se ejecutan los proyectos. Pesos corrientes, sin ajustar por inflación: los montos de años distintos no son comparables en términos reales; la participación de cada territorio en el total del año sí lo es.</p>
      <Tarjetas cifras={tarjetas(tema, ['inversion_comunas'])} onSource={onSource} compact={false} />
      <div className="chart-grid">
        <div className="chart-card">
          <h3>Inversión localizada en los 21 territorios, {serie.vigencia}</h3>
          <LineChart series={[{ label: 'Inversión', color: accent.orange, points: serie.puntos }]} unit="billones de $" formatValue={(v) => formato(v, 2)} ariaLabel="Inversión pública localizada por año" />
          <p className="chart-fuente">Billones de pesos corrientes. Suma de las 16 comunas y los 5 corregimientos.</p>
        </div>
        <div className="chart-card">
          <div className="card-controls">
            <div className="chips">{[['inversion_publica', 'Monto'], ['inversion_participacion', 'Participación']].map(([k, l]) => <button key={k} className={medida === k ? 'on' : ''} onClick={() => setMedida(k)}>{l}</button>)}</div>
            <label className="selector-estacion">Año
              <select value={anio} onChange={(e) => setAnio(e.target.value)}>{anios.map((a) => <option key={a} value={a}>{a}</option>)}</select>
            </label>
          </div>
          <MapaTerritorios valores={valores} etiqueta={esMonto ? `Inversión ${anio}` : `Participación ${anio}`} formatValue={fmt} formatLegend={corto} color={accent.orange} seleccionado={codigo} onSelect={setCodigo} height={360} />
          <p className="chart-fuente">Toca un territorio para ver su valor.</p>
        </div>
      </div>
    </section>
  );
}

function Predial({ tema, onSource }) {
  const cifra = pick(tema, 'predial_facturado');
  const conjunto = tema.listas.predial_san_cristobal_palmitas ?? [];
  if (!cifra) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="SECRETARÍA DE HACIENDA · MEDATA" titulo="Impuesto predial por comuna de cobro" vigencia="Histórico" />
      <div className="warning-note"><span>⚠</span><p>Histórico: el archivo abierto solo trae la facturación de 2019 y 2020. Es el impuesto <b>facturado</b> (no el recaudado) y se agrupa por la comuna a la que se envía el cobro, que no siempre es donde está el predio. San Cristóbal y Palmitas se facturan juntos{conjunto.length > 0 && ` (${conjunto.map((c) => `${pesos(c.valor)} en ${c.anio}`).join('; ')})`} y por eso aparecen sin dato en el ranking. El recaudo actual de toda la ciudad está en el bloque de presupuesto.</p></div>
      <Tarjetas cifras={[cifra]} onSource={onSource} compact={false} />
    </section>
  );
}

function Contratacion({ tema, onSource }) {
  const [vista, setVista] = useState('contratos');
  const contratos = tema.series.contratos_secop_anual;
  const valor = tema.series.valor_secop_anual;
  const tipos = tema.listas.secop_por_tipo ?? [];
  const mayores = tema.listas.secop_mayores ?? [];
  const serie = vista === 'contratos' ? contratos : valor;
  if (!contratos && !valor) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="COLOMBIA COMPRA EFICIENTE · SECOP II" titulo="Contratación" vigencia={tema.cifras.contratos_secop_actual?.vigencia} />
      <p className="sec-note">{contratos?.nota}</p>
      <Tarjetas cifras={tarjetas(tema, ['contratos_secop', 'valor_secop', 'contratos_secop_actual'])} onSource={onSource} compact={false} />
      <div className="chart-grid">
        {serie && (
          <div className="chart-card">
            <div className="card-controls">
              <h3>{vista === 'contratos' ? 'Contratos firmados' : 'Valor contratado (billones de $)'}, {serie.vigencia}</h3>
              {contratos && valor && <div className="chips">{[['contratos', 'Número'], ['valor', 'Valor']].map(([k, l]) => <button key={k} className={vista === k ? 'on' : ''} onClick={() => setVista(k)}>{l}</button>)}</div>}
            </div>
            <LineChart series={[{ label: vista === 'contratos' ? 'Contratos' : 'Valor', color: accent.orange, points: serie.puntos }]} unit={serie.unidad} formatValue={(v) => formato(v, vista === 'contratos' ? 0 : 2)} ariaLabel="Contratación del Distrito en SECOP II por año" />
            <p className="chart-fuente">Por año de firma. Valor inicial del contrato, en pesos corrientes; no incluye adiciones.</p>
          </div>
        )}
        {tipos.length > 0 && <div className="chart-card"><h3>Valor por tipo de contrato, {tipos[0].anio}</h3><BarChart data={tipos.map((t) => ({ label: t.tipo, value: t.valor, note: `${formato(t.contratos)} contratos` }))} color={accent.orange} formatValue={pesos} ariaLabel="Valor contratado por tipo de contrato" /><p className="chart-fuente">"Otro" agrupa sobre todo contratos y convenios interadministrativos, es decir, con otras entidades públicas. Pasa el cursor por cada barra para ver el número de contratos.</p></div>}
      </div>
      {mayores.length > 0 && (
        <div className="chart-card tabla-card">
          <h3>Los {mayores.length} contratos de mayor valor, {tipos[0]?.anio}</h3>
          <table className="chart-table municipio-contratos">
            <thead><tr><th>Objeto</th><th>Tipo</th><th>Contratista</th><th>Firma</th><th>Valor</th></tr></thead>
            <tbody>{mayores.map((c, i) => (
              <tr key={i}>
                <td>{c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.objeto}</a> : c.objeto}</td>
                <td>{c.tipo}</td>
                <td>{c.proveedor}</td>
                <td>{c.fecha}</td>
                <td>{pesos(c.valor)}</td>
              </tr>
            ))}</tbody>
          </table>
          <p className="chart-fuente">Cada objeto enlaza al proceso en SECOP II.</p>
        </div>
      )}
    </section>
  );
}

function Concejo({ tema, onSource }) {
  const acuerdos = tema.series.acuerdos_anual;
  const proyectos = tema.series.proyectos_anual;
  const temas = tema.listas.acuerdos_por_tema ?? [];
  const recientes = tema.listas.acuerdos_recientes ?? [];
  if (!acuerdos && !proyectos) return null;
  const series = [
    proyectos && { label: 'Proyectos radicados', color: textMuted, dashed: true, points: proyectos.puntos },
    acuerdos && { label: 'Acuerdos sancionados', color: accent.orange, points: acuerdos.puntos }
  ].filter(Boolean);
  return (
    <section className="sec-block">
      <Encabezado eyebrow="CONCEJO DE MEDELLÍN" titulo="Acuerdos y proyectos" vigencia={(acuerdos ?? proyectos).vigencia} />
      <p className="sec-note">Un proyecto de acuerdo lo radican el alcalde, los concejales u otras autoridades; si se aprueba en dos debates y el alcalde lo sanciona, se convierte en acuerdo, de obligatorio cumplimiento. Un proyecto radicado un año puede sancionarse al siguiente.</p>
      <Tarjetas cifras={tarjetas(tema, ['acuerdos', 'proyectos', 'proyectos_actual'])} onSource={onSource} compact={false} />
      <div className="chart-grid">
        <div className="chart-card"><h3>Proyectos y acuerdos por año, {(acuerdos ?? proyectos).vigencia}</h3><LineChart series={series} formatValue={(v) => formato(v)} ariaLabel="Proyectos de acuerdo y acuerdos por año" /><p className="chart-fuente">Serie desde 2008, primer año con registro completo en la fuente.</p></div>
        {temas.length > 0 && <div className="chart-card"><h3>Acuerdos por tema desde {temas[0].desde}</h3><BarChart data={temas.map((t) => ({ label: t.tema, value: t.acuerdos }))} color={accent.orange} formatValue={(v) => formato(v)} ariaLabel="Acuerdos por tema" /><p className="chart-fuente">Periodo constitucional en curso. Tema según la clasificación del Concejo.</p></div>}
      </div>
      {recientes.length > 0 && (
        <div className="chart-card tabla-card">
          <h3>Últimos acuerdos sancionados</h3>
          <table className="chart-table municipio-acuerdos">
            <thead><tr><th>Acuerdo</th><th>Título</th><th>Tema</th><th>Sanción</th></tr></thead>
            <tbody>{recientes.map((a) => <tr key={`${a.numero}-${a.anio}`}><td>{a.numero} de {a.anio}</td><td>{a.titulo}</td><td>{a.tema}</td><td>{a.sancion}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function MunicipioView({ tema, onSource }) {
  if (!tema) return <section className="view"><p className="lake-message">El tema de municipio no está disponible. Genera el lago con la ingesta (ver README).</p></section>;
  return (
    <section className="view municipio-view">
      <div className="view-intro"><p className="eyebrow">MEDELLÍN · MUNICIPIO</p><h1>Cuánto entra, <em>cuánto se invierte y dónde.</em></h1><p>Presupuesto del Distrito, inversión por comuna y corregimiento, contratación pública y actividad del Concejo. Cada cifra muestra su fuente, su vigencia y su estado.</p></div>
      <Presupuesto tema={tema} onSource={onSource} />
      <InversionTerritorial tema={tema} onSource={onSource} />
      <PanelTerritorios tema={tema} onSource={onSource} color={accent.orange} titulo="Inversión y predial por territorio"
        selector={[['inversion_publica', 'Inversión'], ['inversion_participacion', 'Participación'], ['predial_facturado', 'Predial facturado']]} />
      <Predial tema={tema} onSource={onSource} />
      <Contratacion tema={tema} onSource={onSource} />
      <Concejo tema={tema} onSource={onSource} />
    </section>
  );
}
