'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';

const initialView = { center: [-75.5686, 6.2476], zoom: 13.65, pitch: 58, bearing: -18 };
const layerGroups = {
  buildings: ['google-open-buildings-3d'],
  comunas: ['comunas-fill', 'comunas-line'],
  labels: ['comunas-label']
};

function featureBounds(geometry) {
  const points = [];
  const collect = (value) => {
    if (typeof value[0] === 'number') points.push(value);
    else value.forEach(collect);
  };

  collect(geometry.coordinates);
  return points.reduce((bounds, [longitude, latitude]) => [
    [Math.min(bounds[0][0], longitude), Math.min(bounds[0][1], latitude)],
    [Math.max(bounds[1][0], longitude), Math.max(bounds[1][1], latitude)]
  ], [[Infinity, Infinity], [-Infinity, -Infinity]]);
}

export default function Map3D() {
  const container = useRef(null);
  const mapRef = useRef(null);
  const selectedId = useRef(null);
  const [status, setStatus] = useState('Cargando cartografía y edificios…');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState({ buildings: true, comunas: true, labels: true });
  const [selectedComuna, setSelectedComuna] = useState(null);

  useEffect(() => {
    let active = true;

    try {
      // Next/Turbopack mueve el módulo principal; fijamos el worker oficial como recurso estático.
      maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const map = new maplibregl.Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/dark',
        ...initialView,
        antialias: true,
        attributionControl: true
      });
      mapRef.current = map;
      const fitInitialView = () => {
        if (!active || mapRef.current !== map) return;
        map.resize();
        map.jumpTo(initialView);
      };
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new maplibregl.FullscreenControl(), 'top-right');

      requestAnimationFrame(() => requestAnimationFrame(fitInitialView));

      map.once('style.load', async () => {
        try {
          // La cartografía aporta terreno, calles y nombres; los edificios visibles son Google Open Buildings.
          map.getStyle().layers
            .filter((layer) => layer['source-layer'] === 'building')
            .forEach((layer) => map.setLayoutProperty(layer.id, 'visibility', 'none'));

          const [buildingsResponse, comunasResponse] = await Promise.all([
            fetch('/data/medellin-open-buildings.geojson'),
            fetch('/data/comunas-medellin.geojson')
          ]);
          if (!buildingsResponse.ok || !comunasResponse.ok) {
            throw new Error('No se pudieron cargar las capas territoriales.');
          }

          const [buildings, comunas] = await Promise.all([buildingsResponse.json(), comunasResponse.json()]);
          if (!active) return;

          map.addSource('comunas-medellin', {
            type: 'geojson',
            data: comunas,
            promoteId: 'CODIGO'
          });
          map.addLayer({
            id: 'comunas-fill',
            type: 'fill',
            source: 'comunas-medellin',
            paint: {
              'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#f92672', '#ae81ff'],
              'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.23, 0.055]
            }
          });

          map.addSource('google-open-buildings', { type: 'geojson', data: buildings });
          map.addLayer({
            id: 'google-open-buildings-3d',
            type: 'fill-extrusion',
            source: 'google-open-buildings',
            minzoom: 12,
            paint: {
              'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'confidence'], 0.75, '#ae81ff', 1, '#a6e22e'],
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': 0,
              'fill-extrusion-opacity': 0.76,
              'fill-extrusion-vertical-gradient': true
            }
          });
          map.addLayer({
            id: 'comunas-line',
            type: 'line',
            source: 'comunas-medellin',
            paint: {
              'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#f92672', '#e6db74'],
              'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.6, 1.15],
              'line-opacity': 0.88
            }
          });
          map.addLayer({
            id: 'comunas-label',
            type: 'symbol',
            source: 'comunas-medellin',
            minzoom: 12,
            layout: {
              'text-field': ['get', 'NOMBRE'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 11,
              'text-max-width': 9,
              'text-allow-overlap': false
            },
            paint: {
              'text-color': '#f8f8f2',
              'text-halo-color': '#272822',
              'text-halo-width': 1.4
            }
          });

          map.on('click', 'comunas-fill', (event) => {
            const feature = event.features?.[0];
            if (!feature) return;

            if (selectedId.current) {
              map.setFeatureState({ source: 'comunas-medellin', id: selectedId.current }, { selected: false });
            }
            selectedId.current = feature.properties.CODIGO;
            map.setFeatureState({ source: 'comunas-medellin', id: selectedId.current }, { selected: true });
            setSelectedComuna({ ...feature.properties, geometry: feature.geometry });
          });

          map.on('click', 'google-open-buildings-3d', (event) => {
            const feature = event.features?.[0];
            if (!feature) return;

            const area = Number(feature.properties.area).toLocaleString('es-CO', { maximumFractionDigits: 0 });
            const confidence = (Number(feature.properties.confidence) * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 });
            new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '220px' })
              .setLngLat(event.lngLat)
              .setHTML(`<strong>Huella Open Buildings</strong><span>${area} m² · confianza ${confidence}%</span><small>Altura mostrada: extrusión visual</small>`)
              .addTo(map);
          });

          ['comunas-fill', 'google-open-buildings-3d'].forEach((layerId) => {
            map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
          });

          // La vista se monta de forma diferida al abrir Gemelo 3D. Reajustar en idle
          // evita un lienzo desplazado si la primera medición ocurre durante esa transición.
          map.once('idle', fitInitialView);
          window.setTimeout(fitInitialView, 700);
          setReady(true);
          setStatus(`${buildings.features.length.toLocaleString('es-CO')} edificios · 16 comunas · calles y lugares`);
        } catch (loadError) {
          if (active) setError(loadError.message);
        }
      });

      map.on('error', (event) => {
        if (active && event.error?.message?.includes('WebGL')) {
          setError('Tu navegador no pudo iniciar el mapa WebGL.');
        }
      });
    } catch {
      setError('Tu navegador no pudo iniciar el gemelo 3D.');
    }

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const resetView = () => {
    setSelectedComuna(null);
    if (selectedId.current) {
      mapRef.current?.setFeatureState({ source: 'comunas-medellin', id: selectedId.current }, { selected: false });
    }
    selectedId.current = null;
    mapRef.current?.flyTo({ ...initialView, essential: true, duration: 900 });
  };

  const toggleLayer = (key) => {
    if (!ready) return;
    const next = !layers[key];
    layerGroups[key].forEach((layerId) => {
      if (mapRef.current?.getLayer(layerId)) {
        mapRef.current.setLayoutProperty(layerId, 'visibility', next ? 'visible' : 'none');
      }
    });
    setLayers((current) => ({ ...current, [key]: next }));
  };

  const focusComuna = () => {
    if (!selectedComuna) return;
    mapRef.current?.fitBounds(featureBounds(selectedComuna.geometry), {
      padding: 80,
      pitch: 52,
      bearing: -15,
      duration: 900,
      maxZoom: 14.8
    });
  };

  return (
    <section className="twin-shell" aria-label="Gemelo 3D de Medellín">
      <div ref={container} className="map-canvas" />
      <div className="map-hud"><span className="hud-dot" />{error || status}</div>
      <div className="map-layer-panel" aria-label="Capas del mapa">
        <span>CAPAS</span>
        <button className={layers.buildings ? 'selected' : ''} disabled={!ready} onClick={() => toggleLayer('buildings')}>Edificios</button>
        <button className={layers.comunas ? 'selected' : ''} disabled={!ready} onClick={() => toggleLayer('comunas')}>Comunas</button>
        <button className={layers.labels ? 'selected' : ''} disabled={!ready} onClick={() => toggleLayer('labels')}>Nombres</button>
      </div>
      {selectedComuna && (
        <div className="comuna-card">
          <span>{selectedComuna.IDENTIFICACION}</span>
          <strong>{selectedComuna.NOMBRE}</strong>
          <p>Seleccionada en el mapa.</p>
          <button onClick={focusComuna}>Enfocar comuna →</button>
        </div>
      )}
      <div className="map-tools"><button onClick={resetView}>Restablecer vista</button></div>
      {error && <div className="map-error"><strong>Mapa no disponible</strong><span>{error}</span><button onClick={() => window.location.reload()}>Reintentar</button></div>}
    </section>
  );
}
