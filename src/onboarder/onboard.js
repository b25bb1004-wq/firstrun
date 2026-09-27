import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { bold, dim, green, red, yellow, cyan } from '../terminal.js';
import { readJson } from '../util.js';
import { buildGuide } from './guide.js';
import { probeHost } from './probe.js';
import { buildReport } from './report.js';
import { runManualChecker } from './manual-checker.js';
import { runEnvWizard } from './env-wizard.js';
import { sessionEnvironment } from './platform.js';

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
        if (gap.type === 'translated') {
          console.log(`     ${dim('Proven on Linux:')} ${gap.provenCommand}`);
          console.log(`     ${yellow('Translated, not proven:')} ${gap.translatedCommand}`);
        } else if (gap.hint) {
          console.log(`     ${dim('Hint:')} ${gap.hint}`);
        }
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

  // Handle --dry-run: print all steps and exit
  if (isDryRun) {
    console.log(bold('DRY RUN - All steps:'));
    for (let i = 0; i < guide.steps.length; i++) {
      const step = guide.steps[i];
      const status = report.steps[i]?.status || 'pending';
      const statusIcon = status === 'satisfied' ? green('✓') : status === 'needs-human' ? yellow('!') : status === 'gap' ? yellow('⚠') : dim('○');
      console.log(`  ${statusIcon} ${i + 1}. ${step.title} (${step.id})`);
      console.log(`     ${dim('Command:')} ${stepReportCommand(step, report.steps[i])}`);
      console.log(`     ${dim('Check:')} ${JSON.stringify(stepReport?.manual?.checker || step.check)}`);
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

  let rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
  const sessionEnv = {};

  try {
    for (let i = 0; i < guide.steps.length; i++) {
      const step = guide.steps[i];
      const stepReport = report.steps[i];

      console.log(`${bold(`${i + 1}/${guide.steps.length}`)} ${step.say?.new || step.title || step.text || 'Manual setup step'}`);
      if (stepReport?.platformStatus === 'translated') {
        console.log(`   ${dim('Proven on Linux:')} ${stepReport.provenCommand}`);
        console.log(`   ${yellow('Translated, not proven:')} ${stepReport.translatedCommand}`);
      } else if (stepReport?.status === 'manual' || step.kind === 'manual') {
        console.log(`   ${yellow('Manual step:')} ${stepReport?.manual?.text || step.text}`);
        console.log(`   ${dim('Why:')} ${stepReport?.manual?.why || step.why}`);
        if (stepReport?.hint) console.log(`   ${dim('Hint:')} ${stepReport.hint}`);
      } else {
        console.log(`   ${cyan('$')} ${step.do?.command || step.do?.type}`);
      }
      console.log(`   ${dim('Why:')} ${step.why?.cause || 'Verified step from clean machine run'}`);

      if (stepReport?.status === 'satisfied') {
        console.log(`   ${green('✓ Already satisfied on this machine')}`);
        console.log();
        continue;
      }

      if (stepReport?.status === 'needs-human') {
        console.log(`   ${yellow('! Requires human input:')} ${stepReport.reason}`);
        if (step.do?.type === 'secret') {
          rl.close();
          try {
            const result = await runEnvWizard({ projectDir: process.cwd() });
            console.log(`   ${green('Saved locally to .env.')} ${result.keysWritten} field(s) written; values were not displayed or transmitted.`);
            const checked = await runManualChecker(result.checker, { cwd: process.cwd() });
            if (checked.passed) console.log(`   ${green('Environment check passed.')}`);
            else console.log(`   ${yellow('Check not satisfied yet.')} ${checked.message}`);
          } catch (error) {
            console.log(`   ${yellow('Could not write .env:')} ${error.message}`);
          } finally {
            rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          }
        }
        console.log();
        continue;
      }

      if (stepReport?.status === 'gap') {
        console.log(`   ${yellow('⚠ Platform gap:')} ${stepReport.reason}`);
        console.log();
        continue;
      }

      if (stepReport?.status === 'manual' || step.kind === 'manual') {
        const answer = await rl.question(dim('   Complete the manual step, then press Enter to check it (q=quit): '));
        if (answer.trim().toLowerCase() === 'q') return 0;
        const checked = await runManualChecker(stepReport?.manual?.checker || step.checker, { cwd: process.cwd() });
        if (checked.passed) console.log(`   ${green('Done.')} ${checked.message}\n`);
        else {
          console.log(`   ${yellow('Not complete yet.')} ${checked.message}\n`);
          i--;
        }
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
      Object.assign(sessionEnv, sessionEnvironment(step, process.platform, { repoRoot: process.cwd(), baseEnv: { ...process.env, ...sessionEnv } }));
      const result = await runStep(shell, step, process.cwd(), stepReport?.translatedCommand, sessionEnv);

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

function stepReportCommand(step, stepReport) {
  if (stepReport?.status === 'manual') return '[manual step; no command]';
  if (stepReport?.platformStatus === 'translated') {
    return `${stepReport.provenCommand} -> ${stepReport.translatedCommand} (translated, not proven)`;
  }
  return step.do?.command || step.do?.type || step.text || '[manual step]';
}

function runStep(shell, step, cwd, commandOverride = null, sessionEnv = {}) {
  return new Promise((resolve) => {
    const command = commandOverride ?? step.do?.command;
    if (!command) {
      resolve({ code: 0, output: 'No command to run' });
      return;
    }

    const shellArgs = process.platform === 'win32'
      ? ['-NoProfile', '-NonInteractive', '-Command', command]
      : ['-c', command];
    const child = spawn(shell, shellArgs, {
      cwd,
      env: { ...process.env, ...sessionEnv },
      stdio: ['inherit', 'pipe', 'pipe'],
      windowsHide: true,
    });
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

import { spawn } from 'node:child_process';
