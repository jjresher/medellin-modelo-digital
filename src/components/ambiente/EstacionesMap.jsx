'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ajustesComunes, maplibregl, prepararMaplibre } from '../../lib/maplibre';
import { ESCALA_ICA, categoriaIca, decibeles, marcaSiata, municipioVisible, numero } from '../../lib/vivo';

// Mapa de la sección Ambiente: las estaciones del SIATA en vivo, el mapa de ruido del AMVA y dos capas
// satelitales. Los círculos usan el color que publica el propio SIATA para cada estación (el del ICA en aire y
// el de su estado en los niveles), no una rampa inventada aquí.
//
// Las capas satelitales viven en esta sección y no en el gemelo 3D a propósito: VIIRS solo tiene teselas hasta
// el nivel 8 (~2 km por píxel), así que se lee a escala del valle, no a la del gemelo.
const SENTINEL = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg';
const VIIRS = (dia) =>
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_At_Sensor_Radiance' +
  `/default/${dia}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`;
const CAPAS_DIR = '/data/geo/capas';
const VACIO = { type: 'FeatureCollection', features: [] };

const BASES = [
  ['oscuro', 'Oscuro'],
  ['sentinel', 'Sentinel-2 2023'],
  ['viirs', 'Luces nocturnas']
];
const PERIODOS_RUIDO = [
  ['', 'Sin mapa de ruido'],
  ['dia', 'Ruido diurno'],
  ['noche', 'Ruido nocturno']
];
// Rampa del mapa de ruido: un solo tono que crece con los dB(A), igual que los índices del gemelo.
const RAMPA_RUIDO = [
  [35, '#3a3b33'],
  [55, '#ae81ff'],
  [70, '#fd971f'],
  [80, '#f92672']
];

const ESTACIONES = {
  aire: { label: 'Calidad del aire (ICA)', fuente: 'SIATA · PM2.5 y ICA de 24 h' },
  niveles: { label: 'Nivel de quebradas', fuente: 'SIATA · nivel en vivo' },
  pluvios: { label: 'Pluviómetros', fuente: 'SIATA · acumulado de 15 min' },
  ruido: { label: 'Estaciones de ruido', fuente: 'SIATA · promedio de 7 días' }
};

const ayer = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

function fichaDe(tipo, p) {
  if (tipo === 'aire') {
    const categoria = categoriaIca(p.ICA_24H_prom);
    return {
      titulo: (p.nombreEstacion ?? '').trim(),
      subtitulo: municipioVisible(p),
      filas: [
        ['PM2.5 (promedio 24 h)', `${numero(p.PM25_24H_prom, 1)} µg/m³`],
        ['ICA (promedio 24 h)', `${numero(p.ICA_24H_prom)}${categoria ? ` · ${categoria.nombre}` : ''}`],
        ['Ventana', `${marcaSiata(p.fechaInicio)} → ${marcaSiata(p.fechaFin)}`]
      ],
      nota: 'Categorías del ICA según la Resolución 2254 de 2017, tal como las publica el SIATA.'
    };
  }
  if (tipo === 'niveles') {
    const crudo = (valor) => (typeof valor === 'number' ? numero(valor, 2) : String(valor ?? '—'));
    return {
      titulo: (p.nombreEstacion ?? '').trim(),
      subtitulo: municipioVisible(p),
      filas: [
        ['Nivel actual', crudo(p.nivelActual)],
        ['Máximo alcanzado', crudo(p.nivel_maximo_alcanzado)],
        ['Último dato', marcaSiata(p.fechaUltimoDato)]
      ],
      nota:
        'Lectura del sensor frente a su propio punto de referencia (puede ser negativa). El SIATA no ' +
        'publica la unidad en esta capa, así que el valor se muestra crudo y solo es comparable con el ' +
        'histórico de la misma estación.'
    };
  }
  if (tipo === 'pluvios') {
    return {
      titulo: (p.nombre ?? '').trim(),
      subtitulo: municipioVisible(p),
      filas: [
        ['Lluvia en los últimos 15 min', `${numero(p.acumulado_15min, 1)} mm`],
        ['Última actualización', marcaSiata(p.fecha_ultima_actualizacion)]
      ]
    };
  }
  return {
    titulo: (p.nombreLargo || p.nombreEstacion || '').trim(),
    subtitulo: municipioVisible(p),
    filas: [
      ['Promedio 7 días', decibeles(p.Datos_Ruido_7D_prom)],
      ['Día', decibeles(p.Datos_Ruido_7D_prom_dia)],
      ['Noche', decibeles(p.Datos_Ruido_7D_prom_noche)],
      ['Ventana', `${marcaSiata(p.fechaInicio)} → ${marcaSiata(p.fechaFin)}`]
    ]
  };
}

