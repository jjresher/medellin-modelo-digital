'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import MetricCard from '../components/MetricCard';
import SourcesView from '../components/SourcesView';
import { navigation } from '../data/navegacion';
import { cifrasAncla, useLago } from '../lib/lago';

const DigitalTwinView = dynamic(() => import('../components/DigitalTwinView'), { ssr: false, loading: () => <div className="view-loading">Preparando el gemelo 3D…</div> });
const SeguridadView = dynamic(() => import('../components/SeguridadView'), { ssr: false, loading: () => <div className="view-loading">Cargando seguridad…</div> });
const AmbienteView = dynamic(() => import('../components/AmbienteView'), { ssr: false, loading: () => <div className="view-loading">Leyendo el SIATA…</div> });
const GenteView = dynamic(() => import('../components/GenteView'), { ssr: false, loading: () => <div className="view-loading">Cargando gente…</div> });
const implemented = new Set(['panorama', 'twin', 'sources', 'safety', 'environment', 'people']);

function LakeStatus({ lago }) {
  if (lago.estado === 'cargando') return <div className="sidebar-status"><i className="loading" /> CARGANDO LAGO…</div>;
  if (lago.estado === 'error') return <div className="sidebar-status"><i className="failed" /> LAGO NO DISPONIBLE</div>;
  const fechas = lago.orden.map((tema) => lago.temas[tema].probado).sort();
  const rango = fechas[0] === fechas.at(-1) ? fechas[0] : `${fechas[0]} → ${fechas.at(-1)}`;
  return <div className="sidebar-status"><i /> LAGO · {lago.orden.length}/{lago.indice.temas.length} TEMAS<br /><small>PROBADO {rango}</small></div>;
}

function Sidebar({ active, onNavigate, isOpen, onClose, lago }) {
  return <aside className={`sidebar ${isOpen ? 'open' : ''}`}><div className="sidebar-brand"><span>M</span> MEDELLÍN</div><p className="sidebar-label">MODELO DIGITAL</p><button className="close-menu" onClick={onClose} aria-label="Cerrar menú">×</button><nav aria-label="Módulos del modelo">{navigation.map(([id, icon, label]) => <button key={id} className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => { onNavigate(id); onClose(); }}><span>{icon}</span>{label}</button>)}</nav><LakeStatus lago={lago} /></aside>;
}

function Panorama({ lago, onSource, onTwin }) {
  const cifras = lago.estado === 'listo' ? cifrasAncla(lago) : [];
  const anios = cifras.map((cifra) => cifra.vigencia.match(/\d{4}/)?.[0]).filter(Boolean).sort();
  return <section className="view panorama-view"><div className="hero"><div><p className="eyebrow">MODELO DIGITAL · MEDELLÍN</p><h1>La ciudad,<br /><em>en perspectiva.</em></h1><p>Indicadores urbanos verificables y una lectura espacial de Medellín para explorar el territorio con contexto.</p></div><button className="primary-action" onClick={onTwin}>Explorar gemelo 3D <span>→</span></button></div><div className="section-heading"><div><p className="eyebrow">CORTE VERIFICABLE</p><h2>Medellín en cifras</h2></div>{anios.length > 0 && <span>{anios[0] === anios.at(-1) ? anios[0] : `${anios[0]}—${anios.at(-1)}`}</span>}</div>{lago.estado === 'cargando' && <p className="lake-message">Cargando el lago de datos…</p>}{lago.estado === 'error' && <p className="lake-message">No se pudo leer el lago de datos ({lago.error}). Genera el lago con la ingesta (ver README).</p>}<div className="metrics-grid">{cifras.map((cifra) => <MetricCard key={`${cifra.tema}-${cifra.clave}`} cifra={cifra} onSource={onSource} />)}</div><section className="method-note"><span>01</span><div><b>Lectura responsable</b><p>Cada cifra conserva su vigencia real y su estado: <span className="estado observado">observado</span> es un dato abierto descargado; <span className="estado derivado">derivado</span> se calcula a partir de otros datos. Las cifras de series distintas no deben interpretarse como una misma actualización temporal.</p></div></section></section>;
}

function ComingSoon({ label }) {
  return <section className="view upcoming-view"><p className="eyebrow">MÓDULO EN PREPARACIÓN</p><h1>{label}</h1><p>Este espacio se integrará al modelo digital en una siguiente entrega.</p></section>;
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
      const id = window.location.hash.slice(1).split('?')[0];
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
  const openSource = (sourceId) => { navigate('sources'); setFocusSource(sourceId); };
  return <div className="app-shell"><Sidebar active={active} onNavigate={navigate} isOpen={menuOpen} onClose={() => setMenuOpen(false)} lago={lago} /><main className="workspace"><header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">☰</button><div>MODELO DIGITAL <span>/</span> <strong>{current}</strong></div><button className="source-shortcut" onClick={() => navigate('sources')}>Fuentes <span>↗</span></button></header>{active === 'panorama' && <Panorama lago={lago} onSource={openSource} onTwin={() => navigate('twin')} />}{active === 'twin' && <DigitalTwinView gemelo={lago.temas.gemelo} lentes={lago.temas.lentes} catalogo={lago.catalogo} />}{active === 'people' && <GenteView tema={lago.temas.demografia} onSource={openSource} />}{active === 'safety' && <SeguridadView tema={lago.temas.seguridad} onSource={openSource} />}{active === 'environment' && <AmbienteView tema={lago.temas.ambiente} onSource={openSource} />}{active === 'sources' && <SourcesView catalogo={lago.catalogo} focusId={focusSource} />}{!implemented.has(active) && <ComingSoon label={current} />}</main></div>;
}
