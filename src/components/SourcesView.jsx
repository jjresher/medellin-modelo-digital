'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { DEFINICION_ESTADO, ESTADOS, contarPor, dominio, estadosDelLago, filtrarCatalogo, textoUso, usoPorFuente } from '../lib/fuentes';

// Fuentes y método (issue #15). La tabla sale de catalogo.json, que genera la ingesta (ingesta/correr.py) con todas las
// fuentes de todos los temas; lo que la app toma de cada una se cuenta en los temas del lago. "Ver fuente" en una tarjeta
// abre esta sección con `focusId`: la vista se monta de nuevo (sin filtros) y baja hasta esa fila.

// Un dominio largo ("portalidem.metropol.gov.co") se parte solo después de un punto, nunca a mitad de palabra.
const dominioPartible = (url) =>
  dominio(url)
    .split(/(?=\.)/)
    .map((parte, i) => (
      <Fragment key={i}>
        {i > 0 && <wbr />}
        {parte}
      </Fragment>
    ));

const plural = (n, uno, varios) => `${n.toLocaleString('es-CO')} ${n === 1 ? uno : varios}`;

function Chips({ etiqueta, opciones, valor, onChange, total }) {
  return (
    <div className="catalogo-filtro">
      <span className="selector-estacion">{etiqueta}</span>
      <div className="chips" role="group" aria-label={etiqueta}>
        <button className={valor == null ? 'on' : ''} aria-pressed={valor == null} onClick={() => onChange(null)}>
          Todos <i>{total}</i>
        </button>
        {opciones.map(({ id, rotulo, n, clase }) => (
          <button
            key={id}
            className={id === valor ? 'on' : ''}
            aria-pressed={id === valor}
            disabled={!n && id !== valor}
            onClick={() => onChange(id === valor ? null : id)}
          >
            {clase ? <span className={`estado ${clase}`}>{rotulo}</span> : rotulo} <i>{n}</i>
          </button>
        ))}
      </div>
    </div>
  );
}

function Metodo({ lago, catalogo }) {
  const temas = lago.indice?.temas ?? [];
  const enLago = estadosDelLago(lago.temas);
  const porEstado = catalogo?.por_estado ?? {};
  const cifras = Object.values(lago.temas).reduce((s, t) => s + Object.keys(t.cifras ?? {}).length, 0);
  const series = Object.values(lago.temas).reduce((s, t) => s + Object.keys(t.series ?? {}).length, 0);
  return (
    <section className="sec-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MÉTODO</p>
          <h2>Cómo llega una cifra a la pantalla</h2>
        </div>
      </div>
      <div className="metodo-pasos">
        <div>
          <b>
            <span>01</span> Ingesta reproducible
          </b>
          <p>
            Un script por tema (<code>ingesta/pull_&lt;tema&gt;.py</code>, {temas.length} temas) descarga cada fuente de su URL pública, sin llaves ni
            credenciales, y escribe el tema en el lago. Si una fuente falla, el tema conserva lo que trajo la ingesta anterior y la corrida termina
            con error, para que la falla no pase inadvertida. Se corre con <code>npm run ingesta</code>, o un tema a la vez (
            <code>ingesta/correr.py seguridad</code>); al final rehace el índice y este catálogo y verifica el lago.
          </p>
        </div>
        <div>
          <b>
            <span>02</span> Verificación
          </b>
          <p>
            <code>ingesta/verificar.py</code> revisa el lago completo: que cada cifra tenga valor, unidad, fuente, vigencia y estado; que los
            porcentajes estén entre 0 y 100 (salvo las variaciones) y no haya valores negativos; que cada serie tenga al menos dos puntos; que cada
            fuente tenga URL y fecha de prueba (avisa si pasan más de 45 días), y que el índice y este catálogo coincidan con los temas. Con{' '}
            <code>--red</code> comprueba además que cada URL responda. Corre al final de cada ingesta y en <code>npm run check</code>, antes de cada
            commit; un error la hace fallar.
          </p>
        </div>
        <div>
          <b>
            <span>03</span> Publicación
          </b>
          <p>
            El lago son archivos JSON públicos dentro de la app: {plural(cifras, 'cifra', 'cifras')} y {plural(series, 'serie', 'series')} en{' '}
            {temas.length} temas, el índice y este catálogo. El despliegue sirve los archivos del repositorio y no corre la ingesta. La app no tiene
            cifras escritas a mano: si una falta en el lago, su tarjeta no se muestra.
          </p>
          <p className="metodo-archivos">
            {temas.map((t) => (
              <a key={t.tema} href={`/data/lago/${t.tema}.json`} target="_blank" rel="noreferrer">
                {t.tema}.json
              </a>
            ))}
            <a href="/data/lago/indice.json" target="_blank" rel="noreferrer">
              indice.json
            </a>
            <a href="/data/lago/catalogo.json" target="_blank" rel="noreferrer">
              catalogo.json
            </a>
          </p>
        </div>
      </div>

      <h3 className="metodo-subtitulo">Qué significa cada estado</h3>
      <div className="metodo-estados">
        {ESTADOS.map((e) => {
          const datasets = porEstado[e] ?? 0;
          return (
            <div key={e}>
              <span className={`estado ${e}`}>{e}</span>
              <p>{DEFINICION_ESTADO[e]}</p>
              <small>
                {e === 'derivado' && !datasets ? 'Ningún dataset: se calcula a partir de otros' : plural(datasets, 'dataset', 'datasets')}
                <br />
                {textoUso(enLago[e]) || 'Ninguna cifra'}
              </small>
            </div>
          );
        })}
      </div>
      <div className="metodo-lectura">
        <b>Vigencia y fecha de prueba</b>
        <p>
          La vigencia es el periodo que cubre el dato, leída del dato mismo y no de la fecha de actualización que declara el portal: un archivo puede
          figurar como actualizado este año y traer registros que terminan años antes. Por eso cifras de fuentes distintas no deben leerse como un
          mismo corte. «Probado» es la última fecha en que la ingesta descargó la fuente con éxito.
        </p>
      </div>
    </section>
  );
}

