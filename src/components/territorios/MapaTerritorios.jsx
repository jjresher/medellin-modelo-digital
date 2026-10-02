'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ajustesComunes, maplibregl, prepararMaplibre } from '../../lib/maplibre';
import { accent, sequential } from '../charts/tokens';

// Coroplético de las 16 comunas y 5 corregimientos con los límites del gemelo (comunas.geojson). Recibe los valores ya
// calculados por código de territorio, así que sirve para cualquier indicador de lago.Territorios (Municipio, Atlas…).
// `etiqueta` titula la leyenda (suele ser la unidad) y `rotulo`, el valor del popup (por defecto, la misma etiqueta).
// Los territorios sin dato quedan en gris oscuro, fuera de la rampa, y la leyenda lo dice.
// Con `nivel="barrios"` dibuja los 271 barrios y las 79 veredas (Atlas); el nivel se lee al montar el mapa, así que para
// cambiarlo hay que montar otro (key distinta).
const SIN_DATO = '#23241f';

const NIVELES = {
  comunas: {
    archivos: ['/data/geo/comunas.geojson'],
    borde: 0.6,
    propiedades: (p) =>
      p.NOMBRE && /^\d+$/.test(p.CODIGO)
        ? { codigo: p.CODIGO, nombre: p.NOMBRE.replace(/^Corregimiento de /, ''), tipo: Number(p.CODIGO) >= 50 ? 'Corregimiento' : 'Comuna' }
        : null
  },
  barrios: {
    archivos: ['/data/geo/barrios.geojson', '/data/geo/veredas.geojson'],
    borde: 0.35,
    // El nombre de la comuna se toma de comunas.geojson (con tildes); el de los barrios viene en mayúsculas y sin ellas.
    propiedades: (p, archivo, comunas) => ({
      codigo: p.CODIGO,
      nombre: p.NOMBRE_BARRIO,
      tipo: archivo === 0 ? 'Barrio' : 'Vereda',
      comuna: comunas[p.COMUNA] ?? p.NOMBRE_COMUNA
    })
  }
};

// comunas.geojson trae dos polígonos sin nombre (no son comunas ni corregimientos): se omiten.
const nombresDeComunas = (limites) =>
  Object.fromEntries(
    limites.features.filter((f) => f.properties.NOMBRE).map((f) => [f.properties.CODIGO, f.properties.NOMBRE.replace(/^Corregimiento de /, '')])
  );

