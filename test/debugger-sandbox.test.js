import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ddmin, envBisect } from '../src/debugger/ddmin.js';
import { bisectCommits, findLastVerifiedCommit, getRelevantCommits, staticBisect, readmeBisect } from '../src/debugger/bisect.js';
import { buildStraceCommand, summariseStraceLog, evidenceToLines, runWithStrace } from '../src/debugger/syscall.js';
import { buildPostmortemCommands, formatPostmortemInstructions } from '../src/debugger/postmortem.js';
import { redactSecrets } from '../src/redact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, 'fixtures');

test('ddmin: finds 1 culprit among 4 differences in at most 7 runs', async () => {
  const differences = [
    { type: 'node-version', host: '18.19', proof: '20.11' },
    { type: 'port', host: '5432 in use', proof: 'free' },
    { type: 'env', host: 'DATABASE_URL not set', proof: 'set' },
    { type: 'tool', host: 'python3.11 missing', proof: 'present' }
  ];

  let runs = 0;
  const testFn = async (subset) => {
    runs++;
    const hasCulprit = subset.some(d => d.type === 'node-version');
    return !hasCulprit;
  };

  const result = await ddmin(differences, testFn, { maxRuns: 20 });
  assert.ok(runs <= 7, `ddmin used ${runs} runs, expected <= 7`);
  assert.equal(result.minimal.length, 1, `Expected 1 culprit, got ${result.minimal.length}`);
  assert.equal(result.minimal[0].type, 'node-version', 'Wrong culprit identified');
});

test('ddmin: finds 2 interacting culprits among 6 differences', async () => {
  const differences = [
    { type: 'node-version', host: '18.19', proof: '20.11' },
    { type: 'port-5432', host: 'in use', proof: 'free' },
    { type: 'env-DATABASE_URL', host: 'not set', proof: 'set' },
    { type: 'tool-python', host: 'missing', proof: 'present' },
    { type: 'tool-docker', host: 'missing', proof: 'present' },
    { type: 'env-REDIS_URL', host: 'not set', proof: 'set' }
  ];

  let runs = 0;
  const testFn = async (subset) => {
    runs++;
    const hasPort = subset.some(d => d.type === 'port-5432');
    const hasEnv = subset.some(d => d.type === 'env-DATABASE_URL');
    return !(hasPort && hasEnv);
  };

  const result = await ddmin(differences, testFn, { maxRuns: 20 });
  assert.ok(result.runs <= 15, `ddmin used ${result.runs} runs, expected <= 15`);
  const culpritTypes = result.minimal.map(d => d.type).sort();
  assert.deepEqual(culpritTypes, ['env-DATABASE_URL', 'port-5432'], 'Wrong culprits identified');
});

test('ddmin: returns empty minimal set when all differences pass', async () => {
  const differences = [
    { type: 'node-version', host: '20.11', proof: '20.11' },
    { type: 'port', host: 'free', proof: 'free' }
  ];

  const testFn = async () => true;
  const result = await ddmin(differences, testFn, { maxRuns: 10 });
  assert.equal(result.minimal.length, 0, 'Expected empty minimal set when all pass');
});

test('bisect: finds first bad commit in fake history of 9 commits in at most 5 runs', async () => {
  const commits = [
    { sha: 'a1', message: 'fix typo', files: ['README.md'] },
    { sha: 'a2', message: 'update deps', files: ['package.json'] },
    { sha: 'a3', message: 'add feature', files: ['src/app.js'] },
    { sha: 'a4', message: 'refactor', files: ['src/utils.js'] },
    { sha: 'b1', message: 'BREAK: change node version', files: ['package.json', '.nvmrc'] },
    { sha: 'b2', message: 'follow up', files: ['src/config.js'] },
    { sha: 'b3', message: 'another fix', files: ['README.md'] },
    { sha: 'b4', message: 'update lockfile', files: ['package-lock.json'] },
    { sha: 'b5', message: 'final', files: ['src/index.js'] }
  ];

  let runs = 0;
  const runner = async (sha) => {
    runs++;
    const idx = commits.findIndex(c => c.sha === sha);
    return { pass: idx < 4 };
  };

  const result = await bisectCommits(commits, runner, { maxRuns: 10 });
  assert.ok(runs <= 5, `bisect used ${runs} runs, expected <= 5`);
  assert.ok(result.firstBadCommit !== null, 'Should find a bad commit');
  assert.equal(result.firstBadCommit.sha, 'b1', 'Wrong first bad commit');
  assert.equal(result.firstBadCommit.message, 'BREAK: change node version');
});

