import { promises as fs } from 'node:fs';
import path from 'node:path';
import net from 'node:net';

function repoFile(cwd, file) {
  if (typeof file !== 'string' || !file || path.isAbsolute(file)) return null;
  const root = path.resolve(cwd);
  const target = path.resolve(root, file);
  const relative = path.relative(root, target);
  return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative) ? target : null;
}

function isLoopback(url) {
  try {
    const parsed = new URL(url);
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname) && ['http:', 'https:'].includes(parsed.protocol);
  } catch { return false; }
}

function checkPort(port, host = '127.0.0.1', timeoutMs = 1500) {
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !['127.0.0.1', 'localhost', '::1'].includes(host)) return Promise.resolve(false);
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (ok) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

/** Run only declarative, repo-local and loopback checks. Unsupported checks fail closed. */
export async function runManualChecker(checker, { cwd = process.cwd() } = {}) {
  if (!checker || typeof checker !== 'object') return { passed: false, message: 'No completion checker is defined.' };
  if (checker.type === 'env-complete') {
    if (!Array.isArray(checker.keys) || checker.keys.some((key) => typeof key !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))) {
      return { passed: false, message: 'The environment checker is invalid.' };
    }
    const filePath = repoFile(cwd, '.env');
    if (!filePath) return { passed: false, message: 'Environment file must stay inside the project.' };
    try {
      const stat = await fs.lstat(filePath);
      if (stat.isSymbolicLink() || !stat.isFile()) return { passed: false, message: 'Expected a regular local environment file.' };
      const values = new Map();
      const contents = await fs.readFile(filePath, 'utf8');
      for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
        if (match && !values.has(match[1])) values.set(match[1], match[2].trim().replace(/^(?:"(.*)"|'(.*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted));
      }
      const incomplete = checker.keys.some((key) => {
        const value = values.get(key) || '';
        return !value || /^(?:<[^>]+>|your[-_].*|changeme|change[-_.]me|replace[-_].*|example|sample)$/i.test(value);
      });
      return incomplete
        ? { passed: false, message: 'Fill all required environment values through the masked wizard.' }
        : { passed: true, message: 'All required environment fields are present.' };
    } catch {
      return { passed: false, message: 'The local environment file is not available yet.' };
    }
  }
  if (checker.type === 'file-has') {
    const filePath = repoFile(cwd, checker.file);
    if (!filePath) return { passed: false, message: 'Checker file must stay inside the project.' };
    try {
      const relative = path.relative(path.resolve(cwd), filePath);
      let cursor = path.resolve(cwd);
      const parts = relative.split(path.sep);
      for (const part of parts.slice(0, -1)) {
        cursor = path.join(cursor, part);
        const parent = await fs.lstat(cursor);
        if (parent.isSymbolicLink() || !parent.isDirectory()) return { passed: false, message: 'Checker path must stay inside the project.' };
      }
      const stat = await fs.lstat(filePath);
      if (stat.isSymbolicLink() || !stat.isFile()) return { passed: false, message: 'Expected a regular project file.' };
      const contents = await fs.readFile(filePath, 'utf8');
      let passed = checker.pattern == null;
      if (checker.pattern != null) {
        try { passed = new RegExp(checker.pattern, checker.flags || '').test(contents); }
        catch { return { passed: false, message: 'The project file checker is invalid.' }; }
      }
      return { passed, message: passed ? 'The project file check passed.' : 'The expected content is not present yet.' };
    } catch {
      return { passed: false, message: 'The expected project file is not available yet.' };
    }
  }
  if (checker.type === 'port') {
    const passed = await checkPort(Number(checker.port), checker.host || '127.0.0.1');
    return { passed, message: passed ? 'The local service is listening.' : 'The local service is not listening yet.' };
  }
  if (checker.type === 'http') {
    if (!isLoopback(checker.url)) return { passed: false, message: 'Only a localhost HTTP checker is allowed.' };
    try {
      const response = await fetch(checker.url, { signal: AbortSignal.timeout(3000) });
      const passed = response.status === Number(checker.expect || 200);
      return { passed, message: passed ? 'The local health check passed.' : 'The local health check did not pass yet.' };
    } catch {
      return { passed: false, message: 'The local health check is not responding yet.' };
    }
  }
  return { passed: false, message: 'This completion checker is not supported yet.' };
}
