'use client';

import { useEffect, useRef, useState } from 'react';
import { ajustesComunes, maplibregl, prepararMaplibre } from '../../lib/maplibre';

// Coropletico por barrio y vereda: no es un mapa de calor de puntos (kernel de densidad), sino el
// conteo SISC de la ventana reciente agregado al polígono de cada barrio/vereda del catastro. Se
// documenta la diferencia en fuentes-medellin.md; a la escala de la ciudad se lee igual de claro y
// evita generar un PMTiles nuevo solo para esta sección.
const RAMPA = [
  [0, '#3a3b33'],
  [50, '#ae81ff'],
  [100, '#f92672']
];

export default function BarrioMap({ datos, categoria, height = 420 }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const geoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [maxValor, setMaxValor] = useState(1);
  const [popup, setPopup] = useState(null);

  // Refs para leer el valor más reciente dentro de listeners registrados una sola vez.
  const datosRef = useRef(datos);
  const categoriaRef = useRef(categoria);
  useEffect(() => {
    datosRef.current = datos;
    categoriaRef.current = categoria;
  }, [datos, categoria]);

  useEffect(() => {
    let activo = true;
    prepararMaplibre();
    const map = new maplibregl.Map({
      container: container.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [-75.585, 6.235],
      zoom: 10.4,
      pitch: 0,
      bearing: 0,
      attributionControl: false
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // Abajo a la izquierda: la leyenda del coropletico va abajo a la derecha (ver .barrio-legend).
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    ajustesComunes(map);
    // El mapa llena su tarjeta: si esta crece o se reacomoda (grilla en móvil), se reajusta.
    const observador = new ResizeObserver(() => map.resize());
    observador.observe(container.current);

    map.once('style.load', async () => {
      try {
        const [barrios, veredas] = await Promise.all([
          fetch('/data/geo/barrios.geojson').then((r) => r.json()),
          fetch('/data/geo/veredas.geojson').then((r) => r.json())
        ]);
        if (!activo) return;
        const combinado = {
          type: 'FeatureCollection',
          features: [
            ...barrios.features.map((f) => ({
              ...f,
              properties: { ...f.properties, nombre: f.properties.NOMBRE_BARRIO, tipo: 'Barrio', comuna: f.properties.NOMBRE_COMUNA }
            })),
            ...veredas.features.map((f) => ({
              ...f,
              properties: { ...f.properties, nombre: f.properties.NOMBRE_BARRIO, tipo: 'Vereda', comuna: f.properties.NOMBRE_COMUNA }
            }))
          ]
        };
        geoRef.current = combinado;
        map.addSource('seg-barrios', { type: 'geojson', data: combinado, promoteId: 'CODIGO' });
        map.addLayer({ id: 'seg-fill', type: 'fill', source: 'seg-barrios', paint: { 'fill-color': '#3a3b33', 'fill-opacity': 0.75 } });
        map.addLayer({
          id: 'seg-line',
          type: 'line',
          source: 'seg-barrios',
          paint: { 'line-color': '#20211e', 'line-width': 0.6, 'line-opacity': 0.7 }
        });
        map.on('click', 'seg-fill', (event) => {
          const f = event.features?.[0];
          if (!f) return;
          setPopup({
            nombre: f.properties.nombre,
            comuna: f.properties.comuna,
            tipo: f.properties.tipo,
            valor: datosRef.current?.barrios[f.properties.CODIGO]?.[categoriaRef.current] ?? 0
          });
        });
        map.on('mouseenter', 'seg-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'seg-fill', () => {
          map.getCanvas().style.cursor = '';
        });
        setReady(true);
      } catch {
        /* el mapa queda vacío; el resto de la sección (ranking, cifras) sigue funcionando */
      }
    });
    return () => {
      activo = false;
      observador.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map.getSource('seg-barrios') || !geoRef.current) return;
    let max = 1;
    geoRef.current.features.forEach((f) => {
      const valor = datos?.barrios[f.properties.CODIGO]?.[categoria] ?? 0;
      f.properties.valor = valor;
      max = Math.max(max, valor);
    });
    map.getSource('seg-barrios').setData(geoRef.current);
    setMaxValor(max);
    map.setPaintProperty('seg-fill', 'fill-color', [
      'interpolate',
      ['linear'],
      ['get', 'valor'],
      0,
      RAMPA[0][1],
      max / 2,
      RAMPA[1][1],
      max,
      RAMPA[2][1]
    ]);
    setPopup(null);
  }, [ready, categoria, datos]);

  return (
    <div className="barrio-map" style={{ minHeight: height }}>
      <div ref={container} className="barrio-map-canvas" />
      {popup && (
        <div className="comuna-card barrio-popup">
          <span>{popup.tipo}</span>
          <strong>{popup.nombre}</strong>
          <p>{popup.comuna}</p>
          <dl>
            <dt>Casos en la ventana</dt>
            <dd>{popup.valor}</dd>
          </dl>
          <button onClick={() => setPopup(null)}>Cerrar</button>
        </div>
      )}
      <div className="map-legend barrio-legend">
        <div className="legend-block">
          <span>CASOS · {datos?.vigencia ?? ''}</span>
          <div className="legend-ramp" style={{ background: `linear-gradient(90deg, ${RAMPA.map(([, c]) => c).join(', ')})` }} />
          <div className="legend-ticks">
            <i>0</i>
            <i>{Math.round(maxValor / 2)}</i>
            <i>{maxValor}</i>
          </div>
        </div>
      </div>
    </div>
  );
}
