'use client';

import { useMemo, useState } from 'react';
import { accentByTheme } from '../data/navegacion';
import { GRUPOS, construirAtlas, construirBarrios, lugaresDeBarrios, puestos, ranking } from '../lib/atlas';
import { useJsonEstatico } from '../lib/lago';
import BarChart from './charts/BarChart';
import LineChart from './charts/LineChart';
import { accent } from './charts/tokens';
import MetricCard from './MetricCard';
import MapaTerritorios from './territorios/MapaTerritorios';
import { Procedencia, formato, formatoIndicador, unidadCorta } from './territorios/PanelTerritorios';

// Atlas de comunas y barrios. No tiene un tema propio en el lago: junta las métricas por territorio que publica cada
// tema (src/lib/atlas.js elige cuáles) y las compara en un mapa, un ranking y una ficha con el puesto de cada territorio.
// El puesto ordena de mayor a menor valor; no califica.

const TITULO_GRUPO = Object.fromEntries(GRUPOS.map((g) => [g.id, g.titulo]));
const GRUPOS_BARRIO = { seguridad: 'Seguridad (SISC)', construccion: 'Construcción (catastro)' };
const TEMA_BARRIO = { seguridad: 'seguridad', construccion: 'lentes' };
const TOPE_BARRIOS = 25;

const colorDe = (tema) => accent[accentByTheme[tema] ?? 'green'];
const conUnidad = (valor, ind) => `${formatoIndicador(valor, ind)} ${unidadCorta(ind)}`.trim();
function Selector({ grupos, titulos, grupo, onGrupo, metricas, metrica, onMetrica }) {
  return (
    <div className="atlas-selector">
      <div className="chips" role="group" aria-label="Tema de la métrica">
        {grupos.map((g) => (
          <button key={g} className={g === grupo ? 'on' : ''} onClick={() => onGrupo(g)}>
            {titulos[g]}
          </button>
        ))}
      </div>
      <div className="chips atlas-metricas" role="group" aria-label="Métrica">
        {metricas.map((m) => (
          <button key={m.id} className={m.id === metrica.id ? 'on' : ''} onClick={() => onMetrica(m.id)}>
            {m.corto}
          </button>
        ))}
      </div>
    </div>
  );
}

function Cabecera({ metrica, fuentes, onSource }) {
  const { ind, anio } = metrica;
  return (
    <div className="indicador-cabecera">
      <h3>
        {ind.etiqueta} · {anio}
      </h3>
      <Procedencia indicador={ind} fuentes={fuentes} onSource={onSource} />
      {ind.nota && <p className="sec-note">{ind.nota}</p>}
    </div>
  );
}

