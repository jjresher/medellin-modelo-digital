// Captura de pantalla con espera real (protocolo DevTools, sin dependencias): sirve para páginas que arman todo por websocket,
// como Streamlit, donde --screenshot con tiempo virtual solo alcanza a ver el esqueleto.
//   node exploracion/captura.mjs <url> <salida.png> [ancho=1400] [alto=1100] [espera_ms=15000]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [url, salida, ancho = '1400', alto = '1100', espera = '15000'] = process.argv.slice(2);
const puerto = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${puerto}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cap-'))}`, `--window-size=${ancho},${alto}`, 'about:blank'], { stdio: 'ignore' });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let blanco;
for (let i = 0; i < 40 && !blanco; i++) {
  await dormir(250);
  try { blanco = (await (await fetch(`http://127.0.0.1:${puerto}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(blanco.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let n = 0;
const pendientes = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m.result); pendientes.delete(m.id); } };
const enviar = (method, params = {}) => new Promise((r) => { pendientes.set(++n, r); ws.send(JSON.stringify({ id: n, method, params })); });
await enviar('Page.enable');
await enviar('Emulation.setDeviceMetricsOverride', { width: +ancho, height: +alto, deviceScaleFactor: 1, mobile: +ancho < 600 });
await enviar('Page.navigate', { url });
await dormir(+espera);
const { data } = await enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync(salida, Buffer.from(data, 'base64'));
ws.close();
chrome.kill();
console.log('captura', salida);
