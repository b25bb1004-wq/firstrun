import fs from 'node:fs';
import path from 'node:path';
import { verifyRepo, makeBudget } from './pipeline.js';
import { ensureDir, writeJson, readJson, nowIso, run, slugify } from './util.js';

const WORK = path.resolve(process.env.FIRSTRUN_WORK || '.firstrun-work');

/** Clone (or reuse) a repo at a pinned ref, the way a newcomer would get it. */
export async function fetchRepo(url, ref, { slug } = {}) {
  const name = slug || slugify(url.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\.git$/, '').replace('/', '__'));
  const dir = path.join(WORK, 'repos', name);
  if (!fs.existsSync(path.join(dir, '.git'))) {
    ensureDir(path.dirname(dir));
    const r = await run('git', ['clone', '--quiet', '--filter=blob:none', url, dir], { timeoutMs: 10 * 60_000 });
    if (r.code !== 0) throw new Error(`git clone ${url} failed: ${r.out.trim().split('\n').pop()}`);
  }
  if (ref) {
    let r = await run('git', ['-C', dir, 'checkout', '--quiet', '--force', ref]);
    if (r.code !== 0) {
      await run('git', ['-C', dir, 'fetch', '--quiet', 'origin', ref]);
      r = await run('git', ['-C', dir, 'checkout', '--quiet', '--force', ref]);
      if (r.code !== 0) throw new Error(`cannot check out ${ref}: ${r.out.trim()}`);
    }
  }
  await run('git', ['-C', dir, 'clean', '-fdxq', '-e', '.firstrun']);
  return dir;
}

/**
 * The swarm: one HUMBLE agent team per repository, several at once. Each
 * team scouts, plans, cold-starts, repairs and replays its repo independently;
 * the audit collects every Setup Passport into one scoreboard.
 */
export async function audit(listFile, { concurrency = 3, brain = 'rules', bobBudget = 0, limit, only, id, rerun, root = process.cwd(), onEvent, printer } = {}) {
  const list = readJson(listFile);
  if (!list?.repos?.length) throw new Error(`${listFile} has no repos`);
  let repos = list.repos;
  if (only) repos = repos.filter((r) => only.split(',').includes(r.slug));
  if (limit) repos = repos.slice(0, limit);
  const auditId = id || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
  const dir = ensureDir(path.join(root, 'audit', auditId));
  const eventsFile = path.join(dir, 'events.ndjson');
  if (!fs.existsSync(eventsFile)) fs.writeFileSync(eventsFile, '');
  const prev = readJson(path.join(dir, 'audit.json'));
  const selected = repos.map((r) => prev?.repos?.find((p) => p.slug === r.slug && p.status === 'done' && !(rerun === 'all' || (rerun === 'failed' && p.verdict !== 'VERIFIED'))) || ({ slug: r.slug, url: r.url, ref: r.ref, stack: r.stack, status: 'queued', verdict: null, passport: null, runDir: `runs/${r.slug}` }));
  // --only / --limit rerun a subset: every other repo already in this audit keeps its result.
  const kept = (prev?.repos || []).filter((p) => !selected.some((s) => s.slug === p.slug));
  const order = list.repos.map((r) => r.slug);
  const state = {
    id: auditId, startedAt: prev?.startedAt || nowIso(), source: path.relative(root, listFile).replace(/\\/g, '/'), concurrency, brain,
    repos: [...selected, ...kept].sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug)),
  };
  const save = () => writeJson(path.join(dir, 'audit.json'), { ...state, summary: summarize(state) });
  const emit = (type, data) => {
    const ev = { t: nowIso(), run: auditId, agent: 'swarm', type, data };
    fs.appendFileSync(eventsFile, JSON.stringify(ev) + '\n');
    onEvent?.(ev);
  };
  save();
  for (const r of state.repos) if (r.status === 'queued') emit('repo.queued', { slug: r.slug, url: r.url });

  const budget = makeBudget(bobBudget, 1.5);
  const queue = selected.filter((r) => r.status !== 'done');
  const worker = async () => {
    while (queue.length) {
      const r = queue.shift();
      r.status = 'running';
      r.startedAt = nowIso();
      save();
      emit('repo.start', { slug: r.slug });
      try {
        const src = await fetchRepo(r.url, r.ref, { slug: r.slug });
        const res = await verifyRepo(src, {
          // Audits are the numbers we quote: replay cold (no package cache) so "clone to running" means from zero.
          out: path.join(dir, r.runDir), brain, budget, maxMinutes: 20, cache: false, repoLabel: r.url.replace(/^https:\/\/github\.com\//, ''), id: `${auditId}-${r.slug}`,
          onRecorder: (rec) => {
            printer?.(rec, r.slug);
            rec.on('event', (ev) => {
              if (ev.type === 'step.start') { r.current = ev.data.command; save(); emit('repo.progress', { slug: r.slug, stepId: ev.data.stepId, command: ev.data.command }); }
              if (ev.type === 'phase') { r.phase = ev.data.phase; save(); }
            });
          },
        });
        r.status = 'done';
        r.verdict = res.passport?.verdict || (res.error?.code === 'NO_SETUP_DOCS' ? 'NO-SETUP-DOCS' : 'ERROR');
        r.passport = res.passport || null;
        r.error = res.error?.message;
        r.firstFailure = res.state?.plan?.steps?.find((s) => s.evidence?.length)?.readmeCommand || null;
      } catch (e) {
        r.status = 'done';
        r.verdict = e.code === 'NO_SETUP_DOCS' ? 'NO-SETUP-DOCS' : 'ERROR';
        r.error = e.message;
      }
      r.finishedAt = nowIso();
      delete r.current;
      save();
      emit('repo.done', { slug: r.slug, verdict: r.verdict, passport: r.passport, error: r.error });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));
  state.finishedAt = nowIso();
  save();
  emit('done', summarize(state));
  return { dir, state: { ...state, summary: summarize(state) } };
}

export function summarize(state) {
  const done = state.repos.filter((r) => r.status === 'done');
  const broke = done.filter((r) => (r.passport?.breaksFound || 0) > 0);
  return {
    total: state.repos.length,
    done: done.length,
    brokeOnCleanMachine: broke.length,
    verified: done.filter((r) => r.verdict === 'VERIFIED').length,
    partial: done.filter((r) => r.verdict === 'PARTIAL').length,
    failed: done.filter((r) => r.verdict === 'FAILED' || r.verdict === 'ERROR').length,
    breaksFound: done.reduce((a, r) => a + (r.passport?.breaksFound || 0), 0),
    breaksFixed: done.reduce((a, r) => a + (r.passport?.breaksFixed || 0), 0),
    repairedAutomatically: broke.filter((r) => r.passport?.breaksFixed > 0).length,
  };
}
