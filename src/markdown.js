/**
 * A small Markdown reader: just enough structure to find setup sections and the
 * shell commands inside them, with line numbers so edits can be mapped back.
 */

// First words of a shell command, shared by unlabelled fences and inline list items.
const CMD_START = /^(\$ |> )?(npm|npx|yarn|pnpm|bun|node|python3?|pip3?|poetry|uv|pipenv|cp|mv|mkdir|cd|export|source|\.|docker|docker-compose|make|git|go|cargo|bundle|rails|php|composer|flask|uvicorn|gunicorn|pytest|alembic|curl|touch|echo|corepack|nvm|brew|sudo|apt|apt-get|createdb|psql)\b/;
// A setup step written as a list item: "- `npm install` to install deps", "2. Run `npm start`".
const LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s+(?:(?:then\s+)?(?:run|execute|type|use)\s*:?\s+)?`([^`]+)`/i;

const PLAIN_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s+([^`\s][^`]*?)\s*$/;
const CODE_LINE = /^(\s*)`([^`]+)`\s*$/;
// The whole text is one command: words, flags, paths, urls; no sentence words ("npm install to get deps" is prose).
const COMMAND_ONLY = /^(?!.*\s(to|the|and|then|for|with|if|you|your|will|should)\s)[\w$.\/@:=+~"'<>{}\[\]-]+(\s+[\w$.\/@:=+~"'<>{}\[\]&|;-]+){0,10}$/i;

const SHELL_LANGS = new Set(['', 'bash', 'sh', 'shell', 'zsh', 'console', 'shell-session', 'shellsession', 'terminal', 'cli', 'text', 'fish']);

export function parseMarkdown(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const headings = [];
  const blocks = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = line.match(/^(\s*)(`{3,}|~{3,})\s*([\w+-]*)?(.*)$/);
    if (fence) {
      if (fm && fm[2][0] === fence.marker[0] && fm[2].length >= fence.marker.length && !fm[3] && !fm[4].trim()) {
        fence.end = i;
        blocks.push(fence);
        fence = null;
      } else {
        fence.lines.push({ text: line.slice(Math.min(fence.indent, line.length - line.trimStart().length)), line: i });
      }
      continue;
    }
    if (fm) {
      fence = { start: i, end: -1, marker: fm[2], lang: (fm[3] || '').toLowerCase(), indent: fm[1].length, lines: [] };
      continue;
    }
    const li = line.match(LIST_ITEM);
    if (li && CMD_START.test(li[2].trim())) {
      // One-line pseudo block; the scribe edits inside the backticks so the list item keeps its prose.
      blocks.push({ start: i, end: i, lang: 'inline', inline: true, indent: li[1].length, code: li[2], lines: [{ text: li[2].trim(), line: i }] });
      continue;
    }
    // Rule factory (27 Sep): the same step with no backticks at all ("2. npm install", webpack-express-boilerplate), or a
    // line that is only a code span ("`git clone …`"). Only when the whole item is a command, never prose.
    const plain = line.match(PLAIN_ITEM) || line.match(CODE_LINE);
    if (plain && CMD_START.test(plain[2].trim()) && COMMAND_ONLY.test(plain[2].trim())) {
      blocks.push({ start: i, end: i, lang: 'inline', inline: true, plain: !line.includes('`'), indent: plain[1].length, code: plain[2], lines: [{ text: plain[2].trim(), line: i }] });
      continue;
    }
    const hm = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (hm) headings.push({ level: hm[1].length, text: stripInline(hm[2]), line: i });
    else if (i + 1 < lines.length && line.trim() && /^(=+|-+)\s*$/.test(lines[i + 1]) && !/^\s*[-*]/.test(line)) {
      headings.push({ level: lines[i + 1][0] === '=' ? 1 : 2, text: stripInline(line.trim()), line: i });
    }
  }
  // Each heading's section runs until the next heading of the same or higher level.
  const sections = headings.map((h, idx) => {
    let end = lines.length - 1;
    for (let j = idx + 1; j < headings.length; j++) {
      if (headings[j].level <= h.level) { end = headings[j].line - 1; break; }
    }
    const next = headings[idx + 1];
    return { ...h, end, bodyEnd: next ? next.line - 1 : lines.length - 1 };
  });
  for (const b of blocks) b.section = sectionAt(sections, b.start);
  return { lines, headings, sections, blocks };
}

function stripInline(s) {
  return s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '').trim();
}

export function sectionAt(sections, line) {
  let best = null;
  for (const s of sections) if (s.line <= line && line <= s.end && (!best || s.level >= best.level)) best = s;
  return best;
}

/** Path of section headings from the top, e.g. ["Getting started", "Database"]. */
export function sectionPath(sections, line) {
  return sections.filter((s) => s.line <= line && line <= s.end).sort((a, b) => a.level - b.level).map((s) => s.text);
}

export function isShellBlock(block) {
  if (block.inline) return true; // only list items whose code starts with a known command become blocks
  if (!SHELL_LANGS.has(block.lang)) return false;
  if (block.lang === 'text' || block.lang === '') {
    // Unlabelled blocks are often output or config; accept only if most lines look like commands.
    const ls = block.lines.map((l) => l.text.trim()).filter(Boolean);
    if (!ls.length) return false;
    const cmdish = ls.filter((l) => CMD_START.test(l)).length;
    return cmdish / ls.length >= 0.6;
  }
  return true;
}

/**
 * Turn a shell block into commands: strips prompts, joins backslash
 * continuations, drops comments and output lines in prompt-style blocks.
 */
/** Lines that cannot be a shell command: JSON/YAML fragments, bare values, `name = value` with spaces. */
function looksLikeOutput(line) {
  return /^[{}\]]/.test(line)              // { } ]
    || /^\[\s*$|^\[\s*["\d{]|^\[\[(?!\s)/.test(line) // [ alone or before a JSON value; "[ -f" / "[[ -d" are shell tests
    || /^["'][^"']*["']\s*[:,]/.test(line) // "key": … / "item",
    || /^-?\d+(\.\d+)?,?$/.test(line)      // 1,  2.5
    || /^(true|false|null),?$/.test(line)
    || /^[\w.[\]"']+\s+=\s/.test(line)     // _.foo = "bar" (shell assignments have no spaces)
    || /^[A-Z][a-z]+(\s+[^\s=]+){2,}/.test(line); // "App is running ...", "Press CTRL + C to stop": prose, commands start lowercase
}

export function blockCommands(block) {
  const raw = block.lines;
  const nonEmpty = raw.filter((l) => l.text.trim() && !l.text.trim().startsWith('#'));
  // "> cmd" is a prompt only when every line uses it (otherwise it's a redirect or quote).
  const gtPrompts = nonEmpty.length > 0 && nonEmpty.every((l) => /^\s*>\s+\S/.test(l.text));
  const hasPrompts = gtPrompts || raw.some((l) => /^\s*[$%]\s+\S/.test(l.text));
  const cmds = [];
  let acc = null;
  for (const { text, line } of raw) {
    let t = text.replace(/\s+$/, '');
    if (acc) {
      acc.text += ' ' + t.trim().replace(/\\$/, '').trim();
      acc.endLine = line;
      if (!/\\$/.test(t)) { cmds.push(acc); acc = null; }
      continue;
    }
    const trimmed = t.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    let body = trimmed;
    if (hasPrompts) {
      const m = trimmed.match(gtPrompts ? /^>\s+(.*)$/ : /^[$%]\s+(.*)$/);
      if (!m) continue; // output line
      body = m[1];
    } else if (/^[$%]\s+/.test(body)) body = body.replace(/^[$%]\s+/, '');
    else if (looksLikeOutput(body)) continue; // sample output pasted under the command, no prompt to tell them apart
    body = body.replace(/\s+#\s.*$/, '').replace(/\s*;\s*$/, ''); // trailing comment, stray semicolon
    if (/\\$/.test(body)) { acc = { text: body.replace(/\\$/, '').trim(), line, endLine: line }; continue; }
    cmds.push({ text: body, line, endLine: line });
  }
  if (acc) cmds.push(acc);
  return cmds;
}
