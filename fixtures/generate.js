#!/usr/bin/env node
// Regenerates every fixture under fixtures/runs and fixtures/audit/demo from the scenario
// specs below. Output follows docs/ARCHITECTURE.md exactly (run dir layout, types, events).
//   node fixtures/generate.js
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createModel, applyEvent, toRunState } from '../ui/model.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const iso = ms => new Date(ms).toISOString();
const sha = s => crypto.createHash('sha1').update(s).digest('hex');

// ---------------------------------------------------------------- diff
export function unifiedDiff(a, b, file = 'README.md', ctx = 3) {
  const A = a.split('\n'), B = b.split('\n');
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push([' ', A[i], i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push(['-', A[i], i, j]); i++; }
    else { ops.push(['+', B[j], i, j]); j++; }
  }
  while (i < n) { ops.push(['-', A[i], i, j]); i++; }
  while (j < m) { ops.push(['+', B[j], i, j]); j++; }
  const changed = ops.map((o, k) => (o[0] !== ' ' ? k : -1)).filter(k => k >= 0);
  if (!changed.length) return '';
  const ranges = [];
  for (const k of changed) {
    const lo = Math.max(0, k - ctx), hi = Math.min(ops.length - 1, k + ctx);
    const last = ranges[ranges.length - 1];
    if (last && lo <= last[1] + 1) last[1] = hi; else ranges.push([lo, hi]);
  }
  let out = `--- a/${file}\n+++ b/${file}\n`;
  for (const [lo, hi] of ranges) {
    const slice = ops.slice(lo, hi + 1);
    const oldCount = slice.filter(o => o[0] !== '+').length;
    const newCount = slice.filter(o => o[0] !== '-').length;
    out += `@@ -${slice[0][2] + 1},${oldCount} +${slice[0][3] + 1},${newCount} @@\n`;
    for (const o of slice) out += o[0] + o[1] + '\n';
  }
  return out;
}

// ---------------------------------------------------------------- run builder
class Run {
  constructor(spec) {
    this.spec = spec;
    this.id = spec.id;
    this.t = Date.parse(spec.start);
    this.events = [];
    this.files = {};
    this.eCount = 0;
    this.evidence = [];
  }
  wait(ms) { this.t += ms; }
  ev(agent, type, data, dt = 0) {
    this.t += dt;
    this.events.push({ t: iso(this.t), run: this.id, agent, type, data });
  }
  attempt(agent, stepId, n, command, lines, { exit = 0, ms = 1000, prefix = '' } = {}) {
    const logFile = `logs/${prefix}${stepId}-${n}.log`;
    const t0 = this.t;
    this.ev(agent, 'step.start', { stepId, n, command });
    const body = lines.length ? lines : [];
    const chunks = Math.max(1, Math.min(body.length, Math.round(ms / 900)));
    const size = Math.ceil(body.length / chunks) || 1;
    const gap = ms / (chunks + 1);
    for (let k = 0; k < body.length; k += size)
      this.ev(agent, 'step.log', { stepId, n, chunk: body.slice(k, k + size).join('\n') + '\n' }, gap);
    this.t = t0 + ms;
    const attempt = { stepId, n, command, exitCode: exit, durationMs: ms,
      logTail: body.slice(-60).join('\n'), logFile };
    this.files[logFile] = `$ ${command}\n${body.join('\n')}${body.length ? '\n' : ''}[firstrun] exit ${exit} after ${(ms / 1000).toFixed(1)}s\n`;
    this.ev(agent, 'step.end', { ...attempt, status: exit === 0 ? 'passed' : 'failed' });
    return attempt;
  }
}

function sourceOf(readme, command) {
  const lines = readme.split('\n');
  let section = '';
  for (let k = 0; k < lines.length; k++) {
    if (lines[k].startsWith('## ')) section = lines[k].slice(3).trim();
    if (lines[k].trim() === command) return { file: 'README.md', line: k + 1, section };
  }
  return { file: 'README.md', line: 1, section: section || 'README' };
}

