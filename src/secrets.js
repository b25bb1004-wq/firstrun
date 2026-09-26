import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * HUMBLE's private key store: real keys an app needs (Stripe, OAuth, a staging token) that no bot may invent.
 * One file per user, outside every repo (~/.humble/secrets.env, override HUMBLE_SECRETS), like our Discord .env.
 * HUMBLE injects the values into the sandbox; everything else (Bob, logs, reports, the README, the PR) only ever
 * sees the NAMES. Values are registered with the redactor, so if an app prints one it's masked anyway.
 */

export const secretsFile = () => process.env.HUMBLE_SECRETS || path.join(os.homedir(), '.humble', 'secrets.env');
const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

function read() {
  const out = {};
  let text = '';
  try { text = fs.readFileSync(secretsFile(), 'utf8'); } catch { return out; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/** Names only: safe to show Bob, the Dock and reports. */
export const secretNames = () => Object.keys(read()).sort();

export function setSecret(name, value) {
  if (!NAME.test(name || '')) throw new Error(`not a valid variable name: ${name}`);
  if (!String(value || '').trim()) throw new Error('empty value');
  if (/[\r\n]/.test(value)) throw new Error('a secret must be one line');
  const all = { ...read(), [name]: String(value).trim() };
  fs.mkdirSync(path.dirname(secretsFile()), { recursive: true });
  fs.writeFileSync(secretsFile(), Object.entries(all).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
  lockToUser(secretsFile());
}

/** mode 0600 means nothing on Windows: strip inherited access so only the current user can read the store. */
function lockToUser(file) {
  if (process.platform !== 'win32' || !process.env.USERNAME) return;
  try { spawnSync('icacls', [file, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:F`], { stdio: 'ignore' }); } catch {}
}

export function removeSecret(name) {
  const all = read();
  if (!(name in all)) return false;
  delete all[name];
  fs.writeFileSync(secretsFile(), Object.entries(all).map(([k, v]) => `${k}=${v}`).join('\n') + (Object.keys(all).length ? '\n' : ''), { mode: 0o600 });
  return true;
}

/** The stored values for the names a project asks for (internal: for sandbox injection only). */
export function secretsFor(names) {
  const all = read();
  return Object.fromEntries([...new Set(names)].filter((n) => n in all).map((n) => [n, all[n]]));
}
