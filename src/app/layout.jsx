import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

export const metadata = {
  title: 'Medellín · Modelo Digital',
  description: 'Métricas urbanas y gemelo digital explorables de Medellín.'
};

// Barra del navegador del color de fondo y controles nativos (selectores, barras de desplazamiento) en oscuro.
export const viewport = {
  themeColor: '#272822',
  colorScheme: 'dark'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
