// Prueba de humo visual de todas las secciones en un Chrome sin ventana (protocolo DevTools, sin dependencias).
// Abre cada sección, hace clic en sus controles uno por uno y avisa de: errores de consola, peticiones fallidas, desborde
// horizontal, textos rotos ("undefined", "NaN"), rejillas con huecos o tarjetas desniveladas, textos cortados, tablas con
// desplazamiento y tarjetas con mucho espacio vacío. Deja una captura por sección en .cache/qa/.
//
//   npm run build && npm start            (en otra terminal)
//   npm run qa                            escritorio (1400 px), todas las secciones
//   npm run qa -- 390                     celular
//   npm run qa -- 1400 atlas,services     solo algunas secciones
//   QA_URL=http://localhost:3111 npm run qa
//
// Necesita google-chrome en el PATH. No reemplaza mirar las capturas: un hallazgo es una pista, no un veredicto.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [w = '1400', lista = ''] = process.argv.slice(2);
const BASE = process.env.QA_URL ?? 'http://localhost:3000';
const SALIDA = '.cache/qa';
mkdirSync(SALIDA, { recursive: true });
const SECCIONES = lista
  ? lista.split(',')
  : [
      'panorama',
      'twin',
      'people',
      'economy',
      'tourism',
      'municipality',
      'services',
      'safety',
      'culture',
      'correlations',
      'atlas',
      'environment',
      'social',
      'sources'
    ];
