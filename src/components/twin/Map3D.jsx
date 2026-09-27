'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import {
  ANIOS_ORTOFOTO, CAPAS_DIR, ESRI, PMTILES_EDIFICIOS, PMTILES_SINIESTROS, TERRENO, bases, floorColor, indexColor,
  initialView, lenses, normColor, ortofotoTiles, territoryLayers, thematicLayers
} from './config';
import { circle, distance, featureBounds, formatNumber, labelPoints, metersPerPixel } from './geo';
import { AnalysisPanel, ExplorePanel, Hud, HelpOverlay, Legend, LensBar, LensMethod, MeasurePanel, SelectionCard, StartGuide, ToolBar, WhatYouSee } from './Paneles';

let protocolRegistered = false;
function registerPmtiles() {
  if (protocolRegistered) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolRegistered = true;
}

const GUIA = 'gemelo-guia-vista';
const defaultLayers = { buildings: true, comunas: true, barrios: false, veredas: false, labels: true };
const lensKeys = Object.fromEntries(Object.entries(lenses).map(([id, l]) => [l.key, id]));

const escapar = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Lee una vista compartida del hash: #twin?v=lon,lat,zoom,rumbo,inclinación&base=…&anio=…&lente=…&capas=…&terr=…
function readSharedView() {
  const [, query = ''] = window.location.hash.split('?');
  const p = new URLSearchParams(query);
  const v = p.get('v')?.split(',').map(Number);
  const camera = v?.length === 5 && v.every(Number.isFinite) ? { center: [v[0], v[1]], zoom: v[2], bearing: v[3], pitch: v[4] } : null;
  const list = (clave) => (p.get(clave) ? p.get(clave).split(',').filter(Boolean) : null);
  return {
    camera,
    base: bases[p.get('base')] ? p.get('base') : null,
    anio: ANIOS_ORTOFOTO.includes(p.get('anio')) ? p.get('anio') : null,
    lens: lenses[p.get('lente')] ? p.get('lente') : null,
    thematic: list('capas')?.filter((k) => thematicLayers[k]) ?? null,
    layers: list('terr') ? Object.fromEntries(Object.keys(defaultLayers).map((k) => [k, list('terr').includes(k)])) : null,
    any: Boolean(query)
  };
}

// Contenido de los popups de capas temáticas y de lentes: dato crudo, sin valoraciones.
const popupFields = {
  'capa-metro-estaciones': ['Estación', [['linea', 'Línea'], ['sistema', 'Sistema']], 'nombre'],
  'capa-metro-lineas': ['Línea del Sistema Metro', [['linea', 'Línea'], ['itinerario', 'Itinerario']]],
  'capa-ciclorrutas': ['Ciclorruta', [['estado', 'Estado'], ['tipo_via', 'Tipo'], ['longitud_m', 'Longitud (m)']], 'nombre'],
  'capa-encicla': ['Estación EnCicla', [['direccion', 'Dirección']], 'nombre'],
  'capa-equipamientos': ['Equipamiento', [['tipo', 'Tipo'], ['componente', 'Componente'], ['nivel', 'Nivel'], ['barrio', 'Barrio']], 'nombre'],
  'capa-atractivos': ['Atractivo turístico', [], 'nombre'],
  'capa-proteccion-fill': ['Suelo de protección', [['subcategoria', 'Subcategoría']], 'nombre'],
  'capa-tratamientos-fill': ['Tratamiento del POT', [['codigo', 'Código'], ['altura_normativa', 'Altura normativa (pisos)'], ['ic_max', 'Índice de construcción máx.'], ['densidad_max', 'Densidad máx. (viv/ha)']], 'tratamiento'],
  'capa-riesgo-fill': ['Zona de riesgo (POT)', [['riesgo', 'Condición'], ['amenaza', 'Amenaza']], 'nombre'],
  'lente-subestaciones': ['Subestación de energía', [['estado', 'Estado'], ['clasificacion', 'Clasificación'], ['direccion', 'Dirección']], 'nombre'],
  'lente-alta-tension': ['Línea de alta tensión', [['tension_kv', 'Tensión (kV)'], ['circuito', 'Circuito']]],
  'lente-aforos': ['Intersección aforada', [['veh_eq_hora_pico', 'Veh. equivalentes en hora pico'], ['anios', 'Años del aforo']], 'interseccion']
};
const layerSource = {
  ...Object.fromEntries(Object.values(thematicLayers).flatMap((c) => c.layers.map((l) => [l.id, c.fuentes[0]]))),
  ...Object.fromEntries(Object.values(lenses).flatMap((l) => (l.layers ?? []).map((layer) => [layer.id, l.fuentes.at(-1)])))
};
const clickable = Object.keys(popupFields);

