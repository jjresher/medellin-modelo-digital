'use client';

import Map3D from './Map3D';

export default function DigitalTwinView() {
  return (
    <section className="view twin-view">
      <div className="view-intro split-intro">
        <div><p className="eyebrow">MEDELLÍN · EXPLORACIÓN ESPACIAL</p><h1>Gemelo <em>3D</em></h1></div>
        <p>Desplázate, rota y acerca la ciudad. Activa capas, selecciona una comuna o toca un edificio para consultar su huella. Las alturas son extrusiones visuales, no mediciones por edificio.</p>
      </div>
      <Map3D />
      <div className="twin-notes"><span>GOOGLE OPEN BUILDINGS V3</span><span>16 COMUNAS OFICIALES</span><span>CALLES Y LUGARES OSM</span><span>CC BY 4.0 / ODbL</span></div>
    </section>
  );
}
