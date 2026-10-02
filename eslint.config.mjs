import coreWebVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';

const config = [
  ...coreWebVitals,
  {
    // `no-undef` no viene en la configuración de Next: sin ella, usar un nombre que no se importó (por ejemplo, tras
    // mover código a otro archivo) solo falla al ejecutarse.
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }] }
  },
  { ignores: ['.next/**', '.cache/**', '.venv/**', '.herramientas/**', 'node_modules/**', 'public/**', 'datos/**', 'next.config.mjs'] }
];

export default config;
