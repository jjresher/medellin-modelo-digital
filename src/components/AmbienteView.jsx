'use client';

import { useMemo } from 'react';
import { BloqueAire, BloqueLluvia, BloqueRuido, BloqueSismos, cifraViva } from './ambiente/Bloques';
import EstacionesMap from './ambiente/EstacionesMap';
import MetricCard from './MetricCard';
import { categoriaIca, esMedellin, hora, marcaSiata, municipioVisible, numero, rasgos, useVivo } from '../lib/vivo';

// Sección Ambiente: lo que cambia cada pocos minutos se lee en vivo del proxy /api/ambiente y siempre muestra la
// hora de su lectura; lo estable (tamaño de las redes, serie de sismos, mapa de ruido del AMVA) sale del lago.

function EstadoVivo({ lecturas }) {
  const listas = lecturas.filter((l) => l.estado === 'listo');
  const obsoletas = listas.filter((l) => l.obsoleto);
  const fallidas = lecturas.filter((l) => l.estado === 'error');
  const leido = listas.map((l) => l.leido).sort().at(-1);
  const minutos = obsoletas.length ? Math.round(Math.min(...obsoletas.map((l) => l.edad ?? 0)) / 60) : 0;
  return (
    <div className="vivo-estado">
      <p>
        <i className={obsoletas.length ? 'stale' : 'live'} />
        {listas.length === 0 ? 'Leyendo datos en vivo…' : `Lectura de las ${hora(leido)}`}
        <small>Se refresca cada 10 minutos. El proxy guarda la última copia de cada fuente.</small>
      </p>
      <button onClick={() => lecturas.forEach((l) => l.recargar())}>Actualizar ahora</button>
      {obsoletas.length > 0 && (
        <span className="vivo-aviso">El SIATA no respondió en {obsoletas.length} de {lecturas.length} consultas: se muestra la última copia guardada, de hace {minutos} min.</span>
      )}
      {fallidas.length > 0 && (
        <span className="vivo-aviso">{fallidas.length} de {lecturas.length} consultas no tienen ninguna copia disponible todavía.</span>
      )}
    </div>
  );
}

function Alertas({ alertas }) {
  if (alertas.estado !== 'listo') return null;
  const lista = Array.isArray(alertas.datos) ? alertas.datos : [];
  if (!lista.length) {
    return <p className="sec-note alertas-vacio">Sin alertas activas en el geoportal ciudadano del SIATA · leído a las {hora(alertas.leido)}.</p>;
  }
  return (
    <div className="warning-note alertas-siata">
      <span>⚠</span>
      <div>
        <b>{lista.length} {lista.length === 1 ? 'alerta activa' : 'alertas activas'} del SIATA</b>
        {lista.map((a) => (
          <p key={a.id_alerta}><b>{a.title}</b> {a.description}
            <em> {a.start_date}{a.end_date ? ` → ${a.end_date}` : ''}</em>
          </p>
        ))}
      </div>
    </div>
  );
}

function cifrasEnVivo(aire, meteo, pluvios) {
  const estaciones = rasgos(aire);
  const icas = estaciones.map((e) => e.ICA_24H_prom).filter((v) => typeof v === 'number');
  const ventana = estaciones[0] ? `${marcaSiata(estaciones[0].fechaInicio)} → ${marcaSiata(estaciones[0].fechaFin)}` : 'En vivo';
  const peor = icas.length ? estaciones.reduce((a, b) => ((b.ICA_24H_prom ?? -1) > (a.ICA_24H_prom ?? -1) ? b : a)) : null;
  const temperaturas = rasgos(meteo).map((e) => e.Temperatura).filter((v) => typeof v === 'number');
  const lluvias = rasgos(pluvios).filter(esMedellin);
  const conLluvia = lluvias.filter((e) => typeof e.acumulado_15min === 'number');
  const maxLluvia = conLluvia.length ? conLluvia.reduce((a, b) => (b.acumulado_15min > a.acumulado_15min ? b : a)) : null;

  return [
    icas.length && cifraViva('ica_promedio', 'ICA promedio del valle (24 h)',
      icas.reduce((s, v) => s + v, 0) / icas.length, 'ICA', 'siata-pm25', ventana,
      { estado: 'derivado', decimales: 1, nota: `Promedio simple del ICA de las ${icas.length} estaciones de calidad del aire del Valle de Aburrá, sin ponderar por población.` }),
    peor && cifraViva('ica_maximo', `ICA más alto · ${(peor.nombreEstacion ?? '').trim()}`, peor.ICA_24H_prom, 'ICA', 'siata-pm25', ventana,
      { nota: `${municipioVisible(peor)} · PM2.5 ${numero(peor.PM25_24H_prom, 1)} µg/m³ · categoría ${categoriaIca(peor.ICA_24H_prom)?.nombre ?? 'sin clasificar'} en la escala del ICA.` }),
    temperaturas.length && cifraViva('temperatura_promedio', 'Temperatura promedio del valle',
      temperaturas.reduce((s, v) => s + v, 0) / temperaturas.length, '°C', 'siata-meteo',
      meteo.leido ? `Lectura ${hora(meteo.leido)}` : 'En vivo',
      { estado: 'derivado', decimales: 1, nota: `Promedio de las ${temperaturas.length} estaciones meteorológicas. La capa del SIATA no publica la hora de cada medición: la vigencia es la hora de la lectura.` }),
    maxLluvia && cifraViva('lluvia_15min', `Lluvia en 15 min · máximo de ${lluvias.length} pluviómetros`,
      maxLluvia.acumulado_15min, 'mm', 'siata-pluvios', marcaSiata(maxLluvia.fecha_ultima_actualizacion) || 'En vivo',
      { decimales: 1, nota: `Pluviómetro con más lluvia en los últimos 15 minutos en Medellín: ${(maxLluvia.nombre ?? '').trim()}. La capa en vivo publica solo esa ventana; el acumulado de 24 horas y de 30 días está abajo, por estación.` })
  ].filter(Boolean);
}

