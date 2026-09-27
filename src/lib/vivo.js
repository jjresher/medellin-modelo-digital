'use client';

import { useCallback, useEffect, useState } from 'react';

// Lecturas en vivo a través del proxy /api/ambiente (ver src/app/api/ambiente). A diferencia del lago, que se
// genera con la ingesta, estos datos cambian cada pocos minutos: cada lectura viene con la hora en que se tomó
// (`leido`) y con `obsoleto` en true cuando el SIATA no respondió y se está viendo la última copia guardada.
const BASE = '/api/ambiente';
const REFRESCO_MS = 10 * 60 * 1000; // la misma ventana de caché del proxy

export function useVivo(recurso) {
  const [lectura, setLectura] = useState({ estado: 'cargando' });
  const [ciclo, setCiclo] = useState(0);
  const recargar = useCallback(() => setCiclo((n) => n + 1), []);

  useEffect(() => {
    if (!recurso) {
      setLectura({ estado: 'vacio' });
      return undefined;
    }
    let activo = true;
    setLectura((previo) => (previo.recurso === recurso ? { ...previo, refrescando: true } : { estado: 'cargando', recurso }));
    fetch(`${BASE}/${recurso}`, { cache: 'no-store' })
      .then(async (respuesta) => {
        const cuerpo = await respuesta.json().catch(() => null);
        if (!respuesta.ok) throw new Error(cuerpo?.error ?? `HTTP ${respuesta.status}`);
        return cuerpo;
      })
      .then((cuerpo) => {
        if (activo) {
          setLectura({ estado: 'listo', recurso, datos: cuerpo.datos, leido: cuerpo.leido,
                       edad: cuerpo.edad_s, obsoleto: cuerpo.obsoleto, aviso: cuerpo.error });
        }
      })
      .catch((error) => { if (activo) setLectura({ estado: 'error', recurso, error: error.message }); });
    return () => { activo = false; };
  }, [recurso, ciclo]);

  useEffect(() => {
    const id = window.setInterval(recargar, REFRESCO_MS);
    return () => window.clearInterval(id);
  }, [recargar]);

  return { ...lectura, recargar };
}

export const rasgos = (lectura) => (lectura.datos?.features ?? []).map((f) => ({ ...f.properties, geometry: f.geometry }));

export const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '');
export const numero = (valor, decimales = 0) => (valor == null || Number.isNaN(Number(valor)) ? '—'
  : Number(valor).toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }));

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
