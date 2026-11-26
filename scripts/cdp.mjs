// Controle do WebView do app (emulador/aparelho com depuração) por CDP: avalia JavaScript na página.
// Uso: node scripts/cdp.mjs eval "<js>"   |   node scripts/cdp.mjs file caminho.js
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ADB = process.env.ADB || 'C:/Users/INFORMATICA2/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const sh = (...a) => execFileSync(ADB, a, { encoding: 'utf-8' }).trim();

const pid = sh('shell', 'pidof', 'com.ziel.app').split(/\s+/)[0];
if (!pid) throw new Error('app não está rodando');
sh('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`);
const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('sem página');

const [, , mode, arg] = process.argv;
const expression = mode === 'file' ? readFileSync(arg, 'utf-8') : arg;
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
const res = await new Promise((resolve) => {
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id === 1) resolve(d);
  };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true, timeout: 120000 } }));
});
ws.close();
if (res.result?.exceptionDetails) {
  console.log('ERRO', JSON.stringify(res.result.exceptionDetails).slice(0, 600));
  process.exit(1);
}
console.log(process.env.RAW ? JSON.stringify(res) : JSON.stringify(res.result?.result?.value ?? res.result?.result));
