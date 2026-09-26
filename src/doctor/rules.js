import fs from 'node:fs';
import path from 'node:path';
import { closest, shq } from '../util.js';
import { imageFor } from '../plan.js';
import { PORT_TO_SERVICE, serviceFor, dockerRunLine, serviceKind } from './services.js';

/**
 * Deterministic diagnosis rules. Each rule looks at a failed step's output and
 * returns { ruleId, class, cause, confidence, fix } or null. A fix has sandbox
 * `actions` (to repair this run), repo `patches` (files HUMBLE will change in
 * the PR) and a `doc` change (what the README must say instead).
 *
 * Rules only claim failures they understand; everything else goes to IBM Bob.
 */

const npmRun = (facts, script) => {
  const pm = facts.node?.packageManager || 'npm';
  if (pm === 'yarn') return `yarn ${script}`;
  if (pm === 'pnpm') return `pnpm ${script}`;
  if (pm === 'bun') return `bun run ${script}`;
  return script === 'test' || script === 'start' ? `npm ${script}` : `npm run ${script}`;
};

const installCmd = (facts) => {
  const pm = facts.node?.packageManager || 'npm';
  if (pm === 'yarn') return 'yarn install';
  if (pm === 'pnpm') return 'pnpm install';
  if (pm === 'bun') return 'bun install';
  return facts.node?.lockfile === 'package-lock.json' ? 'npm install' : 'npm install';
};

/** -1, 0 or 1, comparing dotted versions numerically ("3.12" > "3.11", "20" > "16"). */
export function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/** "The README's Python 3.12 is too new: …", or, when the docs name no version, say so instead of blaming the README. */
function runtimeCause(plan, label, target, src) {
  const cur = plan.runtime.version;
  const fromDocs = !/docs do not say|current LTS|default/i.test(plan.runtime.source || '');
  const who = fromDocs ? `The README's ${label} ${cur}` : `${label} ${cur} (the docs name no version, so a newcomer installs the current release)`;
  return `${who} is too ${cmpVersion(cur, target) > 0 ? 'new' : 'old'}: the project needs ${label} ${target} (${src}).`;
}

/** Values a template ships instead of a real one: YourConnectionString, <db-url>, [host], changeme, xxx. */
/** Third-party services whose keys HUMBLE can't create. It tries a well-formed fake first (many apps only check
 * that the key exists, or its prefix, at startup) and asks a human only if the provider rejects it. */
const PROVIDER = /^(STRIPE|OPENAI|ANTHROPIC|AWS|GCP|GOOGLE|AZURE|GITHUB|SENDGRID|TWILIO|MAILGUN|SLACK|DISCORD|SENTRY|CLOUDINARY|FIREBASE|SUPABASE|AUTH0|CLERK|RESEND|POSTMARK|PUSHER|ALGOLIA|MAPBOX|HUGGING|HF_|COHERE|GROQ|REPLICATE|PLAID|PAYPAL|RAZORPAY|TWITTER|FACEBOOK|LINKEDIN)/;
export const FAKE_MARK = 'humble_placeholder';
/** A fake in the shape the provider's SDK expects, and obviously not a real key (no secret scanner matches it). */
export function fakeFor(name) {
  const n = name.toUpperCase();
  if (/^STRIPE.*(PUBLISHABLE|_PK$|PUBLIC)/.test(n)) return `pk_test_${FAKE_MARK}`;
  if (/^STRIPE.*WEBHOOK/.test(n)) return `whsec_${FAKE_MARK}`;
  if (/^STRIPE/.test(n)) return `sk_test_${FAKE_MARK}`;
  if (/(CLIENT_?ID|APP_?ID|_ID)$/.test(n)) return `${FAKE_MARK}_client_id`;
  return `${FAKE_MARK}_not_a_real_key`;
}
/** Human-readable provider for a variable name ("STRIPE_SECRET_KEY" → "Stripe"). */
export function providerOf(name) {
  const m = name.toUpperCase().match(PROVIDER);
  const p = m ? m[1].replace(/_$/, '') : name;
  return { HF: 'Hugging Face', HUGGING: 'Hugging Face', OPENAI: 'OpenAI', AWS: 'AWS', GCP: 'Google Cloud', GITHUB: 'GitHub', AUTH0: 'Auth0' }[p] || p.charAt(0) + p.slice(1).toLowerCase();
}

/** Value for dev secrets HUMBLE has to invent (JWT secrets, local DB passwords). Plainly not a credential. */
export const DEV_SECRET = 'change.me.local.dev.only.not.a.secret';

const PLACEHOLDER = /^(?:your[\w.-]*|<[^>]*>|\[[^\]]*\]|\{\{?[^}]*\}?\}|change[-_ ]?me|xxx+|todo|replace[-_ ]?me|placeholder)$/i;

/** The package that provides a CLI a script calls, when it isn't the CLI's own name. */
const BIN_PACKAGE = { tsc: ['typescript'], nest: ['@nestjs/cli'], 'svelte-kit': ['@sveltejs/kit'], remix: ['@remix-run/dev'], playwright: ['playwright', '@playwright/test'] };

/**
 * Local connection URLs hard-coded as defaults in config source (`core/config.py`:
 * WRITER_DB_URL = "mysql+aiomysql://fastapi:fastapi@localhost:3306/fastapi"), so a sidecar
 * gets the credentials the app will actually use. Config-like files only, capped.
 */
