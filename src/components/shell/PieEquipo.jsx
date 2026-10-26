import { equipo } from '../../data/equipo';

// Pie de cada sección: quién hace el sistema, para qué curso y dónde está el código.
export default function PieEquipo() {
  return (
    <footer className="pie-equipo">
      <p>
        Hecho por <strong>{equipo.integrantes.join(' y ')}</strong> · {equipo.curso}
      </p>
      <p>
        <a href={equipo.repositorio} target="_blank" rel="noreferrer">
          Código y scripts de ingesta ↗
        </a>
      </p>
    </footer>
  );
}
