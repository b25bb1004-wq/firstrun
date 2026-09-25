#!/usr/bin/env node
// Who is working on what, and what has gone stale. Run it when you start, when you come back from
// a usage limit, and before taking over someone else's work (see "Recovery mode" in CLAUDE.md).
//   node tools/handoff.js [--stale-minutes 45]
import { execFileSync } from 'node:child_process';

const i = process.argv.indexOf('--stale-minutes');
const STALE_MIN = i > 0 ? Number(process.argv[i + 1]) : 45;
const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
const ago = (iso) => Math.round((Date.now() - Date.parse(iso)) / 60000);
const fmt = (m) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`);
const laneOf = (labels) => (labels.find((l) => l.name.startsWith('lane:'))?.name.slice(5)) || '-';

const issues = gh(['issue', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,labels,assignees,updatedAt']);
const prs = gh(['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,headRefName,author,updatedAt,reviewDecision,isDraft']);

console.log(`Open PRs (${prs.length})`);
for (const p of prs.sort((a, b) => a.number - b.number)) {
  const m = ago(p.updatedAt);
  console.log(`  #${p.number} ${m >= STALE_MIN ? 'STALE ' : ''}${fmt(m)} ago · ${p.headRefName} · ${p.isDraft ? 'draft' : p.reviewDecision || 'awaiting review'}\n     ${p.title}`);
}
console.log(`\nOpen issues (${issues.length})`);
for (const it of issues.sort((a, b) => a.number - b.number)) {
  const m = ago(it.updatedAt);
  const who = it.assignees.map((a) => a.login).join(',') || 'unassigned';
  const stale = it.assignees.length && m >= STALE_MIN;
  console.log(`  #${it.number} ${stale ? 'STALE ' : ''}[${laneOf(it.labels)}] ${who} · ${fmt(m)} ago\n     ${it.title}`);
}
const stale = [...issues.filter((x) => x.assignees.length), ...prs].filter((x) => ago(x.updatedAt) >= STALE_MIN);
console.log(stale.length
  ? `\n${stale.length} item(s) untouched for ${STALE_MIN}+ minutes. If their owner is offline, announce in chat and take over (CLAUDE.md → Recovery mode).`
  : `\nNothing stale (threshold ${STALE_MIN} minutes).`);
