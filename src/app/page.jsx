'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Buscador from '../components/shell/Buscador';
import EstadoLago from '../components/shell/EstadoLago';
import Presentacion from '../components/shell/Presentacion';
import RelojClima from '../components/shell/RelojClima';
import SourcesView from '../components/SourcesView';
import { navigation } from '../data/navegacion';
import { consultaGemelo } from '../lib/buscador';
import { formatoUnidad, formatoValor, useLago } from '../lib/lago';
import { fuenteDe, hashDe, leerRuta, tituloDe } from '../lib/ruta';

const PanoramaView = dynamic(() => import('../components/PanoramaView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando el panorama…</div>
});
const DigitalTwinView = dynamic(() => import('../components/DigitalTwinView'), {
  ssr: false,
  loading: () => <div className="view-loading">Preparando el gemelo 3D…</div>
});
const SeguridadView = dynamic(() => import('../components/SeguridadView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando seguridad…</div>
});
const AmbienteView = dynamic(() => import('../components/AmbienteView'), {
  ssr: false,
  loading: () => <div className="view-loading">Leyendo el SIATA…</div>
});
const GenteView = dynamic(() => import('../components/GenteView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando gente…</div>
});
const EconomiaView = dynamic(() => import('../components/EconomiaView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando economía…</div>
});
const TurismoView = dynamic(() => import('../components/TurismoView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando turismo…</div>
});
const MunicipioView = dynamic(() => import('../components/MunicipioView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando municipio…</div>
});
const ServiciosView = dynamic(() => import('../components/ServiciosView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando servicios públicos…</div>
});
const AtlasView = dynamic(() => import('../components/AtlasView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando el atlas…</div>
});
const CorrelacionesView = dynamic(() => import('../components/CorrelacionesView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando las correlaciones…</div>
});
const EscuchaView = dynamic(() => import('../components/EscuchaView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando la escucha social…</div>
});
const TerritorioView = dynamic(() => import('../components/TerritorioView'), {
  ssr: false,
  loading: () => <div className="view-loading">Cargando territorio y cultura…</div>
});

// Cada sección implementada recibe del lago el tema (o temas) que necesita. Las que no están aquí muestran "en preparación".
const vistas = {
  // La clave monta otro gemelo cuando cambia la vista pedida (un lugar del buscador, el botón atrás): el mapa lee la
  // cámara y las capas del hash solo al montarse.
  twin: ({ lago, ruta }) => <DigitalTwinView key={ruta.query} gemelo={lago.temas.gemelo} lentes={lago.temas.lentes} catalogo={lago.catalogo} />,
  people: ({ lago, onSource }) => <GenteView tema={lago.temas.demografia} onSource={onSource} />,
  economy: ({ lago, onSource }) => <EconomiaView tema={lago.temas.economia} onSource={onSource} />,
  tourism: ({ lago, onSource }) => <TurismoView tema={lago.temas.turismo} onSource={onSource} />,
  municipality: ({ lago, onSource }) => <MunicipioView tema={lago.temas.municipio} onSource={onSource} />,
  services: ({ lago, onSource }) => <ServiciosView tema={lago.temas.servicios} onSource={onSource} />,
  atlas: ({ lago, onSource }) => <AtlasView lago={lago} onSource={onSource} />,
  correlations: ({ lago, onSource }) => <CorrelacionesView lago={lago} onSource={onSource} />,
  culture: ({ lago, onSource }) => <TerritorioView tema={lago.temas.territorio} lentes={lago.temas.lentes} onSource={onSource} />,
  safety: ({ lago, onSource }) => <SeguridadView tema={lago.temas.seguridad} onSource={onSource} />,
  environment: ({ lago, onSource }) => <AmbienteView tema={lago.temas.ambiente} onSource={onSource} />,
  social: ({ lago, onSource }) => <EscuchaView tema={lago.temas.escucha} onSource={onSource} />,
  // La clave remonta la vista al pedir otra fuente: entra sin filtros, así la fila elegida siempre está a la vista.
  sources: ({ lago, focusId }) => <SourcesView key={focusId ?? 'todas'} lago={lago} focusId={focusId} />
};

// La ruta es el hash de la dirección. Next.js integra pushState/replaceState a su router y guarda su propio estado en
// cada entrada del historial; un cambio hecho aquí avisa con este evento, y el atrás y adelante del navegador con popstate.
const CAMBIO_RUTA = 'modelo:ruta';
function suscribirRuta(avisar) {
  window.addEventListener('popstate', avisar);
  window.addEventListener('hashchange', avisar);
  window.addEventListener(CAMBIO_RUTA, avisar);
  return () => {
    window.removeEventListener('popstate', avisar);
    window.removeEventListener('hashchange', avisar);
    window.removeEventListener(CAMBIO_RUTA, avisar);
  };
}
const hashActual = () => window.location.hash;
const sinHash = () => '';

