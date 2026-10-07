'use client';

import { useEffect, useState } from 'react';

// true cuando el elemento está a menos de `margen` de verse, y desde entonces para siempre. Los mapas de las secciones lo
// usan para crearse recién al acercarse: en el celular casi todos quedan más abajo, y crear su WebGL, su estilo y sus
// teselas al abrir la sección ocupaba el hilo principal mientras la página cargaba (issue #16).
export function useCerca(ref, margen = '300px') {
  const [cerca, setCerca] = useState(false);
  useEffect(() => {
    const observador = new IntersectionObserver(([entrada]) => entrada.isIntersecting && setCerca(true), { rootMargin: `${margen} 0px` });
    observador.observe(ref.current);
    return () => observador.disconnect();
  }, [ref, margen]);
  return cerca;
}