const port = 9300 + Math.floor(Math.random() * 500);
// Perfil temporal de Chrome, fuera del proyecto.
const perfil = mkdtempSync(join(tmpdir(), 'qa-chrome-'));
const chrome = spawn(
  'google-chrome',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${perfil}`,
    `--window-size=${w},1200`,
    'about:blank'
  ],
  { stdio: 'ignore' }
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250);
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
let logs = [];
const urls = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) {
    pend.get(m.id)(m.result ?? m);
    pend.delete(m.id);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown')
    logs.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
  else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
    logs.push(
      m.params.type.toUpperCase() +
        ' ' +
        m.params.args
          .map((a) => a.value ?? a.description)
          .join(' ')
          .slice(0, 260)
    );
  else if (m.method === 'Network.requestWillBeSent') urls.set(m.params.requestId, m.params.request.url);
  else if (m.method === 'Network.responseReceived' && m.params.response.status >= 400)
    logs.push(`HTTP ${m.params.response.status} ${m.params.response.url.slice(0, 160)}`);
  else if (m.method === 'Network.loadingFailed' && !m.params.canceled)
    logs.push(`RED ${m.params.errorText} ${(urls.get(m.params.requestId) ?? '').slice(0, 160)}`);
};
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id;
    pend.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) return 'EVAL-ERR ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result?.value;
};
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: 1200, deviceScaleFactor: 1, mobile: +w < 600 });

const REVISAR = `(() => {
  const vista = document.querySelector('main .view') ?? document.querySelector('main');
  const out = { desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth, texto: [], huecos: [], desnivel: [], cortados: [], vacias: [] };
  const txt = vista.innerText;
  for (const malo of ['undefined', 'NaN', '[object', 'Invalid Date', 'null ', ' null']) { const i = txt.indexOf(malo); if (i >= 0) out.texto.push(malo.trim() + ' → …' + txt.slice(Math.max(0, i - 50), i + 30).replace(/\\n/g, ' ') + '…'); }
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const nombre = (e) => (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).join('.') : e.tagName.toLowerCase());
  for (const g of vista.querySelectorAll('.metrics-grid, .chart-grid, .sisc-grid, .atlas-fichas, .source-list, .avisos-grid, .par-resumen, .par-metricas')) {
    if (!visible(g)) continue;
    const hijos = [...g.children].filter(visible);
    if (!hijos.length) continue;
    const cs = getComputedStyle(g); const gr = g.getBoundingClientRect();
    const izq = gr.left + parseFloat(cs.paddingLeft), der = gr.right - parseFloat(cs.paddingRight);
    const filas = [];
    for (const h of hijos) { const r = h.getBoundingClientRect(); let f = filas.find((x) => Math.abs(x.top - r.top) < 30 || (r.top < x.bottom - 4 && r.bottom > x.top + 4)); if (!f) { f = { top: r.top, bottom: r.bottom, items: [] }; filas.push(f); } f.items.push(r); f.bottom = Math.max(f.bottom, r.bottom); }
    filas.forEach((f, i) => {
      const l = Math.min(...f.items.map((r) => r.left)), r = Math.max(...f.items.map((r) => r.right));
      const centrada = Math.abs((l - izq) - (der - r)) < 3;
      if ((der - r > 12 || l - izq > 12) && !centrada) out.huecos.push(nombre(g) + ' fila ' + (i + 1) + '/' + filas.length + ': ' + f.items.length + ' tarjetas, sobra ' + Math.round(der - r) + 'px a la derecha');
      const tops = f.items.map((r) => Math.round(r.top)), alt = f.items.map((r) => Math.round(r.height));
      if (Math.max(...tops) - Math.min(...tops) > 2 || Math.max(...alt) - Math.min(...alt) > 2) out.desnivel.push(nombre(g) + ' fila ' + (i + 1) + ': tops ' + tops.join('/') + ' altos ' + alt.join('/'));
    });
  }
  for (const e of vista.querySelectorAll('*')) {
    if (!visible(e) || e.children.length > 2) continue;
    const cs = getComputedStyle(e);
    if (e.scrollWidth > e.clientWidth + 1 && (cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden') && e.innerText?.trim() && !e.closest('.maplibregl-map')) out.cortados.push(nombre(e) + ': ' + e.innerText.trim().slice(0, 50));
  }
  // Tarjetas con mucho espacio vacío por dentro: el último hijo termina muy por encima del borde inferior.
  for (const c of vista.querySelectorAll('.chart-card, .metric-card')) {
    if (!visible(c) || !c.children.length) continue;
    const r = c.getBoundingClientRect(); const fin = Math.max(...[...c.children].filter(visible).map((h) => h.getBoundingClientRect().bottom));
    if (r.bottom - fin > 90) out.vacias.push((c.querySelector('h3, .metric-label')?.innerText ?? nombre(c)).slice(0, 50) + ': ' + Math.round(r.bottom - fin) + 'px vacíos');
  }
  out.scroll = [];
  for (const e of vista.querySelectorAll('.chart-card, .tabla-scroll, .tabla-card, .matriz-scroll')) {
    if (!visible(e)) continue;
    const cs = getComputedStyle(e);
    if (['auto', 'scroll'].includes(cs.overflowX) && e.scrollWidth > e.clientWidth + 2) out.scroll.push((e.querySelector('h3')?.innerText ?? nombre(e)).slice(0, 50) + ': ' + e.scrollWidth + '/' + e.clientWidth);
  }
  out.scroll = [...new Set(out.scroll)];
  out.salidos = [];
  for (const c of vista.querySelectorAll('.chart-card, .metric-card')) {
    if (!visible(c)) continue;
    const cs = getComputedStyle(c); if (cs.overflowX !== 'visible') continue;
    const r = c.getBoundingClientRect();
    // Lo que está dentro de un contenedor con desplazamiento propio (una matriz ancha en el celular) no se sale: se desplaza.
    const recortado = (h) => { for (let p = h.parentElement; p && p !== c; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true; return false; };
    const fuera = [...c.querySelectorAll('*')].find((h) => visible(h) && !h.closest('.maplibregl-map, .chart-tooltip') && h.getBoundingClientRect().right > r.right + 2 && !recortado(h));
    if (fuera) out.salidos.push((c.querySelector('h3, .metric-label')?.innerText ?? nombre(c)).slice(0, 40) + ' ← ' + nombre(fuera).slice(0, 40));
  }
  out.cortados = [...new Set(out.cortados)].slice(0, 12);
  return JSON.stringify(out);
})()`;

// Controles que cambian la vista sin salir de la sección (los del propio MapLibre, como pantalla completa, exigen un
// gesto real del usuario y se dejan fuera).
const CONTROLES = `(() => {
  const vista = document.querySelector('main .view');
  const lista = [...vista.querySelectorAll('.chips button, .table-toggle, button.link-fuente, .twin-shell button')].filter((b) => !b.textContent.includes('↗') && b.offsetParent && !b.closest('.maplibregl-ctrl'));
  window.__qa = lista; return lista.map((b) => b.textContent.trim().slice(0, 30));
})()`;

const informe = {};
for (const sec of SECCIONES) {
  logs = [];
  await send('Page.navigate', { url: 'about:blank' });
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: 1200, deviceScaleFactor: 1, mobile: +w < 600 });
  await send('Page.navigate', { url: `${BASE}/${sec === 'panorama' ? '' : '#' + sec}` });
  await sleep(['environment', 'twin'].includes(sec) ? 14000 : 7000);
  const r = { inicio: JSON.parse(await ev(REVISAR)) };
  const alto = await ev('document.documentElement.scrollHeight');
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: Math.min(alto, 15000), deviceScaleFactor: 1, mobile: +w < 600 });
  await sleep(2500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${SALIDA}/${sec}-${w}.png`, Buffer.from(shot.data, 'base64'));
  r.alto = alto;
  // Clic en cada control, uno por uno, y revisión después de cada clic.
  const controles = await ev(CONTROLES);
  r.controles = controles.length;
  r.trasClic = [];
  for (let i = 0; i < controles.length; i++) {
    const antes = logs.length;
    const ok = await ev(`(() => { const b = window.__qa[${i}]; if (!b || !b.isConnected) return 'desconectado'; b.click(); return 'ok'; })()`);
    await sleep(350);
    const rev = JSON.parse(await ev(REVISAR));
    const problemas = [...rev.texto, ...(rev.desborde > 0 ? ['desborde ' + rev.desborde] : []), ...rev.huecos, ...rev.desnivel, ...logs.slice(antes)];
    const nuevos = problemas.filter((p) => ![...r.inicio.texto, ...r.inicio.huecos, ...r.inicio.desnivel].includes(p));
    if (nuevos.length) r.trasClic.push({ control: controles[i], estado: ok, problemas: nuevos.slice(0, 6) });
  }
  r.logs = [...new Set(logs)].slice(0, 15);
  informe[sec] = r;
  const i0 = r.inicio;
  console.log(`\n=== ${sec} @${w} · alto ${alto}px · ${controles.length} controles`);
  if (i0.desborde > 0) console.log('  DESBORDE horizontal', i0.desborde);
  for (const k of ['texto', 'huecos', 'desnivel', 'cortados', 'scroll', 'salidos', 'vacias'])
    if (i0[k].length) console.log(`  ${k}:`, i0[k].join('\n      '));
  if (r.trasClic.length) console.log('  tras clic:', JSON.stringify(r.trasClic, null, 1).slice(0, 1800));
  if (r.logs.length) console.log('  logs:', r.logs.join('\n      '));
  if (!i0.desborde && !['texto', 'huecos', 'desnivel', 'cortados', 'vacias'].some((k) => i0[k].length) && !r.trasClic.length && !r.logs.length)
    console.log('  sin hallazgos');
}
writeFileSync(`${SALIDA}/informe-${w}.json`, JSON.stringify(informe, null, 1));
ws.close();
chrome.kill();
try {
  rmSync(perfil, { recursive: true, force: true });
} catch {
  /* Chrome aún está cerrando: el sistema limpia su carpeta temporal */
}
const fallas = Object.values(informe).some(
  (r) =>
    r.logs.some((l) => /^(EXC|ERROR|HTTP|RED)/.test(l)) ||
    r.inicio.texto.length ||
    r.inicio.desborde > 0 ||
    r.inicio.huecos.length ||
    r.inicio.desnivel.length ||
    r.inicio.salidos.length
);
process.exit(fallas ? 1 : 0);
