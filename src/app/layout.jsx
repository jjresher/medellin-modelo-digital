import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

export const metadata = {
  title: 'Medellín · Modelo Digital',
  description: 'Métricas urbanas y gemelo digital explorables de Medellín.'
};

export default function RootLayout({ children }) {
  return <html lang="es"><body>{children}</body></html>;
}
