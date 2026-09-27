// Screen captures for the HUMBLE submission video (headless Chrome via playwright-core).
// Every capture is of a real page: the live site, the real audit page, the mascot lab, or
// docs/pitch/video/src/term.html replaying a real recorded events.ndjson.
//
//   node tools/video/capture.cjs <outDir> [only1,only2]
//
// Env: CHROME (default: system Chrome), PW_CORE (path to a playwright-core install when it is not
// resolvable from here), SITE (default https://firstrun-sigma.vercel.app), LOCAL (http root serving
// the repo, default http://127.0.0.1:4194; build.sh starts it).
// Output per capture: <outDir>/<name>/fNNNNN.jpg + list.txt (ffmpeg concat list with real durations).
const fs = require('fs'), path = require('path');
function loadPw() {
  for (const p of [process.env.PW_CORE, 'playwright-core', 'playwright'].filter(Boolean)) {
    try { return require(p); } catch {}
  }
  throw new Error('playwright-core not found: npm i -D playwright-core, or set PW_CORE=/path/to/node_modules/playwright-core');
}
const { chromium } = loadPw();
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SITE = process.env.SITE || 'https://firstrun-sigma.vercel.app';
const LOCAL = process.env.LOCAL || 'http://127.0.0.1:4194';
const REPO = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(REPO, 'docs/pitch/video/build'));
const ONLY = (process.argv[3] || '').split(',').filter(Boolean);
const want = n => !ONLY.length || ONLY.includes(n);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function writer(name) {
  const dir = path.join(OUT, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  return {
    dir,
    async shot(page, t) { const f = `f${String(frames.length).padStart(5, '0')}.jpg`;
      await page.screenshot({ path: path.join(dir, f), type: 'jpeg', quality: 90 }); frames.push({ f, t }); },
    // fixed-rate frames (deterministic pages)
    finishFixed(fps) { fs.writeFileSync(path.join(dir, 'list.txt'), frames.map(x => `file '${x.f}'\nduration ${(1 / fps).toFixed(6)}`).join('\n') + `\nfile '${frames[frames.length - 1].f}'\n`); },
    // wall-clock frames (live pages): each frame lasts until the next one was taken
    finishWall(total) { const lines = [];
      frames.forEach((x, i) => { const next = i + 1 < frames.length ? frames[i + 1].t : total; lines.push(`file '${x.f}'`, `duration ${Math.max(0.001, next - x.t).toFixed(4)}`); });
      lines.push(`file '${frames[frames.length - 1].f}'`); fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n') + '\n'); },
  };
}

// Run `action(elapsedSec)` while screenshotting as fast as possible for `seconds` of wall time.
async function wallCapture(page, name, seconds, action) {
  const w = writer(name); const t0 = Date.now(); let el = 0;
  while ((el = (Date.now() - t0) / 1000) < seconds) { if (action) await action(el); await w.shot(page, el); }
  w.finishWall(seconds); console.log(name, 'frames', fs.readdirSync(w.dir).length - 1);
}

async function termCapture(page, name, pieces, seconds, fps, foot) {
  await page.goto(`${LOCAL}/docs/pitch/video/src/term.html`);
  const n = await page.evaluate(o => window.setup(o), { src: '/audit/v2-31-final/runs/GeekyAnts__express-typescript/events.ndjson', pieces, foot });
  const w = writer(name); const total = Math.round(seconds * fps);
  for (let i = 0; i < total; i++) { await page.evaluate(v => window.renderAt(v), i / fps); await w.shot(page, i / fps); }
  w.finishFixed(fps); console.log(name, 'lines', n, 'frames', total);
}

async function still(page, url, out, edit) {
  await page.goto(url, { waitUntil: 'networkidle' }); await sleep(600);
  if (edit) await page.evaluate(edit);
  await sleep(300); await page.screenshot({ path: out }); console.log('still', path.basename(out));
}

async function overlay(page, out, html) {
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${html}</body></html>`);
  await page.screenshot({ path: out, omitBackground: true }); console.log('overlay', path.basename(out));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const FOOT = 'Terminal-style render of audit/v2-31-final/runs/GeekyAnts__express-typescript/events.ndjson (real run, 27 Sep 2026)';

  if (want('term_hook')) await termCapture(page, 'term_hook', [{ runFrom: 8, runTo: 32, speed: 6 }], 5.6, 15, FOOT);
  if (want('term_run')) await termCapture(page, 'term_run', [{ runFrom: 0, runTo: 34, speed: 2 }, { runFrom: 34, runTo: 461, speed: 15 }], 45.6, 15, FOOT);

  if (want('audit')) {
    await page.goto(`${SITE}/app/#/audit/v2-31-final`, { waitUntil: 'networkidle' }); await sleep(1500);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const target = Math.min(max, 900);
    await wallCapture(page, 'audit', 10.6, async t => {
      const k = Math.min(1, Math.max(0, (t - 3) / 6)); const e = k * k * (3 - 2 * k);
      await page.evaluate(y => scrollTo(0, y), Math.round(target * e));
    });
  }

  if (want('hero')) {
    await page.goto(`${SITE}/`, { waitUntil: 'domcontentloaded' });
    await wallCapture(page, 'hero', 8.6, null);
  }

  if (want('thread')) {
    await page.goto(`${SITE}/`, { waitUntil: 'networkidle' }); await sleep(1500);
    await page.evaluate(() => { const p = document.getElementById('thread-guide-panel'); scrollTo(0, p.getBoundingClientRect().top + scrollY - 20); });
    await wallCapture(page, 'thread', 60, null);
  }

  if (want('emo')) {
    await page.goto(`${SITE}/lab/emo.html`, { waitUntil: 'networkidle' }); await sleep(800);
    await page.evaluate(() => { document.body.style.zoom = '1.7'; });
    const states = ['IDLE', 'THINK', 'TALK', 'POINT', 'WORRIED', 'CELEBRATE', 'SLEEP'];
    let last = -1;
    await wallCapture(page, 'emo', 10.6, async t => {
      const i = Math.min(states.length - 1, Math.floor(t / 1.5));
      if (i !== last) { last = i; await page.evaluate(n => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().toUpperCase() === n); if (b) b.click(); }, states[i]);
        await page.mouse.move(700 + i * 90, 300 + (i % 2) * 200); }
    });
  }

  if (want('stills')) {
    const cards = 'file:///' + path.join(REPO, 'docs/pitch/cards').replace(/\\/g, '/');
    // Real numbers only: IBM Bob pass, docs/pitch/BOB_PASS_REPORT.md (4.58 Bobcoins, 10 repos rerun, VERIFIED 11 -> 14).
    await still(page, `${cards}/04-ibm-bob.html`, path.join(OUT, 'card-04-ibm-bob-filled.png'), () => {
      document.querySelector('.cost-template .value').textContent = '4.58 Bobcoins for the whole Bob pass';
      document.querySelector('.note').textContent = 'IBM Bob pass: 10 hard repos rerun, VERIFIED 11 → 14. Source: docs/pitch/BOB_PASS_REPORT.md';
    });
    await still(page, `${cards}/bob-cost-template.html`, path.join(OUT, 'card-bob-cost-filled.png'), () => {
      document.querySelector('.main-text').textContent = 'IBM Bob pass cost';
      document.querySelector('.template-box .value').textContent = '4.58';
      document.querySelector('.note').textContent = '10 hard repos rerun with Bob · 3 moved to VERIFIED (11 → 14) · capped budget · source: docs/pitch/BOB_PASS_REPORT.md';
    });
    await still(page, `${LOCAL}/docs/pitch/video/src/placeholder.html`, path.join(OUT, 'card-placeholder.png'));
    const pill = (txt, bg, pos) => `<div style="position:absolute;${pos};font:700 26px Consolas,monospace;letter-spacing:.06em;color:#fff;background:${bg};padding:10px 18px;border-radius:8px">${txt}</div>`;
    await overlay(page, path.join(OUT, 'ov-placeholder.png'),
      `<div style="position:absolute;left:0;right:0;top:0;height:64px;background:rgba(255,61,127,.93);color:#fff;font:700 28px Consolas,monospace;display:flex;align-items:center;justify-content:center;letter-spacing:.04em">PLACEHOLDER 1:20–2:10 · replace with the desktop app capture · fallback: live website</div>`);
    await overlay(page, path.join(OUT, 'ov-acme.png'), pill('acme-shop · demo repo, seeded breaks · recorded run', '#16142b', 'right:40px;bottom:40px'));
    await overlay(page, path.join(OUT, 'ov-live.png'), pill('live site · firstrun-sigma.vercel.app', '#16142b', 'right:40px;bottom:40px'));
    await overlay(page, path.join(OUT, 'ov-audit.png'), pill('live site · /audit · audit v2-31-final', '#16142b', 'right:40px;bottom:40px'));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
