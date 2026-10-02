'use client';

import { useMemo, useRef, useState } from 'react';
import { GRUPOS, construirAtlas } from '../lib/atlas';
import {
  MINIMO_TERRITORIOS,
  MOTIVOS,
  clasificar,
  correlacion,
  formatoCoeficiente,
  matrizDeCorrelacion,
  rangoDeAnios,
  rangos
} from '../lib/correlaciones';
import CorrelationMatrix from './charts/CorrelationMatrix';
import ScatterChart from './charts/ScatterChart';
import { accent } from './charts/tokens';
import { Procedencia, formato, formatoIndicador, unidadCorta } from './territorios/PanelTerritorios';

// Correlaciones. No tiene un tema propio en el lago: toma las métricas del nivel comuna del Atlas (src/lib/atlas.js),
// elige cuáles se pueden cruzar (src/lib/correlaciones.js) y calcula en el navegador el coeficiente de Spearman de cada
// par. Solo muestra el coeficiente, con cuántos territorios se calculó y el periodo de cada métrica: no lo califica.

const TITULO_GRUPO = Object.fromEntries(GRUPOS.map((g) => [g.id, g.titulo]));
const conUnidad = (valor, ind) => `${formatoIndicador(valor, ind)} ${unidadCorta(ind)}`.trim();
const lista = (nombres) => (nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : (nombres[0] ?? ''));
// Un rango medio (los empates lo comparten) puede terminar en ,5.
const formatoRango = (v) => formato(v, Number.isInteger(v) ? 0 : 1);
// Las marcas de un eje suelen ser números redondos: van sin los decimales del indicador ("4.000", no "4.000,00").
const formatoEje = (ind) => (v) => (Number.isInteger(v) && Math.abs(v) < 1e6 ? formato(v) : formatoIndicador(v, ind));

function Avisos({ territorios, matriz }) {
  const comunas = territorios.filter((t) => t.tipo === 'Comuna').length;
  const anios = rangoDeAnios(matriz);
  return (
    <div className="avisos-grid" role="note" aria-label="Cómo leer esta sección">
      <div>
        <b>
          <span aria-hidden="true">01</span> Son {territorios.length} territorios
        </b>
        <p>
          Cada coeficiente se calcula con {territorios.length} unidades como máximo ({comunas} comunas y {territorios.length - comunas}{' '}
          corregimientos), y con menos si una métrica no tiene dato en todas. Con tan pocas, un solo territorio puede cambiar el coeficiente. Por eso
          cada par dice su n.
        </p>
      </div>
      <div>
        <b>
          <span aria-hidden="true">02</span> Correlación no implica causalidad
        </b>
        <p>
          El coeficiente dice si dos métricas ordenan los territorios de forma parecida u opuesta. No dice que una cause la otra: puede haber una
          tercera variable detrás de las dos, o ninguna relación. Son cifras por territorio y no describen a sus hogares ni a sus personas.
        </p>
      </div>
      <div>
        <b>
          <span aria-hidden="true">03</span> Las vigencias difieren
        </b>
        <p>
          Cada métrica entra con su último periodo con dato, así que un par puede cruzar años distintos
          {anios && anios[0] !== anios[1] && ` (los de la matriz van de ${anios[0]} a ${anios[1]})`}. Cada par muestra el periodo de sus dos métricas.
        </p>
      </div>
    </div>
  );
}

