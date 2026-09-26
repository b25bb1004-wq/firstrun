// Run view: the live flight recorder for one HUMBLE run.
import { createModel, applyEvent, modelFromRunState, AGENTS, PHASES } from '../model.js';
import {
  h, raw, esc, api, apiText, dur, clock, short, STATUS_LABEL, CLASS_LABEL, PHASE_LABEL, STATUS_ICON,
  icon, errorSignature, isErrorLine, fixActionText, DOC_LABEL, rafBatch, secs,
} from '../lib.js';
import { passportHTML } from '../passport.js';
import { renderDiff } from '../diff.js';

const AGENT_INFO = {
  scout: { name: 'Scout', job: 'Reads docs, manifests, CI' },
  planner: { name: 'Planner', job: 'Turns the README into steps' },
  runner: { name: 'Runner', job: 'Runs steps in a clean container' },
  doctor: { name: 'Doctor', job: 'Diagnoses and repairs failures' },
  verifier: { name: 'Verifier', job: 'Replays the fix from zero' },
  scribe: { name: 'Scribe', job: 'Writes README, passport' },
};

function agentLine(m, a) {
  const last = m.agentLast[a];
  if (!last) return AGENT_INFO[a].job;
  const d = last.data || {};
  switch (last.type) {
    case 'phase': return { scout: 'Reading the repository', plan: 'Parsing setup sections', coldstart: 'Booting a clean container', repair: 'Diagnosing a failure', replay: 'Fresh container, replaying', publish: 'Writing outputs', done: 'Run complete' }[d.phase] || PHASE_LABEL[d.phase];
    case 'facts': return `Read ${(d.manifests || []).length} manifests${d.ci?.length ? ', CI' : ''}${d.compose ? ', compose' : ''}`;
    case 'plan': return `${(d.steps || []).filter(s => s.origin !== 'repair').length} steps, ${(d.conflicts || []).length} conflicts`;
    case 'step.start': case 'step.log': return `${d.stepId}  ${m.steps[d.stepId]?.def?.command || d.command || ''}`;
    case 'step.end': return `${d.stepId} exited ${d.exitCode} in ${dur(d.durationMs)}`;
    case 'diagnosis': return `${d.stepId}: ${CLASS_LABEL[d.diagnosis?.class] || d.diagnosis?.class}`;
    case 'bob': return `Asked IBM Bob, ${d.bobcoins} Bobcoins`;
    case 'fix': return `Applying a fix to ${d.stepId}`;
    case 'evidence': return `${d.id} recorded, ${d.status}`;
    case 'replay.start': return 'Replaying from zero';
    case 'replay.end': return `Replay ${d.status} in ${dur(d.durationMs)}`;
    case 'artifact': return `Wrote ${d.name}`;
    case 'passport': return `Passport issued: ${d.verdict}`;
    case 'done': return 'Run complete';
    default: return last.type;
  }
}

// ---------------------------------------------------------------- repair chain
function repairs(s) {
  // Group the trail into [failing attempt, diagnosis, fix, next attempt, evidence] chains.
  const out = [];
  const t = s.trail;
  for (let i = 0; i < t.length; i++) {
    if (t[i].kind !== 'diagnosis') continue;
    const before = [...t.slice(0, i)].reverse().find(x => x.kind === 'attempt');
    const fix = t.slice(i + 1).find(x => x.kind === 'fix');
    const nextDiag = t.slice(i + 1).findIndex(x => x.kind === 'diagnosis');
    const end = nextDiag === -1 ? t.length : i + 1 + nextDiag;
    const after = t.slice(i + 1, end).find(x => x.kind === 'attempt' && x !== before);
    const evi = t.slice(i + 1, end).find(x => x.kind === 'evidence');
    out.push({ before, diag: t[i], fix, after, evidence: evi });
  }
  return out;
}

