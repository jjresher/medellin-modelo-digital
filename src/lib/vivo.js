'use client';

import { useCallback, useEffect, useState } from 'react';

// Lecturas en vivo a través del proxy /api/ambiente (ver src/app/api/ambiente). A diferencia del lago, que se
// genera con la ingesta, estos datos cambian cada pocos minutos: cada lectura viene con la hora en que se tomó
// (`leido`) y con `obsoleto` en true cuando el SIATA no respondió y se está viendo la última copia guardada.
const BASE = '/api/ambiente';
const REFRESCO_MS = 10 * 60 * 1000; // la misma ventana de caché del proxy

// El SIATA marca una lectura sin dato con -999 (por ejemplo, una estación de ruido fuera de servicio). Se cambia por null
// en toda la respuesta para que no se muestre ni se promedie como si fuera una medición.
const SIN_DATO_SIATA = -999;
export function sinCentinelas(valor) {
  if (valor === SIN_DATO_SIATA) return null;
  if (Array.isArray(valor)) return valor.map(sinCentinelas);
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, sinCentinelas(v)]));
  return valor;
}

export function useVivo(recurso) {
  const [lectura, setLectura] = useState({ estado: 'cargando' });
  // Cada disparo es un objeto nuevo: `forzar` distingue el botón (pide un dato nuevo al proxy) del refresco
  // automático (respeta la caché del proxy, que vence a la vez).
  const [disparo, setDisparo] = useState({ forzar: false });
  const recargar = useCallback(() => setDisparo({ forzar: true }), []);

  useEffect(() => {
    if (!recurso) return undefined;
    let activo = true;
    // Marcar que empieza una lectura (nueva o de refresco) es parte de sincronizar con el proxy, no un estado derivado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLectura((previo) => (previo.recurso === recurso ? { ...previo, refrescando: true } : { estado: 'cargando', recurso }));
    fetch(`${BASE}/${recurso}${disparo.forzar ? '?forzar=1' : ''}`, { cache: 'no-store' })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json().catch(() => null);
        if (!respuesta.ok) throw new Error(cuerpo?.error ?? `HTTP ${respuesta.status}`);
        return cuerpo;
      })
      .then((cuerpo) => {
        if (activo) {
          setLectura({
            estado: 'listo',
            recurso,
            datos: sinCentinelas(cuerpo.datos),
            leido: cuerpo.leido,
            edad: cuerpo.edad_s,
            obsoleto: cuerpo.obsoleto,
            aviso: cuerpo.error
          });
        }
      })
      .catch((error) => {
        if (activo) setLectura({ estado: 'error', recurso, error: error.message });
      });
    return () => {
      activo = false;
    };
  }, [recurso, disparo]);

  useEffect(() => {
    const id = window.setInterval(() => setDisparo({ forzar: false }), REFRESCO_MS);
    return () => window.clearInterval(id);
  }, []);

  // Sin recurso no hay nada que leer: el estado guardado (de una lectura anterior) no se muestra.
  return recurso ? { ...lectura, recargar } : { estado: 'vacio', recargar };
}

export const rasgos = (lectura) => (lectura.datos?.features ?? []).map((f) => ({ ...f.properties, geometry: f.geometry }));

export const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
export const numero = (valor, decimales = 0) =>
  valor == null || Number.isNaN(Number(valor))
    ? '—'
    : Number(valor).toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

// Una estación de ruido sin lectura en la ventana (null tras quitar el -999) se rotula, no se muestra como un número.
export const decibeles = (valor) => (valor == null ? 'sin dato' : `${numero(valor, 1)} dB(A)`);

// Las marcas de tiempo del SIATA vienen como "2026-09-26 22:18:03", en hora local y sin zona: se muestran
// tal cual (sin los segundos) en vez de reinterpretarlas como una fecha con zona horaria.
export const marcaSiata = (texto) => (typeof texto === 'string' ? texto.replace('T', ' ').slice(0, 16) : '');

// Cada red del SIATA publica el municipio con un nombre de campo distinto (igual que en pull_ambiente.py).
export function municipioDe(props) {
  for (const clave of ['Municipio', 'municipio', 'ubicacion', 'Ciudad']) {
    const valor = props?.[clave];
    if (typeof valor === 'string' && valor.trim()) return valor.trim();
  }
  return '';
}

export const esMedellin = (props) => municipioDe(props).toLowerCase().startsWith('medell');

// El SIATA escribe el municipio de varias formas dentro de una misma capa ("Medellín", "Medellin", "Medellin ").
// Para una tabla se unifica el nombre de Medellín; los demás municipios se muestran como vengan.
export const municipioVisible = (props) => (esMedellin(props) ? 'Medellín' : municipioDe(props));

// Escala oficial del ICA en Colombia (Resolución 2254 de 2017), con los colores del geoportal del SIATA. Es la
// definición del indicador, no una lectura de la app: el ICA se publica ya clasificado en estas categorías.
export const ESCALA_ICA = [
  [0, 50, 'Buena', '#91D23E'],
  [51, 100, 'Aceptable', '#FCE65E'],
  [101, 150, 'Dañina a la salud de grupos sensibles', '#F5A03C'],
  [151, 200, 'Dañina a la salud', '#E8544B'],
  [201, 300, 'Muy dañina a la salud', '#9A6FB0'],
  [301, Infinity, 'Peligrosa', '#8B5A3C']
];

export function categoriaIca(ica) {
  const tramo = ESCALA_ICA.find(([min, max]) => ica >= min && ica <= max);
  return tramo ? { nombre: tramo[2], color: tramo[3] } : null;
}
