import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * READ-ONLY host probe (node/python versions, docker present, OS, missing tools vs the plan).
 * No installs, no writes outside a temp dir.
 */
export async function probeHost() {
  const results = {
    os: os.platform(),
    osVersion: os.release(),
    arch: os.arch(),
    shell: process.env.SHELL || 'unknown',
    cpus: os.cpus().length,
    memory: {
      total: Math.round(os.totalmem() / (1024 ** 3)),
      free: Math.round(os.freemem() / (1024 ** 3))
    },
    node: await getNodeVersion(),
    npm: await getNpmVersion(),
    python: await getPythonVersion(),
    pip: await getPipVersion(),
    docker: await getDockerInfo(),
    git: await getGitVersion(),
    make: await getMakeVersion(),
    wsl: await isWsl(),
    ports: await getOccupiedPorts(),
    envFiles: await getEnvFiles(),
    diskSpace: await getDiskSpace(),
    timestamp: new Date().toISOString()
  };

  return results;
}

async function runCmd(cmd, args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { timeout: timeoutMs, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('close', code => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
    child.on('error', err => {
      resolve({ code: -1, stdout: '', stderr: err.message });
    });
  });
}

async function getNodeVersion() {
  const r = await runCmd('node', ['--version']);
  return r.code === 0 ? r.stdout.trim() : 'not found';
}

async function getNpmVersion() {
  const r = await runCmd('npm', ['--version']);
  return r.code === 0 ? r.stdout.trim() : 'not found';
}

async function getPythonVersion() {
  // Try python3 and python; on Windows, also recognize the standard py launcher.
  let r = await runCmd('python3', ['--version']);
  if (r.code !== 0) {
    r = await runCmd('python', ['--version']);
  }
  if (r.code !== 0 && process.platform === 'win32') {
    r = await runCmd('py', ['-3', '--version']);
  }
  if (r.code === 0) {
    // Parse "Python 3.11.5"
    const output = r.stdout || r.stderr;
    const match = output.match(/Python\s+(\d+\.\d+\.\d+)/);
    return match ? match[1] : output.trim();
  }
  return 'not found';
}

async function getPipVersion() {
  let r = await runCmd('pip3', ['--version']);
  if (r.code !== 0) {
    r = await runCmd('pip', ['--version']);
  }
  return r.code === 0 ? r.stdout.trim().split(' ')[1] : 'not found';
}

async function getDockerInfo() {
  const r = await runCmd('docker', ['version', '--format', '{{.Server.Version}}']);
  if (r.code !== 0) {
    return { present: false, version: null, compose: false };
  }
  const composeR = await runCmd('docker', ['compose', 'version', '--short']);
  return {
    present: true,
    version: r.stdout.trim(),
    compose: composeR.code === 0,
    composeVersion: composeR.code === 0 ? composeR.stdout.trim() : null
  };
}

async function getGitVersion() {
  const r = await runCmd('git', ['--version']);
  return r.code === 0 ? r.stdout.trim() : 'not found';
}

async function getMakeVersion() {
  const r = await runCmd('make', ['--version']);
  return r.code === 0 ? r.stdout.trim().split('\n')[0] : 'not found';
}

async function isWsl() {
  try {
    const release = await fs.readFile('/proc/version', 'utf8');
    return release.toLowerCase().includes('microsoft') || release.toLowerCase().includes('wsl');
  } catch {
    return false;
  }
}

async function getOccupiedPorts() {
  // Try ss first (Linux), then netstat, then lsof
  let r = await runCmd('ss', ['-tuln']);
  if (r.code === 0) {
    return parsePorts(r.stdout);
  }
  r = await runCmd('netstat', ['-tuln']);
  if (r.code === 0) {
    return parsePorts(r.stdout);
  }
  r = await runCmd('lsof', ['-i', '-P', '-n']);
  if (r.code === 0) {
    return parseLsofPorts(r.stdout);
  }
  return [];
}

function parsePorts(output) {
  const ports = [];
  for (const line of output.split('\n')) {
    const match = line.match(/:(?:(\d+))\s/);
    if (match) {
      const port = parseInt(match[1], 10);
      if (!isNaN(port) && !ports.includes(port)) {
        ports.push(port);
      }
    }
  }
  return ports;
}

function parseLsofPorts(output) {
  const ports = [];
  for (const line of output.split('\n')) {
    const match = line.match(/:(\d+)\s+\(LISTEN\)/);
    if (match) {
      const port = parseInt(match[1], 10);
      if (!isNaN(port) && !ports.includes(port)) {
        ports.push(port);
      }
    }
  }
  return ports;
}

async function getEnvFiles() {
  const cwd = process.cwd();
  const envFiles = ['.env', '.env.example', '.env.local', '.env.sample'];
  const results = {};
  for (const f of envFiles) {
    const fullPath = path.join(cwd, f);
    try {
      await fs.access(fullPath);
      const content = await fs.readFile(fullPath, 'utf8');
      results[f] = { exists: true, lines: content.split('\n').length };
    } catch {
      results[f] = { exists: false };
    }
  }
  return results;
}

async function getDiskSpace() {
  try {
    const r = await runCmd('df', ['-h', process.cwd()]);
    if (r.code === 0) {
      const lines = r.stdout.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        return {
          filesystem: parts[0],
          size: parts[1],
          used: parts[2],
          available: parts[3],
          usePercent: parts[4],
          mountedOn: parts[5]
        };
      }
    }
  } catch {}
  return null;
}

/**
 * Compare host probe results against a plan and return missing tools.
 */
export function findMissingTools(host, plan) {
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

export async function writeHostProbe(outputPath) {
  const host = await probeHost();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(host, null, 2));
  return host;
}
