import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { readJson, tail } from './util.js';
import { bold, dim, green, red, yellow, cyan } from './terminal.js';

/**
 * The newcomer's side of FirstRun: walk through the verified setup on your own
 * machine, one step at a time. Each step says what it does, runs only when you
 * say so, and when something fails the output is matched against the failure
 * signatures FirstRun recorded while repairing the docs.
 */
export async function guide(root, { yes = false } = {}) {
  const planFile = [path.join(root, '.github', 'firstrun', 'plan.json'), path.join(root, '.firstrun', 'out', 'pr', '.github', 'firstrun', 'plan.json')].find((f) => fs.existsSync(f));
  if (!planFile) {
    console.log(`No verified setup found. Run ${bold('firstrun verify')} first (or ask the maintainers to merge the FirstRun PR).`);
    return 1;
  }
  const plan = readJson(planFile);
  const signatures = (plan.knownFailures || []).map((k) => ({ re: signatureOf(k.signature), cause: k.cause, fix: k.fix })).filter((s) => s.re);

  console.log(`\n${bold(cyan('FirstRun Guide'))} ${dim('·')} ${plan.steps.length} verified steps ${dim(`(verified ${plan.verifiedAt?.slice(0, 10)} on ${plan.image})`)}`);
  console.log(dim(`You need ${plan.runtime.name === 'node' ? 'Node.js' : 'Python'} ${plan.runtime.version}${plan.steps.some((s) => s.kind === 'services') ? ' and Docker' : ''}. Keys: Enter = run · s = skip · q = quit\n`));
  if (process.platform === 'win32') console.log(yellow('Windows: run this inside WSL or Git Bash; the steps were verified on Linux.\n'));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const shell = process.platform === 'win32' ? 'bash' : '/bin/bash';
  try {
    for (const [i, s] of plan.steps.entries()) {
      console.log(`${bold(`${i + 1}/${plan.steps.length}`)} ${explain(s)}`);
      console.log(`   ${cyan('$')} ${s.command}`);
      const a = yes ? '' : (await rl.question(dim('   › '))).trim().toLowerCase();
      if (a === 'q') return 0;
      if (a === 's') { console.log(dim('   skipped\n')); continue; }
      if (s.kind === 'serve') {
        console.log(`   ${yellow('This starts the app and keeps running.')} Open a second terminal, run it there, then check ${bold(plan.verify?.target?.replace('127.0.0.1', 'localhost') || 'the URL in the README')}.\n`);
        continue;
      }
      const r = await runLive(shell, s.command, root);
      if (r.code === 0) { console.log(`   ${green('✓ done')}\n`); continue; }
      console.log(`   ${red(`✗ exit ${r.code}`)}`);
      const hit = signatures.find((sig) => sig.re.test(r.out));
      if (hit) console.log(`   ${bold('Known issue:')} ${hit.cause}\n   ${bold('Fix:')} ${hit.fix}\n`);
      else console.log(`   ${dim('Not a failure FirstRun has seen. Last lines:')}\n${tail(r.out, 6).split('\n').map((l) => `     ${l}`).join('\n')}\n   ${dim('Ask IBM Bob in the "FirstRun Guide" mode, or open an issue with this output.')}\n`);
      const again = yes ? 'q' : (await rl.question(dim('   retry (r), continue (c) or quit (q)? '))).trim().toLowerCase();
      if (again === 'q') return 1;
    }
    console.log(green(bold('You are set up. Welcome aboard.')));
    return 0;
  } finally {
    rl.close();
  }
}

function explain(s) {
  return {
    install: 'Install the project\'s dependencies.',
    env: 'Create your local configuration.',
    services: 'Start the database and other services the app needs.',
    migrate: 'Prepare the database (schema and sample data).',
    build: 'Build the project.',
    serve: 'Start the app.',
    test: 'Run the tests to confirm everything works.',
  }[s.kind] || 'Next setup step.';
}

export function signatureOf(logTail = '') {
  const line = logTail.split('\n').reverse().find((l) => /error|ERR!|refused|not found|missing|cannot|No such|Traceback|required/i.test(l));
  if (!line) return null;
  const core = line.replace(/\d{4}-\d{2}-\d{2}T[\d:.Z_-]+/g, '').replace(/\/root\/[^\s]+/g, '').trim().slice(0, 80);
  const words = core.split(/\s+/).filter((w) => w.length > 3).slice(0, 5).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return words.length >= 2 ? new RegExp(words.join('[\\s\\S]{0,40}'), 'i') : null;
}

function runLive(shell, command, cwd) {
  return new Promise((resolve) => {
    const child = spawn(shell, ['-c', command], { cwd, stdio: ['inherit', 'pipe', 'pipe'] });
    let out = '';
    const onData = (d) => { out += d; process.stdout.write(dim(String(d).replace(/^/gm, '     '))); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code) => resolve({ code, out }));
    child.on('error', (e) => resolve({ code: 127, out: e.message }));
  });
}
