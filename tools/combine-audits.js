#!/usr/bin/env node
// Combine a base audit with a later re-run of some of its repos (e.g. the IBM Bob pass),
// so the site can show one honest set of numbers.
//
//   node tools/combine-audits.js audit/v2-31-final audit/v2-31-final-bob audit/v2-31-final-combined
//
// For every repo in the re-run whose verdict is a real result (not ERROR), the re-run's entry and
// run folder replace the base's. Everything else stays from the base. The summary is recomputed
// with the same summarize() the audit itself uses, and the output records where each repo came from.
import fs from 'node:fs';
import path from 'node:path';
import { summarize } from '../src/audit.js';

const [baseDir, rerunDir, outDir] = process.argv.slice(2);
if (!baseDir || !rerunDir || !outDir) {
  console.error('usage: node tools/combine-audits.js <base-audit> <rerun-audit> <out-dir>');
  process.exit(2);
}
const read = (d) => JSON.parse(fs.readFileSync(path.join(d, 'audit.json'), 'utf8'));
const base = read(baseDir);
const rerun = read(rerunDir);
const replacing = new Map(rerun.repos.filter((r) => r.verdict && r.verdict !== 'ERROR').map((r) => [r.slug, r]));

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'runs'), { recursive: true });

const repos = base.repos.map((r) => {
  const from = replacing.has(r.slug) ? rerunDir : baseDir;
  const entry = replacing.get(r.slug) || r;
  if (entry.runDir) {
    const src = path.join(from, entry.runDir);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(outDir, entry.runDir), { recursive: true });
  }
  return { ...entry, source: path.basename(from) };
});

const combined = {
  ...base,
  id: base.id, // keep the base id: the site links to its run pages; provenance is in combinedFrom
  combinedFrom: { base: path.basename(baseDir), rerun: path.basename(rerunDir), replaced: [...replacing.keys()] },
  repos,
};
combined.summary = summarize(combined);
fs.writeFileSync(path.join(outDir, 'audit.json'), JSON.stringify(combined, null, 2));
console.log(`${combined.id}: ${repos.length} repos, ${replacing.size} from ${path.basename(rerunDir)}`);
console.log(JSON.stringify(combined.summary));
