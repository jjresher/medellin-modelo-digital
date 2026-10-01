import coreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...coreWebVitals,
  { rules: { 'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }] } },
  { ignores: ['.next/**', '.cache/**', '.venv/**', '.herramientas/**', 'node_modules/**', 'public/**', 'datos/**', 'next.config.mjs'] }
];

export default config;
