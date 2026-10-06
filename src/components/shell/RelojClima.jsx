'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { fechaMedellin, horaMedellin, leerClima } from '../../lib/clima';
import { useVivo } from '../../lib/vivo';

// Reloj y clima actual de Medellín en la cabecera (issue #16). La hora es la de Medellín aunque quien mira esté en otra
// zona horaria. El clima es la lectura de Open-Meteo a través del proxy /api/ambiente/clima (se refresca cada 10 minutos);
// el detalle dice que es un modelo meteorológico para una celda, no una estación, y de qué hora es el valor.

// La hora cambia cada minuto; se revisa cada segundo para no mostrar un minuto viejo. En el servidor no hay hora:
// el reloj aparece al hidratar.
const suscribirReloj = (avisar) => {
  const id = window.setInterval(avisar, 1000);
  return () => window.clearInterval(id);
};
const horaActual = () => horaMedellin(new Date());
const sinHora = () => '';

export default function RelojClima({ fuente, onSource, onNavigate }) {
  const hora = useSyncExternalStore(suscribirReloj, horaActual, sinHora);
  const lectura = useVivo('clima');
  const clima = lectura.estado === 'listo' ? leerClima(lectura.datos) : null;
  const [abierto, setAbierto] = useState(false);
  const caja = useRef(null);

  // El detalle se cierra al tocar fuera o con Esc.
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      if (!caja.current?.contains(e.target)) setAbierto(false);
    };
    const tecla = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const resumen = clima ? `${hora}, ${clima.temperatura}, ${clima.tiempo.toLowerCase()}` : hora;
  return (
    <div className="reloj-clima" ref={caja}>
      <button
        className="reloj-clima-boton"
        aria-expanded={abierto}
        aria-controls="clima-detalle"
        aria-label={`Hora y clima en Medellín: ${resumen}. Ver detalle`}
        onClick={() => setAbierto((v) => !v)}
      >
        <time>{hora}</time>
        {clima && (
          <span className="reloj-clima-temp">
            <span aria-hidden="true">{clima.simbolo}</span> {clima.temperatura}
          </span>
        )}
      </button>
      {abierto && (
        <div id="clima-detalle" className="clima-detalle" role="region" aria-label="Clima en Medellín">
          <p className="eyebrow">MEDELLÍN · AHORA</p>
          <p className="clima-hora">
            <strong>{hora}</strong> {hora && fechaMedellin(new Date())}
          </p>
          {lectura.estado === 'cargando' && <p className="clima-nota">Leyendo el clima…</p>}
          {lectura.estado === 'error' && <p className="clima-nota">Sin datos del clima: {lectura.error}</p>}
          {lectura.estado === 'listo' && !clima && <p className="clima-nota">Open-Meteo respondió sin temperatura.</p>}
          {clima && (
            <>
              <p className="clima-principal">
                <span aria-hidden="true">{clima.simbolo}</span>
                <strong>{clima.temperatura}</strong>
                {clima.tiempo}
              </p>
              <dl className="clima-datos">
                {clima.sensacion && (
                  <>
                    <dt>Sensación térmica</dt>
                    <dd>{clima.sensacion}</dd>
                  </>
                )}
                {clima.humedad && (
                  <>
                    <dt>Humedad relativa</dt>
                    <dd>{clima.humedad}</dd>
                  </>
                )}
                {clima.viento && (
                  <>
                    <dt>Viento a 10 m</dt>
                    <dd>{clima.viento}</dd>
                  </>
                )}
                {clima.lluvia && (
                  <>
                    <dt>Precipitación{clima.intervalo ? ` (${clima.intervalo} min previos)` : ''}</dt>
                    <dd>{clima.lluvia}</dd>
                  </>
                )}
              </dl>
              <p className="clima-nota">
                Valor de las {clima.hora}
                {clima.intervalo ? `; el modelo se actualiza cada ${clima.intervalo} minutos` : ''}. Open-Meteo calcula el clima con modelos
                meteorológicos para una celda{clima.celda ? ` (${clima.celda})` : ''}: no es la lectura de una estación.
                {lectura.obsoleto && ` Open-Meteo no respondió en la última consulta; se muestra la lectura guardada.`}
              </p>
            </>
          )}
          <p className="clima-pie">
            {fuente && (
              <>
                <span className={`estado ${fuente.estado}`}>{fuente.estado}</span>
                <button
                  className="link-fuente"
                  onClick={() => {
                    setAbierto(false);
                    onSource(fuente.id);
                  }}
                >
                  Ver fuente ↗
                </button>
              </>
            )}
            <button
              className="link-fuente"
              onClick={() => {
                setAbierto(false);
                onNavigate('environment');
              }}
            >
              Estaciones del SIATA →
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
