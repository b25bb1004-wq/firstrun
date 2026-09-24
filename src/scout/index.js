import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { run, readText } from '../util.js';

const IGNORE_DIRS = new Set(['node_modules', '.git', '.firstrun', '.firstrun-work', 'venv', '.venv', 'env', 'dist', 'build', '.next', '__pycache__', '.tox', 'coverage', '.idea', '.vscode', 'vendor', 'target']);
const ENV_EXAMPLE_NAMES = ['.env.example', '.env.sample', '.env.template', '.env.dist', '.env.defaults', 'example.env', 'sample.env', '.env.local.example', '.env.development.example', 'env.example'];
const IGNORED_ENV = new Set(['NODE_ENV', 'CI', 'HOME', 'PATH', 'PWD', 'USER', 'SHELL', 'TERM', 'LANG', 'TZ', 'DEBUG', 'npm_package_version', 'npm_lifecycle_event', 'PYTHONPATH', 'VIRTUAL_ENV', 'HOSTNAME', 'TMPDIR', 'TEMP', 'JEST_WORKER_ID', 'VITEST', 'GITHUB_ACTIONS']);

/** Files a newcomer gets from `git clone` (tracked files), or a filtered walk for non-git dirs. */
export async function listFiles(root) {
  const r = await run('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  if (r.code === 0 && r.out.length) return r.out.split('\0').filter(Boolean).map((f) => f.replace(/\\/g, '/'));
  const out = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!IGNORE_DIRS.has(e.name)) walk(path.join(dir, e.name), rel ? `${rel}/${e.name}` : e.name); }
      else out.push(rel ? `${rel}/${e.name}` : e.name);
      if (out.length > 20000) return;
    }
  };
  walk(root, '');
  return out;
}

