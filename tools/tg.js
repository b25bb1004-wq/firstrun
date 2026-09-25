#!/usr/bin/env node
// Team chat for the humans and their Claude Code agents, over a Telegram group.
// Each agent has its own bot (token in .env, never committed). Needs, in @BotFather:
// Bot-to-Bot Communication Mode ON, Group Privacy OFF; and the bot must be a group admin.
//
//   node tools/tg.js setup              find the group's chat id after you post in it
//   node tools/tg.js send "text"        post to the group (or pipe text on stdin)
//   node tools/tg.js inbox              print new messages since last read, mark them read
//   node tools/tg.js wait [--timeout 1800]
//                                       block until someone else posts, print, exit 0 (exit 2 on timeout)
//
// .env:  TELEGRAM_BOT_TOKEN=…   TELEGRAM_CHAT_ID=…   AGENT_NAME=arnav-claude
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, '.firstrun-tg');
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

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const NAME = process.env.AGENT_NAME || 'claude';
const die = (msg, code = 1) => { console.error(msg); process.exit(code); };
if (!TOKEN) die('TELEGRAM_BOT_TOKEN is missing. Put it in .env (gitignored), never in a committed file.');

async function api(method, params = {}) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(`${method}: ${data.description || res.status}`);
  return data.result;
}

const offsetFile = path.join(STATE, 'offset');
const readOffset = () => { try { return Number(fs.readFileSync(offsetFile, 'utf8')) || 0; } catch { return 0; } };
const saveOffset = (n) => fs.writeFileSync(offsetFile, String(n));

let me = null;
async function self() { return (me ??= await api('getMe')); }

function format(m) {
  const who = m.from?.is_bot ? `🤖 ${m.from.username}` : `👤 ${[m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || m.from?.username || 'someone'}`;
  const when = new Date(m.date * 1000).toISOString().replace('T', ' ').slice(0, 16);
  const reply = m.reply_to_message ? ` (replying to #${m.reply_to_message.message_id})` : '';
  return `#${m.message_id} ${when} UTC ${who}${reply}:\n${m.text || m.caption || '[non-text message]'}`;
}

/** New messages in our group from anyone but this bot. Advances the offset. */
async function poll(timeout) {
  const bot = await self();
  const updates = await api('getUpdates', { offset: readOffset(), timeout, allowed_updates: ['message', 'channel_post'] });
  if (updates.length) saveOffset(updates[updates.length - 1].update_id + 1);
  return updates
    .map((u) => u.message || u.channel_post)
    .filter((m) => m && (!CHAT || String(m.chat.id) === String(CHAT)) && m.from?.id !== bot.id);
}

async function send(text) {
  if (!CHAT) die('TELEGRAM_CHAT_ID is missing. Run `node tools/tg.js setup` after posting in the group.');
  if (/\b\d{8,10}:[A-Za-z0-9_-]{30,}\b|BOB_API_KEY|sk-[A-Za-z0-9]{20,}/.test(text)) die('Refusing to send: the message looks like it contains a credential.');
  const body = `[${NAME}] ${text}`;
  for (let i = 0; i < body.length; i += 4000) {
    const m = await api('sendMessage', { chat_id: CHAT, text: body.slice(i, i + 4000), disable_web_page_preview: true });
    if (i === 0) console.log(`sent #${m.message_id}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name, def) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : def; };

try {
  if (cmd === 'setup') {
    const bot = await self();
    console.log(`Bot: @${bot.username} (${bot.first_name})`);
    const updates = await api('getUpdates', { timeout: 0 });
    const chats = new Map();
    for (const u of updates) { const m = u.message || u.channel_post || u.my_chat_member; if (m?.chat) chats.set(m.chat.id, `${m.chat.title || m.chat.username || m.chat.first_name} (${m.chat.type})`); }
    if (!chats.size) console.log('No chats seen yet. Add the bot to the group as an admin, post any message there, then run setup again.');
    for (const [id, name] of chats) console.log(`TELEGRAM_CHAT_ID=${id}   # ${name}`);
  } else if (cmd === 'send') {
    let text = rest.filter((a) => !a.startsWith('--')).join(' ');
    if (!text && !process.stdin.isTTY) text = fs.readFileSync(0, 'utf8');
    if (!text.trim()) die('Nothing to send.');
    await send(text.trim());
  } else if (cmd === 'inbox') {
    const msgs = await poll(0);
    console.log(msgs.length ? msgs.map(format).join('\n\n') : 'No new messages.');
  } else if (cmd === 'wait') {
    const deadline = Date.now() + Number(flag('timeout', 1800)) * 1000;
    while (Date.now() < deadline) {
      const msgs = await poll(Math.min(50, Math.max(1, Math.round((deadline - Date.now()) / 1000))));
      if (msgs.length) { console.log(msgs.map(format).join('\n\n')); process.exit(0); }
    }
    console.log('No messages before the timeout.');
    process.exit(2);
  } else {
    console.log('usage: node tools/tg.js setup | send "text" | inbox | wait [--timeout 1800]');
  }
} catch (e) {
  die(`telegram: ${e.message}`);
}
