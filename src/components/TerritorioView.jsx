'use client';

import { useMemo, useState } from 'react';
import BarChart from './charts/BarChart';
import { accent } from './charts/tokens';
import MetricCard from './MetricCard';
import MapaTerritorios from './territorios/MapaTerritorios';
import PanelTerritorios, { Procedencia, formato } from './territorios/PanelTerritorios';

// Sección Territorio y cultura. Todo sale del tema `territorio` del lago; la comparación entre la altura construida y la
// normativa reutiliza el tema `lentes` (issue #2), que ya la calcula por territorio.

const pick = (tema, clave) => (tema.cifras[clave] ? { ...tema.cifras[clave], clave, tema: 'territorio' } : null);
const tarjetas = (tema, claves) => claves.map((k) => pick(tema, k)).filter(Boolean);
const AMENAZAS = [
  ['masa', 'Movimientos en masa'],
  ['inundacion', 'Inundaciones'],
  ['torrencial', 'Avenidas torrenciales']
];

function Tarjetas({ cifras, onSource, compact = true }) {
  if (!cifras.length) return null;
  return (
    <div className={`metrics-grid ${compact ? 'compact' : ''}`}>
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

// Coroplético de un indicador de lago.Territorios, con chips para cambiar de indicador.
function MapaIndicador({ tema, opciones, color, onSource, nota }) {
  const { indicadores = [], territorios = [] } = tema.listas;
  const disponibles = opciones.filter(([k]) => indicadores.some((i) => i.clave === k));
  const [clave, setClave] = useState(disponibles[0]?.[0]);
  const [codigo, setCodigo] = useState(null);
  const ind = indicadores.find((i) => i.clave === clave);
  const anio = useMemo(
    () =>
      territorios
        .flatMap((t) => Object.keys(t.valores[clave] ?? {}))
        .sort()
        .at(-1),
    [territorios, clave]
  );
  const valores = useMemo(() => Object.fromEntries(territorios.map((t) => [t.codigo, t.valores[clave]?.[anio] ?? null])), [territorios, clave, anio]);
  if (!ind) return null;
  const porcentaje = ind.unidad.startsWith('%');
  const fmt = (v) => (porcentaje ? `${formato(v, ind.decimales ?? 0)} %` : `${formato(v, ind.decimales ?? 0)} ${ind.unidad}`);
  // La leyenda es angosta: su título es la unidad y sus marcas, solo números.
  const fmtLeyenda = (v) => formato(v, ind.decimales ?? 0) + (porcentaje ? ' %' : '');
  return (
    <div className="chart-card">
      <div className="card-controls">
        <h3>{ind.etiqueta}</h3>
        {disponibles.length > 1 && (
          <div className="chips">
            {disponibles.map(([k, l]) => (
              <button key={k} className={clave === k ? 'on' : ''} onClick={() => setClave(k)}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>
      <Procedencia indicador={ind} fuentes={tema.fuentes} onSource={onSource} />
      <MapaTerritorios
        valores={valores}
        etiqueta={ind.unidad}
        formatValue={fmt}
        formatLegend={fmtLeyenda}
        color={color}
        seleccionado={codigo}
        onSelect={setCodigo}
        height={380}
      />
      <p className="chart-fuente">
        Toca un territorio para ver su valor. {ind.nota ?? ''} {nota ?? ''}
      </p>
    </div>
  );
}

function Riesgo({ tema, onSource }) {
  const grados = tema.listas.amenaza_por_grado ?? [];
  const zonas = tema.listas.riesgo_no_mitigable ?? [];
  const [todas, setTodas] = useState(false);
  const cifras = tarjetas(tema, ['construcciones_amenaza_alta', 'ha_amenaza_alta', ...AMENAZAS.map(([k]) => `construcciones_amenaza_alta_${k}`)]);
  if (!cifras.length) return null;
  const visibles = todas ? zonas : zonas.slice(0, 12);
  const grado = (amenaza, g) => grados.find((x) => x.amenaza === amenaza && x.grado === g);
  return (
    <section className="sec-block">
      <Encabezado
        eyebrow="PLAN DE ORDENAMIENTO TERRITORIAL · GESTIÓN DEL RIESGO"
        titulo="Amenazas y zonas de riesgo"
        vigencia={tema.cifras.construcciones_amenaza_alta?.vigencia}
      />
      <p className="sec-note">
        El POT clasifica el suelo por su amenaza ante movimientos en masa, inundaciones y avenidas torrenciales (alta, media, baja o muy baja) y
        delimita zonas con condiciones de riesgo y de alto riesgo no mitigable. Las hectáreas se calculan recortando los polígonos del POT con los
        límites de cada comuna y corregimiento; las construcciones son las del catastro cuyo punto cae dentro del polígono (estado{' '}
        <span className="estado derivado">derivado</span>).
      </p>
      <Tarjetas cifras={cifras} onSource={onSource} />
      <Tarjetas
        cifras={tarjetas(tema, ['zonas_riesgo_no_mitigable', 'ha_riesgo_no_mitigable', 'construcciones_riesgo_no_mitigable'])}
        onSource={onSource}
      />
      <div className="chart-grid">
        <MapaIndicador
          tema={tema}
          onSource={onSource}
          color={accent.orange}
          opciones={[
            ['pct_amenaza_alta', '% del área'],
            ['construcciones_amenaza_alta', 'Construcciones'],
            ['construcciones_riesgo_no_mitigable', 'Alto riesgo no mitigable']
          ]}
        />
        {grados.length > 0 && (
          <div className="chart-card tabla-card">
            <h3>Hectáreas por amenaza y grado</h3>
            <table className="chart-table territorio-tabla">
              <thead>
                <tr>
                  <th>Grado</th>
                  {AMENAZAS.map(([, l]) => (
                    <th key={l}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Alta', 'Media', 'Baja', 'Muy Baja'].map((g) => (
                  <tr key={g}>
                    <td>{g}</td>
                    {AMENAZAS.map(([, l]) => {
                      const x = grado(l, g);
                      return <td key={l}>{x ? `${formato(x.hectareas, 1)} ha` : '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chart-fuente">
              Suma del área de los polígonos de cada grado. El POT no clasifica todo el suelo para las tres amenazas: las inundaciones y las avenidas
              torrenciales se delimitan solo cerca de los cauces.
            </p>
          </div>
        )}
      </div>
      {zonas.length > 0 && (
        <div className="chart-card tabla-card">
          <h3>Zonas de alto riesgo no mitigable, por área</h3>
          <table className="chart-table territorio-zonas">
            <thead>
              <tr>
                <th>Zona</th>
                <th>Amenaza</th>
                <th>Territorio</th>
                <th>Área (ha)</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((z, i) => (
                <tr key={i}>
                  <td>{z.nombre}</td>
                  <td>{z.amenaza}</td>
                  <td>{z.territorio}</td>
                  <td>{formato(z.hectareas, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {zonas.length > 12 && (
            <button className="link-fuente" onClick={() => setTodas((v) => !v)}>
              {todas ? 'Ver solo las 12 de mayor área' : `Ver las ${zonas.length}`}
            </button>
          )}
          <p className="chart-fuente">
            Cada zona se asigna al territorio donde cae su punto representativo. Una zona se nombra por el barrio o la vereda donde está.
          </p>
        </div>
      )}
    </section>
  );
}

function Norma({ tema, lentes, onSource }) {
  const usos = tema.listas.usos_suelo ?? [];
  const trat = tema.listas.tratamientos ?? [];
  const alturas = tema.listas.altura_normativa ?? [];
  const porTerritorio = tema.listas.usos_por_territorio ?? [];
  const sobreNorma = (lentes?.listas.territorios ?? [])
    .filter((t) => t.pct_sobre_altura_normativa != null)
    .map((t) => ({
      label: t.nombre.replace(/^Corregimiento de /, ''),
      value: t.pct_sobre_altura_normativa,
      note: `${formato(t.construcciones_con_altura_normativa)} construcciones con altura normativa en pisos`
    }))
    .sort((a, b) => b.value - a.value);
  const cifras = tarjetas(tema, ['pot_vigente', 'pct_baja_mixtura', 'poligonos_tratamiento', 'pct_altura_numerica']);
  if (!cifras.length) return null;
  const categorias = usos.map((u) => u.uso);
  return (
    <section className="sec-block">
      <Encabezado
        eyebrow="DEPARTAMENTO ADMINISTRATIVO DE PLANEACIÓN"
        titulo="Usos del suelo, tratamientos y altura normativa"
        vigencia={tema.cifras.poligonos_tratamiento?.vigencia}
      />
      <p className="sec-note">
        El POT asigna a cada zona urbana un uso general (según su mezcla de vivienda y actividades económicas), un tratamiento (consolidación,
        renovación, mejoramiento integral, desarrollo o conservación) y una altura máxima en pisos. La capa que la Alcaldía publica como “POT 2025” es
        un mapa provisional con las capas del Acuerdo 48 de 2014 que no cambian en la revisión de mediano plazo: no es un POT nuevo.
      </p>
      <Tarjetas cifras={cifras} onSource={onSource} />
      <div className="chart-grid">
        {usos.length > 0 && (
          <div className="chart-card">
            <h3>Suelo urbano por uso general (ha)</h3>
            <BarChart
              data={usos.map((u) => ({ label: u.uso, value: u.hectareas }))}
              color={accent.yellow}
              unit="ha"
              formatValue={(v) => formato(v)}
              ariaLabel="Hectáreas por uso general del suelo"
            />
            <p className="chart-fuente">Área de los polígonos de cada uso. El espacio público proyectado es el que el POT prevé construir.</p>
          </div>
        )}
        {trat.length > 0 && (
          <div className="chart-card">
            <h3>Suelo por tratamiento urbano (ha)</h3>
            <BarChart
              data={trat.map((x) => ({ label: x.tratamiento, value: x.hectareas, note: `${x.poligonos} polígonos` }))}
              color={accent.yellow}
              unit="ha"
              formatValue={(v) => formato(v)}
              ariaLabel="Hectáreas por tratamiento urbano"
            />
            <p className="chart-fuente">Incluye el suelo de expansión. Pasa el cursor por cada barra para ver el número de polígonos.</p>
          </div>
        )}
        {alturas.length > 0 && (
          <div className="chart-card tabla-card">
            <h3>Altura normativa</h3>
            <table className="chart-table territorio-tabla">
              <thead>
                <tr>
                  <th>Altura máxima</th>
                  <th>Polígonos</th>
                  <th>Área (ha)</th>
                </tr>
              </thead>
              <tbody>
                {alturas.map((a) => (
                  <tr key={a.altura}>
                    <td>{/^\d+$/.test(a.altura) ? `${a.altura} ${a.altura === '1' ? 'piso' : 'pisos'}` : a.altura}</td>
                    <td>{a.poligonos}</td>
                    <td>{formato(a.hectareas, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chart-fuente">
              “Variable” remite a la norma de cada polígono según el tamaño del lote; “N/A” corresponde a tratamientos sin altura en pisos (por
              ejemplo, áreas de preservación de infraestructura).
            </p>
          </div>
        )}
        {sobreNorma.length > 0 && (
          <div className="chart-card">
            <h3>Construcciones por encima de la altura normativa (%)</h3>
            <BarChart
              data={sobreNorma}
              color={accent.purple}
              unit="%"
              formatValue={(v) => formato(v, 1)}
              ariaLabel="Porcentaje de construcciones por encima de la altura normativa por territorio"
            />
            <p className="chart-fuente">
              De la lente de densificación del gemelo: pisos del catastro frente a la altura normativa del tratamiento donde está cada construcción,
              solo donde el POT la fija en pisos. Es un cruce geométrico: no considera licencias ni normas anteriores.
              {lentes && (
                <>
                  {' '}
                  <button className="link-fuente" onClick={() => onSource('catastro-puntos')}>
                    Ver fuente ↗
                  </button>
                </>
              )}
            </p>
          </div>
        )}
      </div>
      {porTerritorio.length > 0 && (
        <div className="chart-card tabla-card">
          <h3>Uso general del suelo urbano por territorio (% del área con uso asignado)</h3>
          <table className="chart-table territorio-usos">
            <thead>
              <tr>
                <th>Territorio</th>
                {categorias.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                <th>Total (ha)</th>
              </tr>
            </thead>
            <tbody>
              {porTerritorio.map((t) => {
                const total = categorias.reduce((s, c) => s + (t[c] ?? 0), 0);
                return (
                  <tr key={t.codigo}>
                    <td>{t.nombre}</td>
                    {categorias.map((c) => (
                      <td key={c}>{total ? `${formato(((t[c] ?? 0) / total) * 100, 1)} %` : '—'}</td>
                    ))}
                    <td>{formato(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="chart-fuente">
            Cada polígono se asigna al territorio donde cae su punto representativo. Los corregimientos solo tienen aquí sus cabeceras y centros
            poblados urbanos; su suelo rural tiene otra clasificación.
          </p>
        </div>
      )}
    </section>
  );
}

function Patrimonio({ tema, onSource }) {
  const bienes = tema.listas.bic ?? [];
  const [filtro, setFiltro] = useState('');
  const cifras = tarjetas(tema, ['bic']);
  if (!cifras.length) return null;
  const texto = filtro.trim().toLowerCase();
  const visibles = bienes.filter((b) => !texto || `${b.nombre} ${b.direccion} ${b.territorio} ${b.sector} ${b.tipo}`.toLowerCase().includes(texto));
  return (
    <section className="sec-block">
      <Encabezado eyebrow="SECRETARÍA DE CULTURA CIUDADANA" titulo="Patrimonio" vigencia={tema.cifras.bic?.vigencia} />
      <p className="sec-note">
        Bienes de interés cultural (BIC) declarados que recoge el POT: edificaciones, conjuntos, espacios públicos y zonas arqueológicas. El barrio
        Prado concentra buena parte de ellos por su declaratoria como sector.
      </p>
      <div className="chart-grid">
        <MapaIndicador tema={tema} onSource={onSource} color={accent.purple} opciones={[['bic', 'Bienes']]} />
        <div className="chart-card">
          <Tarjetas cifras={cifras} onSource={onSource} compact={false} />
          {tema.listas.bic_por_grupo && (
            <BarChart
              data={tema.listas.bic_por_grupo.map((g) => ({ label: g.grupo, value: g.bienes }))}
              color={accent.purple}
              formatValue={(v) => formato(v)}
              ariaLabel="Bienes de interés cultural por grupo"
            />
          )}
        </div>
      </div>
      {bienes.length > 0 && (
        <div className="chart-card tabla-card">
          <div className="card-controls">
            <h3>
              Listado de bienes ({visibles.length} de {bienes.length})
            </h3>
            <input
              className="buscador-tabla"
              type="search"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por nombre, dirección o comuna"
              aria-label="Buscar bienes de interés cultural"
            />
          </div>
          <div className="tabla-scroll">
            <table className="chart-table territorio-zonas">
              <thead>
                <tr>
                  <th>Bien</th>
                  <th>Tipo</th>
                  <th>Dirección</th>
                  <th>Territorio</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((b, i) => (
                  <tr key={i}>
                    <td>{b.nombre}</td>
                    <td>{b.tipo || b.grupo}</td>
                    <td>{b.direccion}</td>
                    <td>{b.territorio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="chart-fuente">Los bienes también están en el gemelo 3D, en la capa Cultura del panel Explorar.</p>
        </div>
      )}
    </section>
  );
}

function Equipamientos({ tema, onSource }) {
  const componentes = tema.listas.equipamientos_por_componente ?? [];
  const clasificacion = tema.listas.sedes_por_clasificacion ?? [];
  const bibliotecas = tema.listas.bibliotecas ?? [];
  const cifras = tarjetas(tema, ['equipamientos', 'sedes_educativas', 'bibliotecas']);
  if (!cifras.length) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="POT · SECRETARÍAS DE EDUCACIÓN Y CULTURA" titulo="Equipamientos" />
      <p className="sec-note">
        Los equipamientos del POT son los edificios y predios de servicios colectivos (educación, salud, deporte, cultura, bienestar). Las sedes
        educativas y las bibliotecas salen de los directorios de cada secretaría, con su propia vigencia.
      </p>
      <Tarjetas cifras={cifras} onSource={onSource} />
      <div className="chart-grid">
        <MapaIndicador
          tema={tema}
          onSource={onSource}
          color={accent.cyan}
          opciones={[
            ['equipamientos_por_10mil', 'Equipamientos'],
            ['sedes_por_10mil', 'Sedes educativas'],
            ['bibliotecas', 'Bibliotecas']
          ]}
        />
        {componentes.length > 0 && (
          <div className="chart-card">
            <h3>Equipamientos del POT por componente</h3>
            <BarChart
              data={componentes.map((c) => ({ label: c.componente, value: c.equipamientos }))}
              color={accent.cyan}
              formatValue={(v) => formato(v)}
              ariaLabel="Equipamientos del POT por componente"
            />
          </div>
        )}
        {clasificacion.length > 0 && (
          <div className="chart-card">
            <h3>Sedes educativas por tipo</h3>
            <BarChart
              data={clasificacion.map((c) => ({ label: c.clasificacion, value: c.sedes }))}
              color={accent.cyan}
              formatValue={(v) => formato(v)}
              ariaLabel="Sedes educativas por tipo"
            />
            <p className="chart-fuente">
              “Principal” es la sede principal de un establecimiento; “Sede”, una sede adicional. Cobertura contratada: colegios privados que atienden
              matrícula oficial.
            </p>
          </div>
        )}
        {bibliotecas.length > 0 && (
          <div className="chart-card tabla-card">
            <h3>Red de Bibliotecas ({bibliotecas.length})</h3>
            <div className="tabla-scroll">
              <table className="chart-table territorio-zonas">
                <thead>
                  <tr>
                    <th>Biblioteca</th>
                    <th>Tipo</th>
                    <th>Territorio</th>
                  </tr>
                </thead>
                <tbody>
                  {bibliotecas.map((b) => (
                    <tr key={b.nombre}>
                      <td>{b.nombre}</td>
                      <td>{b.tipo}</td>
                      <td>{b.territorio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const VERDE = [
  ['ha_espacio_verde', 'Espacio verde (ha)'],
  ['m2_verde_hab', 'Verde (m²/hab.)'],
  ['m2_verde_publico_hab', 'Verde público (m²/hab.)'],
  ['m2_espacio_publico_hab', 'Espacio público (m²/hab.)']
];

function Verde({ tema, onSource }) {
  const territorios = tema.listas.territorios ?? [];
  const ultimo = (t, k) =>
    Object.entries(t.valores[k] ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .at(-1)?.[1];
  const cifras = tarjetas(tema, ['m2_verde_hab', 'm2_verde_publico_hab', 'ha_espacio_verde', 'm2_espacio_publico_hab', 'ha_espacio_publico']);
  if (!cifras.length) return null;
  return (
    <section className="sec-block">
      <Encabezado eyebrow="ÁREA METROPOLITANA · PLANEACIÓN" titulo="Espacio verde y espacio público" />
      <p className="sec-note">
        Dos medidas distintas. El espacio verde urbano es toda superficie con vegetación en el suelo urbano, pública o privada (inventario del Sistema
        Árbol Urbano, 2019). El espacio público efectivo es el de carácter permanente para la recreación y el encuentro: parques, plazas, plazoletas y
        zonas verdes públicas (inventario de Planeación). Ambas se dividen por la población proyectada por el DANE, que no es del mismo año que los
        inventarios.
      </p>
      <Tarjetas cifras={cifras} onSource={onSource} />
      <div className="chart-grid">
        <MapaIndicador
          tema={tema}
          onSource={onSource}
          color={accent.green}
          opciones={[
            ['m2_verde_hab', 'Verde total'],
            ['m2_verde_publico_hab', 'Verde público'],
            ['m2_espacio_publico_hab', 'Espacio público efectivo']
          ]}
        />
        {territorios.length > 0 && (
          <div className="chart-card tabla-card">
            <h3>Por territorio</h3>
            <table className="chart-table territorio-usos">
              <thead>
                <tr>
                  <th>Territorio</th>
                  {VERDE.map(([k, l]) => (
                    <th key={k}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {territorios.map((t) => (
                  <tr key={t.codigo}>
                    <td>{t.nombre}</td>
                    {VERDE.map(([k]) => {
                      const v = ultimo(t, k);
                      return <td key={k}>{v == null ? '—' : formato(v, k.startsWith('ha_') ? 0 : 1)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="chart-fuente">
              Espacio verde: inventario de 2019. Espacio público efectivo: inventario{' '}
              {tema.cifras.ha_espacio_publico?.vigencia.replace('Inventario ', '') ?? ''}. Población: proyección del DANE.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function TerritorioView({ tema, lentes, onSource }) {
  if (!tema)
    return (
      <section className="view">
        <p className="lake-message">El tema de territorio y cultura no está disponible. Genera el lago con la ingesta (ver README).</p>
      </section>
    );
  return (
    <section className="view territorio-view">
      <div className="view-intro">
        <p className="eyebrow">MEDELLÍN · TERRITORIO Y CULTURA</p>
        <h1>
          El suelo, sus reglas <em>y su patrimonio.</em>
        </h1>
        <p>
          Amenazas y zonas de riesgo del POT, usos del suelo y altura normativa, bienes de interés cultural, equipamientos y espacio verde por comuna.
          Cada cifra muestra su fuente, su vigencia y su estado.
        </p>
      </div>
      <Riesgo tema={tema} onSource={onSource} />
      <Norma tema={tema} lentes={lentes} onSource={onSource} />
      <Patrimonio tema={tema} onSource={onSource} />
      <Equipamientos tema={tema} onSource={onSource} />
      <Verde tema={tema} onSource={onSource} />
      <PanelTerritorios
        tema={tema}
        onSource={onSource}
        color={accent.orange}
        titulo="Cada territorio, con su vigencia"
        selector={[
          ['pct_amenaza_alta', 'Amenaza alta (%)'],
          ['construcciones_amenaza_alta', 'Construcciones en amenaza alta'],
          ['construcciones_riesgo_no_mitigable', 'Alto riesgo no mitigable'],
          ['bic', 'Patrimonio'],
          ['equipamientos_por_10mil', 'Equipamientos'],
          ['sedes_por_10mil', 'Sedes educativas'],
          ['m2_verde_hab', 'Espacio verde'],
          ['m2_espacio_publico_hab', 'Espacio público']
        ]}
        ficha={[
          'pct_amenaza_alta',
          'ha_amenaza_alta_masa',
          'ha_amenaza_alta_inundacion',
          'ha_amenaza_alta_torrencial',
          'construcciones_amenaza_alta',
          'ha_riesgo_no_mitigable',
          'construcciones_riesgo_no_mitigable',
          'bic',
          'bibliotecas',
          'sedes_educativas',
          'sedes_oficiales',
          'equipamientos',
          'ha_espacio_verde',
          'm2_verde_hab',
          'm2_verde_publico_hab',
          'm2_espacio_publico_hab'
        ]}
      />
    </section>
  );
}
