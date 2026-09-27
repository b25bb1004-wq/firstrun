import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { bold, dim, green, red, yellow, cyan } from '../terminal.js';
import { readJson } from '../util.js';
import { buildGuide } from './guide.js';
import { probeHost } from './probe.js';
import { buildReport } from './report.js';

/**
 * HUMBLE onboarder MVP CLI
 * firstrun onboard <repo> --from <run-dir> [--guide] [--dry-run]
 */
export async function onboard(args) {
  const repo = args._[0];
  const runDir = args.from;
  const isGuide = args.guide === true || args.guide === 'true';
  const isDryRun = args['dry-run'] === true || args['dry-run'] === 'true';

  if (!repo) {
    console.error('Usage: firstrun onboard <repo> --from <run-dir> [--guide] [--dry-run]');
    return 1;
  }

  if (!runDir) {
    console.error('Error: --from <run-dir> is required');
    return 1;
  }

  const resolvedRunDir = path.resolve(runDir);
  if (!fs.existsSync(resolvedRunDir)) {
    console.error(`Error: run directory not found: ${resolvedRunDir}`);
    return 1;
  }

  // Load plan from run dir
  const planFile = path.join(resolvedRunDir, 'plan.json');
  if (!fs.existsSync(planFile)) {
    console.error(`Error: plan.json not found in ${resolvedRunDir}`);
    return 1;
  }

  const plan = readJson(planFile);

  console.log(`${bold(cyan('HUMBLE Onboarder'))} ${dim('·')} ${repo}`);
  console.log(dim(`Using verified run: ${resolvedRunDir}\n`));

  // Build guide.json from verified run
  console.log(dim('Building guide.json from verified run...'));
  const guide = buildGuide(resolvedRunDir);
  console.log(green('✓') + ' Guide built with ' + guide.steps.length + ' proven steps');

  // Run host probe
  console.log(dim('Probing host machine...'));
  const hostProbe = await probeHost();
  console.log(green('✓') + ' Host probe complete');

  // Build report
  console.log(dim('Building report...'));
  const report = buildReport(guide, hostProbe, plan);
  console.log(green('✓') + ' Report complete\n');

  // Print summary
  console.log(bold('REPORT:'));
  console.log(report.summary);
  console.log();

  // Print platform gaps
  if (report.platformGaps.length > 0) {
    console.log(bold('PLATFORM GAPS:'));
    for (const gap of report.platformGaps) {
      if (gap.type !== 'neutral') {
        console.log(`  ${yellow('⚠')} ${gap.message}`);
      }
    }
    console.log();
  }

  // Print missing tools
  if (report.missingTools.length > 0) {
    console.log(bold('MISSING TOOLS:'));
    for (const m of report.missingTools) {
      console.log(`  ${red('✗')} ${m.tool}: ${m.reason}`);
    }
    console.log();
  }

  // Print warnings
  if (report.warnings.length > 0) {
    console.log(bold('VERSION WARNINGS:'));
    for (const w of report.warnings) {
      console.log(`  ${yellow('⚠')} ${w.tool}: ${w.found} < ${w.required}`);
    }
    console.log();
  }

  // Handle --debug: run steps with debug diagnostics on failure
  if (args.debug) {
    return runDebug(guide, report, plan, resolvedRunDir);
  }

  // Handle --dry-run: print all steps and exit
  if (isDryRun) {
    console.log(bold('DRY RUN - All steps:'));
    for (let i = 0; i < guide.steps.length; i++) {
      const step = guide.steps[i];
      const status = report.steps[i]?.status || 'pending';
      const statusIcon = status === 'satisfied' ? green('✓') : status === 'needs-human' ? yellow('!') : status === 'gap' ? yellow('⚠') : dim('○');
      console.log(`  ${statusIcon} ${i + 1}. ${step.title} (${step.id})`);
      console.log(`     ${dim('Command:')} ${step.do?.command || step.do?.type}`);
      console.log(`     ${dim('Check:')} ${JSON.stringify(step.check)}`);
      console.log(`     ${dim('Timeout:')} ${step.timeoutMs}ms`);
      console.log(`     ${dim('Undo:')} ${JSON.stringify(step.undo)}`);
      console.log(`     ${dim('Status:')} ${status}`);
      if (step.why?.cause) {
        console.log(`     ${dim('Why:')} ${step.why.cause}`);
      }
      console.log();
    }
    console.log(bold('DONE check:'), JSON.stringify(guide.done));
    return 0;
  }

  // Handle --guide: interactive walkthrough
  if (isGuide) {
    return runGuide(guide, report);
  }

  // Default: just show report (no autopilot yet)
  console.log(dim('Use --guide to walk through steps interactively, or --dry-run to see all steps.'));
  console.log(dim('Autopilot mode is not yet implemented.'));
  return 0;
}

