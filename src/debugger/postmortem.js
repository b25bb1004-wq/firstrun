/**
 * Post-mortem shell: build docker commit + docker run -it command to reopen
 * the failed container at the failing step cwd and env.
 * Prints the command for the user, never runs it automatically.
 */

import { redactSecrets } from '../redact.js';

/**
 * Build the post-mortem shell command for a failed sandbox container.
 * 
 * @param {Object} params
 * @param {string} params.containerName - The sandbox container name (e.g., 'firstrun-abc123')
 * @param {string} params.image - The base image used
 * @param {string} params.failedStepCwd - The cwd at the failing step (from /firstrun/cwd)
 * @param {Record<string, string>} params.failedStepEnv - The environment at the failing step (from /firstrun/state.env)
 * @param {string} params.label - The run label for naming
 * @returns {Object} { commitCommand, runCommand, imageName }
 */
export function buildPostmortemCommands({ containerName, image, failedStepCwd, failedStepEnv, label }) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const imageName = `firstrun-postmortem-${label}-${timestamp}`;

  // Build the docker commit command
  // We need to preserve the cwd and env in the committed image
  const envExports = Object.entries(failedStepEnv || {})
    .filter(([k]) => !['OLDPWD', 'PWD', 'SHLVL', '_'].includes(k))
    .map(([k, v]) => `ENV ${k}=${JSON.stringify(v)}`)
    .join(' \\\n  ');

  const cwd = failedStepCwd || '/workspace';

  const commitCommand = [
    'docker commit',
    `  --change 'WORKDIR ${cwd}'`,
    envExports ? `  --change '${envExports}'` : '',
    `  ${containerName}`,
    `  ${imageName}`
  ].filter(Boolean).join(' \\\n');

  // Build the docker run -it command
  const runCommand = [
    'docker run -it --rm',
    `  --network container:${containerName}`, // Share network with original (for localhost services)
    `  -w ${cwd}`,
    ...Object.entries(failedStepEnv || {})
      .filter(([k]) => !['OLDPWD', 'PWD', 'SHLVL', '_'].includes(k))
      .map(([k, v]) => `  -e ${k}=${shq(v)}`),
    `  ${imageName}`,
    '  bash'
  ].filter(Boolean).join(' \\\n');

  return {
    commitCommand: redactSecrets(commitCommand),
    runCommand: redactSecrets(runCommand),
    imageName
  };
}

/**
 * Extract cwd and env from a running/stopped sandbox container.
 * Returns { cwd, env } or null if container not found.
 */
export async function extractContainerState(sandbox) {
  try {
    const cwd = await sandbox.readFile('/firstrun/cwd');
    const stateEnv = await sandbox.readFile('/firstrun/state.env');
    const env = {};
    if (stateEnv) {
      for (const line of stateEnv.split('\n')) {
        const m = line.match(/^declare -x ([A-Za-z_]\w*)="(.*)"$/);
        if (m) env[m[1]] = m[2];
      }
    }
    return { cwd: cwd?.trim() || '/workspace', env };
  } catch {
    return { cwd: '/workspace', env: {} };
  }
}

/**
 * Generate the full post-mortem instructions for the user.
 * This is what gets printed to the terminal.
 */
export function formatPostmortemInstructions({ containerName, image, failedStepCwd, failedStepEnv, label, failedStepCommand }) {
  const { commitCommand, runCommand, imageName } = buildPostmortemCommands({
    containerName,
    image,
    failedStepCwd,
    failedStepEnv,
    label
  });

  const lines = [
    '',
    '═══════════════════════════════════════════════════════════',
    '  POST-MORTEM SHELL',
    '═══════════════════════════════════════════════════════════',
    '',
    `The failing step was: ${failedStepCommand}`,
    `Working directory: ${failedStepCwd || '/workspace'}`,
    '',
    'To inspect the exact state at the point of failure, run these commands:',
    '',
    '1. Commit the failed container as a new image:',
    '',
    '   ' + commitCommand.split('\n').join('\n   '),
    '',
    '2. Open an interactive shell in that image:',
    '',
    '   ' + runCommand.split('\n').join('\n   '),
    '',
    'The shell will have:',
    `  • The same working directory (${failedStepCwd || '/workspace'})`,
    `  • The same environment variables (${Object.keys(failedStepEnv || {}).length} vars)`,
    `  • The same network (can reach localhost services from the original run)`,
    `  • All files and changes from the failed run`,
    '',
    'When you\'re done, the image remains as: ' + imageName,
    'Remove it with: docker rmi ' + imageName,
    '',
    '═══════════════════════════════════════════════════════════',
    ''
  ];

  return lines.join('\n');
}

/**
 * Shell escaping helper (matches src/util.js shq)
 */
function shq(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

/**
 * Main entry point: given a sandbox and failed step info, print the post-mortem instructions.
 * Does NOT execute anything - only prints.
 */
export async function printPostmortemShell(sandbox, { failedStepCommand, label }) {
  const state = await extractContainerState(sandbox);
  const containerName = sandbox.name;
  const image = sandbox.image;

  const instructions = formatPostmortemInstructions({
    containerName,
    image,
    failedStepCwd: state.cwd,
    failedStepEnv: state.env,
    label,
    failedStepCommand
  });

  console.log(instructions);
  return { commitCommand: buildPostmortemCommands({ containerName, image, failedStepCwd: state.cwd, failedStepEnv: state.env, label }).commitCommand, runCommand: buildPostmortemCommands({ containerName, image, failedStepCwd: state.cwd, failedStepEnv: state.env, label }).runCommand };
}