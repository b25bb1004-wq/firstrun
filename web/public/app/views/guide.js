// Guide view: a verified run turned into a checklist a newcomer follows on their own machine.
import { createModel, applyEvent } from '../model.js';
import { h, api, apiText, dur, secs, short, icon, store, copyText, errorSignature, CLASS_LABEL } from '../lib.js';
import { stampSVG } from '../passport.js';

function lastLine(t) {
  const ls = (t || '').split('\n').map(x => x.trim()).filter(x => x && !x.startsWith('[firstrun]') && !/^>/.test(x));
  return ls[ls.length - 1] || '';
}

function remedy(e, def) {
  const acts = e.fix?.actions || [];
  const parts = [];
  for (const a of acts) {
    if (a.type === 'rebase') parts.push(h`Switch to the runtime in <code>${a.image}</code> (for example <code>nvm install</code> reads <code>.nvmrc</code>).`);
    else if (a.type === 'service') parts.push(h`Start ${a.name} before this step; it is expected on port ${a.port}.`);
    else if (a.type === 'replace-step') parts.push(h`Run <code>${a.command}</code>, not the README's <code>${def.command}</code>.`);
    else if (a.type === 'insert-before') parts.push(h`Run <code>${a.command}</code> first.`);
    else if (a.type === 'exec') parts.push(h`Run <code>${a.command}</code>.`);
  }
  if (!parts.length && e.fix?.doc?.text) parts.push(h`${e.fix.doc.text}`);
  return parts;
}

function buildGuide(m) {
  const ev = m.evidenceOrder.map(id => m.evidence[id]);
  const steps = [];
  for (const id of m.stepOrder) {
    const s = m.steps[id];
    const def = s.def || {};
    const isClone = /^git clone/.test(def.command || '');
    if (def.skip && !isClone) continue;
    const mine = ev.filter(e => e.stepId === id);
    let command = def.command;
    for (const e of mine) for (const a of e.fix?.actions || []) if (a.type === 'replace-step' && e.status === 'verified') command = a.command;
    // a README change made by a repair elsewhere (e.g. a service added to this compose line)
    for (const e of ev) {
      const doc = e.fix?.doc;
      if (e.status !== 'verified' || doc?.kind !== 'replace-command' || e.stepId === id) continue;
      if (doc.stepId ? doc.stepId === id : (doc.text.startsWith(def.command + ' ') && def.command.length > 6)) command = doc.text;
    }
    if (s.replay?.command && s.replay.status === 'passed') command = s.replay.command; // what actually ran from zero
    const pass = s.replay?.status === 'passed' ? s.replay : [...s.trail].reverse().find(x => x.kind === 'attempt' && x.status === 'passed');
    let expect;
    if (isClone) expect = h`A new <code>${(command.match(/cd\s+(\S+)/) || [])[1] || 'project'}</code> directory with the repository at <code>${short(m.commit)}</code>.`;
    else if (def.kind === 'serve' && def.serve) expect = h`It keeps running and prints <code>${def.serve.readyPattern || 'ready'}</code>${def.serve.port ? h`; the app answers on <code>http://localhost:${def.serve.port}</code>` : ''}. Leave it running and open a second terminal.`;
    else if (pass) { const l = lastLine(pass.logTail); expect = l ? h`It finishes with <code>${l}</code>` : h`It finishes quietly with exit code 0.`; }
    else expect = h`It finishes with exit code 0.`;
    const trouble = mine.map(e => ({
      sig: errorSignature(e.before?.logTail), cls: e.diagnosis?.class, cause: e.diagnosis?.cause,
      doc: e.fix?.doc, human: e.status === 'needs-human', id: e.id, todo: remedy(e, def),
    }));
    const insertedBy = def.origin === 'repair' ? ev.find(e => (e.fix?.actions || []).some(a => a.type === 'insert-before' && a.command === def.command)) : null;
    steps.push({ id, command, expect, trouble, insertedBy, took: pass?.durationMs, human: s.status === 'needs-human', kind: def.kind });
  }
  const prereqs = [];
  const docPre = ev.filter(e => e.fix?.doc?.kind === 'prerequisite' && e.status === 'verified');
  const runtimeDoc = docPre.find(e => (e.fix.actions || []).some(a => a.type === 'rebase'));
  if (runtimeDoc) prereqs.push(h`<b>${runtimeDoc.fix.doc.text}</b>`);
  else if (m.passport?.runtime) prereqs.push(h`<b>${m.passport.runtime}</b> (verified in <code>${m.passport.image}</code>)`);
  for (const e of docPre) if (e !== runtimeDoc) prereqs.push(h`${e.fix.doc.text}`);
  const services = ev.flatMap(e => (e.fix?.actions || []).filter(a => a.type === 'service'));
  const composeSteps = m.stepOrder.filter(id => m.steps[id].def?.kind === 'services');
  const names = [...new Set([...(m.facts?.compose?.services || []).map(x => String(x).split(':')[0]), ...services.map(s => s.name)])];
  if (composeSteps.length || services.length) prereqs.push(h`Docker, to run ${names.length ? names.join(' and ') : 'the backing services'}`);
  return { steps, prereqs };
}

