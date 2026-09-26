import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { scout } from './scout/index.js';
import { buildPlan } from './plan.js';
import { verifyRepo } from './pipeline.js';
import { fetchRepo } from './audit.js';
import { staticDrift } from './drift.js';
import { readJson } from './util.js';

/**
 * HUMBLE as tools for IBM Bob (Model Context Protocol, stdio). With
 * .bob/mcp.json in place, Bob's agent can plan, verify, inspect evidence and
 * guard against drift without leaving the IDE.
 */
const runs = new Map(); // runId → { dir, promise, done }

const text = (t) => ({ content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] });

async function resolveRepo(repo) {
  if (/^https?:\/\/|^git@/.test(repo)) return fetchRepo(repo);
  return path.resolve(repo);
}

function runDir(idOrDir) {
  if (runs.has(idOrDir)) return runs.get(idOrDir).dir;
  if (fs.existsSync(path.join(idOrDir, 'run.json'))) return idOrDir;
  if (fs.existsSync(path.join(idOrDir, '.firstrun', 'run.json'))) return path.join(idOrDir, '.firstrun');
  return null;
}

function summarize(dir) {
  const st = readJson(path.join(dir, 'run.json'));
  if (!st) return null;
  const plan = st.plan;
  return {
    id: st.id, repo: st.repo, phase: st.phase, error: st.error,
    steps: plan?.steps?.map((s) => ({ id: s.id, command: s.command, status: st.steps[s.id]?.status || s.status, origin: s.origin, skip: s.skip })),
    evidence: st.evidence.map((id) => {
      const e = readJson(path.join(dir, 'evidence', `${id}.json`));
      return e && { id, step: e.stepId, class: e.diagnosis.class, cause: e.diagnosis.cause, by: e.diagnosis.by, fix: e.fix?.doc?.text, status: e.status };
    }),
    conflicts: st.conflicts,
    replay: st.replay,
    passport: st.passport,
    report: st.passport ? path.join(dir, 'out', 'FIRSTRUN.md') : undefined,
  };
}

export async function startMcp() {
  const server = new McpServer({ name: 'firstrun', version: '0.1.0' });

  server.registerTool('firstrun_plan', {
    title: 'Plan a first run',
    description: 'Read a repository\'s setup docs next to its manifests, CI and compose files. Returns the ordered setup plan a newcomer would follow and every docs-vs-code conflict. Fast (seconds), no Docker.',
    inputSchema: { repo: z.string().describe('Local path or GitHub URL') },
  }, async ({ repo }) => {
    const root = await resolveRepo(repo);
    const plan = buildPlan(await scout(root));
    return text({ image: plan.image, runtime: plan.runtime, verify: plan.verify, steps: plan.steps.map(({ id, command, kind, skip, source }) => ({ id, command, kind, skip, from: `${source.file}:${source.line}` })), conflicts: plan.conflicts });
  });

  server.registerTool('firstrun_verify', {
    title: 'Verify setup from a clean machine',
    description: 'Follow the setup docs in a clean container, repair failures with evidence, replay from zero and write a corrected README + Setup Passport. Takes minutes: returns a runId immediately; poll firstrun_status.',
    inputSchema: {
      repo: z.string().describe('Local path or GitHub URL'),
      brain: z.enum(['auto', 'rules', 'bob']).optional().describe('auto = rules first, IBM Bob for unknown failures'),
      bobBudget: z.number().optional().describe('Max Bobcoins this run may spend (default 3)'),
    },
  }, async ({ repo, brain = 'auto', bobBudget = 3 }) => {
    const root = await resolveRepo(repo);
    const dir = path.join(root, '.firstrun');
    const id = `mcp-${Date.now().toString(36)}`;
    const entry = { dir, done: false };
    entry.promise = verifyRepo(root, { brain, bobBudget, id }).then((r) => { entry.done = true; entry.result = r; });
    runs.set(id, entry);
    return text({ runId: id, dir, next: 'Call firstrun_status with this runId every 20-30 seconds.' });
  });

  server.registerTool('firstrun_status', {
    title: 'Run status',
    description: 'Current phase, per-step status, evidence records and (when finished) the Setup Passport of a HUMBLE run.',
    inputSchema: { run: z.string().describe('runId from firstrun_verify, or a repo path / .firstrun directory') },
  }, async ({ run }) => {
    const dir = runDir(run);
    if (!dir) return text(`No HUMBLE run found for ${run}.`);
    return text({ finished: runs.get(run)?.done ?? !!readJson(path.join(dir, 'run.json'))?.finishedAt, ...summarize(dir) });
  });

  server.registerTool('firstrun_evidence', {
    title: 'Evidence record',
    description: 'One evidence record: the failing command and output, the diagnosis (rules or IBM Bob), the fix, and the passing output.',
    inputSchema: { run: z.string(), id: z.string().describe('Evidence id, e.g. E2') },
  }, async ({ run, id }) => {
    const dir = runDir(run);
    const e = dir && readJson(path.join(dir, 'evidence', `${id}.json`));
    return text(e || `No evidence ${id}.`);
  });

  server.registerTool('firstrun_guide', {
    title: 'Verified setup for a newcomer',
    description: 'The verified setup steps with expected results and known failure signatures, for walking a newcomer through setup on their own machine.',
    inputSchema: { repo: z.string().describe('Local repo path') },
  }, async ({ repo }) => {
    const root = path.resolve(repo);
    const guide = [path.join(root, '.bob', 'rules-firstrun-guide', 'verified-setup.md'), path.join(root, '.firstrun', 'out', 'pr', '.bob', 'rules-firstrun-guide', 'verified-setup.md')].find((f) => fs.existsSync(f));
    return text(guide ? fs.readFileSync(guide, 'utf8') : 'This repo has not been verified yet. Run firstrun_verify first.');
  });

  server.registerTool('firstrun_drift', {
    title: 'Setup drift check',
    description: 'Docs-vs-code conflicts introduced between a base ref and HEAD (what a PR would break for newcomers). No Docker.',
    inputSchema: { repo: z.string(), base: z.string().describe('Base ref, e.g. origin/main') },
  }, async ({ repo, base }) => {
    const d = await staticDrift(path.resolve(repo), base);
    return text({ introduced: d.introduced, resolved: d.resolved, changedFiles: d.changed });
  });

  await server.connect(new StdioServerTransport());
}