async function runGuide(guide, report) {
  console.log(bold('GUIDE MODE - Walk through each step'));
  console.log(dim('Press Enter to run each step, "s" to skip, "q" to quit\n'));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const shell = process.platform === 'win32' ? 'bash' : '/bin/bash';

  try {
    for (let i = 0; i < guide.steps.length; i++) {
      const step = guide.steps[i];
      const stepReport = report.steps[i];

      console.log(`${bold(`${i + 1}/${guide.steps.length}`)} ${step.say.new}`);
      console.log(`   ${cyan('$')} ${step.do?.command || step.do?.type}`);
      console.log(`   ${dim('Why:')} ${step.why?.cause || 'Verified step from clean machine run'}`);

      if (stepReport?.status === 'satisfied') {
        console.log(`   ${green('✓ Already satisfied on this machine')}`);
        console.log();
        continue;
      }

      if (stepReport?.status === 'needs-human') {
        console.log(`   ${yellow('! Requires human input:')} ${stepReport.reason}`);
        if (step.do?.type === 'secret') {
          console.log(`   ${dim('A masked field will open in the console for this secret.')}`);
        }
        console.log();
        continue;
      }

      if (stepReport?.status === 'gap') {
        console.log(`   ${yellow('⚠ Platform gap:')} ${stepReport.reason}`);
        console.log();
        continue;
      }

      const answer = await rl.question(dim('   › Press Enter to run, s=skip, q=quit: '));
      const a = answer.trim().toLowerCase();

      if (a === 'q') {
        console.log(dim('Quitting...'));
        return 0;
      }

      if (a === 's') {
        console.log(dim('   skipped\n'));
        continue;
      }

      // Run the step
      console.log(dim('   Running...'));
      const result = await runStep(shell, step, process.cwd());

      if (result.code === 0) {
        console.log(`   ${green('✓ done')}\n`);
      } else {
        console.log(`   ${red('✗ exit ' + result.code)}`);
        console.log(dim('   Last output:'));
        console.log(result.output.split('\n').slice(-6).map(l => '     ' + l).join('\n'));
        console.log();

        const retry = await rl.question(dim('   retry (r), continue (c), or quit (q)? '));
        const r = retry.trim().toLowerCase();
        if (r === 'q') return 1;
        if (r === 'r') {
          i--; // retry same step
          continue;
        }
      }
    }

    // Run done check
    console.log(bold('Final verification...'));
    const doneResult = await runDoneCheck(guide.done, process.cwd());
    if (doneResult.success) {
      console.log(green(bold('You are set up. Welcome aboard.')));
    } else {
      console.log(red('Verification failed:'), doneResult.message);
    }

    return doneResult.success ? 0 : 1;
  } finally {
    rl.close();
  }
}

function runStep(shell, step, cwd) {
  return new Promise((resolve) => {
    const command = step.do?.command;
    if (!command) {
      resolve({ code: 0, output: 'No command to run' });
      return;
    }

    const child = spawn(shell, ['-c', command], { cwd, stdio: ['inherit', 'pipe', 'pipe'] });
    let output = '';

    const onData = (d) => {
      const s = d.toString();
      output += s;
      process.stdout.write(dim(s.replace(/^/gm, '     ')));
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ code: 124, output: output + '\n[TIMEOUT]' });
    }, step.timeoutMs || 600000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ code: code ?? 1, output });
    });

    child.on('error', (e) => {
      clearTimeout(timeout);
      resolve({ code: 127, output: e.message });
    });
  });
}

async function runDoneCheck(done, cwd) {
  if (done.type === 'http') {
    // Try to fetch the URL
    try {
      const response = await fetch(done.url, { signal: AbortSignal.timeout(10000) });
      if (response.status === done.expect) {
        return { success: true, message: `HTTP ${done.expect} from ${done.url}` };
      }
      return { success: false, message: `HTTP ${response.status} from ${done.url}, expected ${done.expect}` };
    } catch (e) {
      return { success: false, message: `Failed to reach ${done.url}: ${e.message}` };
    }
  }

  if (done.type === 'exit') {
    return { success: true, message: 'No final verification command' };
  }

  return { success: false, message: `Unknown done check type: ${done.type}` };
}

/**
 * Debug mode: run steps and diagnose failures with the debugger
 */
