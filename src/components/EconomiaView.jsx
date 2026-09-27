'use client';

import { useState } from 'react';
import BarChart from './charts/BarChart';
import LineChart from './charts/LineChart';
import { accent } from './charts/tokens';
import MetricCard from './MetricCard';
import PanelTerritorios, { formato } from './territorios/PanelTerritorios';

// Sección Economía y vivienda. Todo sale del tema `economia` del lago. Dos pares de fuentes parecidas se muestran
// siempre por separado: la GEIH mide el área metropolitana y no Medellín sola, y el registro de Industria y Comercio
// (contratos del impuesto) no es la estructura empresarial de la Cámara de Comercio (matrículas mercantiles).

const LABORAL = [
  ['desempleo', 'Desempleo'],
  ['ocupacion', 'Ocupación'],
  ['participacion', 'Participación'],
  ['subocupacion', 'Subocupación']
];
const SELECTOR = [
  ['venta_m2', 'Precio m² venta'],
  ['arriendo_m2', 'Arriendo m²'],
  ['rentabilidad_bruta', 'Rentabilidad bruta'],
  ['valor_suelo', 'Valor del suelo'],
  ['licencias', 'Licencias'],
  ['licencias_obra_nueva', 'Obra nueva'],
  ['empresas_camara', 'Empresas (Cámara)'],
  ['establecimientos_ica', 'Industria y Comercio']
];

const pick = (tema, clave) => (tema.cifras[clave] ? { ...tema.cifras[clave], clave, tema: 'economia' } : null);
const tarjetas = (tema, claves) => claves.map((k) => pick(tema, k)).filter(Boolean);
const pesos = (v) => (Math.abs(v) >= 1e6 ? `${formato(v / 1e6, 2)} M` : formato(v));

function Tarjetas({ cifras, onSource, compact = true }) {
  if (!cifras.length) return null;
  return <div className={`metrics-grid ${compact ? 'compact' : ''}`}>{cifras.map((c) => <MetricCard key={c.clave} cifra={c} onSource={onSource} />)}</div>;
}

function Encabezado({ eyebrow, titulo, vigencia }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{titulo}</h2></div>{vigencia && <span>{vigencia}</span>}</div>;
}

function MercadoLaboral({ tema, onSource }) {
  const opciones = LABORAL.filter(([k]) => tema.series[`${k}_trimestral`]);
  const [clave, setClave] = useState(opciones[0]?.[0]);
  const serie = tema.series[`${clave}_trimestral`];
  if (!serie) return null;
  const nombre = opciones.find(([k]) => k === clave)?.[1];
  return (
    <section className="sec-block">
      <Encabezado eyebrow="DANE · GRAN ENCUESTA INTEGRADA DE HOGARES" titulo="Mercado laboral" vigencia={tema.cifras.desempleo?.vigencia} />
      <p className="sec-note">Tasas de Medellín A.M. (Medellín y el Valle de Aburrá), en trimestre móvil. La GEIH no publica una tasa para Medellín sola. La serie se actualiza con el anexo mensual más reciente del DANE en cada ingesta.</p>
      <Tarjetas cifras={tarjetas(tema, LABORAL.map(([k]) => k))} onSource={onSource} compact={false} />
      <div className="chart-card laboral-card">
        <div className="card-controls"><div className="chips">{opciones.map(([k, l]) => <button key={k} className={k === clave ? 'on' : ''} onClick={() => setClave(k)}>{l}</button>)}</div></div>
        <h3>{nombre}, {serie.vigencia}</h3>
        <LineChart series={[{ label: nombre, color: accent.cyan, points: serie.puntos }]} unit="%" formatValue={(v) => formato(v, 1)} ariaLabel={`${nombre} trimestral`} desdeCero={false} />
        <p className="chart-fuente">Porcentaje; el eje se ajusta al rango de cada tasa y no siempre empieza en cero. Cada punto es un trimestre móvil (por ejemplo, may–jul).{serie.nota && ` ${serie.nota}`}</p>
      </div>
    </section>
  );
}