export default function SourcesView({ lago, focusId }) {
  const catalogo = lago.catalogo;
  const datasets = useMemo(() => catalogo?.datasets ?? [], [catalogo]);
  const [tema, setTema] = useState(null);
  const [estado, setEstado] = useState(null);
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (focusId) document.getElementById(`source-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, datasets]);

  const titulo = Object.fromEntries((lago.indice?.temas ?? []).map((t) => [t.tema, t.titulo]));
  const uso = useMemo(() => usoPorFuente(lago.temas), [lago.temas]);
  const numero = Object.fromEntries(datasets.map((d, i) => [d.id, String(i + 1).padStart(2, '0')]));
  const visibles = filtrarCatalogo(datasets, { tema, estado, texto });
  // Cada grupo de filtros cuenta con los otros dos aplicados: el número dice cuántas filas quedan al elegirlo.
  const porTema = contarPor(filtrarCatalogo(datasets, { estado, texto }), 'tema');
  const porEstado = contarPor(filtrarCatalogo(datasets, { tema, texto }), 'estado');
  const temas = [...new Set(datasets.map((d) => d.tema))];
  const filtrado = tema || estado || texto.trim();

  if (lago.estado === 'cargando') return <div className="view-loading">Cargando el catálogo…</div>;

  return (
    <section className="view sources-view">
      <div className="view-intro">
        <p className="eyebrow">TRAZABILIDAD DEL DATO</p>
        <h1>
          Fuentes <em>y método.</em>
        </h1>
        <p>
          Cada cifra de la app sale del lago de datos, que generan scripts de ingesta reproducibles y que se verifica antes de publicarse. Aquí está
          cada fuente primaria con su vigencia real, su estado y lo que la app toma de ella.
        </p>
      </div>
      {lago.estado === 'listo' && <Metodo lago={lago} catalogo={catalogo} />}
      {!catalogo && <p className="lake-message">El catálogo no está disponible. Genera el lago con la ingesta (ver README).</p>}
      {catalogo && (
        <section className="sec-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                CATÁLOGO · {catalogo.n} DATASETS · GENERADO EL {catalogo.probado}
              </p>
              <h2>Todas las fuentes del lago</h2>
            </div>
          </div>
          <div className="catalogo-filtros">
            <Chips
              etiqueta="Estado"
              total={Object.values(porEstado).reduce((s, n) => s + n, 0)}
              valor={estado}
              onChange={setEstado}
              opciones={ESTADOS.filter((e) => catalogo.por_estado[e]).map((e) => ({ id: e, rotulo: e, clase: e, n: porEstado[e] ?? 0 }))}
            />
            <Chips
              etiqueta="Tema"
              total={Object.values(porTema).reduce((s, n) => s + n, 0)}
              valor={tema}
              onChange={setTema}
              opciones={temas.map((t) => ({ id: t, rotulo: titulo[t] ?? t, n: porTema[t] ?? 0 }))}
            />
            <label className="catalogo-buscar selector-estacion">
              Buscar
              <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, entidad, id o dominio" />
            </label>
          </div>
          <div className="chart-card catalogo-card">
            <div className="catalogo-barra">
              <span>{visibles.length === datasets.length ? `${datasets.length} datasets` : `${visibles.length} de ${datasets.length} datasets`}</span>
              {filtrado && (
                <button
                  className="link-fuente"
                  onClick={() => {
                    setTema(null);
                    setEstado(null);
                    setTexto('');
                  }}
                >
                  Quitar filtros
                </button>
              )}
            </div>
            {visibles.length > 0 ? (
              <table className="chart-table catalogo-tabla">
                <thead>
                  <tr>
                    <th>N.º</th>
                    <th>Dataset</th>
                    <th>Entidad</th>
                    <th>Tema</th>
                    <th>Vigencia</th>
                    <th>Estado</th>
                    <th>Uso en la app</th>
                    <th>Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((d) => {
                    const cuenta = textoUso(uso[d.id]);
                    return (
                      <tr key={d.id} id={`source-${d.id}`} className={focusId === d.id ? 'focused' : ''}>
                        <td data-rotulo="N.º">{numero[d.id]}</td>
                        <td data-rotulo="Dataset">
                          <b>{d.nombre}</b>
                          <small>{d.id}</small>
                        </td>
                        <td data-rotulo="Entidad">{d.entidad}</td>
                        <td data-rotulo="Tema">{titulo[d.tema] ?? d.tema}</td>
                        <td data-rotulo="Vigencia">
                          {d.vigencia}
                          {d.probado && <small>probado {d.probado}</small>}
                        </td>
                        <td data-rotulo="Estado">
                          <span className={`estado ${d.estado}`}>{d.estado}</span>
                        </td>
                        <td data-rotulo="Uso">
                          {cuenta || 'Capa del mapa o lectura en vivo'}
                          <small>{d.uso}</small>
                        </td>
                        <td data-rotulo="Fuente">
                          <a href={d.url} target="_blank" rel="noreferrer" title={d.url}>
                            {dominioPartible(d.url)}&nbsp;↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="catalogo-vacio">Ningún dataset cumple los filtros.</p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