async function runDebug(guide, report, plan, runDir) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(bold('DEBUG MODE - Run steps with diagnostics on failure'));
    console.log(dim('Run each step; on failure, show capture, diff, rule match, proposed fix, re-check\n'));

    const { capture, diffAgainstProof, runDoctorRules, diagnose, debugReport } = await import('./debug.js');
    const { probeHost } = await import('./probe.js');
    const shell = process.platform === 'win32' ? 'bash' : '/bin/bash';

    for (let i = 0; i < guide.steps.length; i++) {
      const step = guide.steps[i];
      const stepReport = report.steps[i];

      console.log(`${bold(`${i + 1}/${guide.steps.length}`)} ${step.say.new}`);
      console.log(`   ${cyan('$')} ${step.do?.command || step.do?.type}`);
      console.log(`   ${dim('Why:')} ${step.why?.cause || 'Verified step from clean machine run'}`);

      if (stepReport?.status === 'satisfied') {
        console.log(`   ${green('✓ Already satisfied on this machine')}\n`);
        continue;
      }

      if (stepReport?.status === 'needs-human') {
        console.log(`   ${yellow('! Requires human input:')} ${stepReport.reason}\n`);
        continue;
      }

      if (stepReport?.status === 'gap') {
        console.log(`   ${yellow('⚠ Platform gap:')} ${stepReport.reason}\n`);
        continue;
      }

      // Run the step
      console.log(dim('   Running...'));
      const result = await runStep(shell, step, process.cwd());

      if (result.code === 0) {
        console.log(`   ${green('✓ done')}\n`);
        continue;
      }

      // FAILURE - run debugger
      console.log(`   ${red('✗ exit ' + result.code)}`);
      console.log(dim('   Last output:'));
      console.log(result.output.split('\n').slice(-6).map(l => '     ' + l).join('\n'));
      console.log();

      // Capture failure
      const hostSnapshot = await probeHost();
      const captured = capture({
        exitCode: result.code,
        output: result.output,
        command: step.do?.command || '',
        cwd: process.cwd(),
        duration: 0,
        hostSnapshot,
        stepId: step.id,
        envVarNames: step.do?.key ? [step.do.key] : []
      });

      console.log(bold('   CAPTURE (redacted, last 200 lines):'));
      console.log(captured.output.split('\n').map(l => '     ' + l).join('\n'));
      console.log();

      // Host vs Proof diff
      console.log(bold('   HOST vs PROVEN RUN DIFF:'));
      const diff = diffAgainstProof(hostSnapshot, runDir, step.id);
      if (diff.diffs.length > 0) {
        for (const d of diff.diffs) {
          console.log(`     ${yellow('▸')} ${d.message}  [${d.type}]`);
        }
      } else {
        console.log(`     ${green('No significant differences found.')}`);
      }
      console.log();

      // Doctor rules
      console.log(bold('   DOCTOR RULE MATCHES:'));
      const ctx = { runDir, step };
      const doctorResults = await runDoctorRules(captured, ctx);
      if (doctorResults.length > 0) {
        for (const r of doctorResults) {
          console.log(`     ${r.ruleId}: ${r.cause} (confidence ${r.confidence})`);
          if (r.fix) {
            console.log(`       ${green('→ Fix:')} ${r.fix.actions?.[0]?.command || r.fix.doc?.text || 'see evidence'}`);
          }
        }
      } else {
        console.log(`     ${dim('No rules matched')}`);
      }
      console.log();

      // Full diagnosis
      console.log(bold('   DIAGNOSIS:'));
      const diagnosis = await diagnose(captured, ctx, { askBob: async () => ({ ok: false }), maxCost: 0 });
      console.log(`     ${diagnosis.cause}  *(${diagnosis.attributedTo})*`);
      if (diagnosis.fix) {
        console.log(`     ${green('Fix:')} ${diagnosis.fix.command}`);
        console.log(`     ${dim('Why:')} ${diagnosis.fix.why}`);
        console.log(`     ${dim('Checker:')} ${JSON.stringify(diagnosis.fix.checker)}`);
        console.log(`     ${dim('Undo:')} ${JSON.stringify(diagnosis.fix.undo)}`);
      }
      console.log();

      // Re-check
      console.log(bold('   RE-CHECK:'));
      const reResult = await runStep(shell, step, process.cwd());
      if (reResult.code === 0) {
        console.log(`     ${green('✓ Step now passes after fix')}\n`);
      } else {
        console.log(`     ${red('✗ Still failing (exit ' + reResult.code + ')')}\n`);
      }

      const retry = await rl.question(dim('   continue (c), quit (q)? '));
      if (retry.trim().toLowerCase() === 'q') return 1;
      console.log();
    }

    // Run done check
    console.log(bold('Final verification...'));
    const doneResult = await runDoneCheck(guide.done, process.cwd());
    if (doneResult.success) {
      console.log(green(bold('You are set up. Welcome aboard.')));
    } else {
      console.log(red('Verification failed:'), doneResult.message);
    }

    return doneResult.success ? 0 : 1;
  } finally {
    rl.close();
  }
}

import { spawn } from 'node:child_process';