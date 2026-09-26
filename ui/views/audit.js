// Audit (swarm) view: many repos, audited in parallel, filling in live.
import { h, api, secs, PHASE_LABEL, STATUS_LABEL, CLASS_LABEL, icon } from '../lib.js';

function repoStats(r) {
  const p = r.passport || r.run?.passport || null;
  const breaks = p ? p.breaksFound : (r.run?.breaks || 0);
  const verdict = r.verdict || p?.verdict || r.run?.verdict || null;
  const state = verdict ? 'done' : r.status === 'running' || (r.run && r.run.phase && r.run.phase !== 'done') ? 'running' : r.status === 'done' ? 'done' : 'queued';
  return { p, breaks, verdict, state };
}

function tileHTML(r) {
  const { p, breaks, verdict, state } = repoStats(r);
  const [org, name] = String(r.slug).split('/');
  const run = r.run;
  const rt = p?.runtime || (run?.runtime ? `${run.runtime.name === 'other' ? '' : run.runtime.name + ' '}${run.runtime.version}` : '');
  const cells = (run?.steps || []).map(s => h`<i class="c-${s.status}" title="${s.id} ${STATUS_LABEL[s.status] || s.status}"></i>`);
  const vcls = verdict ? verdict.toLowerCase() : state;
  let mid;
  if (state === 'queued') mid = h`<p class="t-wait">Waiting for a sandbox</p>`;
  else if (state === 'running') {
    const cs = run?.currentStep;
    mid = h`<p class="t-phase">${icon('dot')} ${PHASE_LABEL[run?.phase] || 'Starting'}${run?.stepsTotal ? h` <span class="mono">${run.stepsDone}/${run.stepsTotal}</span>` : ''}</p>
      ${cs ? h`<code class="t-cmd">${cs.command}</code>` : h`<code class="t-cmd dim">${run?.phase === 'replay' ? 'replaying from zero' : '...'}</code>`}`;
  } else if (verdict === 'NO-SETUP-DOCS') {
    const reason = r.error || 'The docs contain no setup commands HUMBLE can follow.';
    mid = h`<p class="t-result t-nodocs" title="${reason}">${reason}</p>`;
  } else if (verdict === 'INCONCLUSIVE') {
    const humbles = p?.humbleUnknowns || 0;
    mid = h`<p class="t-result t-inconclusive" title="Only HUMBLE unknown failures (no rule matched)">Inconclusive: ${humbles} unknown failure${humbles !== 1 ? 's' : ''} from HUMBLE</p>`;
  } else {
    mid = h`<p class="t-result">${breaks === 0 ? 'The README worked as written' : p?.needsHuman ? `${breaks} break${breaks === 1 ? '' : 's'}: ${p.breaksFixed} fixed, ${p.needsHuman} for a human` : `${breaks} break${breaks === 1 ? '' : 's'}, all fixed with evidence`}</p>`;
  }
  return h`<a class="tile t-${state} v-${vcls}" data-slug="${r.slug}" ${r.error ? h`title="${r.error}"` : ''} ${r.runId ? h`href="#/run/${r.runId}"` : ''}>
    <div class="t-top"><span class="t-org">${org}/</span><span class="t-name">${name}</span></div>
    <div class="t-meta">${rt ? h`<span class="t-rt">${rt}</span>` : ''}${run?.bobcoins ? h`<span class="t-bob">${icon('bob')} ${run.bobcoins}</span>` : ''}</div>
    <div class="t-strip" aria-hidden="true">${cells.length ? cells : h`<i></i><i></i><i></i><i></i><i></i>`}</div>
    <div class="t-mid">${mid}</div>
    ${run?.repairs?.length ? h`<ul class="t-reps">${run.repairs.map(x => h`<li class="r-${x.status} ${x.by === 'bob' ? 'r-bob' : ''}" title="${x.id} on ${x.stepId}">${CLASS_LABEL[x.class] || x.class || x.id}</li>`)}</ul>` : ''}
    <div class="t-foot">
      ${state === 'done' ? h`<span class="t-verdict" ${r.error ? h`title="${r.error}"` : ''}>${verdict}</span><span class="t-time mono">${verdict === 'VERIFIED' && p?.replaySeconds ? secs(p.replaySeconds) + ' from zero' : verdict === 'NO-SETUP-DOCS' ? 'finding' : 'not running yet'}</span>` : h`<span class="t-state">${state === 'queued' ? 'Queued' : 'Running'}</span>`}
    </div>
  </a>`;
}

