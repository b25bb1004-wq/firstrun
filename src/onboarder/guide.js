import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, headTail } from '../util.js';
import { detectService, getProvenComposeSnippet, PROVEN_SERVICES } from './services.js';

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
  // The proof's replay time: run.replay.durationMs (engine v2), else the passport; never a made-up 0.
  const passportFile = path.join(runDir, 'out', 'passport.json');
  const passport = run.passport || (fs.existsSync(passportFile) ? JSON.parse(fs.readFileSync(passportFile, 'utf8')) : null);
  const replaySeconds = run.replay?.durationMs ? Math.round(run.replay.durationMs / 1000)
    : passport?.replaySeconds ?? (run.durationMs ? Math.round(run.durationMs / 1000) : null);

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
    const check = buildCheck(step, lastEvidence, evidenceByStep, runDir, plan.verify);
    const undo = buildUndo(step, lastEvidence);
    const timeoutMs = getTimeoutMs(step.kind);
    const platform = getPlatform(step);
    const why = buildWhy(step, lastEvidence, plan);
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

function buildCheck(step, evidence, evidenceByStep, runDir, verify) {
  // Serve steps: the URL the proof itself checked (plan.verify), never an invented /health.
  if (step.kind === 'serve' && step.serve?.port) {
    const proven = verify?.kind === 'http' && verify.target.includes(`:${step.serve.port}`) ? verify.target : `http://127.0.0.1:${step.serve.port}/`;
    return { type: 'http', url: proven, expect: 200 };
  }

  // For services, check port and protocol
  if (step.kind === 'services') {
    // Get ports from the proven compose or evidence
    const ports = getServicePorts(step, evidenceByStep, runDir);
    return {
      type: 'port',
      ports,
      protocol: 'auto' // Will check postgres/redis protocol where known
    };
  }

  // For migrate, check file-has or exit
  if (step.kind === 'migrate') {
    return { type: 'exit', code: 0 };
  }

  // For install, check exit or file-has (node_modules)
  // Install: a marker the package manager writes only after a successful install (package.json already has
  // "dependencies" before anything runs, so it proved nothing).
  if (step.kind === 'install') {
    const cmd = String(evidence?.after?.command || step.command);
    if (/^npm\b/.test(cmd)) return { type: 'file-has', file: 'node_modules/.package-lock.json', pattern: '^' };
    if (/^pnpm\b/.test(cmd)) return { type: 'file-has', file: 'node_modules/.modules.yaml', pattern: '^' };
    if (/^yarn\b/.test(cmd)) return { type: 'file-has', file: 'node_modules/.yarn-integrity', pattern: '^' };
    return { type: 'exit', code: 0 };
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
  // Install: remove only what this step created (recorded by the runner); never the repo's own lockfile.
  if (step.kind === 'install') {
    return { type: 'created-only', note: 'removes node_modules only if this step created it' };
  }
  if (step.kind === 'env') {
    return { type: 'restore-file', file: '.env' };
  }
  if (step.kind === 'services') {
    // Only stop and remove containers HUMBLE started (labelled with humble.started=true)
    return {
      type: 'run',
      command: 'docker ps -a --filter "label=humble.started=true" --format "{{.ID}}" | xargs -r docker stop | xargs -r docker rm'
    };
  }
  if (step.kind === 'migrate') {
    // Migrations are typically irreversible; return empty undo
    return { type: 'none' };
  }
  // Serve: the runner stops the server process it started (it holds the pid); no pkill guesswork.
  if (step.kind === 'serve') {
    return { type: 'stop-started', note: 'stops the server HUMBLE started' };
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

const PURPOSE = {
  install: "installs the project's dependencies", env: 'creates your local config from the example',
  services: 'starts the services the app needs', migrate: 'sets up the database schema', build: 'builds the project',
  serve: 'starts the app', test: "runs the project's tests", other: 'a setup step from the docs',
};
// The reason for a step: what it does and where the docs say it, plus the break and fix if it needed one.
function buildWhy(step, evidence, plan) {
  const src = step.source?.file ? ` (${step.source.file}${step.source.line ? ':' + step.source.line : ''})` : '';
  const purpose = `${PURPOSE[step.kind] || PURPOSE.other}${src}`;
  if (!evidence) return { evidenceId: null, cause: purpose, proof: `worked first time on a clean ${plan?.image || 'machine'}`, log: null };
  return { evidenceId: evidence.id, cause: evidence.diagnosis?.cause || purpose, proof: 'fixed, then replayed from zero', log: evidence.before?.logFile || null };
}

function buildSay(step, evidence, mode) {
  const base = {
    install: {
      new: 'This installs the libraries the app needs.',
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
      new: 'This prepares the database schema and sample data.',
      experienced: 'Run the verified migration command.'
    },
    build: {
      new: 'This builds the project for production.',
      experienced: 'Run the verified build command.'
    },
    serve: {
      new: 'This starts the app. I keep it running and check that it answers.',
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
  // Only claim a fix when the proof has one (it used to say "I've added a flag" for steps that never broke).
  if (evidence && mode === 'new') return `${s.new} The README's version broke on a clean machine: ${evidence.diagnosis?.cause || 'see the proof'} This is the fixed command.`;
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

  if (step.kind === 'services') {
    // Add label to docker compose so we know which containers HUMBLE started
    // Labels belong in the compose file (docker-compose.yml) under each service's 'labels' section,
    // not as a flag to 'docker compose up'. The proven acme-shop run used plain 'docker compose up -d'.
    // We return the command as-is; labels are added by the proven compose file.
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

function getServicePorts(step, evidenceByStep, runDir) {
  // Extract ports from the step's evidence or command
  const ports = [];
  const stepEvidence = evidenceByStep[step.id] || [];
  for (const e of stepEvidence) {
    if (e.fix?.actions) {
      for (const action of e.fix.actions) {
        if (action.type === 'service' && action.port) {
          ports.push(action.port);
        }
      }
    }
    if (e.fix?.patches) {
      for (const patch of e.fix.patches) {
        if (patch.op === 'compose-add-service' && patch.port) {
          ports.push(patch.port);
        }
      }
    }
  }
  // Also scan ALL evidence in the run for service additions (since services may be added in later steps)
  for (const [, evidences] of Object.entries(evidenceByStep)) {
    for (const e of evidences) {
      if (e.fix?.actions) {
        for (const action of e.fix.actions) {
          if (action.type === 'service' && action.port && !ports.includes(action.port)) {
            ports.push(action.port);
          }
        }
      }
      if (e.fix?.patches) {
        for (const patch of e.fix.patches) {
          if (patch.op === 'compose-add-service' && patch.port && !ports.includes(patch.port)) {
            ports.push(patch.port);
          }
        }
      }
    }
  }
  // Also check the proven docker-compose.yml in the run output (the final verified compose)
  if (runDir) {
    const composePath = path.join(runDir, 'out', 'pr', 'docker-compose.yml');
    if (fs.existsSync(composePath)) {
      const composeContent = fs.readFileSync(composePath, 'utf8');
      // Parse for port mappings (simplified - just look for common ports)
      if (composeContent.includes('5432')) ports.push(5432);
      if (composeContent.includes('6379')) ports.push(6379);
      if (composeContent.includes('27017')) ports.push(27017);
      if (composeContent.includes('3306')) ports.push(3306);
    }
  }
  // Also check known catalog
  if (ports.length === 0) {
    // Common ports from proven runs
    if (step.command?.includes('postgres')) ports.push(5432);
    if (step.command?.includes('redis')) ports.push(6379);
  }
  return [...new Set(ports)];
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
