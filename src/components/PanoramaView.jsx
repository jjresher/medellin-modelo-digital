'use client';

import { useMemo, useRef, useState } from 'react';
import { PRIORIDADES, clasificar, conclusion, construirDiagnostico, frenteAMediana, mediana, proporciones, sensibilidad } from '../lib/diagnostico';
import { cifrasAncla, useJsonEstatico } from '../lib/lago';
import { CAPAS_LUGARES, buscarLugares, indiceDeLugares, limites } from '../lib/lugares';
import { puestos } from '../lib/atlas';
import BarChart from './charts/BarChart';
import { accent, textMuted } from './charts/tokens';
import MetricCard from './MetricCard';
import MapaTerritorios from './territorios/MapaTerritorios';
import { Procedencia, formatoIndicador, unidadCorta } from './territorios/PanelTerritorios';

// Panorama: la portada. Arriba, el diagnóstico de las 16 comunas y 5 corregimientos (src/lib/diagnostico.js); abajo, las
// cifras ancla que declara cada tema del lago. Nada se escribe a mano: si falta el tema `lentes`, el diagnóstico no se
// muestra y las cifras siguen.

const COLOR_A = accent.orange;
const COLOR_B = textMuted;
const decimal = (valor, decimales = 1) =>
  Number(valor).toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
const conUnidad = (valor, ind) => `${formatoIndicador(valor, ind)} ${unidadCorta(ind)}`.trim();
const porcentaje = (p) => `${Math.round(p * 100)} %`;

// Cámara del gemelo encuadrada en un territorio, con la lente "Cruce urbano" (formato de compartir vista: #twin?v=…).
function vistaEnGemelo(geometria) {
  const [[o, s], [e, n]] = limites(geometria);
  const lado = Math.max(e - o, n - s);
  const zoom = Math.min(14.5, Math.max(11.5, Math.log2(360 / lado)));
  return `twin?v=${((o + e) / 2).toFixed(5)},${((s + n) / 2).toFixed(5)},${zoom.toFixed(2)},-18,55&lente=cruce`;
}

function Selector({ rotulo, zonas, valor, onChange }) {
  return (
    <label className="selector-estacion">
      {rotulo}
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        {zonas.map((z) => (
          <option key={z.codigo} value={z.codigo}>
            {z.nombre} ({z.tipo.toLowerCase()})
          </option>
        ))}
      </select>
    </label>
  );
}

