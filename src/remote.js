// Instant check for a public GitHub repository: download the tarball, read docs and manifests,
// and build the newcomer's plan with docs-vs-code conflicts. Nothing from the repo is executed,
// so this is safe to run on a shared host (the hosted demo's /api/check uses it).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as tar from 'tar';
import { scout, summarizeFacts } from './scout/index.js';
import { buildPlan } from './plan.js';

const MAX_BYTES = 40 * 1024 * 1024;
const SKIP_DIRS = /(^|\/)(node_modules|\.git|vendor|dist|build|\.next|coverage|__pycache__|\.venv|venv)(\/|$)/;

/** "owner/repo", "github.com/owner/repo", "https://github.com/owner/repo(.git)(/tree/<ref>)" → { owner, name, ref } */
export function parseGithubRepo(input) {
  const s = String(input || '').trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})(?:\/tree\/([A-Za-z0-9._\/-]{1,200}))?$/);
  if (!m || m[2] === '.' || m[2] === '..') return null;
  return { owner: m[1], name: m[2], ref: m[3] || null };
}

export class CheckError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function download(owner, name, ref, dir) {
  const url = `https://codeload.github.com/${owner}/${name}/tar.gz/${ref ? encodeURIComponent(ref).replace(/%2F/g, '/') : 'HEAD'}`;
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'firstrun-check' } });
  if (res.status === 404) throw new CheckError(404, `${owner}/${name}${ref ? `@${ref}` : ''} was not found, or it is private. HUMBLE's hosted check reads public repositories only.`);
  if (!res.ok) throw new CheckError(502, `GitHub returned ${res.status} for ${owner}/${name}.`);
  if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) throw new CheckError(413, 'This repository is too large for the hosted check. Run `firstrun plan` locally instead.');

  let bytes = 0;
  let top = null;
  const cap = new Transform({
    transform(chunk, _enc, cb) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) return cb(new CheckError(413, 'This repository is too large for the hosted check. Run `firstrun plan` locally instead.'));
      cb(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(res.body),
    cap,
    tar.x({
      cwd: dir,
      strip: 1,
      filter: (p, entry) => {
        if (!top) top = entry.comment || p.split('/')[0];
        if (entry.type === 'SymbolicLink' || entry.type === 'Link') return false;
        return !SKIP_DIRS.test(p.split('/').slice(1).join('/'));
      },
    }),
  );
  // git archive stores the commit id in the pax global header's comment.
  const commit = (/^[0-9a-f]{40}$/.test(top || '') ? top.slice(0, 10) : null) || ref || 'HEAD';
  return { commit, bytes };
}

export async function checkGithubRepo(input) {
  const gh = parseGithubRepo(input);
  if (!gh) throw new CheckError(400, 'Paste a public GitHub repository, like expressjs/express or https://github.com/owner/repo.');
  const t0 = Date.now();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firstrun-check-'));
  try {
    const { commit, bytes } = await download(gh.owner, gh.name, gh.ref, dir);
    const t1 = Date.now();
    const facts = await scout(dir);
    const repo = `${gh.owner}/${gh.name}`;
    const plan = buildPlan(facts, { repo, commit });
    return {
      repo, ref: gh.ref, commit,
      url: `https://github.com/${repo}${gh.ref ? `/tree/${gh.ref}` : ''}`,
      downloadMs: t1 - t0, analyzeMs: Date.now() - t1, bytes,
      facts: { ...summarizeFacts(facts), extraDocs: facts.extraDocs || [], files: facts.files.length },
      plan: {
        image: plan.image, runtime: plan.runtime, verify: plan.verify, docsUsed: plan.docsUsed,
        conflicts: plan.conflicts,
        steps: plan.steps.map(({ id, command, kind, skip, source }) => ({ id, command, kind, skip: skip || null, source })),
      },
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
