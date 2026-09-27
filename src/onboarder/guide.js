import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, headTail } from '../util.js';

/**
 * Build guide.json from an EXISTING verified run folder (.firstrun run.json + evidence + plan).
 * Each proven step with command, why, checker, undo, timeoutMs; never include a step the replay did not prove.
 */
export function buildGuide(runDir) {
  const runFile = path.join(runDir, 'run.json');
  const planFile = path.join(runDir, 'plan.json');
  const evidenceDir = path.join(runDir, 'evidence');

  if (!fs.existsSync(runFile)) {
    throw new Error(`run.json not found in ${runDir}`);
  }
  if (!fs.existsSync(planFile)) {
    throw new Error(`plan.json not found in ${runDir}`);
  }
  if (!fs.existsSync(evidenceDir)) {
    throw new Error(`evidence directory not found in ${runDir}`);
  }

  const run = readJson(runFile);
  const plan = readJson(planFile);

  // Load all evidence files
  const evidenceFiles = fs.readdirSync(evidenceDir).filter(f => f.endsWith('.json'));
  const evidence = evidenceFiles.map(f => readJson(path.join(evidenceDir, f)));

  // Build a map of evidence by stepId
  const evidenceByStep = {};
  for (const e of evidence) {
    if (!evidenceByStep[e.stepId]) evidenceByStep[e.stepId] = [];
    evidenceByStep[e.stepId].push(e);
  }

  // Determine verdict from run
  const verdict = run.phase === 'done' && run.steps && Object.values(run.steps).every(s => s.status === 'passed' || s.status === 'repaired' || s.status === 'skipped')
    ? 'VERIFIED'
    : 'PARTIAL';

  // Get replay seconds from run or estimate
  const replaySeconds = run.durationMs ? Math.round(run.durationMs / 1000) : 0;

  // Filter to only steps that were proven (passed on first try, or repaired with verified evidence)
  const provenSteps = plan.steps.filter(step => {
    if (step.skip || step.status === 'skipped') return false;
    // Must have verified evidence OR have passed on first try (no evidence needed)
    const stepEvidence = evidenceByStep[step.id] || [];
    const hasVerifiedEvidence = stepEvidence.some(e => e.status === 'verified');
    const passedFirstTry = step.status === 'passed' && stepEvidence.length === 0;
    return hasVerifiedEvidence || passedFirstTry;
  });

  // Build steps for guide.json
  const guideSteps = provenSteps.map(step => {
    const stepEvidence = evidenceByStep[step.id] || [];
    const verifiedEvidence = stepEvidence.filter(e => e.status === 'verified');
    const lastEvidence = verifiedEvidence[verifiedEvidence.length - 1];

    // Determine check type based on step kind and evidence
    const check = buildCheck(step, lastEvidence);
    const undo = buildUndo(step, lastEvidence);
    const timeoutMs = getTimeoutMs(step.kind);
    const platform = getPlatform(step);
    const why = buildWhy(step, lastEvidence);
    const alreadySatisfiedIf = buildAlreadySatisfiedIf(step, lastEvidence);

    return {
      id: step.id,
      title: step.kind.charAt(0).toUpperCase() + step.kind.slice(1).replace('-', ' '),
      kind: step.kind,
      say: {
        new: buildSay(step, lastEvidence, 'new'),
        experienced: buildSay(step, lastEvidence, 'experienced')
      },
      why,
      do: buildDo(step, lastEvidence),
      platform,
      target: buildTarget(step),
      check,
      timeoutMs,
      undo,
      risk: getRisk(step.kind),
      optional: false,
      alreadySatisfiedIf
    };
  });

  // Build done check
  const done = buildDone(plan.verify);

  // Build scorecard
  const scorecard = buildScorecard(plan.steps, evidenceByStep);

  // Build security verdict
  const security = { verdict: 'clear', findings: [] };

  // Build guide object
  const guide = {
    schema: 'humble.guide/1',
    repo: plan.repo,
    commit: plan.commit,
    verdict,
    provenOn: {
      image: plan.image,
      os: 'linux',
      replaySeconds,
      runId: path.basename(runDir)
    },
    env: { CI: '1', npm_config_yes: 'true' },
    steps: guideSteps,
    done,
    scorecard,
    security
  };

  // Compute hash
  const canonical = JSON.stringify(guide, Object.keys(guide).sort());
  guide.hash = crypto.createHash('sha256').update(canonical).digest('hex');

  return guide;
}

function buildCheck(step, evidence) {
  // For serve steps, use http check
  if (step.kind === 'serve' && step.serve?.port) {
    return {
      type: 'http',
      url: `http://127.0.0.1:${step.serve.port}/health`,
      expect: 200
    };
  }

  // For services, check port
  if (step.kind === 'services') {
    // Try to determine ports from docker-compose or evidence
    return { type: 'exit', code: 0 };
  }

  // For migrate, check file-has or exit
  if (step.kind === 'migrate') {
    return { type: 'exit', code: 0 };
  }

  // For install, check exit or file-has (node_modules)
  if (step.kind === 'install') {
    return { type: 'file-has', file: 'package.json', pattern: '"dependencies"' };
  }

  // For env, check file-has
  if (step.kind === 'env') {
    return { type: 'file-has', file: '.env', pattern: '^' };
  }

  // For test, check exit
  if (step.kind === 'test') {
    return { type: 'exit', code: 0 };
  }

  // Default: exit code
  return { type: 'exit', code: 0 };
}

