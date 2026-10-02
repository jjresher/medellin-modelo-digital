'use client';

import { useState } from 'react';
import BarChart from './charts/BarChart';
import LineChart from './charts/LineChart';
import { accent } from './charts/tokens';
import MetricCard from './MetricCard';
import { Procedencia, formato, formatoIndicador, unidadCorta } from './territorios/PanelTerritorios';

// Sección Turismo. Todo sale del tema `turismo` del lago. Lo vigente (MinCIT, Aerocivil, Alcaldía y OSM) va arriba; el
// histórico de MEData (ocupación hotelera, museos y sitios, que dejaron de publicarse en 2023) va aparte y rotulado.

const pick = (tema, clave) => (tema.cifras[clave] ? { ...tema.cifras[clave], clave, tema: 'turismo' } : null);
const tarjetas = (tema, claves) => claves.map((k) => pick(tema, k)).filter(Boolean);
const millones = (v) => (Math.abs(v) >= 1e6 ? `${formato(v / 1e6, 2)} M` : formato(v));

function Tarjetas({ cifras, onSource, compact = true }) {
  if (!cifras.length) return null;
  return (
    <div className={`metrics-grid ${compact ? 'compact' : ''}`}>
      {cifras.map((c) => (
        <MetricCard key={c.clave} cifra={c} onSource={onSource} />
      ))}
    </div>
  );
}

function Encabezado({ eyebrow, titulo, vigencia }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{titulo}</h2>
      </div>
      {vigencia && <span>{vigencia}</span>}
    </div>
  );
}

