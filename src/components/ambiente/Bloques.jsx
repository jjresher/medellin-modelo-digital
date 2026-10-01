'use client';

import { useMemo, useState } from 'react';
import LineChart from '../charts/LineChart';
import { accent } from '../charts/tokens';
import MetricCard from '../MetricCard';
import { distance } from '../twin/geo';
import { categoriaIca, esMedellin, hora, marcaSiata, municipioVisible, numero, rasgos, useVivo } from '../../lib/vivo';

const CENTRO = [-75.5686, 6.2476];

// Cada bloque arma sus tarjetas con la misma forma que una cifra del lago (etiqueta, unidad, fuente, vigencia y
// estado), para que se lean y se enlacen a Fuentes igual que las demás. La diferencia es la vigencia: aquí es la
// hora de la lectura, no un año.
export const cifraViva = (clave, etiqueta, valor, unidad, fuente, vigencia, extra = {}) =>
  valor == null || Number.isNaN(Number(valor))
    ? null
    : { clave, tema: 'ambiente', etiqueta, valor: Number(valor), unidad, fuente, vigencia, estado: 'observado', ...extra };

export function Tabla({ columnas, filas, nota }) {
  return (
    <>
      <table className="chart-table">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(([clave, celdas]) => (
            <tr key={clave}>
              {celdas.map((celda, i) => (
                <td key={i}>{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {nota && <p className="chart-fuente">{nota}</p>}
    </>
  );
}

function Selector({ etiqueta, valor, opciones, onChange }) {
  return (
    <label className="selector-estacion">
      {etiqueta}
      <select value={valor ?? ''} onChange={(e) => onChange(e.target.value)}>
        {opciones.map(([clave, nombre]) => (
          <option key={clave} value={clave}>
            {nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

function Vacio({ lectura, que }) {
  if (lectura.estado === 'error')
    return (
      <p className="lake-message">
        No se pudo leer {que} ({lectura.error}).
      </p>
    );
  return <p className="lake-message">Leyendo {que}…</p>;
}

// ---------------------------------------------------------------- aire

export function BloqueAire({ aire, onSource }) {
  const estaciones = useMemo(() => rasgos(aire), [aire]);
  const deMedellin = useMemo(
    () => estaciones.filter(esMedellin).sort((a, b) => a.nombreEstacion.localeCompare(b.nombreEstacion, 'es')),
    [estaciones]
  );
  // Mientras no se elija una estación, vale la primera de la lista.
  const [elegida, setCodigo] = useState(null);
  const codigo = elegida ?? (deMedellin.length ? String(deMedellin[0].codigo) : null);
  const serie = useVivo(codigo ? `pm25-serie/${codigo}` : null);
  const info = serie.datos?.info;
  const puntos = useMemo(() => (info?.Dias ?? []).map((dia, i) => [dia.slice(8, 10) + '/' + dia.slice(5, 7), info.PM25_Diario?.[i] ?? null]), [info]);
  const conDato = puntos.filter(([, v]) => v != null).length;

  const filas = estaciones
    .slice()
    .sort((a, b) => (b.ICA_24H_prom ?? -1) - (a.ICA_24H_prom ?? -1))
    .map((e) => {
      const categoria = categoriaIca(e.ICA_24H_prom);
      return [
        e.codigo,
        [
          <span className="con-punto" key="n">
            <i style={{ background: e.color }} />
            {(e.nombreEstacion ?? '').trim()}
          </span>,
          municipioVisible(e),
          categoria?.nombre ?? '—',
          numero(e.PM25_24H_prom, 1),
          numero(e.ICA_24H_prom)
        ]
      ];
    });

  return (
    <section className="sec-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SIATA · CALIDAD DEL AIRE</p>
          <h2>PM2.5 e índice ICA</h2>
        </div>
        {estaciones[0] && (
          <span>
            {marcaSiata(estaciones[0].fechaInicio)} → {marcaSiata(estaciones[0].fechaFin)}
          </span>
        )}
      </div>
      <p className="sec-note">
        El SIATA publica el promedio de 24 horas de PM2.5 de cada estación y su índice ICA ya clasificado en las categorías de la Resolución 2254 de
        2017. Esas categorías y sus colores son del índice, no una lectura de esta app.
      </p>
      {!estaciones.length ? (
        <Vacio lectura={aire} que="la red de calidad del aire" />
      ) : (
        <div className="chart-grid">
          <div className="chart-card">
            <h3>PM2.5 diario, últimos 30 días</h3>
            <div className="card-controls">
              <Selector
                etiqueta="Estación de Medellín"
                valor={codigo}
                onChange={setCodigo}
                opciones={deMedellin.map((e) => [String(e.codigo), e.nombreEstacion])}
              />
            </div>
            {puntos.length > 1 ? (
              <LineChart
                series={[{ label: `PM2.5 · ${info.NombreEstacion}`, color: accent.cyan, points: puntos }]}
                unit="µg/m³"
                formatValue={(v) => numero(v, 0)}
                ariaLabel="PM2.5 diario de los últimos 30 días"
              />
            ) : (
              <Vacio lectura={serie} que="la serie de 30 días" />
            )}
            <p className="chart-fuente">
              Promedio diario en µg/m³. {conDato} de {puntos.length} días con medición; los días sin dato quedan como hueco.
              {serie.leido && ` Lectura ${hora(serie.leido)}.`}
            </p>
          </div>
          <div className="chart-card">
            <h3>Estaciones del Valle de Aburrá</h3>
            <Tabla
              columnas={['Estación', 'Municipio', 'Categoría del ICA', 'PM2.5 (µg/m³)', 'ICA']}
              filas={filas}
              nota="Promedio de 24 horas por estación. El color es el que publica el SIATA para el ICA."
            />
          </div>
        </div>
      )}
      {onSource && (
        <button className="link-fuente" onClick={() => onSource('siata-pm25')}>
          Ver fuente ↗
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- lluvia

export function BloqueLluvia({ pluvios, onSource }) {
  const estaciones = useMemo(
    () =>
      rasgos(pluvios)
        .filter(esMedellin)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [pluvios]
  );
  const [elegido, setCodigo] = useState(null);
  const codigo = elegido ?? (estaciones.length ? String(estaciones[0].codigo) : null);
  const dia = useVivo(codigo ? `lluvia-dia/${codigo}` : null);
  const mes = useVivo(codigo ? `lluvia-mes/${codigo}` : null);
  const info = mes.datos?.info;
  const puntos = useMemo(() => (info?.Tiempo ?? []).map((t, i) => [t.slice(8, 10) + '/' + t.slice(5, 7), info.pluvio_1?.[i] ?? null]), [info]);
  const nombre = info?.NombreEstacion ?? dia.datos?.info?.NombreEstacion ?? '';
  const cifras = [
    cifraViva(
      'lluvia_24h',
      `Lluvia acumulada en 24 h · ${nombre}`,
      dia.datos?.info?.Ptt_Total_Acum_P1,
      'mm',
      'siata-pluvios',
      dia.leido ? `Lectura ${hora(dia.leido)}` : 'En vivo',
      { decimales: 1, nota: 'Acumulado del pluviómetro en las últimas 24 horas (sensor P1 de los dos que tiene la estación).' }
    ),
    cifraViva(
      'lluvia_30d',
      `Lluvia acumulada en 30 días · ${nombre}`,
      info?.Ptt_Total_Acum_P1,
      'mm',
      'siata-pluvios',
      puntos.length ? `${puntos[0][0]} → ${puntos.at(-1)[0]}` : 'En vivo',
      { decimales: 1, nota: 'Suma de la lluvia diaria del sensor P1 en la ventana de 30 días.' }
    )
  ].filter(Boolean);

  return (
    <section className="sec-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SIATA · RED PLUVIOMÉTRICA</p>
          <h2>Lluvia</h2>
        </div>
      </div>
      {!estaciones.length ? (
        <Vacio lectura={pluvios} que="la red de pluviómetros" />
      ) : (
        <>
          <div className="card-controls">
            <Selector
              etiqueta="Pluviómetro de Medellín"
              valor={codigo}
              onChange={setCodigo}
              opciones={estaciones.map((e) => [String(e.codigo), e.nombre])}
            />
          </div>
          {cifras.length > 0 && (
            <div className="metrics-grid compact">
              {cifras.map((c) => (
                <MetricCard key={c.clave} cifra={c} onSource={onSource} />
              ))}
            </div>
          )}
          <div className="chart-card">
            <h3>Lluvia diaria, últimos 30 días</h3>
            {puntos.length > 1 ? (
              <LineChart
                series={[{ label: `Lluvia · ${nombre}`, color: accent.purple, points: puntos }]}
                unit="mm"
                formatValue={(v) => numero(v, 1)}
                ariaLabel="Lluvia diaria de los últimos 30 días"
              />
            ) : (
              <Vacio lectura={mes} que="la serie de lluvia" />
            )}
            <p className="chart-fuente">
              Milímetros por día. El mapa de abajo muestra el acumulado de los últimos 15 minutos de las {rasgos(pluvios).length} estaciones del
              valle.
            </p>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- ruido

export function BloqueRuido({ ruido, tema, onSource }) {
  const estaciones = useMemo(() => rasgos(ruido), [ruido]);
  const bandas = tema.listas?.ruido_amva_dia ?? [];
  const noche = Object.fromEntries((tema.listas?.ruido_amva_noche ?? []).map((b) => [b.iso, b.ha]));
  const cifras = ['ruido_area_dia', 'ruido_area_noche'].filter((k) => tema.cifras[k]).map((k) => ({ ...tema.cifras[k], clave: k, tema: 'ambiente' }));

  return (
    <section className="sec-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">RUIDO · SIATA Y AMVA</p>
          <h2>Ruido medido y modelado</h2>
        </div>
        {estaciones[0] && (
          <span>
            {marcaSiata(estaciones[0].fechaInicio)} → {marcaSiata(estaciones[0].fechaFin)}
          </span>
        )}
      </div>
      <p className="sec-note">
        Dos datos distintos: la red oficial del SIATA <b>mide</b> el ruido en{' '}
        {tema.cifras.estaciones_ruido ? `${tema.cifras.estaciones_ruido.valor} estaciones` : 'sus estaciones'} y publica el promedio de los últimos 7
        días; el mapa del AMVA es un <b>estudio modelado</b> de isófonas, sin fecha de lectura. No son la misma medición y no se comparan entre sí.
      </p>
      {cifras.length > 0 && (
        <div className="metrics-grid compact">
          {cifras.map((c) => (
            <MetricCard key={c.clave} cifra={c} onSource={onSource} />
          ))}
        </div>
      )}
      <div className="chart-grid">
        <div className="chart-card">
          <h3>Estaciones de la red oficial de ruido</h3>
          {estaciones.length ? (
            <Tabla
              columnas={['Estación', 'Municipio', '7 días', 'Día', 'Noche']}
              filas={estaciones.map((e) => [
                e.codigo,
                [
                  (e.nombreLargo || e.nombreEstacion || '').trim(),
                  municipioVisible(e),
                  `${numero(e.Datos_Ruido_7D_prom, 1)} dB(A)`,
                  `${numero(e.Datos_Ruido_7D_prom_dia, 1)} dB(A)`,
                  `${numero(e.Datos_Ruido_7D_prom_noche, 1)} dB(A)`
                ]
              ])}
              nota="Promedio de los últimos 7 días publicado por el SIATA."
            />
          ) : (
            <Vacio lectura={ruido} que="la red de ruido" />
          )}
        </div>
        {bandas.length > 0 && (
          <div className="chart-card">
            <h3>Mapa de ruido del AMVA: hectáreas por banda</h3>
            <Tabla
              columnas={['Banda dB(A)', 'Día (ha)', 'Noche (ha)']}
              filas={bandas.map((b) => [b.iso, [b.rango_db, numero(b.ha, 1), numero(noche[b.iso], 1)]])}
              nota={tema.cifras.ruido_area_dia?.nota}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- sismos

export function BloqueSismos({ sismos, tema, onSource }) {
  const eventos = useMemo(
    () =>
      (sismos.datos?.features ?? []).map((f) => ({
        id: f.id,
        magnitud: f.properties.mag,
        lugar: f.properties.place ?? '',
        fecha: f.properties.time ? new Date(f.properties.time) : null,
        profundidad: f.geometry?.coordinates?.[2],
        km: f.geometry ? distance(CENTRO, f.geometry.coordinates) / 1000 : null
      })),
    [sismos]
  );
  const serie = tema.series?.sismos_anual;
  const cifras = ['sismos_12m', 'sismo_magnitud_maxima']
    .filter((k) => tema.cifras[k])
    .map((k) => ({ ...tema.cifras[k], clave: k, tema: 'ambiente' }));

  return (
    <section className="sec-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">USGS · SISMOS</p>
          <h2>Sismos de magnitud 4 o más a menos de 300 km</h2>
        </div>
      </div>
      <p className="sec-note">
        Catálogo del Servicio Geológico de Estados Unidos (USGS). Se usa porque la consulta abierta del Servicio Geológico Colombiano responde 403 a
        clientes automáticos. La distancia se mide del epicentro al centro de Medellín.
      </p>
      {cifras.length > 0 && (
        <div className="metrics-grid compact">
          {cifras.map((c) => (
            <MetricCard key={c.clave} cifra={c} onSource={onSource} />
          ))}
        </div>
      )}
      <div className="chart-grid">
        {serie && (
          <div className="chart-card">
            <h3>Sismos por año</h3>
            <LineChart
              series={[{ label: 'Sismos de magnitud 4 o más', color: accent.orange, points: serie.puntos }]}
              formatValue={(v) => numero(v)}
              ariaLabel="Sismos por año"
            />
            <p className="chart-fuente">{serie.nota}</p>
          </div>
        )}
        <div className="chart-card">
          <h3>Últimos 12 meses</h3>
          {eventos.length ? (
            <Tabla
              columnas={['Fecha', 'Lugar', 'Profundidad', 'Distancia', 'Magnitud']}
              filas={eventos
                .slice(0, 12)
                .map((e) => [
                  e.id,
                  [
                    e.fecha ? e.fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
                    e.lugar,
                    `${numero(e.profundidad, 0)} km`,
                    `${numero(e.km)} km`,
                    numero(e.magnitud, 1)
                  ]
                ])}
              nota={`${eventos.length} sismos en los últimos 12 meses; se listan los 12 más recientes. Lectura ${hora(sismos.leido)}.`}
            />
          ) : (
            <Vacio lectura={sismos} que="el catálogo del USGS" />
          )}
        </div>
      </div>
    </section>
  );
}