export default function AmbienteView({ tema, onSource }) {
  const aire = useVivo('pm25');
  const pluvios = useVivo('pluvios');
  const niveles = useVivo('niveles');
  const meteo = useVivo('meteo');
  const ruido = useVivo('ruido');
  const alertas = useVivo('alertas');
  const sismos = useVivo('sismos');
  const cifras = useMemo(() => cifrasEnVivo(aire, meteo, pluvios), [aire, meteo, pluvios]);

  if (!tema) {
    return <section className="view"><p className="lake-message">El tema de ambiente no está disponible. Genera el lago con la ingesta (ver README).</p></section>;
  }
  const redes = ['estaciones_pm25', 'estaciones_pluvios', 'estaciones_niveles', 'estaciones_meteo', 'estaciones_ruido']
    .filter((k) => tema.cifras[k]).map((k) => tema.cifras[k]);

  return (
    <section className="view ambiente-view">
      <div className="view-intro">
        <p className="eyebrow">MEDELLÍN · AMBIENTE Y SATÉLITE</p>
        <h1>El valle, <em>ahora mismo.</em></h1>
        <p>Calidad del aire, lluvia, nivel de quebradas, temperatura y ruido del Valle de Aburrá, leídos del SIATA en el momento en que abres la página. Cada cifra trae la hora de su lectura; cuando el SIATA no responde, se muestra la última copia guardada y se dice de cuándo es.</p>
      </div>
      <EstadoVivo lecturas={[aire, pluvios, niveles, meteo, ruido, alertas, sismos]} />
      <Alertas alertas={alertas} />
      {cifras.length > 0 && <div className="metrics-grid">{cifras.map((c) => <MetricCard key={c.clave} cifra={c} onSource={onSource} />)}</div>}
      {redes.length > 0 && (
        <p className="sec-note redes-nota">Redes consultadas: {redes.map((c) => `${c.valor} ${c.etiqueta.toLowerCase()}`).join(' · ')}. Los conteos salen del lago; las lecturas, del proxy en vivo.</p>
      )}

      <BloqueAire aire={aire} onSource={onSource} />
      <BloqueLluvia pluvios={pluvios} onSource={onSource} />

      <section className="sec-block">
        <div className="section-heading"><div><p className="eyebrow">MAPA EN VIVO Y CAPAS SATELITALES</p><h2>Estaciones, ruido y satélite</h2></div></div>
        <p className="sec-note">Las estaciones se dibujan con el color que publica el SIATA. El mapa de ruido del AMVA es un estudio modelado, generalizado a ~67 m y recortado al Distrito. Las luces nocturnas VIIRS (NASA) tienen teselas hasta ~2 km por píxel y el mosaico Sentinel-2 de 2023 (EOX, licencia CC BY-NC-SA) solo puede usarse sin fin comercial.</p>
        <EstacionesMap aire={aire} niveles={niveles} pluvios={pluvios} ruido={ruido} />
      </section>

      <BloqueRuido ruido={ruido} tema={tema} onSource={onSource} />
      <BloqueSismos sismos={sismos} tema={tema} onSource={onSource} />
    </section>
  );
}