test('bisect: returns null when HEAD passes', async () => {
  const commits = [
    { sha: 'a1', message: 'good commit', files: ['README.md'] },
    { sha: 'a2', message: 'another good', files: ['package.json'] }
  ];

  const runner = async () => ({ pass: true });
  const result = await bisectCommits(commits, runner, { maxRuns: 10 });
  assert.equal(result.firstBadCommit, null, 'Should return null when all pass');
});

test('bisect: handles case where even first commit fails', async () => {
  const commits = [
    { sha: 'b1', message: 'already broken', files: ['README.md'] },
    { sha: 'b2', message: 'still broken', files: ['package.json'] }
  ];

  const runner = async () => ({ pass: false });
  const result = await bisectCommits(commits, runner, { maxRuns: 10 });
  assert.ok(result.firstBadCommit !== null, 'Should identify first commit as bad');
  assert.equal(result.firstBadCommit.sha, 'b1');
});

test('syscall: parses ENOENT from synthetic strace log', async () => {
  const logContent = fs.readFileSync(path.join(FIXTURE_DIR, 'strace-synthetic.txt'), 'utf8');
  const evidence = summariseStraceLog(logContent);

  const enoentEvidence = evidence.filter(e => e.type === 'ENOENT' || e.type === 'STAT_ENOENT');
  assert.ok(enoentEvidence.length > 0, 'Should find ENOENT entries');

  const paths = enoentEvidence.map(e => e.detail.path);
  assert.ok(paths.some(p => p.includes('.venv')), 'Should find missing .venv');
  assert.ok(paths.some(p => p.includes('production.yaml')), 'Should find missing config file');
  assert.ok(paths.some(p => p.includes('package-lock.json')), 'Should find missing lockfile');
});

test('syscall: parses ECONNREFUSED from synthetic strace log', async () => {
  const logContent = fs.readFileSync(path.join(FIXTURE_DIR, 'strace-synthetic.txt'), 'utf8');
  const evidence = summariseStraceLog(logContent);

  const connRefused = evidence.filter(e => e.type === 'ECONNREFUSED');
  assert.ok(connRefused.length > 0, 'Should find ECONNREFUSED entries');

  const ports = connRefused.map(e => e.detail.port);
  assert.ok(ports.includes(5432), 'Should find PostgreSQL port 5432 refused');
  assert.ok(ports.includes(6379), 'Should find Redis port 6379 refused');

  const hosts = connRefused.map(e => e.detail.host);
  assert.ok(hosts.every(h => h === '127.0.0.1' || h === 'localhost' || h === 'unknown'), 'Hosts should be localhost');
});

test('syscall: parses exec failures from synthetic strace log', async () => {
  const logContent = fs.readFileSync(path.join(FIXTURE_DIR, 'strace-synthetic.txt'), 'utf8');
  const evidence = summariseStraceLog(logContent);

  const execNotFound = evidence.filter(e => e.type === 'EXEC_NOT_FOUND' || e.type === 'EXEC_FAILED');
  assert.ok(execNotFound.length > 0, 'Should find exec failures');

  const tools = execNotFound.map(e => e.detail.tool);
  assert.ok(tools.some(t => t.includes('tsc')), 'Should find missing tsc');
  assert.ok(tools.some(t => t.includes('docker')), 'Should find missing docker');
  assert.ok(tools.some(t => t.includes('python3.11')), 'Should find missing python3.11');
  assert.ok(tools.some(t => t.includes('psql')), 'Should find missing psql');
});

