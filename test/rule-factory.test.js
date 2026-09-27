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
