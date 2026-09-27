// Report for the IBM Bob pass: pre (rules-only audit) vs post (--brain auto rerun), per repo, with who fixed what.
// Every number comes from the two audits' run folders; Bobcoins are the sum of every real Bob call in the events
// (including calls in runs that were restarted), not the per-process budget counters.
//   node tools/bob-pass-report.mjs <pre-audit-dir> <post-audit-dir>
import fs from 'node:fs';
import path from 'node:path';

const [pre, post] = process.argv.slice(2);
const read = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'audit.json'), 'utf8'));
const events = (dir, slug) => {
  const f = path.join(dir, 'runs', slug, 'events.ndjson');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
};
const preBy = Object.fromEntries(read(pre).repos.map((r) => [r.slug, r]));
const rows = [];
let coins = 0, calls = 0, callsFailed = 0;
for (const r of read(post).repos) {
  const ev = events(post, r.slug);
  const bob = ev.filter((e) => e.type === 'bob');
  const c = bob.reduce((s, e) => s + (Number(e.data?.bobcoins) || 0), 0);
  coins += c; calls += bob.length; callsFailed += bob.filter((e) => e.data?.ok === false).length;
  // Fixes that were proven (verified evidence), split by who diagnosed them.
  const verified = ev.filter((e) => e.type === 'evidence' && e.data?.status === 'verified');
  const byBob = verified.filter((e) => e.data?.diagnosis?.by === 'bob').length;
  const byRules = verified.filter((e) => e.data?.diagnosis?.by === 'rules').length;
  const reviews = bob.filter((e) => e.data?.review).length;
  const p = r.passport || {};
  const before = preBy[r.slug]?.verdict || '?';
  const after = r.verdict || r.status;
  rows.push({ slug: r.slug, before, after, found: p.breaksFound ?? '-', fixed: p.breaksFixed ?? '-', byBob, byRules, calls: bob.length, reviews, coins: c,
    moved: before !== after ? (after === 'VERIFIED' ? 'up' : 'changed') : 'same' });
}
const up = rows.filter((r) => r.after === 'VERIFIED' && r.before !== 'VERIFIED');
console.log('# IBM Bob pass: report\n');
console.log(`Repos rerun: ${rows.length} · moved to VERIFIED: ${up.length} · Bob calls: ${calls} (${callsFailed} gave no usable answer) · Bobcoins spent: ${coins.toFixed(2)}\n`);
console.log('| Repo | Before (rules only) | After (with Bob) | Breaks fixed | Fixes diagnosed by Bob / rules | Bob calls (plan reviews) | Bobcoins |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.slug} | ${r.before} | ${r.after === 'VERIFIED' && r.before !== 'VERIFIED' ? '**VERIFIED**' : r.after} | ${r.fixed}/${r.found} | ${r.byBob} / ${r.byRules} | ${r.calls} (${r.reviews}) | ${r.coins.toFixed(2)} |`);
console.log('\nA fix counts only when it was replayed from zero (verified evidence). "Diagnosed by Bob" means IBM Bob named the cause and the fix; the replay proved it.');