function chainHTML(m, s, r) {
  const d = r.diag;
  const bob = d.by === 'bob';
  const human = r.evidence?.status === 'needs-human';
  const eid = d.evidenceId || r.evidence?.id;
  const sig = r.before ? errorSignature(r.before.logTail) : '';
  const fixItems = r.fix ? (r.fix.fix.actions || []).map(a => h`<li>${fixActionText(a)}</li>`) : [];
  let endBox;
  if (human) endBox = h`<div class="lnk l-human"><span class="lk">${icon('hand')} Needs a human</span><p>${r.fix?.fix?.doc?.text || 'Escalated'}</p></div>`;
  else if (!r.after && !r.fix) endBox = h`<div class="lnk l-wait"><span class="lk">Proposing a fix</span></div>`;
  else if (!r.after || r.after.status === 'running') endBox = h`<div class="lnk l-wait live"><span class="lk">${icon('dot')} Retrying</span><p class="mono">attempt ${r.after?.n || '...'}</p></div>`;
  else if (r.after.status === 'passed') endBox = h`<div class="lnk l-pass enter"><span class="lk">${icon('check')} Pass</span><p class="mono">exit 0 · ${dur(r.after.durationMs)}</p></div>`;
  else endBox = h`<div class="lnk l-fail"><span class="lk">${icon('cross')} Still failing</span><p class="mono">exit ${r.after.exitCode}</p></div>`;
  return h`<div class="chain">
    <div class="lnk l-fail"><span class="lk">${icon('cross')} Fail</span>
      <p class="mono">exit ${r.before?.exitCode ?? '?'} · ${dur(r.before?.durationMs)}</p>
      ${sig ? h`<q class="sig" title="${sig}">${sig}</q>` : ''}</div>
    <div class="lnk l-diag ${bob ? 'by-bob' : ''} enter">
      <span class="cls">${CLASS_LABEL[d.class] || d.class}</span>
      <p class="cause">${d.cause}</p>
      <span class="by">${bob
        ? h`${icon('bob')} Diagnosed by IBM Bob · ${d.bobcoins ?? '?'} Bobcoins`
        : h`Diagnosed by rules${d.ruleId ? h` · <code>${d.ruleId}</code>` : ''}`}<span class="conf" title="confidence">${Math.round((d.confidence || 0) * 100)}%</span></span>
    </div>
    ${r.fix ? h`<div class="lnk l-fix enter"><span class="lk">${icon('wrench')} Fix</span><ul>${fixItems.length ? fixItems : h`<li>No automatic action</li>`}</ul></div>`
            : h`<div class="lnk l-fix pending"><span class="lk">${icon('wrench')} Fix</span><ul><li>...</li></ul></div>`}
    ${endBox}
    ${eid ? h`<a class="ev-link" href="#/run/${m.id}/${eid}" title="Open evidence ${eid}">${eid}<span>evidence</span></a>` : h`<span class="ev-link off">E?<span>evidence</span></span>`}
  </div>`;
}

function lastAttempt(s) { return [...s.trail].reverse().find(x => x.kind === 'attempt'); }

function stepHTML(m, s, open) {
  const def = s.def || { id: s.id, command: lastAttempt(s)?.command || '', kind: 'other', origin: 'readme' };
  const st = s.status;
  const t0 = Date.parse(m.startedAt);
  const tplus = s.startedT ? 'T+' + clock(Date.parse(s.startedT) - t0) : '';
  const la = lastAttempt(s);
  const reps = repairs(s);
  const totalMs = s.trail.filter(x => x.kind === 'attempt').reduce((a, x) => a + (x.durationMs || 0), 0);
  const repair = def.origin === 'repair';
  const replay = s.replay;
  const isRunning = st === 'running';
  const logText = isRunning ? s.log : (la?.logTail ?? '');
  return h`<li class="step st-${st} ${repair ? 'is-repair' : ''}" data-id="${s.id}">
    <div class="gut"><span class="tplus">${tplus}</span></div>
    <div class="node" aria-hidden="true"><i>${icon(STATUS_ICON[st] || 'dot')}</i></div>
    <article class="card">
      <header class="card-h">
        <span class="sid">${s.id}</span>
        <code class="cmd" title="${def.command}">${def.command}</code>
        <span class="chip c-${st}">${st === 'pending' && m.phase === 'done' ? 'Not reached' : STATUS_LABEL[st] || st}</span>
      </header>
      <div class="card-sub">
        ${repair ? h`<span class="added">${icon('wrench')} Added by the Doctor</span>` : def.source ? h`<span class="src">${def.source.file}:${def.source.line}</span><span class="sec">${def.source.section}</span>` : ''}
        <span class="kind">${def.kind}</span>
        ${s.attempts > 1 ? h`<span class="att">${s.attempts} attempts</span>` : ''}
        ${totalMs && !isRunning ? h`<span class="dur">${dur(totalMs)}</span>` : ''}
        ${def.skip ? h`<span class="skipwhy">${def.skip}</span>` : ''}
        ${replay ? h`<span class="rp rp-${replay.status}">${replay.status === 'running' ? h`${icon('dot')} Replaying` : replay.status === 'passed' ? h`${icon('check')} Replay ${dur(replay.durationMs)}` : h`${icon('cross')} Replay failed`}</span>` : ''}
      </div>
      ${reps.map(r => chainHTML(m, s, r))}
      ${isRunning ? h`<pre class="tail live" data-log="${s.id}">${tailLines(logText, 14)}</pre>` : ''}
      ${!isRunning && replay?.status === 'running' ? h`<pre class="tail live replay" data-log="${s.id}">${tailLines(s.replayLog, 8)}</pre>` : ''}
      ${!isRunning && logText ? h`<details class="log" data-log-id="${s.id}" ${open ? 'open' : ''}><summary>Log, attempt ${la?.n ?? 1}${la?.logFile ? h` <span class="lf">${la.logFile}</span>` : ''}</summary><pre>${raw(colorLog(logText))}</pre></details>` : ''}
    </article>
  </li>`;
}

