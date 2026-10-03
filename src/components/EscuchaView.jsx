'use client';

import { useState } from 'react';
import BarChart from './charts/BarChart';
import LineChart from './charts/LineChart';
import { accent, textMuted } from './charts/tokens';
import MetricCard from './MetricCard';
import { Procedencia, formato } from './territorios/PanelTerritorios';

// Sección Escucha social. Todo sale del tema `escucha` del lago: las visitas en Wikipedia (demanda de información) y la
// cobertura de prensa de GDELT (oferta). Ninguna de las dos mide opinión, y la sección no las califica.

const COLOR = accent.purple;
const pick = (tema, clave) => (tema.cifras[clave] ? { ...tema.cifras[clave], clave, tema: 'escucha' } : null);
const tarjetas = (tema, claves) => claves.map((k) => pick(tema, k)).filter(Boolean);
const conSigno = (v, decimales = 1) => (v == null ? 'sin dato' : `${v > 0 ? '+' : ''}${formato(v, decimales)} %`);
const mesCorto = (etiqueta) => etiqueta.split(' ')[0];
const minusculaInicial = (texto) => texto.charAt(0).toLowerCase() + texto.slice(1);

function Tarjetas({ cifras, onSource }) {
  if (!cifras.length) return null;
  return (
    <div className="metrics-grid">
      {cifras.map((c) => (
        <MetricCard key={c.clave} cifra={c} onSource={onSource} />
      ))}
    </div>
  );
}

function Encabezado({ eyebrow, titulo, vigencia }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{titulo}</h2>
      </div>
      {vigencia && <span>{vigencia}</span>}
    </div>
  );
}