function buildRun(spec) {
  const r = new Run(spec);
  const commit = sha(spec.repo + '@' + spec.id);
  const S = spec.steps;
  const readmeSteps = S.map(s => ({
    id: s.id, command: s.cmd, kind: s.kind, source: sourceOf(spec.readme, s.cmd), origin: 'readme',
    ...(s.cwd ? { cwd: s.cwd } : {}), ...(s.skip ? { skip: s.skip } : {}), ...(s.serve ? { serve: s.serve } : {}),
  }));
  const plan = {
    repo: spec.repo, commit, image: spec.image0,
    runtime: spec.runtime, steps: readmeSteps, conflicts: spec.conflicts || [], verify: spec.verify,
  };

  // scout + plan
  r.ev('scout', 'phase', { phase: 'scout' });
  r.ev('scout', 'facts', spec.facts, spec.scoutMs || 2800);
  r.ev('planner', 'phase', { phase: 'plan' }, 120);
  r.ev('planner', 'plan', structuredClone(plan), spec.planMs || 1900);
  r.ev('runner', 'phase', { phase: 'coldstart' }, 300);
  r.wait(spec.bootMs || 6400); // clean container boot + workspace copy

  let image = spec.image0;
  let halted = false;
  const finalCmd = {};
  const inserted = []; // {before, step}
  let rCount = 0;

  for (const s of S) {
    if (s.skip) continue;
    let cmd = s.cmd;
    const fails = s.fails || [];
    let prev = null;
    let n = 1;
    for (let k = 0; k <= fails.length; k++) {
      const f = fails[k];
      const isFail = k < fails.length;
      const pre = prev?.f.preLog ? prev.f.preLog : [];
      const lines = [...pre, ...(isFail ? f.log : s.ok.log)];
      const att = r.attempt('runner', s.id, n, cmd, lines,
        { exit: isFail ? (f.exit ?? 1) : 0, ms: isFail ? (f.ms ?? 1500) : s.ok.ms });
      if (prev) {
        r.ev('doctor', 'evidence', evidence(r, s.id, prev.before, prev.diag, prev.fix, att, 'verified'), 60);
        r.ev('runner', 'phase', { phase: 'coldstart' }, 40);
      }
      if (!isFail) break;
      // repair loop
      r.ev('doctor', 'phase', { phase: 'repair' }, 150);
      const diag = { class: f.cls, cause: f.cause, by: f.by || 'rules', confidence: f.conf ?? 0.97 };
      if (f.ruleId) diag.ruleId = f.ruleId;
      if (f.by === 'bob') {
        diag.bobcoins = f.coins;
        r.wait(f.bobMs || 5200);
        r.ev('doctor', 'bob', { mode: 'diagnose', bobcoins: f.coins, ok: true, taskId: 'bob-' + sha(s.id + f.cause).slice(0, 10) });
      }
      r.ev('doctor', 'diagnosis', { stepId: s.id, diagnosis: diag }, f.by === 'bob' ? 400 : 700);
      r.ev('doctor', 'fix', { stepId: s.id, fix: f.fix }, 500);
      for (const a of f.fix.actions) {
        if (a.type === 'rebase') { image = a.image; r.wait(8200); }
        if (a.type === 'service') r.wait(2600);
        if (a.type === 'replace-step') cmd = a.command;
        if (a.type === 'insert-before') {
          rCount++;
          const step = { id: `R${rCount}`, command: a.command, kind: a.kind, source: sourceOf(spec.readme, s.cmd), origin: 'repair' };
          inserted.push({ before: s.id, step, ok: f.insertOk || { ms: 400, log: [] } });
          const steps = [];
          for (const x of plan.steps) {
            if (x.id === s.id) steps.push(step);
            steps.push(x);
          }
          plan.steps = steps;
          r.ev('planner', 'plan', structuredClone({ ...plan, image }), 200);
          r.attempt('runner', step.id, 1, step.command, (f.insertOk || { log: [] }).log, { ms: (f.insertOk || {}).ms || 400 });
        }
      }
      if (f.human) {
        r.ev('doctor', 'evidence', evidence(r, s.id, att, diag, f.fix, null, 'needs-human'), 300);
        r.ev('runner', 'phase', { phase: 'coldstart' }, 40);
        if (f.halt) halted = true;
        break;
      }
      prev = { f, before: att, diag, fix: f.fix };
      n++;
      r.wait(300);
    }
    finalCmd[s.id] = cmd;
    if (halted) break;
    r.wait(s.gapMs ?? 250);
  }
  plan.image = image;
  // README command changes made by a repair on another step (e.g. a service added to the compose line)
  for (const e of r.evidence) {
    const doc = e.fix?.doc;
    if (e.status !== 'verified' || doc?.kind !== 'replace-command') continue;
    for (const s of S) if (s.id !== e.stepId && !s.skip && doc.text.startsWith(s.cmd + ' ')) finalCmd[s.id] = doc.text;
  }

  // replay
  let replay = null;
  const human = r.evidence.filter(e => e.status === 'needs-human');
  if (!halted) {
    r.ev('verifier', 'phase', { phase: 'replay' }, 900);
    r.ev('verifier', 'replay.start', { status: 'running', durationMs: 0 }, 50);
    const t0 = r.t;
    r.wait(spec.replayPreMs || 15000);
    let failedStep;
    for (const s of S) {
      if (s.skip) continue;
      for (const ins of inserted.filter(x => x.before === s.id))
        r.attempt('verifier', ins.step.id, 1, ins.step.command, ins.ok.log, { ms: ins.ok.ms, prefix: 'replay-' });
      const h = human.find(e => e.stepId === s.id);
      if (h) {
        r.attempt('verifier', s.id, 1, finalCmd[s.id], h.before.logTail.split('\n'), { exit: h.before.exitCode, ms: h.before.durationMs, prefix: 'replay-' });
        failedStep = s.id;
        break;
      }
      const ms = s.replayMs || s.ok.ms;
      r.attempt('verifier', s.id, 1, finalCmd[s.id], [...(s.replayLog || s.ok.log)], { ms, prefix: 'replay-' });
      r.wait(120);
    }
    r.wait(spec.replayPostMs || 1500);
    const durationMs = spec.replayTotalMs && !failedStep ? spec.replayTotalMs : r.t - t0;
    r.t = t0 + durationMs;
    replay = { status: failedStep ? 'failed' : 'passed', durationMs, ...(failedStep ? { failedStep } : {}) };
    r.ev('verifier', 'replay.end', replay);
  }

  // publish
  r.ev('scribe', 'phase', { phase: 'publish' }, 400);
  const verdict = halted ? 'FAILED' : (human.length || replay?.status === 'failed') ? 'PARTIAL' : 'VERIFIED';
  const bobcoins = Math.round(r.evidence.reduce((a, e) => a + (e.diagnosis.bobcoins || 0), 0) * 100) / 100;
  const passport = {
    repo: spec.repo, commit, verifiedAt: iso(r.t + 2600), verdict, image,
    runtime: `${spec.runtimeFinal || spec.runtime.name + ' ' + spec.runtime.version}`,
    stepsTotal: plan.steps.length, stepsFromReadme: S.length,
    breaksFound: r.evidence.length,
    breaksFixed: r.evidence.filter(e => e.status === 'verified').length,
    needsHuman: human.length,
    replaySeconds: replay ? Math.round(replay.durationMs / 1000) : 0,
    bobcoins,
  };
  const readmeFixed = spec.readmeFixed(passport);
  const diff = unifiedDiff(spec.readme, readmeFixed);
  r.files['out/README.md'] = readmeFixed;
  r.files['out/README.diff'] = diff;
  r.ev('scribe', 'artifact', { name: 'README.md', path: 'out/README.md' }, 700);
  r.ev('scribe', 'artifact', { name: 'README.diff', path: 'out/README.diff' }, 150);
  if (spec.envExample) {
    r.files['out/.env.example'] = spec.envExample;
    r.ev('scribe', 'artifact', { name: '.env.example', path: 'out/.env.example' }, 200);
  }
  r.files['out/FIRSTRUN.md'] = report(spec, passport, r.evidence);
  r.ev('scribe', 'artifact', { name: 'FIRSTRUN.md', path: 'out/FIRSTRUN.md' }, 500);
  r.files['out/passport.json'] = JSON.stringify(passport, null, 2) + '\n';
  r.files['out/passport.svg'] = badge(passport);
  r.ev('scribe', 'artifact', { name: 'passport.json', path: 'out/passport.json' }, 300);
  r.ev('scribe', 'artifact', { name: 'passport.svg', path: 'out/passport.svg' }, 80);
  r.ev('scribe', 'passport', passport, 400);
  r.ev('scribe', 'phase', { phase: 'done' }, 100);
  r.ev('scribe', 'done', { verdict }, 20);

  r.files['plan.json'] = JSON.stringify(plan, null, 2) + '\n';
  const m = createModel({ id: spec.id, repo: spec.repo, commit });
  for (const e of r.events) applyEvent(m, e);
  r.files['run.json'] = JSON.stringify(toRunState(m), null, 2) + '\n';
  r.files['events.ndjson'] = r.events.map(e => JSON.stringify(e)).join('\n') + '\n';
  for (const e of r.evidence) r.files[`evidence/${e.id}.json`] = JSON.stringify(e, null, 2) + '\n';
  return { files: r.files, passport, commit };
}

function evidence(r, stepId, before, diagnosis, fix, after, status) {
  const rec = { id: `E${++r.eCount}`, stepId, before, diagnosis, fix, after, status, at: iso(r.t) };
  r.evidence.push(rec);
  return rec;
}

function report(spec, p, ev) {
  const lines = [`# FirstRun report: ${spec.repo}`, '', `Verdict: **${p.verdict}** at \`${p.commit.slice(0, 7)}\` in \`${p.image}\`.`, '',
    `Clone to running from zero: ${Math.floor(p.replaySeconds / 60)}m${String(p.replaySeconds % 60).padStart(2, '0')}s.`, '', '## Repairs', ''];
  for (const e of ev) lines.push(`- ${e.id} (${e.stepId}) ${e.diagnosis.class}: ${e.diagnosis.cause} (${e.status}, diagnosed by ${e.diagnosis.by === 'bob' ? 'IBM Bob' : 'rules'})`);
  return lines.join('\n') + '\n';
}

