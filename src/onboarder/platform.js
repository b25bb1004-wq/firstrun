import path from 'node:path';

const PLATFORM = Object.freeze({
  linux: 'linux',
  darwin: 'darwin',
  win32: 'win32',
});

const BREW_HINTS = new Map([
  ['build-essential', 'Xcode Command Line Tools (`xcode-select --install`) or Homebrew `make` and `gcc`'],
  ['libpq-dev', 'Homebrew formula `libpq`'],
  ['python3-dev', 'Homebrew `python`'],
  ['libssl-dev', 'Homebrew formula `openssl@3`'],
]);

function splitAnd(command) {
  const parts = [];
  let quote = '';
  let escaped = false;
  let start = 0;
  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\' && quote !== "'") { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (command.slice(i, i + 2) === '&&') {
      parts.push(command.slice(start, i).trim());
      i += 1;
      start = i + 1;
    }
  }
  parts.push(command.slice(start).trim());
  return parts.filter(Boolean);
}

function quotePowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function safeRepoPath(input, repoRoot) {
  if (!input || /[*?<>|\n\r]/.test(input)) return null;
  const root = path.resolve(repoRoot);
  const target = path.resolve(root, input.replaceAll('\\', path.sep));
  const relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  // Also reject Windows absolute paths like C:\secrets or C:/secrets when translating for Windows
  if (/^[A-Za-z]:[\\/]/.test(input)) return null;
  return relative;
}

function manual(original, hostOs, reason, hint = '', status = 'manual') {
  return {
    status, hostOs, original, proven: { os: 'linux', command: original },
    command: null, commands: [], text: reason, hint,
  };
}