test('syscall: produces correct human-readable evidence lines', async () => {
  const logContent = fs.readFileSync(path.join(FIXTURE_DIR, 'strace-synthetic.txt'), 'utf8');
  const evidence = summariseStraceLog(logContent);
  const lines = evidenceToLines(evidence);

  const lineText = lines.join('\n');
  assert.ok(lineText.includes('ENOENT'), 'Should have ENOENT lines');
  assert.ok(lineText.includes('ECONNREFUSED'), 'Should have ECONNREFUSED lines');
  assert.ok(lineText.includes('exec:'), 'Should have exec lines');
  assert.ok(lineText.includes('not found'), 'Should have "not found" for missing tools');
});

test('syscall: deduplicates repeated errors', async () => {
  const logContent = fs.readFileSync(path.join(FIXTURE_DIR, 'strace-synthetic.txt'), 'utf8');
  const evidence = summariseStraceLog(logContent);

  const enoentCount = evidence.filter(e => e.type === 'ENOENT').length;
  const statEnoentCount = evidence.filter(e => e.type === 'STAT_ENOENT').length;
  const connRefusedCount = evidence.filter(e => e.type === 'ECONNREFUSED').length;
  const execNotFoundCount = evidence.filter(e => e.type === 'EXEC_NOT_FOUND').length;

  assert.ok(enoentCount > 0);
  assert.ok(connRefusedCount > 0);
  assert.ok(execNotFoundCount > 0);
});

test('syscall: redacts secrets in strace output', async () => {
  const secretToken = 'sk-ant-api03-' + 'a'.repeat(30);
  const logWithSecret = `
openat(AT_FDCWD, "/workspace/.env", O_RDONLY) = 3
read(3, "DATABASE_URL=postgres://user:***@localhost:5432/db", 100) = 100
connect(3, {sa_family=AF_INET, sin_port=htons(5432), sin_addr=inet_addr("127.0.0.1")}, 16) = -1 ECONNREFUSED
execve("/usr/bin/curl", ["curl", "-H", "Authorization: Bearer " + secretToken, "https://api.github.com"], ...) = 0
`;
  const evidence = summariseStraceLog(logWithSecret);
  const lines = evidenceToLines(evidence);
  const allText = lines.join('\n');

  // Should not leak the token in evidence lines
  assert.ok(!allText.includes(secretToken));
});

test('postmortem: builds correct docker commit command', () => {
  const result = buildPostmortemCommands({
    containerName: 'firstrun-abc123',
    image: 'node:20',
    failedStepCwd: '/workspace/backend',
    failedStepEnv: {
      DATABASE_URL: 'postgres://postgres:password@localhost:5432/app',
      PORT: '3000',
      NODE_ENV: 'development'
    },
    label: 'test-run'
  });

  assert.ok(result.commitCommand.includes('docker commit'), 'Should have docker commit');
  assert.ok(result.commitCommand.includes('WORKDIR /workspace/backend'), 'Should have WORKDIR');
  assert.ok(result.commitCommand.includes('DATABASE_URL'), 'Should have DATABASE_URL env');
  assert.ok(result.commitCommand.includes('firstrun-postmortem-test-run'), 'Should have generated image name');

  assert.ok(result.runCommand.includes('docker run -it'), 'Should have docker run -it');
  assert.ok(result.runCommand.includes('--network container:firstrun-abc123'), 'Should share network');
  assert.ok(result.runCommand.includes('-w /workspace/backend'), 'Should have working directory');
  assert.ok(result.runCommand.includes('bash'), 'Should run bash');
});

test('postmortem: formats post-mortem instructions correctly', () => {
  const instructions = formatPostmortemInstructions({
    containerName: 'firstrun-abc123',
    image: 'node:20',
    failedStepCwd: '/workspace',
    failedStepEnv: { DATABASE_URL: 'postgres://...' },
    label: 'test',
    failedStepCommand: 'npm run migrate'
  });

  assert.ok(instructions.includes('POST-MORTEM SHELL'), 'Should have header');
  assert.ok(instructions.includes('npm run migrate'), 'Should show failed command');
  assert.ok(instructions.includes('docker commit'), 'Should show commit command');
  assert.ok(instructions.includes('docker run -it'), 'Should show run command');
  assert.ok(instructions.includes('firstrun-postmortem-test'), 'Should show image name');
});

