'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

const initialView = { center: [-75.5686, 6.2476], zoom: 13.65, pitch: 58, bearing: -18 };
const PMTILES = '/data/edificios.pmtiles';
// Las ortofotos pasan por un proxy propio con caché (ver src/app/api/ortofoto).
const ORTOFOTO = '/api/ortofoto/2024/{z}/{y}/{x}';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TERRENO = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

// Capas raster visibles en cada mapa base. En "Ortofoto 2024", ESRI queda debajo para cubrir fuera de Medellín.
const bases = {
  oscuro: { label: 'Oscuro', layers: [] },
  ortofoto: { label: 'Ortofoto 2024', layers: ['base-esri', 'base-ortofoto'] },
  satelite: { label: 'Satélite', layers: ['base-esri'] }
};
const layerGroups = {
  buildings: ['edificios-3d'],
  comunas: ['comunas-fill', 'comunas-line'],
  barrios: ['barrios-fill', 'barrios-line'],
  veredas: ['veredas-line'],
  labels: ['comunas-label', 'barrios-label', 'veredas-label']
};
const layerLabels = { buildings: 'Edificios', comunas: 'Comunas', barrios: 'Barrios', veredas: 'Veredas', labels: 'Nombres' };

// Rampa por número de pisos, en la paleta Monokai de la app.
const floorRamp = [[1, '#75715e'], [3, '#ae81ff'], [6, '#66d9ef'], [12, '#a6e22e'], [20, '#e6db74'], [30, '#f92672']];

let protocolRegistered = false;
function registerPmtiles() {
  if (protocolRegistered) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolRegistered = true;
}

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

// Un punto de etiqueta por territorio. Si las etiquetas salen del polígono, MapLibre repite el nombre
// en cada tesela que el polígono toca. Se traza una línea horizontal por el centroide del anillo exterior
// más grande y se toma el centro del tramo interior más ancho, que siempre cae dentro del polígono.
function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(area / 2);
}

function interiorPoint(geometry) {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  const polygon = polygons.reduce((best, current) => (ringArea(current[0]) > ringArea(best[0]) ? current : best));
  const outer = polygon[0];
  const y = outer.reduce((sum, [, lat]) => sum + lat, 0) / outer.length;
  const crossings = [];
  polygon.forEach((ring) => {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[j];
      const [x2, y2] = ring[i];
      if ((y1 > y) !== (y2 > y)) crossings.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
  });
  crossings.sort((a, b) => a - b);
  let best = null;
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    if (!best || crossings[i + 1] - crossings[i] > best[1] - best[0]) best = [crossings[i], crossings[i + 1]];
  }
  return best ? [(best[0] + best[1]) / 2, y] : outer[0];
}

function labelPoints(collection, field) {
  return {
    type: 'FeatureCollection',
    features: collection.features.filter((f) => f.properties[field]).map((f) => ({
      type: 'Feature',
      properties: { name: f.properties[field].trim() },
      geometry: { type: 'Point', coordinates: interiorPoint(f.geometry) }
    }))
  };
}

const number = (value, digits = 0) => Number(value).toLocaleString('es-CO', { maximumFractionDigits: digits });

function buildingPopup(p) {
  const height = `${number(p.h, 1)} m${p.e ? ' (sin dato: pisos × 2,3 m)' : ''}`;
  const rows = [
    ['Pisos', number(p.p)],
    ['Sótanos', number(p.s)],
    ['Altura catastral', height],
    ['Área construida', `${number(p.a)} m²`],
    p.y ? ['Año de construcción', p.y] : null,
    ['Tipo (código catastral)', p.t || 'Sin dato'],
    ['CBML', p.c || 'Sin dato']
  ].filter(Boolean);
  return `<strong>Construcción ${p.r ? 'rural' : 'urbana'}</strong>${rows.map(([k, v]) => `<span><em>${k}</em> ${v}</span>`).join('')}<small>Catastro distrital · Portal IDEM. La altura catastral se deriva del número de pisos (≈ 2,3 m por piso); no es una medición del edificio.</small>`;
}

