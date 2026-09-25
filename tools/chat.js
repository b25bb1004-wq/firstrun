#!/usr/bin/env node
// Team chat for the humans and their Claude Code agents, over one Discord channel.
// Each agent has its own Discord bot (token in .env, never committed). In the Developer Portal:
// Bot → Message Content Intent ON. Invite the bot to your server with the Read/Send Messages
// and Read Message History permissions.
//
//   node tools/chat.js setup              list channels the bot can see (pick DISCORD_CHANNEL_ID)
//   node tools/chat.js send "text"        post to the channel (or pipe text on stdin)
//   node tools/chat.js inbox              print new messages since last read, mark them read
//   node tools/chat.js wait [--timeout 1800]
//                                         block until someone else posts, print, exit 0 (exit 2 on timeout)
//
// .env:  DISCORD_BOT_TOKEN=…   DISCORD_CHANNEL_ID=…
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, '.firstrun-chat');
fs.mkdirSync(STATE, { recursive: true });

function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv();

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL = process.env.DISCORD_CHANNEL_ID;
const die = (msg, code = 1) => { console.error(msg); process.exit(code); };
if (!TOKEN) die('DISCORD_BOT_TOKEN is missing. Put it in .env (gitignored), never in a committed file.');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, route, body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://discord.com/api/v10${route}`, {
      method,
      headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'FirstRunChat (https://github.com, 0.1)' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) { const d = await res.json().catch(() => ({})); await sleep(((d.retry_after || 1) * 1000) + 100); continue; }
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method} ${route}: ${data?.message || res.status}`);
    return data;
  }
  throw new Error(`${method} ${route}: rate limited`);
}

const lastFile = path.join(STATE, 'last');
const readLast = () => { try { return fs.readFileSync(lastFile, 'utf8').trim() || null; } catch { return null; } };
const saveLast = (id) => fs.writeFileSync(lastFile, id);

let me = null;
const self = async () => (me ??= await api('GET', '/users/@me'));

function format(m) {
  const who = m.author.bot ? `🤖 ${m.author.username}` : `👤 ${m.author.global_name || m.author.username}`;
  const when = m.timestamp.replace('T', ' ').slice(0, 16);
  const reply = m.referenced_message ? ` (replying to ${m.referenced_message.id})` : '';
  const files = (m.attachments || []).map((a) => `\n[attachment] ${a.filename} ${a.url}`).join('');
  return `${m.id} ${when} UTC ${who}${reply}:\n${m.content || (files ? '' : '[no text]')}${files}`;
}

/** New messages from anyone but this bot, oldest first. Advances the read marker. */
async function poll() {
  if (!CHANNEL) die('DISCORD_CHANNEL_ID is missing. Run `node tools/chat.js setup`.');
  const bot = await self();
  let after = readLast();
  if (!after) {
    // First run: start from now rather than replaying history.
    const latest = await api('GET', `/channels/${CHANNEL}/messages?limit=1`);
    saveLast(latest[0]?.id || '0');
    return [];
  }
  const out = [];
  for (;;) {
    const batch = await api('GET', `/channels/${CHANNEL}/messages?after=${after}&limit=100`);
    if (!batch.length) break;
    batch.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
    after = batch[batch.length - 1].id;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  if (out.length) saveLast(after);
  return out.filter((m) => m.author.id !== bot.id);
}

async function send(text) {
  if (!CHANNEL) die('DISCORD_CHANNEL_ID is missing. Run `node tools/chat.js setup`.');
  if (/[MN][A-Za-z\d_-]{23,25}\.[\w-]{6}\.[\w-]{27,}|BOB_API_KEY|sk-(ant-)?[A-Za-z0-9_-]{20,}/.test(text)) die('Refusing to send: the message looks like it contains a credential.');
  const body = text; // the bot's own name (Friday, Edith) already shows who is speaking
  for (let i = 0; i < body.length; i += 1900) {
    const m = await api('POST', `/channels/${CHANNEL}/messages`, { content: body.slice(i, i + 1900), allowed_mentions: { parse: [] } });
    if (i === 0) console.log(`sent ${m.id}`);
  }
}

/** Hold a gateway connection so the bot shows as online ("Listening to the team") while waiting. Best effort. */
function showOnline() {
  if (typeof WebSocket === 'undefined') return;
  let seq = null, beat = null;
  try {
    const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
    ws.onmessage = (e) => {
      let p; try { p = JSON.parse(e.data); } catch { return; }
      if (p.s != null) seq = p.s;
      if (p.op === 10) {
        beat = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ op: 1, d: seq })), p.d.heartbeat_interval);
        ws.send(JSON.stringify({ op: 2, d: {
          token: TOKEN, intents: 0,
          properties: { os: process.platform, browser: 'firstrun-chat', device: 'firstrun-chat' },
          presence: { status: 'online', since: null, afk: false, activities: [{ name: 'the team', type: 2 }] },
        } }));
      }
      if (p.op === 1 && ws.readyState === 1) ws.send(JSON.stringify({ op: 1, d: seq }));
    };
    ws.onclose = () => clearInterval(beat);
    ws.onerror = () => {};
  } catch {}
}

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, def) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : def; };

try {
  if (cmd === 'setup') {
    const bot = await self();
    console.log(`Bot: ${bot.username} (id ${bot.id})`);
    const guilds = await api('GET', '/users/@me/guilds');
    if (!guilds.length) console.log('The bot is in no server yet. Invite it with the OAuth2 URL Generator (scope: bot).');
    for (const g of guilds) {
      console.log(`\nServer: ${g.name}`);
      const channels = await api('GET', `/guilds/${g.id}/channels`);
      for (const c of channels.filter((c) => c.type === 0)) console.log(`  DISCORD_CHANNEL_ID=${c.id}   # #${c.name}`);
    }
  } else if (cmd === 'send') {
    let text = rest.filter((a) => !a.startsWith('--')).join(' ');
    if (!text && !process.stdin.isTTY) text = fs.readFileSync(0, 'utf8');
    if (!text.trim()) die('Nothing to send.');
    await send(text.trim());
  } else if (cmd === 'inbox') {
    const msgs = await poll();
    console.log(msgs.length ? msgs.map(format).join('\n\n') : 'No new messages.');
  } else if (cmd === 'wait') {
    const deadline = Date.now() + Number(flag('timeout', 1800)) * 1000;
    showOnline();
    // Messages that arrived while nobody was waiting are delivered right away.
    for (let first = true; Date.now() < deadline; first = false) {
      if (!first) await sleep(4000);
      const msgs = await poll();
      if (msgs.length) { console.log(msgs.map(format).join('\n\n')); process.exit(0); }
    }
    console.log('No messages before the timeout.');
    process.exit(2);
  } else {
    console.log('usage: node tools/chat.js setup | send "text" | inbox | wait [--timeout 1800]');
  }
} catch (e) {
  die(`discord: ${e.message}`);
}
