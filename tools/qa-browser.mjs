#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9224;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const userDataDir = `/tmp/chrome-qa-${Date.now()}`;
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1280,900',
    'http://localhost:4390',
  ], { stdio: 'ignore' });

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
    await send('Runtime.enable');

    console.log('=== TEST 1: DESKTOP VIEWPORT & CONSOLE SEQUENCE ===');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });

    // Wait for page load
    await sleep(2000);

    // Scroll into hero section to trigger lazy-mount
    await send('Runtime.evaluate', {
      expression: `
        const hero = document.querySelector('#hero') || document.querySelector('.hero-full');
        if (hero) hero.scrollIntoView({ block: 'start' });
      `
    });
    await sleep(1000);

    // Capture hero state
    const heroShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('web/public/assets/img/snap_qa_desktop_hero.png', Buffer.from(heroShot.data, 'base64'));
    console.log('Captured snap_qa_desktop_hero.png');

    // Check if console is mounted
    const mountCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const mount = document.getElementById('humble-console-mount');
          const panel = mount ? mount.querySelector('.humble-panel') : null;
          const mascot = mount ? mount.querySelector('#humble-mascot-container svg') : null;
          const circle = mascot ? mascot.querySelector('circle') : null;
          return {
            mounted: !!mount,
            hasPanel: !!panel,
            hasMascot: !!mascot,
            circleFill: circle ? circle.getAttribute('fill') : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Console mount status:', mountCheck.result.value);

    // Wait for console to advance through onboarding sequence
    await sleep(5000);
    const consoleShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('web/public/assets/img/snap_qa_console_active.png', Buffer.from(consoleShot.data, 'base64'));
    console.log('Captured snap_qa_console_active.png');

    console.log('=== TEST 2: 375PX MOBILE WIDTH AUDIT ===');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(800);

    // Check for horizontal overflow
    const mobileMetrics = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const docWidth = document.documentElement.scrollWidth;
          const winWidth = window.innerWidth;
          const bodyWidth = document.body.scrollWidth;
          
          // Find any overflowing elements
          const overflowing = [];
          const all = document.querySelectorAll('*');
          all.forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.right > winWidth + 2) {
              overflowing.push({
                tag: el.tagName,
                cls: el.className,
                id: el.id,
                right: Math.round(r.right),
                width: Math.round(r.width)
              });
            }
          });
          
          return {
            docWidth,
            winWidth,
            bodyWidth,
            hasHorizontalScroll: docWidth > winWidth,
            overflowingElements: overflowing.slice(0, 10)
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Mobile 375px audit:', JSON.stringify(mobileMetrics.result.value, null, 2));

    const mobileShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('web/public/assets/img/snap_qa_mobile_375.png', Buffer.from(mobileShot.data, 'base64'));
    console.log('Captured snap_qa_mobile_375.png');

    console.log('=== TEST 3: PREFERS-REDUCED-MOTION ===');
    await send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });

    const reducedMotionCheck = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const introSec = document.getElementById('intro');
          const introStatic = introSec ? introSec.classList.contains('static') : false;
          return { isReduced, introStatic };
        })()
      `,
      returnByValue: true
    });
    console.log('Reduced motion check:', reducedMotionCheck.result.value);

    const reducedShot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('web/public/assets/img/snap_qa_reduced_motion.png', Buffer.from(reducedShot.data, 'base64'));
    console.log('Captured snap_qa_reduced_motion.png');

    ws.close();
  } finally {
    try { chrome.kill('SIGKILL'); } catch {}
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
