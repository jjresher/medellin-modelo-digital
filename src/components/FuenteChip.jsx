'use client';

import { useFuente } from '../lib/catalogo';
import Estado from './Estado';

/**
 * La procedencia de una gráfica en una línea: el código de la fuente (F021), el periodo que cubre el dato, el estado, la fecha
 * en que se probó la fuente y su licencia. Todo sale del catálogo del lago; el código es un botón que abre la fila de esa
 * fuente en «Fuentes y método». `item` es la cifra, serie o indicador del lago (trae `fuente`, `estado`, `proxy`).
 * `vigencia` reemplaza la del item cuando la gráfica muestra un solo año de varios.
 */
export default function FuenteChip({ item, vigencia, onSource }) {
  const fuente = useFuente(item.fuente);
  return (
    <p className="procedencia chip-fuente">
      <button className="codigo-fuente" onClick={() => onSource(item.fuente)} title={fuente?.nombre}>
        {fuente?.codigo ?? item.fuente}
      </button>
      <span>Periodo: {vigencia ?? item.vigencia}</span>
      <Estado item={item} />
      {fuente?.probado && <span>probada {fuente.probado}</span>}
      {fuente?.licencia && <span className="chip-licencia">Licencia: {fuente.licencia}</span>}
    </p>
  );
}
