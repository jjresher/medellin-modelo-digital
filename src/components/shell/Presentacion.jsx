'use client';

import { useEffect, useRef, useState } from 'react';
import { navigation } from '../../data/navegacion';

// Modo presentación (issue #16): recorre las 14 secciones a pantalla completa, una cada DURACION_S segundos, y vuelve a
// empezar después de la última. La barra de progreso es el temporizador: al terminar su animación pasa a la siguiente, y
// pausarla la detiene. Se pausa sola si alguien toca la pantalla o se desplaza, para no cambiarle la sección mientras
// la mira. Teclas: ← → (y las de un control de diapositivas, Av Pág / Re Pág), P para pausar, Esc para salir.
// Donde el navegador no permite pantalla completa (Safari en el iPhone), la presentación sigue sin ella.
export const DURACION_S = 25;

export default function Presentacion({ activo, onIr, onSalir }) {
  const [pausa, setPausa] = useState(false);
  const barra = useRef(null);
  const i = Math.max(
    0,
    navigation.findIndex(([id]) => id === activo)
  );
  const total = navigation.length;
  const ir = (paso) => onIr(navigation[(i + paso + total) % total][0]);
  // Los listeners se registran una vez y leen lo último por ref.
  const irRef = useRef(ir);
  const salirRef = useRef(onSalir);
  useEffect(() => {
    irRef.current = ir;
    salirRef.current = onSalir;
  });

  // Pantalla completa al entrar; si quien mira sale de ella (Esc del navegador), sale también de la presentación.
  useEffect(() => {
    const raiz = document.documentElement;
    let dentro = false;
    const alCambiar = () => {
      if (document.fullscreenElement) dentro = true;
      else if (dentro) salirRef.current();
    };
    document.addEventListener('fullscreenchange', alCambiar);
    if (raiz.requestFullscreen && !document.fullscreenElement) raiz.requestFullscreen().catch(() => {});
    return () => {
      document.removeEventListener('fullscreenchange', alCambiar);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const tecla = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        salirRef.current();
        return;
      }
      // En un campo o sobre un mapa, las flechas son del campo o del mapa.
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.target.closest?.('.maplibregl-map, dialog')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') irRef.current(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') irRef.current(-1);
      else if (e.key === 'p' || e.key === 'P') setPausa((v) => !v);
      else return;
      e.preventDefault();
    };
    const tocar = (e) => {
      if (!barra.current?.contains(e.target)) setPausa(true);
    };
    window.addEventListener('keydown', tecla);
    document.addEventListener('pointerdown', tocar);
    document.addEventListener('wheel', tocar, { passive: true });
    return () => {
      window.removeEventListener('keydown', tecla);
      document.removeEventListener('pointerdown', tocar);
      document.removeEventListener('wheel', tocar);
    };
  }, []);

  const nombre = navigation[i][2];
  return (
    <div className="presentacion" ref={barra} role="region" aria-label="Modo presentación">
      <button onClick={() => ir(-1)} aria-label="Sección anterior" title="Sección anterior (←)">
        ←
      </button>
      <p aria-live="polite">
        <strong>{nombre}</strong>
        <span>
          {i + 1} / {total}
          {pausa ? ' · en pausa' : ''}
        </span>
      </p>
      <button
        onClick={() => setPausa((v) => !v)}
        aria-label={pausa ? 'Reanudar' : 'Pausar'}
        aria-pressed={pausa}
        title={pausa ? 'Reanudar (P)' : 'Pausar (P)'}
      >
        {pausa ? '▶' : '❚❚'}
      </button>
      <button onClick={() => ir(1)} aria-label="Sección siguiente" title="Sección siguiente (→)">
        →
      </button>
      <button onClick={onSalir} aria-label="Salir de la presentación" title="Salir (Esc)">
        ✕
      </button>
      <i className="presentacion-progreso" aria-hidden="true">
        {/* La clave reinicia la animación en cada sección. */}
        <b
          key={activo}
          style={{ animationDuration: `${DURACION_S}s`, animationPlayState: pausa ? 'paused' : 'running' }}
          onAnimationEnd={() => ir(1)}
        />
      </i>
    </div>
  );
}
