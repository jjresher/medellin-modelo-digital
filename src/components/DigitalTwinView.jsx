'use client';

import Map3D from './twin/Map3D';

export default function DigitalTwinView({ gemelo, lentes, catalogo }) {
  return (
    <section className="view twin-view">
      <div className="view-intro split-intro">
        <div><p className="eyebrow">MEDELLÍN · EXPLORACIÓN ESPACIAL</p><h1>Gemelo <em>3D</em></h1></div>
        <p>Explora Medellín por preguntas: usa las lentes de energía, densificación y presión vial, activa capas temáticas en Explorar, analiza el entorno de cualquier punto o toca una construcción para ver sus pisos según el catastro distrital. La altura catastral se deriva del número de pisos (≈ 2,3 m por piso), no de una medición del edificio.</p>
      </div>
      <Map3D gemelo={gemelo} lentes={lentes} catalogo={catalogo} />
      <div className="twin-notes"><span>CATASTRO DISTRITAL · IDEM</span><span>ALTURA CATASTRAL ≈ PISOS × 2,3 M</span><span>ORTOFOTO 2024 · ALCALDÍA</span><span>RELIEVE MAPZEN / AWS</span><span>CALLES OSM · ODbL</span></div>
    </section>
  );
}
