import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scout } from '../src/scout/index.js';
import { classify } from '../src/plan.js';
import { serviceFor, dockerRunLine } from '../src/doctor/services.js';
import { diagnose } from '../src/doctor/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures', 'v2');
const teamhideFixture = path.join(fixtures, 'teamhide__fastapi-boilerplate');

test('compose-first: scout discovers subfolder docker-compose.yml and extracts service specs', async () => {
  const facts = await scout(teamhideFixture);
  assert.ok(facts.compose, 'facts.compose should be discovered');
  assert.equal(facts.compose.file, 'docker/docker-compose.yml');

  const mysql = facts.compose.services.find((s) => s.name === 'mysql');
  assert.ok(mysql, 'mysql service should be found');
  assert.equal(mysql.image, 'mysql:8.0.33');
  assert.equal(mysql.environment.MYSQL_USER, 'fastapi');
  assert.equal(mysql.environment.MYSQL_DATABASE, 'fastapi');
  assert.equal(mysql.environment.MYSQL_ROOT_PASSWORD, 'fastapi');
  assert.ok(mysql.volumes.some((v) => v.includes('init.sql')), 'mysql volumes should include init.sql');

  const redis = facts.compose.services.find((s) => s.name === 'redis');
  assert.ok(redis, 'redis service should be found');
  assert.equal(redis.image, 'redis:6.2.6');
});

test('compose-first: serviceFor prioritizes compose file environment, image and volumes over catalog defaults', async () => {
  const facts = await scout(teamhideFixture);
  const mysqlDef = serviceFor('mysql', { facts });

  assert.equal(mysqlDef.name, 'mysql');
  assert.equal(mysqlDef.image, 'mysql:8.0.33');
  assert.equal(mysqlDef.env.MYSQL_USER, 'fastapi');
  assert.equal(mysqlDef.env.MYSQL_PASSWORD, 'fastapi');
  assert.equal(mysqlDef.env.MYSQL_DATABASE, 'fastapi');
  assert.equal(mysqlDef.env.MYSQL_ROOT_PASSWORD, 'fastapi');
  assert.equal(mysqlDef.composeDir, 'docker');
  assert.equal(mysqlDef.fromCompose, true);
  assert.ok(mysqlDef.volumes.some((v) => v.includes('init.sql')), 'volumes should be populated from compose');

  const redisDef = serviceFor('redis', { facts });
  assert.equal(redisDef.name, 'redis');
  assert.equal(redisDef.image, 'redis:6.2.6');
  assert.equal(redisDef.fromCompose, true);
});

test('compose-first: serviceFor falls back cleanly to catalog defaults when no compose file is present', () => {
  const def = serviceFor('mysql', { facts: {} });
  assert.equal(def.image, 'mysql:8');
  assert.equal(def.env.MYSQL_ROOT_PASSWORD, 'root');
  assert.equal(def.env.MYSQL_DATABASE, 'app');
  assert.equal(def.fromCompose, false);
  assert.equal(def.volumes.length, 0);
});

test('compose-first: dockerRunLine renders bind mount volumes when present', () => {
  const def = {
    name: 'mysql',
    image: 'mysql:8.0.33',
    port: 3306,
    env: { MYSQL_ROOT_PASSWORD: 'root', MYSQL_DATABASE: 'fastapi' },
    volumes: ['./init.sql:/docker-entrypoint-initdb.d/init.sql:ro', 'mysqldb:/var/lib/mysql'],
  };
  const line = dockerRunLine(def);
  assert.match(line, /-v \.\/init\.sql:\/docker-entrypoint-initdb\.d\/init\.sql:ro/);
  assert.doesNotMatch(line, /-v mysqldb:/, 'named volume without path separator should not be mounted as bind volume');
});

test('plan: classify recognizes docker-compose up with -f flag as services step', () => {
  const c1 = classify('docker-compose -f docker/docker-compose.yml up', {});
  assert.equal(c1.kind, 'services', 'docker-compose with -f flag should be classified as services');

  const c2 = classify('docker compose -f docker/docker-compose.yml up -d', {});
  assert.equal(c2.kind, 'services', 'docker compose with -f and -d flags should be classified as services');

  const c3 = classify('docker-compose up -d', {});
  assert.equal(c3.kind, 'services', 'standard docker-compose up -d should be classified as services');
});