// Serie con selector de periodo: mensual (detalle) o anual (tendencia).
function SerieConPeriodo({ mensual, anual, titulo, formatValue, ariaLabel }) {
  const [vista, setVista] = useState('mensual');
  const serie = vista === 'mensual' ? mensual : anual;
  if (!serie) return null;
  return (
    <div className="chart-card">
      <div className="card-controls">
        <h3>
          {titulo}, {serie.vigencia}
        </h3>
        {mensual && anual && (
          <div className="chips">
            {[
              ['mensual', 'Por mes'],
              ['anual', 'Por año']
            ].map(([k, l]) => (
              <button key={k} className={vista === k ? 'on' : ''} onClick={() => setVista(k)}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>
      <LineChart series={[{ label: titulo, color: accent.yellow, points: serie.puntos }]} formatValue={formatValue} ariaLabel={ariaLabel} />
      {serie.nota && <p className="chart-fuente">{serie.nota}</p>}
    </div>
  );
}

function Visitantes({ tema, onSource }) {
  const paises = tema.listas.paises_origen ?? [];
  const mensual = tema.series.visitantes_extranjeros_mensual;
  const anual = tema.series.visitantes_extranjeros_anual;
  if (!mensual && !anual) return null;
  return (
    <section className="sec-block">
      <Encabezado
        eyebrow="MINCIT · MIGRACIÓN COLOMBIA"
        titulo="Visitantes extranjeros"
        vigencia={tema.cifras.visitantes_extranjeros_anio_curso?.vigencia}
      />
      <p className="sec-note">
        Extranjeros no residentes que declararon Medellín como destino al entrar a Colombia. No incluye a los colombianos ni a los extranjeros que
        llegan por tierra sin registrar su destino.
      </p>
      <Tarjetas
        cifras={tarjetas(tema, ['visitantes_extranjeros', 'visitantes_extranjeros_anio_curso', 'visitantes_extranjeros_variacion'])}
        onSource={onSource}
      />
      <div className="chart-grid">
        <SerieConPeriodo
          mensual={mensual}
          anual={anual}
          titulo="Visitantes extranjeros"
          formatValue={(v) => formato(v)}
          ariaLabel="Visitantes extranjeros"
        />
        {paises.length > 0 && (
          <div className="chart-card">
            <h3>Países de residencia, {tema.cifras.visitantes_extranjeros?.vigencia}</h3>
            <BarChart
              data={paises.map((p) => ({ label: p.nombre, value: p.valor }))}
              color={accent.yellow}
              formatValue={(v) => formato(v)}
              ariaLabel="Visitantes por país de residencia"
            />
            <p className="chart-fuente">Los 15 países con más visitantes.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Aeropuerto({ tema, onSource }) {
  const mensual = tema.series.pasajeros_aeropuerto_mensual;
  const anual = tema.series.pasajeros_aeropuerto_anual;
  if (!mensual && !anual) return null;
  return (
    <section className="sec-block">
      <Encabezado
        eyebrow="AERONÁUTICA CIVIL · ORIGEN–DESTINO"
        titulo="Aeropuerto José María Córdova"
        vigencia={tema.cifras.pasajeros_aeropuerto_anio_curso?.vigencia}
      />
      <p className="sec-note">
        Pasajeros de vuelos comerciales que salen del aeropuerto de Rionegro o llegan a él. Cada viaje de ida o de vuelta cuenta una vez, así que un
        mismo viajero puede contarse dos veces. No es turismo: incluye residentes y viajes de trabajo.
      </p>
      <Tarjetas
        cifras={tarjetas(tema, ['pasajeros_aeropuerto', 'pasajeros_nacionales', 'pasajeros_internacionales', 'pasajeros_aeropuerto_anio_curso'])}
        onSource={onSource}
        compact={false}
      />
      <SerieConPeriodo mensual={mensual} anual={anual} titulo="Pasajeros" formatValue={millones} ariaLabel="Pasajeros del aeropuerto" />
    </section>
  );
}

function Oferta({ tema, onSource }) {
  const tipos = tema.listas.hospedajes_por_tipo ?? [];
  const atractivos = tema.listas.atractivos_por_tipo ?? [];
  const cifras = tarjetas(tema, ['atractivos_turisticos', 'atractivos_imperdibles', 'puntos_informacion', 'hospedajes_osm']);
  if (!cifras.length) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="ALCALDÍA DE MEDELLÍN · OPENSTREETMAP" titulo="Atractivos y hospedajes" />
      <p className="sec-note">
        Los atractivos y los puntos de información son el registro de la Secretaría de Turismo. Los hospedajes salen de OpenStreetMap, un mapa
        colaborativo: cuentan lo que sus colaboradores han mapeado, no el Registro Nacional de Turismo.
      </p>
      <Tarjetas cifras={cifras} onSource={onSource} compact={false} />
      <div className="chart-grid">
        {atractivos.length > 0 && (
          <div className="chart-card">
            <h3>Atractivos por tipo (los 12 más frecuentes)</h3>
            <BarChart
              data={atractivos.slice(0, 12).map((a) => ({ label: a.tipo, value: a.atractivos }))}
              color={accent.yellow}
              formatValue={(v) => formato(v)}
              ariaLabel="Atractivos por tipo"
            />
            <p className="chart-fuente">{atractivos.length} tipos en total, según la clasificación de la Secretaría de Turismo.</p>
          </div>
        )}
        {tipos.length > 0 && (
          <div className="chart-card">
            <h3>Hospedajes por tipo</h3>
            <BarChart
              data={tipos.map((t) => ({ label: t.tipo, value: t.hospedajes }))}
              color={accent.yellow}
              formatValue={(v) => formato(v)}
              ariaLabel="Hospedajes por tipo"
            />
            <p className="chart-fuente">{tema.cifras.hospedajes_osm?.vigencia}.</p>
          </div>
        )}
      </div>
      <a className="link-fuente" href="#twin?capas=turismo">
        Ver atractivos, puntos de información y hospedajes en el gemelo 3D →
      </a>
    </section>
  );
}

// Atractivos y hospedajes por territorio: los dos rankings lado a lado. Con solo dos indicadores, la ficha por territorio
// serían dos filas; así el territorio elegido se resalta en las dos listas.
const POR_TERRITORIO = ['atractivos', 'hospedajes_osm'];

function Territorios({ tema, onSource }) {
  const { indicadores = [], territorios = [] } = tema.listas;
  const [codigo, setCodigo] = useState(null);
  const rankings = POR_TERRITORIO.map((clave) => {
    const ind = indicadores.find((i) => i.clave === clave);
    const anio = territorios
      .flatMap((t) => Object.keys(t.valores[clave] ?? {}))
      .sort()
      .at(-1);
    const filas = territorios
      .filter((t) => t.valores[clave]?.[anio] != null)
      .map((t) => ({ id: t.codigo, label: t.nombre, value: t.valores[clave][anio], note: `${t.tipo} · ${anio}` }))
      .sort((a, b) => b.value - a.value);
    const sinDato = territorios.filter((t) => t.valores[clave]?.[anio] == null).map((t) => t.nombre);
    return { clave, ind, anio, filas, sinDato };
  }).filter((r) => r.ind && r.filas.length);
  if (!rankings.length) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="16 COMUNAS Y 5 CORREGIMIENTOS" titulo="Atractivos y hospedajes por territorio" />
      <p className="sec-note">Cada indicador conserva su fuente y su vigencia. Toca un territorio para resaltarlo en las dos listas.</p>
      <div className="chart-grid">
        {rankings.map(({ clave, ind, anio, filas, sinDato }) => (
          <div key={clave} className="chart-card">
            <h3>
              {ind.etiqueta} ({ind.unidad}), {anio}
            </h3>
            <Procedencia indicador={ind} fuentes={tema.fuentes} onSource={onSource} />
            <BarChart
              data={filas}
              color={accent.yellow}
              unit={unidadCorta(ind)}
              formatValue={(v) => formatoIndicador(v, ind)}
              ariaLabel={`${ind.etiqueta} por territorio`}
              selected={codigo}
              onSelect={(d) => setCodigo(d.id)}
            />
            {ind.nota && <p className="chart-fuente">{ind.nota}</p>}
            {sinDato.length > 0 && (
              <p className="chart-fuente">
                Sin dato en {anio}: {sinDato.join(', ')}.
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Historico({ tema, onSource }) {
  const ocupacion = tema.series.ocupacion_hotelera_mensual;
  const zonas = tema.listas.ocupacion_por_zona ?? [];
  const museos = tema.listas.museos_por_lugar ?? [];
  const sitios = tema.listas.sitios_por_lugar ?? [];
  if (!ocupacion && !museos.length && !sitios.length) return null;
  const lugares = (lista) =>
    lista.map((l) => ({
      label: l.nombre,
      value: l.visitas,
      note: l.visitas_2019 ? `2019: ${formato(l.visitas_2019)} visitas` : 'Sin reporte en 2019'
    }));
  return (
    <section className="sec-block">
      <Encabezado eyebrow="SECRETARÍA DE TURISMO · MEDATA" titulo="Ocupación hotelera, museos y sitios" vigencia="Histórico" />
      <div className="warning-note">
        <span>⚠</span>
        <p>
          Histórico: la ocupación hotelera abierta llega hasta{' '}
          {tema.cifras.ocupacion_hotelera_ultima?.vigencia.replace(' (histórico)', '') ?? 'octubre de 2023'}, y los museos y sitios de interés hasta
          febrero de 2023. No hay una versión más reciente en datos abiertos.
        </p>
      </div>
      <Tarjetas
        cifras={tarjetas(tema, ['ocupacion_hotelera_ultima', 'ocupacion_hotelera_anual', 'museos_visitas', 'sitios_visitas'])}
        onSource={onSource}
        compact={false}
      />
      <div className="chart-grid">
        {ocupacion && (
          <div className="chart-card">
            <h3>Ocupación hotelera mensual, {ocupacion.vigencia}</h3>
            <LineChart
              series={[{ label: 'Ocupación', color: accent.yellow, points: ocupacion.puntos }]}
              unit="%"
              formatValue={(v) => formato(v, 1)}
              ariaLabel="Ocupación hotelera mensual"
            />
            <p className="chart-fuente">Porcentaje de habitaciones ocupadas. {ocupacion.nota}</p>
          </div>
        )}
        {zonas.length > 0 && (
          <div className="chart-card">
            <h3>Ocupación por zona, promedio {zonas[0].anio}</h3>
            <BarChart
              data={zonas.map((z) => ({ label: z.zona, value: z.promedio }))}
              color={accent.yellow}
              formatValue={(v) => `${formato(v, 1)} %`}
              ariaLabel="Ocupación hotelera por zona"
            />
            <p className="chart-fuente">Promedio simple de los 12 meses de {zonas[0].anio}, en las tres zonas que reporta la fuente.</p>
          </div>
        )}
        {museos.length > 0 && (
          <div className="chart-card">
            <h3>Visitas a museos, {tema.cifras.museos_visitas?.vigencia.replace(' (histórico)', '')}</h3>
            <BarChart data={lugares(museos)} color={accent.yellow} formatValue={(v) => formato(v)} ariaLabel="Visitas a museos" />
            <p className="chart-fuente">Pasa el cursor por cada barra para ver las visitas de 2019.</p>
          </div>
        )}
        {sitios.length > 0 && (
          <div className="chart-card">
            <h3>Visitas a sitios de interés, {tema.cifras.sitios_visitas?.vigencia.replace(' (histórico)', '')}</h3>
            <BarChart data={lugares(sitios)} color={accent.yellow} formatValue={(v) => formato(v)} ariaLabel="Visitas a sitios de interés" />
            <p className="chart-fuente">Pasa el cursor por cada barra para ver las visitas de 2019.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function TurismoView({ tema, onSource }) {
  if (!tema)
    return (
      <section className="view">
        <p className="lake-message">El tema de turismo no está disponible. Genera el lago con la ingesta (ver README).</p>
      </section>
    );
  return (
    <section className="view turismo-view">
      <div className="view-intro">
        <p className="eyebrow">MEDELLÍN · TURISMO</p>
        <h1>
          Quién llega <em>y a dónde va.</em>
        </h1>
        <p>
          Visitantes extranjeros, pasajeros del aeropuerto, atractivos y hospedajes, con el histórico de ocupación hotelera, museos y sitios de
          interés. Cada cifra muestra su fuente, su vigencia y su estado.
        </p>
      </div>
      <Visitantes tema={tema} onSource={onSource} />
      <Aeropuerto tema={tema} onSource={onSource} />
      <Oferta tema={tema} onSource={onSource} />
      <Territorios tema={tema} onSource={onSource} />
      <Historico tema={tema} onSource={onSource} />
    </section>
  );
}