function badge(p) {
  const color = { VERIFIED: '#1f9d57', PARTIAL: '#c98a12', FAILED: '#d23c3f' }[p.verdict];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="176" height="20" role="img" aria-label="FirstRun: ${p.verdict}"><rect width="72" height="20" fill="#28323d"/><rect x="72" width="104" height="20" fill="${color}"/><g fill="#fff" font-family="Verdana,sans-serif" font-size="11"><text x="8" y="14">FirstRun</text><text x="80" y="14">${p.verdict} ${Math.floor(p.replaySeconds / 60)}m${String(p.replaySeconds % 60).padStart(2, '0')}s</text></g></svg>\n`;
}

// ---------------------------------------------------------------- log helpers
const npmHttp = pkgs => pkgs.map((p, k) => `npm http fetch GET 200 https://registry.npmjs.org/${p} ${40 + ((k * 37) % 180)}ms (cache miss)`);
const genericReadme = (title, blurb, prereqs, cmds, extra = '') =>
  `# ${title}\n\n${blurb}\n\n## Prerequisites\n\n${prereqs.map(p => `- ${p}`).join('\n')}\n\n## Getting started\n\n\`\`\`bash\n${cmds.join('\n')}\n\`\`\`\n${extra}\n## License\n\nMIT\n`;
const stamp = p => `\n> Setup verified by FirstRun at \`${p.commit.slice(0, 7)}\` in \`${p.image}\`: clone to running in ${Math.floor(p.replaySeconds / 60)}m${String(p.replaySeconds % 60).padStart(2, '0')}s.\n`;

// ---------------------------------------------------------------- acme-shop (the hero run)
const ACME_README = `# Acme Shop

A small storefront API and admin UI built with Express, Postgres and Vite.

## Prerequisites

- Node.js 16
- Docker (for Postgres)

## Getting started

\`\`\`bash
git clone https://github.com/acme-labs/acme-shop.git && cd acme-shop
npm install
cp .env.sample .env
docker compose up -d postgres
npm run migrate
npm run seed
npm run build
npm run dev
\`\`\`

The app is now running at http://localhost:3000.

## Tests

\`\`\`bash
npm test
\`\`\`

## License

MIT
`;

const acmeFixed = p => `# Acme Shop

A small storefront API and admin UI built with Express, Postgres and Vite.
${stamp(p)}
## Prerequisites

- Node.js 20.11.1 (see \`.nvmrc\`; \`.npmrc\` sets \`engine-strict\`, so older versions fail at \`npm install\`)
- Docker (for Postgres and Redis)

## Getting started

\`\`\`bash
git clone https://github.com/acme-labs/acme-shop.git && cd acme-shop
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run db:migrate
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
npm run seed
npm run build
npm run dev
\`\`\`

The app is now running at http://localhost:3000.

## Tests

\`\`\`bash
npm test
\`\`\`

## License

MIT
`;

const acmeInstallOk = [
  'npm WARN deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it.',
  'npm WARN deprecated glob@7.2.3: Glob versions prior to v9 are no longer supported',
  ...npmHttp(['express', 'pg', 'knex', 'ioredis', 'zod', 'connect-redis', 'express-session', 'pino', 'vite', '@vitejs/plugin-react', 'react', 'react-dom', 'tsx', 'typescript', 'vitest', 'supertest', 'esbuild', '@esbuild/linux-x64', 'rollup', '@rollup/rollup-linux-x64-gnu']),
  'npm WARN deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported',
  '',
  '> acme-shop@2.4.0 postinstall',
  '> husky install || true',
  '',
  "husky - .git can't be found (see https://typicode.github.io/husky/#/?id=custom-directory)",
  '',
  'added 1184 packages, and audited 1185 packages in 41s',
  '',
  '187 packages are looking for funding',
  '  run `npm fund` for details',
  '',
  'found 0 vulnerabilities',
];

const ACME = {
  id: 'acme-shop', repo: 'acme-labs/acme-shop', start: '2026-09-25T09:12:04.000Z',
  image0: 'node:16-bookworm',
  runtime: { name: 'node', version: '16', source: 'README.md#Prerequisites' },
  runtimeFinal: 'node 20.11.1',
  readme: ACME_README, readmeFixed: acmeFixed,
  verify: { kind: 'http', target: 'http://localhost:3000/health' },
  facts: {
    languages: ['typescript', 'javascript'],
    manifests: ['package.json', 'package-lock.json', '.nvmrc', '.npmrc'],
    ci: ['.github/workflows/ci.yml'],
    compose: { file: 'docker-compose.yml', services: ['postgres:15-alpine', 'redis:7-alpine'] },
    envTemplates: ['.env.example'],
    readme: { file: 'README.md', setupSections: ['Getting started', 'Tests'], commands: 9 },
    runtimeHints: [
      { source: 'README.md', says: 'Node.js 16' },
      { source: '.nvmrc', says: '20.11.1' },
      { source: 'package.json engines', says: '>=20.11.0' },
      { source: '.github/workflows/ci.yml', says: 'node-version: 20' },
    ],
  },
  conflicts: [
    { what: 'Node version', docs: 'Node 16', truth: '20.11.1', source: '.nvmrc, package.json engines (>=20.11.0)' },
    { what: 'Env template', docs: '.env.sample', truth: '.env.example', source: 'repository tree' },
    { what: 'Services', docs: 'Postgres', truth: 'Postgres 15 and Redis 7', source: 'docker-compose.yml' },
    { what: 'Migration script', docs: 'npm run migrate', truth: 'npm run db:migrate', source: 'package.json scripts' },
  ],
  envExample: 'NODE_ENV=development\nPORT=3000\nDATABASE_URL=postgres://acme:acme@localhost:5432/acme\nREDIS_URL=redis://localhost:6379\n# 32+ characters; generate with: openssl rand -hex 32\nSESSION_SECRET=\n',
  replayPreMs: 17000, replayPostMs: 1550, replayTotalMs: 192400,
  steps: [
    { id: 'S1', cmd: 'git clone https://github.com/acme-labs/acme-shop.git && cd acme-shop', kind: 'other',
      skip: 'git clone: repository already mounted at /work' },
    { id: 'S2', cmd: 'npm install', kind: 'install', replayMs: 61000,
      ok: { ms: 44800, log: acmeInstallOk },
      fails: [{
        cls: 'runtime-version', ruleId: 'node.engine-strict', conf: 0.99, ms: 6100,
        cause: 'package.json requires Node >=20.11.0 and .npmrc sets engine-strict, but the README says Node 16.',
        log: [
          'npm ERR! code EBADENGINE',
          'npm ERR! engine Unsupported engine',
          'npm ERR! engine Not compatible with your version of node/npm: acme-shop@2.4.0',
          'npm ERR! notsup Required: {"node":">=20.11.0"}',
          'npm ERR! notsup Actual:   {"npm":"8.19.4","node":"v16.20.2"}',
          '',
          'npm ERR! A complete log of this run can be found in:',
          'npm ERR!     /root/.npm/_logs/2026-09-25T09_12_19_512Z-debug-0.log',
        ],
        preLog: ['[firstrun] sandbox rebased onto node:20.11.1-bookworm (node v20.11.1, npm 10.2.4)'],
        fix: { actions: [{ type: 'rebase', image: 'node:20.11.1-bookworm' }],
          doc: { kind: 'prerequisite', text: 'Node.js 20.11.1 (see .nvmrc); engine-strict makes older versions fail at npm install' } },
      }] },
    { id: 'S3', cmd: 'cp .env.sample .env', kind: 'env', ok: { ms: 90, log: [] }, replayMs: 90,
      fails: [{
        cls: 'missing-file', ruleId: 'fs.cp-missing-source', conf: 0.95, ms: 80, exit: 1,
        cause: '.env.sample does not exist; the repository ships .env.example instead.',
        log: ["cp: cannot stat '.env.sample': No such file or directory"],
        fix: { actions: [{ type: 'replace-step', command: 'cp .env.example .env' }],
          doc: { kind: 'replace-command', text: 'cp .env.example .env' } },
      }] },
    { id: 'S4', cmd: 'docker compose up -d postgres', kind: 'services', replayMs: 4100,
      ok: { ms: 3900, log: [
        '[firstrun] no Docker socket inside the sandbox; starting compose service "postgres" as a sidecar',
        '[firstrun] sidecar postgres (postgres:15-alpine) reachable at postgres:5432, forwarded to localhost:5432',
        ' Container acme-shop-postgres-1  Started',
        '[firstrun] postgres:5432 accepting connections after 1.8s',
      ] },
      replayLog: [
        '[firstrun] no Docker socket inside the sandbox; starting compose services as sidecars',
        '[firstrun] sidecar postgres (postgres:15-alpine) forwarded to localhost:5432',
        '[firstrun] sidecar redis (redis:7-alpine) forwarded to localhost:6379',
        ' Container acme-shop-postgres-1  Started',
        ' Container acme-shop-redis-1     Started',
        '[firstrun] postgres:5432 and redis:6379 accepting connections after 2.1s',
      ] },
    { id: 'S5', cmd: 'npm run migrate', kind: 'migrate', replayMs: 4400,
      ok: { ms: 4300, log: ['', '> acme-shop@2.4.0 db:migrate', '> knex migrate:latest --knexfile db/knexfile.js', '',
        'Using environment: development', 'Batch 1 run: 7 migrations'] },
      fails: [{
        cls: 'missing-script', ruleId: 'npm.missing-script', conf: 0.98, ms: 700,
        cause: 'package.json has no "migrate" script; the migration script is "db:migrate".',
        log: ['npm ERR! Missing script: "migrate"', 'npm ERR!', 'npm ERR! Did you mean one of these?',
          'npm ERR!     npm run db:migrate # run the "db:migrate" package script',
          'npm ERR!     npm run db:rollback # run the "db:rollback" package script', 'npm ERR!',
          'npm ERR! To see a list of scripts, run:', 'npm ERR!   npm run', '',
          'npm ERR! A complete log of this run can be found in: /root/.npm/_logs/2026-09-25T09_13_31_004Z-debug-0.log'],
        fix: { actions: [{ type: 'replace-step', command: 'npm run db:migrate' }],
          doc: { kind: 'replace-command', text: 'npm run db:migrate' } },
      }] },
    { id: 'S6', cmd: 'npm run seed', kind: 'other', replayMs: 6900,
      ok: { ms: 6400, log: ['', '> acme-shop@2.4.0 seed', '> tsx scripts/seed.ts', '',
        '[seed] connected to postgres://acme@localhost:5432/acme', '[seed] users: 3', '[seed] products: 48', '[seed] orders: 12', '[seed] done in 1.9s'] },
      fails: [{
        cls: 'missing-env', by: 'bob', coins: 0.4, conf: 0.86, ms: 3100, bobMs: 6800,
        cause: 'src/config/env.ts requires SESSION_SECRET of at least 32 characters, but .env.example leaves it empty and the README never mentions it.',
        log: ['', '> acme-shop@2.4.0 seed', '> tsx scripts/seed.ts', '',
          '/work/node_modules/zod/lib/types.js:43', '      const error = new ZodError(ctx.common.issues);', '                    ^', '',
          'ZodError: [', '  {', '    "code": "too_small",', '    "minimum": 32,', '    "type": "string",', '    "inclusive": true,',
          '    "message": "String must contain at least 32 character(s)",', '    "path": [', '      "SESSION_SECRET"', '    ]', '  }', ']',
          '    at get error [as error] (/work/node_modules/zod/lib/types.js:43:31)',
          '    at ZodObject.parse (/work/node_modules/zod/lib/types.js:166:22)',
          '    at <anonymous> (/work/src/config/env.ts:28:27)', '', 'Node.js v20.11.1'],
        fix: { actions: [{ type: 'insert-before', command: 'echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env', kind: 'env' }],
          doc: { kind: 'insert-step', text: 'echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env' } },
        insertOk: { ms: 60, log: [] },
      }] },
    { id: 'S7', cmd: 'npm run build', kind: 'build', replayMs: 36800,
      ok: { ms: 33900, log: ['', '> acme-shop@2.4.0 build', '> tsc -p tsconfig.server.json && vite build', '',
        'vite v5.2.11 building for production...', 'transforming...', '✓ 412 modules transformed.', 'rendering chunks...', 'computing gzip size...',
        'dist/client/index.html                   0.62 kB │ gzip:  0.38 kB',
        'dist/client/assets/index-4f1c2b9e.css   18.40 kB │ gzip:  4.71 kB',
        'dist/client/assets/vendor-8a02d7c1.js  142.18 kB │ gzip: 45.93 kB',
        'dist/client/assets/index-b3e9f610.js    96.55 kB │ gzip: 29.12 kB',
        '✓ built in 11.84s'] } },
    { id: 'S8', cmd: 'npm run dev', kind: 'serve', serve: { port: 3000, readyPattern: 'Listening on' }, replayMs: 10200,
      ok: { ms: 9400, log: ['', '> acme-shop@2.4.0 dev', '> tsx watch src/server.ts', '',
        '[09:15:02.113] INFO: config loaded (env=development)', '[09:15:02.130] INFO: postgres connected (localhost:5432/acme)',
        '[09:15:02.188] INFO: redis connected (localhost:6379)', '[09:15:02.240] INFO: session store ready (connect-redis)',
        '[09:15:02.301] INFO: Listening on http://localhost:3000', '[firstrun] ready pattern "Listening on" matched; GET /health -> 200 OK (14ms)'] },
      fails: [{
        cls: 'missing-service', ruleId: 'net.econnrefused-known-port', conf: 0.96, ms: 4200,
        cause: 'The session store connects to Redis on 127.0.0.1:6379, but the README only starts Postgres.',
        log: ['', '> acme-shop@2.4.0 dev', '> tsx watch src/server.ts', '',
          '[09:14:21.402] INFO: config loaded (env=development)', '[09:14:21.419] INFO: postgres connected (localhost:5432/acme)',
          '[ioredis] Unhandled error event: Error: connect ECONNREFUSED 127.0.0.1:6379',
          '    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1555:16)',
          '[09:14:23.507] FATAL: session store unavailable: connect ECONNREFUSED 127.0.0.1:6379',
          '    err: { "code": "ECONNREFUSED", "address": "127.0.0.1", "port": 6379 }'],
        preLog: ['[firstrun] sidecar redis (redis:7-alpine) forwarded to localhost:6379'],
        fix: { actions: [{ type: 'service', name: 'redis', image: 'redis:7-alpine', port: 6379 }],
          doc: { kind: 'replace-command', text: 'docker compose up -d postgres redis' } },
      }] },
    { id: 'S9', cmd: 'npm test', kind: 'test', replayMs: 50300,
      ok: { ms: 47200, log: ['', '> acme-shop@2.4.0 test', '> vitest run', '', ' RUN  v1.6.0 /work', '',
        ' ✓ test/health.test.ts  (2 tests) 41ms', ' ✓ test/products.test.ts  (18 tests) 612ms', ' ✓ test/cart.test.ts  (24 tests) 845ms',
        ' ✓ test/orders.test.ts  (31 tests) 1377ms', ' ✓ test/auth.test.ts  (16 tests) 904ms', ' ✓ test/admin.test.ts  (35 tests) 1211ms', '',
        ' Test Files  14 passed (14)', '      Tests  126 passed (126)', '   Start at  09:15:14', '   Duration  38.92s'] } },
  ],
};

// ---------------------------------------------------------------- the rest of the swarm
const nodeOk = (pkg, n, secs) => ({ ms: secs * 1000, log: [...npmHttp(pkg), '', `added ${n} packages, and audited ${n + 1} packages in ${secs - 3}s`, '', 'found 0 vulnerabilities'] });
const pipOk = (pkgs, secs) => ({ ms: secs * 1000, log: [...pkgs.map(p => `Collecting ${p}`), ...pkgs.map(p => `  Downloading ${p.split(/[=<>]/)[0]}-*.whl`), `Successfully installed ${pkgs.map(p => p.replace('==', '-')).join(' ')}`] });

function simpleSpec(o) {
  const cmds = o.steps.map(s => s.cmd);
  const readme = genericReadme(o.title, o.blurb, o.prereqs, cmds);
  return {
    ...o,
    readme,
    readmeFixed: p => {
      let cmdsFixed = [];
      for (const s of o.steps) {
        for (const f of s.fails || []) for (const a of f.fix.actions) if (a.type === 'insert-before') cmdsFixed.push(a.command);
        const rep = (s.fails || []).flatMap(f => f.fix.actions).find(a => a.type === 'replace-step');
        cmdsFixed.push(rep ? rep.command : s.cmd);
      }
      const notes = o.steps.flatMap(s => (s.fails || []).filter(f => f.human).map(f => `\n> Needs a human: ${f.fix.doc.text}\n`)).join('');
      const blurb = p.verdict === 'FAILED' ? o.blurb : o.blurb + '\n' + stamp(p).trimEnd();
      return genericReadme(o.title, blurb, o.prereqsFixed || o.prereqs, cmdsFixed, notes);
    },
  };
}

const SWARM = [
  simpleSpec({
    id: 'ledger-api', repo: 'northwind/ledger-api', title: 'Ledger API', start: '2026-09-25T10:00:03.000Z',
    blurb: 'Double-entry ledger service with a FastAPI front end.',
    prereqs: ['Python 3.9+'], prereqsFixed: ['Python 3.11+ (pyproject.toml requires >=3.11)', 'libpq headers (Debian/Ubuntu: `sudo apt-get install libpq-dev`; macOS: `brew install libpq`)'],
    image0: 'python:3.9-slim-bookworm', runtime: { name: 'python', version: '3.9', source: 'README.md#Prerequisites' }, runtimeFinal: 'python 3.11.9',
    verify: { kind: 'http', target: 'http://localhost:8000/healthz' },
    facts: { languages: ['python'], manifests: ['pyproject.toml', 'requirements-dev.txt', 'alembic.ini'], ci: ['.github/workflows/test.yml'] },
    conflicts: [{ what: 'Python version', docs: 'Python 3.9+', truth: '>=3.11', source: 'pyproject.toml requires-python' }],
    steps: [
      { id: 'S1', cmd: 'python3 -m venv .venv && . .venv/bin/activate', kind: 'prereq', ok: { ms: 3100, log: [] } },
      { id: 'S2', cmd: 'pip install -e .', kind: 'install', ok: pipOk(['fastapi==0.111.0', 'sqlalchemy==2.0.30', 'alembic==1.13.1', 'pydantic==2.7.1', 'uvicorn==0.29.0'], 28),
        fails: [{ cls: 'runtime-version', ruleId: 'pip.requires-python', ms: 4100,
          cause: 'pyproject.toml requires Python >=3.11 but the README asks for 3.9+.',
          log: ['Obtaining file:///work', '  Installing build dependencies ... done', "ERROR: Package 'ledger-api' requires a different Python: 3.9.19 not in '>=3.11'"],
          preLog: ['[firstrun] sandbox rebased onto python:3.11-slim-bookworm'],
          fix: { actions: [{ type: 'rebase', image: 'python:3.11-slim-bookworm' }], doc: { kind: 'prerequisite', text: 'Python 3.11+ (pyproject.toml requires >=3.11)' } } }] },
      { id: 'S3', cmd: 'pip install -r requirements-dev.txt', kind: 'install', ok: pipOk(['psycopg2==2.9.9', 'pytest==8.2.0', 'httpx==0.27.0'], 19),
        fails: [{ cls: 'missing-dependency', ruleId: 'pip.pg_config', ms: 7600,
          cause: 'psycopg2 builds from source and needs pg_config from the libpq headers.',
          log: ['Collecting psycopg2==2.9.9', '  Downloading psycopg2-2.9.9.tar.gz (384 kB)', '  Preparing metadata (setup.py) ... error', '  error: subprocess-exited-with-error',
            '  Error: pg_config executable not found.', '  pg_config is required to build psycopg2 from source.'],
          fix: { actions: [{ type: 'exec', command: 'apt-get update && apt-get install -y libpq-dev gcc' }], doc: { kind: 'prerequisite', text: 'libpq headers (Debian/Ubuntu: sudo apt-get install libpq-dev)' } } }] },
      { id: 'S4', cmd: 'alembic upgrade head', kind: 'migrate', ok: { ms: 2100, log: ['INFO  [alembic.runtime.migration] Context impl SQLiteImpl.', 'INFO  [alembic.runtime.migration] Running upgrade  -> 1a2b3c4d, accounts', 'INFO  [alembic.runtime.migration] Running upgrade 1a2b3c4d -> 5e6f7a8b, journal entries'] } },
      { id: 'S5', cmd: 'uvicorn ledger.main:app --port 8000', kind: 'serve', serve: { port: 8000, readyPattern: 'Application startup complete' }, ok: { ms: 3400, log: ['INFO:     Started server process [41]', 'INFO:     Waiting for application startup.', 'INFO:     Application startup complete.', 'INFO:     Uvicorn running on http://127.0.0.1:8000'] } },
      { id: 'S6', cmd: 'pytest -q', kind: 'test', ok: { ms: 14200, log: ['........................................................ [ 71%]', '......................                                   [100%]', '78 passed in 11.02s'] } },
    ],
  }),
  simpleSpec({
    id: 'telemetry-ui', repo: 'orbit-dev/telemetry-ui', title: 'Telemetry UI', start: '2026-09-25T10:00:05.000Z',
    blurb: 'Realtime telemetry dashboard for ground-station operators.',
    prereqs: ['Node.js 20', 'pnpm'], prereqsFixed: ['Node.js 20', 'pnpm 9 via Corepack (`corepack enable`)'],
    image0: 'node:20-bookworm', runtime: { name: 'node', version: '20', source: '.nvmrc' }, runtimeFinal: 'node 20.17.0',
    verify: { kind: 'http', target: 'http://localhost:5173/' },
    facts: { languages: ['typescript'], manifests: ['package.json', 'pnpm-lock.yaml'], packageManager: 'pnpm@9.1.0' },
    conflicts: [],
    steps: [
      { id: 'S1', cmd: 'git clone https://github.com/orbit-dev/telemetry-ui.git', kind: 'other', skip: 'git clone: repository already mounted at /work' },
      { id: 'S2', cmd: 'pnpm install', kind: 'install', ok: { ms: 21000, log: ['Lockfile is up to date, resolution step is skipped', 'Progress: resolved 702, reused 0, downloaded 702, added 702, done', '', 'dependencies:', '+ react 18.3.1', '+ uplot 1.6.30', '', 'Done in 17.9s'] },
        fails: [{ cls: 'missing-tool', ruleId: 'sh.command-not-found', ms: 60, exit: 127,
          cause: 'pnpm is not installed in a clean Node image; package.json pins pnpm@9.1.0 via Corepack.',
          log: ['sh: 1: pnpm: not found'],
          fix: { actions: [{ type: 'insert-before', command: 'corepack enable', kind: 'prereq' }], doc: { kind: 'insert-step', text: 'corepack enable' } },
          insertOk: { ms: 900, log: [] } }] },
      { id: 'S3', cmd: 'pnpm dev', kind: 'serve', serve: { port: 5173, readyPattern: 'ready in' }, ok: { ms: 2600, log: ['', '  VITE v5.3.1  ready in 611 ms', '', '  ➜  Local:   http://localhost:5173/'] } },
      { id: 'S4', cmd: 'pnpm test', kind: 'test', ok: { ms: 9800, log: [' Test Files  9 passed (9)', '      Tests  64 passed (64)'] } },
    ],
  }),
  simpleSpec({
    id: 'handbook', repo: 'pinecrest/handbook', title: 'Pinecrest handbook', start: '2026-09-25T10:00:04.000Z',
    blurb: 'The engineering handbook, built with Astro.',
    prereqs: ['Node.js 20'], image0: 'node:20-bookworm', runtime: { name: 'node', version: '20', source: 'README.md#Prerequisites' }, runtimeFinal: 'node 20.17.0',
    verify: { kind: 'http', target: 'http://localhost:4321/' },
    facts: { languages: ['javascript', 'markdown'], manifests: ['package.json', 'package-lock.json'] }, conflicts: [],
    steps: [
      { id: 'S1', cmd: 'npm ci', kind: 'install', ok: nodeOk(['astro', '@astrojs/mdx', 'sharp', 'shiki'], 412, 24) },
      { id: 'S2', cmd: 'npm run build', kind: 'build', ok: { ms: 18400, log: ['astro v4.9.2', '[build] 148 page(s) built in 14.21s', '[build] Complete!'] } },
      { id: 'S3', cmd: 'npm run preview', kind: 'serve', serve: { port: 4321, readyPattern: 'Local' }, ok: { ms: 1900, log: ['  astro  v4.9.2 ready in 212 ms', '', '┃ Local    http://localhost:4321/'] } },
    ],
  }),
  simpleSpec({
    id: 'kestrel-cli', repo: 'kestrel-io/kestrel-cli', title: 'kestrel', start: '2026-09-25T10:00:06.000Z',
    blurb: 'A fast log shipper for the command line.',
    prereqs: ['Go 1.22'], prereqsFixed: ['Go 1.22', 'golangci-lint v1.59 (installed by the setup steps below)'],
    image0: 'golang:1.22-bookworm', runtime: { name: 'other', version: 'go 1.22', source: 'go.mod' }, runtimeFinal: 'go 1.22.5',
    verify: { kind: 'command', target: './bin/kestrel --version' },
    facts: { languages: ['go'], manifests: ['go.mod', 'go.sum', 'Makefile'] }, conflicts: [],
    steps: [
      { id: 'S1', cmd: 'go mod download', kind: 'install', ok: { ms: 12100, log: ['go: downloading github.com/spf13/cobra v1.8.0', 'go: downloading go.uber.org/zap v1.27.0', 'go: downloading github.com/klauspost/compress v1.17.8'] } },
      { id: 'S2', cmd: 'make lint', kind: 'test', ok: { ms: 23800, log: ['golangci-lint run ./...', '0 issues.'] },
        fails: [{ cls: 'missing-tool', ruleId: 'make.error-127', ms: 300, exit: 2,
          cause: 'The lint target calls golangci-lint, which is not in a clean Go image and is not listed as a prerequisite.',
          log: ['golangci-lint run ./...', 'make: golangci-lint: No such file or directory', 'make: *** [Makefile:14: lint] Error 127'],
          fix: { actions: [{ type: 'insert-before', command: 'go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.59.1', kind: 'prereq' }], doc: { kind: 'insert-step', text: 'go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.59.1' } },
          insertOk: { ms: 38400, log: ['go: downloading github.com/golangci/golangci-lint v1.59.1'] } }] },
      { id: 'S3', cmd: 'make build', kind: 'build', ok: { ms: 9100, log: ['go build -trimpath -o bin/kestrel ./cmd/kestrel'] } },
      { id: 'S4', cmd: './bin/kestrel --version', kind: 'test', ok: { ms: 80, log: ['kestrel 0.9.3 (go1.22.5, linux/amd64)'] } },
    ],
  }),
  simpleSpec({
    id: 'intake-service', repo: 'lumen-health/intake-service', title: 'Intake service', start: '2026-09-25T10:00:09.000Z',
    blurb: 'Patient intake forms with SMS confirmations.',
    prereqs: ['Python 3.11'], image0: 'python:3.11-slim-bookworm', runtime: { name: 'python', version: '3.11', source: 'README.md#Prerequisites' }, runtimeFinal: 'python 3.11.9',
    verify: { kind: 'http', target: 'http://localhost:5000/healthz' },
    facts: { languages: ['python'], manifests: ['requirements.txt'] },
    conflicts: [{ what: 'Required secrets', docs: 'none mentioned', truth: 'INTAKE_SIGNING_KEY, TWILIO_AUTH_TOKEN', source: 'intake/settings.py' }],
    envExample: 'FLASK_ENV=development\nDATABASE_URL=sqlite:///intake.db\nINTAKE_SIGNING_KEY=\nTWILIO_ACCOUNT_SID=\nTWILIO_AUTH_TOKEN=\n',
    steps: [
      { id: 'S1', cmd: 'pip install -r requirements.txt', kind: 'install', ok: pipOk(['flask==3.0.3', 'flask-migrate==4.0.7', 'cryptography==42.0.7', 'twilio==9.1.0'], 22) },
      { id: 'S2', cmd: 'cp .env.example .env', kind: 'env', ok: { ms: 60, log: [] } },
      { id: 'S3', cmd: 'flask --app intake db upgrade', kind: 'migrate', ok: { ms: 2600, log: ['INFO  [alembic.runtime.migration] Running upgrade  -> 0001, intake forms'] },
        fails: [{ cls: 'missing-env', by: 'bob', coins: 0.3, conf: 0.82, ms: 1900,
          cause: 'intake/settings.py builds a Fernet cipher from INTAKE_SIGNING_KEY, which must be a urlsafe base64 32-byte key; the example leaves it blank.',
          log: ['Traceback (most recent call last):', '  File "/work/intake/settings.py", line 19, in <module>', '    CIPHER = Fernet(os.environ["INTAKE_SIGNING_KEY"])', 'ValueError: Fernet key must be 32 url-safe base64-encoded bytes.'],
          fix: { actions: [{ type: 'insert-before', command: 'echo "INTAKE_SIGNING_KEY=$(python -c \'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\')" >> .env', kind: 'env' }],
            doc: { kind: 'insert-step', text: 'Generate INTAKE_SIGNING_KEY with cryptography.fernet' } },
          insertOk: { ms: 400, log: [] } }] },
      { id: 'S4', cmd: 'flask --app intake run', kind: 'serve', serve: { port: 5000, readyPattern: 'Running on' }, ok: { ms: 2000, log: [' * Running on http://127.0.0.1:5000'] },
        fails: [{ cls: 'needs-secret', ruleId: 'auth.http-401-vendor', conf: 0.9, ms: 3300, human: true,
          cause: 'Startup verifies TWILIO_AUTH_TOKEN against the Twilio API; a real credential is required and cannot be generated.',
          log: [' * Serving Flask app "intake"', 'twilio.base.exceptions.TwilioRestException: HTTP 401 error: Unable to fetch record: Authenticate'],
          fix: { actions: [], doc: { kind: 'note', text: 'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN from a Twilio test account before running the server.' } } }] },
      { id: 'S5', cmd: 'pytest', kind: 'test', ok: { ms: 8800, log: ['41 passed in 6.10s'] } },
    ],
  }),
  simpleSpec({
    id: 'brightloop-web', repo: 'brightloop/web', title: 'Brightloop web', start: '2026-09-25T10:00:07.000Z',
    blurb: 'Marketing site and checkout for Brightloop.',
    prereqs: ['macOS with Homebrew', 'Node.js 20'], prereqsFixed: ['Node.js 20', 'ImageMagick (macOS: `brew install imagemagick`; Debian/Ubuntu: `sudo apt-get install imagemagick`)'],
    image0: 'node:20-bookworm', runtime: { name: 'node', version: '20', source: 'package.json engines' }, runtimeFinal: 'node 20.17.0',
    verify: { kind: 'http', target: 'http://localhost:3000/' },
    facts: { languages: ['typescript'], manifests: ['package.json', 'prisma/schema.prisma'] },
    conflicts: [{ what: 'Platform', docs: 'macOS with Homebrew', truth: 'Linux works with apt packages', source: 'Dockerfile' }],
    steps: [
      { id: 'S1', cmd: 'brew install imagemagick', kind: 'prereq', ok: { ms: 16800, log: ['Setting up imagemagick (8:6.9.11.60+dfsg-1.6) ...'] },
        fails: [{ cls: 'platform-specific', ruleId: 'os.brew-on-linux', ms: 40, exit: 127,
          cause: 'Homebrew is macOS-only; the Linux equivalent is the Debian imagemagick package.',
          log: ['sh: 1: brew: not found'],
          fix: { actions: [{ type: 'replace-step', command: 'apt-get update && apt-get install -y imagemagick' }], doc: { kind: 'note', text: 'Debian/Ubuntu: sudo apt-get install imagemagick' } } }] },
      { id: 'S2', cmd: 'npm install', kind: 'install', ok: nodeOk(['next', 'react', '@prisma/client', 'prisma', 'stripe', 'sharp'], 638, 33) },
      { id: 'S3', cmd: 'npm run build', kind: 'build', ok: { ms: 41200, log: ['  ▲ Next.js 14.2.3', '   Creating an optimized production build ...', ' ✓ Compiled successfully', ' ✓ Generating static pages (24/24)'] },
        fails: [{ cls: 'wrong-order', by: 'bob', coins: 0.3, conf: 0.88, ms: 11800,
          cause: 'The Prisma client is generated by a postinstall hook that was removed in a3f09c1; the build now needs an explicit prisma generate first.',
          log: ['  ▲ Next.js 14.2.3', '   Creating an optimized production build ...', 'Error: @prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.', '    at new PrismaClient (/work/node_modules/.prisma/client/index.js:3:11)'],
          fix: { actions: [{ type: 'insert-before', command: 'npx prisma generate', kind: 'build' }], doc: { kind: 'insert-step', text: 'npx prisma generate' } },
          insertOk: { ms: 4200, log: ['✔ Generated Prisma Client (v5.14.0) to ./node_modules/@prisma/client in 212ms'] } }] },
      { id: 'S4', cmd: 'npm start', kind: 'serve', serve: { port: 3000, readyPattern: 'Ready' }, ok: { ms: 2000, log: [' ✓ Ready in 1.2s'] },
        fails: [{ cls: 'needs-secret', ruleId: 'env.vendor-key-format', conf: 0.93, ms: 2400, human: true,
          cause: 'Checkout requires STRIPE_SECRET_KEY in sk_test_ format from a Stripe account; FirstRun cannot mint one.',
          log: ['  ▲ Next.js 14.2.3', 'Error: STRIPE_SECRET_KEY is missing or not a test key (expected sk_test_...)', '    at lib/stripe.ts:7:11'],
          fix: { actions: [], doc: { kind: 'note', text: 'Add STRIPE_SECRET_KEY (sk_test_...) from the Stripe dashboard to .env.local.' } } }] },
    ],
  }),
  simpleSpec({
    id: 'ingest-worker', repo: 'harbor-labs/ingest-worker', title: 'Ingest worker', start: '2026-09-25T10:00:12.000Z',
    blurb: 'Kafka consumer that lands events in S3 as Parquet.',
    prereqs: ['Python 3.12', 'Poetry', 'Docker'], image0: 'python:3.12-slim-bookworm', runtime: { name: 'python', version: '3.12', source: 'pyproject.toml' }, runtimeFinal: 'python 3.12.4',
    verify: { kind: 'command', target: 'poetry run python -m ingest.worker --once' },
    facts: { languages: ['python'], manifests: ['pyproject.toml', 'poetry.lock', 'docker-compose.yml'] },
    conflicts: [{ what: 'Storage', docs: 'not mentioned', truth: 'S3 bucket via AWS credentials', source: 'ingest/sink.py' }],
    steps: [
      { id: 'S1', cmd: 'poetry install', kind: 'install', ok: { ms: 26000, log: ['Installing dependencies from lock file', 'Package operations: 38 installs, 0 updates, 0 removals', '  - Installing kafka-python (2.0.2)', '  - Installing pyarrow (16.1.0)', '  - Installing boto3 (1.34.113)', 'Installing the current project: ingest-worker (0.4.0)'] },
        fails: [{ cls: 'missing-tool', ruleId: 'sh.command-not-found', ms: 40, exit: 127,
          cause: 'Poetry is not installed in a clean Python image and the README does not say how to get it.',
          log: ['sh: 1: poetry: not found'],
          fix: { actions: [{ type: 'insert-before', command: 'pip install poetry==1.8.3', kind: 'prereq' }], doc: { kind: 'insert-step', text: 'pip install poetry==1.8.3' } },
          insertOk: { ms: 9800, log: ['Successfully installed poetry-1.8.3'] } }] },
      { id: 'S2', cmd: 'docker compose up -d kafka', kind: 'services', ok: { ms: 7400, log: ['[firstrun] sidecar kafka (bitnami/kafka:3.7) forwarded to localhost:9092', '[firstrun] kafka:9092 accepting connections after 5.9s'] } },
      { id: 'S3', cmd: 'poetry run python -m ingest.worker --once', kind: 'test', ok: { ms: 3000, log: ['processed 0 messages'] },
        fails: [{ cls: 'needs-secret', ruleId: 'aws.no-credentials', conf: 0.95, ms: 5200, human: true,
          cause: 'The sink writes to a real S3 bucket and needs AWS credentials; no local emulator is configured.',
          log: ['INFO consumer connected to localhost:9092', 'botocore.exceptions.NoCredentialsError: Unable to locate credentials'],
          fix: { actions: [], doc: { kind: 'note', text: 'Export AWS credentials with write access to the ingest bucket, or point S3_ENDPOINT at LocalStack.' } } }] },
      { id: 'S4', cmd: 'poetry run pytest -m "not integration"', kind: 'test', ok: { ms: 7200, log: ['22 passed, 6 deselected in 3.44s'] } },
    ],
  }),
  simpleSpec({
    id: 'geo-tiles', repo: 'quarry/geo-tiles', title: 'geo-tiles', start: '2026-09-25T10:00:10.000Z',
    blurb: 'Vector tile server backed by Mapnik.',
    prereqs: ['Node.js 20'], image0: 'node:20-bookworm', runtime: { name: 'node', version: '20', source: 'README.md#Prerequisites' }, runtimeFinal: 'node 20.17.0',
    verify: { kind: 'http', target: 'http://localhost:8080/tiles/0/0/0.pbf' },
    facts: { languages: ['javascript', 'c++'], manifests: ['package.json', 'binding.gyp'] }, conflicts: [],
    steps: [
      { id: 'S1', cmd: 'npm install', kind: 'install', ok: nodeOk(['mapnik'], 90, 60),
        fails: [{ cls: 'unknown', by: 'bob', coins: 0.5, conf: 0.41, ms: 88000, human: true, halt: true,
          cause: 'mapnik@4.5.9 has no prebuilt binary for Node 20 on linux-x64, and building it needs Mapnik 3.1 headers that Debian bookworm does not package.',
          log: ['> mapnik@4.5.9 install', '> node-pre-gyp install --fallback-to-build', 'node-pre-gyp ERR! install response status 404 Not Found on https://mapbox-node-binary.s3.amazonaws.com/mapnik/v4.5.9/Release/node-v115-linux-x64.tar.gz',
            'gyp info spawn make', '../src/mapnik_map.cpp:4:10: fatal error: mapnik/map.hpp: No such file or directory', 'compilation terminated.', 'gyp ERR! build error', 'npm ERR! code 1'],
          fix: { actions: [], doc: { kind: 'note', text: 'Pin Node 16 (last version with a mapnik prebuilt) or build Mapnik 3.1 from source; a maintainer should choose.' } } }] },
      { id: 'S2', cmd: 'npm run tiles:build', kind: 'build', ok: { ms: 1000, log: [] } },
      { id: 'S3', cmd: 'npm start', kind: 'serve', serve: { port: 8080 }, ok: { ms: 1000, log: [] } },
    ],
  }),
  simpleSpec({
    id: 'ml-notebooks', repo: 'fernwood/ml-notebooks', title: 'ML notebooks', start: '2026-09-25T10:00:14.000Z',
    blurb: 'Teaching notebooks for the applied ML course (CPU only).',
    prereqs: ['Python 3.11'], image0: 'python:3.11-slim-bookworm', runtime: { name: 'python', version: '3.11', source: 'README.md#Prerequisites' }, runtimeFinal: 'python 3.11.9',
    verify: { kind: 'exit', target: 'python -m nbconvert --execute' },
    facts: { languages: ['python', 'jupyter'], manifests: ['requirements.txt'] }, conflicts: [],
    steps: [
      { id: 'S1', cmd: 'python -m venv .venv && . .venv/bin/activate', kind: 'prereq', ok: { ms: 2900, log: [] } },
      { id: 'S2', cmd: 'pip install -r requirements.txt', kind: 'install', ok: pipOk(['numpy==1.26.4', 'pandas==2.2.2', 'scikit-learn==1.5.0', 'matplotlib==3.9.0', 'nbconvert==7.16.4', 'ipykernel==6.29.4'], 46) },
      { id: 'S3', cmd: 'python -m nbconvert --execute --to notebook notebooks/01-quickstart.ipynb', kind: 'test', ok: { ms: 21400, log: ['[NbConvertApp] Converting notebook notebooks/01-quickstart.ipynb to notebook', '[NbConvertApp] Writing 48211 bytes to notebooks/01-quickstart.nbconvert.ipynb'] } },
    ],
  }),
];

// ---------------------------------------------------------------- write everything
function writeRun(dir, files) {
  fs.rmSync(dir, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
}

export function generateAll() {
  const results = [];
  for (const spec of [ACME, ...SWARM]) {
    const { files, passport } = buildRun(spec);
    writeRun(path.join(HERE, 'runs', spec.id, '.firstrun'), files);
    results.push({ spec, passport });
  }
  // audit
  const auditDir = path.join(HERE, 'audit', 'demo');
  fs.rmSync(auditDir, { recursive: true, force: true });
  fs.mkdirSync(auditDir, { recursive: true });
  const startedAt = '2026-09-25T10:00:00.000Z';
  const order = ['acme-shop', 'ledger-api', 'telemetry-ui', 'handbook', 'kestrel-cli', 'intake-service', 'brightloop-web', 'ingest-worker', 'geo-tiles', 'ml-notebooks'];
  const repos = order.map(id => {
    const { spec, passport } = results.find(x => x.spec.id === id);
    return { slug: spec.repo, url: `https://github.com/${spec.repo}`, status: 'done', verdict: passport.verdict, passport, runDir: `../../runs/${id}` };
  });
  const audit = { id: 'demo', startedAt, repos };
  fs.writeFileSync(path.join(auditDir, 'audit.json'), JSON.stringify(audit, null, 2) + '\n');
  let t = Date.parse(startedAt);
  const ev = [];
  const push = (type, data) => { ev.push({ t: iso(t), run: 'demo', agent: 'swarm', type, data }); };
  for (const r of repos) { push('repo.queued', { slug: r.slug }); t += 20; }
  for (const r of repos) { t += 900; push('repo.start', { slug: r.slug }); }
  for (const r of repos) { t += 45000; push('repo.done', { slug: r.slug, verdict: r.verdict, passport: r.passport }); }
  fs.writeFileSync(path.join(auditDir, 'events.ndjson'), ev.map(e => JSON.stringify(e)).join('\n') + '\n');
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const res = generateAll();
  for (const { spec, passport: p } of res)
    console.log(`${spec.id.padEnd(16)} ${p.verdict.padEnd(9)} breaks ${p.breaksFound} fixed ${p.breaksFixed} human ${p.needsHuman} replay ${p.replaySeconds}s bob ${p.bobcoins}`);
}
