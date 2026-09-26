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

  // reStructuredText setup docs (flask, httpie): listed apart until the planner parses .rst (src/markdown.js).
  const SETUP_NAME = /(contributing|development|developing|setup|install(ation)?|getting[-_]started|hacking|local[-_]dev(elopment)?|quick[-_]?start)/i;
  facts.docsRst = files.filter((f) => /\.rst$/i.test(f) && f !== readme && !/node_modules|test|fixture/i.test(f)
    && ((!f.includes('/') && SETUP_NAME.test(f)) || (/^docs?\//i.test(f) && SETUP_NAME.test(f.split('/').pop())))).slice(0, 5);

  // Onboarding material that isn't Markdown (PDF handbooks, reStructuredText, wiki exports):
  // the rule-based planner can't read these; IBM Bob's document understanding can.
  facts.extraDocs = files.filter((f) => /\.(pdf|rst|adoc|docx|txt)$/i.test(f) && /(onboard|setup|install|getting[-_]?started|develop|contribut|readme|handbook|guide|wiki)/i.test(f) && !/node_modules|test|fixture/i.test(f)).slice(0, 10);

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
  const composeFile = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml', 'docker-compose.dev.yml'].find(has)
    || files.find((f) => /(^|\/)(docker-)?compose(\.[^/]*)?\.ya?ml$/i.test(f) && !/node_modules|test|fixture|(^|\/)(examples?|demos?|samples?|playground)\//i.test(f));
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
        volumes: (s.volumes || []).map((v) => typeof v === 'object' ? `${v.source || ''}:${v.target || ''}` : String(v)),
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
  // examples/, demos/, samples/ are separate projects that show how to USE this one: their env vars and ports are
  // not this repo's (HUMBLE's own README: "done when" became Redis :6379 from examples/acme-shop).
  const codeFiles = files.filter((f) => CODE_EXT.test(f) && !/(^|\/)(test|tests|__tests__|spec|e2e|fixtures|migrations|scripts\/ci|examples?|demos?|samples?|playground)\//i.test(f) && !/\.(test|spec)\.[jt]sx?$/.test(f) && !/(^|\/)test_[^/]*\.py$/.test(f)).slice(0, 1500);
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
    const text = read(f) || '';
    try { doc = YAML.parse(text); } catch { continue; }
    const lines = text.split('\n');
    let cursor = 0; // steps appear in file order, so each `run:` is found after the previous one
    const lineOf = (run) => {
      const first = String(run).trim().split('\n')[0].trim();
      for (let i = cursor; i < lines.length; i++) if (lines[i].includes(first)) { cursor = i + 1; return i + 1; }
      return 0;
    };
    for (const [jobId, job] of Object.entries(doc?.jobs || {})) {
      for (const [name, svc] of Object.entries(job?.services || {})) facts.ci.services.push({ name, image: svc?.image, workflow: f });
      const matrix = job?.strategy?.matrix || {};
      const resolve = (v) => {
        const mm = String(v ?? '').match(/\$\{\{\s*matrix\.([\w-]+)\s*\}\}/);
        return mm ? [].concat(matrix[mm[1]] || []) : v != null ? [v] : [];
      };
      // Which machines the job runs on: `runs-on: ubuntu-latest`, or a matrix of them. Unknown counts as Linux.
      const os = [].concat(resolve(job?.['runs-on'])).flat().map(String);
      const linux = !os.length || os.some((o) => /ubuntu|linux|\$\{\{/i.test(o));
      for (const step of job?.steps || []) {
        const w = step?.with || {};
        if (/actions\/setup-node/.test(step?.uses || '')) resolve(w['node-version']).forEach((v) => facts.ci.nodeVersions.push({ version: majorOf(v), workflow: f }));
        if (/actions\/setup-python/.test(step?.uses || '')) resolve(w['python-version']).forEach((v) => facts.ci.pythonVersions.push({ version: majorOf(v), workflow: f }));
        // A step guarded to one OS (`if: runner.os == 'Windows'`) is not on the Linux path.
        const onlyOther = /runner\.os\s*==\s*['"](windows|macos)['"]|matrix\.os\s*==\s*['"](windows|macos)/i.test(String(step?.if || ''));
        if (step?.run) facts.ci.commands.push({ run: String(step.run).trim(), workflow: f, line: lineOf(step.run), job: jobId, os, linux: linux && !onlyOther });
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
  // Install/setup targets with their recipe lines (httpie: `make install`), for docs that only say "run make install".
  facts.makeInstall = has('Makefile') ? makeInstallTargets(read('Makefile') || '') : [];

  if (facts.node && Object.values(facts.node.scripts).some((v) => /--env-file|dotenv/.test(v))) facts.loadsDotenv = true;
  if (facts.node?.deps.some((d) => /^(next|vite|nuxt|@nestjs\/config|dotenv|dotenv-flow|dotenv-cli|env-cmd)$/.test(d))) facts.loadsDotenv = true;
  if (facts.python?.deps.some((d) => /^(python-dotenv|pydantic-settings|django-environ|environs)$/.test(d))) facts.loadsDotenv = true;
  const envPort = Number(facts.envExample?.keys?.PORT);
  if (envPort) facts.ports.unshift(envPort);

  // No manifest at the root, but exactly one project folder below it (backend/app/pyproject.toml):
  // take the runtime and dependency facts from there, so the clean machine gets the right runtime.
  if (!facts.node && !facts.python) {
    const MANIFEST = /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|setup\.py|Pipfile|manage\.py)$/;
    const dirs = [...new Set(files
      .filter((f) => MANIFEST.test(f) && !/(^|\/)(node_modules|tests?|docs?|examples?|fixtures?|static|vendor|\.[^/]+)\//.test(f))
      .map((f) => f.slice(0, f.lastIndexOf('/')))
      .filter((d) => d && d.split('/').length <= 3))];
    if (dirs.length === 1) {
      const dir = dirs[0];
      const sub = await scout(path.join(root, dir));
      facts.projectDir = dir;
      facts.node = sub.node;
      facts.python = sub.python && { ...sub.python, requirementsFiles: sub.python.requirementsFiles.map((f) => `${dir}/${f}`) };
      if (!facts.envExample && sub.envExample) facts.envExample = { ...sub.envExample, file: `${dir}/${sub.envExample.file}` };
      for (const p of sub.ports) if (!facts.ports.includes(p)) facts.ports.push(p);
      const seen = new Set(facts.envVarsInCode.map((v) => v.name));
      facts.envVarsInCode.push(...sub.envVarsInCode.filter((v) => !seen.has(v.name)).map((v) => ({ ...v, file: v.file && `${dir}/${v.file}` })));
    }
  }

  facts.stack = facts.node && facts.python
    ? (files.filter((f) => f.endsWith('.py')).length > files.filter((f) => /\.[jt]sx?$/.test(f)).length ? 'python' : 'node')
    : facts.node ? 'node' : facts.python ? 'python' : 'other';
  facts.cli = cliNames(facts, read, has);
  // Files package.json `bin` points at: `node bin/tool.js <cmd>` runs this repo's CLI, it doesn't start a server.
  facts.binPaths = (() => {
    try {
      const pkg = JSON.parse(read('package.json') || '{}');
      return (typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin || {})).map((x) => String(x).replace(/^\.\//, ''));
    } catch { return []; }
  })();
  return facts;
}

/** Commands the project itself installs (package.json "bin", Python console scripts). */
function cliNames(facts, read, has) {
  const names = new Set();
  if (has('package.json')) {
    try {
      const pkg = JSON.parse(read('package.json'));
      if (typeof pkg.bin === 'string' && pkg.name) names.add(pkg.name.split('/').pop());
      else if (pkg.bin && typeof pkg.bin === 'object') Object.keys(pkg.bin).forEach((k) => names.add(k));
    } catch {}
  }
  // [project.scripts] / [tool.poetry.scripts]: every "name = ..." line until the next table.
  const pyproject = has('pyproject.toml') ? read('pyproject.toml') || '' : '';
  let inScripts = false;
  for (const line of pyproject.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) { inScripts = /^\s*\[(project\.scripts|tool\.poetry\.scripts)\]\s*$/.test(line); continue; }
    const k = inScripts && line.match(/^\s*["']?([\w.-]+)["']?\s*=/);
    if (k) names.add(k[1]);
  }
  // setup.py / setup.cfg console_scripts: "name = package.module:function"
  const setup = (has('setup.py') ? read('setup.py') || '' : '') + (has('setup.cfg') ? read('setup.cfg') || '' : '');
  const cs = setup.match(/console_scripts[\s\S]{0,400}/);
  if (cs) for (const k of cs[0].matchAll(/([\w.-]+)\s*=\s*[\w.]+:\w+/g)) names.add(k[1]);
  return [...names].filter((n) => n.length > 1);
}

/** Makefile targets a newcomer runs to set up (install, setup, dev, bootstrap, deps, venv …), with their recipe commands. */
export function makeInstallTargets(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z][\w.-]*)\s*:(?!=)/);
    if (!m || !/^(install|setup|dev|develop|bootstrap|init|deps|dependencies|venv|env)([-_.][\w.-]*)?$/i.test(m[1])) continue;
    const commands = [];
    for (let j = i + 1; j < lines.length && /^\t/.test(lines[j]); j++) {
      const c = lines[j].replace(/^\t[@-]*/, '').trim();
      if (c && !c.startsWith('#')) commands.push(c);
    }
    out.push({ target: m[1], commands });
  }
  return out;
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
