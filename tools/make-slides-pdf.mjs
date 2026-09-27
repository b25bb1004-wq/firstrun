#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9228;
const URL = process.env.SLIDES_URL || 'http://localhost:4390/slides.html';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1920,1080',
    URL,
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const list = await res.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!wsUrl) throw new Error('Could not connect to Chrome CDP');

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
    await sleep(2000);

    const pdf = await send('Page.printToPDF', {
      landscape: true,
      printBackground: true,
      paperWidth: 16,
      paperHeight: 9,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      preferCSSPageSize: true,
    });

    fs.writeFileSync('web/public/slides.pdf', Buffer.from(pdf.data, 'base64'));
    console.log('Successfully saved web/public/slides.pdf (16:9, 10 slides)');
  } finally {
    try { chrome.kill('SIGKILL'); } catch {}
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
