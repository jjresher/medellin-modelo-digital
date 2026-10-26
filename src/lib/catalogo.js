'use client';

import { createContext, useContext } from 'react';

// El catálogo del lago (catalogo.json), por id de fuente. Lo provee la página y lo leen las tarjetas y las gráficas para
// mostrar, a un clic de cada cifra, el código de su fuente (F001, F002…), su vigencia y la fecha en que se probó.
export const CatalogoContext = createContext({});

/** {id: dataset} a partir del catálogo; vacío mientras carga. */
export function porId(catalogo) {
  return Object.fromEntries((catalogo?.datasets ?? []).map((d) => [d.id, d]));
}

/** La ficha de una fuente en el catálogo, o undefined si aún no cargó o el id no existe. */
export function useFuente(id) {
  return useContext(CatalogoContext)[id];
}