function Vivienda({ tema, onSource }) {
  const venta = tema.series.venta_m2_anual;
  const arriendo = tema.series.arriendo_m2_anual;
  const estratos = (tema.listas.vivienda_por_estrato ?? []).filter((e) => e.venta_m2 || e.arriendo_m2);
  const cifras = tarjetas(tema, ['venta_m2', 'arriendo_m2', 'rentabilidad_bruta']);
  if (!cifras.length && !venta) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="OBSERVATORIO INMOBILIARIO DE MEDELLÍN (OIME) · CATASTRO" titulo="Precios de vivienda" vigencia={tema.cifras.venta_m2?.vigencia} />
      <p className="sec-note">Mediana del precio de <b>oferta</b> por m² de apartamentos y casas que investiga el Catastro, no el precio de cierre. Pesos corrientes, sin ajustar por inflación. Las cifras juntan los dos últimos años completos para que cada comuna tenga muestra; el año en curso queda fuera.</p>
      <Tarjetas cifras={cifras} onSource={onSource} />
      <div className="chart-grid">
        {venta && <div className="chart-card"><h3>Venta: mediana por m², {venta.vigencia}</h3><LineChart series={[{ label: 'Venta por m²', color: accent.cyan, points: venta.puntos }]} unit="$/m²" formatValue={pesos} ariaLabel="Precio de oferta de venta por m² por año" /><p className="chart-fuente">Pesos por m² de área privada.</p></div>}
        {arriendo && <div className="chart-card"><h3>Arriendo: mediana por m² al mes, {arriendo.vigencia}</h3><LineChart series={[{ label: 'Arriendo por m²', color: accent.cyan, points: arriendo.puntos }]} unit="$/m²" formatValue={pesos} ariaLabel="Arriendo de oferta por m² por año" /><p className="chart-fuente">Pesos por m² de área privada, canon mensual.</p></div>}
      </div>
      {estratos.length > 0 && (
        <div className="chart-card estrato-card">
          <h3>Por estrato socioeconómico, {tema.cifras.venta_m2?.vigencia}</h3>
          <table className="chart-table economia-tabla">
            <thead><tr><th>Estrato</th><th>Venta $/m²</th><th>Ofertas</th><th>Arriendo $/m² mes</th><th>Ofertas</th><th>Rentab. bruta</th></tr></thead>
            <tbody>{estratos.map((e) => (
              <tr key={e.estrato}>
                <td>{e.estrato}</td>
                <td>{e.venta_m2 ? formato(e.venta_m2) : '—'}</td><td>{formato(e.ofertas_venta)}</td>
                <td>{e.arriendo_m2 ? formato(e.arriendo_m2) : '—'}</td><td>{formato(e.ofertas_arriendo)}</td>
                <td>{e.rentabilidad_bruta == null ? '—' : `${formato(e.rentabilidad_bruta, 1)} %`}</td>
              </tr>
            ))}</tbody>
          </table>
          <p className="chart-fuente">{tema.cifras.rentabilidad_bruta?.nota}</p>
        </div>
      )}
    </section>
  );
}

function Suelo({ tema, onSource }) {
  const cifras = tarjetas(tema, ['valor_suelo_mediana', 'valor_suelo_zonas']);
  if (!cifras.length) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="CATASTRO · PORTAL IDEM" titulo="Valor catastral del suelo" />
      <p className="sec-note">Valor que el Catastro asigna al m² de suelo en cada zona geoeconómica homogénea. Es un avalúo para el impuesto predial, no un precio de mercado, y el servicio no publica el año de la base. El promedio por comuna está en el ranking de territorios.</p>
      <Tarjetas cifras={cifras} onSource={onSource} />
      <a className="link-fuente" href="#twin?capas=suelo">Ver las zonas en el gemelo 3D →</a>
    </section>
  );
}