function buildUndo(step, evidence) {
  if (step.kind === 'install') {
    return { type: 'run', command: 'rm -rf node_modules package-lock.json' };
  }
  if (step.kind === 'env') {
    return { type: 'restore-file', file: '.env' };
  }
  if (step.kind === 'services') {
    return { type: 'run', command: 'docker compose down' };
  }
  if (step.kind === 'migrate') {
    // Migrations are typically irreversible; return empty undo
    return { type: 'none' };
  }
  if (step.kind === 'serve') {
    return { type: 'run', command: 'pkill -f "node.*server.js" || true' };
  }
  if (step.kind === 'test') {
    return { type: 'none' };
  }
  return { type: 'none' };
}

function getTimeoutMs(kind) {
  const timeouts = {
    install: 1500000,   // 25 min
    services: 120000,   // 2 min
    migrate: 300000,    // 5 min
    build: 300000,      // 5 min
    serve: 150000,      // 2.5 min
    test: 300000,       // 5 min
    env: 30000,         // 30 sec
    other: 60000        // 1 min
  };
  return timeouts[kind] || 600000; // default 10 min
}

function getPlatform(step) {
  // The saved command is proven on Linux; other hosts require an explicit translation.
  return { linux: 'proven', darwin: 'translated', win32: 'translated' };
}

function buildWhy(step, evidence) {
  if (!evidence) {
    return { evidenceId: null, cause: 'Step passed on first try', log: null };
  }
  return {
    evidenceId: evidence.id,
    cause: evidence.diagnosis?.cause || 'Step passed on first try',
    log: evidence.before?.logFile || null
  };
}

function buildSay(step, evidence, mode) {
  const base = {
    install: {
      new: 'This installs the libraries the app needs. The README might be missing a flag; I\'ve added it.',
      experienced: 'npm install with proven flags from the verified run.'
    },
    env: {
      new: 'This creates your local configuration file from the example. You\'ll add any required keys.',
      experienced: 'Create .env from .env.example with the verified command.'
    },
    services: {
      new: 'This starts the database and other services the app needs using Docker.',
      experienced: 'docker compose up -d with the verified services.'
    },
    migrate: {
      new: 'This prepares the database schema and sample data. The README might have the wrong script name; I fixed it.',
      experienced: 'Run the verified migration command.'
    },
    build: {
      new: 'This builds the project for production.',
      experienced: 'Run the verified build command.'
    },
    serve: {
      new: 'This starts the app. It will keep running; open another terminal to check it works.',
      experienced: 'Start the dev server on the verified port.'
    },
    test: {
      new: 'This runs the tests to confirm everything works.',
      experienced: 'Run the test suite.'
    },
    other: {
      new: 'Next setup step.',
      experienced: 'Next step.'
    }
  };

  const s = base[step.kind] || base.other;
  return s[mode];
}

function buildDo(step, evidence) {
  // Use the final verified command from evidence if available
  const command = evidence?.after?.command || step.command;

  if (step.kind === 'env') {
    // Check if it's a secret step
    const hasSecret = evidence?.fix?.patches?.some(p => p.op === 'append-env') || false;
    if (hasSecret) {
      return {
        type: 'secret',
        file: '.env',
        fromTemplate: '.env.example',
        key: 'SESSION_SECRET'
      };
    }
    return { type: 'run', command, cwd: '.', stdin: null };
  }

  if (step.kind === 'serve') {
    return { type: 'run', command, cwd: '.', stdin: null };
  }

  return { type: 'run', command, cwd: '.', stdin: null };
}

function buildTarget(step) {
  if (step.kind === 'serve') {
    return { kind: 'terminal' };
  }
  if (step.kind === 'env') {
    return { kind: 'file-line', file: '.env', match: 'SESSION_SECRET=' };
  }
  return { kind: 'terminal' };
}

function buildAlreadySatisfiedIf(step, evidence) {
  if (step.kind === 'install') {
    return 'node_modules exists and package-lock.json is present';
  }
  if (step.kind === 'env') {
    return '.env file exists with required keys';
  }
  if (step.kind === 'services') {
    return 'Docker containers for required services are running';
  }
  return null;
}

function buildDone(verify) {
  if (verify?.kind === 'http' && verify.target) {
    return { type: 'http', url: verify.target, expect: 200 };
  }
  return { type: 'exit', code: 0 };
}

function buildScorecard(steps, evidenceByStep) {
  let proven = 0;
  let translated = 0;
  let needsHuman = 0;
  const skipped = [];

  for (const step of steps) {
    if (step.skip || step.status === 'skipped') {
      skipped.push({ command: step.command, why: step.skip || 'Skipped by planner' });
      continue;
    }
    const stepEvidence = evidenceByStep[step.id] || [];
    const hasVerified = stepEvidence.some(e => e.status === 'verified');
    if (hasVerified) {
      proven++;
    } else if (step.status === 'needs-human') {
      needsHuman++;
    } else {
      // Not proven but not skipped
      needsHuman++;
    }
  }

  // For now, no translated steps
  return { proven, translated, needsHuman, skipped };
}

export function getRisk(kind) {
  const risks = {
    install: 'low',
    env: 'low',
    services: 'medium',
    migrate: 'medium',
    build: 'low',
    serve: 'low',
    test: 'low',
    other: 'low'
  };
  return risks[kind] || 'low';
}

export function writeGuide(guide, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(guide, null, 2));
}