export function mountGuide(root, runId) {
  let closed = false;
  root.innerHTML = String(h`<div class="guide"><p class="muted">Loading the verified guide...</p></div>`);
  const load = async () => {
    const m = createModel({ id: runId });
    try {
      const rs = await api(`/api/runs/${encodeURIComponent(runId)}`);
      Object.assign(m, { repo: rs.repo, commit: rs.commit, startedAt: rs.startedAt });
      const text = await apiText(`/api/runs/${encodeURIComponent(runId)}/file?path=events.ndjson`);
      for (const l of text.split('\n')) { if (l.trim()) try { applyEvent(m, JSON.parse(l)); } catch {} }
      if (!m.passport && rs.passport) m.passport = rs.passport;
    } catch {
      root.innerHTML = String(h`<div class="guide"><h1>No run called ${runId}</h1><p><a href="#/">Back to the flight log</a></p></div>`);
      return;
    }
    if (closed) return;
    const key = `firstrun.guide.${runId}.${short(m.commit)}`;
    const done = store.get(key, {});
    const g = buildGuide(m);
    const p = m.passport;
    const [org, name] = (m.repo || '').split('/');
    const draw = () => {
      const n = g.steps.filter(s => done[s.id]).length;
      root.innerHTML = String(h`<div class="guide">
        <header class="g-head">
          <div>
            <a class="back" href="#/run/${runId}">${icon('back')} Back to the run</a>
            <h1>Set up <span class="org">${org}/</span>${name} on your machine</h1>
            <p class="g-lede">${p ? h`Every command below was replayed from zero in a clean container at <code>${short(m.commit)}</code>${p.verdict === 'VERIFIED' && p.replaySeconds ? h` and reached a running app in <b>${secs(p.replaySeconds)}</b>` : h`; the steps marked <b>You will need</b> could not be finished without a human`}. Where the original README broke, you will see what the failure looks like and what fixed it.` : 'This run has not finished yet; the guide fills in once it has a passport.'}</p>
          </div>
          ${p ? h`<div class="g-stamp v-${p.verdict.toLowerCase()}">${stampSVG(p, { size: 132 })}</div>` : ''}
        </header>
        <div class="g-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${g.steps.length}" aria-valuenow="${n}">
          <div class="g-bar"><i style="width:${g.steps.length ? (n / g.steps.length) * 100 : 0}%"></i></div>
          <span class="mono">${n} of ${g.steps.length} done</span>
          ${n ? h`<button class="linkish" data-reset>Start over</button>` : ''}
        </div>
        ${g.prereqs.length ? h`<section class="g-pre"><h2>Before you start</h2><ul>${g.prereqs.map(x => h`<li>${x}</li>`)}</ul></section>` : ''}
        <ol class="g-steps">${g.steps.map((s, i) => h`<li class="g-step ${done[s.id] ? 'done' : ''} ${s.human ? 'is-human' : ''}" data-id="${s.id}">
          <button class="g-check" data-check="${s.id}" aria-pressed="${done[s.id] ? 'true' : 'false'}" aria-label="Mark step ${i + 1} done">${icon('check')}</button>
          <div class="g-body">
            <div class="g-n"><span>Step ${i + 1}</span>${s.took ? h`<span class="mono">about ${dur(s.took)}</span>` : ''}${s.insertedBy ? h`<span class="g-new">${icon('wrench')} Missing from the original README</span>` : ''}</div>
            <div class="g-cmd"><code>${s.command}</code><button class="copy" data-copy="${s.command}">${icon('copy')}<span>Copy</span></button></div>
            ${s.insertedBy ? h`<p class="g-why">Why: ${s.insertedBy.diagnosis?.cause}</p>` : ''}
            <p class="g-expect"><span class="lbl">Expect</span> ${s.expect}</p>
            ${s.trouble.map(t => t.human
              ? h`<div class="g-trouble human"><span class="lbl">${icon('hand')} You will need</span><p>${t.doc?.text || t.cause}</p><p class="g-sig">Without it you will see <code>${t.sig}</code></p></div>`
              : h`<div class="g-trouble"><span class="lbl">If you see</span><code class="g-sig-c">${t.sig}</code><span class="lbl">it means</span><p>${t.cause}</p>${t.todo.length ? h`<span class="lbl">do this</span><p>${t.todo.map(x => h`${x} `)}</p>` : ''}<a class="g-ev" href="#/run/${runId}/${t.id}">${t.id}</a></div>`)}
          </div>
        </li>`)}</ol>
        ${n === g.steps.length && g.steps.length ? h`<p class="g-finish">${icon('check')} You are set up. That took HUMBLE ${p?.replaySeconds ? secs(p.replaySeconds) : 'a few minutes'} from zero.</p>` : ''}
      </div>`);
    };
    draw();
    root.onclick = async e => {
      const c = e.target.closest('[data-check]');
      if (c) { const id = c.dataset.check; done[id] = !done[id]; if (!done[id]) delete done[id]; store.set(key, done); draw(); return; }
      const cp = e.target.closest('[data-copy]');
      if (cp) { const ok = await copyText(cp.dataset.copy); const sp = cp.querySelector('span'); sp.textContent = ok ? 'Copied' : 'Copy failed'; cp.classList.add('ok'); setTimeout(() => { sp.textContent = 'Copy'; cp.classList.remove('ok'); }, 1400); return; }
      if (e.target.closest('[data-reset]')) { for (const k in done) delete done[k]; store.set(key, done); draw(); }
    };
  };
  load();
  return { destroy() { closed = true; root.onclick = null; } };
}
