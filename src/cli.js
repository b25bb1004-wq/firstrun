import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyRepo } from './pipeline.js';
import { scout } from './scout/index.js';
import { buildPlan } from './plan.js';
import { audit, fetchRepo } from './audit.js';
import { staticDrift, replayVerifiedPlan, guardComment } from './drift.js';
import { attachPrinter, bold, dim, green, red, yellow, cyan } from './terminal.js';
import { cleanupAll } from './sandbox.js';
import { installGlobalModes } from './brain/modes.js';
import { bobStatus } from './brain/bob.js';
import { runScout, runPlanner, runDoctor, runScribe, runRunner } from './solo.js';
import { run, readJson, fmtDuration } from './util.js';

const HELP = `${bold('FirstRun')}: your README, proven.

Follows a repository's setup docs on a clean machine like a brand-new contributor,
repairs what breaks with evidence, replays the fixed guide from zero, and writes a
corrected README plus a Setup Passport.

${bold('Usage')}
  firstrun verify [path|github-url] [--ref <sha>] [--brain auto|rules|bob] [--bob-budget 4]
                  [--out <dir>] [--keep] [--no-replay] [--verbose] [--flags <list>]
  firstrun run    [path|github-url] [--ref <sha>] [--as-written] [--out <dir>] [--json]
  firstrun plan   [path]                 docs-vs-code conflicts in seconds, no Docker
  firstrun scout  [path|github-url]      Scout alone: what the docs say next to what the code needs
  firstrun doctor --log <file|-> [--repo <dir>] [--command "<cmd>"] [--bob-budget 1]   Doctor alone: diagnose one failure
  firstrun scribe <run-dir>              Scribe alone: rewrite the report and passport from a finished run
  firstrun audit  <repos.json> [--concurrency 3] [--limit N] [--only a,b] [--id name] [--rerun failed|all] [--brain rules]
  firstrun guard  --base <ref> [--replay] [--comment <pr-number>]
  firstrun guide  [path]                 walk through the verified setup on your own machine
  firstrun apply  [path]                 copy the corrected files from .firstrun/out/pr into the repo
  firstrun pr     [path]                 apply on a new branch and open a pull request (gh)
  firstrun ui     [--port 4173] [--root <dir>...]
  firstrun mcp                           MCP server for IBM Bob (stdio)
  firstrun lens   [path]                 circle anything on screen and ask about it (Ctrl+Shift+Space)
  firstrun dock   [path]                 floating Dock: run agents and watch them live (Alt+Command+Space / Ctrl+Alt+Space)
  firstrun bob install                   install FirstRun's custom modes for Bob Shell
  firstrun clean                         remove leftover sandbox containers
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--no-')) args[a.slice(5)] = false;
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) args[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[k] = argv[++i];
      else args[k] = true;
    } else args._.push(a);
  }
  return args;
}

async function resolveTarget(target, args) {
  if (/^https?:\/\/|^git@/.test(target || '')) {
    console.log(dim(`cloning ${target}…`));
    return fetchRepo(target, args.ref);
  }
  return path.resolve(target || '.');
}

export async function main(argv) {
  const [cmd, ...rest] = argv;
  const args = parseArgs(rest);
  switch (cmd) {
    case 'verify': {
      const root = await resolveTarget(args._[0], args);
      console.log(`${bold(cyan('FirstRun'))} ${dim('·')} ${root}`);
      const res = await verifyRepo(root, {
        brain: args.brain || 'auto', bobBudget: Number(args['bob-budget'] ?? 4), out: args.out, keep: !!args.keep,
        replay: args.replay !== false, cache: args.cache !== false, flags: args.flags || '',
        onRecorder: (rec) => attachPrinter(rec, { verbose: !!args.verbose }),
      });
      if (res.ok) {
        console.log(`\n  ${dim('report')}   ${path.join(res.dir, 'out', 'FIRSTRUN.md')}`);
        console.log(`  ${dim('README')}   ${path.join(res.dir, 'out', 'README.diff')}`);
        console.log(`  ${dim('PR files')} ${path.join(res.dir, 'out', 'pr')}  ${dim('(firstrun apply / firstrun pr)')}`);
        console.log(`  ${dim('watch')}    firstrun ui --root ${path.dirname(res.dir)}`);
      }
      return res.ok ? (res.passport.verdict === 'FAILED' ? 2 : 0) : 1;
    }
    case 'run': {
      const root = await resolveTarget(args._[0], args);
      if (!args['as-written']) {
        console.error('Usage: firstrun run <repo> --as-written [--out <dir>] [--json]');
        return 2;
      }
      console.log(`${bold(cyan('FirstRun'))} ${dim('·')} ${root} ${dim('· --as-written')}`);
      const r = await runRunner(root, { out: args.out, asWritten: true });
      if (args.json) { console.log(JSON.stringify(r)); return r.verdict === 'WORKS-AS-WRITTEN' ? 0 : 1; }
      const col = r.verdict === 'WORKS-AS-WRITTEN' ? green : red;
      console.log(`  ${col(bold(r.verdict))}${r.firstFailure ? ` ${dim(`(failed at ${r.firstFailure.stepId}: ${r.firstFailure.command}, exit ${r.firstFailure.exitCode})`)}` : ''}`);
      console.log(`  ${dim('events:')} ${r.runDir}`);
      return r.verdict === 'WORKS-AS-WRITTEN' ? 0 : 1;
    }
    case 'plan': {
      const root = await resolveTarget(args._[0], args);
      // With --out (the Dock), the Planner runs as a solo agent and writes events.ndjson there.
      if (args.out) { const r = await runPlanner(root, { out: args.out }); if (args.json) { console.log(JSON.stringify(r)); return 0; } }
      const facts = await scout(root);
      const plan = buildPlan(facts);
      if (args.json) { console.log(JSON.stringify(plan, null, 2)); return 0; }
      console.log(`${bold('Setup plan')} for ${root}  ${dim(`(${plan.image}: ${plan.runtime.source})`)}`);
      for (const s of plan.steps) console.log(`  ${s.skip ? dim(`${s.id} ${s.command}  (skip: ${s.skip})`) : `${dim(s.id)} ${s.command} ${dim(`[${s.kind}] ${s.source.file}:${s.source.line}`)}`}`);
      console.log(`  ${dim('done when:')} ${plan.verify.kind === 'http' ? `GET ${plan.verify.target}` : plan.verify.target}`);
      if (plan.conflicts.length) {
        console.log(`\n${bold('Docs vs code')}`);
        for (const c of plan.conflicts) console.log(`  ${yellow('⚠')} ${c.what}: docs say ${bold(c.docs)}, code says ${bold(c.truth)} ${dim(`(${c.source})`)}`);
      } else console.log(`\n${green('No docs-vs-code conflicts found statically.')} ${dim('Run `firstrun verify` to prove it.')}`);
      return 0;
    }
    // Solo agents (#90): one member of the team on its own; each writes events.ndjson for the Dock.
    case 'scout': {
      const r = await runScout(await resolveTarget(args._[0], args), { out: args.out });
      if (args.json) { console.log(JSON.stringify(r)); return 0; }
      const f = r.facts;
      console.log(`${bold('Scout')}: ${f.stack || 'unknown stack'} · docs ${(f.docs || []).join(', ') || 'none'} ${dim(`(events: ${r.runDir})`)}`);
      console.log(JSON.stringify(f, null, 2));
      return 0;
    }
    case 'doctor': {
      const src = args.log === '-' || args.log === true ? 0 : args.log;
      if (src === undefined) { console.error('Usage: firstrun doctor --log <file|-> [--repo <dir>] [--command "<cmd>"] [--bob-budget 1]'); return 2; }
      const r = await runDoctor({ log: fs.readFileSync(src, 'utf8'), repo: args.repo || '.', command: args.command || '', out: args.out, bobBudget: Number(args['bob-budget'] || 0) });
      if (args.json) { console.log(JSON.stringify(r)); return r.fix ? 0 : 1; }
      console.log(`${bold('Doctor')}: ${r.diagnosis.cause}`);
      if (r.fix?.doc?.text) console.log(`${green('Fix:')} ${r.fix.doc.text}`);
      else console.log(yellow('No proven fix: a maintainer needs to look (add --bob-budget 1 to ask IBM Bob).'));
      return r.fix ? 0 : 1;
    }
    case 'scribe': {
      const r = await runScribe(args._[0] || '.');
      if (args.json) { console.log(JSON.stringify(r)); return 0; }
      console.log(`${bold('Scribe')}: ${r.files.report}\n  passport: ${r.files.passport}${r.files.readmeDiff ? `\n  README diff: ${r.files.readmeDiff}` : ''}`);
      return 0;
    }
    case 'audit': {
      const list = args._[0] || 'audit/repos.json';
      const concurrency = Number(args.concurrency || 3);
      console.log(`${bold(cyan('FirstRun swarm'))} ${dim('·')} ${list} ${dim(`· ${concurrency} repos at a time`)}`);
      const { dir, state } = await audit(path.resolve(list), {
        concurrency, brain: args.brain || 'rules', bobBudget: Number(args['bob-budget'] ?? 0), limit: args.limit ? Number(args.limit) : undefined, only: args.only, id: args.id, rerun: args.rerun,
        onEvent: (ev) => {
          if (ev.type === 'repo.start') console.log(`${cyan('▶')} ${ev.data.slug}`);
          if (ev.type === 'repo.done') {
            const p = ev.data.passport;
            const col = ev.data.verdict === 'VERIFIED' ? green : ev.data.verdict === 'PARTIAL' ? yellow : red;
            console.log(`${col('■')} ${ev.data.slug}: ${col(bold(ev.data.verdict))}${p ? dim(` · breaks ${p.breaksFound} found / ${p.breaksFixed} fixed · replay ${fmtDuration(p.replaySeconds * 1000)}`) : ''}${ev.data.error ? red(` · ${ev.data.error}`) : ''}`);
          }
        },
      });
      const s = state.summary;
      console.log(`\n${bold(`${s.brokeOnCleanMachine} of ${s.total} READMEs broke on a clean machine`)} · ${s.repairedAutomatically} repaired automatically · ${s.breaksFixed}/${s.breaksFound} breaks fixed with evidence`);
      console.log(dim(`results: ${dir}`));
      return 0;
    }
    case 'guard': {
      const root = path.resolve(args._[0] || '.');
      const base = args.base || 'origin/main';
      const drift = await staticDrift(root, base);
      const replay = args.replay ? await replayVerifiedPlan(root, { onStep: (s) => console.log(`${s.exitCode ? red('✗') : green('✓')} ${s.command}`) }) : null;
      const body = guardComment({ drift, replay });
      console.log(body);
      if (args.comment) {
        const r = await run('gh', ['pr', 'comment', String(args.comment), '--body', body], { cwd: root });
        if (r.code !== 0) console.error(r.out);
      }
      return drift.introduced.length || replay?.status === 'failed' ? 1 : 0;
    }
    case 'guide': {
      const { guide } = await import('./guide.js');
      return guide(path.resolve(args._[0] || '.'), { yes: !!args.yes });
    }
    case 'apply': {
      const root = path.resolve(args._[0] || '.');
      const pr = path.join(args.run || path.join(root, '.firstrun'), 'out', 'pr');
      if (!fs.existsSync(pr)) { console.error('No FirstRun output found. Run `firstrun verify` first.'); return 1; }
      const files = readJson(path.join(pr, '..', 'files.json'), []);
      for (const f of files) {
        fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
        fs.copyFileSync(path.join(pr, f), path.join(root, f));
        console.log(`${green('✓')} ${f}`);
      }
      return 0;
    }
    case 'pr': {
      const root = path.resolve(args._[0] || '.');
      const pass = readJson(path.join(root, '.firstrun', 'out', 'passport.json'));
      if (!pass) { console.error('Run `firstrun verify` first.'); return 1; }
      const branch = `firstrun/verified-setup-${Date.now().toString(36)}`;
      await run('git', ['-C', root, 'checkout', '-b', branch]);
      await main(['apply', root]);
      const files = readJson(path.join(root, '.firstrun', 'out', 'files.json'), []);
      await run('git', ['-C', root, 'add', ...files]);
      await run('git', ['-C', root, 'commit', '-m', `docs: verified setup (FirstRun: ${pass.breaksFixed} setup breaks fixed with evidence)`]);
      const push = await run('git', ['-C', root, 'push', '-u', 'origin', branch]);
      if (push.code !== 0) { console.error(push.out); return 1; }
      const body = fs.readFileSync(path.join(root, 'FIRSTRUN.md'), 'utf8');
      const r = await run('gh', ['pr', 'create', '--title', `Verified setup: ${pass.breaksFixed} setup breaks fixed with evidence`, '--body', body.slice(0, 60000)], { cwd: root });
      console.log(r.out);
      return r.code;
    }
    case 'ui': {
      const { startServer } = await import('./server.js');
      const roots = [].concat(args.root || []).filter(Boolean);
      const port = Number(args.port || 4173);
      await startServer({ port, roots: roots.length ? roots.map((r) => path.resolve(r)) : [process.cwd()] });
      console.log(`${bold(cyan('FirstRun dashboard'))} → http://localhost:${port}`);
      return new Promise(() => {});
    }
    case 'lens': {
      const { spawn } = await import('node:child_process');
      const lensDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lens');
      const electron = path.join(lensDir, 'node_modules', 'electron', 'cli.js');
      if (!fs.existsSync(electron)) { console.log(`Install FirstRun Lens first: ${bold(`cd ${lensDir} && npm install`)}`); return 1; }
      const project = path.resolve(args._[0] || '.');
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const child = spawn(process.execPath, [electron, lensDir, project], { stdio: 'inherit', env });
      return new Promise((resolve) => child.on('close', (code) => resolve(code ?? 0)));
    }
    case 'dock': {
      const { spawn } = await import('node:child_process');
      const lensDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lens');
      const electron = path.join(lensDir, 'node_modules', 'electron', 'cli.js');
      if (!fs.existsSync(electron)) { console.log(`Install FirstRun Dock first: ${bold(`cd ${lensDir} && npm install`)}`); return 1; }
      const project = path.resolve(args._[0] || '.');
      const env = { ...process.env, FIRSTRUN_DOCK: '1' };
      delete env.ELECTRON_RUN_AS_NODE;
      const child = spawn(process.execPath, [electron, lensDir, project], { stdio: 'inherit', env });
      return new Promise((resolve) => child.on('close', (code) => resolve(code ?? 0)));
    }
    case 'mcp': {
      const { startMcp } = await import('./mcp.js');
      await startMcp();
      return new Promise(() => {});
    }
    case 'bob': {
      if (args._[0] === 'install') {
        const f = installGlobalModes();
        console.log(`${green('✓')} FirstRun modes installed for Bob Shell: ${f}`);
      }
      const s = await bobStatus({ force: true });
      console.log(s.ok ? `${green('✓')} Bob Shell ${s.version}` : `${red('✗')} ${s.reason}`);
      return 0;
    }
    case 'clean': {
      const n = await cleanupAll();
      console.log(`removed ${n} container(s)`);
      return 0;
    }
    default:
      console.log(HELP);
      return cmd && cmd !== 'help' && cmd !== '--help' ? 1 : 0;
  }
}