// "⌘K" en un Mac o un iPad y "Ctrl K" en lo demás; en el servidor no se sabe y se dice "Ctrl K".
const sinSuscripcion = () => () => {};
const esMac = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
const noEsMac = () => false;

function Sidebar({ active, onNavigate, isOpen, onClose, lago }) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <span>M</span> MEDELLÍN
      </div>
      <p className="sidebar-label">MODELO DIGITAL</p>
      <button className="close-menu" onClick={onClose} aria-label="Cerrar menú">
        ×
      </button>
      <nav aria-label="Módulos del modelo">
        {navigation.map(([id, icon, label]) => (
          <button
            key={id}
            className={`nav-item ${active === id ? 'active' : ''}`}
            aria-current={active === id ? 'page' : undefined}
            onClick={() => {
              onNavigate(id);
              onClose();
            }}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
      <EstadoLago
        lago={lago}
        onNavigate={(id) => {
          onNavigate(id);
          onClose();
        }}
      />
    </aside>
  );
}

function ComingSoon({ label }) {
  return (
    <section className="view upcoming-view">
      <p className="eyebrow">MÓDULO EN PREPARACIÓN</p>
      <h1>{label}</h1>
      <p>Este espacio se integrará al modelo digital en una siguiente entrega.</p>
    </section>
  );
}

// Baja hasta la tarjeta de una cifra elegida en el buscador y la resalta. La sección puede tardar en cargar: se busca la
// tarjeta durante unos segundos. Si la sección no la muestra en una tarjeta (la cifra titula una gráfica o está detrás
// de un selector), se queda arriba de la sección y avisa con la cifra, su vigencia y su estado.
function resaltarCifra(cifra, temporizador, onSinTarjeta) {
  let intentos = 0;
  const buscar = () => {
    const tarjeta = document.querySelector(`[data-cifra="${cifra.tema}/${cifra.clave}"]`);
    if (tarjeta) {
      tarjeta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tarjeta.focus({ preventScroll: true });
      tarjeta.classList.add('resaltada');
      temporizador.current = window.setTimeout(() => tarjeta.classList.remove('resaltada'), 2600);
    } else if (++intentos < 40) temporizador.current = window.setTimeout(buscar, 100);
    else onSinTarjeta(cifra);
  };
  buscar();
}

function AvisoCifra({ cifra, onCerrar }) {
  const unidad = formatoUnidad(cifra);
  return (
    <div className="aviso-cifra" role="status">
      <p>
        <strong>
          {cifra.etiqueta}: {formatoValor(cifra)}
          {unidad && ` ${unidad}`}
        </strong>{' '}
        ({cifra.vigencia} · <span className={`estado ${cifra.estado}`}>{cifra.estado}</span>). {cifra.nombreSeccion} no muestra esta cifra en una
        tarjeta: está en una gráfica, detrás de un selector o en el mapa.
      </p>
      <button onClick={onCerrar} aria-label="Cerrar aviso">
        ×
      </button>
    </div>
  );
}

export default function Home() {
  const lago = useLago();
  const hash = useSyncExternalStore(suscribirRuta, hashActual, sinHash);
  const ruta = useMemo(() => leerRuta(hash), [hash]);
  const mac = useSyncExternalStore(sinSuscripcion, esMac, noEsMac);
  const [menuOpen, setMenuOpen] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [presentando, setPresentando] = useState(false);
  const [sinTarjeta, setSinTarjeta] = useState(null);
  const main = useRef(null);
  const resaltado = useRef(null);
  const active = ruta.id;
  const current = navigation.find(([id]) => id === active)?.[2] ?? 'Panorama';

  // Cada sección es una entrada del historial: el botón atrás vuelve a la anterior, a la altura donde se dejó.
  // `replace` (modo presentación) cambia de sección sin llenar el historial.
  const navigate = useCallback((id, { query = '', replace = false } = {}) => {
    window.clearTimeout(resaltado.current);
    setSinTarjeta(null);
    const destino = hashDe(id, query);
    if (destino !== window.location.hash) {
      const url = destino || window.location.pathname;
      if (replace) window.history.replaceState(null, '', url);
      else {
        // La altura se guarda en la entrada que se deja, junto al estado de Next (sin él, Next recargaría la página al
        // volver). Una entrada que no es de Next (un hash escrito a mano) se queda sin altura guardada.
        if (window.history.state?.__NA) window.history.replaceState({ ...window.history.state, scroll: window.scrollY }, '');
        window.history.pushState(null, '', url);
      }
      window.dispatchEvent(new Event(CAMBIO_RUTA));
    }
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, []);
  const openSource = useCallback((sourceId) => navigate('sources', { query: `fuente=${encodeURIComponent(sourceId)}` }), [navigate]);

  // Al volver con atrás o adelante, se espera a que la sección cargue para bajar hasta la altura guardada.
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    let espera;
    const alVolver = (e) => {
      window.clearTimeout(espera);
      const y = e.state?.scroll ?? 0;
      let intentos = 0;
      const restaurar = () => {
        const cargada = !document.querySelector('main .view-loading') && document.documentElement.scrollHeight - window.innerHeight >= y;
        if (cargada || ++intentos > 40) window.scrollTo(0, y);
        else espera = window.setTimeout(restaurar, 100);
      };
      espera = window.setTimeout(restaurar, 50);
    };
    window.addEventListener('popstate', alVolver);
    return () => {
      window.removeEventListener('popstate', alVolver);
      window.clearTimeout(espera);
    };
  }, []);

  useEffect(() => {
    document.title = tituloDe(active);
  }, [active]);

  // El aviso de una cifra sin tarjeta se va solo; también al cambiar de sección o con su botón.
  useEffect(() => {
    if (!sinTarjeta) return undefined;
    const id = window.setTimeout(() => setSinTarjeta(null), 12000);
    return () => window.clearTimeout(id);
  }, [sinTarjeta]);

  // ⌘K / Ctrl+K abre y cierra el buscador desde cualquier sección.
  useEffect(() => {
    const tecla = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscando((v) => !v);
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const elegir = (resultado) => {
    setBuscando(false);
    if (resultado.tipo === 'seccion') navigate(resultado.id);
    else if (resultado.tipo === 'cifra') {
      navigate(resultado.seccion);
      resaltarCifra(resultado, resaltado, setSinTarjeta);
    } else navigate('twin', { query: consultaGemelo(resultado) });
  };
  const saltarAlContenido = () => {
    const vista = main.current?.querySelector('.view') ?? main.current;
    vista.setAttribute('tabindex', '-1');
    vista.focus();
  };
  const fuenteClima = lago.catalogo?.datasets.find((d) => d.id === 'open-meteo');
  const Vista = vistas[active];
  return (
    <div className={`app-shell ${presentando ? 'presentando' : ''}`}>
      <button className="saltar" onClick={saltarAlContenido}>
        Saltar al contenido
      </button>
      <Sidebar active={active} onNavigate={navigate} isOpen={menuOpen} onClose={() => setMenuOpen(false)} lago={lago} />
      <main className="workspace" ref={main} tabIndex={-1}>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            ☰
          </button>
          <div className="topbar-ruta">
            <span className="topbar-modelo">MODELO DIGITAL</span>
            <span className="topbar-sep">/</span> <strong>{current}</strong>
          </div>
          <div className="topbar-acciones">
            <button
              className="topbar-buscar"
              onClick={() => setBuscando(true)}
              aria-label="Buscar secciones, cifras y lugares"
              aria-keyshortcuts="Control+K Meta+K"
              title={`Buscar secciones, cifras y lugares (${mac ? '⌘K' : 'Ctrl+K'})`}
            >
              <span aria-hidden="true">⌕</span>
              <b>Buscar</b>
              <kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
            </button>
            <RelojClima fuente={fuenteClima} onSource={openSource} onNavigate={navigate} />
            <button
              className="topbar-presentar"
              onClick={() => setPresentando(true)}
              aria-label="Modo presentación"
              title="Modo presentación: recorre las secciones a pantalla completa"
            >
              <span aria-hidden="true">▶</span>
              <b>Presentar</b>
            </button>
            <button className="source-shortcut" onClick={() => navigate('sources')}>
              Fuentes <span>↗</span>
            </button>
          </div>
        </header>
        {active === 'panorama' && <PanoramaView lago={lago} onSource={openSource} onTwin={(query = '') => navigate('twin', { query })} />}
        {Vista && <Vista lago={lago} ruta={ruta} onSource={openSource} focusId={fuenteDe(ruta)} />}
        {active !== 'panorama' && !Vista && <ComingSoon label={current} />}
      </main>
      {sinTarjeta && <AvisoCifra cifra={sinTarjeta} onCerrar={() => setSinTarjeta(null)} />}
      {buscando && <Buscador lago={lago} onCerrar={() => setBuscando(false)} onElegir={elegir} />}
      {presentando && <Presentacion activo={active} onIr={(id) => navigate(id, { replace: true })} onSalir={() => setPresentando(false)} />}
    </div>
  );
}
