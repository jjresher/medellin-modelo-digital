'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buscarGeneral, indiceGeneral } from '../../lib/buscador';
import { formatoUnidad, formatoValor } from '../../lib/lago';
import { buscarLugares, cargarLugares } from '../../lib/lugares';

// Buscador general (⌘K / Ctrl+K, issue #16): secciones, cifras del lago y lugares del mapa en un solo cuadro. Se monta al
// abrirse y se desmonta al cerrarse, así cada búsqueda empieza vacía. Los lugares (1,9 MB) se descargan la primera vez
// que se abre, igual que en el buscador del Panorama, y quedan para los dos.
export default function Buscador({ lago, onCerrar, onElegir }) {
  const dialogo = useRef(null);
  const [consulta, setConsulta] = useState('');
  const [activo, setActivo] = useState(0);
  const [lugares, setLugares] = useState({ estado: 'cargando', datos: null });

  useEffect(() => {
    const d = dialogo.current;
    if (!d.open) d.showModal();
    let vivo = true;
    cargarLugares()
      .then((datos) => vivo && setLugares({ estado: 'listo', datos }))
      .catch(() => vivo && setLugares({ estado: 'error', datos: null }));
    return () => {
      vivo = false;
    };
  }, []);

  const indice = useMemo(() => indiceGeneral(lago), [lago]);
  const { secciones, cifras } = useMemo(() => buscarGeneral(indice, consulta), [indice, consulta]);
  const encontrados = useMemo(() => buscarLugares(lugares.datos, consulta, 6), [lugares.datos, consulta]);
  const territorio = useMemo(() => Object.fromEntries((lugares.datos?.territorios ?? []).map((t) => [t.codigo, t.nombre])), [lugares.datos]);
  const grupos = [
    ['Secciones', secciones.map((s) => ({ ...s, llave: `s-${s.id}` }))],
    ['Cifras', cifras.map((c) => ({ ...c, llave: `c-${c.tema}-${c.clave}` }))],
    ['Lugares del mapa', encontrados.map((l) => ({ ...l, tipoLugar: l.tipo, tipo: 'lugar', llave: `l-${l.clave}-${l.tipo}-${l.codigo}` }))]
  ].filter(([, items]) => items.length);
  const opciones = grupos.flatMap(([, items]) => items);
  const actual = Math.min(activo, opciones.length - 1);
  const q = consulta.trim();

  useEffect(() => {
    document.getElementById(`buscar-op-${actual}`)?.scrollIntoView({ block: 'nearest' });
  }, [actual]);

  const teclas = (e) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && opciones.length) {
      e.preventDefault();
      setActivo((i) => (Math.min(i, opciones.length - 1) + (e.key === 'ArrowDown' ? 1 : opciones.length - 1)) % opciones.length);
    } else if (e.key === 'Enter' && opciones[actual]) {
      e.preventDefault();
      onElegir(opciones[actual]);
    } else if (e.key === 'Escape') {
      // En un campo de búsqueda, la primera Esc solo borraría el texto: aquí cierra el buscador de una vez.
      e.preventDefault();
      dialogo.current.close();
    }
  };

  const nota = !q
    ? 'Escribe para buscar cifras (homicidios, desempleo…) y lugares (barrios, estaciones, parques…).'
    : lugares.estado === 'error'
      ? 'No se pudieron cargar los lugares; se buscan secciones y cifras.'
      : q.length >= 2 && lugares.estado === 'cargando'
        ? 'Cargando lugares…'
        : '';

  let n = -1;
  return (
    <dialog
      ref={dialogo}
      className="buscador-general"
      aria-label="Buscar en el modelo"
      onClose={onCerrar}
      // Un clic en el fondo (fuera del cuadro) cierra.
      onClick={(e) => e.target === dialogo.current && dialogo.current.close()}
    >
      <div className="buscador-caja">
        <div className="buscador-campo">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="Busca una sección, una cifra o un lugar…"
            value={consulta}
            role="combobox"
            aria-label="Buscar secciones, cifras y lugares"
            aria-expanded={opciones.length > 0}
            aria-controls="buscar-lista"
            aria-autocomplete="list"
            aria-activedescendant={opciones.length ? `buscar-op-${actual}` : undefined}
            onChange={(e) => {
              setConsulta(e.target.value);
              setActivo(0);
            }}
            onKeyDown={teclas}
          />
          <kbd>Esc</kbd>
        </div>
        <div id="buscar-lista" className="buscador-lista" role="listbox" aria-label="Resultados">
          {grupos.map(([titulo, items]) => (
            <div key={titulo} role="group" aria-label={titulo}>
              <p className="buscador-grupo" aria-hidden="true">
                {titulo}
              </p>
              {items.map((item) => {
                n += 1;
                const i = n;
                return (
                  <div
                    key={item.llave}
                    id={`buscar-op-${i}`}
                    role="option"
                    aria-selected={i === actual}
                    className={`buscador-op ${i === actual ? 'activo' : ''}`}
                    onClick={() => onElegir(item)}
                    onMouseMove={() => i !== actual && setActivo(i)}
                  >
                    <Opcion item={item} territorio={territorio} />
                  </div>
                );
              })}
            </div>
          ))}
          {q.length >= 2 && !opciones.length && lugares.estado !== 'cargando' && (
            <p className="buscador-vacio">Sin resultados para «{q}». Prueba con un tema (empleo, aire), una cifra o un barrio.</p>
          )}
        </div>
        <p className={`buscador-pie ${nota ? '' : 'sin-nota'}`}>
          {nota}
          <span className="buscador-teclas">
            <kbd>↑</kbd>
            <kbd>↓</kbd> elegir · <kbd>Enter</kbd> abrir
          </span>
        </p>
      </div>
    </dialog>
  );
}

function Opcion({ item, territorio }) {
  if (item.tipo === 'seccion')
    return (
      <>
        <span className="buscador-icono" aria-hidden="true">
          {item.icono}
        </span>
        <span className="buscador-nombre">{item.nombre}</span>
        <small>Sección</small>
      </>
    );
  if (item.tipo === 'cifra') {
    const unidad = formatoUnidad(item);
    return (
      <>
        <span className="buscador-icono" aria-hidden="true">
          #
        </span>
        <span className="buscador-nombre">
          {item.etiqueta}
          <small>
            {item.nombreSeccion} · {item.vigencia} · <span className={`estado ${item.estado}`}>{item.estado}</span>
          </small>
        </span>
        <strong>
          {formatoValor(item)}
          {unidad && <small> {unidad}</small>}
        </strong>
      </>
    );
  }
  const enTerritorio = item.tipoLugar !== 'Comuna' && item.tipoLugar !== 'Corregimiento' ? ` · ${territorio[item.codigo] ?? ''}` : '';
  return (
    <>
      <span className="buscador-icono" aria-hidden="true">
        ⌖
      </span>
      <span className="buscador-nombre">
        {item.nombre}
        <small>
          {item.tipoLugar}
          {enTerritorio}
        </small>
      </span>
      <small>Gemelo 3D</small>
    </>
  );
}
