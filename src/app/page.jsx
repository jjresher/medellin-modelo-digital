'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import SourcesView from '../components/SourcesView';
import { navigation } from '../data/navegacion';
import { useLago } from '../lib/lago';

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
  twin: ({ lago }) => <DigitalTwinView gemelo={lago.temas.gemelo} lentes={lago.temas.lentes} catalogo={lago.catalogo} />,
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

function LakeStatus({ lago }) {
  if (lago.estado === 'cargando')
    return (
      <div className="sidebar-status">
        <i className="loading" /> CARGANDO LAGO…
      </div>
    );
  if (lago.estado === 'error')
    return (
      <div className="sidebar-status">
        <i className="failed" /> LAGO NO DISPONIBLE
      </div>
    );
  const fechas = lago.orden.map((tema) => lago.temas[tema].probado).sort();
  const rango = fechas[0] === fechas.at(-1) ? fechas[0] : `${fechas[0]} → ${fechas.at(-1)}`;
  return (
    <div className="sidebar-status">
      <i /> LAGO · {lago.orden.length}/{lago.indice.temas.length} TEMAS
      <br />
      <small>PROBADO {rango}</small>
    </div>
  );
}

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
            onClick={() => {
              onNavigate(id);
              onClose();
            }}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
      <LakeStatus lago={lago} />
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

export default function Home() {
  const lago = useLago();
  const [active, setActive] = useState('panorama');
  const [focusSource, setFocusSource] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const current = navigation.find(([id]) => id === active)?.[2] ?? 'Panorama';
  // La sección activa vive en el #hash para poder enlazarla (por ejemplo, /#twin).
  useEffect(() => {
    const fromHash = () => {
      // Sin hash es el Panorama: así el botón atrás vuelve a la portada después de abrir el gemelo desde el diagnóstico.
      const id = window.location.hash.slice(1).split('?')[0] || 'panorama';
      if (navigation.some(([navId]) => navId === id)) setActive(id);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);
  const navigate = (id) => {
    setActive(id);
    if (id !== 'sources') setFocusSource(null);
    window.history.replaceState(null, '', id === 'panorama' ? window.location.pathname : `#${id}`);
  };
  const openSource = (sourceId) => {
    navigate('sources');
    setFocusSource(sourceId);
  };
  const Vista = vistas[active];
  return (
    <div className="app-shell">
      <Sidebar active={active} onNavigate={navigate} isOpen={menuOpen} onClose={() => setMenuOpen(false)} lago={lago} />
      <main className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
            ☰
          </button>
          <div>
            MODELO DIGITAL <span>/</span> <strong>{current}</strong>
          </div>
          <button className="source-shortcut" onClick={() => navigate('sources')}>
            Fuentes <span>↗</span>
          </button>
        </header>
        {active === 'panorama' && <PanoramaView lago={lago} onSource={openSource} onTwin={() => navigate('twin')} />}
        {Vista && <Vista lago={lago} onSource={openSource} focusId={focusSource} />}
        {active !== 'panorama' && !Vista && <ComingSoon label={current} />}
      </main>
    </div>
  );
}