function parseEnvFile(text) {
  const keys = {};
  for (const line of (text || '').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) keys[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return keys;
}

function majorOf(v) {
  if (!v) return null;
  const m = String(v).match(/(\d+)(?:\.(\d+))?/);
  return m ? (m[2] !== undefined && Number(m[1]) < 4 ? `${m[1]}.${m[2]}` : m[1]) : null;
}

/** Minimum version satisfying a semver-ish range like ">=20", "^18.17", "20.x", ">=3.11,<4". */
export function minVersion(range) {
  if (!range) return null;
  const m = String(range).match(/(?:>=|\^|~|=)?\s*v?(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return Number(m[1]) < 4 && m[2] !== undefined ? `${m[1]}.${m[2]}` : m[1];
}

const CODE_EXT = /\.(m?[jt]sx?|cjs|py)$/;

export async function scout(root) {
  const files = await listFiles(root);
  const has = (f) => files.includes(f);
  const read = (f) => readText(path.join(root, f));
  const facts = { root, files, loadsDotenv: false, docs: [], node: null, python: null, compose: null, envExample: null, envVarsInCode: [], ci: { nodeVersions: [], pythonVersions: [], services: [], commands: [] }, ports: [], makeTargets: [] };

  // Docs a newcomer reads, in priority order.
  const readme = files.find((f) => /^readme(\.md|\.markdown|\.rst|\.txt)?$/i.test(f));
  if (readme) facts.docs.push(readme);
  for (const f of files) {
    if (f === readme) continue;
    if (/^(contributing|development|developing|setup|install|installation|getting[-_]started|hacking)\.md$/i.test(f)) facts.docs.push(f);
    else if (/^docs?\/(.*\/)?(setup|development|developing|getting[-_]started|install(ation)?|local[-_]dev(elopment)?|contributing|quick[-_]?start)\.md$/i.test(f)) facts.docs.push(f);
  }

  // Node
  if (has('package.json')) {
    let pkg = {};
    try { pkg = JSON.parse(read('package.json')); } catch { pkg = {}; }
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const nvmrc = has('.nvmrc') ? read('.nvmrc').trim() : null;
    const nodeVersionFile = has('.node-version') ? read('.node-version').trim() : null;
    const toolVersions = has('.tool-versions') ? (read('.tool-versions').match(/^nodejs\s+(\S+)/m) || [])[1] : null;
    const truthSources = [
      nvmrc && { version: majorOf(nvmrc.replace(/^v/, '')), source: '.nvmrc' },
      nodeVersionFile && { version: majorOf(nodeVersionFile.replace(/^v/, '')), source: '.node-version' },
      toolVersions && { version: majorOf(toolVersions), source: '.tool-versions' },
      pkg.volta?.node && { version: majorOf(pkg.volta.node), source: 'package.json volta' },
      pkg.engines?.node && { version: minVersion(pkg.engines.node), source: `package.json engines ("${pkg.engines.node}")` },
    ].filter((x) => x && x.version && !/lts/i.test(x.version));
    facts.node = {
      name: pkg.name,
      scripts: pkg.scripts || {},
      engines: pkg.engines || {},
      main: pkg.main,
      type: pkg.type,
      packageManager: pkg.packageManager?.split('@')[0] || (has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : has('bun.lockb') || has('bun.lock') ? 'bun' : 'npm'),
      lockfile: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock', 'npm-shrinkwrap.json'].find(has) || null,
      engineStrict: has('.npmrc') && /engine-strict\s*=\s*true/.test(read('.npmrc') || ''),
      deps: Object.keys(deps),
      workspaces: pkg.workspaces || null,
      truth: truthSources[0] || null,
      truthSources,
    };
  }

  // Python
  const pyproject = has('pyproject.toml') ? read('pyproject.toml') : null;
  const reqFiles = files.filter((f) => /(^|\/)requirements[^/]*\.(txt|in)$/i.test(f) || /^requirements\/.+\.txt$/i.test(f));
  if (pyproject || reqFiles.length || has('setup.py') || has('Pipfile') || has('manage.py')) {
    const pyVersionFile = has('.python-version') ? read('.python-version').trim() : null;
    const requires = pyproject ? (pyproject.match(/requires-python\s*=\s*["']([^"']+)["']/) || [])[1] : null;
    const poetryPy = pyproject ? (pyproject.match(/\[tool\.poetry\.dependencies\][\s\S]*?python\s*=\s*["']([^"']+)["']/) || [])[1] : null;
    const truthSources = [
      pyVersionFile && { version: majorOf(pyVersionFile), source: '.python-version' },
      requires && { version: minVersion(requires), source: `pyproject.toml requires-python ("${requires}")` },
      poetryPy && { version: minVersion(poetryPy), source: `pyproject.toml poetry python ("${poetryPy}")` },
    ].filter((x) => x && x.version);
    const reqText = reqFiles.map((f) => read(f) || '').join('\n') + (pyproject || '');
    facts.python = {
      requirementsFiles: reqFiles,
      pyproject: !!pyproject,
      manager: has('poetry.lock') || /\[tool\.poetry\]/.test(pyproject || '') ? 'poetry' : has('uv.lock') ? 'uv' : has('Pipfile') ? 'pipenv' : 'pip',
      django: has('manage.py'),
      deps: [...reqText.matchAll(/^\s*["']?([A-Za-z0-9_.-]+)(?:\[.*?\])?\s*(?:[<>=!~;"',]|$)/gm)].map((m) => m[1].toLowerCase()),
      apps: [],
      truth: truthSources[0] || null,
      truthSources,
    };
  }

  // docker compose
  const composeFile = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml', 'docker-compose.dev.yml'].find(has);
  if (composeFile) {
    try {
      const doc = YAML.parse(read(composeFile)) || {};
      const services = Object.entries(doc.services || {}).map(([name, s]) => ({
        name,
        image: s.image || null,
        build: !!s.build,
        ports: (s.ports || []).map((p) => String(typeof p === 'object' ? p.published ?? p.target : p)),
        environment: Array.isArray(s.environment)
          ? Object.fromEntries(s.environment.map((e) => String(e).split(/=(.*)/s).slice(0, 2)))
          : s.environment || {},
      }));
      facts.compose = { file: composeFile, services };
    } catch (e) {
      facts.compose = { file: composeFile, services: [], error: e.message };
    }
  }

  // env example
  const envEx = ENV_EXAMPLE_NAMES.find(has) || files.find((f) => /(^|\/)\.env\.[\w.-]*example$/i.test(f) && !f.includes('/'));
  if (envEx) facts.envExample = { file: envEx, keys: parseEnvFile(read(envEx)) };

  // env vars read in code, python app entrypoints, ports
  const vars = new Map();
  const codeFiles = files.filter((f) => CODE_EXT.test(f) && !/(^|\/)(test|tests|__tests__|spec|e2e|fixtures|migrations|scripts\/ci)\//i.test(f) && !/\.(test|spec)\.[jt]sx?$/.test(f) && !/(^|\/)test_[^/]*\.py$/.test(f)).slice(0, 1500);
  for (const f of codeFiles) {
    const text = read(f);
    if (!text || text.length > 400_000) continue;
    const re = /process\.env\.([A-Z][A-Z0-9_]+)|process\.env\[\s*['"]([A-Z][A-Z0-9_]+)['"]\s*\]|os\.environ\[\s*['"]([A-Z][A-Z0-9_]+)['"]\s*\]|os\.environ\.get\(\s*['"]([A-Z][A-Z0-9_]+)['"]|os\.getenv\(\s*['"]([A-Z][A-Z0-9_]+)['"]|import\.meta\.env\.([A-Z][A-Z0-9_]+)|env\(\s*['"]([A-Z][A-Z0-9_]+)['"]/g;
    for (const m of text.matchAll(re)) {
      const name = m.slice(1).find(Boolean);
      if (IGNORED_ENV.has(name) || name.startsWith('npm_')) continue;
      const line = text.slice(0, m.index).split('\n').length;
      // "required" if read without a fallback: process.env.X (no || / ??) or os.environ["X"]
      const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
      const required = /^os\.environ\[/.test(m[0]) || (/^process\.env/.test(m[0]) && !/^\s*(\|\||\?\?)/.test(after));
      if (!vars.has(name)) vars.set(name, { name, file: f, line, required });
      else if (required) vars.get(name).required = true;
    }
    // Helpers such as required('X'), requireEnv('X'), getEnv('X'), env.str('X')
    for (const m of text.matchAll(/\b(require[dD]?(?:Env(?:Var)?)?|mustGetEnv|getRequiredEnv|assertEnv|getEnv|env\.(?:str|num|bool|int|url|port|string|number))\(\s*['"]([A-Z][A-Z0-9_]{2,})['"]\s*(,)?/g)) {
      const name = m[2];
      if (IGNORED_ENV.has(name) || m[1] === 'require') continue;
      const required = /^(required|requireEnv|requireEnvVar|requiredEnv|mustGetEnv|getRequiredEnv|assertEnv)$/.test(m[1]) || (/^env\./.test(m[1]) && !m[3]);
      const line = text.slice(0, m.index).split('\n').length;
      if (!vars.has(name)) vars.set(name, { name, file: f, line, required });
      else if (required) vars.get(name).required = true;
    }
    // A variable named in a raise/throw message is required, whatever API reads it.
    for (const v of vars.values()) {
      if (!v.required && v.file === f && new RegExp(`(raise|throw)[^\\n]{0,160}\\b${v.name}\\b`).test(text)) v.required = true;
    }
    if (!facts.loadsDotenv && /require\(['"]dotenv|from ['"]dotenv|dotenv\/config|loadEnvFile|--env-file|load_dotenv|BaseSettings|environ\.Env\(|env_file\s*=|from environs/.test(text)) facts.loadsDotenv = true;
    if (facts.python && f.endsWith('.py')) {
      for (const m of text.matchAll(/^(\w+)\s*=\s*(FastAPI|Flask|Starlette|Quart)\(/gm)) {
        facts.python.apps.push({ module: f.replace(/\.py$/, '').replace(/\//g, '.').replace(/^src\./, ''), variable: m[1], framework: m[2].toLowerCase(), file: f });
      }
    }
    for (const m of text.matchAll(/\.listen\(\s*(\d{2,5})|port\s*[:=]\s*(?:[\w.]+\s*(?:\|\||\?\?|or)\s*)?(\d{4,5})\b/gi)) {
      const p = Number(m[1] || m[2]);
      if (p > 1000 && !facts.ports.includes(p)) facts.ports.push(p);
    }
  }
  facts.envVarsInCode = [...vars.values()];

  // CI workflows: the closest thing to a verified setup most repos have
  for (const f of files.filter((x) => /^\.github\/workflows\/.+\.ya?ml$/.test(x))) {
    let doc;
    try { doc = YAML.parse(read(f)); } catch { continue; }
    for (const job of Object.values(doc?.jobs || {})) {
      for (const [name, svc] of Object.entries(job?.services || {})) facts.ci.services.push({ name, image: svc?.image, workflow: f });
      const matrix = job?.strategy?.matrix || {};
      for (const step of job?.steps || []) {
        const w = step?.with || {};
        const resolve = (v) => {
          const mm = String(v ?? '').match(/\$\{\{\s*matrix\.([\w-]+)\s*\}\}/);
          return mm ? [].concat(matrix[mm[1]] || []) : v != null ? [v] : [];
        };
        if (/actions\/setup-node/.test(step?.uses || '')) resolve(w['node-version']).forEach((v) => facts.ci.nodeVersions.push({ version: majorOf(v), workflow: f }));
        if (/actions\/setup-python/.test(step?.uses || '')) resolve(w['python-version']).forEach((v) => facts.ci.pythonVersions.push({ version: majorOf(v), workflow: f }));
        if (step?.run) facts.ci.commands.push({ run: String(step.run).trim(), workflow: f });
      }
    }
  }
  if (facts.node && !facts.node.truth && facts.ci.nodeVersions[0]?.version) {
    const v = facts.ci.nodeVersions.map((x) => x.version).filter(Boolean).sort((a, b) => Number(b) - Number(a))[0];
    facts.node.truth = { version: v, source: `CI (${facts.ci.nodeVersions[0].workflow})` };
  }
  if (facts.python && !facts.python.truth && facts.ci.pythonVersions[0]?.version) {
    facts.python.truth = { version: facts.ci.pythonVersions[0].version, source: `CI (${facts.ci.pythonVersions[0].workflow})` };
  }

  if (has('Makefile')) facts.makeTargets = [...(read('Makefile') || '').matchAll(/^([A-Za-z][\w.-]*):(?!=)/gm)].map((m) => m[1]);

  if (facts.node && Object.values(facts.node.scripts).some((v) => /--env-file|dotenv/.test(v))) facts.loadsDotenv = true;
  if (facts.node?.deps.some((d) => /^(next|vite|nuxt|@nestjs\/config|dotenv|dotenv-flow|dotenv-cli|env-cmd)$/.test(d))) facts.loadsDotenv = true;
  if (facts.python?.deps.some((d) => /^(python-dotenv|pydantic-settings|django-environ|environs)$/.test(d))) facts.loadsDotenv = true;
  const envPort = Number(facts.envExample?.keys?.PORT);
  if (envPort) facts.ports.unshift(envPort);

  facts.stack = facts.node && facts.python
    ? (files.filter((f) => f.endsWith('.py')).length > files.filter((f) => /\.[jt]sx?$/.test(f)).length ? 'python' : 'node')
    : facts.node ? 'node' : facts.python ? 'python' : 'other';
  return facts;
}

export function summarizeFacts(f) {
  return {
    stack: f.stack,
    docs: f.docs,
    node: f.node && { truth: f.node.truth, packageManager: f.node.packageManager, scripts: Object.keys(f.node.scripts), engineStrict: f.node.engineStrict },
    python: f.python && { truth: f.python.truth, manager: f.python.manager, requirementsFiles: f.python.requirementsFiles, apps: f.python.apps },
    compose: f.compose && { file: f.compose.file, services: f.compose.services.map((s) => s.name) },
    envExample: f.envExample && { file: f.envExample.file, keys: Object.keys(f.envExample.keys) },
    envVarsInCode: f.envVarsInCode.map((v) => v.name),
    ciServices: f.ci.services.map((s) => s.name),
    ports: f.ports.slice(0, 5),
  };
}