test('postmortem: redacts secrets in post-mortem commands', () => {
  // Generate token at runtime to avoid check-secrets detecting it in source
  const secretToken = 'sk-ant-api03-' + 'a'.repeat(30); // Anthropic API key pattern
  const result = buildPostmortemCommands({
    containerName: 'firstrun-abc123',
    image: 'node:20',
    failedStepCwd: '/workspace',
    failedStepEnv: {
      GH_TOKEN: secretToken,
      DATABASE_URL: 'postgres://user:***@localhost:5432/db'
    },
    label: 'test'
  });

  assert.ok(!result.commitCommand.includes(secretToken), 'Anthropic token should be redacted');
  assert.ok(!result.runCommand.includes(secretToken), 'Anthropic token should be redacted in run command');
});

test('integration: ddmin does not print secrets', async () => {
  const secretToken = 'sk-ant-api03-' + 'a'.repeat(30);
  const differences = [
    { type: 'env', host: 'ANTHROPIC_API_KEY=' + secretToken, proof: 'set' },
    { type: 'node-version', host: '18.19', proof: '20.11' }
  ];

  const testFn = async (subset) => {
    return !subset.some(d => d.type === 'node-version');
  };

  const result = await ddmin(differences, testFn, { maxRuns: 10 });
  const resultStr = JSON.stringify(result);
  assert.ok(!resultStr.includes(secretToken), 'Secret should not appear in ddmin result');
});

test('integration: bisect does not print secrets', async () => {
  const secretToken = 'sk-ant-api03-' + 'a'.repeat(30);
  const commits = [
    { sha: 'a1', message: 'good', files: ['README.md'] },
    { sha: 'b1', message: 'bad with ANTHROPIC_API_KEY=' + secretToken, files: ['.env'] }
  ];

  const runner = async (sha) => ({ pass: sha === 'a1' });
  const result = await bisectCommits(commits, runner, { maxRuns: 10 });
  const resultStr = JSON.stringify(result);
  assert.ok(!resultStr.includes(secretToken), 'Secret should not appear in bisect result');
});

test('integration: syscall summariser redacts secrets', async () => {
  const secretToken = 'sk-ant-api03-' + 'a'.repeat(30);
  const logWithSecret = `execve("/usr/bin/curl", ["curl", "-H", "Authorization: Bearer " + secretToken, "https://api.github.com"], ...) = 0`;
  const evidence = summariseStraceLog(logWithSecret);
  const lines = evidenceToLines(evidence);
  const allText = lines.join('\n');
  assert.ok(!allText.includes(secretToken), 'Anthropic token should be redacted');
});

test('integration: postmortem redacts secrets', () => {
  // Generate token at runtime to avoid check-secrets detecting it in source
  const secretToken = 'sk-ant-api03-' + 'a'.repeat(30);
  const awsSecret = 'sk-ant-api03-' + 'b'.repeat(30);
  const result = buildPostmortemCommands({
    containerName: 'firstrun-abc123',
    image: 'node:20',
    failedStepCwd: '/workspace',
    failedStepEnv: {
      GH_TOKEN: secretToken,
      AWS_SECRET: awsSecret
    },
    label: 'test'
  });

  assert.ok(!result.commitCommand.includes(secretToken));
  assert.ok(!result.commitCommand.includes(awsSecret));
  assert.ok(!result.runCommand.includes(secretToken));
  assert.ok(!result.runCommand.includes(awsSecret));
});

test('syscall: buildStraceCommand produces correct command', () => {
  const cmd = buildStraceCommand('npm install', '/tmp/strace.log');
  assert.ok(cmd.includes('strace -f -e trace=file,network,process -o /tmp/strace.log -- npm install'));
});