function featurePopup(layerId, props, fuente) {
  const [title, rows, nameField] = popupFields[layerId];
  const name = nameField && props[nameField] ? `<span class="name">${escapar(props[nameField])}</span>` : '';
  const body = rows.filter(([k]) => props[k] != null && props[k] !== '').map(([k, label]) => `<span><em>${label}</em> ${escapar(typeof props[k] === 'number' ? formatNumber(props[k]) : props[k])}</span>`).join('');
  return `<strong>${title}</strong>${name}${body}${fuente ? `<small>${escapar(fuente.nombre)}${fuente.vigencia ? ` · ${escapar(fuente.vigencia)}` : ''}</small>` : ''}`;
}

function buildingPopup(p) {
  const height = `${formatNumber(p.h, 1)} m${p.e ? ' (sin dato: pisos × 2,3 m)' : ''}`;
  const rows = [
    ['Pisos', formatNumber(p.p)],
    p.n != null ? ['Altura normativa POT', `${p.n} pisos`] : null,
    ['Sótanos', formatNumber(p.s)],
    ['Altura catastral', height],
    ['Área construida', `${formatNumber(p.a)} m²`],
    p.y ? ['Año de construcción', p.y] : null,
    ['Tipo (código catastral)', p.t || 'Sin dato'],
    ['CBML', p.c || 'Sin dato']
  ].filter(Boolean);
  return `<strong>Construcción ${p.r ? 'rural' : 'urbana'}</strong>${rows.map(([k, v]) => `<span><em>${k}</em> ${escapar(v)}</span>`).join('')}<small>Catastro distrital · Portal IDEM. La altura catastral se deriva del número de pisos (≈ 2,3 m por piso); no es una medición del edificio.</small>`;
}