export default function Map3D({ gemelo }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const selected = useRef(null);
  const boundaries = useRef({});
  const [status, setStatus] = useState('Cargando cartografía y edificios…');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState({ buildings: true, comunas: true, barrios: false, veredas: false, labels: true });
  const [base, setBase] = useState('oscuro');
  const [terrain, setTerrain] = useState(true);
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    let active = true;

    try {
      // Next/Turbopack mueve el módulo principal; fijamos el worker oficial como recurso estático.
      maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      registerPmtiles();
      const map = new maplibregl.Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/dark',
        ...initialView,
        maxPitch: 80,
        antialias: true,
        // Compacta: con cinco fuentes, la atribución extendida tapa los controles inferiores.
        attributionControl: { compact: true }
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
          // Los edificios del estilo base se ocultan: los del gemelo vienen del catastro distrital.
          const styleLayers = map.getStyle().layers;
          styleLayers
            .filter((layer) => layer['source-layer'] === 'building')
            .forEach((layer) => map.setLayoutProperty(layer.id, 'visibility', 'none'));
          const firstSymbol = styleLayers.find((layer) => layer.type === 'symbol')?.id;

          const [comunas, barrios, veredas, pmtilesCheck] = await Promise.all([
            fetch('/data/geo/comunas.geojson').then((r) => (r.ok ? r.json() : Promise.reject(new Error('comunas')))),
            fetch('/data/geo/barrios.geojson').then((r) => (r.ok ? r.json() : Promise.reject(new Error('barrios')))),
            fetch('/data/geo/veredas.geojson').then((r) => (r.ok ? r.json() : Promise.reject(new Error('veredas')))),
            fetch(PMTILES, { method: 'HEAD' })
          ]);
          if (!active) return;
          comunas.features = comunas.features.filter((f) => f.properties.NOMBRE);
          boundaries.current = {
            comunas: new Map(comunas.features.map((f) => [f.properties.CODIGO, f])),
            barrios: new Map(barrios.features.map((f) => [f.properties.CODIGO, f])),
            veredas: new Map(veredas.features.map((f) => [f.properties.CODIGO, f]))
          };

          // Mapas base raster debajo de las etiquetas del estilo; ocultos hasta que se eligen.
          map.addSource('base-esri', { type: 'raster', tiles: [ESRI], tileSize: 256, maxzoom: 19, attribution: 'Imagen © Esri, Maxar, Earthstar Geographics' });
          map.addSource('base-ortofoto', { type: 'raster', tiles: [`${window.location.origin}${ORTOFOTO}`], tileSize: 256, minzoom: 10, maxzoom: 20, attribution: 'Ortofoto 2024 © Alcaldía de Medellín' });
          map.addLayer({ id: 'base-esri', type: 'raster', source: 'base-esri', layout: { visibility: 'none' } }, firstSymbol);
          map.addLayer({ id: 'base-ortofoto', type: 'raster', source: 'base-ortofoto', layout: { visibility: 'none' } }, firstSymbol);

          map.addSource('terreno', { type: 'raster-dem', tiles: [TERRENO], tileSize: 256, maxzoom: 15, encoding: 'terrarium', attribution: 'Relieve © Mapzen, AWS Terrain Tiles' });
          map.setTerrain({ source: 'terreno', exaggeration: 1 });

          map.addSource('comunas', { type: 'geojson', data: comunas, promoteId: 'CODIGO' });
          map.addSource('barrios', { type: 'geojson', data: barrios, promoteId: 'CODIGO' });
          map.addSource('veredas', { type: 'geojson', data: veredas, promoteId: 'CODIGO' });
          const isSelected = ['boolean', ['feature-state', 'selected'], false];

          map.addLayer({ id: 'comunas-fill', type: 'fill', source: 'comunas', paint: { 'fill-color': ['case', isSelected, '#f92672', '#ae81ff'], 'fill-opacity': ['case', isSelected, 0.22, 0.05] } });
          map.addLayer({ id: 'barrios-fill', type: 'fill', source: 'barrios', layout: { visibility: 'none' }, paint: { 'fill-color': '#f92672', 'fill-opacity': ['case', isSelected, 0.25, 0] } });
          map.addLayer({ id: 'barrios-line', type: 'line', source: 'barrios', layout: { visibility: 'none' }, paint: { 'line-color': '#66d9ef', 'line-width': 0.8, 'line-opacity': 0.7, 'line-dasharray': [2, 1.5] } });
          map.addLayer({ id: 'veredas-line', type: 'line', source: 'veredas', layout: { visibility: 'none' }, paint: { 'line-color': '#a6e22e', 'line-width': 0.8, 'line-opacity': 0.6, 'line-dasharray': [2, 1.5] } });

          if (pmtilesCheck.ok) {
            map.addSource('edificios', { type: 'vector', url: `pmtiles://${window.location.origin}${PMTILES}`, attribution: 'Construcciones © Catastro distrital · IDEM AMVA' });
            map.addLayer({
              id: 'edificios-3d',
              type: 'fill-extrusion',
              source: 'edificios',
              'source-layer': 'edificios',
              minzoom: 12,
              paint: {
                'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'p'], ...floorRamp.flat()],
                'fill-extrusion-height': ['get', 'h'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.85,
                'fill-extrusion-vertical-gradient': true
              }
            });
          } else {
            setWarning('Faltan las teselas de edificios (public/data/edificios.pmtiles). Genéralas con: npm run ingesta gemelo');
          }

          map.addLayer({ id: 'comunas-line', type: 'line', source: 'comunas', paint: { 'line-color': ['case', isSelected, '#f92672', '#e6db74'], 'line-width': ['case', isSelected, 2.6, 1.15], 'line-opacity': 0.88 } });
          const label = (id, collection, field, minzoom, size, color, visibility = 'visible') => {
            map.addSource(id, { type: 'geojson', data: labelPoints(collection, field) });
            map.addLayer({
              id, type: 'symbol', source: id, minzoom,
              layout: { visibility, 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': size, 'text-max-width': 9, 'text-allow-overlap': false },
              paint: { 'text-color': color, 'text-halo-color': '#272822', 'text-halo-width': 1.4 }
            });
          };
          label('comunas-label', comunas, 'NOMBRE', 11, 11, '#f8f8f2');
          label('barrios-label', barrios, 'NOMBRE_BARRIO', 14, 10, '#66d9ef', 'none');
          label('veredas-label', veredas, 'NOMBRE_BARRIO', 12, 10, '#a6e22e', 'none');

          map.on('click', (event) => {
            const visibleLayers = ['edificios-3d', 'barrios-fill', 'comunas-fill'].filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
            const hits = map.queryRenderedFeatures(event.point, { layers: visibleLayers });
            const building = hits.find((f) => f.layer.id === 'edificios-3d');
            if (building) {
              new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '250px' })
                .setLngLat(event.lngLat)
                .setHTML(buildingPopup(building.properties))
                .addTo(map);
              return;
            }
            const area = hits.find((f) => f.layer.id === 'barrios-fill') ?? hits.find((f) => f.layer.id === 'comunas-fill');
            if (area) selectArea(area.source, area.properties.CODIGO);
          });

          ['edificios-3d', 'barrios-fill', 'comunas-fill'].forEach((layerId) => {
            if (!map.getLayer(layerId)) return;
            map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
          });

          // La vista se monta de forma diferida al abrir Gemelo 3D. Reajustar en idle
          // evita un lienzo desplazado si la primera medición ocurre durante esa transición.
          map.once('idle', fitInitialView);
          window.setTimeout(fitInitialView, 700);
          setReady(true);
        } catch (loadError) {
          if (active) setError(`No se pudieron cargar las capas territoriales (${loadError.message}).`);
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

  useEffect(() => {
    if (!gemelo) return;
    const c = gemelo.cifras;
    const parts = [
      c.construcciones && `${number(c.construcciones.valor)} construcciones`,
      c.comunas && c.corregimientos && `${c.comunas.valor} comunas y ${c.corregimientos.valor} corregimientos`,
      c.barrios && `${c.barrios.valor} barrios`
    ].filter(Boolean);
    if (parts.length) setStatus(parts.join(' · '));
  }, [gemelo]);

  const clearSelection = () => {
    if (selected.current) mapRef.current?.setFeatureState(selected.current, { selected: false });
    selected.current = null;
    setSelection(null);
  };

  function selectArea(source, code) {
    const feature = boundaries.current[source]?.get(code);
    if (!feature) return;
    if (selected.current) mapRef.current?.setFeatureState(selected.current, { selected: false });
    selected.current = { source, id: code };
    mapRef.current?.setFeatureState(selected.current, { selected: true });
    const p = feature.properties;
    setSelection(source === 'comunas'
      ? { kind: p.IDENTIFICACION || (p.SUBTIPO_COMUNACORREGIMIENTO === 1 ? 'Comuna' : 'Corregimiento'), name: p.NOMBRE, detail: `Código ${p.CODIGO}`, geometry: feature.geometry }
      : { kind: 'Barrio', name: p.NOMBRE_BARRIO, detail: `Comuna ${p.COMUNA} · ${p.NOMBRE_COMUNA}`, geometry: feature.geometry });
  }

  const resetView = () => {
    clearSelection();
    mapRef.current?.flyTo({ ...initialView, essential: true, duration: 900 });
  };

  const toggleLayer = (key) => {
    if (!ready) return;
    const next = !layers[key];
    const ids = key === 'labels'
      ? layerGroups.labels.filter((id) => id === 'comunas-label' || (id === 'barrios-label' && layers.barrios) || (id === 'veredas-label' && layers.veredas))
      : layerGroups[key];
    ids.forEach((layerId) => {
      if (mapRef.current?.getLayer(layerId)) mapRef.current.setLayoutProperty(layerId, 'visibility', next ? 'visible' : 'none');
    });
    // Las etiquetas de barrios y veredas siguen a su capa si "Nombres" está activo.
    if ((key === 'barrios' || key === 'veredas') && layers.labels) {
      mapRef.current?.setLayoutProperty(`${key}-label`, 'visibility', next ? 'visible' : 'none');
    }
    if (key === 'barrios' && !next && selected.current?.source === 'barrios') clearSelection();
    setLayers((current) => ({ ...current, [key]: next }));
  };

  const chooseBase = (key) => {
    if (!ready) return;
    ['base-esri', 'base-ortofoto'].forEach((id) => mapRef.current?.setLayoutProperty(id, 'visibility', bases[key].layers.includes(id) ? 'visible' : 'none'));
    setBase(key);
  };

  const toggleTerrain = () => {
    if (!ready) return;
    mapRef.current?.setTerrain(terrain ? null : { source: 'terreno', exaggeration: 1 });
    setTerrain(!terrain);
  };

  const focusSelection = () => {
    if (!selection) return;
    mapRef.current?.fitBounds(featureBounds(selection.geometry), { padding: 80, pitch: 52, bearing: -15, duration: 900, maxZoom: 16 });
  };

  return (
    <section className="twin-shell" aria-label="Gemelo 3D de Medellín">
      <div ref={container} className="map-canvas" />
      <div className="map-hud"><span className="hud-dot" />{error || status}</div>
      <div className="map-layer-panel" aria-label="Capas del mapa">
        <span>MAPA BASE</span>
        {Object.entries(bases).map(([key, { label }]) => <button key={key} className={`radio ${base === key ? 'selected' : ''}`} disabled={!ready} onClick={() => chooseBase(key)}>{label}</button>)}
        <span>CAPAS</span>
        {Object.entries(layerLabels).map(([key, label]) => <button key={key} className={layers[key] ? 'selected' : ''} disabled={!ready} onClick={() => toggleLayer(key)}>{label}</button>)}
        <button className={terrain ? 'selected' : ''} disabled={!ready} onClick={toggleTerrain}>Relieve</button>
      </div>
      {layers.buildings && ready && !warning && (
        <div className="map-legend" aria-label="Leyenda de pisos">
          <span>PISOS</span>
          <div className="legend-ramp" style={{ background: `linear-gradient(90deg, ${floorRamp.map(([, color]) => color).join(', ')})` }} />
          <div className="legend-ticks">{floorRamp.map(([floors]) => <i key={floors}>{floors}{floors === 30 ? '+' : ''}</i>)}</div>
        </div>
      )}
      {selection && (
        <div className="comuna-card">
          <span>{selection.kind}</span>
          <strong>{selection.name}</strong>
          <p>{selection.detail}</p>
          <button onClick={focusSelection}>Enfocar →</button>
        </div>
      )}
      <div className="map-tools"><button onClick={resetView}>Restablecer vista</button></div>
      {warning && <div className="map-warning">{warning}</div>}
      {error && <div className="map-error"><strong>Mapa no disponible</strong><span>{error}</span><button onClick={() => window.location.reload()}>Reintentar</button></div>}
    </section>
  );
}