// Las métricas del Atlas que no están en la matriz, por motivo y por tema.
function Fuera({ fuera, matriz, total }) {
  const corto = Object.fromEntries(matriz.map((m) => [m.id, m.corto]));
  const detalle = (f) => {
    if (f.queda) return `${f.metrica.corto} (queda ${corto[f.queda]})`;
    if (f.repetidos) return `${f.metrica.corto} (${f.repetidos} de ${total} territorios con el mismo valor)`;
    return f.metrica.corto;
  };
  return (
    <details className="fuera-matriz">
      <summary>
        {fuera.length} métricas del Atlas no están en la matriz: cuáles y por qué
        <span aria-hidden="true"> ▾</span>
      </summary>
      {Object.entries(MOTIVOS).map(([motivo, { titulo, texto }]) => {
        const filas = fuera.filter((f) => f.motivo === motivo);
        if (!filas.length) return null;
        const grupos = GRUPOS.map((g) => [g.titulo, filas.filter((f) => f.metrica.grupo === g.id)]).filter(([, fs]) => fs.length);
        return (
          <div key={motivo}>
            <b>
              {titulo} ({filas.length})
            </b>
            <p>{texto}</p>
            <ul>
              {grupos.map(([grupo, fs]) => (
                <li key={grupo}>
                  <span>{grupo}:</span> {fs.map(detalle).join(', ')}.
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </details>
  );
}

function SelectorMetrica({ rotulo, metricas, valor, onChange }) {
  return (
    <label className="selector-estacion">
      {rotulo}
      <select value={valor} onChange={(e) => onChange(e.target.value)}>
        {GRUPOS.filter((g) => metricas.some((m) => m.grupo === g.id)).map((g) => (
          <optgroup key={g.id} label={g.titulo}>
            {metricas
              .filter((m) => m.grupo === g.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.corto} · {m.anio}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function FichaMetrica({ eje, metrica, fuentes, onSource }) {
  const { ind, anio } = metrica;
  return (
    <div className="indicador-cabecera">
      <h3>
        <span className="eje">{eje}</span> {ind.etiqueta} · {anio}
      </h3>
      <Procedencia indicador={ind} fuentes={fuentes} onSource={onSource} />
      {ind.nota && <p className="sec-note">{ind.nota}</p>}
    </div>
  );
}

export default function CorrelacionesView({ lago, onSource }) {
  const atlas = useMemo(() => construirAtlas(lago.temas), [lago.temas]);
  const { territorios } = atlas;
  const { matriz, dispersion, fuera } = useMemo(() => clasificar(atlas.metricas), [atlas.metricas]);
  const codigos = useMemo(() => territorios.map((t) => t.codigo), [territorios]);
  const celdas = useMemo(() => matrizDeCorrelacion(matriz, codigos), [matriz, codigos]);
  // El par elegido: la métrica de la fila va al eje Y y la de la columna, al eje X.
  const [ids, setIds] = useState(null);
  const [codigo, setCodigo] = useState(null);
  const [ejes, setEjes] = useState('valores');
  const seccionPar = useRef(null);

  if (lago.estado === 'cargando') return <div className="view-loading">Cargando las correlaciones…</div>;
  if (matriz.length < 2) {
    return (
      <section className="view">
        <p className="lake-message">No hay métricas por territorio para cruzar. Genera el lago con la ingesta (ver README).</p>
      </section>
    );
  }

  const fuentes = lago.catalogo?.datasets ?? [];
  const metricaY = dispersion.find((m) => m.id === ids?.[0]) ?? matriz[1];
  const metricaX = dispersion.find((m) => m.id === ids?.[1]) ?? matriz[0];
  // Elegir en un eje la métrica que ya está en el otro los intercambia: una métrica no se cruza consigo misma.
  const elegirY = (id) => setIds(id === metricaX.id ? [id, metricaY.id] : [id, metricaX.id]);
  const elegirX = (id) => setIds(id === metricaY.id ? [metricaX.id, id] : [metricaY.id, id]);
  const par = correlacion(metricaX, metricaY, codigos);
  const territorio = territorios.find((t) => t.codigo === codigo) ?? territorios[0];
  const nombre = Object.fromEntries(territorios.map((t) => [t.codigo, t.nombre]));
  const soloDispersion = dispersion.length - matriz.length;
  const sinX = territorios.filter((t) => metricaX.valores[t.codigo] == null).map((t) => t.nombre);
  const sinY = territorios.filter((t) => metricaY.valores[t.codigo] == null).map((t) => t.nombre);

  // En "orden" cada territorio va en su rango (de menor a mayor) entre los que entran al cálculo: es lo que compara Spearman.
  const enOrden = ejes === 'orden';
  const rangoX = rangos(par.usados.map((c) => metricaX.valores[c]));
  const rangoY = rangos(par.usados.map((c) => metricaY.valores[c]));
  const puntos = par.usados.map((c, i) => {
    const t = territorios.find((x) => x.codigo === c);
    return {
      id: c,
      label: t.nombre,
      shape: t.tipo === 'Comuna' ? 'circle' : 'diamond',
      x: enOrden ? rangoX[i] : metricaX.valores[c],
      y: enOrden ? rangoY[i] : metricaY.valores[c],
      lines: [
        [metricaX.corto, conUnidad(metricaX.valores[c], metricaX.ind)],
        [metricaY.corto, conUnidad(metricaY.valores[c], metricaY.ind)]
      ]
    };
  });
  const tipos = [...new Set(territorios.map((t) => t.tipo))];
  const rotuloEje = (m) => (enOrden ? `${m.corto}: orden de menor a mayor, ${m.anio}` : `${m.corto} (${m.ind.unidad}), ${m.anio}`);

  return (
    <section className="view correlaciones-view">
      <div className="view-intro">
        <p className="eyebrow">MEDELLÍN · CORRELACIONES</p>
        <h1>
          Dos métricas, <em>{territorios.length} territorios.</em>
        </h1>
        <p>
          Cómo se ordenan las comunas y los corregimientos en una métrica frente a otra. La matriz cruza de a dos {matriz.length} métricas del Atlas y
          el diagrama de dispersión muestra un par, territorio por territorio. Todo se calcula aquí a partir de las cifras del lago.
        </p>
      </div>
      <Avisos territorios={territorios} matriz={matriz} />

      <section className="sec-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {matriz.length} MÉTRICAS · {formato((matriz.length * (matriz.length - 1)) / 2)} PARES · {territorios.length} TERRITORIOS
            </p>
            <h2>Matriz de correlación</h2>
          </div>
          <span className="estado derivado">derivado</span>
        </div>
        <p className="sec-note">
          Cada celda es el coeficiente de Spearman (ρ) de dos métricas. Compara el orden de los territorios, no sus valores: va de −1 a +1; es +1 si
          las dos los ordenan igual, −1 si los ordenan al revés y 0 si un orden no dice nada del otro. Se usa en vez del de Pearson porque, con{' '}
          {territorios.length} unidades, el valor extremo de un solo territorio cambia el de Pearson y no el de Spearman. Los empates comparten el
          rango medio.
        </p>
        <div className="chart-card matriz-card">
          <CorrelationMatrix
            metricas={matriz}
            celdas={celdas}
            total={territorios.length}
            seleccion={[metricaY.id, metricaX.id]}
            onSelect={(fila, columna) => setIds([fila.id, columna.id])}
            formatValue={formatoCoeficiente}
            tituloGrupo={TITULO_GRUPO}
            accion={
              <button className="link-fuente" onClick={() => seccionPar.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Ver el diagrama del par elegido ↓
              </button>
            }
          />
          <p className="chart-fuente">
            Las columnas llevan el número de su fila. Los espacios separan los temas:{' '}
            {lista(GRUPOS.filter((g) => matriz.some((m) => m.grupo === g.id)).map((g) => g.titulo))}. El color indica el signo y su intensidad, la
            magnitud del coeficiente.
          </p>
        </div>
        <Fuera fuera={fuera} matriz={matriz} total={territorios.length} />
      </section>

      <section className="sec-block" ref={seccionPar}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">PAR ELEGIDO</p>
            <h2>
              {metricaY.corto} × {metricaX.corto}
            </h2>
          </div>
          <span className="estado derivado">derivado</span>
        </div>
        <p className="sec-note">
          Elige dos métricas, o toca una celda de la matriz, y un territorio para resaltarlo.
          {soloDispersion > 0 &&
            ` Aquí se pueden elegir además ${soloDispersion} métricas que quedaron fuera de la matriz solo para que se pueda leer.`}
        </p>
        <div className="par-controles">
          <SelectorMetrica rotulo="Eje Y" metricas={dispersion} valor={metricaY.id} onChange={elegirY} />
          <SelectorMetrica rotulo="Eje X" metricas={dispersion} valor={metricaX.id} onChange={elegirX} />
          <label className="selector-estacion">
            Territorio
            <select value={territorio.codigo} onChange={(e) => setCodigo(e.target.value)}>
              {territorios.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.nombre} ({t.tipo.toLowerCase()})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="par-resumen">
          <div>
            <span>Coeficiente de Spearman</span>
            <strong>ρ = {formatoCoeficiente(par.rho)}</strong>
            <small>
              {par.rho == null
                ? `No se calcula con menos de ${MINIMO_TERRITORIOS} territorios ni cuando una métrica no varía.`
                : 'De −1 a +1. Compara órdenes, no valores.'}
            </small>
          </div>
          <div>
            <span>Territorios en el cálculo</span>
            <strong>
              n = {par.n} <i>de {territorios.length}</i>
            </strong>
            <small>
              {par.sinDato.length
                ? [sinY.length && `Sin dato en ${metricaY.corto}: ${lista(sinY)}.`, sinX.length && `Sin dato en ${metricaX.corto}: ${lista(sinX)}.`]
                    .filter(Boolean)
                    .join(' ')
                : 'Todos tienen dato en las dos métricas.'}
            </small>
          </div>
          <div>
            <span>Periodo de cada métrica</span>
            <strong className="texto">
              {metricaY.anio} · {metricaX.anio}
            </strong>
            <small>
              {metricaY.corto}: {metricaY.anio}. {metricaX.corto}: {metricaX.anio}.
            </small>
          </div>
        </div>
        <div className="par-metricas">
          <FichaMetrica eje="Eje Y" metrica={metricaY} fuentes={fuentes} onSource={onSource} />
          <FichaMetrica eje="Eje X" metrica={metricaX} fuentes={fuentes} onSource={onSource} />
        </div>
        <div className="chart-grid">
          <div className="chart-card">
            <div className="card-controls">
              <h3>
                {metricaY.corto} frente a {metricaX.corto}
              </h3>
              <div className="chips" role="group" aria-label="Qué muestran los ejes">
                <button className={enOrden ? '' : 'on'} onClick={() => setEjes('valores')}>
                  Valores
                </button>
                <button className={enOrden ? 'on' : ''} onClick={() => setEjes('orden')}>
                  Orden
                </button>
              </div>
            </div>
            <ScatterChart
              points={puntos}
              xLabel={rotuloEje(metricaX)}
              yLabel={rotuloEje(metricaY)}
              formatX={enOrden ? formatoRango : formatoEje(metricaX.ind)}
              formatY={enOrden ? formatoRango : formatoEje(metricaY.ind)}
              color={accent.green}
              selected={territorio.codigo}
              onSelect={(p) => setCodigo(p.id)}
              legend={tipos.map((tipo) => ({ shape: tipo === 'Comuna' ? 'circle' : 'diamond', label: tipo }))}
              ariaLabel={`${metricaY.ind.etiqueta} frente a ${metricaX.ind.etiqueta}, un punto por territorio`}
            />
            <p className="chart-fuente">
              {enOrden
                ? 'Cada territorio va en su posición de menor (1) a mayor valor en cada métrica; los empates comparten la posición media. Es lo que compara el coeficiente.'
                : 'Cada punto es un territorio con su valor en las dos métricas. Los ejes empiezan cerca del valor más bajo, no en cero.'}{' '}
              Toca un punto para resaltarlo.
              {!par.usados.includes(territorio.codigo) && ` ${territorio.nombre} no tiene dato en este par y no aparece.`}
            </p>
          </div>
          <div className="chart-card tabla-card">
            <h3>Los {territorios.length} territorios en las dos métricas</h3>
            <table className="chart-table par-tabla">
              <thead>
                <tr>
                  <th>Territorio</th>
                  {[metricaY, metricaX].map((m) => (
                    <th key={m.id}>
                      {m.corto} · {m.anio}
                      <small>{m.ind.unidad}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {territorios.map((t) => {
                  const y = metricaY.valores[t.codigo];
                  const x = metricaX.valores[t.codigo];
                  return (
                    <tr key={t.codigo} className={`${t.codigo === territorio.codigo ? 'activo' : ''} ${x == null || y == null ? 'fuera' : ''}`}>
                      <td>
                        <button onClick={() => setCodigo(t.codigo)} aria-pressed={t.codigo === territorio.codigo}>
                          {t.nombre}
                        </button>
                      </td>
                      <td>{y == null ? 'sin dato' : formatoIndicador(y, metricaY.ind)}</td>
                      <td>{x == null ? 'sin dato' : formatoIndicador(x, metricaX.ind)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {par.sinDato.length > 0 && (
              <p className="chart-fuente">No entran al cálculo por no tener dato en las dos métricas: {lista(par.sinDato.map((c) => nombre[c]))}.</p>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