function sourceUrls(facts) {
  const out = {};
  const files = (facts.files || [])
    .filter((f) => /\.(py|[cm]?[jt]s|ya?ml|toml|ini|json)$/.test(f) && /(^|\/)(config|settings|database|db|env)[\w.-]*$|(^|\/)(config|settings)\//i.test(f) && !/node_modules|test/i.test(f))
    .slice(0, 25);
  for (const f of files) {
    let text = '';
    try { text = fs.readFileSync(path.join(facts.root, f), 'utf8').slice(0, 200_000); } catch { continue; }
    for (const m of text.matchAll(/\b((?:postgres(?:ql)?|mysql|mariadb|mongodb|redis)(?:\+\w+)?:\/\/[^\s'"`@/]+@(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/[\w.-]*)?)/g)) {
      const key = `SOURCE_DB_URL_${Object.keys(out).length + 1}`; // matches serviceFor's DB_URL lookup
      if (!Object.values(out).includes(m[1])) out[key] = m[1];
    }
  }
  return out;
}

/** Defaults the app itself declares in its validator: `ACCESS_TOKEN_EXPIRE: Joi.string().required().default('20m')`. */
function joiDefaults(facts) {
  const out = {};
  const files = (facts.files || []).filter((f) => /\.(ts|js|mjs|cjs)$/.test(f) && /config|env|settings/i.test(f) && !/node_modules|test|\.d\.ts$/.test(f)).slice(0, 20);
  for (const f of files) {
    let text = '';
    try { text = fs.readFileSync(path.join(facts.root, facts.projectDir || '', f), 'utf8'); } catch {
      try { text = fs.readFileSync(path.join(facts.root, f), 'utf8'); } catch { continue; }
    }
    for (const m of text.matchAll(/\b([A-Z][A-Z0-9_]+)\s*:\s*Joi\.[^\n]*?\.default\(\s*(['"`])([^'"`]*)\2\s*\)/g)) out[m[1]] = m[3];
    for (const m of text.matchAll(/\b([A-Z][A-Z0-9_]+)\s*:\s*Joi\.[^\n]*?\.default\(\s*(\d+)\s*\)/g)) out[m[1]] ??= m[2];
  }
  return out;
}

function prismaSchema(facts) {
  const f = (facts.files || []).find((x) => /(^|\/)schema\.prisma$/.test(x));
  try { return f ? fs.readFileSync(path.join(facts.root, f), 'utf8') : ''; } catch { return ''; }
}

function depRange(facts, name) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(facts.root, facts.projectDir || '', 'package.json'), 'utf8'));
    return pkg.dependencies?.[name] || pkg.devDependencies?.[name] || pkg.optionalDependencies?.[name] || null;
  } catch { return null; }
}

function devValue(name, { facts, sandboxEnv }) {
  const n = name.toUpperCase();
  const pgUrl = sandboxEnv.DATABASE_URL || facts.envExample?.keys?.DATABASE_URL;
  if (/^(DATABASE_URL|DB_URL|POSTGRES_URL)$/.test(n)) return { value: pgUrl || 'postgres://postgres:postgres@localhost:5432/postgres', kind: 'local' };
  if (/REDIS_(URL|URI)/.test(n)) return { value: 'redis://localhost:6379', kind: 'local' };
  if (/MONGO(DB)?_(URL|URI)/.test(n)) return { value: 'mongodb://localhost:27017/app', kind: 'local' };
  // Mail goes to a local catcher (Mailpit, see services.js), never to a real SMTP server.
  if (/^(\w+_)?(SMTP|MAIL|EMAIL)_(HOST|SERVER)$/.test(n)) return { value: 'localhost', kind: 'local' };
  if (/^(\w+_)?(SMTP|MAIL|EMAIL)_PORT$/.test(n)) return { value: '1025', kind: 'local' };
  if (/^(\w+_)?(SMTP|MAIL|EMAIL)_(USER|USERNAME|LOGIN)$/.test(n)) return { value: 'dev', kind: 'local' };
  if (/^(\w+_)?(SMTP|MAIL|EMAIL)_SECURE$/.test(n)) return { value: 'false', kind: 'local' };
  if (/^(EMAIL|MAIL|SMTP)_(FROM|SENDER)$|^(FROM|SENDER)_(EMAIL|ADDRESS)$/.test(n)) return { value: 'dev@example.com', kind: 'local' };
  if (/^PORT$/.test(n)) return { value: String(facts.ports[0] || 3000), kind: 'local' };
  if (/^(HOST|HOSTNAME|BIND)$/.test(n)) return { value: '0.0.0.0', kind: 'local' };
  if (/(^|_)(URL|URI|ORIGIN|ENDPOINT)$/.test(n)) return { value: 'http://localhost:3000', kind: 'local' };
  if (PROVIDER.test(n)) return { value: fakeFor(n), kind: 'fake' };
  // One obvious, non-secret value, the same in the sandbox and in the PR's .env.example: a random-looking
  // string there would read as a leaked credential (and trip secret scanners). Long enough for min-length checks.
  if (/(SECRET|KEY|TOKEN|SALT|PASSWORD|PASS|PEPPER|SIGNING)/.test(n)) return { value: DEV_SECRET, kind: 'generated' };
  if (/(ENABLED|DEBUG|VERBOSE)$/.test(n)) return { value: 'false', kind: 'local' };
  return { value: 'changeme', kind: 'unknown' };
}

const ENV_PATTERNS = [
  /missing (?:required )?(?:environment|env)(?:ironment)? variables?[:\s]+[`'"]?([A-Z][A-Z0-9_]{2,})/i,
  /(?:environment|env) variable[s]? [`'"]?([A-Z][A-Z0-9_]{2,})[`'"]? (?:is |was )?(?:not set|not defined|missing|required|undefined|must be (?:set|defined|provided))/i,
  /\b([A-Z][A-Z0-9_]{2,})\b (?:is not set|is not defined|is required|must be set|must be defined|must be provided|is undefined|environment variable (?:is )?(?:not set|missing|required))/,
  /(?:set|define|provide) (?:the )?[`'"]?([A-Z][A-Z0-9_]{2,})[`'"]? (?:environment|env) variable/i,
  /KeyError: ['"]([A-Z][A-Z0-9_]{2,})['"]/,
  /"path":\s*\[\s*"([A-Z][A-Z0-9_]{2,})"\s*\][\s\S]{0,80}"message":\s*"Required"/,
  /✖?\s*([A-Z][A-Z0-9_]{2,}):\s*(?:Required|Invalid input: expected string, received undefined)/,
  /([A-Z][A-Z0-9_]{2,})\s*\n\s*Field required \[type=missing/,
  /Environment variable not found: ([A-Z][A-Z0-9_]{2,})\./,
];

export const RULES = [
  // ── runtime version ────────────────────────────────────────────────
  {
    id: 'node-engine',
    test({ log, facts, plan }) {
      if (plan.runtime.name !== 'node' || !facts.node) return null;
      const m = log.match(/EBADENGINE|Unsupported engine|engine "node" is incompatible|The engine "node" is incompatible|requires? (?:a )?Node(?:\.js)? (?:version )?(?:>=?\s*)?v?(\d+)|node: bad option: --(?:watch|env-file|experimental-strip-types)|process\.loadEnvFile is not a function|structuredClone is not defined|(?:fetch|File|Blob|ReadableStream) is not defined|SyntaxError: Unexpected token '(?:\?\?=|\?\.|\|\|=|&&=|\?\?)'|ERR_REQUIRE_ESM|ERR_UNKNOWN_FILE_EXTENSION|Cannot find module 'node:(?:test|fs\/promises|stream\/web)'|toSorted is not a function|findLast is not a function|Object\.hasOwn is not a function|error: unknown option '--env-file'|Wanted: \{"node":"([^"]+)"\}/);
      if (!m) return null;
      const wanted = m[2] ? (m[2].match(/(\d+)/) || [])[1] : m[1];
      const target = facts.node.truth?.version || wanted || '22';
      const current = plan.runtime.version;
      if (String(target) === String(current)) return null;
      const src = facts.node.truth?.source || `the error ("${m[0]}")`;
      return {
        ruleId: 'node-engine', class: 'runtime-version', confidence: 0.95,
        cause: runtimeCause(plan, 'Node.js', target, src),
        fix: {
          actions: [{ type: 'rebase', image: imageFor('node', target), runtime: { name: 'node', version: String(target), source: src } }],
          patches: [],
          doc: { kind: 'prerequisite', text: `Node.js ${target} (see ${facts.node.truth?.source || 'package.json engines'})`, runtime: { name: 'node', version: String(target) } },
        },
      };
    },
  },
  {
    // Native add-ons (node-sass, old bcrypt, sqlite3 …) that have no prebuilt binary for a newer
    // Node and fail to compile. The project's era tells us which Node it was written for.
    id: 'node-native-build',
    test({ log, facts, plan }) {
      if (plan.runtime.name !== 'node' || !facts.node) return null;
      // Compiler output can push the gyp lines out of the log tail, so the headers being compiled count too.
      if (!/gyp ERR!|node-pre-gyp ERR!|prebuild-install warn install No prebuilt binaries|Node Sass does not yet support your current environment|binding\.gyp|make: \*\*\* \[.*\.o\] Error|error: no member named .* in namespace 'v8'|NODE_MODULE_VERSION \d+\. This version of Node\.js requires|node-gyp\/\d+\.\d+\.\d+\/include\/node\/|node_modules\/nan\/nan\.h|node-pre-gyp install --fallback-to-build/.test(log)) return null;
      const current = Number(plan.runtime.version);
      // bcrypt's own compatibility table: Node.js 18+ needs bcrypt >= 6; 3.0.6–5.x support Node.js 12–16.
      const bcrypt = facts.node.deps.includes('bcrypt') && /bcrypt/.test(log) ? depRange(facts, 'bcrypt') : null;
      const bcryptMajor = bcrypt ? Number((bcrypt.match(/(\d+)/) || [])[1]) : null;
      if (bcryptMajor && bcryptMajor < 6 && current >= 18) {
        const why = `bcrypt ${bcrypt} in package.json supports Node.js 12–16 only (bcrypt's compatibility table); Node.js 18+ needs bcrypt >= 6`;
        return {
          ruleId: 'node-native-build', class: 'runtime-version', confidence: 0.85,
          cause: `bcrypt ${bcrypt} does not build on Node.js ${current}: ${why}. Node.js 16 is end-of-life, so upgrading bcrypt is the lasting fix.`,
          fix: {
            actions: [{ type: 'rebase', image: imageFor('node', '16'), runtime: { name: 'node', version: '16', source: why } }],
            patches: [],
            doc: { kind: 'prerequisite', text: `Node.js 16 (see bcrypt's compatibility table: bcrypt ${bcrypt} supports Node.js 12–16; upgrading to bcrypt >= 6 lets you use a current Node.js)`, runtime: { name: 'node', version: '16' } },
          },
        };
      }
      if (bcryptMajor && bcryptMajor < 6) {
        return {
          ruleId: 'node-native-build', class: 'runtime-version', confidence: 0.8,
          cause: `bcrypt ${bcrypt} does not build on Node.js ${current} either. It needs a code change (bcrypt >= 6, or bcryptjs), which HUMBLE leaves to a human.`,
          fix: null,
        };
      }
      let target = facts.node.truth?.version ? Number(facts.node.truth.version) : null;
      let why = facts.node.truth?.source;
      if (!target || target >= current) {
        // No usable pin: step back through LTS lines the project could have been written for.
        const ladder = [20, 18, 16, 14].filter((v) => v < current);
        target = ladder[0];
        why = 'native modules fail to build on Node.js ' + current + ' and the repo pins no version';
      }
      if (!target) return null;
      return {
        ruleId: 'node-native-build', class: 'runtime-version', confidence: facts.node.truth ? 0.85 : 0.6,
        cause: `A native dependency does not build on Node.js ${current}; the project needs an older Node.js (${why}).`,
        fix: {
          actions: [{ type: 'rebase', image: imageFor('node', String(target)), runtime: { name: 'node', version: String(target), source: why } }],
          patches: [],
          doc: { kind: 'prerequisite', text: `Node.js ${target} (see the native-build errors: dependencies do not compile on newer versions)`, runtime: { name: 'node', version: String(target) } },
        },
      };
    },
  },
  {
    // "node: bad option: --test" (Node < 18) or unknown --experimental-* flags.
    // The plan picked an old image because the docs only stated a minimum version.
    id: 'node-test-flag',
    test({ log, facts, plan }) {
      if (plan.runtime.name !== 'node' || !facts.node) return null;
      if (!/node: bad option: --test|node: bad option: --experimental-/.test(log)) return null;
      const target = '18';
      const current = plan.runtime.version;
      if (Number(current) >= Number(target)) return null;
      const src = `the error ("${log.match(/node: bad option: --\S+/)?.[0]}"): \`--test\` requires Node.js 18+`;
      return {
        ruleId: 'node-test-flag', class: 'runtime-version', confidence: 0.95,
        cause: runtimeCause(plan, 'Node.js', target, src),
        fix: {
          actions: [{ type: 'rebase', image: imageFor('node', target), runtime: { name: 'node', version: target, source: src } }],
          patches: [],
          doc: { kind: 'prerequisite', text: `Node.js ${target} or newer (\`--test\` runner requires Node.js 18+)`, runtime: { name: 'node', version: target } },
        },
      };
    },
  },
  {
    id: 'python-version',
    test({ log, facts, plan }) {
      if (plan.runtime.name !== 'python' || !facts.python) return null;
      const m = log.match(/requires a different Python|Requires-Python|is not supported by the project|Current Python version \([\d.]+\) is not allowed by the project|python_requires|ERROR: Package '[^']+' requires a different Python|No module named '(?:tomllib|zoneinfo|graphlib)'|TypeError: unsupported operand type\(s\) for \|: 'type'|SyntaxError: (?:invalid syntax|expected ':')[\s\S]{0,200}(?:match |case |:=|\|)|cannot import name '(?:Self|TypeAlias|override|StrEnum|ExceptionGroup|UTC)'|is not a supported wheel on this platform|Could not find a version that satisfies the requirement[\s\S]{0,300}Requires-Python/);
      if (!m) return null;
      let target = facts.python.truth?.version || '3.12';
      const src = facts.python.truth?.source || 'the error';
      // An exact pin (poetry `python = "3.11.7"`) rejects python:3.11 (3.11.16): use the exact patch image.
      const exact = (src.match(/\("(\d+\.\d+\.\d+)"\)/) || log.match(/is not supported by the project \((\d+\.\d+\.\d+)\)/) || [])[1];
      if (exact && exact.startsWith(`${target}.`)) target = exact;
      if (target === plan.runtime.version) return null;
      return {
        ruleId: 'python-version', class: 'runtime-version', confidence: 0.9,
        cause: runtimeCause(plan, 'Python', target, src),
        fix: {
          actions: [{ type: 'rebase', image: imageFor('python', target), runtime: { name: 'python', version: target, source: src } }],
          patches: [],
          doc: { kind: 'prerequisite', text: `Python ${target} (see ${src})`, runtime: { name: 'python', version: target } },
        },
      };
    },
  },
  // ── renamed / missing scripts and files ─────────────────────────────
  {
    id: 'missing-npm-script',
    test({ log, step, facts }) {
      const m = log.match(/Missing script: "?([\w:.-]+)"?|Command "([\w:.-]+)" not found|ERR_PNPM_NO_SCRIPT[^\n]*?"?([\w:.-]+)"?|None of the selected packages has a "([\w:.-]+)" script|error Command "([\w:.-]+)" not found/);
      if (!m || !facts.node) return null;
      const wanted = m.slice(1).find(Boolean);
      const scripts = Object.keys(facts.node.scripts);
      const best = closest(wanted, scripts);
      if (!best) return null;
      const cmd = step.command.replace(new RegExp(`\\b${wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), best.value);
      const newCmd = cmd === step.command ? npmRun(facts, best.value) : cmd;
      return {
        ruleId: 'missing-npm-script', class: 'missing-script', confidence: best.contains ? 0.93 : 0.75,
        cause: `The script "${wanted}" no longer exists; package.json has "${best.value}" (${facts.node.scripts[best.value]}).`,
        fix: { actions: [{ type: 'replace-step', command: newCmd }], patches: [], doc: { kind: 'replace-command', text: newCmd } },
      };
    },
  },
  {
    id: 'missing-copy-source',
    test({ log, step, facts }) {
      const m = step.command.match(/^(cp|mv)\s+(?:-\w+\s+)*(\S+)\s+(\S+)/);
      if (!m || !/No such file|cannot stat|cannot find/i.test(log)) return null;
      const src = m[2].replace(/^\.\//, '');
      const dir = src.includes('/') ? src.slice(0, src.lastIndexOf('/') + 1) : '';
      const candidates = facts.files.filter((f) => f.startsWith(dir) && !f.slice(dir.length).includes('/'));
      const envish = /env/i.test(src) ? candidates.filter((f) => /env/i.test(f)) : candidates;
      const best = closest(src, envish.length ? envish : candidates);
      if (!best) return null;
      const newCmd = step.command.replace(m[2], best.value);
      return {
        ruleId: 'missing-copy-source', class: 'missing-file', confidence: 0.92,
        cause: `${src} does not exist; the repo ships ${best.value}.`,
        fix: { actions: [{ type: 'replace-step', command: newCmd }], patches: [], doc: { kind: 'replace-command', text: newCmd } },
      };
    },
  },
  {
    id: 'missing-requirements-file',
    test({ log, step, facts }) {
      const m = step.command.match(/-r\s+(\S+)/);
      if (!m || !/Could not open requirements file|No such file or directory/i.test(log) || !facts.python) return null;
      const wanted = m[1].replace(/^\.\//, '');
      const best = closest(wanted, facts.python.requirementsFiles) || closest(wanted.replace(/\//g, '-'), facts.python.requirementsFiles);
      if (!best) return null;
      const newCmd = step.command.replace(m[1], best.value);
      return {
        ruleId: 'missing-requirements-file', class: 'missing-file', confidence: 0.9,
        cause: `${wanted} does not exist; the repo has ${best.value}.`,
        fix: { actions: [{ type: 'replace-step', command: newCmd }], patches: [], doc: { kind: 'replace-command', text: newCmd } },
      };
    },
  },
  {
    id: 'moved-entrypoint',
    test({ log, step, facts, plan }) {
      const py = step.command.match(/^python3?\s+(\S+\.py)\b/);
      const pyMissing = py && /can't open file|No such file or directory/.test(log);
      const node = step.command.match(/^node\s+(\S+\.(?:m?js|cjs))\b/);
      const nodeMissing = node && /Cannot find module '\/workspace\//.test(log);
      if (!pyMissing && !nodeMissing) return null;
      if (nodeMissing && facts.node) {
        const s = facts.node.scripts;
        const pick = s.dev ? 'dev' : s.start ? 'start' : null;
        if (!pick) return null;
        const newCmd = npmRun(facts, pick);
        return {
          ruleId: 'moved-entrypoint', class: 'missing-file', confidence: 0.8,
          cause: `${node[1]} no longer exists; the app now starts with the "${pick}" script (${s[pick]}).`,
          fix: { actions: [{ type: 'replace-step', command: newCmd }], patches: [], doc: { kind: 'replace-command', text: newCmd } },
        };
      }
      const app = facts.python?.apps?.[0];
      if (!app) return null;
      const port = step.serve?.port || plan.steps.find((s) => s.serve)?.serve?.port || 8000;
      const newCmd = app.framework === 'flask'
        ? `flask --app ${app.module} run --port ${port}`
        : `uvicorn ${app.module}:${app.variable} --port ${port}`;
      return {
        ruleId: 'moved-entrypoint', class: 'missing-file', confidence: 0.85,
        cause: `${py[1]} no longer exists; the ${app.framework} app is now defined in ${app.file}.`,
        fix: { actions: [{ type: 'replace-step', command: newCmd }], patches: [], doc: { kind: 'replace-command', text: newCmd } },
      };
    },
  },
  // ── configuration ──────────────────────────────────────────────────
  {
    id: 'missing-env-var',
    async test(ctx) {
      const { log, facts, plan, sandboxEnv } = ctx;
      // Validators (joi, zod, envalid, pydantic) often list every missing variable at once.
      const names = new Set();
      const bad = /^(NODE_ENV|PATH|HOME|ERROR|WARN|INFO|DEBUG|TypeError|SyntaxError)$/;
      for (const re of [...ENV_PATTERNS, /"([A-Z][A-Z0-9_]{2,})" is required/, /env-var: "([A-Z][A-Z0-9_]{2,})" is a required variable/]) {
        for (const m of log.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))) {
          if (m[1] && !bad.test(m[1]) && !sandboxEnv[m[1]]) names.add(m[1]);
        }
      }
      if (!names.size) return null;
      const envFile = facts.envExample?.file;
      const exampleKeys = facts.envExample?.keys || {};
      const copyStep = plan.steps.find((s) => !s.skip && /^(cp|mv)\s+\S*\.?env\S*\s+\.env\b/.test(s.command));
      const inExample = [...names].filter((n) => n in exampleKeys);
      const missing = [...names].filter((n) => !(n in exampleKeys));
      const loads = facts.loadsDotenv || copyStep;
      const actions = [];
      const patches = [];
      let doc;
      let kinds = [];
      // The template already has them: the docs just never say to copy it.
      if (envFile && !copyStep && inExample.length) {
        actions.push({ type: 'insert-before', command: `cp ${envFile} .env`, kind: 'env' });
        doc = { kind: 'insert-step', text: `cp ${envFile} .env` };
      }
      if (missing.length) {
        if (envFile && loads) {
          if (!copyStep && !actions.length) actions.push({ type: 'insert-before', command: `cp ${envFile} .env`, kind: 'env' });
          for (const n of missing) {
            const { value, kind } = devValue(n, ctx);
            kinds.push(kind);
            patches.push({ path: envFile, op: 'append-env', key: n, value, comment: kind === 'fake' ? `Placeholder so the app starts. Features that call ${providerOf(n)} need your own key.` : kind === 'secret' ? 'Required. Use your own key.' : kind === 'generated' ? 'Required at startup. Any random string works for local development.' : 'Required at startup.' });
            actions.push({ type: 'exec', command: `touch .env && printf '\\n%s=%s\\n' ${shq(n)} ${shq(value)} >> .env` });
          }
          doc = doc || { kind: 'note', text: `${envFile} now includes ${missing.join(', ')} (required at startup).`, envVar: missing.join('`, `') };
        } else {
          for (const n of missing) {
            const { value, kind } = devValue(n, ctx);
            kinds.push(kind);
            actions.push({ type: 'insert-before', command: `export ${n}=${/\s/.test(value) ? shq(value) : value}`, kind: 'env' });
          }
          doc = doc || { kind: 'insert-step', text: missing.map((n) => `export ${n}=…`).join(' && '), envVar: missing.join('`, `') };
        }
      }
      const list = [...names];
      const shown = list.length > 4 ? `${list.slice(0, 4).join(', ')} and ${list.length - 4} more` : list.join(', ');
      const cause = missing.length
        ? `The app requires ${shown} at startup, but the docs never mention ${list.length > 1 ? 'them' : 'it'}${envFile ? ` and ${envFile} is missing ${missing.length === list.length ? (list.length > 1 ? 'them' : 'it') : missing.join(', ')}` : ''}.`
        : `The app requires ${shown} from ${envFile}, but the docs never say to create .env from it.`;
      if (doc && copyStep && doc.kind === 'note') doc.stepId = copyStep.id;
      return {
        ruleId: 'missing-env-var', class: kinds.every((k) => k === 'secret') && kinds.length ? 'needs-secret' : 'missing-env', confidence: 0.9,
        cause, fix: { actions, patches, doc },
      };
    },
  },
  {
    // Joi and friends: `"NODE_ENV" must be one of [production, integration, development]`.
    id: 'env-invalid-value',
    test({ log, step }) {
      const m = log.match(/"([A-Z][A-Z0-9_]{2,})" must be one of \[([^\]]+)\]/);
      if (!m) return null;
      const [, name, list] = m;
      const allowed = list.split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      const prefer = step.kind === 'test' ? ['test', 'testing', 'development', 'dev', 'local'] : ['development', 'dev', 'local', 'test'];
      const value = prefer.find((v) => allowed.includes(v)) || allowed[0];
      if (!value || /\s/.test(value)) return null;
      const jest = name === 'NODE_ENV' && !allowed.includes('test') && /\bjest\b|Test Suites:/.test(log) ? ' (Jest sets NODE_ENV=test, and the config rejects that)' : '';
      const cmd = `export ${name}=${value}`;
      return {
        ruleId: 'env-invalid-value', class: 'missing-env', confidence: 0.85,
        cause: `The app only accepts ${name} = ${allowed.join(' | ')}, but this step runs with another value${jest}; the docs never say to set it.`,
        fix: { actions: [{ type: 'insert-before', command: cmd, kind: 'env' }], patches: [], doc: { kind: 'insert-step', text: cmd } },
      };
    },
  },
  {
    // A template with every value blank (`PORT=`, `DATABASE_URL=`), copied as told, and a validator that rejects
    // empty strings: Joi's `"PORT" is not allowed to be empty` (Louis3797). Fill each with a working local value.
    id: 'env-empty-value',
    test(ctx) {
      const { log, facts } = ctx;
      const names = [...new Set([...log.matchAll(/"([A-Z][A-Z0-9_]{1,})" is not allowed to be empty/g)].map((m) => m[1]))];
      if (!names.length) return null;
      const envFile = facts.envExample?.file;
      const defaults = joiDefaults(facts);
      // One port for PORT and every localhost URL derived from it.
      const port = String((names.includes('PORT') && defaults.PORT) || facts.ports[0] || 3000);
      const values = {};
      for (const n of names) {
        // Mail always goes to the local Mailpit sidecar (port 1025), whatever the app's own default is.
        if (/^(\w+_)?(SMTP|MAIL|EMAIL)_(HOST|SERVER|PORT|USER|USERNAME|LOGIN)$/.test(n)) { values[n] = devValue(n, ctx); continue; }
        if (n === 'PORT') { values[n] = { value: port, kind: 'local' }; continue; }
        if (defaults[n] != null) { values[n] = { value: defaults[n], kind: 'default' }; continue; }
        if (n === 'NODE_ENV') { values[n] = { value: 'development', kind: 'local' }; continue; }
        if (/(^|_)(URL|ORIGIN)$/.test(n) && !/DATABASE|DB_|MONGO|REDIS|POSTGRES|MYSQL/.test(n)) { values[n] = { value: `http://localhost:${port}`, kind: 'local' }; continue; }
        if (/EXPIRE|EXPIRES|TTL/.test(n)) { values[n] = { value: '1h', kind: 'local' }; continue; }
        if (/_NAME$/.test(n) && !/DB|DATABASE|USER/.test(n)) { values[n] = { value: n.toLowerCase().replace(/_name$/, ''), kind: 'local' }; continue; }
        if (/^(MYSQL|MARIADB)_DATABASE$|^POSTGRES_DB$/.test(n)) { values[n] = { value: 'app', kind: 'local' }; continue; }
        const d = devValue(n, ctx);
        if (['local', 'generated', 'fake'].includes(d.kind)) values[n] = d;
      }
      // A database URL must agree with the credentials set next to it, so the sidecar and the app match.
      for (const n of names.filter((x) => /DATABASE_URL|DB_URL/.test(x))) {
        const mysql = names.some((x) => /^MYSQL_/.test(x)) || /provider\s*=\s*"mysql"/.test(prismaSchema(facts));
        if (!mysql) continue;
        const pw = values.MYSQL_ROOT_PASSWORD?.value || 'root';
        const db = values.MYSQL_DATABASE?.value || 'app';
        values[n] = { value: `mysql://root:${pw}@localhost:3306/${db}`, kind: 'local' };
      }
      const sets = Object.entries(values);
      if (!sets.length) return null;
      const missing = names.filter((n) => !values[n]);
      const actions = [{ type: 'exec', command: `touch .env && { grep -v -E '^(${sets.map(([k]) => k).join('|')})=' .env; ${sets.map(([k, v]) => `printf '%s=%s\\n' ${shq(k)} ${shq(v.value)}`).join('; ')}; } > /tmp/firstrun.env && mv /tmp/firstrun.env .env` }];
      const patches = envFile ? sets.filter(([, v]) => v.kind !== 'fake').map(([k, v]) => ({ path: envFile, op: 'set-env', key: k, value: v.value })) : [];
      const fakes = sets.filter(([, v]) => v.kind === 'fake').map(([k]) => k);
      const shown = sets.length > 4 ? `${sets.slice(0, 4).map(([k]) => k).join(', ')} and ${sets.length - 4} more` : sets.map(([k]) => k).join(', ');
      return {
        ruleId: 'env-empty-value', class: 'missing-env', confidence: 0.85,
        cause: `${envFile || 'The env template'} leaves ${names.length} required value${names.length > 1 ? 's' : ''} blank and the app rejects empty values. HUMBLE fills ${shown} with local values (the app's own defaults where it has them, generated dev secrets, a local mail catcher for SMTP)${fakes.length ? `; ${fakes.join(', ')} get${fakes.length === 1 ? 's' : ''} a placeholder so the app can start (features that call ${[...new Set(fakes.map(providerOf))].join(', ')} need a real key)` : ''}${missing.length ? `; ${missing.join(', ')} need${missing.length === 1 ? 's' : ''} a real value from a human` : ''}.`,
        fix: { actions, patches, doc: { kind: 'note', text: `\`${envFile || '.env'}\` now has working local values for the variables that were blank (${shown}).` } },
      };
    },
  },
  {
    // `.env.example` ships `MONGODB_URL=YourConnectionString` and the app fails on it; the working local value is often only in a comment.
    id: 'env-placeholder-value',
    test(ctx) {
      const { log, facts, sandboxEnv } = ctx;
      const envFile = facts.envExample?.file;
      const current = { ...(facts.envExample?.keys || {}), ...sandboxEnv };
      const placeholders = Object.entries(current).filter(([, v]) => PLACEHOLDER.test(String(v).trim()));
      if (!placeholders.length) return null;
      const urlError = /Invalid (?:connection string|URL|URI|scheme|DSN)|ERR_INVALID_URL|MongoParseError|could not parse/i.test(log);
      const dnsError = /getaddrinfo (?:ENOTFOUND|EAI_AGAIN)/.test(log);
      const hit = placeholders.filter(([k, v]) => log.includes(String(v).trim()) || (urlError && /(URL|URI|DSN|CONN(ECTION)?(_STRING)?)$/.test(k)) || (dnsError && /_HOST$/.test(k)));
      if (!hit.length) return null;
      let raw = '';
      try { raw = envFile ? fs.readFileSync(path.join(facts.root, envFile), 'utf8') : ''; } catch {}
      const examples = [...raw.matchAll(/^\s*#.*?\b([a-z][a-z0-9+]*:\/\/[^\s'"`]+)/gim)].map((m) => m[1]).filter((u) => !/[[\]<>]/.test(u));
      const pick = (k) => {
        const scheme = /MONGO/i.test(k) ? /^mongodb(\+srv)?:/ : /REDIS/i.test(k) ? /^rediss?:/ : /MYSQL/i.test(k) ? /^mysql:/ : /(DATABASE|POSTGRES|PG|DB)_/i.test(k) ? /^postgres(ql)?:/ : null;
        const ex = scheme && examples.find((u) => scheme.test(u) && /localhost|127\.0\.0\.1/.test(u));
        if (ex) return { value: ex, from: `the commented example in ${envFile}` };
        const d = devValue(k, ctx);
        return ['local', 'generated'].includes(d.kind) ? { value: d.value, from: 'a local default' } : null;
      };
      let sets = hit.map(([k, v]) => ({ k, v, ...pick(k) })).filter((s) => s.value);
      if (!sets.length) return null;
      // When a mail variable is among the hits, fill every other mail placeholder too and add Mailpit.
      const mailRe = /^(\w+_)?(SMTP|MAIL|EMAIL)_/;
      const mailHit = sets.some((s) => mailRe.test(s.k));
      const mailActions = [];
      const mailPatches = [];
      let mailDoc = null;
      if (mailHit) {
        const extra = placeholders.filter(([k]) => mailRe.test(k) && !sets.some((s) => s.k === k));
        for (const [k] of extra) {
          const d = devValue(k, ctx);
          if (['local', 'generated'].includes(d.kind)) sets.push({ k, v: current[k], value: d.value, from: 'a local default' });
        }
        // The README must start the catcher too (same docs as missing-service), or the passport proves a setup the docs don't describe.
        // An earlier fix may have started it already: never start two.
        if (!ctx.sandbox?.services?.some((s) => serviceKind(s.image, s.name) === 'mailpit')) {
          const mp = serviceFor('mailpit', { facts, envValues: {} });
          mailActions.push({ type: 'service', name: mp.name, image: mp.image, env: mp.env, port: mp.port });
          if (facts.compose && !mp.fromCompose) {
            mailPatches.push({ path: facts.compose.file, op: 'compose-add-service', name: mp.name, image: mp.image, port: mp.port, env: mp.env });
            mailDoc = { kind: 'insert-step', text: `docker compose up -d ${mp.name}`, service: 'mailpit' };
          } else {
            mailDoc = { kind: 'insert-step', text: mp.fromCompose ? `docker compose up -d ${mp.name}` : dockerRunLine(mp), service: 'mailpit' };
          }
          mailActions.push({ type: 'insert-before', command: mailDoc.text, kind: 'services', silent: true });
        }
      }
      const actions = [...sets.map((s) => ({ type: 'exec', command: `touch .env && { grep -v '^${s.k}=' .env; printf '%s=%s\\n' ${shq(s.k)} ${shq(s.value)}; } > /tmp/firstrun.env && mv /tmp/firstrun.env .env` })), ...mailActions];
      const patches = [...(envFile ? sets.map((s) => ({ path: envFile, op: 'set-env', key: s.k, value: s.value })) : []), ...mailPatches];
      const hitSets = sets.filter((s) => hit.some(([k]) => k === s.k));
      const envNote = `\`${envFile || '.env'}\` now has a working local value for ${sets.map((s) => `\`${s.k}\``).join(', ')} instead of a placeholder.`;
      return {
        ruleId: 'env-placeholder-value', class: 'missing-env', confidence: 0.85,
        cause: `${hitSets.map((s) => `${s.k}=${s.v}`).join(', ')} ${hitSets.length > 1 ? 'are placeholders' : 'is a placeholder'}${envFile ? ` in ${envFile}` : ''}, and the app fails on it; HUMBLE sets ${sets.map((s) => `${s.k}=${s.value} (${s.from})`).join(', ')}${mailDoc ? ' and starts a local mail catcher (Mailpit)' : ''}.`,
        fix: { actions, patches, doc: mailDoc || { kind: 'note', text: envNote } },
      };
    },
  },
  {
    // MongoDB 6+ dropped the legacy opcodes that old drivers still send (GeekyAnts: connect-mongo 2 → "Unsupported
    // OP_QUERY command: insert"). The app connects but every write fails, so run the newest server that driver speaks.
    id: 'mongo-legacy-driver',
    test({ log, sandbox }) {
      if (!/Unsupported OP_QUERY command|legacy-opcode-removal/.test(log)) return null;
      const mongo = (sandbox?.services || []).find((s) => s.name === 'mongo');
      if (mongo && /^mongo:(4|3)\b/.test(mongo.image)) return null;
      const text = 'MongoDB 4.4 (this project\'s driver can\'t talk to MongoDB 6+): docker run -d -p 27017:27017 mongo:4.4';
      return {
        ruleId: 'mongo-legacy-driver', class: 'runtime-version', confidence: 0.85,
        cause: 'The app\'s MongoDB driver uses legacy opcodes that MongoDB 6 and later removed ("Unsupported OP_QUERY command"), so it connects but every write fails. The docs don\'t say which MongoDB to run; the driver needs 4.4 or older.',
        fix: { actions: [{ type: 'service', name: 'mongo', image: 'mongo:4.4', env: {}, port: 27017 }], patches: [], doc: { kind: 'prerequisite', text } },
      };
    },
  },
  {
    id: 'missing-service',
    async test(ctx) {
      const { log, facts, sandbox, sandboxEnv } = ctx;
      const m = log.match(/ECONNREFUSED (?:127\.0\.0\.1|::1|localhost|0\.0\.0\.0):(\d+)|connect(?:ion)? (?:to )?(?:server at )?"?(?:127\.0\.0\.1|localhost|::1)"?(?: \([\d.:a-f]+\))?,? (?:on )?port (\d+) failed|Error 111 connecting to (?:localhost|127\.0\.0\.1):(\d+)|Connection refused[\s\S]{0,120}?(?:port |:)(\d{4,5})|could not connect to server[\s\S]{0,200}?port (\d+)|Can't connect to (?:local )?MySQL server on '[^']+'? ?\(?(?:111)?|MongoNetworkError[\s\S]{0,100}?:(\d+)|Redis connection to [\w.]+:(\d+) failed|connect ECONNREFUSED [\d.]+:(\d+)|dial tcp [\d.:]+:(\d+): connect: connection refused|ConnectionRefusedError[\s\S]{0,200}?(\d{4,5})|Is the server running on (?:host|that host) "?(?:localhost|127\.0\.0\.1)"?[\s\S]{0,80}?port (\d+)|connection to server at "?(?:localhost|127\.0\.0\.1)"?[^\n]*port (\d+) failed/i);
      const socket = /could not connect to server: No such file or directory[\s\S]{0,200}\/var\/run\/postgresql|connection to server on socket "\/var\/run\/postgresql/.test(log);
      let port = m ? Number(m.slice(1).find(Boolean)) : null;
      if (!port && m && /MySQL/.test(m[0])) port = 3306;
      if (!port && socket) port = 5432;
      if (!port && /redis/i.test(log) && /ECONNREFUSED|connection refused/i.test(log)) port = 6379;
      const kind = PORT_TO_SERVICE[port];
      if (!kind) return null;
      if (sandbox.services.some((s) => serviceKind(s.image, s.name) === kind)) return null;
      // Env files win over defaults hard-coded in config source (listed last, so found last).
      const def = serviceFor(kind, { facts, envValues: { ...(facts.envExample?.keys || {}), ...sandboxEnv, ...sourceUrls(facts) } });
      const actions = [{ type: 'service', name: def.name, image: def.image, env: def.env, port: def.port }];
      if (socket) actions.push({ type: 'exec', command: `printf 'export PGHOST=127.0.0.1 PGUSER=%s PGPASSWORD=%s\\n' ${shq(def.env.POSTGRES_USER || 'postgres')} ${shq(def.env.POSTGRES_PASSWORD || 'postgres')} >> ~/.bashrc; export PGHOST=127.0.0.1 PGUSER=${def.env.POSTGRES_USER || 'postgres'} PGPASSWORD=${def.env.POSTGRES_PASSWORD || 'postgres'}` });
      const patches = [];
      let doc;
      const composeStep = ctx.plan.steps.find((s) => !s.skip && s.kind === 'services' && /compose/.test(s.command));
      if (facts.compose && !def.fromCompose) {
        patches.push({ path: facts.compose.file, op: 'compose-add-service', name: def.name, image: def.image, port: def.port, env: def.env });
        doc = composeStep
          ? { kind: 'note', text: `${facts.compose.file} now also starts ${label(kind)}; \`${composeStep.command}\` brings up everything the app needs.`, service: kind }
          : { kind: 'insert-step', text: 'docker compose up -d', service: kind };
        if (!composeStep) actions.push({ type: 'insert-before', command: 'docker compose up -d', kind: 'services', silent: true });
      } else if (def.fromCompose) {
        doc = { kind: 'insert-step', text: `docker compose up -d ${def.name}`, service: kind };
        actions.push({ type: 'insert-before', command: `docker compose up -d ${def.name}`, kind: 'services', silent: true });
      } else {
        const line = dockerRunLine(def);
        doc = { kind: 'insert-step', text: line, service: kind };
        actions.push({ type: 'insert-before', command: line, kind: 'services', silent: true });
      }
      if (doc && composeStep && doc.kind === 'note') doc.stepId = composeStep.id;
      return {
        ruleId: 'missing-service', class: 'missing-service', confidence: 0.92,
        cause: `The app connects to ${label(kind)} on localhost:${port}, but the docs never start it${facts.compose && !def.fromCompose ? ` and ${facts.compose.file} doesn't define it` : ''}.`,
        fix: { actions, patches, doc },
      };
    },
  },
  // ── order of operations ─────────────────────────────────────────────
  {
    id: 'missing-migrations',
    test({ log, facts, plan }) {
      if (!/relation "[\w.]+" does not exist|no such table: \w+|Table '[\w.]+' doesn't exist|The table `[\w.]+` does not exist|P2021|SQLITE_ERROR: no such table|UndefinedTable|django\.db\.utils\.(?:OperationalError|ProgrammingError): (?:no such table|relation)/.test(log)) return null;
      let cmd = null;
      const scripts = facts.node ? Object.keys(facts.node.scripts) : [];
      const mig = scripts.find((s) => /^(db:)?migrat(e|ion)(s)?(:(up|latest|dev|deploy|run))?$/.test(s)) || scripts.find((s) => /migrat/.test(s) && !/(make|create|new|rollback|down|reset|generate)/.test(s));
      if (mig) cmd = npmRun(facts, mig);
      else if (facts.node?.deps.includes('prisma') || facts.files.some((f) => f.endsWith('schema.prisma'))) cmd = 'npx prisma migrate deploy';
      else if (facts.python?.django) cmd = 'python manage.py migrate';
      else if (facts.files.includes('alembic.ini')) cmd = 'alembic upgrade head';
      if (!cmd || plan.steps.some((s) => s.command === cmd && s.status === 'passed')) return null;
      return {
        ruleId: 'missing-migrations', class: 'wrong-order', confidence: 0.85,
        cause: `The database schema was never created: the docs skip the migration step (${cmd}).`,
        fix: { actions: [{ type: 'insert-before', command: cmd, kind: 'migrate' }], patches: [], doc: { kind: 'insert-step', text: cmd } },
      };
    },
  },
  {
    id: 'prisma-generate',
    test({ log }) {
      if (!/@prisma\/client did not initialize yet|Please run "prisma generate"|Prisma Client could not locate|run `prisma generate`/.test(log)) return null;
      return {
        ruleId: 'prisma-generate', class: 'wrong-order', confidence: 0.95,
        cause: 'The Prisma client was never generated; the docs skip `prisma generate`.',
        fix: { actions: [{ type: 'insert-before', command: 'npx prisma generate', kind: 'build' }], patches: [], doc: { kind: 'insert-step', text: 'npx prisma generate' } },
      };
    },
  },
  {
    // TypeScript errors only inside node_modules/**/*.d.ts: the project's own code is fine.
    // The standard fix is `skipLibCheck: true`; without it tsc fails on types it doesn't own.
    id: 'ts-skip-lib-check',
    test({ log, facts }) {
      const TS_ERR = /^(.+)\(\d+,\d+\): error TS\d+:/gm;
      const lines = [...log.matchAll(TS_ERR)];
      if (!lines.length) return null;
      // All error paths must be inside node_modules/ and end in .d.ts.
      if (!lines.every((m) => m[1].startsWith('node_modules/') && m[1].endsWith('.d.ts'))) return null;
      if (!facts.files.includes('tsconfig.json')) return null;
      const example = lines[0][1]; // e.g. node_modules/mongoose/node_modules/mongodb/mongodb.d.ts
      return {
        ruleId: 'ts-skip-lib-check', class: 'missing-dependency', confidence: 0.85,
        cause: `TypeScript type-checks ${example}; the errors are all inside dependencies, not this project's code, and tsconfig.json has no skipLibCheck.`,
        fix: {
          actions: [],
          patches: [{ path: 'tsconfig.json', op: 'tsconfig-skip-lib-check' }],
          doc: { kind: 'note', text: '`tsconfig.json` now sets `skipLibCheck: true`: the build failed on type errors inside dependencies, not in this project.' },
        },
      };
    },
  },
  {
    id: 'deps-not-installed',
    test({ log, facts, plan, step }) {
      // `poetry run uvicorn …` before any `poetry install`: Poetry says "Command not found: uvicorn" (often from a justfile or Makefile).
      const poetryCmd = log.match(/Command not found: ([\w.-]+)/);
      if (poetryCmd && facts.python?.manager === 'poetry' && !plan.steps.some((s) => ['passed', 'repaired'].includes(s.status) && /poetry install/.test(s.command))) {
        return {
          ruleId: 'deps-not-installed', class: 'wrong-order', confidence: 0.88,
          cause: `\`poetry run ${poetryCmd[1]}\` can't find ${poetryCmd[1]}: the project's dependencies were never installed, because the docs skip \`poetry install\`.`,
          fix: { actions: [{ type: 'insert-before', command: 'poetry install', kind: 'install' }], patches: [], doc: { kind: 'insert-step', text: 'poetry install' } },
        };
      }
      const m = log.match(/(?:sh|bash): (?:\d+: )?([\w.-]+): (?:command )?not found|Cannot find module '([^./][^']*)'|Error: Cannot find package '([^']+)'|ModuleNotFoundError: No module named '([\w.]+)'/);
      if (!m) return null;
      const bin = m[1];
      const mod = (m[2] || m[3] || '').split('/').slice(0, (m[2] || m[3] || '').startsWith('@') ? 2 : 1).join('/');
      const pymod = m[4]?.split('.')[0];
      const nodeBins = ['tsc', 'ts-node', 'tsx', 'nodemon', 'next', 'vite', 'jest', 'vitest', 'mocha', 'eslint', 'prisma', 'knex', 'sequelize', 'nest', 'react-scripts', 'webpack', 'rollup', 'concurrently', 'cross-env', 'turbo', 'nx', 'astro', 'nuxt', 'svelte-kit', 'remix', 'playwright', 'drizzle-kit', 'typeorm'];
      const installed = plan.steps.some((s) => s.kind === 'install' && ['passed', 'repaired'].includes(s.status) && /(npm|yarn|pnpm|bun)\s+(i|install|ci)\b|^yarn$/.test(s.command));
      // Only blame a skipped install for a CLI the project depends on; otherwise it's a globally-assumed tool (missing-tool).
      const binDeclared = bin && nodeBins.includes(bin) && (BIN_PACKAGE[bin] || [bin]).some((p) => facts.node?.deps.includes(p));
      if (facts.node && !installed && (binDeclared || (mod && facts.node.deps.includes(mod)))) {
        const cmd = installCmd(facts);
        return {
          ruleId: 'deps-not-installed', class: 'wrong-order', confidence: 0.9,
          cause: `Dependencies were never installed before "${step.command}"; the docs skip \`${cmd}\`.`,
          fix: { actions: [{ type: 'insert-before', command: cmd, kind: 'install' }], patches: [], doc: { kind: 'insert-step', text: cmd } },
        };
      }
      const pyInstalled = plan.steps.some((s) => s.kind === 'install' && ['passed', 'repaired'].includes(s.status) && /pip3? install|poetry install|uv sync|pipenv install/.test(s.command));
      if (facts.python && pymod && !pyInstalled && facts.python.deps.some((d) => d.replace(/-/g, '_') === pymod.toLowerCase() || d === pymod.toLowerCase())) {
        const req = facts.python.requirementsFiles.find((f) => /^requirements\.txt$/.test(f)) || facts.python.requirementsFiles[0];
        const cmd = facts.python.manager === 'poetry' ? 'poetry install' : facts.python.manager === 'uv' ? 'uv sync' : req ? `pip install -r ${req}` : 'pip install -e .';
        return {
          ruleId: 'deps-not-installed', class: 'wrong-order', confidence: 0.85,
          cause: `Python dependencies were never installed before "${step.command}"; the docs skip \`${cmd}\`.`,
          fix: { actions: [{ type: 'insert-before', command: cmd, kind: 'install' }], patches: [], doc: { kind: 'insert-step', text: cmd } },
        };
      }
      return null;
    },
  },
  {
    id: 'missing-tool',
    test({ log, facts }) {
      const m = log.match(/(?:sh|bash): (?:line \d+: |\d+: )?([\w.-]+): (?:command )?not found/);
      if (!m) return null;
      const tool = m[1];
      const installs = {
        yarn: 'corepack enable', pnpm: 'corepack enable',
        poetry: 'pip install poetry', pipenv: 'pip install pipenv', uv: 'pip install uv', tox: 'pip install tox', nox: 'pip install nox',
        make: 'apt-get update && apt-get install -y make', psql: 'apt-get update && apt-get install -y postgresql-client',
        createdb: 'apt-get update && apt-get install -y postgresql-client', redis_cli: 'apt-get update && apt-get install -y redis-tools',
        'redis-cli': 'apt-get update && apt-get install -y redis-tools', jq: 'apt-get update && apt-get install -y jq',
        python: 'ln -sf "$(command -v python3)" /usr/local/bin/python', pip: 'apt-get update && apt-get install -y python3-pip python3-venv',
        node: 'apt-get update && apt-get install -y nodejs npm', npm: 'apt-get update && apt-get install -y nodejs npm', npx: 'apt-get update && apt-get install -y nodejs npm',
        uvicorn: 'pip install uvicorn', gunicorn: 'pip install gunicorn', flask: 'pip install flask', pytest: 'pip install pytest',
        'docker-compose': null, docker: null,
      };
      // CLIs that READMEs assume are installed globally but the project doesn't depend on.
      const globalNpm = { nodemon: 'nodemon', 'ts-node': 'ts-node', tsc: 'typescript', pm2: 'pm2', serve: 'serve', 'http-server': 'http-server', gulp: 'gulp-cli', grunt: 'grunt-cli', bower: 'bower', 'sequelize': 'sequelize-cli', 'knex': 'knex', 'nest': '@nestjs/cli', 'vue-cli-service': '@vue/cli-service', 'ng': '@angular/cli', 'tsx': 'tsx', 'concurrently': 'concurrently', 'cross-env': 'cross-env', 'babel-node': '@babel/node' };
      if (facts.node && globalNpm[tool] && !facts.node.deps.includes(globalNpm[tool]) && !facts.node.deps.includes(tool)) {
        const cmd = `npm install --global ${globalNpm[tool]}`;
        return {
          ruleId: 'missing-tool', class: 'missing-tool', confidence: 0.85,
          cause: `The scripts call \`${tool}\`, but it isn't a dependency of the project: the docs assume it is installed globally.`,
          fix: { actions: [{ type: 'insert-before', command: cmd, kind: 'install' }], patches: [], doc: { kind: 'insert-step', text: cmd } },
        };
      }
      if (!(tool in installs) || installs[tool] === null) return null;
      const human = { yarn: 'Yarn (via `corepack enable`)', pnpm: 'pnpm (via `corepack enable`)', python: 'a `python` command (python3)', psql: 'the PostgreSQL client (psql)', createdb: 'the PostgreSQL client (createdb)' }[tool] || tool;
      const inPy = ['uvicorn', 'gunicorn', 'flask', 'pytest'].includes(tool);
      return {
        ruleId: 'missing-tool', class: inPy ? 'wrong-order' : 'missing-tool', confidence: 0.8,
        cause: `\`${tool}\` is not installed; the docs assume it is.`,
        fix: {
          actions: [{ type: 'exec', command: installs[tool] }],
          patches: [],
          doc: inPy ? { kind: 'insert-step', text: installs[tool] } : { kind: 'prerequisite', text: human, command: installs[tool] },
        },
      };
    },
  },
  {
    id: 'npm-peer-conflict',
    test({ log, step, facts }) {
      if (!/ERESOLVE (?:unable to resolve dependency tree|could not resolve)/.test(log) || !/^npm\s+(i|install|ci)\b/.test(step.command)) return null;
      // A committed yarn/pnpm lockfile means the authors never resolve with npm: use their tool.
      if (facts.node?.lockfile === 'yarn.lock' || facts.node?.lockfile === 'pnpm-lock.yaml') {
        const tool = facts.node.lockfile === 'yarn.lock' ? 'yarn' : 'pnpm';
        return {
          ruleId: 'npm-peer-conflict', class: 'missing-dependency', confidence: 0.88,
          cause: `npm cannot resolve the peer dependencies, but the repo ships ${facts.node.lockfile}: the maintainers install with ${tool}, not npm.`,
          fix: { actions: [{ type: 'exec', command: 'corepack enable' }, { type: 'replace-step', command: `${tool} install` }], patches: [], doc: { kind: 'replace-command', text: `corepack enable && ${tool} install` } },
        };
      }
      const cmd = step.command.includes('--legacy-peer-deps') ? null : `${step.command} --legacy-peer-deps`;
      if (!cmd) return null;
      return {
        ruleId: 'npm-peer-conflict', class: 'missing-dependency', confidence: 0.8,
        cause: 'Current npm refuses the project\'s conflicting peer dependencies (older npm versions only warned); the lockfile resolves with --legacy-peer-deps.',
        fix: { actions: [{ type: 'replace-step', command: cmd }], patches: [], doc: { kind: 'replace-command', text: cmd } },
      };
    },
  },
  {
    // No lockfile + an unbounded range (>=X, >X) lets `npm install` jump to a new major on a fresh clone.
    // Fires on a build/type/import failure when exactly one unbounded dep is tied to it by the log
    // (node_modules path, quoted module name) or by the blamed files' imports (one relative hop).
    id: 'unbounded-range-no-lockfile',
    test({ log, facts, plan }) {
      if (!facts.node) return null;
      // Condition 1: the log shows a build / type / import failure.
      if (!/error TS\d+|SyntaxError|is not a function|Cannot find module|ERR_REQUIRE_ESM/.test(log)) return null;
      // Condition 2: no lockfile in the project dir.
      const lockfiles = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'bun.lock'];
      const dir = path.join(facts.root, facts.projectDir || '');
      const hasLock = lockfiles.some((f) => { try { fs.statSync(path.join(dir, f)); return true; } catch { return false; } });
      if (hasLock) return null;
      // Condition 3 & 4: collect unbounded deps and pick the one named in the log.
      let pkg = null;
      let range = null;
      try {
        const raw = fs.readFileSync(path.join(dir, 'package.json'), 'utf8');
        const parsed = JSON.parse(raw);
        const allDeps = { ...parsed.dependencies, ...parsed.devDependencies };
        // A range is unbounded only when it is JUST `>=X` or `>X` (with optional whitespace and
        // optional prerelease/build suffix) — anything with `<`, `||`, ` - `, or a second comparator
        // after whitespace is bounded and must not fire.
        const unbounded = Object.entries(allDeps).filter(([, r]) => {
          const s = (r || '').trim();
          return /^>=?\s*\d[\d.]*(?:-[^\s|<]*)?(?:\s*\+[^\s|<]*)?$/.test(s);
        });
        if (!unbounded.length) return null;

        // ── package detection (evidence-based, not bare-word) ──────────────
        // (a) node_modules/<pkg>/ path in the log (handles scoped packages too).
        // (b) quoted module specifier in the log: '<pkg>' or "<pkg>".
        // (c) import tracing: for each source file blamed in the log, read it and
        //     collect package imports; also follow one hop of relative imports.
        const escName = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const hasEvidenceAB = (name) => {
          const e = escName(name);
          // (a) path evidence
          if (new RegExp(`node_modules/${e}/`).test(log)) return true;
          // (b) quoted specifier evidence
          if (new RegExp(`['"]${e}['"/]`).test(log)) return true;
          return false;
        };

        // Collect package names imported by a file (not relative imports).
        const pkgImportsOf = (filePath) => {
          let src = '';
          try { src = fs.readFileSync(filePath, 'utf8'); } catch { return new Set(); }
          const names = new Set();
          const importRe = /(?:import\s+.*?\s+from\s+|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
          for (const m of src.matchAll(importRe)) {
            const spec = m[1];
            if (spec.startsWith('.')) continue; // relative — skip for direct package collection
            // Normalise @scope/pkg/sub → @scope/pkg, pkg/sub → pkg
            const parts = spec.split('/');
            const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
            names.add(name);
          }
          return names;
        };

        // Collect relative imports of a file and return their resolved paths (try several extensions).
        const resolveRelative = (fromFile, spec) => {
          const base = path.resolve(path.dirname(fromFile), spec);
          const tries = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.cjs`,
            path.join(base, 'index.ts'), path.join(base, 'index.js')];
          for (const p of tries) { try { fs.statSync(p); return p; } catch {} }
          return null;
        };

        const relImportsOf = (filePath) => {
          let src = '';
          try { src = fs.readFileSync(filePath, 'utf8'); } catch { return []; }
          const paths = [];
          const importRe = /(?:import\s+.*?\s+from\s+|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
          for (const m of src.matchAll(importRe)) {
            const spec = m[1];
            if (!spec.startsWith('.')) continue;
            const resolved = resolveRelative(filePath, spec);
            if (resolved) paths.push(resolved);
          }
          return paths;
        };

        // Extract blamed source file paths from the log.
        // Patterns: `src/models/User.ts(64,11):`, `at file:///app/src/x.js:3:1`, `/workspace/src/x.js:3`
        const blamedFiles = new Set();
        // Absolute paths are the sandbox's: the repo is mounted at /workspace, so map them to the host copy.
        for (const m of log.matchAll(/(?:^|\s|\(|file:\/\/)(\/workspace\/[^\s():]+\.[cm]?[jt]sx?)(?::\d+|\(\d+,\d+\))/gm)) {
          blamedFiles.add(path.join(facts.root, m[1].slice('/workspace/'.length)));
        }
        // Also relative paths like `src/models/User.ts(64,11):`
        for (const m of log.matchAll(/\b((?:src|lib|app|dist)\/[^\s(]+\.[cm]?[jt]sx?)(?::\d+|:\d+:\d+|\(\d+,\d+\))/gm)) {
          blamedFiles.add(path.join(dir, m[1]));
        }

        // Build the import-trace candidate set (c): direct imports + one-hop relative imports.
        const importTracePkgs = new Set();
        for (const f of blamedFiles) {
          const direct = pkgImportsOf(f);
          for (const n of direct) importTracePkgs.add(n);
          for (const rel of relImportsOf(f)) {
            for (const n of pkgImportsOf(rel)) importTracePkgs.add(n);
          }
        }

        const hasEvidenceC = (name) => importTracePkgs.has(name);

        // Classify each unbounded dep by evidence tier.
        const abEvidence = unbounded.filter(([name]) => hasEvidenceAB(name));
        if (abEvidence.length === 1) { [pkg, range] = abEvidence[0]; }
        else if (abEvidence.length > 1) return null; // ambiguous even with strong evidence
        else {
          // Fall back to (c) import tracing.
          const cEvidence = unbounded.filter(([name]) => hasEvidenceC(name));
          if (cEvidence.length === 1) { [pkg, range] = cEvidence[0]; }
          else return null; // 0 or ambiguous
        }
      } catch { return null; }
      // Extract the floor version from >=X.Y.Z or >X.Y.Z; * / latest / x / empty have no floor.
      const floor = range.match(/^>=?\s*(\d[\d.]*)/);
      if (!floor || !floor[1]) return null;
      const ver = floor[1];
      // Determine the install tool from the plan's install step.
      const installStep = plan.steps.find((s) => /^(npm\s+(i|install|ci)|yarn\s+(install)?$|pnpm\s+install|bun\s+install)/.test(s.command));
      let installPrefix = 'npm install --no-save';
      if (installStep) {
        if (/^yarn\b/.test(installStep.command)) installPrefix = 'yarn add';
        else if (/^pnpm\b/.test(installStep.command)) installPrefix = 'pnpm add';
        else if (/^bun\b/.test(installStep.command)) installPrefix = 'bun add';
        else if (/--legacy-peer-deps/.test(installStep.command)) installPrefix = 'npm install --no-save --legacy-peer-deps';
      }
      const cmd = `${installPrefix} ${pkg}@^${ver}`;
      return {
        ruleId: 'unbounded-range-no-lockfile', class: 'missing-dependency', confidence: 0.7,
        // Two valid fixes; the setup-only one is applied and proven, the other is the maintainer's call (never blocks).
        choice: { name: `${pkg} version`, options: [
          { id: 'A', label: `Pin ${pkg} to ^${ver} (the version the code was written for)`, setupOnly: true, applied: true },
          { id: 'B', label: `Update the code for the latest ${pkg} and commit a lockfile`, setupOnly: false },
        ] },
        cause: `${pkg} is declared as ${range} with no lockfile, so a fresh install gets a newer major of ${pkg} than the code was written for; pinning to ^${ver} restores the version the setup docs assumed.`,
        fix: {
          actions: [{ type: 'insert-before', command: cmd }],
          patches: [],
          doc: { kind: 'insert-step', text: cmd },
        },
      };
    },
  },
  {
    id: 'apt-package-missing',
    test({ log, step }) {
      const m = log.match(/Unable to locate package ([\w.+-]+)|E: Package '([\w.+-]+)' has no installation candidate/);
      if (!m || !/^(sudo\s+)?apt(-get)?\s+install/.test(step.command)) return null;
      const pkg = m[1] || m[2];
      const known = {
        just: 'curl --proto =https --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin',
        'docker-compose': null,
        poetry: 'pip install poetry', pipx: 'pip install pipx', uv: 'pip install uv',
        nodejs: 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs',
        yarn: 'corepack enable', pnpm: 'corepack enable',
        'redis-server': null, postgresql: null,
      };
      const alt = known[pkg];
      if (!alt) return null;
      return {
        ruleId: 'apt-package-missing', class: 'platform-specific', confidence: 0.8,
        cause: `Debian/Ubuntu's apt has no "${pkg}" package on a current stable release; the docs' Linux instructions don't work as written.`,
        fix: { actions: [{ type: 'exec', command: 'apt-get update >/dev/null && (command -v curl >/dev/null || apt-get install -y curl >/dev/null)' }, { type: 'replace-step', command: alt }], patches: [], doc: { kind: 'replace-command', text: alt } },
      };
    },
  },
  {
    // Poetry >= 1.8 installs the project itself too, and fails when it isn't laid out as a package (an app, not a library).
    id: 'poetry-no-root',
    test({ log, step }) {
      if (!/The current project could not be installed: No file\/folder found for package/.test(log) || !/^poetry\s+install\b/.test(step.command) || /--no-root/.test(step.command)) return null;
      const cmd = `${step.command} --no-root`;
      return {
        ruleId: 'poetry-no-root', class: 'missing-dependency', confidence: 0.9,
        cause: 'The dependencies installed, but current Poetry also installs the project itself, and this repo is an app, not a package. Older Poetry skipped that silently.',
        fix: { actions: [{ type: 'replace-step', command: cmd }], patches: [], doc: { kind: 'replace-command', text: cmd } },
      };
    },
  },
  {
    id: 'python-venv-required',
    test({ log }) {
      if (!/externally-managed-environment/.test(log)) return null;
      const cmd = 'python3 -m venv .venv && . .venv/bin/activate';
      return {
        ruleId: 'python-venv-required', class: 'platform-specific', confidence: 0.9,
        cause: 'The system Python refuses global installs (PEP 668); the docs need a virtual environment step.',
        fix: { actions: [{ type: 'insert-before', command: cmd, kind: 'install' }], patches: [], doc: { kind: 'insert-step', text: cmd } },
      };
    },
  },
  {
    id: 'secret-required',
    test({ log, sandboxEnv = {} }) {
      const m = log.match(/(?:Invalid|Incorrect|missing) API key|401 Unauthorized|AuthenticationError|invalid_api_key|No API key provided|You didn't provide an API key/i);
      if (!m) return null;
      // The keys HUMBLE faked (or that are still empty or 'changeme') are the ones to ask a human for.
      const names = Object.entries(sandboxEnv).filter(([k, v]) => PROVIDER.test(k) && (String(v).includes(FAKE_MARK) || v === '' || v === 'changeme')).map(([k]) => k);
      const who = [...new Set(names.map(providerOf))].join(', ');
      return {
        ruleId: 'secret-required', class: 'needs-secret', confidence: 0.7,
        cause: names.length
          ? `${who} rejected the placeholder HUMBLE used for ${names.join(', ')}: this step calls the real service, so it needs your own key. HUMBLE will not invent one.`
          : 'This step needs a real third-party credential; HUMBLE will not invent one.',
        ask: { kind: 'secret', name: names.join(', ') || 'API key', names, why: `${m[0]} while running this step${who ? ` (${who})` : ''}` },
        fix: null,
      };
    },
  },
];

function label(kind) {
  return { postgres: 'PostgreSQL', redis: 'Redis', mongo: 'MongoDB', mysql: 'MySQL', rabbitmq: 'RabbitMQ', memcached: 'Memcached', elasticsearch: 'Elasticsearch', minio: 'MinIO', mailpit: 'a local mail catcher (Mailpit)' }[kind] || kind;
}
