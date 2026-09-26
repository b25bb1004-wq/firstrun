#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9223;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const userDataDir = `/tmp/chrome-snap-${Date.now()}`;
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1280,900',
    'http://localhost:4321',
  ], { stdio: 'inherit' });

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      await sleep(200);
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const list = await res.json();
        const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl && t.url.includes('localhost:4321'));
        if (page) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!wsUrl) throw new Error('Failed to connect to Chrome CDP');

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
      width: 1280,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });

    // Wait for load and fonts
    await sleep(2000);

    // 1. Capture Hero
    const heroShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('web/public/assets/img/snap_01_hero.png', Buffer.from(heroShot.data, 'base64'));
    console.log('Captured: snap_01_hero.png');

    // 2. Scroll to Crew
    await send('Runtime.evaluate', {
      expression: `
        var el = document.querySelector('#crew');
        if (el) el.scrollIntoView({ block: 'start' });
      `
    });
    await sleep(600);
    const crewShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('web/public/assets/img/snap_02_crew.png', Buffer.from(crewShot.data, 'base64'));
    console.log('Captured: snap_02_crew.png');

    // 3. Scroll to Scrub
    await send('Runtime.evaluate', {
      expression: `
        var el = document.querySelector('.scrub');
        if (el) el.scrollIntoView({ block: 'center' });
      `
    });
    await sleep(600);
    const scrubShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('web/public/assets/img/snap_03_scrub.png', Buffer.from(scrubShot.data, 'base64'));
    console.log('Captured: snap_03_scrub.png');

    // 4. Scroll to Proof & Slider
    await send('Runtime.evaluate', {
      expression: `
        var el = document.querySelector('#diff-slider');
        if (el) el.scrollIntoView({ block: 'center' });
      `
    });
    await sleep(600);
    const sliderShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('web/public/assets/img/snap_04_slider.png', Buffer.from(sliderShot.data, 'base64'));
    console.log('Captured: snap_04_slider.png');

    // 5. Drag Slider to 25% (showing more of AS PROVEN)
    await send('Runtime.evaluate', {
      expression: `
        var el = document.querySelector('#diff-slider');
        if (el) el.style.setProperty('--split', '25%');
      `
    });
    await sleep(300);
    const sliderAfter = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('web/public/assets/img/snap_05_slider_proven.png', Buffer.from(sliderAfter.data, 'base64'));
    console.log('Captured: snap_05_slider_proven.png');

    // 6. Toggle Dark Theme
    await send('Runtime.evaluate', {
      expression: `document.documentElement.dataset.theme = 'dark';`
    });
    await sleep(400);
    const darkShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('web/public/assets/img/snap_06_dark_theme.png', Buffer.from(darkShot.data, 'base64'));
    console.log('Captured: snap_06_dark_theme.png');

    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