export default function EstacionesMap({ aire, niveles, pluvios, ruido, height = 460 }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const cacheRuido = useRef({});
  const capasEstilo = useRef([]);
  const [listo, setListo] = useState(false);
  const [base, setBase] = useState('oscuro');
  const [activas, setActivas] = useState({ aire: true, niveles: true, pluvios: false, ruido: false });
  const [periodoRuido, setPeriodoRuido] = useState('');
  const [ficha, setFicha] = useState(null);
  const [aviso, setAviso] = useState('');
  const diaViirs = useMemo(() => ayer(), []);
  const colecciones = useMemo(
    () => ({ aire: aire?.datos, niveles: niveles?.datos, pluvios: pluvios?.datos, ruido: ruido?.datos }),
    [aire, niveles, pluvios, ruido]
  );

  useEffect(() => {
    let activo = true;
    prepararMaplibre();
    const map = new maplibregl.Map({
      container: container.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [-75.58, 6.25],
      zoom: 10.2,
      minZoom: 7,
      maxZoom: 16,
      attributionControl: { compact: true }
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    ajustesComunes(map);

    map.once('style.load', () => {
      if (!activo) return;
      const capas = map.getStyle().layers;
      const primerSimbolo = capas.find((capa) => capa.type === 'symbol')?.id;
      // Con una base fotográfica, los rellenos y las líneas del estilo oscuro taparían la imagen.
      capasEstilo.current = capas.filter((capa) => capa.type !== 'symbol').map((capa) => capa.id);
      map.addSource('base-sentinel', {
        type: 'raster',
        tiles: [SENTINEL],
        tileSize: 256,
        maxzoom: 14,
        attribution: 'Sentinel-2 cloudless 2023 © EOX IT Services · CC BY-NC-SA (uso no comercial)'
      });
      map.addSource('base-viirs', {
        type: 'raster',
        tiles: [VIIRS(diaViirs)],
        tileSize: 256,
        maxzoom: 8,
        attribution: 'Luces nocturnas VIIRS © NASA GIBS'
      });
      map.addLayer({ id: 'base-sentinel', type: 'raster', source: 'base-sentinel', layout: { visibility: 'none' } }, primerSimbolo);
      map.addLayer(
        { id: 'base-viirs', type: 'raster', source: 'base-viirs', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.85 } },
        primerSimbolo
      );

      map.addSource('ruido-amva', { type: 'geojson', data: VACIO });
      map.addLayer(
        {
          id: 'ruido-amva-fill',
          type: 'fill',
          source: 'ruido-amva',
          paint: { 'fill-color': ['interpolate', ['linear'], ['get', 'iso'], ...RAMPA_RUIDO.flat()], 'fill-opacity': 0.5 }
        },
        primerSimbolo
      );

      Object.keys(ESTACIONES).forEach((tipo) => map.addSource(tipo, { type: 'geojson', data: VACIO }));
      const aro = { 'circle-stroke-color': '#272822', 'circle-stroke-width': 1.2 };
      map.addLayer({
        id: 'capa-pluvios',
        type: 'circle',
        source: 'pluvios',
        layout: { visibility: 'none' },
        paint: {
          ...aro,
          'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'acumulado_15min'], 0], 0, 3.2, 2, 8, 10, 16],
          'circle-color': '#66d9ef',
          'circle-opacity': 0.8
        }
      });
      map.addLayer({
        id: 'capa-niveles',
        type: 'circle',
        source: 'niveles',
        paint: { ...aro, 'circle-radius': 4, 'circle-color': ['coalesce', ['get', 'color'], '#b9b9ac'] }
      });
      map.addLayer({
        id: 'capa-ruido',
        type: 'circle',
        source: 'ruido',
        layout: { visibility: 'none' },
        paint: {
          ...aro,
          'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'Datos_Ruido_7D_prom'], 0], 55, 5, 80, 13],
          'circle-color': '#e6db74'
        }
      });
      map.addLayer({
        id: 'capa-aire',
        type: 'circle',
        source: 'aire',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 7, 14, 13],
          'circle-color': ['coalesce', ['get', 'color'], '#b9b9ac'],
          'circle-stroke-color': '#272822',
          'circle-stroke-width': 2
        }
      });

      Object.keys(ESTACIONES).forEach((tipo) => {
        map.on('click', `capa-${tipo}`, (evento) => {
          const rasgo = evento.features?.[0];
          if (rasgo) setFicha({ tipo, ...fichaDe(tipo, rasgo.properties) });
        });
        map.on('mouseenter', `capa-${tipo}`, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', `capa-${tipo}`, () => {
          map.getCanvas().style.cursor = '';
        });
      });
      setListo(true);
    });

    return () => {
      activo = false;
      map.remove();
      mapRef.current = null;
    };
  }, [diaViirs]);

  // Cada lectura en vivo se vuelca en su fuente cuando llega o se refresca.
  useEffect(() => {
    const map = mapRef.current;
    if (!listo) return;
    Object.entries(colecciones).forEach(([tipo, coleccion]) => {
      if (coleccion?.features) map.getSource(tipo)?.setData(coleccion);
    });
  }, [listo, colecciones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!listo) return;
    Object.keys(ESTACIONES).forEach((tipo) => map.setLayoutProperty(`capa-${tipo}`, 'visibility', activas[tipo] ? 'visible' : 'none'));
  }, [listo, activas]);

  useEffect(() => {
    const map = mapRef.current;
    if (!listo) return;
    ['base-sentinel', 'base-viirs'].forEach((id) => map.setLayoutProperty(id, 'visibility', `base-${base}` === id ? 'visible' : 'none'));
    capasEstilo.current.forEach((id) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', base === 'oscuro' ? 'visible' : 'none'));
  }, [listo, base]);

  useEffect(() => {
    const map = mapRef.current;
    if (!listo) return;
    if (!periodoRuido) {
      map.getSource('ruido-amva').setData(VACIO);
      return;
    }
    const guardado = cacheRuido.current[periodoRuido];
    if (guardado) {
      map.getSource('ruido-amva').setData(guardado);
      return;
    }
    fetch(`${CAPAS_DIR}/ruido_amva_${periodoRuido}.geojson`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((datos) => {
        cacheRuido.current[periodoRuido] = datos;
        mapRef.current?.getSource('ruido-amva')?.setData(datos);
      })
      .catch(() => setAviso('Falta el mapa de ruido del AMVA: corre la ingesta del tema ambiente.'));
  }, [listo, periodoRuido]);

  return (
    <div className="ambiente-map-shell">
      <div className="ambiente-map-controls">
        <div className="chips">
          {BASES.map(([clave, etiqueta]) => (
            <button key={clave} className={base === clave ? 'on' : ''} onClick={() => setBase(clave)}>
              {etiqueta}
            </button>
          ))}
        </div>
        <div className="chips">
          {Object.entries(ESTACIONES).map(([tipo, { label }]) => (
            <button key={tipo} className={activas[tipo] ? 'on' : ''} onClick={() => setActivas((a) => ({ ...a, [tipo]: !a[tipo] }))}>
              {label}
            </button>
          ))}
        </div>
        <div className="chips">
          {PERIODOS_RUIDO.map(([clave, etiqueta]) => (
            <button key={clave || 'ninguno'} className={periodoRuido === clave ? 'on' : ''} onClick={() => setPeriodoRuido(clave)}>
              {etiqueta}
            </button>
          ))}
        </div>
      </div>
      <div className="ambiente-map" style={{ height }}>
        <div ref={container} className="ambiente-map-canvas" />
        {ficha && (
          <div className="comuna-card ambiente-ficha">
            <span>{ESTACIONES[ficha.tipo].label}</span>
            <strong>{ficha.titulo}</strong>
            <p>
              {ficha.subtitulo} · {ESTACIONES[ficha.tipo].fuente}
            </p>
            <dl>
              {ficha.filas.map(([etiqueta, valor]) => (
                <Fila key={etiqueta} etiqueta={etiqueta} valor={valor} />
              ))}
            </dl>
            {ficha.nota && <small className="ficha-nota">{ficha.nota}</small>}
            <button onClick={() => setFicha(null)}>Cerrar</button>
          </div>
        )}
        <div className="map-legend ambiente-legend">
          {activas.aire && (
            <div className="legend-block">
              <span>ÍNDICE ICA (SIATA)</span>
              {ESCALA_ICA.map(([min, max, nombre, color]) => (
                <em key={nombre}>
                  <i style={{ background: color }} />
                  {Number.isFinite(max) ? `${min}–${max}` : `${min}+`} {nombre}
                </em>
              ))}
            </div>
          )}
          {periodoRuido && (
            <div className="legend-block">
              <span>RUIDO {periodoRuido === 'dia' ? 'DIURNO' : 'NOCTURNO'} · dB(A)</span>
              <div className="legend-ramp" style={{ background: `linear-gradient(90deg, ${RAMPA_RUIDO.map(([, c]) => c).join(', ')})` }} />
              <div className="legend-ticks">
                {RAMPA_RUIDO.map(([db]) => (
                  <i key={db}>{db}</i>
                ))}
              </div>
            </div>
          )}
          {base === 'viirs' && (
            <div className="legend-block">
              <span>VIIRS · {diaViirs}</span>
              <em>Resolución ~2 km: se lee a escala del valle.</em>
            </div>
          )}
        </div>
        {aviso && <div className="map-warning">{aviso}</div>}
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor }) {
  return (
    <>
      <dt>{etiqueta}</dt>
      <dd>{valor}</dd>
    </>
  );
}
