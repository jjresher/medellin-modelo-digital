// Abre kepler.gl/demo en un Chrome sin ventana, le sube el GeoJSON de comunas con las seis columnas de la prueba y deja una captura.
//   node exploracion/kepler/subir.mjs   (desde la raíz del proyecto)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const archivo = resolve('exploracion/kepler/comunas_con_datos.geojson');
const puerto = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${puerto}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'kep-'))}`, '--window-size=1400,900', 'about:blank'], { stdio: 'ignore' });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let blanco;
for (let i = 0; i < 40 && !blanco; i++) { await dormir(250); try { blanco = (await (await fetch(`http://127.0.0.1:${puerto}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(blanco.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let n = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
const enviar = (method, params = {}) => new Promise((r) => { pend.set(++n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluar = async (expresion) => (await enviar('Runtime.evaluate', { expression: expresion, returnByValue: true })).result?.value;
await enviar('Page.enable'); await enviar('DOM.enable');
await enviar('Page.navigate', { url: 'https://kepler.gl/demo' });
await dormir(12000);
const raiz = (await enviar('DOM.getDocument', { depth: -1 })).root.nodeId;
const entrada = (await enviar('DOM.querySelector', { nodeId: raiz, selector: 'input[type=file]' })).nodeId;
await enviar('DOM.setFileInputFiles', { nodeId: entrada, files: [archivo] });
await dormir(4000);
const caja = await evaluar(`(() => { const b = [...document.querySelectorAll('button, div')].find((e) => e.children.length < 3 && /^Add Data$/i.test(e.textContent.trim()) && e.offsetParent); if (!b) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
for (const tipo of ['mousePressed', 'mouseReleased']) await enviar('Input.dispatchMouseEvent', { type: tipo, x: caja[0], y: caja[1], button: 'left', clickCount: 1 });
await dormir(10000);
const { data } = await enviar('Page.captureScreenshot', { format: 'png' });
writeFileSync('exploracion/kepler/captura-kepler.png', Buffer.from(data, 'base64'));
console.log('captura exploracion/kepler/captura-kepler.png');
ws.close(); chrome.kill();
