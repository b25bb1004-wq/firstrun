import { fmtDuration } from './util.js';

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const dim = c('2'), bold = c('1'), red = c('31'), green = c('32'), yellow = c('33'), blue = c('34'), cyan = c('36'), magenta = c('35');

const AGENT = { scout: 'Scout', planner: 'Planner', runner: 'Runner', doctor: 'Doctor', verifier: 'Verifier', scribe: 'Scribe', guard: 'Guard', swarm: 'FirstRun' };

/** Print a run's events as a readable live log. */
export function attachPrinter(rec, { prefix = '', verbose = false } = {}) {
  const p = (s) => console.log(prefix + s);
  rec.on('event', (ev) => {
    const d = ev.data || {};
    switch (ev.type) {
      case 'phase': {
        const label = { scout: 'Reading the docs and manifests', plan: 'Planning the setup as a newcomer would', coldstart: 'Following the docs on a clean machine', repair: null, replay: 'Replaying the repaired guide from zero', publish: 'Writing the corrected docs and Setup Passport', done: null, error: null }[d.phase];
        if (label) p(`\n${bold(cyan('■'))} ${bold(label)}`);
        break;
      }
      case 'facts':
        p(dim(`  ${d.stack} project · docs: ${d.docs.join(', ') || 'none'}${d.compose ? ` · compose: ${d.compose.services.join(', ')}` : ''}${d.envExample ? ` · ${d.envExample.file}` : ''}`));
        break;
      case 'plan':
        p(dim(`  ${d.steps.filter((s) => !s.skip).length} commands to follow (${d.steps.filter((s) => s.skip).length} skipped) on ${d.image} · done when ${d.verify.kind === 'http' ? `GET ${d.verify.target}` : d.verify.target}`));
        for (const cf of d.conflicts) p(`  ${yellow('⚠')} ${cf.what}: docs say ${bold(cf.docs)}, code says ${bold(cf.truth)} ${dim(`(${cf.source})`)}`);
        break;
      case 'step.start':
        if (ev.agent === 'verifier') break;
        p(`  ${blue('▸')} ${dim(d.stepId)} ${d.command}${d.n > 1 ? dim(` (attempt ${d.n})`) : ''}`);
        break;
      case 'step.log':
        if (verbose) for (const l of d.chunk.split('\n').slice(-4)) p(dim(`      ${l.slice(0, 160)}`));
        break;
      case 'step.end':
        if (ev.agent === 'verifier') { p(`  ${d.status === 'passed' ? green('✓') : red('✗')} ${dim(d.stepId)} ${d.command} ${dim(fmtDuration(d.durationMs))}`); break; }
        if (d.status === 'passed') p(`    ${green('✓')} ${dim(fmtDuration(d.durationMs))}`);
        else {
          p(`    ${red('✗')} exit ${d.exitCode} ${dim(fmtDuration(d.durationMs))}`);
          for (const l of d.logTail.split('\n').filter((x) => x.trim()).slice(-3)) p(red(`      ${l.slice(0, 180)}`));
        }
        break;
      case 'diagnosis':
        p(`    ${magenta('⚕')} ${bold(d.diagnosis.class)}: ${d.diagnosis.cause} ${dim(d.diagnosis.by === 'bob' ? `[IBM Bob${d.diagnosis.bobcoins ? ` · ${d.diagnosis.bobcoins} Bobcoins` : ''}]` : `[rule ${d.diagnosis.ruleId || '-'}]`)}`);
        break;
      case 'fix':
        p(`    ${yellow('⚒')} ${d.fix.doc?.text || d.fix.actions.map((a) => a.type).join(', ')}`);
        break;
      case 'step.inserted':
        p(`    ${yellow('+')} FirstRun adds a missing step: ${d.step.command}`);
        break;
      case 'evidence':
        p(`    ${d.status === 'verified' ? green('✔ evidence ' + d.id + ': fixed and verified') : d.status === 'needs-human' ? red('✋ ' + d.id + ': needs a maintainer') : d.status === 'progressed' ? green('↪ ' + d.id + ': worked, revealed the next error') : yellow('… ' + d.id + ': fix did not work')}`);
        break;
      case 'bob':
        if (!d.ok) p(dim(`    IBM Bob unavailable: ${d.error}`));
        break;
      case 'note':
        p(dim(`  · ${d.message}`));
        break;
      case 'replay.step':
        p(`  ${d.status === 'passed' ? green('✓') : red('✗')} ${dim(d.stepId)} ${d.command} ${dim(fmtDuration(d.durationMs))}`);
        break;
      case 'replay.end':
        p(`  ${d.status === 'passed' ? green(bold('Replay passed')) : red(bold('Replay failed'))} ${dim(`in ${fmtDuration(d.durationMs)}`)}`);
        break;
      case 'passport':
        printPassport(d, p);
        break;
      case 'error':
        p(red(`\n✗ ${d.message}`));
        break;
      default:
    }
  });
}

export function printPassport(d, p = console.log) {
  const color = d.verdict === 'VERIFIED' ? green : d.verdict === 'PARTIAL' ? yellow : red;
  p('');
  p(color(bold(`  ┌─ SETUP PASSPORT ${'─'.repeat(40)}`)));
  p(`  │ ${bold(d.repo)} @ ${d.commit}`);
  p(`  │ ${color(bold(d.verdict))}  ·  ${d.runtime} (${d.image})`);
  p(`  │ breaks found ${bold(d.breaksFound)} · fixed ${bold(d.breaksFixed)} · needs a human ${bold(d.needsHuman)}`);
  if (d.replaySeconds) p(`  │ clone → running, from zero: ${bold(fmtDuration(d.replaySeconds * 1000))}`);
  if (d.diagnosedByBob || d.bobcoins) p(`  │ IBM Bob: ${d.diagnosedByBob} diagnoses · ${d.bobcoins} Bobcoins`);
  p(color(bold(`  └${'─'.repeat(57)}`)));
}
