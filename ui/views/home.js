// Home: every run and audit the server can see.
import { h, api, when, PHASE_LABEL, icon } from '../lib.js';

export function mountHome(root) {
  let closed = false;
  root.innerHTML = String(h`<div class="home"><p class="muted">Reading the flight log...</p></div>`);
  const load = async () => {
    let runs = [], audits = [];
    try { [runs, audits] = await Promise.all([api('/api/runs'), api('/api/audits')]); } catch {}
    if (closed) return;
    const liveRuns = runs.filter(r => r.phase !== 'done' && r.phase !== 'error');
    root.innerHTML = String(h`<div class="home">
      <header class="home-head">
        <h1>Flight log</h1>
        <p>Each run followed a README in a clean container like a newcomer would, repaired what broke, and replayed the fix from zero.</p>
      </header>
      ${audits.length ? h`<section class="home-sec"><h2>Swarm audits</h2><div class="audit-cards">${audits.map(a => h`
        <a class="audit-card" href="#/audit/${a.id}">
          <span class="ac-id">${a.id}</span>
          <span class="ac-line"><b>${a.broke}</b> of <b>${a.repos}</b> READMEs broke on a clean machine</span>
          <span class="ac-bar">${['VERIFIED', 'PARTIAL', 'FAILED', 'INCONCLUSIVE', 'CI-ONLY', 'NO-SETUP-DOCS'].map(v => h`<i class="v-${v.toLowerCase()}" style="flex:${a.verdicts[v] || 0}"></i>`)}<i class="v-pending" style="flex:${a.repos - a.done}"></i></span>
          <span class="ac-meta mono">${a.done}/${a.repos} audited ${a.startedAt ? '· ' + when(a.startedAt) : ''}</span>
        </a>`)}</div></section>` : ''}
      <section class="home-sec"><h2>Runs ${liveRuns.length ? h`<span class="live-pill">${icon('dot')} ${liveRuns.length} live</span>` : ''}</h2>
        ${runs.length ? h`<table class="runs"><thead><tr><th>Repository</th><th>Phase</th><th>Verdict</th><th>Started</th><th></th></tr></thead><tbody>
          ${runs.map(r => {
            const [org, name] = (r.repo || r.id).split('/');
            const isLive = r.phase !== 'done' && r.phase !== 'error';
            return h`<tr class="${isLive ? 'is-live' : ''}" data-href="#/run/${r.id}">
              <td><a href="#/run/${r.id}" class="rr"><span class="org">${name ? org + '/' : ''}</span>${name || org}</a> <span class="rid mono">${r.id}</span></td>
              <td>${isLive ? h`<span class="live-pill">${icon('dot')} ${PHASE_LABEL[r.phase] || r.phase}</span>` : PHASE_LABEL[r.phase] || r.phase}</td>
              <td>${r.verdict ? h`<span class="vchip v-${r.verdict.toLowerCase()}">${r.verdict}</span>` : h`<span class="muted">pending</span>`}</td>
              <td class="mono">${when(r.startedAt)}</td>
              <td class="acts"><a href="#/run/${r.id}">Run</a>${r.verdict && r.verdict !== 'FAILED' ? h`<a href="#/guide/${r.id}">Guide</a>` : ''}</td>
            </tr>`;
          })}</tbody></table>`
        : h`<div class="empty"><p>No runs found yet.</p><p>Point the dashboard at a folder that contains <code>.firstrun/run.json</code>: <code>node src/server.js --root &lt;dir&gt;</code></p></div>`}
      </section>
    </div>`);
  };
  load();
  const iv = setInterval(() => { if (!closed) load(); }, 5000);
  const onClick = e => { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a')) location.hash = tr.dataset.href; };
  root.addEventListener('click', onClick);
  return { destroy() { closed = true; clearInterval(iv); root.removeEventListener('click', onClick); } };
}