export default function Map3D({ gemelo, lentes, catalogo }) {
  const shared = useMemo(() => (typeof window === 'undefined' ? {} : readSharedView()), []);
  const container = useRef(null);
  const mapRef = useRef(null);
  const selected = useRef(null);
  const boundaries = useRef({});
  const comunasData = useRef(null);
  const loadedFiles = useRef({});
  const analysisData = useRef(null);
  const modeRef = useRef(null);
  const measureRef = useRef([]);
  const fuentesRef = useRef({});
  const styleBaseLayers = useRef([]);

  const [status, setStatus] = useState('Cargando cartografía y edificios…');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [ready, setReady] = useState(false);
  const [hasBuildings, setHasBuildings] = useState(false);
  const [base, setBase] = useState(shared.base ?? 'oscuro');
  const [anio, setAnio] = useState(shared.anio ?? '2024');
  const [compare, setCompare] = useState({ on: false, anio: '2019', opacity: 0.5 });
  const [terrain, setTerrain] = useState(true);
  const [layers, setLayers] = useState(shared.layers ?? defaultLayers);
  const [thematic, setThematic] = useState(shared.thematic ?? []);
  const [available, setAvailable] = useState({});
  const [lens, setLens] = useState(shared.lens ?? null);
  const [mode, setModeState] = useState(null);
  const [panel, setPanel] = useState(null);
  const [hud, setHud] = useState(false);
  const [hudInfo, setHudInfo] = useState(null);
  const [help, setHelp] = useState(false);
  const [guide, setGuide] = useState(false);
  const [whatOpen, setWhatOpen] = useState(false);
  const [selection, setSelection] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [measure, setMeasure] = useState([]);
  const [toast, setToast] = useState('');

  const territorios = useMemo(() => Object.fromEntries((lentes?.listas?.territorios ?? []).map((t) => [t.codigo, t])), [lentes]);
  const fuentes = useMemo(() => Object.fromEntries((catalogo?.datasets ?? []).map((d) => [d.id, d])), [catalogo]);
  useEffect(() => { fuentesRef.current = fuentes; }, [fuentes]);
  const periodos = useMemo(() => ({
    victimas: lentes?.cifras?.victimas_viales?.vigencia,
    aforos: lentes?.cifras?.intersecciones_aforadas?.vigencia
  }), [lentes]);

  const setMode = useCallback((next) => {
    modeRef.current = next;
    setModeState(next);
    const canvas = mapRef.current?.getCanvas();
    if (canvas) canvas.style.cursor = next ? 'crosshair' : '';
    if (next !== 'analizar') {
      setAnalysis(null);
      mapRef.current?.getSource('analisis')?.setData({ type: 'FeatureCollection', features: [] });
    }
    if (next !== 'medir') {
      measureRef.current = [];
      setMeasure([]);
      mapRef.current?.getSource('medicion')?.setData({ type: 'FeatureCollection', features: [] });
    }
  }, []);

  // Carga bajo demanda un GeoJSON de capas temáticas; si no existe, la capa queda marcada como no disponible.
  const ensureFile = useCallback(async (id) => {
    const map = mapRef.current;
    if (!map) return false;
    if (map.getSource(id)) return true;
    if (loadedFiles.current[id] === false) return false;
    const respuesta = await fetch(`${CAPAS_DIR}/${id}.geojson`);
    if (!respuesta.ok) {
      loadedFiles.current[id] = false;
      return false;
    }
    const datos = await respuesta.json();
    loadedFiles.current[id] = datos;
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: datos });
    return true;
  }, []);

  const ensureLayers = useCallback(async (defs, archivos) => {
    const map = mapRef.current;
    const ok = await Promise.all((archivos ?? []).map(ensureFile));
    if (ok.some((v) => !v)) return false;
    if (defs.some((d) => d.source === 'siniestros') && !map.getSource('siniestros')) {
      const head = await fetch(PMTILES_SINIESTROS, { method: 'HEAD' });
      if (!head.ok) return false;
      map.addSource('siniestros', { type: 'vector', url: `pmtiles://${window.location.origin}${PMTILES_SINIESTROS}`, attribution: 'Siniestros viales © Alcaldía de Medellín (MEData)' });
    }
    defs.forEach((def) => {
      if (!map.getLayer(def.id)) map.addLayer({ ...def, layout: { ...(def.layout ?? {}), visibility: 'none' } }, 'comunas-line');
    });
    return true;
  }, [ensureFile]);

  const clearSelection = useCallback(() => {
    if (selected.current) mapRef.current?.setFeatureState(selected.current, { selected: false });
    selected.current = null;
    setSelection(null);
  }, []);

  const selectArea = useCallback((source, code) => {
    const feature = boundaries.current[source]?.get(code);
    if (!feature) return;
    if (selected.current) mapRef.current?.setFeatureState(selected.current, { selected: false });
    selected.current = { source, id: code };
    mapRef.current?.setFeatureState(selected.current, { selected: true });
    const p = feature.properties;
    setSelection(source === 'comunas'
      ? { source, code, kind: p.IDENTIFICACION || (p.SUBTIPO_COMUNACORREGIMIENTO === 1 ? 'Comuna' : 'Corregimiento'), name: p.NOMBRE, detail: `Código ${p.CODIGO}`, geometry: feature.geometry }
      : { source, code, kind: 'Barrio', name: p.NOMBRE_BARRIO, detail: `Comuna ${p.COMUNA} · ${p.NOMBRE_COMUNA}`, geometry: feature.geometry });
  }, []);

  const analyzeAt = useCallback(async (lngLat) => {
    const map = mapRef.current;
    const center = [lngLat.lng, lngLat.lat];
    map.getSource('analisis')?.setData({ type: 'FeatureCollection', features: [circle(center, 1000), circle(center, 500)] });
    setAnalysis({ loading: true });
    try {
      if (!analysisData.current) {
        const [grid, ...points] = await Promise.all([
          fetch('/data/geo/analisis.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('falta analisis.json')))),
          ...['servicios_equipamientos', 'movilidad_metro_estaciones', 'energia_subestaciones', 'movilidad_encicla'].map((id) =>
            fetch(`${CAPAS_DIR}/${id}.geojson`).then((r) => (r.ok ? r.json() : { features: [] })))
        ]);
        analysisData.current = { grid, equip: points[0].features, metro: points[1].features, sub: points[2].features, encicla: points[3].features };
      }
      const { grid, equip, metro, sub, encicla } = analysisData.current;
      const radios = [500, 1000].map((r) => {
        const suma = { construcciones: 0, area: 0, pisos: 0, pisosMax: 0, victimas: 0 };
        const dLat = r / 110574 / grid.celda + 1;
        const dLon = r / (111320 * Math.cos((center[1] * Math.PI) / 180)) / grid.celda + 1;
        const ci = Math.floor((center[0] - grid.x0) / grid.celda);
        const cj = Math.floor((center[1] - grid.y0) / grid.celda);
        for (let i = Math.floor(ci - dLon); i <= ci + dLon; i++) {
          for (let j = Math.floor(cj - dLat); j <= cj + dLat; j++) {
            const celda = grid.celdas[`${i}_${j}`];
            if (!celda) continue;
            const centro = [grid.x0 + (i + 0.5) * grid.celda, grid.y0 + (j + 0.5) * grid.celda];
            if (distance(center, centro) > r) continue;
            suma.construcciones += celda[0];
            suma.area += celda[1];
            suma.pisos += celda[2];
            suma.pisosMax = Math.max(suma.pisosMax, celda[3]);
            suma.victimas += celda[4];
          }
        }
        const dentro = (lista) => lista.filter((f) => distance(center, f.geometry.coordinates) <= r);
        const equipDentro = dentro(equip);
        const conteo = {};
        equipDentro.forEach((f) => { const k = f.properties.componente ?? 'Otros'; conteo[k] = (conteo[k] ?? 0) + 1; });
        return {
          ...suma,
          pisosProm: suma.construcciones ? suma.pisos / suma.construcciones : null,
          equipamientos: equipDentro.length,
          porComponente: Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 4),
          metro: dentro(metro).length,
          encicla: dentro(encicla).length
        };
      });
      const nearest = (lista, campo) => lista.reduce((best, f) => {
        const d = distance(center, f.geometry.coordinates);
        return !best || d < best.d ? { nombre: f.properties[campo], d } : best;
      }, null);
      setAnalysis({ center, radios, periodoVictimas: grid.periodo_victimas, metroCercana: nearest(metro, 'nombre'), subestacionCercana: nearest(sub, 'nombre') });
    } catch (e) {
      setAnalysis({ error: `No se pudo calcular el análisis (${e.message}). Genera los datos con la ingesta.` });
    }
  }, []);

  const addMeasurePoint = useCallback((lngLat) => {
    const puntos = [...measureRef.current, [lngLat.lng, lngLat.lat]];
    measureRef.current = puntos;
    setMeasure(puntos);
    mapRef.current?.getSource('medicion')?.setData({
      type: 'FeatureCollection',
      features: [
        ...(puntos.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: puntos } }] : []),
        ...puntos.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
      ]
    });
  }, []);

  // ------------------------------------------------------------------ inicialización del mapa
  useEffect(() => {
    let active = true;
    try {
      // Next/Turbopack mueve el módulo principal; fijamos el worker oficial como recurso estático.
      maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      registerPmtiles();
      const camera = shared.camera ?? initialView;
      const map = new maplibregl.Map({
        container: container.current,
        style: 'https://tiles.openfreemap.org/styles/dark',
        ...camera,
        maxPitch: 80,
        antialias: true,
        // Compacta: con tantas fuentes, la atribución extendida tapa los controles inferiores.
        attributionControl: { compact: true }
      });
      mapRef.current = map;
      const fitInitialView = () => {
        if (!active || mapRef.current !== map) return;
        map.resize();
        map.jumpTo(camera);
      };
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
      map.addControl(new maplibregl.FullscreenControl(), 'top-right');
      requestAnimationFrame(() => requestAnimationFrame(fitInitialView));

      map.once('style.load', async () => {
        try {
          const styleLayers = map.getStyle().layers;
          styleLayers.filter((layer) => layer['source-layer'] === 'building').forEach((layer) => map.setLayoutProperty(layer.id, 'visibility', 'none'));
          const firstSymbol = styleLayers.find((layer) => layer.type === 'symbol')?.id;
          // Rellenos y líneas del estilo oscuro: con una base fotográfica se ocultan y solo quedan sus etiquetas.
          styleBaseLayers.current = styleLayers.filter((layer) => layer.type !== 'symbol' && layer['source-layer'] !== 'building').map((layer) => layer.id);

          const leer = (archivo) => fetch(`/data/geo/${archivo}.geojson`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(archivo))));
          const [comunas, barrios, veredas, pmtilesCheck] = await Promise.all([leer('comunas'), leer('barrios'), leer('veredas'), fetch(PMTILES_EDIFICIOS, { method: 'HEAD' })]);
          if (!active) return;
          comunas.features = comunas.features.filter((f) => f.properties.NOMBRE);
          comunasData.current = comunas;
          boundaries.current = {
            comunas: new Map(comunas.features.map((f) => [f.properties.CODIGO, f])),
            barrios: new Map(barrios.features.map((f) => [f.properties.CODIGO, f]))
          };

          map.addSource('base-esri', { type: 'raster', tiles: [ESRI], tileSize: 256, maxzoom: 19, attribution: 'Imagen © Esri, Maxar, Earthstar Geographics' });
          map.addSource('base-ortofoto', { type: 'raster', tiles: [ortofotoTiles(shared.anio ?? '2024')], tileSize: 256, minzoom: 10, maxzoom: 20, attribution: 'Ortofotos © Alcaldía de Medellín' });
          map.addSource('base-ortofoto-b', { type: 'raster', tiles: [ortofotoTiles('2019')], tileSize: 256, minzoom: 10, maxzoom: 20 });
          map.addLayer({ id: 'base-esri', type: 'raster', source: 'base-esri', layout: { visibility: 'none' } }, firstSymbol);
          map.addLayer({ id: 'base-ortofoto', type: 'raster', source: 'base-ortofoto', layout: { visibility: 'none' } }, firstSymbol);
          map.addLayer({ id: 'base-ortofoto-b', type: 'raster', source: 'base-ortofoto-b', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.5 } }, firstSymbol);

          map.addSource('terreno', { type: 'raster-dem', tiles: [TERRENO], tileSize: 256, maxzoom: 15, encoding: 'terrarium', attribution: 'Relieve © Mapzen, AWS Terrain Tiles' });
          map.setTerrain({ source: 'terreno', exaggeration: 1 });

          map.addSource('comunas', { type: 'geojson', data: comunas, promoteId: 'CODIGO' });
          map.addSource('barrios', { type: 'geojson', data: barrios, promoteId: 'CODIGO' });
          map.addSource('veredas', { type: 'geojson', data: veredas });
          const isSelected = ['boolean', ['feature-state', 'selected'], false];

          map.addLayer({ id: 'comunas-fill', type: 'fill', source: 'comunas', paint: { 'fill-color': ['case', isSelected, '#f92672', '#ae81ff'], 'fill-opacity': ['case', isSelected, 0.22, 0.05] } });
          map.addLayer({ id: 'barrios-fill', type: 'fill', source: 'barrios', layout: { visibility: 'none' }, paint: { 'fill-color': '#f92672', 'fill-opacity': ['case', isSelected, 0.25, 0] } });
          map.addLayer({ id: 'barrios-line', type: 'line', source: 'barrios', layout: { visibility: 'none' }, paint: { 'line-color': '#66d9ef', 'line-width': 0.8, 'line-opacity': 0.7, 'line-dasharray': [2, 1.5] } });
          map.addLayer({ id: 'veredas-line', type: 'line', source: 'veredas', layout: { visibility: 'none' }, paint: { 'line-color': '#a6e22e', 'line-width': 0.8, 'line-opacity': 0.6, 'line-dasharray': [2, 1.5] } });

          if (pmtilesCheck.ok) {
            map.addSource('edificios', { type: 'vector', url: `pmtiles://${window.location.origin}${PMTILES_EDIFICIOS}`, attribution: 'Construcciones © Catastro distrital · IDEM AMVA' });
            map.addLayer({
              id: 'edificios-3d', type: 'fill-extrusion', source: 'edificios', 'source-layer': 'edificios', minzoom: 12,
              paint: { 'fill-extrusion-color': floorColor, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.85, 'fill-extrusion-vertical-gradient': true }
            });
            setHasBuildings(true);
          } else {
            setWarning('Faltan las teselas de edificios (public/data/edificios.pmtiles). Genéralas con: .venv/bin/python ingesta/correr.py gemelo');
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

          // Herramientas: radios de análisis y medición, siempre por encima de todo.
          map.addSource('analisis', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          map.addLayer({ id: 'analisis-fill', type: 'fill', source: 'analisis', paint: { 'fill-color': '#66d9ef', 'fill-opacity': 0.06 } });
          map.addLayer({ id: 'analisis-line', type: 'line', source: 'analisis', paint: { 'line-color': '#66d9ef', 'line-width': 1.6, 'line-dasharray': [3, 2] } });
          map.addSource('medicion', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          map.addLayer({ id: 'medicion-linea', type: 'line', source: 'medicion', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#e6db74', 'line-width': 2.4, 'line-dasharray': [2, 1] } });
          map.addLayer({ id: 'medicion-puntos', type: 'circle', source: 'medicion', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 4.5, 'circle-color': '#e6db74', 'circle-stroke-color': '#272822', 'circle-stroke-width': 1.5 } });

          map.on('click', (event) => {
            if (modeRef.current === 'medir') return addMeasurePoint(event.lngLat);
            if (modeRef.current === 'analizar') return analyzeAt(event.lngLat);
            const visibles = (ids) => ids.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
            const hits = map.queryRenderedFeatures(event.point, { layers: visibles([...clickable, 'edificios-3d', 'barrios-fill', 'comunas-fill']) });
            const tematico = hits.find((f) => popupFields[f.layer.id] && f.layer.type !== 'fill');
            const building = hits.find((f) => f.layer.id === 'edificios-3d');
            const poligono = hits.find((f) => popupFields[f.layer.id] && f.layer.type === 'fill');
            const html = tematico ? featurePopup(tematico.layer.id, tematico.properties, fuentesRef.current[layerSource[tematico.layer.id]])
              : building ? buildingPopup(building.properties)
                : poligono ? featurePopup(poligono.layer.id, poligono.properties, fuentesRef.current[layerSource[poligono.layer.id]]) : null;
            if (html) {
              new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '270px' }).setLngLat(event.lngLat).setHTML(html).addTo(map);
              return;
            }
            const area = hits.find((f) => f.layer.id === 'barrios-fill') ?? hits.find((f) => f.layer.id === 'comunas-fill');
            if (area) selectArea(area.source, area.properties.CODIGO);
          });
          map.on('mousemove', (event) => {
            if (modeRef.current) return;
            const ids = [...clickable, 'edificios-3d'].filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
            map.getCanvas().style.cursor = map.queryRenderedFeatures(event.point, { layers: ids }).length ? 'pointer' : '';
          });

          map.once('idle', fitInitialView);
          window.setTimeout(fitInitialView, 700);
          setReady(true);
        } catch (loadError) {
          if (active) setError(`No se pudieron cargar las capas territoriales (${loadError.message}).`);
        }
      });

      map.on('error', (event) => {
        if (active && event.error?.message?.includes('WebGL')) setError('Tu navegador no pudo iniciar el mapa WebGL.');
      });
    } catch {
      setError('Tu navegador no pudo iniciar el gemelo 3D.');
    }
    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // El mapa se crea una sola vez; las demás opciones se aplican en sus propios efectos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------ efectos de estado → mapa
  useEffect(() => {
    if (!gemelo) return;
    const c = gemelo.cifras;
    const parts = [
      c.construcciones && `${formatNumber(c.construcciones.valor)} construcciones`,
      c.comunas && c.corregimientos && `${c.comunas.valor} comunas y ${c.corregimientos.valor} corregimientos`,
      c.barrios && `${c.barrios.valor} barrios`
    ].filter(Boolean);
    if (parts.length) setStatus(parts.join(' · '));
  }, [gemelo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    ['base-esri', 'base-ortofoto'].forEach((id) => map.setLayoutProperty(id, 'visibility', bases[base].layers.includes(id) ? 'visible' : 'none'));
    styleBaseLayers.current.forEach((id) => map.setLayoutProperty(id, 'visibility', base === 'oscuro' ? 'visible' : 'none'));
    map.getSource('base-ortofoto').setTiles([ortofotoTiles(anio)]);
    const comparar = base === 'ortofoto' && compare.on && compare.anio !== anio;
    map.setLayoutProperty('base-ortofoto-b', 'visibility', comparar ? 'visible' : 'none');
    if (comparar) {
      map.getSource('base-ortofoto-b').setTiles([ortofotoTiles(compare.anio)]);
      map.setPaintProperty('base-ortofoto-b', 'raster-opacity', compare.opacity);
    }
  }, [ready, base, anio, compare]);

  useEffect(() => {
    if (ready) mapRef.current.setTerrain(terrain ? { source: 'terreno', exaggeration: 1 } : null);
  }, [ready, terrain]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    Object.entries(territoryLayers).forEach(([key, { layers: ids }]) => {
      ids.forEach((id) => {
        if (!map.getLayer(id)) return;
        let visible = layers[key];
        if (key === 'labels') visible = layers.labels && (id === 'comunas-label' || (id === 'barrios-label' && layers.barrios) || (id === 'veredas-label' && layers.veredas));
        // Con una lente activa, el coroplético de comunas se muestra aunque la capa esté apagada.
        if (id === 'comunas-fill' && lens) visible = true;
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      });
    });
    if (!layers.barrios && selected.current?.source === 'barrios') clearSelection();
  }, [ready, layers, lens, clearSelection]);

  // Índices de las lentes: se copian a las propiedades de cada comuna para el coroplético.
  useEffect(() => {
    if (!ready || !comunasData.current || !Object.keys(territorios).length) return;
    comunasData.current.features.forEach((f) => {
      const t = territorios[f.properties.CODIGO];
      if (t) Object.values(lenses).forEach(({ index }) => { f.properties[index] = t[index]; });
    });
    mapRef.current.getSource('comunas').setData(comunasData.current);
  }, [ready, territorios]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    const isSelected = ['boolean', ['feature-state', 'selected'], false];
    map.setPaintProperty('comunas-fill', 'fill-color', lens ? ['case', isSelected, '#f8f8f2', indexColor(lenses[lens].index)] : ['case', isSelected, '#f92672', '#ae81ff']);
    map.setPaintProperty('comunas-fill', 'fill-opacity', lens ? ['case', isSelected, 0.7, 0.55] : ['case', isSelected, 0.22, 0.05]);
    if (map.getLayer('edificios-3d')) map.setPaintProperty('edificios-3d', 'fill-extrusion-color', lens === 'densificacion' ? normColor : floorColor);
    let cancelled = false;
    (async () => {
      for (const [id, def] of Object.entries(lenses)) {
        if (!def.layers) continue;
        if (id === lens && !(await ensureLayers(def.layers, def.archivos))) {
          if (!cancelled) setToast(`Faltan datos de la lente ${def.label}: corre la ingesta de lentes.`);
          continue;
        }
        def.layers.forEach((l) => map.getLayer(l.id) && map.setLayoutProperty(l.id, 'visibility', id === lens ? 'visible' : 'none'));
      }
      const desde = Number(periodos.victimas?.slice(0, 4));
      if (map.getLayer('lente-siniestros') && desde) map.setFilter('lente-siniestros', ['>=', ['get', 'y'], desde]);
    })();
    return () => { cancelled = true; };
  }, [ready, lens, ensureLayers, periodos]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready) return;
    (async () => {
      const disponibles = {};
      for (const [key, def] of Object.entries(thematicLayers)) {
        const on = thematic.includes(key);
        if (on) disponibles[key] = await ensureLayers(def.layers, def.archivos);
        def.layers.forEach((l) => map.getLayer(l.id) && map.setLayoutProperty(l.id, 'visibility', on ? 'visible' : 'none'));
      }
      setAvailable((prev) => ({ ...prev, ...disponibles }));
      const faltantes = Object.entries(disponibles).filter(([, ok]) => !ok).map(([k]) => k);
      if (faltantes.length) setThematic((prev) => prev.filter((k) => !faltantes.includes(k)));
    })();
  }, [ready, thematic, ensureLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !hud) return undefined;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const c = map.getCenter();
        setHudInfo({ lat: c.lat, lon: c.lng, zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), mpp: metersPerPixel(c.lat, map.getZoom()) });
      });
    };
    update();
    map.on('move', update);
    return () => { map.off('move', update); cancelAnimationFrame(frame); };
  }, [ready, hud]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (shared.any) return;
    try { if (!window.localStorage.getItem(GUIA)) setGuide(true); } catch { setGuide(true); }
  }, [shared.any]);

  const closeGuide = () => {
    setGuide(false);
    try { window.localStorage.setItem(GUIA, '1'); } catch { /* sin almacenamiento: la guía volverá a salir */ }
  };

  const share = async () => {
    const map = mapRef.current;
    const c = map.getCenter();
    const params = new URLSearchParams({
      v: [c.lng.toFixed(5), c.lat.toFixed(5), map.getZoom().toFixed(2), Math.round(map.getBearing()), Math.round(map.getPitch())].join(','),
      base, anio, terr: Object.keys(layers).filter((k) => layers[k]).join(',')
    });
    if (lens) params.set('lente', lens);
    if (thematic.length) params.set('capas', thematic.join(','));
    const url = `${window.location.origin}${window.location.pathname}#twin?${params.toString()}`;
    window.history.replaceState(null, '', `#twin?${params.toString()}`);
    try {
      await navigator.clipboard.writeText(url);
      setToast('Enlace de la vista copiado');
    } catch {
      setToast('Enlace listo en la barra de direcciones');
    }
  };

  const north = () => mapRef.current?.easeTo({ bearing: 0, duration: 600 });
  const resetView = () => {
    clearSelection();
    setMode(null);
    mapRef.current?.flyTo({ ...initialView, essential: true, duration: 900 });
  };

  // ------------------------------------------------------------------ atajos de teclado
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (lensKeys[k]) setLens((actual) => (actual === lensKeys[k] ? null : lensKeys[k]));
      else if (k === 'e') setPanel((p) => (p === 'explorar' ? null : 'explorar'));
      else if (k === 'a') setMode(modeRef.current === 'analizar' ? null : 'analizar');
      else if (k === 'm') setMode(modeRef.current === 'medir' ? null : 'medir');
      else if (k === 'h') setHud((v) => !v);
      else if (k === 'n') north();
      else if (e.key === '?') setHelp((v) => !v);
      else if (e.key === 'Escape') { setMode(null); setHelp(false); setPanel(null); setGuide(false); }
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode]);

  // ------------------------------------------------------------------ "Qué estás viendo"
  const fuenteInfo = (id) => ({ id, ...(fuentes[id] ?? { nombre: id }) });
  const whatItems = [
    { label: `Mapa base: ${bases[base].label}${base === 'ortofoto' ? ` ${anio}` : ''}`, fuentes: bases[base].fuentes.map(fuenteInfo) },
    ...(terrain ? [{ label: 'Relieve 3D', fuentes: [fuenteInfo('terreno-aws')] }] : []),
    ...Object.entries(territoryLayers).filter(([k, l]) => layers[k] && l.fuentes.length).map(([, l]) => ({ label: l.label, fuentes: l.fuentes.map(fuenteInfo) })),
    ...(lens ? [{ label: `Lente: ${lenses[lens].label}`, fuentes: lenses[lens].fuentes.map(fuenteInfo) }] : []),
    ...thematic.map((k) => ({ label: `Capa: ${thematicLayers[k].label}`, fuentes: thematicLayers[k].fuentes.map(fuenteInfo) }))
  ];

  const measureTotal = measure.slice(1).reduce((sum, p, i) => sum + distance(measure[i], p), 0);
  const explorerActions = {
    setBase,
    setAnio: (nuevo) => {
      setAnio(nuevo);
      setCompare((c) => (c.anio === nuevo ? { ...c, anio: ANIOS_ORTOFOTO.find((a) => a !== nuevo) } : c));
    },
    setCompare,
    toggleTerrain: () => setTerrain((v) => !v),
    toggleLayer: (key) => setLayers((current) => ({ ...current, [key]: !current[key] })),
    toggleThematic: (key) => setThematic((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key])),
    resetLayers: () => { setLayers(defaultLayers); setThematic([]); setLens(null); setBase('oscuro'); setCompare((c) => ({ ...c, on: false })); }
  };

  return (
    <section className={`twin-shell ${mode ? `mode-${mode}` : ''}`} aria-label="Gemelo 3D de Medellín">
      <div ref={container} className="map-canvas" />
      <div className="map-top">
        <div className="map-hud"><span className="hud-dot" />{error || status}</div>
        <LensBar lens={lens} onLens={setLens} disabled={!ready} />
      </div>
      <ToolBar panel={panel} mode={mode} hud={hud} disabled={!ready} onPanel={setPanel} onMode={setMode} onHud={() => setHud((v) => !v)} onNorth={north} onShare={share} onHelp={() => setHelp((v) => !v)} />
      {panel === 'explorar' && <ExplorePanel state={{ base, anio, compare, terrain, layers, thematic }} actions={explorerActions} available={available} onClose={() => setPanel(null)} />}
      <div className="map-bottom-left">
        <LensMethod lens={lens} periodos={periodos} />
        <WhatYouSee items={whatItems} open={whatOpen} onToggle={() => setWhatOpen((v) => !v)} />
        <div className="map-tools"><button onClick={resetView}>Restablecer vista</button></div>
      </div>
      {ready && <Legend lens={lens} layers={{ ...layers, buildings: layers.buildings && hasBuildings }} thematic={thematic} />}
      <SelectionCard selection={selection} lens={lens} territory={selection?.source === 'comunas' ? territorios[selection.code] : null}
        onFocus={() => mapRef.current?.fitBounds(featureBounds(selection.geometry), { padding: 80, pitch: 52, bearing: -15, duration: 900, maxZoom: 16 })}
        onClose={clearSelection} />
      {mode === 'analizar' && (analysis ? <AnalysisPanel result={analysis} onClose={() => setMode(null)} /> : <aside className="side-panel hint"><b>Analizar</b><p>Haz clic en cualquier punto para resumir su entorno en radios de 500 m y 1 km.</p><button onClick={() => setMode(null)}>Salir (Esc)</button></aside>)}
      {mode === 'medir' && <MeasurePanel points={measure} total={measureTotal} onClear={() => { measureRef.current = []; setMeasure([]); mapRef.current?.getSource('medicion')?.setData({ type: 'FeatureCollection', features: [] }); }} onClose={() => setMode(null)} />}
      {hud && <Hud info={hudInfo} />}
      {help && <HelpOverlay onClose={() => setHelp(false)} onGuide={() => { setHelp(false); setGuide(true); }} />}
      {guide && ready && <StartGuide onStart={() => { setLens('cruce'); closeGuide(); }} onClose={closeGuide} />}
      {toast && <div className="map-toast" role="status">{toast}</div>}
      {warning && <div className="map-warning">{warning}</div>}
      {error && <div className="map-error"><strong>Mapa no disponible</strong><span>{error}</span><button onClick={() => window.location.reload()}>Reintentar</button></div>}
    </section>
  );
}
