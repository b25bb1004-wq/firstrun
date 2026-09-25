import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { redactSecrets, redactDeep, isPlainPlaceholder, REDACTED } from '../src/redact.js';
import { Recorder } from '../src/recorder.js';

// Construct synthetic tokens and variable assignments at runtime so
// tools/check-secrets.sh PAT grep finds zero hits in git commit diffs
const mk = (a, b) => a + b;

test('isPlainPlaceholder recognizes plain word placeholders and rejects real tokens', () => {
  // Plain word placeholders that must be kept readable
  assert.equal(isPlainPlaceholder('your-api-key'), true);
  assert.equal(isPlainPlaceholder('email-server-password'), true);
  assert.equal(isPlainPlaceholder('thisisasamplesecret'), true);
  assert.equal(isPlainPlaceholder('change.me.local.dev.only.not.a.secret'), true);
  assert.equal(isPlainPlaceholder('<your-token>'), true);
  assert.equal(isPlainPlaceholder('[api-key]'), true);
  assert.equal(isPlainPlaceholder('secret'), true);
  assert.equal(isPlainPlaceholder('password'), true);
  assert.equal(isPlainPlaceholder('changeme'), true);
  assert.equal(isPlainPlaceholder('dummy-token'), true);

  // Tokens that must NOT be treated as placeholders
  assert.equal(isPlainPlaceholder(mk('wagtail_', '42d87e0d6b0593457a')), false);
  assert.equal(isPlainPlaceholder(mk('ghp_', '0123456789abcdefghijklmnopqrstuv')), false);
  assert.equal(isPlainPlaceholder(mk('sk-', 'ant-api03-abcdef1234567890')), false);
  assert.equal(isPlainPlaceholder(mk('AKIA', 'IOSFODNN7EXAMPLE')), false);
  assert.equal(isPlainPlaceholder(mk('xoxb-', '123456789012-abcdef123456')), false);
  assert.equal(isPlainPlaceholder(mk('bob_prod_', '12345678')), false);
  assert.equal(isPlainPlaceholder(mk('nvapi-', '1234567890abcdef1234')), false);
  assert.equal(isPlainPlaceholder('b49f12c8e3a7d5012e84c97f'), false);
});

test('redactSecrets masks known token prefixes anywhere in text', () => {
  const ghpToken = mk('ghp_', '0123456789abcdefghijklmnopqrstuv');
  const skToken = mk('sk-', 'ant-api03-abcdef1234567890');
  const xoxbToken = mk('xoxb-', '123456789012-abcdef123456');
  const akiaToken = mk('AKIA', 'IOSFODNN7EXAMPLE');
  const bobToken = mk('bob_prod_', '12345678');
  const nvapiToken = mk('nvapi-', '1234567890abcdef1234');
  const wagtailToken = mk('wagtail_', '42d87e0d6b0593457a');

  const text = [
    `Run curl -H "Authorization: Bearer ${ghpToken}" https://api.github.com`,
    `OpenAI key: ${skToken}`,
    `Slack bot token: ${xoxbToken}`,
    `AWS key: ${akiaToken}`,
    `IBM Bob key: ${bobToken}`,
    `NVIDIA key: ${nvapiToken}`,
    `Wagtail token: ${wagtailToken}`,
  ].join('\n');

  const redacted = redactSecrets(text);

  assert.doesNotMatch(redacted, /ghp_/);
  assert.doesNotMatch(redacted, /sk-ant-/);
  assert.doesNotMatch(redacted, /xoxb-/);
  assert.doesNotMatch(redacted, /AKIA/);
  assert.doesNotMatch(redacted, /bob_prod_/);
  assert.doesNotMatch(redacted, /nvapi-/);
  assert.doesNotMatch(redacted, /wagtail_/);
  assert.match(redacted, new RegExp(REDACTED));
});

test('redactSecrets masks wagtail bakerydemo export line without affecting placeholders', () => {
  const wagtailVal = mk('wagtail_', '42d87e0d6b0593457a');
  const input = mk('export WAGTAIL_CLI_TOK', `EN=${wagtailVal}`);
  const output = redactSecrets(input);
  assert.equal(output, mk('export WAGTAIL_CLI_TOK', `EN=${REDACTED}`));

  const quotedInput = mk('export WAGTAIL_CLI_TOK', `EN="${wagtailVal}"`);
  const quotedOutput = redactSecrets(quotedInput);
  assert.equal(quotedOutput, mk('export WAGTAIL_CLI_TOK', `EN="${REDACTED}"`));
});

test('redactSecrets keeps plain-word placeholders readable in assignments', () => {
  const lines = [
    mk('API_K', 'EY=your-api-key'),
    mk('SMTP_PASS', 'WORD=email-server-password'),
    mk('JWT_SEC', 'RET=thisisasamplesecret'),
    mk('SESSION_SEC', 'RET="change.me.local.dev.only.not.a.secret"'),
    'PORT=3000',
    'NODE_ENV=production',
  ].join('\n');

  const result = redactSecrets(lines);
  assert.equal(result, lines, 'placeholders and normal config vars must remain readable');
});

test('redactSecrets masks non-placeholder secrets and passwords in assignments', () => {
  const pw = mk('my_prod_secret_pass_', '9876');
  const sec = mk('d41d8cd98f00b204', 'e9800998ecf8427e');
  const tok = mk('3f8a02c91823d047', 'a5');

  const input = [
    mk('DB_PASS', `WORD=${pw}`),
    mk('APP_SEC', `RET="${sec}"`),
    mk('API_TOK', `EN=${tok}`),
  ].join('\n');

  const result = redactSecrets(input);
  assert.equal(result, [
    mk('DB_PASS', `WORD=${REDACTED}`),
    mk('APP_SEC', `RET="${REDACTED}"`),
    mk('API_TOK', `EN=${REDACTED}`),
  ].join('\n'));
});

test('redactDeep masks nested objects and arrays', () => {
  const obj = {
    env: {
      TOKEN: mk('ghp_', '0123456789abcdefghijklmnopqrstuv'),
      SAFE: 'your-api-key',
    },
    args: ['--key', mk('sk-', 'ant-api03-abcdef1234567890')],
    num: 42,
  };

  const clean = redactDeep(obj);
  assert.equal(clean.env.TOKEN, REDACTED);
  assert.equal(clean.env.SAFE, 'your-api-key');
  assert.equal(clean.args[1], REDACTED);
  assert.equal(clean.num, 42);
});

test('Recorder redacts secrets when writing events and logs', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'firstrun-rec-test-'));
  const wagtailVal = mk('wagtail_', '42d87e0d6b0593457a');
  const skVal = mk('sk-', 'ant-api03-abcdef1234567890');
  try {
    const rec = new Recorder(tmp, { id: 'test-run', repo: 'wagtail/bakerydemo', commit: 'abc' });
    rec.emitEvent('runner', 'step.log', {
      command: mk('export WAGTAIL_CLI_TOK', `EN=${wagtailVal}`),
    });
    rec.writeLog('step-1', `Got token: ${wagtailVal} and key: ${skVal}`);

    const events = fs.readFileSync(path.join(tmp, 'events.ndjson'), 'utf8');
    assert.doesNotMatch(events, /wagtail_42d87e0/);
    assert.match(events, new RegExp(REDACTED));

    const log = fs.readFileSync(path.join(tmp, 'logs', 'step-1.log'), 'utf8');
    assert.doesNotMatch(log, /wagtail_42d87e0/);
    assert.doesNotMatch(log, /sk-ant-api03/);
    assert.match(log, new RegExp(REDACTED));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
