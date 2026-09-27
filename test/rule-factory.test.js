// Rules learned on 27 Sep from the IBM Bob pass (Bob's proven fixes, now free) and rule-factory batch 1 (18 new repos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES } from '../src/doctor/rules.js';

const rule = (id) => RULES.find((r) => r.id === id);
const facts = { files: ['manage.py'], python: { django: true }, envExample: null, envVarsInCode: [], root: '.' };
const sandbox = { services: [] };

test('Prisma P1001 names the database port (IBM Bob fixed gothinkster this way; now a free rule)', async () => {
  const r = await rule('missing-service').test({ log: "Error: P1001: Can't reach database server at `localhost`:`5432`", facts, sandbox, sandboxEnv: {}, plan: { steps: [], runtime: { name: 'node' } }, step: { id: 'S3', command: 'npx prisma migrate deploy' } });
  assert.ok(r, 'recognised');
  assert.equal(r.fix.actions[0].type, 'service');
  assert.match(r.fix.actions[0].image, /postgres/);
});

test('Mongoose/NestJS "Unable to connect to the database" starts MongoDB', async () => {
  const r = await rule('missing-service').test({ log: '[Nest] 234  - ERROR [MongooseModule] Unable to connect to the database. Retrying (4)...', facts, sandbox, sandboxEnv: {}, plan: { steps: [], runtime: { name: 'node' } }, step: { id: 'S2', command: 'npm run start' } });
  assert.ok(r, 'recognised');
  assert.match(r.fix.actions[0].image, /mongo/);
});

test('django-admin.py was renamed django-admin (Django 4)', () => {
  const r = rule('django-admin-renamed').test({ log: '/firstrun/step-1.sh: line 5: django-admin.py: command not found', step: { command: 'django-admin.py startproject --template=x mysite' } });
  assert.equal(r.fix.actions[0].command, 'django-admin startproject --template=x mysite');
});

test('./manage.py without the executable bit (Permission denied) runs as python manage.py (IBM Bob fixed wagtail this way)', () => {
  const r = rule('shebang-interpreter-missing').test({ log: '/firstrun/step-3.sh: line 5: ./manage.py: Permission denied', step: { command: './manage.py migrate' }, facts });
  assert.equal(r.fix.actions[0].command, 'python manage.py migrate');
});

// General rules from the most common real-world setup failures (GitHub issue counts in the rule comments).
const py = (v = '3.12') => ({ runtime: { name: 'python', version: v }, steps: [] });
const node = { runtime: { name: 'node', version: '22' }, steps: [] };
const pyFacts = { root: process.cwd(), files: ['app.py', 'requirements.txt'], python: { requirementsFiles: ['requirements.txt'] } };

test('distutils removed (Python 3.12): install setuptools first, then fall back to Python 3.11', () => {
  const r1 = rule('python-stdlib-removed').test({ log: "ModuleNotFoundError: No module named 'distutils'", plan: py(), tried: new Set() });
  assert.equal(r1.fix.actions[0].command, 'pip install setuptools');
  const r2 = rule('python-stdlib-removed').test({ log: "ModuleNotFoundError: No module named 'distutils'", plan: py(), tried: new Set(['S1:[{"command":"pip install setuptools"}]']) });
  assert.equal(r2.fix.actions[0].runtime.version, '3.11');
});

test('collections ABC aliases removed in 3.10: Python 3.9, whatever newer version the image has', () => {
  for (const v of ['3.10', '3.11', '3.13']) {
    const r = rule('python-stdlib-removed').test({ log: "AttributeError: module 'collections' has no attribute 'MutableMapping'", plan: py(v), tried: new Set() });
    assert.equal(r.fix.actions[0].runtime.version, '3.9');
  }
});

test('dependency drift (markupsafe, werkzeug, wtforms …): one general fix, install as of the commit date', () => {
  for (const log of ["ImportError: cannot import name 'soft_unicode' from 'markupsafe'", "ImportError: cannot import name 'url_quote' from 'werkzeug.urls'", "ImportError: cannot import name 'TextField' from 'wtforms'"]) {
    const r = rule('python-dependency-drift').test({ log, plan: py(), facts: pyFacts, step: { command: 'python app.py' }, tried: new Set() });
    assert.match(r.fix.actions[0].command, /uv pip install --system --exclude-newer \d{4}-\d\d-\d\d -r requirements\.txt/);
  }
  const own = rule('python-dependency-drift').test({ log: "ImportError: cannot import name 'x' from 'app'", plan: py(), facts: pyFacts, step: { command: 'python app.py' }, tried: new Set() });
  assert.equal(own, null, "the project's own module is not drift");
});

test('OpenSSL 3 on any Node 17+: legacy provider', () => {
  const r = rule('node-openssl-legacy').test({ log: 'Error: error:0308010C:digital envelope routines::unsupported', plan: node, tried: new Set() });
  assert.equal(r.fix.actions[0].command, 'export NODE_OPTIONS=--openssl-legacy-provider');
});

test('native build headers: pg_config / mysql_config / Python.h', () => {
  assert.match(rule('python-native-headers').test({ log: 'Error: pg_config executable not found.', plan: py() }).fix.actions[0].command, /libpq-dev/);
  assert.match(rule('python-native-headers').test({ log: 'OSError: mysql_config not found', plan: py() }).fix.actions[0].command, /default-libmysqlclient-dev/);
  assert.match(rule('python-native-headers').test({ log: 'fatal error: Python.h: No such file or directory', plan: py() }).fix.actions[0].command, /python3-dev/);
});

test('npm ci on a stale lockfile falls back to npm install; yarn frozen lockfile unfreezes', () => {
  assert.equal(rule('npm-ci-lock-mismatch').test({ log: 'npm ERR! `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.', step: { command: 'npm ci' } }).fix.actions[0].command, 'npm install');
  assert.equal(rule('yarn-frozen-lockfile').test({ log: 'error Your lockfile needs to be updated, but yarn was run with `--frozen-lockfile`.', step: { command: 'yarn install --frozen-lockfile' } }).fix.actions[0].command, 'yarn install');
});

test('old pins without wheels: the Python that was current at the commit date', async () => {
  const r = await rule('python-era-runtime').test({ log: 'ERROR: Could not build wheels for numpy, which is required to install pyproject.toml-based projects', plan: py('3.12'), facts: pyFacts });
  // this repo's last commit is 2026, so no older era applies here; the rule must then stay silent
  assert.equal(r, null);
});