// Ficha: una tarjeta por tema, con el año, el valor y el puesto del territorio elegido en cada métrica.
function Fichas({ grupos, titulos, metricas, codigo, activa, onMetrica, children }) {
  return (
    <div className="chart-grid atlas-fichas">
      {children}
      {grupos.map((g) => (
        <div key={g} className="chart-card tabla-card">
          <h3>{titulos[g]}</h3>
          <table className="chart-table ficha-tabla atlas-ficha">
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Año</th>
                <th>Valor</th>
                <th>Puesto</th>
              </tr>
            </thead>
            <tbody>
              {metricas
                .filter((m) => m.grupo === g)
                .map((m) => {
                  const valor = m.valores[codigo];
                  const { de, puesto } = puestos(m.valores);
                  return (
                    <tr key={m.id} className={m.id === activa ? 'activo' : ''}>
                      <td>
                        <button onClick={() => onMetrica(m)}>{m.ind.etiqueta}</button>{' '}
                        <span className={`estado ${m.ind.estado}`}>{m.ind.estado}</span>
                      </td>
                      <td>{m.anio}</td>
                      <td>{valor == null ? 'sin dato' : conUnidad(valor, m.ind)}</td>
                      <td>{valor == null ? '—' : `${puesto[codigo]} de ${de}`}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function NivelComunas({ atlas, fuentes, onSource }) {
  const { metricas, territorios } = atlas;
  const grupos = GRUPOS.map((g) => g.id).filter((g) => metricas.some((m) => m.grupo === g));
  const [id, setId] = useState(metricas[0].id);
  const metrica = metricas.find((m) => m.id === id) ?? metricas[0];
  const filas = useMemo(() => ranking(metrica, territorios), [metrica, territorios]);
  // La ficha abre en el primer puesto de la métrica inicial.
  const [codigo, setCodigo] = useState(filas[0]?.codigo ?? territorios[0].codigo);
  const territorio = territorios.find((t) => t.codigo === codigo);
  const { ind } = metrica;
  const color = colorDe(metrica.tema);
  const sinDato = territorios.filter((t) => metrica.valores[t.codigo] == null).map((t) => t.nombre);
  const evolucion = metrica.series[codigo] ?? [];

  return (
    <>
      <section className="sec-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">16 COMUNAS Y 5 CORREGIMIENTOS · {metricas.length} MÉTRICAS</p>
            <h2>Una métrica, todos los territorios</h2>
          </div>
        </div>
        <p className="sec-note">
          Elige un tema y una métrica. Cada una conserva su fuente, su estado y su último año con dato, así que no todas llegan al mismo año. El
          puesto ordena los territorios de mayor a menor valor: es una posición, no una calificación.
        </p>
        <Selector
          grupos={grupos}
          titulos={TITULO_GRUPO}
          grupo={metrica.grupo}
          onGrupo={(g) => setId(metricas.find((m) => m.grupo === g).id)}
          metricas={metricas.filter((m) => m.grupo === metrica.grupo)}
          metrica={metrica}
          onMetrica={setId}
        />
        <Cabecera metrica={metrica} fuentes={fuentes} onSource={onSource} />
        <div className="chart-grid">
          <div className="chart-card">
            <h3>Mapa</h3>
            <MapaTerritorios
              valores={metrica.valores}
              etiqueta={ind.unidad}
              formatValue={(v) => conUnidad(v, ind)}
              formatLegend={(v) => formatoIndicador(v, ind)}
              color={color}
              seleccionado={codigo}
              onSelect={setCodigo}
              height={540}
            />
            <p className="chart-fuente">Toca un territorio para ver su valor y abrir su ficha.</p>
          </div>
          <div className="chart-card">
            <h3>
              Ranking ({ind.unidad}), {metrica.anio}
            </h3>
            <BarChart
              data={filas.map((f) => ({
                id: f.codigo,
                label: f.nombre,
                value: f.valor,
                rank: f.puesto,
                note: `Puesto ${f.puesto} de ${filas.length} · ${f.tipo}`
              }))}
              color={color}
              unit={unidadCorta(ind)}
              formatValue={(v) => formatoIndicador(v, ind)}
              ariaLabel={`${ind.etiqueta} por territorio, de mayor a menor`}
              selected={codigo}
              onSelect={(d) => setCodigo(d.id)}
            />
            {sinDato.length > 0 && (
              <p className="chart-fuente">
                Sin dato en {metrica.anio}: {sinDato.join(', ')}.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="sec-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FICHA DEL TERRITORIO</p>
            <h2>
              {territorio.nombre} <small className="atlas-tipo">{territorio.tipo.toLowerCase()}</small>
            </h2>
          </div>
        </div>
        <p className="sec-note">
          Puesto entre los territorios con dato en cada métrica (1 = el valor más alto). Toca una métrica para verla en el mapa y en el ranking.
        </p>
        <label className="selector-estacion atlas-territorio">
          Territorio
          <select value={codigo} onChange={(e) => setCodigo(e.target.value)}>
            {territorios.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {t.nombre} ({t.tipo.toLowerCase()})
              </option>
            ))}
          </select>
        </label>
        {evolucion.length > 1 && (
          <div className="chart-card atlas-evolucion">
            <h3>
              {ind.etiqueta} en {territorio.nombre}, {evolucion[0][0]}–{evolucion.at(-1)[0]}
            </h3>
            <LineChart
              series={[{ label: territorio.nombre, color, points: evolucion }]}
              unit={unidadCorta(ind)}
              formatValue={(v) => formatoIndicador(v, ind)}
              height={200}
            />
          </div>
        )}
        <Fichas grupos={grupos} titulos={TITULO_GRUPO} metricas={metricas} codigo={codigo} activa={metrica.id} onMetrica={(m) => setId(m.id)} />
      </section>
    </>
  );
}

function NivelBarrios({ atlas, fuentes, onSource }) {
  const seguridad = useJsonEstatico('/data/geo/seguridad_barrios.json');
  const construccion = useJsonEstatico('/data/geo/construcciones_barrios.json');
  const barrios = useJsonEstatico('/data/geo/barrios.geojson');
  const veredas = useJsonEstatico('/data/geo/veredas.geojson');
  const [id, setId] = useState(null);
  const [codigo, setCodigo] = useState(null);
  const [todos, setTodos] = useState(false);

  const lugares = useMemo(() => lugaresDeBarrios(barrios.datos, veredas.datos, atlas.territorios), [barrios.datos, veredas.datos, atlas.territorios]);
  const metricas = useMemo(
    () =>
      construirBarrios(
        [
          ['seguridad', seguridad.datos],
          ['construccion', construccion.datos]
        ],
        lugares
      ),
    [seguridad.datos, construccion.datos, lugares]
  );
  const metrica = metricas.find((m) => m.id === id) ?? metricas[0];
  const filas = useMemo(() => (metrica ? ranking(metrica, lugares) : []), [metrica, lugares]);

  const cargando = [seguridad, construccion, barrios, veredas].some((a) => a.estado === 'cargando');
  if (cargando) return <p className="lake-message">Cargando los barrios y veredas…</p>;
  if (!lugares.length || !metrica) {
    return <p className="lake-message">No hay datos por barrio. Genera el lago con la ingesta (temas seguridad y lentes; ver README).</p>;
  }

  const grupos = Object.keys(GRUPOS_BARRIO).filter((g) => metricas.some((m) => m.grupo === g));
  const { ind } = metrica;
  const color = colorDe(TEMA_BARRIO[metrica.grupo]);
  const elegido = lugares.find((l) => l.codigo === (codigo ?? filas[0]?.codigo));
  const visibles = todos ? filas : filas.slice(0, TOPE_BARRIOS);
  const sinDato = lugares.length - filas.length;

  return (
    <>
      <section className="sec-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {lugares.filter((l) => l.tipo === 'Barrio').length} BARRIOS Y {lugares.filter((l) => l.tipo === 'Vereda').length} VEREDAS ·{' '}
              {metricas.length} MÉTRICAS
            </p>
            <h2>El mismo mapa, barrio por barrio</h2>
          </div>
        </div>
        <p className="sec-note">
          A este nivel solo hay métricas con dato abierto por barrio: los registros del SISC (histórico) y las construcciones del catastro. Son
          conteos y medidas físicas; el lago no tiene población por barrio, así que no se calculan tasas por habitante.
        </p>
        <Selector
          grupos={grupos}
          titulos={GRUPOS_BARRIO}
          grupo={metrica.grupo}
          onGrupo={(g) => setId(metricas.find((m) => m.grupo === g).id)}
          metricas={metricas.filter((m) => m.grupo === metrica.grupo)}
          metrica={metrica}
          onMetrica={setId}
        />
        <Cabecera metrica={metrica} fuentes={fuentes} onSource={onSource} />
        <div className="chart-grid">
          <div className="chart-card">
            <h3>Mapa</h3>
            <MapaTerritorios
              key="barrios"
              nivel="barrios"
              valores={metrica.valores}
              etiqueta={ind.unidad}
              formatValue={(v) => conUnidad(v, ind)}
              formatLegend={(v) => formatoIndicador(v, ind)}
              color={color}
              seleccionado={elegido?.codigo}
              onSelect={setCodigo}
              height={540}
            />
            <p className="chart-fuente">Toca un barrio o una vereda para ver su valor y su ficha.</p>
          </div>
          <div className="chart-card">
            <div className="card-controls">
              <h3>
                Ranking ({ind.unidad}){todos ? '' : `: los ${Math.min(TOPE_BARRIOS, filas.length)} primeros`}
              </h3>
              {filas.length > TOPE_BARRIOS && (
                <button className="link-fuente" onClick={() => setTodos((v) => !v)}>
                  {todos ? `Ver solo los ${TOPE_BARRIOS} primeros` : `Ver los ${filas.length}`}
                </button>
              )}
            </div>
            <div className={todos ? 'tabla-scroll atlas-ranking-largo' : undefined}>
              <BarChart
                data={visibles.map((f) => ({
                  id: f.codigo,
                  label: f.nombre,
                  value: f.valor,
                  rank: f.puesto,
                  note: `Puesto ${f.puesto} de ${filas.length} · ${f.tipo} de ${f.comuna}`
                }))}
                color={color}
                unit={unidadCorta(ind)}
                formatValue={(v) => formatoIndicador(v, ind)}
                ariaLabel={`${ind.etiqueta} por barrio, de mayor a menor`}
                selected={elegido?.codigo}
                onSelect={(d) => setCodigo(d.id)}
              />
            </div>
            {sinDato > 0 && <p className="chart-fuente">{formato(sinDato)} barrios o veredas no tienen dato en esta métrica.</p>}
          </div>
        </div>
      </section>

      {elegido && (
        <section className="sec-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FICHA DEL {elegido.tipo.toUpperCase()}</p>
              <h2>
                {elegido.nombre} <small className="atlas-tipo">{elegido.comuna}</small>
              </h2>
            </div>
          </div>
          <p className="sec-note">Puesto entre los barrios y veredas con dato en cada métrica (1 = el valor más alto).</p>
          <Fichas
            grupos={grupos}
            titulos={GRUPOS_BARRIO}
            metricas={metricas}
            codigo={elegido.codigo}
            activa={metrica.id}
            onMetrica={(m) => setId(m.id)}
          />
        </section>
      )}
    </>
  );
}

// Los 10 municipios del Área Metropolitana del Valle de Aburrá, con la proyección del DANE.
function Regional({ tema, onSource }) {
  const municipios = tema?.listas.amva ?? [];
  if (!municipios.length) return null;
  const cifras = ['poblacion_amva', 'participacion_medellin_amva', 'poblacion']
    .filter((k) => tema.cifras[k])
    .map((k) => ({ ...tema.cifras[k], clave: k, tema: 'demografia' }));
  const ordenados = [...municipios].sort((a, b) => b.poblacion - a.poblacion);
  const anio = municipios[0].anio;
  return (
    <section className="sec-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">DANE · PROYECCIONES DE POBLACIÓN</p>
          <h2>Medellín en el Área Metropolitana</h2>
        </div>
        <span>{anio}</span>
      </div>
      <p className="sec-note">
        Población proyectada por el DANE para los {municipios.length} municipios del Área Metropolitana del Valle de Aburrá. La cabecera es el área
        urbana de cada municipio; el resto son centros poblados y rural disperso.
      </p>
      <div className="metrics-grid compact">
        {cifras.map((c) => (
          <MetricCard key={c.clave} cifra={c} onSource={onSource} />
        ))}
      </div>
      <div className="chart-grid">
        <div className="chart-card">
          <h3>Población por municipio, {anio}</h3>
          <BarChart
            data={ordenados.map((m, i) => ({
              label: m.nombre,
              value: m.poblacion,
              rank: i + 1,
              note: `${formato(m.participacion, 1)} % del Área Metropolitana`
            }))}
            color={accent.green}
            unit="habitantes"
            formatValue={(v) => formato(v)}
            ariaLabel="Población de los municipios del Área Metropolitana, de mayor a menor"
            selected="Medellín"
          />
        </div>
        <div className="chart-card tabla-card">
          <h3>Urbana y rural, de norte a sur</h3>
          <table className="chart-table atlas-amva">
            <thead>
              <tr>
                <th>Municipio</th>
                <th>Población</th>
                <th>Cabecera</th>
                <th>Rural</th>
                <th>% del Área</th>
              </tr>
            </thead>
            <tbody>
              {municipios.map((m) => (
                <tr key={m.codigo} className={m.nombre === 'Medellín' ? 'activo' : ''}>
                  <td>{m.nombre}</td>
                  <td>{formato(m.poblacion)}</td>
                  <td>{formato(m.cabecera)}</td>
                  <td>{formato(m.rural)}</td>
                  <td>{formato(m.participacion, 1)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="chart-fuente">
            La participación es la población de cada municipio sobre la suma de los {municipios.length} (estado{' '}
            <span className="estado derivado">derivado</span>).
          </p>
        </div>
      </div>
    </section>
  );
}

export default function AtlasView({ lago, onSource }) {
  const atlas = useMemo(() => construirAtlas(lago.temas), [lago.temas]);
  const [nivel, setNivel] = useState('comunas');
  if (lago.estado === 'cargando') return <div className="view-loading">Cargando el atlas…</div>;
  if (!atlas.metricas.length) {
    return (
      <section className="view">
        <p className="lake-message">El atlas no tiene métricas por territorio. Genera el lago con la ingesta (ver README).</p>
      </section>
    );
  }
  const fuentes = lago.catalogo?.datasets ?? [];
  return (
    <section className="view atlas-view">
      <div className="view-intro">
        <p className="eyebrow">MEDELLÍN · ATLAS DE COMUNAS Y BARRIOS</p>
        <h1>
          La ciudad, <em>territorio por territorio.</em>
        </h1>
        <p>
          Las métricas de todas las secciones en un mismo mapa: compara las 16 comunas y los 5 corregimientos, baja al barrio donde hay dato y mira el
          puesto de cada territorio. Cada cifra muestra su fuente, su vigencia y su estado.
        </p>
      </div>
      <div className="chips atlas-niveles" role="group" aria-label="Nivel territorial">
        <button className={nivel === 'comunas' ? 'on' : ''} onClick={() => setNivel('comunas')}>
          Comunas y corregimientos
        </button>
        <button className={nivel === 'barrios' ? 'on' : ''} onClick={() => setNivel('barrios')}>
          Barrios y veredas
        </button>
      </div>
      {nivel === 'comunas' ? (
        <NivelComunas atlas={atlas} fuentes={fuentes} onSource={onSource} />
      ) : (
        <NivelBarrios atlas={atlas} fuentes={fuentes} onSource={onSource} />
      )}
      <Regional tema={lago.temas.demografia} onSource={onSource} />
    </section>
  );
}