export default function MapaTerritorios({
  valores,
  etiqueta,
  rotulo = etiqueta,
  formatValue = (v) => v,
  formatLegend = formatValue,
  color = accent.orange,
  seleccionado,
  onSelect,
  height = 420,
  nivel = 'comunas'
}) {
  const nivelInicial = useRef(nivel);
  const container = useRef(null);
  const mapRef = useRef(null);
  const geoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [popup, setPopup] = useState(null);
  // Refs para leer lo más reciente dentro de listeners registrados una sola vez.
  const valoresRef = useRef(valores);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    valoresRef.current = valores;
    onSelectRef.current = onSelect;
  }, [valores, onSelect]);

  useEffect(() => {
    let activo = true;
    prepararMaplibre();
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
    ajustesComunes(map);
    // El mapa toma su tamaño al crearse; si la tarjeta termina de maquetarse después (grilla en móvil), se reajusta.
    const observador = new ResizeObserver(() => map.resize());
    observador.observe(container.current);
    map.once('style.load', async () => {
      try {
        const { archivos, propiedades, borde } = NIVELES[nivelInicial.current];
        const colecciones = await Promise.all(archivos.map((url) => fetch(url).then((r) => r.json())));
        const comunas = nivelInicial.current === 'barrios' ? nombresDeComunas(await fetch('/data/geo/comunas.geojson').then((r) => r.json())) : {};
        if (!activo) return;
        const features = colecciones.flatMap((coleccion, archivo) =>
          coleccion.features.map((f) => ({ ...f, properties: propiedades(f.properties, archivo, comunas) })).filter((f) => f.properties)
        );
        geoRef.current = { type: 'FeatureCollection', features };
        map.addSource('territorios', { type: 'geojson', data: geoRef.current });
        map.addLayer({ id: 'territorios-fill', type: 'fill', source: 'territorios', paint: { 'fill-color': SIN_DATO, 'fill-opacity': 0.8 } });
        map.addLayer({
          id: 'territorios-line',
          type: 'line',
          source: 'territorios',
          paint: { 'line-color': '#f8f8f2', 'line-width': borde, 'line-opacity': 0.45 }
        });
        map.addLayer({
          id: 'territorios-sel',
          type: 'line',
          source: 'territorios',
          filter: ['==', ['get', 'codigo'], ''],
          paint: { 'line-color': accent.yellow, 'line-width': 2.4 }
        });
        map.on('click', 'territorios-fill', (event) => {
          const p = event.features?.[0]?.properties;
          if (!p) return;
          setPopup({ ...p, valor: valoresRef.current?.[p.codigo] ?? null });
          onSelectRef.current?.(p.codigo);
        });
        map.on('mouseenter', 'territorios-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'territorios-fill', () => {
          map.getCanvas().style.cursor = '';
        });
        setReady(true);
      } catch {
        /* sin límites el mapa queda vacío; el ranking y la ficha siguen funcionando */
      }
    });
    return () => {
      activo = false;
      observador.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Mínimo, punto medio y máximo de los valores, con la rampa de color del mapa y de la leyenda.
  const rango = useMemo(() => {
    const numeros = Object.values(valores ?? {}).filter((v) => v != null);
    if (!numeros.length) return null;
    const min = Math.min(...numeros);
    const max = Math.max(...numeros);
    return { min, medio: (min + max) / 2, max, rampa: sequential(color) };
  }, [valores, color]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !geoRef.current) return;
    geoRef.current.features.forEach((f) => {
      f.properties.valor = valores?.[f.properties.codigo] ?? null;
    });
    map.getSource('territorios').setData(geoRef.current);
    if (rango) {
      const { min, max, rampa } = rango;
      const paso = (t) => min + (max - min || 1) * (t / 100);
      map.setPaintProperty('territorios-fill', 'fill-color', [
        'case',
        ['==', ['get', 'valor'], null],
        SIN_DATO,
        ['interpolate', ['linear'], ['get', 'valor'], ...rampa.flatMap(([t, c]) => [paso(t), c])]
      ]);
    }
    setPopup((actual) => (actual ? { ...actual, valor: valores?.[actual.codigo] ?? null } : null));
  }, [ready, valores, rango]);

  useEffect(() => {
    if (ready) mapRef.current.setFilter('territorios-sel', ['==', ['get', 'codigo'], seleccionado ?? '']);
  }, [ready, seleccionado]);

  return (
    <div className="barrio-map territorios-map" style={{ minHeight: height }}>
      <div ref={container} className="barrio-map-canvas" />
      {popup && (
        <div className="comuna-card barrio-popup">
          <span>{popup.comuna ? `${popup.tipo} · ${popup.comuna}` : popup.tipo}</span>
          <strong>{popup.nombre}</strong>
          <dl>
            <dt>{rotulo}</dt>
            <dd>{popup.valor == null ? 'sin dato' : formatValue(popup.valor)}</dd>
          </dl>
          <button onClick={() => setPopup(null)}>Cerrar</button>
        </div>
      )}
      {rango && (
        <div className="map-legend barrio-legend">
          <div className="legend-block">
            <span>{etiqueta.toUpperCase()}</span>
            <div className="legend-ramp" style={{ background: `linear-gradient(90deg, ${rango.rampa.map(([, c]) => c).join(', ')})` }} />
            <div className="legend-ticks">
              <i>{formatLegend(rango.min)}</i>
              <i>{formatLegend(rango.medio)}</i>
              <i>{formatLegend(rango.max)}</i>
            </div>
            <em>
              <i className="square" style={{ background: SIN_DATO }} />
              Sin dato
            </em>
          </div>
        </div>
      )}
    </div>
  );
}
