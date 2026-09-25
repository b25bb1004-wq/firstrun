#!/usr/bin/env node
// Check bob_sessions/ before committing: every task has an .md export and a .png consumption
// summary with the same name, and no exported .md contains something that looks like a credential.
//   node tools/check-bob-sessions.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bob_sessions');
const SECRET = [
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'API key (sk-…)'],
  [/\bnvapi-[A-Za-z0-9_-]{20,}/, 'NVIDIA API key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/[MN][A-Za-z\d_-]{23,25}\.[\w-]{6}\.[\w-]{27,}/, 'Discord bot token'],
  [/\b(?:BOB|IBM|IAM|WATSONX)[_A-Z]*(?:KEY|TOKEN|SECRET|APIKEY)\s*[:=]\s*\S{8,}/i, 'IBM/Bob credential'],
  [/\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*["']?[A-Za-z0-9_\-./+]{16,}/i, 'key/secret assignment'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
];

let problems = 0, tasks = 0;
const people = fs.existsSync(DIR) ? fs.readdirSync(DIR, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
if (!people.length) console.log('No member folders yet (bob_sessions/<name>/). See bob_sessions/README.md.');
for (const p of people) {
  const files = fs.readdirSync(path.join(DIR, p.name));
  const base = (f) => f.replace(/\.(md|png|jpe?g)$/i, '');
  const names = [...new Set(files.filter((f) => /\.(md|png|jpe?g)$/i.test(f)).map(base))].sort();
  console.log(`\n${p.name}/ (${names.length} task${names.length === 1 ? '' : 's'})`);
  for (const n of names) {
    tasks++;
    const md = files.find((f) => f === `${n}.md`);
    const img = files.find((f) => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(png|jpe?g)$`, 'i').test(f));
    const issues = [];
    if (!md) issues.push('missing .md export');
    if (!img) issues.push('missing consumption-summary screenshot');
    if (md) {
      const text = fs.readFileSync(path.join(DIR, p.name, md), 'utf8');
      for (const [re, what] of SECRET) if (re.test(text)) issues.push(`possible ${what}: remove it before committing`);
    }
    problems += issues.length;
    console.log(`  ${issues.length ? '✗' : '✓'} ${n}${issues.length ? `: ${issues.join('; ')}` : ''}`);
  }
}
console.log(`\n${tasks} task(s), ${problems} problem(s). Screenshots aren't scanned: check them by eye.`);
process.exit(problems ? 1 : 0);
