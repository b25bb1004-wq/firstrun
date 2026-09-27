import { promises as fs } from 'node:fs';
import path from 'node:path';
import { readJson } from '../util.js';
import { asManualGuideStep, buildPlatformGuide, translate } from './platform.js';

/**
 * The REPORT state: which steps are already satisfied on this machine,
 * which are missing, platform gaps (host vs sandbox) as the spec says.
 */
export function buildReport(guide, hostProbe, plan) {
  const report = {
    summary: '',
    steps: [],
    platformGuide: buildPlatformGuide(guide, hostProbe.os === 'win32' ? 'win32' : hostProbe.os === 'darwin' ? 'darwin' : 'linux'),
    platformGaps: [],
    security: guide.security,
    hostProfile: {
      os: hostProbe.os,
      osVersion: hostProbe.osVersion,
      arch: hostProbe.arch,
      node: hostProbe.node,
      python: hostProbe.python,
      docker: hostProbe.docker.present ? hostProbe.docker.version : 'not installed',
      dockerCompose: hostProbe.docker.compose ? hostProbe.docker.composeVersion : 'not installed',
      wsl: hostProbe.wsl
    },
    missingTools: [],
    warnings: [],
    scorecard: { ...guide.scorecard }
  };

  // Find missing tools from host probe vs plan
  const { missing, warnings } = findMissingTools(hostProbe, plan);
  report.missingTools = missing;
  report.warnings = warnings;

  // Analyze each step
  for (const step of guide.steps) {
    const stepReport = analyzeStep(step, hostProbe, plan, missing);
    report.steps.push(stepReport);
  }

  // Build platform gaps
  report.platformGaps = buildPlatformGaps(guide.steps, hostProbe);

  // Build summary
  const satisfied = report.steps.filter(s => s.status === 'satisfied').length;
  const missingCount = report.missingTools.length;
  const gapsCount = report.platformGaps.filter(g => g.type !== 'neutral').length;

  report.summary = buildSummary(guide, satisfied, missingCount, gapsCount, report.missingTools, report.warnings);

  return report;
}

function analyzeStep(step, hostProbe, plan, missingTools) {
  const hostPlatform = hostProbe.os === 'win32' ? 'win32' : hostProbe.os === 'darwin' ? 'darwin' : 'linux';
  const platformTranslation = translate(step, hostPlatform);
  const result = {
    id: step.id,
    title: step.title,
    status: 'pending', // satisfied, pending, needs-human, skipped, gap, manual
    reason: '',
    platform: step.platform,
    platformStatus: platformTranslation.status,
    provenCommand: platformTranslation.status === 'translated' ? platformTranslation.proven?.command ?? '' : '',
    translatedCommand: platformTranslation.status === 'translated' ? platformTranslation.command : '',
    translatedCommands: platformTranslation.status === 'translated' ? platformTranslation.commands : [],
    check: step.check,
    alreadySatisfiedIf: step.alreadySatisfiedIf
  };

  if (platformTranslation.status === 'manual' || platformTranslation.status === 'needs-wsl') {
    result.status = 'manual';
    result.manual = asManualGuideStep(step, platformTranslation);
    result.reason = platformTranslation.text;
    result.hint = platformTranslation.hint;
    return result;
  }

  // Check if already satisfied based on host probe
  if (step.alreadySatisfiedIf) {
    if (checkSatisfied(step, hostProbe)) {
      result.status = 'satisfied';
      result.reason = `Already satisfied: ${step.alreadySatisfiedIf}`;
      return result;
    }
  }

  // Check for platform gaps
  const platformStatus = platformTranslation.status;

  if (platformStatus === 'recommend-wsl-or-docker') {
    result.status = 'gap';
    result.reason = `This step is Linux-specific. On ${hostPlatform}, use WSL or Docker.`;
    return result;
  }

  if (platformStatus === 'translated') {
    result.platformGap = true;
    result.reason = `Command may need translation for ${hostPlatform} (proven on Linux).`;
  }

  // Check missing tools required for this step
  const stepMissing = missingTools.filter(m => isToolNeededForStep(m.tool, step));
  if (stepMissing.length > 0) {
    result.status = 'pending';
    result.reason = `Missing: ${stepMissing.map(m => m.tool).join(', ')}`;
    return result;
  }

  // Check for secrets
  if (step.do?.type === 'secret') {
    result.status = 'needs-human';
    result.reason = `Requires secret: ${step.do.key}`;
    return result;
  }

  result.status = 'pending';
  result.reason = 'Ready to run';
  return result;
}

function checkSatisfied(step, hostProbe) {
  if (!step.alreadySatisfiedIf) return false;

  // Check for node_modules
  if (step.alreadySatisfiedIf.includes('node_modules')) {
    // This would need to check the actual repo directory
    // For now, return false to be safe
    return false;
  }

  // Check for .env file
  if (step.alreadySatisfiedIf.includes('.env')) {
    return hostProbe.envFiles['.env']?.exists === true;
  }

  // Check for docker services
  if (step.alreadySatisfiedIf.includes('Docker containers')) {
    // Would need to check running containers
    return false;
  }

  return false;
}

