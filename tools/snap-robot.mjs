#!/usr/bin/env node
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HUMBLE_DIR = path.join(ROOT, 'lens', 'humble');
const CHROME = process.platform === 'darwin'
  ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  : process.platform === 'win32'
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'google-chrome';
const PORT = 4399;
const CDP_PORT = 9226;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

// 1. Serve lens/humble statically
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/showcase.html';
  const file = path.join(HUMBLE_DIR, p);
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
  const userDataDir = path.join(os.tmpdir(), `chrome-snap-robot-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=1200,1050',
    `http://localhost:${PORT}/showcase.html`
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
      } catch {}
    }

    if (!wsUrl) throw new Error('CDP connect failed');

    const ws = new WebSocket(wsUrl);
    let id = 1;
    const pending = new Map();

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg.result);
        pending.delete(msg.id);
      }
    };
    await new Promise(r => (ws.onopen = r));

    function send(method, params = {}) {
      const curId = id++;
      return new Promise(res => {
        pending.set(curId, res);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    await send('Page.enable');
    await send('DOM.enable');
    await sleep(1500); // let SVGs render and animate smoothly

    const snap = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    const outPath = path.join(HUMBLE_DIR, 'robot-states.png');
    fs.writeFileSync(outPath, Buffer.from(snap.data, 'base64'));
    console.log(`Saved screenshot: ${outPath} (${fs.statSync(outPath).size} bytes)`);

    ws.close();
  } catch (err) {
    console.error('Snapshot error:', err);
  } finally {
    chrome.kill();
    server.close();
    process.exit(0);
  }
});