const tailLines = (t, n) => (t || '').replace(/\n$/, '').split('\n').slice(-n).join('\n');
function colorLog(t) {
  return (t || '').split('\n').map(l => isErrorLine(l) ? `<span class="le">${esc(l)}</span>` : l.startsWith('[firstrun]') ? `<span class="lfr">${esc(l)}</span>` : esc(l)).join('\n');
}

// ---------------------------------------------------------------- evidence drawer
export function evidenceDrawerHTML(runId, e) {
  const d = e.diagnosis || {};
  const bob = d.by === 'bob';
  const logPane = (a, kind) => {
    if (!a) return h`<section class="ev-pane ev-${kind} ev-none"><header><span class="lk">${icon('hand')} No passing attempt</span></header><div class="ev-empty"><p>The repair did not produce a passing run. The step was escalated to a human.</p><p class="mono">${e.fix?.doc?.text || ''}</p></div></section>`;
    return h`<section class="ev-pane ev-${kind}">
      <header><span class="lk">${icon(kind === 'before' ? 'cross' : 'check')} ${kind === 'before' ? 'Before' : 'After'}</span>
        <span class="mono">attempt ${a.n} · exit ${a.exitCode} · ${dur(a.durationMs)}</span></header>
      <code class="ev-cmd">$ ${a.command}</code>
      <pre>${raw(colorLog(a.logTail || '(no output)'))}</pre>
      <a class="ev-file" href="/api/runs/${encodeURIComponent(runId)}/file?path=${encodeURIComponent(a.logFile || '')}" target="_blank" rel="noopener">${icon('file')} ${a.logFile}</a>
    </section>`;
  };
  return h`<div class="drawer-backdrop" data-close></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Evidence ${e.id}">
    <header class="dr-head">
      <div class="dr-title"><span class="dr-id">${e.id}</span><span>Step ${e.stepId}</span><span class="chip c-${e.status === 'verified' ? 'passed' : e.status === 'needs-human' ? 'needs-human' : e.status === 'progressed' ? 'repaired' : 'failed'}">${e.status === 'verified' ? 'Verified' : e.status === 'needs-human' ? 'Needs a human' : e.status === 'progressed' ? 'Worked, next error' : 'Failed'}</span></div>
      <button class="icon-btn" data-close aria-label="Close evidence">${icon('close')}</button>
    </header>
    <div class="dr-diag ${bob ? 'by-bob' : ''}">
      <span class="cls">${CLASS_LABEL[d.class] || d.class}</span>
      <p class="cause">${d.cause}</p>
      <div class="by">${bob ? h`${icon('bob')} Diagnosed by IBM Bob · ${d.bobcoins} Bobcoins` : h`Diagnosed by rules${d.ruleId ? h` · <code>${d.ruleId}</code>` : ''}`}
        <span class="meter" title="confidence"><i style="width:${Math.round((d.confidence || 0) * 100)}%"></i></span><span class="mono">${Math.round((d.confidence || 0) * 100)}% confidence</span>
        <span class="at mono">${new Date(e.at).toISOString().replace('T', ' ').slice(0, 19)} UTC</span></div>
    </div>
    <div class="ev-grid">
      ${logPane(e.before, 'before')}
      <section class="ev-pane ev-fix">
        <header><span class="lk">${icon('wrench')} Fix</span></header>
        <ol class="ev-actions">${(e.fix?.actions || []).map(a => h`<li>${fixActionText(a)}</li>`)}${(e.fix?.actions || []).length ? '' : h`<li>No automatic action is safe here.</li>`}</ol>
        <div class="ev-doc"><span>${DOC_LABEL[e.fix?.doc?.kind] || 'README'}</span><code>${e.fix?.doc?.text || ''}</code></div>
      </section>
      ${logPane(e.after, 'after')}
    </div>
  </aside>`;
}

