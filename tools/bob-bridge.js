#!/usr/bin/env node
// IBM Bob in the team Discord channel. A human on the allowlist writes `!bob <question>`; the bridge asks
// Bob Shell headlessly in read-only Ask mode on this repo and posts the answer as "IBM Bob" (a channel
// webhook; falls back to the chat bot with a label). Capped per question and per day, in Bobcoins.
//
//   BOB_API_KEY=… node tools/bob-bridge.js     (key from the environment only; .env holds the Discord token)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, '.firstrun-chat', 'bob-bridge.json');
for (const line of fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const { DISCORD_BOT_TOKEN: TOKEN, DISCORD_CHANNEL_ID: CHANNEL } = process.env;
if (!TOKEN || !CHANNEL) { console.error('DISCORD_BOT_TOKEN / DISCORD_CHANNEL_ID missing in .env'); process.exit(1); }
if (!process.env.BOB_API_KEY) { console.error('BOB_API_KEY is not set in the environment'); process.exit(1); }

const ALLOW = new Set(['1533378769635643432', '1506517975837184116']); // Arnav, Karmanya: only humans spend Bobcoins
const PER_QUESTION = 0.5, PER_DAY = 3;
const SECRET = /bob_prod_|nvapi-|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|sk-(ant-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|[MN][A-Za-z0-9_-]{23,25}\.[A-Za-z0-9_-]{6}\.|BEGIN [A-Z ]*PRIVATE KEY/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = (() => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } })();
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2));

async function api(method, route, body, auth = `Bot ${TOKEN}`) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(`https://discord.com/api/v10${route}`, { method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    if (res.status === 429) { await sleep(((await res.json()).retry_after || 1) * 1000); continue; }
    if (!res.ok) throw new Error(`${method} ${route}: ${res.status}`);
    return res.status === 204 ? null : res.json();
  }
}

async function webhook() {
  if (state.webhook) return state.webhook;
  try {
    const hooks = await api('GET', `/channels/${CHANNEL}/webhooks`);
    const w = hooks.find((h) => h.name === 'IBM Bob') || await api('POST', `/channels/${CHANNEL}/webhooks`, { name: 'IBM Bob' });
    state.webhook = { id: w.id, token: w.token }; save();
    return state.webhook;
  } catch { return null; } // no Manage Webhooks permission: post as the chat bot instead
}

async function post(text, replyTo) {
  const content = text.length > 1900 ? `${text.slice(0, 1900)}…` : text;
  const w = await webhook();
  if (w) return fetch(`https://discord.com/api/v10/webhooks/${w.id}/${w.token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, username: 'IBM Bob' }) });
  return api('POST', `/channels/${CHANNEL}/messages`, { content: `**IBM Bob:** ${content}`, message_reference: replyTo && { message_id: replyTo } });
}

function askBob(question) {
  const js = path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'bobshell', 'dist', 'bob.js');
  const [cmd, pre] = process.platform === 'win32' && fs.existsSync(js) ? [process.execPath, [js]] : ['bob', []];
  const args = [...pre, 'run', '--format', 'json', '--mode', 'ask', '--max-cost', String(PER_QUESTION), '--max-turns', '8', '--accept-license', '--trust', '--disable-subagents', '-w', ROOT, question];
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: ROOT, env: process.env });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    const t = setTimeout(() => p.kill(), 5 * 60_000);
    p.on('close', () => {
      clearTimeout(t);
      let result = null;
      for (const l of out.split(/\r?\n/)) { try { const o = JSON.parse(l); if (o.type === 'result') result = o; } catch {} }
      const text = typeof result?.last_message === 'string' ? result.last_message : result ? JSON.stringify(result.last_message) : null;
      resolve({ text, cost: Number(result?.stats?.session_costs) || 0 });
    });
  });
}

async function main() {
  const latest = await api('GET', `/channels/${CHANNEL}/messages?limit=1`);
  let after = state.after || latest[0]?.id; // start from now, never replay old questions
  console.log('IBM Bob bridge listening for "!bob <question>"');
  for (;;) {
    const msgs = (await api('GET', `/channels/${CHANNEL}/messages?after=${after}&limit=50`)).reverse();
    for (const m of msgs) {
      after = state.after = m.id; save();
      const q = m.content.match(/^!bob\s+([\s\S]+)/i)?.[1]?.trim();
      if (!q || m.author.bot || !ALLOW.has(m.author.id)) continue;
      const day = new Date().toISOString().slice(0, 10);
      if (state.day !== day) { state.day = day; state.spent = 0; }
      if (state.spent + PER_QUESTION > PER_DAY) { await post(`Daily Bob budget (${PER_DAY} Bobcoins) is used up; back tomorrow.`, m.id); continue; }
      const { text, cost } = await askBob(`A teammate asks in the team chat (answer in under 250 words, plain text, read-only: do not edit files or run commands): ${q}`);
      state.spent += cost; save();
      console.log(`answered ${m.id} for ${cost.toFixed(3)} Bobcoins (today ${state.spent.toFixed(2)})`);
      if (!text) await post('Bob did not answer this one (timeout or error).', m.id);
      else if (SECRET.test(text)) await post('Bob\'s answer looked like it contained a credential, so it was not posted.', m.id);
      else await post(`${text}\n-# ${cost.toFixed(2)} Bobcoins`, m.id);
    }
    await sleep(5000);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