// Buscador de lugares: carga los límites y las capas puntuales la primera vez que se usa (al enfocarlo o al escribir).
// Si la carga falla, se reintenta en el siguiente uso.
function BuscadorLugar({ zonas, onElegir }) {
  const [consulta, setConsulta] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [indice, setIndice] = useState({ estado: 'sin cargar', datos: null });
  const nombre = Object.fromEntries(zonas.map((z) => [z.codigo, z.nombre]));

  const cargar = async () => {
    if (indice.estado === 'cargando' || indice.estado === 'listo') return;
    setIndice({ estado: 'cargando', datos: null });
    try {
      const leer = (ruta) => fetch(ruta).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
      // Una capa que falte no impide buscar en las demás.
      const [comunas, barrios, veredas, ...capas] = await Promise.all([
        leer('/data/geo/comunas.geojson'),
        leer('/data/geo/barrios.geojson'),
        leer('/data/geo/veredas.geojson'),
        ...CAPAS_LUGARES.map(([archivo]) => leer(`/data/geo/capas/${archivo}.geojson`).catch(() => null))
      ]);
      setIndice({
        estado: 'listo',
        datos: indiceDeLugares({ comunas, barrios, veredas, capas: CAPAS_LUGARES.map(([archivo], i) => [archivo, capas[i]]) })
      });
    } catch {
      setIndice({ estado: 'error', datos: null });
    }
  };

  const resultados = useMemo(() => buscarLugares(indice.datos, consulta), [indice.datos, consulta]);
  const elegir = (lugar) => {
    setConsulta(lugar.nombre);
    setAbierto(false);
    onElegir(lugar);
  };
  const teclas = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAbierto(true);
      if (resultados.length) setActivo((i) => (i + (e.key === 'ArrowDown' ? 1 : resultados.length - 1)) % resultados.length);
    } else if (e.key === 'Enter' && resultados.length) {
      e.preventDefault();
      elegir(resultados[Math.min(activo, resultados.length - 1)]);
    } else if (e.key === 'Escape') setAbierto(false);
  };
  const mostrar = abierto && consulta.trim().length >= 2;

  return (
    <div className="buscador-lugar">
      <label className="selector-estacion" htmlFor="buscar-lugar">
        O busca un lugar
      </label>
      <input
        id="buscar-lugar"
        type="search"
        autoComplete="off"
        placeholder="Barrio, estación, parque…"
        value={consulta}
        role="combobox"
        aria-expanded={mostrar && resultados.length > 0}
        aria-controls="buscar-lugar-lista"
        aria-autocomplete="list"
        aria-activedescendant={mostrar && resultados.length ? `lugar-${Math.min(activo, resultados.length - 1)}` : undefined}
        onFocus={() => {
          cargar();
          setAbierto(true);
        }}
        onChange={(e) => {
          cargar();
          setConsulta(e.target.value);
          setActivo(0);
          setAbierto(true);
        }}
        onKeyDown={teclas}
        onBlur={() => setAbierto(false)}
      />
      {mostrar && (
        <div className="buscador-resultados">
          {(indice.estado === 'cargando' || indice.estado === 'sin cargar') && <p>Cargando lugares…</p>}
          {indice.estado === 'error' && <p>No se pudieron cargar los lugares.</p>}
          {indice.estado === 'listo' && !resultados.length && (
            <p>Sin resultados en los {zonas.length} territorios. Prueba con un barrio, una estación o un parque.</p>
          )}
          {resultados.length > 0 && (
            <ul id="buscar-lugar-lista" role="listbox" aria-label="Lugares">
              {resultados.map((l, i) => (
                <li
                  key={`${l.clave}|${l.tipo}|${l.codigo}`}
                  id={`lugar-${i}`}
                  role="option"
                  aria-selected={i === activo}
                  className={i === activo ? 'activo' : ''}
                  // mousedown y no click: el clic llega después del blur del campo, que ya cerró la lista.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(l);
                  }}
                  onMouseEnter={() => setActivo(i)}
                >
                  <span>{l.nombre}</span>
                  <small>
                    {l.tipo}
                    {l.tipo !== 'Comuna' && l.tipo !== 'Corregimiento' && ` · ${nombre[l.codigo]}`}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Tarjeta de una dimensión del índice o del contexto: su índice (si entra al índice) y cada indicador de origen con su
// valor, su distancia a la mediana de los territorios y su puesto.
function Evidencia({ titulo, etiqueta, indice, indicadores, codigo, fuentes, onSource }) {
  return (
    <div className="chart-card evidencia">
      <header>
        <h3>{titulo}</h3>
        <span>{etiqueta}</span>
      </header>
      {indice && (
        <p className="evidencia-indice">
          <strong>{indice.valor == null ? '—' : decimal(indice.valor)}</strong>
          <span>índice de 0 a 100{indice.puesto != null && ` · puesto ${indice.puesto} de ${indice.de}`}</span>
        </p>
      )}
      {indicadores.map((i) => {
        const valor = i.valores[codigo];
        const med = mediana(Object.values(i.valores));
        const { de, puesto } = puestos(i.valores);
        return (
          <div key={i.id} className="evidencia-indicador">
            <span>
              {i.ind.etiqueta}
              {i.anio && ` · ${i.anio}`}
            </span>
            <b>{valor == null ? 'sin dato' : conUnidad(valor, i.ind)}</b>
            <small>
              {valor == null
                ? i.sinDato
                : `${frenteAMediana(valor, med)}${med != null && valor !== med ? ` (${conUnidad(med, i.ind)})` : ''} · puesto ${puesto[codigo]} de ${de}`}
            </small>
            <Procedencia indicador={i.ind} fuentes={fuentes} onSource={onSource} />
          </div>
        );
      })}
    </div>
  );
}

function Diagnostico({ diagnostico, lago, onSource, onTwin, onCifras }) {
  const { zonas, dimensiones, contexto } = diagnostico;
  const fuentes = lago.catalogo?.datasets ?? [];
  const comunas = useJsonEstatico('/data/geo/comunas.geojson');
  // Par inicial: los dos primeros territorios por código, sin elegir uno "interesante".
  const [codigoA, setCodigoA] = useState(zonas[0].codigo);
  const [codigoB, setCodigoB] = useState(zonas[1]?.codigo ?? zonas[0].codigo);
  const [prioridadId, setPrioridadId] = useState(PRIORIDADES[0].id);
  const [lugar, setLugar] = useState(null);
  const [copia, setCopia] = useState('');
  const prioridad = PRIORIDADES.find((p) => p.id === prioridadId);
  const pesos = proporciones(prioridad, dimensiones);

  // Memorizado por id: el mapa vuelve a pintarse solo cuando cambian los valores.
  const { indice, puesto, de } = useMemo(
    () =>
      clasificar(
        zonas,
        PRIORIDADES.find((p) => p.id === prioridadId),
        dimensiones
      ),
    [zonas, prioridadId, dimensiones]
  );
  const zonaA = zonas.find((z) => z.codigo === codigoA);
  const zonaB = zonas.find((z) => z.codigo === codigoB);
  const lectura = conclusion(diagnostico, codigoA, prioridad);
  const sensA = sensibilidad(zonas, codigoA, dimensiones);
  const sensB = sensibilidad(zonas, codigoB, dimensiones);
  const ranking = zonas
    .filter((z) => indice[z.codigo] != null)
    .map((z) => ({
      id: z.codigo,
      label: z.nombre,
      value: Math.round(indice[z.codigo] * 10) / 10,
      rank: puesto[z.codigo],
      note: `${z.tipo} · ${dimensiones.map((d) => `${d.corto} ${z.indices[d.id] == null ? '—' : decimal(z.indices[d.id])}`).join(' · ')}`
    }))
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, 'es'));
  const valoresMapa = useMemo(
    () => Object.fromEntries(Object.entries(indice).map(([c, v]) => [c, v == null ? null : Math.round(v * 10) / 10])),
    [indice]
  );
  const geometriaA = comunas.datos?.features.find((f) => f.properties.CODIGO === codigoA)?.geometry;
  const diferencia =
    indice[codigoA] != null && indice[codigoB] != null ? Math.round(indice[codigoA] * 10) / 10 - Math.round(indice[codigoB] * 10) / 10 : null;

  const elegirA = (codigo) => {
    // Una zona no se compara consigo misma: si se elige la que estaba en "Comparar con", se intercambian.
    if (codigo === codigoB) setCodigoB(codigoA);
    setCodigoA(codigo);
    if (lugar && lugar.codigo !== codigo) setLugar(null);
  };
  const intercambiar = () => {
    setCodigoA(codigoB);
    setCodigoB(codigoA);
    setLugar(null);
  };
  const elegirB = (codigo) => (codigo === codigoA ? intercambiar() : setCodigoB(codigo));
  const elegirLugar = (l) => {
    elegirA(l.codigo);
    setLugar(l);
  };
  const irAlGemelo = () => {
    if (!geometriaA) return onTwin();
    window.location.hash = vistaEnGemelo(geometriaA);
    window.scrollTo({ top: 0 });
  };
  const copiar = async () => {
    const texto = `${lectura.frases.join(' ')} Diagnóstico derivado de los índices de las lentes del gemelo (lago ${lago.temas.lentes.probado}); fuentes y método en el Modelo Digital de Medellín.`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopia('Diagnóstico copiado');
    } catch {
      setCopia('No se pudo copiar');
    }
  };

  const filasComparacion = [
    { id: 'combinado', nombre: `Combinado · ${prioridad.nombre}`, a: indice[codigoA], b: indice[codigoB] },
    ...dimensiones.map((d) => ({ id: d.id, nombre: d.nombre, a: zonaA.indices[d.id], b: zonaB.indices[d.id] }))
  ];
  const origen = [
    ...dimensiones.map((d) => ({ grupo: d.nombre, indicadores: d.indicadores })),
    ...contexto.map((c) => ({ grupo: `${c.nombre} (fuera del índice)`, indicadores: c.indicadores }))
  ];
  const lentes = lago.temas.lentes;
  // Pesos de una prioridad que no es Equilibrio: el de la dimensión elegida y el de cada una de las otras.
  const pesosPrioridad = Object.values(
    proporciones(
      PRIORIDADES.find((p) => p.id !== 'equilibrio'),
      dimensiones
    )
  );

  return (
    <section className="sec-block diagnostico">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            DIAGNÓSTICO TERRITORIAL · {zonas.filter((z) => z.tipo === 'Comuna').length} COMUNAS Y{' '}
            {zonas.filter((z) => z.tipo === 'Corregimiento').length} CORREGIMIENTOS
          </p>
          <h2>¿Qué ocurre en esta parte de Medellín?</h2>
        </div>
        <span className="estado derivado">derivado</span>
      </div>
      <p className="sec-note">
        Compara la infraestructura eléctrica, la densificación y la presión vial de cada territorio, y agrega como contexto su riesgo y sus
        condiciones de vida. Cambia la prioridad y mira si el puesto se sostiene. Todo es posición relativa entre los {zonas.length} territorios:
        ordena, no califica.
      </p>

      <div className="diagnostico-controles">
        <Selector rotulo="Zona principal" zonas={zonas} valor={codigoA} onChange={elegirA} />
        <button className="diagnostico-intercambiar" onClick={intercambiar} aria-label="Intercambiar las dos zonas" title="Intercambiar">
          ⇄
        </button>
        <Selector rotulo="Comparar con" zonas={zonas} valor={codigoB} onChange={elegirB} />
        <BuscadorLugar zonas={zonas} onElegir={elegirLugar} />
      </div>
      {lugar && (
        <p className="diagnostico-lugar">
          <b>{lugar.nombre}</b> <span>{lugar.tipo.toUpperCase()}</span>
          {lugar.tipo !== 'Comuna' &&
            lugar.tipo !== 'Corregimiento' &&
            ` · en ${zonaA.tipo === 'Comuna' ? 'la comuna' : 'el corregimiento'} ${zonaA.nombre}`}
          <button onClick={() => setLugar(null)}>Quitar del mapa ×</button>
        </p>
      )}
      <div className="diagnostico-prioridad">
        <span className="selector-estacion">Prioridad</span>
        <div className="chips" role="group" aria-label="Prioridad del índice">
          {PRIORIDADES.map((p) => (
            <button key={p.id} className={p.id === prioridadId ? 'on' : ''} aria-pressed={p.id === prioridadId} onClick={() => setPrioridadId(p.id)}>
              {p.nombre}
            </button>
          ))}
        </div>
        <span className="diagnostico-pesos">{dimensiones.map((d) => `${d.nombre} ${porcentaje(pesos[d.id])}`).join(' · ')}</span>
        <button className="link-fuente" onClick={onCifras}>
          Ver cifras generales de Medellín ↓
        </button>
      </div>

      <div className="diagnostico-resumen">
        <div className="chart-card diagnostico-lectura">
          <p className="eyebrow">
            LECTURA · {zonaA.nombre.toUpperCase()} · {zonaA.tipo.toUpperCase()}
          </p>
          <div className="diagnostico-cifra">
            <strong>
              {lectura.indice == null ? '—' : decimal(lectura.indice)}
              <small> /100</small>
            </strong>
            <span>índice combinado · prioridad {prioridad.nombre}</span>
          </div>
          <p>{lectura.frases.slice(0, -1).join(' ')}</p>
          {lectura.frases.length > 1 && <p className="diagnostico-fuera">{lectura.frases.at(-1)}</p>}
        </div>
        <div className="chart-card diagnostico-puesto">
          <p className="eyebrow">POSICIÓN RELATIVA</p>
          <div className="diagnostico-cifra">
            <strong>
              {lectura.puesto == null ? '—' : `#${lectura.puesto}`}
              <small> de {de}</small>
            </strong>
            {diferencia != null && (
              <span>
                {diferencia === 0
                  ? `mismo índice que ${zonaB.nombre}`
                  : `${decimal(Math.abs(diferencia))} puntos ${diferencia > 0 ? 'sobre' : 'bajo'} ${zonaB.nombre} (#${puesto[codigoB]})`}
              </span>
            )}
          </div>
          <div className="diagnostico-acciones">
            <button className="primary-action" onClick={irAlGemelo}>
              Ver {zonaA.nombre} en el gemelo 3D <span>→</span>
            </button>
            <button className="link-fuente" onClick={copiar}>
              {copia || 'Copiar diagnóstico'}
            </button>
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Índice combinado por territorio · prioridad {prioridad.nombre}</h3>
          <MapaTerritorios
            valores={valoresMapa}
            etiqueta="Índice combinado (0–100)"
            rotulo="Índice combinado"
            formatValue={(v) => decimal(v)}
            color={COLOR_A}
            seleccionado={codigoA}
            onSelect={elegirA}
            lugar={lugar}
            height={440}
          />
          <p className="chart-fuente">Toca un territorio para elegirlo. El borde amarillo marca la zona principal.</p>
        </div>
        <div className="chart-card">
          <h3>Puesto de los {ranking.length} territorios</h3>
          <BarChart
            data={ranking}
            color={COLOR_A}
            formatValue={(v) => decimal(v)}
            ariaLabel={`Índice combinado por territorio con la prioridad ${prioridad.nombre}`}
            selected={codigoA}
            onSelect={(d) => elegirA(d.id)}
          />
        </div>
      </div>

      <div className="diagnostico-evidencias">
        {dimensiones.map((d) => (
          <Evidencia
            key={d.id}
            titulo={d.nombre}
            etiqueta={`${porcentaje(pesos[d.id])} del índice`}
            indice={{ valor: zonaA.indices[d.id], ...rankingDimension(zonas, d.id, codigoA) }}
            indicadores={d.indicadores.map((i) => ({
              ...i,
              sinDato: `sin dato: el índice de ${d.corto} usa ${d.indicadores.length > 2 ? 'los demás indicadores' : 'el otro indicador'}`
            }))}
            codigo={codigoA}
            fuentes={fuentes}
            onSource={onSource}
          />
        ))}
        {contexto.map((c) => (
          <Evidencia
            key={c.id}
            titulo={c.nombre}
            etiqueta="fuera del índice"
            indicadores={c.indicadores.map((i) => ({ ...i, sinDato: 'sin dato' }))}
            codigo={codigoA}
            fuentes={fuentes}
            onSource={onSource}
          />
        ))}
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>
            {zonaA.nombre} frente a {zonaB.nombre}
          </h3>
          <div className="chart-legend">
            <span>
              <i style={{ background: COLOR_A }} />
              {zonaA.nombre}
            </span>
            <span>
              <i style={{ background: COLOR_B }} />
              {zonaB.nombre}
            </span>
          </div>
          <div className="comparacion-barras">
            {filasComparacion.map((f) => (
              <div key={f.id} className={f.id === 'combinado' ? 'combinado' : ''}>
                <span>{f.nombre}</span>
                {[
                  [f.a, COLOR_A, zonaA.nombre],
                  [f.b, COLOR_B, zonaB.nombre]
                ].map(([v, color, nombre]) => (
                  <p key={nombre} title={`${nombre}: ${v == null ? 'sin dato' : decimal(v)}`}>
                    <i>
                      <i style={{ width: `${v ?? 0}%`, background: color }} />
                    </i>
                    <b>{v == null ? '—' : decimal(v)}</b>
                  </p>
                ))}
              </div>
            ))}
          </div>
          <p className="chart-fuente">Índices de 0 a 100: 0 es el valor mínimo entre los {zonas.length} territorios y 100, el máximo.</p>
        </div>
        <div className="chart-card">
          <h3>¿Cambia el puesto con la prioridad?</h3>
          <table className="chart-table sensibilidad-tabla">
            <thead>
              <tr>
                <th>Prioridad</th>
                <th>Pesos (%)</th>
                <th>{zonaA.nombre}</th>
                <th>{zonaB.nombre}</th>
              </tr>
            </thead>
            <tbody>
              {sensA.filas.map((f, i) => {
                const p = proporciones(f.prioridad, dimensiones);
                const b = sensB.filas[i];
                return (
                  <tr key={f.prioridad.id} className={f.prioridad.id === prioridadId ? 'activo' : ''}>
                    <td>
                      <button onClick={() => setPrioridadId(f.prioridad.id)}>{f.prioridad.nombre}</button>
                    </td>
                    <td>{dimensiones.map((d) => Math.round(p[d.id] * 100)).join(' / ')}</td>
                    <td>
                      #{f.puesto} <small>{decimal(f.indice)}</small>
                    </td>
                    <td>
                      #{b.puesto} <small>{decimal(b.indice)}</small>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="chart-fuente">
            Pesos en el orden {dimensiones.map((d) => d.corto).join(', ')}. {zonaA.nombre}:{' '}
            {sensA.min === sensA.max ? `puesto ${sensA.min} con todas` : `del puesto ${sensA.min} al ${sensA.max}`}. {zonaB.nombre}:{' '}
            {sensB.min === sensB.max ? `puesto ${sensB.min} con todas` : `del puesto ${sensB.min} al ${sensB.max}`}.
          </p>
        </div>
      </div>

      <div className="chart-card origen-card">
        <h3>Indicadores de origen</h3>
        <div className="tabla-scroll">
          <table className="chart-table origen-tabla">
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Vigencia</th>
                <th>{zonaA.nombre}</th>
                <th>{zonaB.nombre}</th>
                <th>Mediana de los {zonas.length}</th>
              </tr>
            </thead>
            {origen.map((g) => (
              <tbody key={g.grupo}>
                <tr className="origen-grupo">
                  <td colSpan={5}>{g.grupo}</td>
                </tr>
                {g.indicadores.map((i) => {
                  const med = mediana(Object.values(i.valores));
                  return (
                    <tr key={i.id}>
                      <td>
                        {i.ind.etiqueta} <span className={`estado ${i.ind.estado}`}>{i.ind.estado}</span>
                        <small>{i.ind.unidad}</small>
                      </td>
                      <td>{i.ind.vigencia}</td>
                      <td>{i.valores[codigoA] == null ? 'sin dato' : formatoIndicador(i.valores[codigoA], i.ind)}</td>
                      <td>{i.valores[codigoB] == null ? 'sin dato' : formatoIndicador(i.valores[codigoB], i.ind)}</td>
                      <td>{med == null ? '—' : formatoIndicador(med, i.ind)}</td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      </div>

      <div className="diagnostico-metodo">
        <b>Cómo se calcula</b>
        <p>
          Cada indicador se escala de 0 (valor mínimo entre los {zonas.length} territorios) a 100 (máximo), y el índice de una dimensión es el
          promedio de sus indicadores:{' '}
          {dimensiones.map((d) => `${d.corto}, ${d.indicadores.map((i) => i.ind.etiqueta.toLowerCase()).join(' y ')}`).join('; ')}. Son los índices de
          las lentes del gemelo. El índice combinado los promedia con los pesos de la prioridad: la elegida pesa{' '}
          {porcentaje(Math.max(...pesosPrioridad))} y las otras, {porcentaje(Math.min(...pesosPrioridad))} cada una; con Equilibrio pesan lo mismo y
          el resultado es el de la lente «Cruce urbano». Los pesos son una decisión de lectura, no un dato.
        </p>
        <p>
          El riesgo y las condiciones de vida acompañan la lectura, pero no entran al índice: sumarlos obligaría a decidir si un valor mayor suma o
          resta. El puesto ordena de mayor a menor valor. El índice no mide demanda eléctrica, tráfico en vivo, déficit ni capacidad disponible, y una
          posición no explica sus causas. Las vigencias difieren entre indicadores (ver la tabla de origen).
        </p>
        <p className="procedencia">
          <span>Lago: lentes, {lentes.probado}</span>
          {lentes.fuentes.map((f) => (
            <button key={f.id} onClick={() => onSource(f.id)}>
              {f.nombre.split(' (')[0]} ↗
            </button>
          ))}
        </p>
      </div>
    </section>
  );
}

// Índice de una dimensión y su puesto entre los territorios.
function rankingDimension(zonas, dimension, codigo) {
  const { de, puesto } = puestos(Object.fromEntries(zonas.map((z) => [z.codigo, z.indices[dimension]])));
  return { de, puesto: puesto[codigo] ?? null };
}

export default function PanoramaView({ lago, onSource, onTwin }) {
  const cifrasRef = useRef(null);
  const diagnostico = useMemo(() => (lago.estado === 'listo' ? construirDiagnostico(lago.temas) : null), [lago.estado, lago.temas]);
  const cifras = lago.estado === 'listo' ? cifrasAncla(lago) : [];
  const tituloTema = Object.fromEntries((lago.indice?.temas ?? []).map((t) => [t.tema, t.titulo]));
  const anios = cifras
    .map((cifra) => cifra.vigencia.match(/\d{4}/)?.[0])
    .filter(Boolean)
    .sort();
  const temas = new Set(cifras.map((c) => c.tema)).size;

  return (
    <section className="view panorama-view">
      <div className="hero">
        <div>
          <p className="eyebrow">MODELO DIGITAL · MEDELLÍN</p>
          <h1>
            La ciudad,
            <br />
            <em>en perspectiva.</em>
          </h1>
          <p>
            Indicadores urbanos verificables y una lectura espacial de Medellín: elige una comuna o un corregimiento, compáralo con otro y mira de
            dónde sale cada cifra.
          </p>
        </div>
        <button className="primary-action" onClick={onTwin}>
          Explorar gemelo 3D <span>→</span>
        </button>
      </div>
      {lago.estado === 'cargando' && <p className="lake-message panorama-mensaje">Cargando el lago de datos…</p>}
      {lago.estado === 'error' && (
        <p className="lake-message panorama-mensaje">No se pudo leer el lago de datos ({lago.error}). Genera el lago con la ingesta (ver README).</p>
      )}
      {diagnostico && (
        <Diagnostico
          diagnostico={diagnostico}
          lago={lago}
          onSource={onSource}
          onTwin={onTwin}
          onCifras={() => cifrasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      )}
      {cifras.length > 0 && (
        <section className="sec-block" ref={cifrasRef} id="cifras-generales">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                CORTE VERIFICABLE · {cifras.length} CIFRAS DE {temas} TEMAS
              </p>
              <h2>Medellín en cifras</h2>
            </div>
            {anios.length > 0 && <span>{anios[0] === anios.at(-1) ? anios[0] : `${anios[0]}—${anios.at(-1)}`}</span>}
          </div>
          <div className="metrics-grid">
            {cifras.map((cifra) => (
              <MetricCard key={`${cifra.tema}-${cifra.clave}`} cifra={cifra} seccion={tituloTema[cifra.tema]} onSource={onSource} />
            ))}
          </div>
          <section className="method-note">
            <span>01</span>
            <div>
              <b>Lectura responsable</b>
              <p>
                Cada cifra conserva su vigencia real y su estado: <span className="estado observado">observado</span> es un dato abierto descargado;{' '}
                <span className="estado derivado">derivado</span> se calcula a partir de otros datos. Las cifras de series distintas no deben
                interpretarse como una misma actualización temporal.
              </p>
            </div>
          </section>
        </section>
      )}
    </section>
  );
}