test('doctor missing-service: includes volumes, composeDir, and -f flag when from compose', async () => {
  const facts = await scout(teamhideFixture);
  const log = "sqlalchemy.exc.OperationalError: (pymysql.err.OperationalError) (2003, \"Can't connect to MySQL server on 'localhost' ([Errno 111] Connection refused)\")";
  const ctx = {
    step: { id: 'S4', command: 'alembic upgrade head', kind: 'migrate', source: {} },
    attempt: { out: log, exitCode: 1 },
    log,
    facts,
    plan: { steps: [] },
    sandbox: { services: [] },
    tried: new Set(),
    sandboxEnv: {},
  };

  const { diagnosis, fix } = await diagnose(ctx, { brain: 'rules' });
  assert.equal(diagnosis.ruleId, 'missing-service');
  assert.equal(fix.actions[0].type, 'service');
  assert.equal(fix.actions[0].image, 'mysql:8.0.33');
  assert.equal(fix.actions[0].env.MYSQL_USER, 'fastapi');
  assert.equal(fix.actions[0].env.MYSQL_ROOT_PASSWORD, 'fastapi');
  assert.equal(fix.actions[0].composeDir, 'docker');
  assert.ok(fix.actions[0].volumes.some((v) => v.includes('init.sql')));

  // Inserted repair step should reference the subfolder compose file
  const insertAction = fix.actions.find((a) => a.type === 'insert-before');
  assert.ok(insertAction);
  assert.equal(insertAction.command, 'docker compose -f docker/docker-compose.yml up -d mysql');
});

test('sandbox apt shim: package list check correctly triggers when only auxfiles/InRelease exist', async () => {
  // Test the shell script condition used in /firstrun/shims/apt
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { execSync } = await import('node:child_process');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apt-test-'));
  try {
    const listsDir = path.join(tmp, 'lists');
    fs.mkdirSync(listsDir);
    fs.mkdirSync(path.join(listsDir, 'auxfiles'));
    fs.mkdirSync(path.join(listsDir, 'partial'));
    fs.writeFileSync(path.join(listsDir, 'lock'), '');
    fs.writeFileSync(path.join(listsDir, 'deb.debian.org_InRelease'), '');

    // The shell command used in src/sandbox.js:
    const checkCmd = `sh -c 'if [ -z "$(ls "${listsDir}"/*_Packages 2>/dev/null)" ]; then echo "update"; else echo "skip"; fi'`;
    const beforeResult = execSync(checkCmd, { encoding: 'utf8' }).trim();
    assert.equal(beforeResult, 'update', 'Should trigger update when only auxfiles and InRelease exist');

    // Simulate apt-get update writing package lists
    fs.writeFileSync(path.join(listsDir, 'deb.debian.org_main_binary-amd64_Packages'), 'Package: foo\n');
    const afterResult = execSync(checkCmd, { encoding: 'utf8' }).trim();
    assert.equal(afterResult, 'skip', 'Should skip update once *_Packages exists');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});


// Friday's review of #133: compose volumes are repo-controlled; only repo-relative paths may reach a sidecar.
import { classify as classifyReview } from '../src/plan.js';
import { dockerRunLine as runLineReview } from '../src/doctor/services.js';
test('REVIEW: docker compose run/exec with start is not a services step', () => {
  assert.notEqual(classifyReview('docker compose run --rm app npm start', {}).kind, 'services');
  assert.notEqual(classifyReview('docker compose exec web npm run start', {}).kind, 'services');
  assert.equal(classifyReview('docker compose -f docker/docker-compose.yml up -d db', {}).kind, 'services');
  assert.equal(classifyReview('docker-compose up -d', {}).kind, 'services');
});
test('REVIEW: absolute or escaping volume paths never become mounts', () => {
  const line = runLineReview({ name: 'db', image: 'mysql:8', port: 3306, env: {}, volumes: ['/:/host', '../../secrets:/s', '~/.ssh:/k', 'C:/Users:/u', './docker/init.sql:/docker-entrypoint-initdb.d/init.sql', 'db-data:/var/lib/mysql'] });
  assert.doesNotMatch(line, /-v \/:|\.\.\/\.\.\/secrets|~\/\.ssh|C:\/Users|db-data/);
  assert.match(line, /-v \.\/docker\/init\.sql:\/docker-entrypoint-initdb\.d\/init\.sql/);
});