export function mountAudit(root, auditId) {
  let audit = null, es = null, closed = false, live = false;
  const sigs = {};
  root.innerHTML = String(h`<div class="audit">
    <header class="au-head" id="au-head"><div class="au-hero"><p class="au-kicker">Swarm audit</p><h1 class="au-headline">Loading</h1></div></header>
    <div class="au-grid" id="au-grid"></div>
  </div>`);
  const $ = s => root.querySelector(s);

  function draw() {
    if (!audit || closed) return;
    const repos = audit.repos || [];
    const st = repos.map(repoStats);
    const M = repos.length;
    const done = st.filter(s => s.state === 'done').length;
    const running = st.filter(s => s.state === 'running').length;
    const queued = M - done - running;
    const broke = st.filter(s => s.breaks > 0).length;
    const auto = st.filter(s => s.breaks > 0 && s.verdict === 'VERIFIED').length;
    const found = st.reduce((a, s) => a + (s.p?.breaksFound ?? s.breaks), 0);
    const fixed = st.reduce((a, s) => a + (s.p?.breaksFixed || 0), 0);
    const human = st.reduce((a, s) => a + (s.p?.needsHuman || 0), 0);
    const coins = Math.round(repos.reduce((a, r) => a + (r.passport?.bobcoins ?? r.run?.bobcoins ?? 0), 0) * 100) / 100;
    const times = st.filter(s => s.verdict === 'VERIFIED' && s.p?.replaySeconds).map(s => s.p.replaySeconds).sort((a, b) => a - b);
    const median = times.length ? times[Math.floor(times.length / 2)] : 0;
    const counts = { VERIFIED: 0, PARTIAL: 0, FAILED: 0, INCONCLUSIVE: 0, 'CI-ONLY': 0, 'NO-SETUP-DOCS': 0 };
    st.forEach(s => { if (s.verdict) counts[s.verdict] = (counts[s.verdict] || 0) + 1; });
    const all = done === M;
    const started = audit.startedAt ? Date.parse(audit.startedAt) : null;
    $('#au-head').innerHTML = String(h`
      <div class="au-hero">
        <p class="au-kicker">Swarm audit <span class="mono">${audit.id}</span>${started ? h` <span class="mono">started ${new Date(started).toLocaleTimeString()}</span>` : ''}</p>
        <h1 class="au-headline"><span class="n">${broke}</span> of <span class="n">${M}</span> READMEs broke on a clean machine${all ? '.' : ''}</h1>
        <p class="au-sub"><span class="n">${auto}</span> repo${auto === 1 ? '' : 's'} fully repaired; <span class="n">${fixed}</span> individual break${fixed === 1 ? '' : 's'} fixed with evidence${all ? '.' : h` so far. <span class="au-live">${icon('dot')} <span class="mono">${running}</span> running, <span class="mono">${queued}</span> queued</span>`}</p>
      </div>
      <div class="au-rail">
        <div class="gauge"><span class="gl">Audited</span><span class="gv mono">${done}/${M}</span></div>
        <div class="gauge"><span class="gl">Breaks found</span><span class="gv mono">${found}</span></div>
        <div class="gauge g-pass"><span class="gl">Fixed with evidence</span><span class="gv mono">${fixed}</span></div>
        <div class="gauge g-human"><span class="gl">Need a human</span><span class="gv mono">${human}</span></div>
        <div class="gauge g-bob"><span class="gl">Bobcoins</span><span class="gv mono">${coins}</span></div>
        <div class="gauge"><span class="gl">Median clone to running</span><span class="gv mono">${median ? secs(median) : '--'}</span></div>
        <div class="au-verdicts" aria-label="Verdicts">
          ${['VERIFIED', 'PARTIAL', 'FAILED', 'INCONCLUSIVE', 'CI-ONLY', 'NO-SETUP-DOCS'].map(v => h`<span class="vb v-${v.toLowerCase()}" style="flex:${counts[v] || 0.0001}" title="${counts[v] || 0} ${v}"><b>${counts[v] || ''}</b></span>`)}
          <span class="vb v-pending" style="flex:${M - done || 0.0001}"></span>
        </div>
      </div>`);
    const grid = $('#au-grid');
    const existing = new Map([...grid.children].map(el => [el.dataset.slug, el]));
    let prev = null;
    for (const r of repos) {
      const s = repoStats(r);
      const sig = JSON.stringify([s.state, s.verdict, r.run?.phase, r.run?.currentStep, r.run?.steps, r.runId, r.run?.bobcoins, r.run?.repairs]);
      let el = existing.get(r.slug);
      if (!el || sigs[r.slug] !== sig) {
        const tmp = document.createElement('template');
        tmp.innerHTML = String(tileHTML(r)).trim();
        const nel = tmp.content.firstElementChild;
        const old = el ? el.className.match(/t-(queued|running|done)/)?.[1] : null;
        if (live && el && old !== s.state) nel.classList.add(s.state === 'done' ? 'landed' : 'flash');
        if (el) el.replaceWith(nel); else grid.appendChild(nel);
        el = nel; sigs[r.slug] = sig;
      }
      const want = prev ? prev.nextElementSibling : grid.firstElementChild;
      if (want !== el) grid.insertBefore(el, want);
      prev = el;
    }
  }

  (async () => {
    try { audit = await api(`/api/audits/${encodeURIComponent(auditId)}`); } catch {
      $('#au-head').innerHTML = String(h`<div class="au-hero"><h1 class="au-headline">No audit called ${auditId}</h1><p class="au-sub">Check the id, or <a href="#/">go back to the flight log</a>.</p></div>`);
      return;
    }
    if (closed) return;
    draw();
    es = new EventSource(`/api/audits/${encodeURIComponent(auditId)}/events`);
    es.addEventListener('snapshot', e => { try { audit = JSON.parse(e.data); } catch {} draw(); });
    es.addEventListener('ready', () => { live = true; });
  })();

  return { destroy() { closed = true; es?.close(); } };
}