// ---------------------------------------------------------------- mount
export function mountRun(root, runId, sub) {
  let m = createModel({ id: runId });
  let live = false;
  let closed = false;
  let es = null;
  let diffLoaded = false;
  const openLogs = new Set();
  const sigs = {};
  let sideSig = '';
  let followUntil = 0;
  let lastRunning = null;
  let passportFresh = false;

  root.innerHTML = String(h`<div class="run">
    <header class="run-head" id="rh"></header>
    <section class="agents" id="agents" aria-label="Agent swarm"></section>
    <div class="run-body">
      <main class="timeline">
        <div class="tl-head"><h2>The README, followed to the letter</h2><p id="tl-sub"></p></div>
        <ol class="steps" id="steps"></ol>
        <section class="diff-wrap" id="diff" hidden></section>
      </main>
      <aside class="side" id="side"></aside>
    </div>
    <div id="drawer"></div>
  </div>`);
  const $ = sel => root.querySelector(sel);

  const render = rafBatch(() => { if (!closed) draw(); });

  function draw() {
    drawReplayBar();
    drawHead();
    drawAgents();
    drawSteps();
    drawSide();
    if (!diffLoaded && m.artifacts['README.diff']) loadDiff();
  }

  /** The hosted demo's replay controller (web/static-shim.js), or a fallback that only
   * changes speed / restarts via the URL; that one cannot pause, so no Pause button. */
  function replayCtrl() {
    if (window.__firstrunReplay) return window.__firstrunReplay;
    const params = new URLSearchParams(location.search);
    return {
      speed: Number(params.get('replay')) || 1,
      paused: false,
      setSpeed(sp) { const u = new URL(location.href); u.searchParams.set('replay', sp); location.href = u.href; },
      restart() { location.reload(); },
    };
  }

  function drawReplayBar() {
    const bar = $('#replay-bar');
    if (!bar) return;
    const params = new URLSearchParams(location.search);
    const isReplay = window.__firstrunReplay?.active || params.has('replay');
    if (!isReplay) { bar.innerHTML = ''; bar.hidden = true; return; }

    const ctrl = replayCtrl();
    const spd = ctrl.speed || 1;
    const paused = !!ctrl.paused;

    bar.hidden = false;
    bar.innerHTML = String(h`
      <div class="rp-control-bar">
        <div class="rp-badge">
          <span class="rp-dot ${paused ? 'paused' : 'playing'}"></span>
          <span class="rp-title">REPLAY MODE</span>
        </div>
        <div class="rp-actions">
          ${ctrl.togglePause ? h`<button class="btn btn-rp-toggle ${paused ? 'is-paused' : ''}" data-rp-action="toggle">
            ${paused ? '▶ Play' : '⏸ Pause'}
          </button>` : ''}
          <div class="rp-speeds">
            ${[1, 4, 8].map(s => h`
              <button class="btn btn-rp-speed ${spd === s ? 'active' : ''}" data-rp-speed="${s}">${s}x</button>
            `)}
          </div>
          <button class="btn btn-rp-restart" data-rp-action="restart" title="Restart replay">
            ↺ Restart
          </button>
        </div>
      </div>
    `);
  }

  function drawHead() {
    const [org, name] = (m.repo || m.plan?.repo || runId).split('/');
    const end = m.finishedAt ? Date.parse(m.finishedAt) : (live && m.phase !== 'done' ? Date.now() : Date.parse(m.lastT));
    const elapsed = m.startedAt ? end - Date.parse(m.startedAt) : 0;
    const cur = m.phase;
    const seen = new Set(m.phasesSeen);
    const curIdx = PHASES.indexOf(cur);
    const phases = PHASES.map((p, i) => {
      let cls = 'todo';
      if (p === cur && cur !== 'done') cls = 'now';
      else if (cur === 'done' || i < curIdx || (seen.has(p) && p !== cur)) cls = 'did';
      if (p === 'repair' && !seen.has('repair') && (cur === 'done' || curIdx > 3)) cls = 'skip';
      if (cur === 'done' && seen.size && !seen.has(p) && p !== 'done') cls = 'skip';
      if (p === 'done' && cur === 'done') cls = 'did end';
      return h`<li class="ph ph-${cls}"><span>${PHASE_LABEL[p]}</span></li>`;
    });
    const image = m.plan?.image || '';
    $('#rh').innerHTML = String(h`
      <div class="rh-id">
        <div class="rh-repo">${name ? h`<span class="org">${org}/</span>${name}` : org}</div>
        <div class="rh-meta"><span class="sha" title="${m.commit}">@ ${short(m.commit || m.plan?.commit)}</span>${image ? h`<span class="img">${image}</span>` : ''}</div>
      </div>
      <ol class="phase-track" aria-label="Phase">${phases}</ol>
      <div class="rh-gauges">
        <div class="gauge"><span class="gl">Elapsed</span><span class="gv mono" id="clock">T+${clock(elapsed)}</span></div>
        <div class="gauge g-bob"><span class="gl">Bobcoins</span><span class="gv mono">${m.bobcoins}</span></div>
        ${m.verdict ? h`<div class="gauge g-verdict v-${m.verdict.toLowerCase()}"><span class="gl">Verdict</span><span class="gv">${m.verdict}</span></div>`
                    : h`<div class="gauge g-live ${live && m.phase !== 'done' ? 'on' : ''}"><span class="gl">Stream</span><span class="gv">${live ? 'Live' : 'Loading'}</span></div>`}
        ${m.verdict && m.verdict !== 'FAILED' ? h`<a class="btn" href="#/guide/${runId}">Newcomer guide</a>` : ''}
      </div>`);
  }

  function drawAgents() {
    const act = m.phase === 'done' || m.phase === 'error' ? null : m.activeAgent;
    $('#agents').innerHTML = String(h`${AGENTS.map(a => {
      const has = !!m.agentLast[a];
      return h`<div class="agent ${a === act ? 'on' : ''} ${has ? 'has' : ''}" data-agent="${a}">
        <div class="ag-top"><span class="ag-name">${AGENT_INFO[a].name}</span><span class="ag-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
        <div class="ag-line" title="${agentLine(m, a)}">${agentLine(m, a)}</div>
      </div>`;
    })}`);
  }

  function drawSteps() {
    const ol = $('#steps');
    const ids = m.stepOrder;
    const readme = ids.filter(id => m.steps[id].def?.origin !== 'repair').length;
    $('#tl-sub').textContent = m.plan
      ? `${readme} commands from ${m.plan.steps?.[0]?.source?.file || 'README.md'}, run in order in a clean container, exactly as written.`
      : 'Waiting for the planner.';
    // keyed update
    const existing = new Map([...ol.children].map(li => [li.dataset.id, li]));
    let prev = null;
    for (const id of ids) {
      const s = m.steps[id];
      const sig = [s.status, s.trail.length, s.trail.map(x => x.status || x.evidenceId || '').join(','), s.replay?.status, s.attempts, s.def?.command, openLogs.has(id), m.startedAt].join('|');
      let li = existing.get(id);
      if (!li || sigs[id] !== sig) {
        const tmp = document.createElement('template');
        tmp.innerHTML = String(stepHTML(m, s, openLogs.has(id))).trim();
        const nli = tmp.content.firstElementChild;
        if (li) {
          const oldStatus = li.className.match(/st-([\w-]+)/)?.[1];
          if (live && oldStatus !== s.status) nli.classList.add('flash');
          if (!live) nli.querySelectorAll('.enter').forEach(e => e.classList.remove('enter'));
          else {
            // only animate chain links that are new
            const oldCount = li.querySelectorAll('.chain .lnk:not(.pending):not(.l-wait)').length;
            nli.querySelectorAll('.chain .lnk:not(.pending):not(.l-wait)').forEach((e, k) => { if (k < oldCount) e.classList.remove('enter'); });
          }
          li.replaceWith(nli);
        } else {
          if (!live) nli.querySelectorAll('.enter').forEach(e => e.classList.remove('enter'));
          else nli.classList.add('arrive');
        }
        li = nli;
        sigs[id] = sig;
      }
      // placement
      const want = prev ? prev.nextElementSibling : ol.firstElementChild;
      if (want !== li) ol.insertBefore(li, want);
      prev = li;
      // live log tail
      const pre = li.querySelector('pre.tail');
      if (pre) {
        const t = s.status === 'running' ? tailLines(s.log, 14) : tailLines(s.replayLog, 8);
        if (pre.textContent !== t) pre.textContent = t;
      }
    }
    for (const [id, li] of existing) if (!ids.includes(id)) li.remove();
    // follow the running step while live
    const running = ids.find(id => m.steps[id].status === 'running' || m.steps[id].replay?.status === 'running');
    if (live && running && running !== lastRunning && Date.now() > followUntil) {
      const li = ol.querySelector(`[data-id="${CSS.escape(running)}"]`);
      li?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    lastRunning = running || lastRunning;
  }

  function drawSide() {
    const p = m.passport;
    const ev = m.evidenceOrder.map(id => m.evidence[id]);
    const sig = JSON.stringify([!!p, m.replay, m.plan?.conflicts?.length, ev.map(e => e.id + e.status), Object.keys(m.artifacts), m.phase,
      m.replay?.status === 'running' ? m.stepOrder.map(id => m.steps[id].replay?.status).join() : '']);
    if (sig === sideSig) return;
    sideSig = sig;
    const conflicts = m.plan?.conflicts || [];
    let top;
    if (p) {
      top = passportHTML(p, { fresh: passportFresh, guideHref: p.verdict !== 'FAILED' ? `#/guide/${runId}` : '' });
    } else if (m.replay?.status === 'running') {
      const todo = m.stepOrder.filter(id => !m.steps[id].def?.skip && m.steps[id].status !== 'pending');
      const done = todo.filter(id => ['passed', 'failed'].includes(m.steps[id].replay?.status)).length;
      top = h`<section class="replay-card on"><h3>Replaying the repaired guide</h3>
        <p>A brand-new container follows the corrected steps from zero. The passport is issued only if this pass is clean.</p>
        <div class="rp-bar"><i style="width:${todo.length ? (done / todo.length) * 100 : 0}%"></i></div>
        <div class="rp-count mono">${done} of ${todo.length} steps</div></section>`;
    } else {
      top = h`<section class="replay-card"><h3>Setup Passport</h3>
        <p>Issued after the repaired guide replays cleanly in a fresh container, from clone to running.</p>
        <div class="pp-ghost" aria-hidden="true"></div></section>`;
    }
    const artifacts = Object.entries(m.artifacts);
    $('#side').innerHTML = String(h`
      <div class="side-top">${top}</div>
      ${conflicts.length ? h`<section class="panel conflicts"><h3>README versus the repository</h3>
        <ul>${conflicts.map(c => h`<li><span class="cw">${c.what}</span>
          <span class="cd"><span class="says">README says</span><code>${c.docs}</code></span>
          <span class="ct"><span class="says">${c.source}</span><code>${c.truth}</code></span></li>`)}</ul></section>` : ''}
      <section class="panel ledger"><h3>Evidence ledger <span class="count">${ev.length}</span></h3>
        ${ev.length ? h`<ol>${ev.map(e => h`<li><a href="#/run/${runId}/${e.id}" class="led led-${e.status}">
            <span class="eid">${e.id}</span><span class="estep">${e.stepId}</span>
            <span class="ecls">${CLASS_LABEL[e.diagnosis?.class] || e.diagnosis?.class}</span>
            ${e.diagnosis?.by === 'bob' ? h`<span class="ebob">${icon('bob')} Bob</span>` : h`<span class="erule">rules</span>`}
            <span class="est">${e.status === 'verified' ? icon('check') : icon('hand')}</span></a></li>`)}</ol>`
          : h`<p class="muted">Every repair lands here with its failing log, fix and passing log.</p>`}
      </section>
      ${artifacts.length ? h`<section class="panel artifacts"><h3>Outputs</h3><ul>${artifacts.map(([n, pth]) => h`<li><a href="/api/runs/${encodeURIComponent(runId)}/file?path=${encodeURIComponent(pth)}" target="_blank" rel="noopener">${icon('file')}<span>${n}</span></a></li>`)}</ul></section>` : ''}
    `);
    if (passportFresh) passportFresh = false;
  }

  async function loadDiff() {
    diffLoaded = true;
    try {
      const text = await apiText(`/api/runs/${encodeURIComponent(runId)}/file?path=${encodeURIComponent(m.artifacts['README.diff'])}`);
      const { html, adds, dels } = renderDiff(text, { evidence: m.evidenceOrder.map(id => m.evidence[id]), runId });
      const el = $('#diff');
      el.hidden = false;
      el.innerHTML = String(h`<header class="diff-h"><h2>The corrected README</h2>
        <span class="diff-stat"><span class="c-add">+${adds}</span> <span class="c-del">-${dels}</span></span>
        <p>Every changed line is tagged with the evidence record that justifies it.</p></header>${html}`);
    } catch { diffLoaded = false; }
  }

  // drawer
  async function openDrawer(eid) {
    const host = $('#drawer');
    if (!eid) { host.innerHTML = ''; document.body.classList.remove('drawer-open'); return; }
    let e = m.evidence[eid];
    if (!e) { try { e = await api(`/api/runs/${encodeURIComponent(runId)}/evidence/${encodeURIComponent(eid)}`); } catch { return; } }
    host.innerHTML = String(evidenceDrawerHTML(runId, e));
    document.body.classList.add('drawer-open');
    host.querySelector('.drawer .icon-btn')?.focus();
  }
  const onClick = ev => {
    const btn = ev.target.closest('[data-rp-action], [data-rp-speed]');
    if (btn) {
      const ctrl = replayCtrl();
      if (btn.dataset.rpAction === 'toggle') ctrl.togglePause?.();
      else if (btn.dataset.rpAction === 'restart') ctrl.restart();
      else if (btn.dataset.rpSpeed) ctrl.setSpeed(Number(btn.dataset.rpSpeed));
      drawReplayBar();
      return;
    }
    if (ev.target.closest('[data-close]')) { location.hash = `#/run/${runId}`; }
  };
  const onKey = ev => { if (ev.key === 'Escape' && $('#drawer').innerHTML) location.hash = `#/run/${runId}`; };
  const onToggle = ev => {
    const d = ev.target;
    if (d.matches?.('details.log')) { const id = d.dataset.logId; d.open ? openLogs.add(id) : openLogs.delete(id); sigs[id] = null; }
  };
  const onScroll = () => { followUntil = Date.now() + 5000; };
  root.addEventListener('click', onClick);
  const onReplayChange = () => drawReplayBar();
  window.addEventListener('replaychange', onReplayChange);
  root.addEventListener('toggle', onToggle, true);
  document.addEventListener('keydown', onKey);
  window.addEventListener('wheel', onScroll, { passive: true });

  // clock tick
  const tick = setInterval(() => {
    if (!live || m.finishedAt || !m.startedAt) return;
    const c = $('#clock'); if (c) c.textContent = 'T+' + clock(Date.now() - Date.parse(m.startedAt));
  }, 500);

  // data
  (async () => {
    let rs = null;
    try { rs = await api(`/api/runs/${encodeURIComponent(runId)}`); } catch {}
    if (closed) return;
    if (rs) { m = createModel(rs); m.id = runId; }
    if (!window.EventSource) { if (rs) { m = modelFromRunState(rs); draw(); } return; }
    es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);
    es.onmessage = e => {
      try {
        const evt = JSON.parse(e.data);
        const hadPassport = !!m.passport;
        applyEvent(m, evt);
        if (live && !hadPassport && m.passport) passportFresh = true;
      } catch {}
      if (live) render();
    };
    es.addEventListener('ready', () => {
      if (!m.events && rs) { m = modelFromRunState(rs); m.id = runId; }
      draw(); // backlog: render without entrance motion
      live = true;
      drawHead();
      if (m.phase === 'done' || m.phase === 'error') { /* keep stream open for re-runs */ }
    });
    es.addEventListener('reset', () => {
      m = createModel({ id: runId }); live = false; diffLoaded = false; sideSig = '';
      for (const k in sigs) delete sigs[k];
      $('#steps').innerHTML = ''; $('#diff').hidden = true;
      setTimeout(() => { live = true; render(); }, 50);
    });
    es.onerror = () => { if (!live && rs) { m = modelFromRunState(rs); m.id = runId; draw(); } };
  })();

  draw();

  return {
    route(subRoute) { openDrawer(subRoute); },
    destroy() {
      closed = true; es?.close(); clearInterval(tick);
      root.removeEventListener('click', onClick);
      window.removeEventListener('replaychange', onReplayChange);
      root.removeEventListener('toggle', onToggle, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onScroll);
      document.body.classList.remove('drawer-open');
    },
    init() { if (sub) openDrawer(sub); },
  };
}