function Chips({ opciones, valor, onChange }) {
  return (
    <div className="chips">
      {opciones.map(([k, l]) => (
        <button key={k} className={valor === k ? 'on' : ''} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

// Doce meses contra los doce anteriores, mes a mes: la línea sólida es la ventana reciente y la punteada, la anterior.
function DoceContraDoce({ puntos, ventana, ventanaPrevia, formatValue, ariaLabel }) {
  const previos = puntos.slice(-24, -12);
  const actuales = puntos.slice(-12);
  if (actuales.length < 12 || previos.length < 12) return null;
  return (
    <LineChart
      series={[
        { label: ventana, color: COLOR, points: actuales.map(([m, v]) => [mesCorto(m), v]) },
        { label: ventanaPrevia, color: textMuted, dashed: true, points: previos.map(([m, v]) => [mesCorto(m), v]) }
      ]}
      formatValue={formatValue}
      ariaLabel={ariaLabel}
    />
  );
}

const IDIOMAS = [
  ['es', 'Español'],
  ['en', 'Inglés']
];
const MEDIDAS = [
  ['vistas', 'Vistas'],
  ['millon', 'Por millón del sitio']
];
const PERIODOS = [
  ['doce', '12 meses vs. anteriores'],
  ['todo', 'Desde 2015']
];

function ArticuloCiudad({ tema, definicion }) {
  const [idioma, setIdioma] = useState('es');
  const [medida, setMedida] = useState('vistas');
  const [periodo, setPeriodo] = useState('doce');
  const serie = tema.series[medida === 'vistas' ? `wiki_medellin_${idioma}_mensual` : `wiki_medellin_${idioma}_por_millon`];
  const sitio = tema.series.wiki_sitio_es_mensual;
  if (!serie) return null;
  const fmt = (v) => formato(v, medida === 'vistas' ? 0 : 2);
  return (
    <div className="chart-grid">
      <div className="chart-card">
        <h3>
          Artículo Medellín · Wikipedia en {idioma === 'es' ? 'español' : 'inglés'}
          {medida === 'millon' ? ', vistas por millón de vistas del sitio' : ', vistas por mes'}
        </h3>
        <div className="card-controls">
          <Chips opciones={IDIOMAS} valor={idioma} onChange={setIdioma} />
          <Chips opciones={MEDIDAS} valor={medida} onChange={setMedida} />
          <Chips opciones={PERIODOS} valor={periodo} onChange={setPeriodo} />
        </div>
        {periodo === 'doce' ? (
          <DoceContraDoce
            puntos={serie.puntos}
            ventana={definicion.ventana}
            ventanaPrevia={definicion.ventana_previa}
            formatValue={fmt}
            ariaLabel="Vistas del artículo Medellín, últimos 12 meses frente a los 12 anteriores"
          />
        ) : (
          <LineChart series={[{ label: serie.etiqueta, color: COLOR, points: serie.puntos }]} formatValue={fmt} ariaLabel={serie.etiqueta} />
        )}
        <p className="chart-fuente">{serie.nota}</p>
      </div>
      {sitio && (
        <div className="chart-card">
          <h3>Toda la Wikipedia en español, millones de vistas por mes</h3>
          <LineChart
            series={[{ label: 'Vistas del sitio', color: accent.cyan, points: sitio.puntos }]}
            formatValue={(v) => formato(v)}
            ariaLabel={sitio.etiqueta}
          />
          <p className="chart-fuente">
            {sitio.nota} Por eso cada variación de esta sección se da también por millón de vistas del sitio: separa el interés por un artículo del
            uso de Wikipedia en general.
          </p>
        </div>
      )}
    </div>
  );
}

// Ranking de artículos (comunas y corregimientos, o lugares) por vistas de 12 meses, con la ficha del elegido.
function RankingArticulos({ filas, definicion, fuente, tema, onSource, titulo, ariaLabel, etiquetaFila }) {
  const [elegido, setElegido] = useState(filas[0]?.titulo);
  const fila = filas.find((f) => f.titulo === elegido) ?? filas[0];
  if (!fila) return null;
  const procedencia = { fuente, vigencia: definicion.ventana, estado: 'observado' };
  return (
    <div className="chart-grid">
      <div className="chart-card">
        <h3>
          {titulo}, {definicion.ventana}
        </h3>
        <Procedencia indicador={procedencia} fuentes={tema.fuentes} onSource={onSource} />
        <BarChart
          data={filas.map((f, i) => ({
            id: f.titulo,
            label: f.nombre,
            value: f.vistas_12m,
            rank: i + 1,
            note: `${etiquetaFila(f)} · ${conSigno(f.variacion_12m)} frente a los 12 meses anteriores`
          }))}
          color={COLOR}
          unit="vistas"
          formatValue={(v) => formato(v)}
          ariaLabel={ariaLabel}
          selected={fila.titulo}
          onSelect={(d) => setElegido(d.id)}
        />
      </div>
      <div className="chart-card ficha-territorio">
        <label className="selector-estacion">
          Artículo
          <select value={fila.titulo} onChange={(e) => setElegido(e.target.value)}>
            {filas.map((f) => (
              <option key={f.titulo} value={f.titulo}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
        <h3>
          <a className="enlace-articulo" href={fila.url} target="_blank" rel="noopener noreferrer">
            {fila.titulo} ↗
          </a>
        </h3>
        <table className="chart-table ficha-tabla">
          <tbody>
            <tr>
              <td>Vistas</td>
              <td>{definicion.ventana}</td>
              <td>{formato(fila.vistas_12m)}</td>
            </tr>
            <tr>
              <td>Vistas</td>
              <td>{definicion.ventana_previa}</td>
              <td>{formato(fila.vistas_12m_previos)}</td>
            </tr>
            <tr>
              <td>
                Variación <span className="estado derivado">derivado</span>
              </td>
              <td>12 meses frente a 12</td>
              <td>{conSigno(fila.variacion_12m)}</td>
            </tr>
            <tr>
              <td>
                Variación por millón del sitio <span className="estado derivado">derivado</span>
              </td>
              <td>12 meses frente a 12</td>
              <td>{conSigno(fila.variacion_12m_norm)}</td>
            </tr>
            <tr>
              <td>Redirecciones sumadas</td>
              <td>títulos que llevan al artículo</td>
              <td>{fila.redirecciones}</td>
            </tr>
          </tbody>
        </table>
        <DoceContraDoce
          puntos={fila.mensual}
          ventana={definicion.ventana}
          ventanaPrevia={definicion.ventana_previa}
          formatValue={(v) => formato(v)}
          ariaLabel={`Vistas de ${fila.nombre}, últimos 12 meses frente a los 12 anteriores`}
        />
      </div>
    </div>
  );
}

function Wikipedia({ tema, onSource }) {
  const definicion = tema.listas.wiki_definicion?.[0];
  const ciudad = tarjetas(tema, [
    'wiki_medellin_es_12m',
    'wiki_medellin_es_variacion_12m',
    'wiki_medellin_es_variacion_12m_norm',
    'wiki_sitio_es_variacion_12m'
  ]);
  const ingles = tarjetas(tema, ['wiki_medellin_en_12m', 'wiki_medellin_en_variacion_12m', 'wiki_sitio_en_variacion_12m']);
  if (!definicion || !ciudad.length) return null;
  const territorios = tema.listas.wiki_territorios ?? [];
  const lugares = tema.listas.wiki_lugares ?? [];
  return (
    <>
      <section className="sec-block">
        <Encabezado eyebrow="WIKIMEDIA · PAGEVIEWS" titulo="Visitas en Wikipedia" vigencia={definicion.ventana} />
        <p className="sec-note">
          Cuántas veces se abrió el artículo de Medellín, sin contar los bots que Wikimedia identifica. Se suman las vistas que llegan por
          redirecciones (por ejemplo, «Medellin», sin tilde). Una visita no es una persona: la misma puede abrir el artículo varias veces.
        </p>
        <Tarjetas cifras={ciudad} onSource={onSource} />
        <Tarjetas cifras={ingles} onSource={onSource} />
        <ArticuloCiudad tema={tema} definicion={definicion} />
      </section>
      {territorios.length > 0 && (
        <section className="sec-block">
          <Encabezado eyebrow="16 COMUNAS Y 5 CORREGIMIENTOS" titulo="Comunas y corregimientos en Wikipedia" vigencia={definicion.ventana} />
          <p className="sec-note">
            El artículo de cada territorio en Wikipedia en español, con sus redirecciones. Toca un territorio para ver sus vistas mes a mes frente a
            las del año anterior.
          </p>
          <RankingArticulos
            filas={territorios}
            definicion={definicion}
            fuente="wikimedia-pageviews"
            tema={tema}
            onSource={onSource}
            titulo="Vistas por territorio"
            ariaLabel="Vistas del artículo de cada comuna y corregimiento"
            etiquetaFila={(f) => f.tipo}
          />
        </section>
      )}
      {lugares.length > 0 && (
        <section className="sec-block">
          <Encabezado eyebrow="LUGARES" titulo="Lugares en Wikipedia" vigencia={definicion.ventana} />
          <p className="sec-note">
            Los {definicion.lugares_articulos} artículos de la categoría «{definicion.lugares_categoria}» de Wikipedia en español y de sus
            subcategorías directas ({definicion.lugares_subcategorias.map(minusculaInicial).join(', ')}). Quedan fuera{' '}
            {definicion.lugares_fuera.map((f) => `«${f.categoria}», porque ${f.motivo}`).join('; ')}. La lista la mantienen los editores de Wikipedia,
            no esta app; aquí van los {lugares.length} con más vistas.
          </p>
          <RankingArticulos
            filas={lugares}
            definicion={definicion}
            fuente="wikimedia-pageviews"
            tema={tema}
            onSource={onSource}
            titulo={`Los ${lugares.length} lugares con más vistas`}
            ariaLabel="Vistas de los artículos de lugares de Medellín"
            etiquetaFila={() => 'Lugar'}
          />
        </section>
      )}
    </>
  );
}

const MEDIDAS_PRENSA = [
  ['articulos', 'Artículos'],
  ['millon', 'Por millón monitoreados']
];

function Volumen({ tema }) {
  const [medida, setMedida] = useState('articulos');
  const serie = tema.series[medida === 'articulos' ? 'prensa_menciones_diarias' : 'prensa_menciones_por_millon'];
  if (!serie) return null;
  return (
    <div className="chart-card">
      <h3>
        {medida === 'articulos' ? 'Artículos que nombran a Medellín, por día' : 'Por millón de artículos monitoreados, por día'}, {serie.vigencia}
      </h3>
      <div className="card-controls">
        <Chips opciones={MEDIDAS_PRENSA} valor={medida} onChange={setMedida} />
      </div>
      <LineChart
        series={[{ label: serie.etiqueta, color: COLOR, points: serie.puntos }]}
        formatValue={(v) => formato(v)}
        ariaLabel={serie.etiqueta}
      />
      <p className="chart-fuente">{serie.nota}</p>
    </div>
  );
}

function FiltroRuido({ tema, definicion }) {
  const reglas = tema.listas.prensa_ruido ?? [];
  const muestra = tema.cifras.prensa_titulares_muestra;
  const quedan = tema.cifras.prensa_titulares_medellin;
  if (!reglas.length || !muestra || !quedan) return null;
  return (
    <div className="chart-card">
      <h3>Filtro de ruido</h3>
      <p className="sec-note">
        GDELT encuentra los artículos que nombran a Medellín en cualquier parte del texto. De cada corte de 30 días se toman los{' '}
        {definicion.cortes[0]?.articulos ?? ''} más relevantes según GDELT y se revisa su titular. Las reglas se aplican en orden: cada artículo
        cuenta en la primera que lo saca.
      </p>
      <table className="chart-table">
        <thead>
          <tr>
            <th>Regla</th>
            <th>Por qué sale</th>
            <th>Artículos</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Artículos revisados</td>
            <td>{definicion.cortes.map((c) => `${c.desde} – ${c.hasta}: ${formato(c.articulos)}`).join(' · ')}</td>
            <td>{formato(muestra.valor)}</td>
          </tr>
          {reglas.map((r) => (
            <tr key={r.regla}>
              <td>{r.etiqueta}</td>
              <td>{r.motivo}</td>
              <td>−{formato(r.articulos)}</td>
            </tr>
          ))}
          <tr className="fila-total">
            <td>Titulares que quedan</td>
            <td>nombran a Medellín y no se repiten</td>
            <td>{formato(quedan.valor)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Temas({ tema, definicion }) {
  const temas = tema.listas.prensa_temas ?? [];
  const total = tema.cifras.prensa_titulares_medellin?.valor;
  if (!temas.length || !total) return null;
  return (
    <div className="chart-card">
      <h3>
        Temas de los {formato(total)} titulares, {definicion.ventana}
      </h3>
      <p className="procedencia">
        <span className="estado derivado">derivado</span>
        <span>clasificación por palabras clave del titular</span>
      </p>
      <BarChart
        data={temas.map((t) => ({ id: t.tema, label: t.etiqueta, value: t.titulares, note: `${formato(t.pct, 1)} % de los titulares` }))}
        color={COLOR}
        unit="titulares"
        formatValue={(v) => formato(v)}
        ariaLabel="Titulares por tema"
      />
      <p className="chart-fuente">
        Un titular puede tener varios temas o ninguno ({formato(definicion.sin_tema)} sin tema). Las palabras de cada tema están en la lista de
        titulares.
      </p>
    </div>
  );
}

function Titulares({ tema }) {
  const titulares = tema.listas.prensa_titulares ?? [];
  const temas = tema.listas.prensa_temas ?? [];
  const [filtro, setFiltro] = useState('todos');
  if (!titulares.length) return null;
  const etiqueta = Object.fromEntries(temas.map((t) => [t.tema, t.etiqueta]));
  const elegido = temas.find((t) => t.tema === filtro);
  const visibles = titulares.filter((t) => filtro === 'todos' || (filtro === 'ninguno' ? !t.temas.length : t.temas.includes(filtro)));
  return (
    <div className="chart-card tabla-card">
      <div className="card-controls">
        <h3>
          Titulares ({formato(visibles.length)} de {formato(titulares.length)})
        </h3>
        <label className="selector-estacion">
          Tema
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="todos">Todos</option>
            {temas.map((t) => (
              <option key={t.tema} value={t.tema}>
                {t.etiqueta}
              </option>
            ))}
            <option value="ninguno">Sin tema</option>
          </select>
        </label>
      </div>
      {elegido && (
        <p className="chart-fuente palabras-tema">
          Palabras de «{elegido.etiqueta}»: {elegido.palabras.map((p) => p.replace(/\$$/, '')).join(', ')}.
        </p>
      )}
      <div className="tabla-scroll">
        <table className="chart-table escucha-titulares">
          <thead>
            <tr>
              <th>Titular</th>
              <th>Medio y fecha</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((t) => (
              <tr key={t.url}>
                <td>
                  <a className="enlace-articulo" href={t.url} target="_blank" rel="noopener noreferrer">
                    {t.titulo}
                  </a>
                  <small>{t.temas.map((k) => etiqueta[k] ?? k).join(' · ') || 'Sin tema'}</small>
                </td>
                <td>
                  {t.medio}
                  <small>
                    {t.fecha} · {t.pais} · {t.idioma}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="chart-fuente">Fecha en que GDELT vio el artículo (hora UTC). El enlace abre la nota en el sitio del medio.</p>
    </div>
  );
}

function Prensa({ tema, onSource }) {
  const definicion = tema.listas.prensa_definicion?.[0];
  const cifras = tarjetas(tema, [
    'prensa_menciones_90d',
    'prensa_menciones_dia',
    'prensa_titulares_muestra',
    'prensa_titulares_medellin',
    'prensa_titulares_pct'
  ]);
  // Volumen y titulares son dos consultas a GDELT que pueden fallar por separado: cada parte se muestra si está en el lago.
  if (!cifras.length) return null;
  const volumen = <Volumen tema={tema} />;
  return (
    <section className="sec-block">
      <Encabezado
        eyebrow="GDELT PROJECT · DOC 2.0"
        titulo="Cobertura de prensa"
        vigencia={tema.cifras.prensa_menciones_90d?.vigencia ?? definicion?.ventana}
      />
      <p className="sec-note">
        GDELT monitorea la prensa en línea de casi todos los países e idiomas. El volumen cuenta todos los artículos que nombran a Medellín; los temas
        y la lista salen de una muestra de titulares que pasa por un filtro de ruido. Mide cuánto se publica, no qué tan leído es ni en qué tono.
      </p>
      <Tarjetas cifras={cifras} onSource={onSource} />
      {definicion ? (
        <div className="chart-grid">
          {volumen}
          <FiltroRuido tema={tema} definicion={definicion} />
          <Temas tema={tema} definicion={definicion} />
          <Titulares tema={tema} />
        </div>
      ) : (
        volumen
      )}
    </section>
  );
}

export default function EscuchaView({ tema, onSource }) {
  if (!tema)
    return (
      <section className="view">
        <p className="lake-message">El tema de escucha social no está disponible. Genera el lago con la ingesta (ver README).</p>
      </section>
    );
  return (
    <section className="view escucha-view">
      <div className="view-intro">
        <p className="eyebrow">MEDELLÍN · ESCUCHA SOCIAL</p>
        <h1>
          Qué se busca <em>y qué se publica.</em>
        </h1>
        <p>
          Dos medidas públicas y gratuitas de la atención que recibe Medellín: las visitas a sus artículos en Wikipedia (quién busca información) y
          los artículos de prensa del mundo que la nombran, según GDELT (quién la publica). Ninguna de las dos mide opinión ni aprobación.
        </p>
      </div>
      <Wikipedia tema={tema} onSource={onSource} />
      <Prensa tema={tema} onSource={onSource} />
    </section>
  );
}