function Licencias({ tema, onSource }) {
  const serie = tema.series.licencias_anual;
  const objetos = tema.listas.licencias_por_objeto ?? [];
  const periodo = tema.cifras.licencias_ventana?.vigencia;
  if (!serie) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="CURADURÍAS URBANAS · ARCHIVO" titulo="Licencias urbanísticas" vigencia={serie.vigencia} />
      <div className="warning-note"><span>⚠</span><p>{serie.nota} Es un histórico: no refleja la actividad de construcción reciente.</p></div>
      <Tarjetas cifras={tarjetas(tema, ['licencias_ventana', 'licencias_obra_nueva'])} onSource={onSource} />
      <div className="chart-grid">
        <div className="chart-card"><h3>Licencias por año, {serie.vigencia}</h3><LineChart series={[{ label: 'Licencias', color: accent.cyan, points: serie.puntos }]} formatValue={(v) => formato(v)} ariaLabel="Licencias urbanísticas por año" /></div>
        {objetos.length > 0 && <div className="chart-card"><h3>Por objeto de la licencia, {periodo}</h3><BarChart data={objetos.map((o) => ({ label: o.objeto, value: o.licencias }))} color={accent.cyan} formatValue={(v) => formato(v)} ariaLabel="Licencias por objeto" /></div>}
      </div>
    </section>
  );
}

function Empresas({ tema, onSource }) {
  const serie = tema.series.empresas_anual;
  const sectores = tema.listas.empresas_por_sector ?? [];
  const grupos = tema.listas.ica_por_grupo ?? [];
  if (!serie && !grupos.length) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="CÁMARA DE COMERCIO · ALCALDÍA DE MEDELLÍN" titulo="Empresas y establecimientos" />
      <div className="warning-note"><span>⚠</span><p>Son dos registros distintos y no se suman ni se comparan: la Cámara de Comercio cuenta <b>empresas con matrícula mercantil</b> (hasta {tema.cifras.empresas_camara?.vigencia ?? '2022'}); la Alcaldía cuenta <b>contratos activos del impuesto de Industria y Comercio</b>, que incluyen contribuyentes sin local.</p></div>
      <Tarjetas cifras={tarjetas(tema, ['empresas_camara', 'establecimientos_ica'])} onSource={onSource} />
      <div className="chart-grid">
        {serie && (
          <div className="chart-card">
            <h3>Cámara de Comercio: empresas matriculadas, {serie.vigencia}</h3>
            <LineChart series={[{ label: 'Empresas', color: accent.cyan, points: serie.puntos }]} formatValue={(v) => formato(v)} height={160} ariaLabel="Empresas matriculadas por año" />
            {sectores.length > 0 && <><h3 className="subtitulo">Por sector (secciones de la CIIU), {tema.cifras.empresas_camara?.vigencia}</h3><BarChart data={sectores.map((s) => ({ label: s.sector, value: s.empresas }))} color={accent.cyan} formatValue={(v) => formato(v)} ariaLabel="Empresas por sector" /></>}
            <p className="chart-fuente">{serie.nota}</p>
          </div>
        )}
        {grupos.length > 0 && (
          <div className="chart-card">
            <h3>Industria y Comercio: contratos activos por grupo de actividad</h3>
            <BarChart data={grupos.map((g) => ({ label: g.grupo, value: g.contratos }))} color={accent.cyan} formatValue={(v) => formato(v)} ariaLabel="Contratos de Industria y Comercio por grupo" />
            <p className="chart-fuente">{tema.cifras.establecimientos_ica?.nota} Los grupos se rotulan a partir del código CIIU que predomina en cada uno: el servicio no publica su diccionario.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function EconomiaView({ tema, onSource }) {
  if (!tema) return <section className="view"><p className="lake-message">El tema de economía no está disponible. Genera el lago con la ingesta (ver README).</p></section>;
  return (
    <section className="view economia-view">
      <div className="view-intro"><p className="eyebrow">MEDELLÍN · ECONOMÍA Y VIVIENDA</p><h1>Trabajo, vivienda <em>y empresas.</em></h1><p>Mercado laboral del área metropolitana, precios de oferta de vivienda, valor del suelo, licencias y tejido empresarial, por ciudad y por comuna. Cada cifra muestra su fuente, su vigencia y su estado.</p></div>
      <MercadoLaboral tema={tema} onSource={onSource} />
      <Vivienda tema={tema} onSource={onSource} />
      <PanelTerritorios tema={tema} onSource={onSource} selector={SELECTOR} color={accent.cyan} titulo="Vivienda, suelo y empresas por territorio" />
      <Suelo tema={tema} onSource={onSource} />
      <Licencias tema={tema} onSource={onSource} />
      <Empresas tema={tema} onSource={onSource} />
    </section>
  );
}
