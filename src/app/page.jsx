'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import MetricCard from '../components/MetricCard';
import SourcesView from '../components/SourcesView';
import { metrics, navigation, sources } from '../data/urbanData';

const DigitalTwinView = dynamic(() => import('../components/DigitalTwinView'), { ssr: false, loading: () => <div className="view-loading">Preparando el gemelo 3D…</div> });
const implemented = new Set(['panorama', 'twin', 'sources']);

function Sidebar({ active, onNavigate, isOpen, onClose }) {
  return <aside className={`sidebar ${isOpen ? 'open' : ''}`}><div className="sidebar-brand"><span>M</span> MEDELLÍN</div><p className="sidebar-label">MODELO DIGITAL</p><button className="close-menu" onClick={onClose} aria-label="Cerrar menú">×</button><nav aria-label="Módulos del modelo">{navigation.map(([id, icon, label]) => <button key={id} className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => { onNavigate(id); onClose(); }}><span>{icon}</span>{label}</button>)}</nav><div className="sidebar-status"><i /> CORTE DOCUMENTADO<br /><small>DATOS 2023—2025</small></div></aside>;
}

function Panorama({ onSource, onTwin }) {
  return <section className="view panorama-view"><div className="hero"><div><p className="eyebrow">MODELO DIGITAL · MEDELLÍN</p><h1>La ciudad,<br /><em>en perspectiva.</em></h1><p>Indicadores urbanos verificables y una lectura espacial de Medellín para explorar el territorio con contexto.</p></div><button className="primary-action" onClick={onTwin}>Explorar gemelo 3D <span>→</span></button></div><div className="section-heading"><div><p className="eyebrow">CORTE VERIFICABLE</p><h2>Medellín en cifras</h2></div><span>2024—2025</span></div><div className="metrics-grid">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} onSource={onSource} />)}</div><section className="method-note"><span>01</span><div><b>Lectura responsable</b><p>Las métricas conservan su período de referencia y enlazan directamente a sus fuentes oficiales. Las cifras de series distintas no deben interpretarse como una misma actualización temporal.</p></div></section></section>;
}

function ComingSoon({ label }) {
  return <section className="view upcoming-view"><p className="eyebrow">MÓDULO EN PREPARACIÓN</p><h1>{label}</h1><p>Este espacio se integrará al modelo digital en una siguiente entrega.</p></section>;
}

export default function Home() {
  const [active, setActive] = useState('panorama');
  const [focusSource, setFocusSource] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const current = navigation.find(([id]) => id === active)?.[2] ?? 'Panorama';
  const navigate = (id) => { setActive(id); if (id !== 'sources') setFocusSource(null); };
  const openSource = (sourceId) => { setFocusSource(sourceId); setActive('sources'); };
  return <div className="app-shell"><Sidebar active={active} onNavigate={navigate} isOpen={menuOpen} onClose={() => setMenuOpen(false)} /><main className="workspace"><header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menú">☰</button><div>MODELO DIGITAL <span>/</span> <strong>{current}</strong></div><button className="source-shortcut" onClick={() => navigate('sources')}>Fuentes <span>↗</span></button></header>{active === 'panorama' && <Panorama onSource={openSource} onTwin={() => navigate('twin')} />}{active === 'twin' && <DigitalTwinView />}{active === 'sources' && <SourcesView focusId={focusSource} />}{!implemented.has(active) && <ComingSoon label={current} />}</main></div>;
}
