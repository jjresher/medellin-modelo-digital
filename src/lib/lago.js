'use client';

import { useEffect, useState } from 'react';

// El lago lo generan los scripts de ingesta/ en public/data/lago. El frontend nunca escribe cifras a mano:
// si un tema o una cifra no está en el lago, simplemente no se muestra.
const BASE = '/data/lago';

async function leer(archivo) {
  const respuesta = await fetch(`${BASE}/${archivo}`, { cache: 'no-store' });
  if (!respuesta.ok) throw new Error(`${archivo}: ${respuesta.status}`);
  return respuesta.json();
}

export function useLago() {
  const [lago, setLago] = useState({ estado: 'cargando', temas: {}, orden: [], catalogo: null, indice: null });

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const indice = await leer('indice.json');
        const [catalogo, ...temas] = await Promise.allSettled([
          leer('catalogo.json'),
          ...indice.temas.map(({ tema }) => leer(`${tema}.json`))
        ]);
        if (!activo) return;
        const cargados = Object.fromEntries(temas.filter((t) => t.status === 'fulfilled').map((t) => [t.value.tema, t.value]));
        setLago({
          estado: 'listo',
          temas: cargados,
          orden: indice.temas.map(({ tema }) => tema).filter((tema) => cargados[tema]),
          catalogo: catalogo.status === 'fulfilled' ? catalogo.value : null,
          indice
        });
      } catch (error) {
        if (activo) setLago((actual) => ({ ...actual, estado: 'error', error: error.message }));
      }
    })();
    return () => { activo = false; };
  }, []);

  return lago;
}

// Cifras que cada tema declara en `ancla`, en el orden del índice, para el Panorama.
export function cifrasAncla(lago) {
  return lago.orden.flatMap((tema) => {
    const datos = lago.temas[tema];
    return datos.ancla.map((clave) => ({ ...datos.cifras[clave], clave, tema }));
  });
}

const numero = (valor, decimales = 0) => valor.toLocaleString('es-CO', {
  minimumFractionDigits: decimales,
  maximumFractionDigits: decimales
});

export function formatoValor(cifra) {
  const { valor, unidad, decimales } = cifra;
  if (typeof valor !== 'number') return String(valor);
  if (unidad === '%') return `${numero(valor, decimales ?? 1)} %`;
  if (Math.abs(valor) >= 1e6) return `${numero(valor / 1e6, 2)} M`;
  return numero(valor, decimales ?? 0);
}

// La unidad se muestra aparte del valor, salvo el porcentaje, que ya va pegado a la cifra.
export function formatoUnidad(cifra) {
  return cifra.unidad === '%' ? '' : cifra.unidad;
}