function translateSegment(segment, hostOs, repoRoot) {
  if (/^(?:sudo\s+)?(?:apt-get|apt|systemctl|service)\b/i.test(segment)) {
    const packageName = segment.match(/(?:install|remove)\s+(?:-\S+\s+)*([A-Za-z0-9+_.-]+)/i)?.[1];
    const hint = hostOs === PLATFORM.darwin
      ? packageName ? (BREW_HINTS.get(packageName) || `Search Homebrew for an equivalent to ${packageName}.`) : 'Use Homebrew to find the macOS equivalent.'
      : 'Use WSL or Docker for this Linux service/package step, or follow the project’s Windows instructions.';
    return {
      manual: true,
      needsWsl: hostOs === PLATFORM.win32,
      reason: `This step needs Linux package or service management and has not been proven on ${hostOs}.`,
      hint,
    };
  }

  if (hostOs === PLATFORM.win32) {
    let match = segment.match(/^(?:source|\.)\s+([\w./-]+)\/bin\/activate\s*$/);
    if (match) return { command: `& ${quotePowerShell(`${match[1].replaceAll('/', '\\')}\\Scripts\\Activate.ps1`)}` };

    match = segment.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      if (/(?:TOKEN|SECRET|PASSWORD|URL|URI|DSN|AUTH|CREDENTIAL|(?:API|PRIVATE)[_-]?KEY)/i.test(match[1])) {
        return { manual: true, reason: 'This sensitive value must be entered through masked local environment setup.', hint: 'Use the local .env wizard; the value is never displayed in the guide or sent to Bob.' };
      }
      const value = match[2].replace(/^(?:(["'])(.*)\1)$/, '$2');
      return { command: `$env:${match[1]} = ${quotePowerShell(value)}` };
    }

    match = segment.match(/^which\s+([A-Za-z0-9_.-]+)\s*$/);
    if (match) return { command: `Get-Command ${quotePowerShell(match[1])}` };

    match = segment.match(/^cp\s+(-r\s+)?(.+?)\s+(.+)$/);
    if (match) return { command: `Copy-Item -LiteralPath ${quotePowerShell(match[2])} -Destination ${quotePowerShell(match[3])}${match[1] ? ' -Recurse' : ''}` };

    match = segment.match(/^rm\s+-rf?\s+(.+)$/);
    if (match) {
      const paths = match[1].split(/\s+/);
      const safe = paths.map((item) => safeRepoPath(item, repoRoot));
      if (safe.some((item) => !item)) {
        return { manual: true, reason: 'This removal could leave the repository or target its root; it needs a human to choose a safe path.', hint: 'Remove only the generated paths inside the project directory.' };
      }
      return { command: `Remove-Item -LiteralPath ${safe.map(quotePowerShell).join(', ')} -Recurse -Force` };
    }

    if (/^rm\b/i.test(segment)) return { manual: true, reason: 'This removal command uses flags that cannot be translated safely.', hint: 'Remove only the intended generated paths inside the project directory.' };
    if (/^cp\b/i.test(segment)) return { manual: true, reason: 'This copy command uses syntax that cannot be translated safely.', hint: 'Use Copy-Item in PowerShell after checking the source and destination.' };

    if (/^\s*python3(?=\s|$)/.test(segment)) return { command: segment.replace(/^(\s*)python3/, '$1py -3') };
    if (/\|\||[;|`]/.test(segment)) return { manual: true, reason: 'This shell expression cannot be translated safely to PowerShell.', hint: 'Run the steps manually in PowerShell, one at a time.' };
    return { command: segment };
  }

  if (hostOs === PLATFORM.darwin) {
    if (/\bsed\s+-i(?:\s|$)/.test(segment) && !/\bsed\s+-i\s+['"]{2}(?:\s|$)/.test(segment)) {
      return { command: segment.replace(/\bsed\s+-i(?=\s)/, "sed -i ''") };
    }
    return { command: segment };
  }

  return { command: segment };
}

/** Translate one Linux-proven guide step for a host. Translations are proposals; they are never proof. */
export function translate(step, hostOs, { repoRoot = process.cwd() } = {}) {
  const original = step?.do?.command ?? step?.command ?? '';
  if (!Object.values(PLATFORM).includes(hostOs)) {
    return manual(original, String(hostOs), 'Unknown host platform; no translation is available.', 'Follow the project instructions for your operating system.');
  }
  if (!original && step?.do?.type === 'secret') {
    return { status: 'proven', hostOs, original: '', proven: { os: 'linux', command: '' }, command: '', commands: [] };
  }
  if (hostOs === PLATFORM.linux) {
    return { status: 'proven', hostOs, original, proven: { os: 'linux', command: original }, command: original, commands: original ? [original] : [] };
  }

  const pieces = splitAnd(original);
  if (!pieces.length) return manual(original, hostOs, 'The proven step has no command to translate.');
  const translated = pieces.map((piece) => translateSegment(piece, hostOs, repoRoot));
  const manualPart = translated.find((item) => item.manual);
  if (manualPart) return manual(original, hostOs, manualPart.reason, manualPart.hint, manualPart.needsWsl ? 'needs-wsl' : 'manual');
  // Nothing needed translating (npm install, git clone, docker compose up): the same command runs here, so it is
  // not a platform gap. It was still proven on Linux, which the text says.
  if (pieces.length === 1 && translated[0].command === pieces[0]) {
    return { status: 'unchanged', hostOs, original, proven: { os: 'linux', command: original }, command: original, commands: [...pieces], text: `Same command on ${hostOs}; proven on Linux.` };
  }
  return {
    status: 'translated', hostOs, original, proven: { os: 'linux', command: original },
    command: translated.map((item) => item.command).join('\n'),
    commands: translated.map((item) => item.command),
    text: `Translated for ${hostOs}; this command has not been proven on your machine.`,
  };
}

/** Platform-specific manual card shape. The original proof and checker are retained, never a command. */
export function asManualGuideStep(step, translation) {
  return {
    id: step.id,
    title: step.title,
    kind: 'manual',
    text: translation.text,
    why: step.why?.cause || translation.hint || 'This Linux-only step needs your operating-system specific instructions.',
    checker: step.checker || step.check,
    platformStatus: translation.status,
  };
}

/** Build the host-specific guide payload consumed by onboarding surfaces. */
export function buildPlatformGuide(guide, hostOs, options = {}) {
  return {
    ...guide,
    steps: guide.steps.map((step) => {
      const translated = translate(step, hostOs, options);
      if (translated.status === 'manual' || translated.status === 'needs-wsl') return asManualGuideStep(step, translated);
      if (translated.status === 'translated') {
        return {
          ...step,
          platformStatus: 'translated',
          proven: translated.proven,
          do: step.do ? { ...step.do, command: translated.command } : { command: translated.command },
          translatedCommands: translated.commands,
        };
      }
      return { ...step, platformStatus: 'proven', proven: translated.proven };
    }),
  };
}

export function translationPlatforms() {
  return { ...PLATFORM };
}

/** Values for a local shell session only; callers must keep this object out of reports and logs. */
export function sessionEnvironment(step, hostOs, { repoRoot = process.cwd(), baseEnv = process.env } = {}) {
  if (hostOs !== PLATFORM.win32) return {};
  const result = {};
  const command = step?.do?.command ?? step?.command ?? '';
  for (const segment of splitAnd(command)) {
    const assignment = segment.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (assignment && !/(?:TOKEN|SECRET|PASSWORD|URL|URI|DSN|AUTH|CREDENTIAL|(?:API|PRIVATE)[_-]?KEY)/i.test(assignment[1])) {
      result[assignment[1]] = assignment[2].replace(/^(?:(["'])(.*)\1)$/, '$2');
      continue;
    }
    const activation = segment.match(/^(?:source|\.)\s+([\w./-]+)\/bin\/activate\s*$/);
    if (activation) {
      const virtualEnv = path.resolve(repoRoot, activation[1].replaceAll('/', path.sep));
      result.VIRTUAL_ENV = virtualEnv;
      result.PATH = `${path.join(virtualEnv, 'Scripts')};${result.PATH || baseEnv.PATH || ''}`;
    }
  }
  return result;
}
