import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB_DIR = path.join(ROOT, 'web', 'public');
const CHROME = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'google-chrome';
const PORT = 4398;
const CDP_PORT = 9225;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const file = path.join(PUB_DIR, p);
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    return res.end('404');
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, async () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  const userDataDir = path.join(os.tmpdir(), `chrome-snap-prove-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=1200,1600',
    `http://localhost:${PORT}/index.html`
  ]);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      try {
        const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const list = await r.json();
        const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl && t.url.includes(`${PORT}`));
        if (page) { wsUrl = page.webSocketDebuggerUrl; break; }
      } catch (e) {}
    }

    if (!wsUrl) throw new Error('Could not find Chrome page WebSocket');

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const msgId = id++;
      const handler = (evt) => {
        const data = JSON.parse(evt.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await sleep(1500); // Allow fonts & DOM to settle

    // Trigger prove button to show stream console in snapshot
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('prove-btn')?.click();
      `
    });

    await sleep(2000); // Wait for streaming rows to render

    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(PUB_DIR, 'assets', 'img', 'prove-it-live-preview.png');
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${outPath} (${buffer.length} bytes)`);

    ws.close();
  } catch (err) {
    console.error('Snapshot failed:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});
