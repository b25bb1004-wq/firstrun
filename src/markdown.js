/**
 * A small Markdown reader: just enough structure to find setup sections and the
 * shell commands inside them, with line numbers so edits can be mapped back.
 */

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
  if (!SHELL_LANGS.has(block.lang)) return false;
  if (block.lang === 'text' || block.lang === '') {
    // Unlabelled blocks are often output or config; accept only if most lines look like commands.
    const ls = block.lines.map((l) => l.text.trim()).filter(Boolean);
    if (!ls.length) return false;
    const cmdish = ls.filter((l) => /^(\$ |> )?(npm|npx|yarn|pnpm|bun|node|python3?|pip3?|poetry|uv|pipenv|cp|mv|mkdir|cd|export|source|\.|docker|docker-compose|make|git|go|cargo|bundle|rails|php|composer|flask|uvicorn|gunicorn|pytest|alembic|curl|touch|echo|corepack|nvm|brew|sudo|apt|apt-get|createdb|psql)\b/.test(l)).length;
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
  return /^[{}\[\]]/.test(line)            // { } [ ]
    || /^["'][^"']*["']\s*[:,]/.test(line) // "key": … / "item",
    || /^-?\d+(\.\d+)?,?$/.test(line)      // 1,  2.5
    || /^(true|false|null),?$/.test(line)
    || /^[\w.[\]"']+\s+=\s/.test(line);    // _.foo = "bar" (shell assignments have no spaces)
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
