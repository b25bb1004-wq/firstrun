#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HTTP_PORT = 4921;
const CDP_PORT = 9323;

const OVERLAYS = [
  // 1. Title cards
  '01-title-hook',
  '02-title-real-run',
  '03-title-on-your-machine',
  '04-title-ibm-bob',
  '05-title-four-surfaces',

  // 2. Lower-thirds
  'lowerthird-harvey',
  'lowerthird-unity',
  'lowerthird-mach',
  'lowerthird-drbo',
  'lowerthird-larp',
  'lowerthird-echo',
  'lowerthird-vigil',

  // 3. Stat cards
  'stat-audit-break',
  'stat-geekyants-verified',
  'stat-bob-cost-template',

  // 4. Labels
  'label-4x-speed',
  'label-8x-speed',
  'label-cached-packages',
  'label-demo-repo',
  'label-recorded-run',

  // 5. End card
  'end-card'
];

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 1. Simple HTTP Server
function startServer() {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '/overlays.html') {
      const htmlPath = path.join(__dirname, 'overlays.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(htmlPath));
    }
    const filePath = path.join(__dirname, reqPath.slice(1));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mime = ext === '.png' ? 'image/png' : ext === '.html' ? 'text/html' : 'text/plain';
      res.writeHead(200, { 'Content-Type': mime });
      return res.end(fs.readFileSync(filePath));
    }
    res.writeHead(404);
    res.end('Not Found');
  });

  return new Promise((resolve) => {
    server.listen(HTTP_PORT, () => {
      console.log(`Local overlay server running at http://localhost:${HTTP_PORT}`);
      resolve(server);
    });
  });
}

// 2. Main Rendering Routine via Chrome CDP
async function main() {
  const server = await startServer();
  const userDataDir = `/tmp/chrome-overlay-render-${Date.now()}`;
  
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=1920,1080',
    `http://localhost:${HTTP_PORT}/overlays.html`
  ], { stdio: 'ignore' });

  try {
    let wsUrl = null;
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        const list = await res.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!wsUrl) throw new Error('Failed to connect to Chrome WebSocket Debugger');

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

    await new Promise((r) => (ws.onopen = r));

    function send(method, params = {}) {
      const curId = id++;
      return new Promise((resolve) => {
        pending.set(curId, resolve);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    await send('Page.enable');
    await send('DOM.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Make default background transparent for broadcast alpha channel
    await send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 0 }
    });

    // Render individual transparent overlays
    for (const overlayId of OVERLAYS) {
      const url = `http://localhost:${HTTP_PORT}/overlays.html?id=${overlayId}`;
      await send('Page.navigate', { url });
      
      // Wait for fonts & rendering
      await send('Runtime.evaluate', {
        expression: `document.fonts.ready`,
        awaitPromise: true
      });
      await sleep(200);

      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true
      });

      const outPath = path.join(__dirname, `${overlayId}.png`);
      fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
      console.log(`Rendered: ${overlayId}.png (1920x1080 transparent PNG)`);
    }

    // Render Contact Sheet
    console.log('\nRendering contact sheet...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 2400,
      height: 1800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await send('Page.navigate', { url: `http://localhost:${HTTP_PORT}/contact-sheet.html` });
    await send('Runtime.evaluate', {
      expression: `document.fonts.ready`,
      awaitPromise: true
    });
    await sleep(400);

    const sheetShot = await send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true
    });
    fs.writeFileSync(path.join(__dirname, 'contact-sheet.png'), Buffer.from(sheetShot.data, 'base64'));
    console.log('Rendered: contact-sheet.png (2400x1800 contact sheet)');

    console.log(`\nAll ${OVERLAYS.length} video overlays + contact sheet rendered successfully into ${__dirname}`);
    
    ws.close();
  } finally {
    chrome.kill('SIGTERM');
    server.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((err) => {
  console.error('Render error:', err);
  process.exit(1);
});
