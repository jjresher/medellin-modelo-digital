'use client';

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { accent, sequential } from '../charts/tokens';

// Coroplético de las 16 comunas y 5 corregimientos con los límites del gemelo (comunas.geojson). Recibe los valores ya
// calculados por código de territorio, así que sirve para cualquier indicador de lago.Territorios (Municipio, Atlas…).
// Los territorios sin dato quedan en gris oscuro, fuera de la rampa, y la leyenda lo dice.
const SIN_DATO = '#23241f';

export default function MapaTerritorios({ valores, etiqueta, formatValue = (v) => v, formatLegend = formatValue, color = accent.orange, seleccionado, onSelect, height = 420 }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const geoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [rango, setRango] = useState(null);
  const [popup, setPopup] = useState(null);
  // Refs para leer lo más reciente dentro de listeners registrados una sola vez.
  const valoresRef = useRef(valores);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { valoresRef.current = valores; onSelectRef.current = onSelect; }, [valores, onSelect]);

  useEffect(() => {
    let activo = true;
    maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
    const map = new maplibregl.Map({
      container: container.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [-75.61, 6.25],
      zoom: 10.2,
      attributionControl: false
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    // La atribución compacta arranca desplegada y en una tarjeta angosta tapa la leyenda: se pliega al cargar.
    map.once('load', () => map.getContainer().querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show'));
    // El mapa toma su tamaño al crearse; si la tarjeta termina de maquetarse después (grilla en móvil), se reajusta.
    const observador = new ResizeObserver(() => map.resize());
    observador.observe(container.current);
    map.once('style.load', async () => {
      try {
        const limites = await fetch('/data/geo/comunas.geojson').then((r) => r.json());
        if (!activo) return;
        const features = limites.features
          .filter((f) => f.properties.NOMBRE && /^\d+$/.test(f.properties.CODIGO))
          .map((f) => ({ ...f, properties: { codigo: f.properties.CODIGO, nombre: f.properties.NOMBRE.replace(/^Corregimiento de /, ''), tipo: Number(f.properties.CODIGO) >= 50 ? 'Corregimiento' : 'Comuna' } }));
        geoRef.current = { type: 'FeatureCollection', features };
        map.addSource('territorios', { type: 'geojson', data: geoRef.current });
        map.addLayer({ id: 'territorios-fill', type: 'fill', source: 'territorios', paint: { 'fill-color': SIN_DATO, 'fill-opacity': 0.8 } });
        map.addLayer({ id: 'territorios-line', type: 'line', source: 'territorios', paint: { 'line-color': '#f8f8f2', 'line-width': 0.6, 'line-opacity': 0.45 } });
        map.addLayer({ id: 'territorios-sel', type: 'line', source: 'territorios', filter: ['==', ['get', 'codigo'], ''], paint: { 'line-color': accent.yellow, 'line-width': 2.4 } });
        map.on('click', 'territorios-fill', (event) => {
          const p = event.features?.[0]?.properties;
          if (!p) return;
          setPopup({ ...p, valor: valoresRef.current?.[p.codigo] ?? null });
          onSelectRef.current?.(p.codigo);
        });
        map.on('mouseenter', 'territorios-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'territorios-fill', () => { map.getCanvas().style.cursor = ''; });
        setReady(true);
      } catch { /* sin límites el mapa queda vacío; el ranking y la ficha siguen funcionando */ }
    });
    return () => { activo = false; observador.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !geoRef.current) return;
    const numeros = Object.values(valores ?? {}).filter((v) => v != null);
    geoRef.current.features.forEach((f) => { f.properties.valor = valores?.[f.properties.codigo] ?? null; });
    map.getSource('territorios').setData(geoRef.current);
    if (!numeros.length) { setRango(null); return; }
    const min = Math.min(...numeros);
    const max = Math.max(...numeros);
    const medio = (min + max) / 2;
    const rampa = sequential(color);
    const paso = (t) => min + (max - min || 1) * (t / 100);
    map.setPaintProperty('territorios-fill', 'fill-color', ['case', ['==', ['get', 'valor'], null], SIN_DATO,
      ['interpolate', ['linear'], ['get', 'valor'], ...rampa.flatMap(([t, c]) => [paso(t), c])]]);
    setRango({ min, medio, max, colores: rampa.map(([, c]) => c) });
    setPopup((actual) => (actual ? { ...actual, valor: valores?.[actual.codigo] ?? null } : null));
  }, [ready, valores, color]);

  useEffect(() => {
    if (ready) mapRef.current.setFilter('territorios-sel', ['==', ['get', 'codigo'], seleccionado ?? '']);
  }, [ready, seleccionado]);

  return (
    <div className="barrio-map territorios-map" style={{ height }}>
      <div ref={container} className="barrio-map-canvas" />
      {popup && (
        <div className="comuna-card barrio-popup">
          <span>{popup.tipo}</span>
          <strong>{popup.nombre}</strong>
          <dl><dt>{etiqueta}</dt><dd>{popup.valor == null ? 'sin dato' : formatValue(popup.valor)}</dd></dl>
          <button onClick={() => setPopup(null)}>Cerrar</button>
        </div>
      )}
      {rango && (
        <div className="map-legend barrio-legend">
          <div className="legend-block">
            <span>{etiqueta.toUpperCase()}</span>
            <div className="legend-ramp" style={{ background: `linear-gradient(90deg, ${rango.colores.join(', ')})` }} />
            <div className="legend-ticks"><i>{formatLegend(rango.min)}</i><i>{formatLegend(rango.medio)}</i><i>{formatLegend(rango.max)}</i></div>
            <em><i className="square" style={{ background: SIN_DATO }} />Sin dato</em>
          </div>
        </div>
      )}
    </div>
  );
}