function isToolNeededForStep(tool, step) {
  const toolMap = {
    node: ['install', 'build', 'test', 'serve', 'migrate'],
    npm: ['install'],
    python: ['install', 'build', 'test', 'serve', 'migrate'],
    pip: ['install'],
    docker: ['services'],
    'docker compose': ['services'],
    git: ['other'],
    make: ['build']
  };
  return toolMap[tool]?.includes(step.kind) || false;
}

function buildPlatformGaps(steps, hostProbe) {
  const gaps = [];
  const hostPlatform = hostProbe.os === 'win32' ? 'win32' : hostProbe.os === 'darwin' ? 'darwin' : 'linux';

  if (hostPlatform === 'linux') {
    return [{ type: 'neutral', message: 'All steps proven on Linux (your platform).' }];
  }

  for (const step of steps) {
    const translation = translate(step, hostPlatform);
    const platformStatus = translation.status;
    if (platformStatus === 'translated') {
      gaps.push({
        type: 'translated',
        stepId: step.id,
        stepTitle: step.title,
        message: `Translated, not proven on ${hostPlatform}: ${step.do?.command || step.title}`,
        provenCommand: translation.proven.command,
        translatedCommand: translation.command,
      });
    } else if (platformStatus === 'manual' || platformStatus === 'needs-wsl') {
      gaps.push({
        type: platformStatus,
        stepId: step.id,
        stepTitle: step.title,
        message: translation.text,
        hint: translation.hint,
      });
    }
  }

  if (gaps.length === 0) {
    gaps.push({ type: 'neutral', message: 'No platform gaps detected.' });
  }

  return gaps;
}

function buildSummary(guide, satisfied, missingCount, gapsCount, missingTools, warnings) {
  const parts = [];

  // Say what actually happened: breaks fixed or not, and the replay time only when the run recorded one.
  const fixed = (guide.steps || []).filter((s) => s.why?.evidenceId).length;
  const secs = guide.provenOn?.replaySeconds;
  parts.push(`I set this repo up on a clean machine${fixed ? `, fixed ${fixed} step${fixed === 1 ? '' : 's'} that broke` : '; it worked as written'} and proved it from zero${secs != null ? ` in ${secs}s` : ''}.`);
  parts.push(`Proven for you: ${guide.steps.length} steps (${satisfied} already done on your machine).`);

  if (missingCount > 0) {
    parts.push(`Missing tools: ${missingTools.map(m => m.tool).join(', ')}.`);
  }

  if (warnings.length > 0) {
    parts.push(`Version warnings: ${warnings.map(w => `${w.tool} ${w.found} < ${w.required}`).join(', ')}.`);
  }

  if (gapsCount > 0) {
    parts.push(`Platform gaps: ${gapsCount} step(s) not proven on your OS.`);
  }

  const secretSteps = guide.steps.filter(s => s.do?.type === 'secret').length;
  if (secretSteps > 0) {
    parts.push(`Secrets needed: ${secretSteps} (you'll paste into a private field, never shared).`);
  }

  parts.push(`Security: ${guide.security.verdict} (${guide.security.findings.length} findings).`);

  return parts.join('\n');
}

function findMissingTools(host, plan) {
  const missing = [];
  const warnings = [];

  // Check runtime
  if (plan.runtime?.name === 'node') {
    const requiredVersion = plan.runtime.version;
    if (host.node === 'not found') {
      missing.push({ tool: 'node', required: requiredVersion, found: null, reason: 'Node.js not installed' });
    } else {
      const hostMajor = parseInt(host.node.replace('v', '').split('.')[0], 10);
      const requiredMajor = parseInt(requiredVersion.split('.')[0], 10);
      if (hostMajor < requiredMajor) {
        warnings.push({ tool: 'node', required: requiredVersion, found: host.node, reason: `Node.js version ${hostMajor} < required ${requiredMajor}` });
      }
    }
  }

  if (plan.runtime?.name === 'python') {
    const requiredVersion = plan.runtime.version;
    if (host.python === 'not found') {
      missing.push({ tool: 'python', required: requiredVersion, found: null, reason: 'Python not installed' });
    }
  }

  // Check docker for services
  const hasServices = plan.steps.some(s => s.kind === 'services');
  if (hasServices) {
    if (!host.docker.present) {
      missing.push({ tool: 'docker', required: 'any', found: null, reason: 'Docker not installed (required for services)' });
    } else if (!host.docker.compose) {
      missing.push({ tool: 'docker compose', required: 'v2', found: host.docker.version, reason: 'Docker Compose v2 not available' });
    }
  }

  // Check git
  if (host.git === 'not found') {
    missing.push({ tool: 'git', required: 'any', found: null, reason: 'Git not installed' });
  }

  // Check make if needed
  const needsMake = plan.steps.some(s => s.command.includes('make '));
  if (needsMake && host.make === 'not found') {
    missing.push({ tool: 'make', required: 'any', found: null, reason: 'Make not installed (required by build steps)' });
  }

  return { missing, warnings };
}

export async function writeReport(report, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
}
