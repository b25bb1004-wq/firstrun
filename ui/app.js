// FirstRun dashboard: hash router and global chrome.
import { h, icon, store } from './lib.js';
import { mountHome } from './views/home.js';
import { mountRun } from './views/run.js';
import { mountAudit } from './views/audit.js';
import { mountGuide } from './views/guide.js';

const view = document.getElementById('view');
const crumbs = document.getElementById('crumbs');
let current = null; // { key, ctl }

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [kind, id, sub] = parts;
  if (kind === 'run' && id) return { kind, id, sub };
  if (kind === 'audit' && id) return { kind, id };
  if (kind === 'guide' && id) return { kind, id };
  return { kind: 'home' };
}

function setCrumbs(r) {
  const items = [h`<a href="#/">Flight log</a>`];
  if (r.kind === 'run') items.push(h`<span>Run</span><b>${r.id}</b>`);
  if (r.kind === 'audit') items.push(h`<span>Audit</span><b>${r.id}</b>`);
  if (r.kind === 'guide') items.push(h`<a href="#/run/${r.id}">Run ${r.id}</a><b>Guide</b>`);
  crumbs.innerHTML = String(h`${items.map((x, i) => h`${i ? h`<span class="sep" aria-hidden="true">/</span>` : ''}${x}`)}`);
}

function route() {
  const r = parse();
  const key = `${r.kind}:${r.id || ''}`;
  setCrumbs(r);
  document.body.dataset.view = r.kind;
  if (current && current.key === key) { current.ctl.route?.(r.sub); return; }
  current?.ctl.destroy?.();
  view.innerHTML = '';
  window.scrollTo(0, 0);
  let ctl;
  if (r.kind === 'run') ctl = mountRun(view, r.id, r.sub);
  else if (r.kind === 'audit') ctl = mountAudit(view, r.id);
  else if (r.kind === 'guide') ctl = mountGuide(view, r.id);
  else ctl = mountHome(view);
  current = { key, ctl };
  ctl.init?.();
  document.title = { run: `${r.id} · FirstRun`, audit: `${r.id} audit · FirstRun`, guide: `${r.id} guide · FirstRun`, home: 'FirstRun' }[r.kind];
}

// theme: dark by default, persisted per viewer
const themeBtn = document.getElementById('theme');
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  themeBtn.innerHTML = String(icon(t === 'dark' ? 'sun' : 'moon'));
  themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}
applyTheme(store.get('firstrun.theme', 'dark'));
themeBtn.addEventListener('click', () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  store.set('firstrun.theme', t); applyTheme(t);
});

window.addEventListener('hashchange', route);
route();
