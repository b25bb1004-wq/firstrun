import path from 'node:path';
import { parseMarkdown, isShellBlock, blockCommands, sectionPath } from './markdown.js';
import { readText } from './util.js';
import { ciFindings, ciPlanSteps } from './ci-reference.js';

/** Parse reStructuredText and extract shell commands with line numbers and section headings.
 * Supports:
 * - Code blocks: .. code-block:: bash|sh|shell|console|text
 * - Indented blocks after a paragraph ending in ::
 * - RST headings: title line followed by = - ~ ^ line of same length
 */
function parseRST(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const headings = [];
  const blocks = [];
  let i = 0;
  
  // First pass: find all headings (RST style)
  while (i < lines.length) {
    const line = lines[i];
    // Check for RST heading: a line followed by a line of = - ~ ^ of same length
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const trimmed = line.trim();
      const nextTrimmed = nextLine.trim();
      if (trimmed && nextTrimmed && /^[=\-~^]+$/.test(nextTrimmed) && nextTrimmed.length === trimmed.length) {
        const level = nextTrimmed[0] === '=' ? 1 : nextTrimmed[0] === '-' ? 2 : nextTrimmed[0] === '~' ? 3 : 4;
        headings.push({ level, text: trimmed, line: i });
        i += 2;
        continue;
      }
    }
    i++;
  }
  
  // Second pass: find code blocks
  i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Check for .. code-block:: directive
    const codeBlockMatch = line.match(/^\s*\.\.\s+code-block::\s*(bash|sh|shell|console)?\s*$/i);
    if (codeBlockMatch) {
      const lang = (codeBlockMatch[1] || '').toLowerCase();
      const startLine = i;
      i++;
      // Skip blank lines after the directive
      while (i < lines.length && lines[i].trim() === '') i++;
      // Get the indentation of the first content line
      let baseIndent = null;
      const codeLines = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === '') {
          codeLines.push({ text: '', line: i });
          i++;
          continue;
        }
        const indent = l.length - l.trimStart().length;
        if (baseIndent === null) {
          baseIndent = indent;
        }
        if (indent < baseIndent && l.trim() !== '') {
          // End of code block (less indented non-empty line)
          break;
        }
        codeLines.push({ text: l.slice(baseIndent), line: i });
        i++;
      }
      blocks.push({
        start: startLine,
        end: i - 1,
        lang: lang,
        lines: codeLines
      });
      continue;
    }
    
    // Check for :: at end of paragraph (literal block)
    if (line.trim().endsWith('::') && !line.trim().startsWith('..')) {
      const startLine = i;
      i++;
      // Skip blank lines
      while (i < lines.length && lines[i].trim() === '') i++;
      // Get indentation
      let baseIndent = null;
      const codeLines = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === '') {
          codeLines.push({ text: '', line: i });
          i++;
          continue;
        }
        const indent = l.length - l.trimStart().length;
        if (baseIndent === null) {
          baseIndent = indent;
        }
        if (indent < baseIndent && l.trim() !== '') {
          break;
        }
        codeLines.push({ text: l.slice(baseIndent), line: i });
        i++;
      }
      if (codeLines.length > 0) {
        blocks.push({
          start: startLine,
          end: i - 1,
          lang: 'literal',
          lines: codeLines
        });
      }
      continue;
    }
    
    i++;
  }
  
  // Compute section ranges (each heading runs until next same-or-higher level)
  const sections = headings.map((h, idx) => {
    let end = lines.length - 1;
    for (let j = idx + 1; j < headings.length; j++) {
      if (headings[j].level <= h.level) { end = headings[j].line - 1; break; }
    }
    const next = headings[idx + 1];
    return { ...h, end, bodyEnd: next ? next.line - 1 : lines.length - 1 };
  });
  
  // Assign each block to its section
  for (const b of blocks) {
    let best = null;
    for (const s of sections) {
      if (s.line <= b.start && b.start <= s.end && (!best || s.level >= best.level)) {
        best = s;
      }
    }
    b.section = best;
  }
  
  return { lines, headings, sections, blocks };
}

/** Check if a block is a shell block (language is bash, sh, shell, console, or literal blocks with prompts) */
function isRSTShellBlock(block) {
  const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'console']);
  if (SHELL_LANGS.has(block.lang)) return true;
  // For literal blocks, check if they have any prompted lines
  if (block.lang === 'literal') {
    return block.lines.some((l) => /^\s*[\$>]\s+\S/.test(l.text));
  }
  return false;
}

/** Get section path for a line number */
function rstSectionPath(sections, line) {
  return sections.filter((s) => s.line <= line && line <= s.end).sort((a, b) => a.level - b.level).map((s) => s.text);
}

/** Extract commands from an RST block (similar to blockCommands but for RST) */
function rstBlockCommands(block) {
  const raw = block.lines;
  const nonEmpty = raw.filter((l) => l.text.trim() && !l.text.trim().startsWith('#'));
  
  // For literal blocks, only take lines that start with a shell prompt
  if (block.lang === 'literal') {
    const promptedLines = raw.filter((l) => /^\s*[\$>]\s+\S/.test(l.text));
    if (promptedLines.length === 0) return [];
    return promptedLines.map(({ text, line }) => {
      const m = text.trim().match(/^[\$>]\s+(.*)$/);
      return { text: m ? m[1].trim() : text.trim(), line, endLine: line };
    });
  }
  
  // For code-block:: bash|sh|shell|console, process normally (all lines are commands)
  const gtPrompts = nonEmpty.length > 0 && nonEmpty.every((l) => /^\s*>\s+\S/.test(l.text));
  const hasPrompts = gtPrompts || raw.some((l) => /^\s*[\$%]\s+\S/.test(l.text));
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
      const m = trimmed.match(gtPrompts ? /^>\s+(.*)$/ : /^[\$%]\s+(.*)$/);
      if (!m) continue;
      body = m[1];
    } else if (/^[\$%]\s+/.test(body)) body = body.replace(/^[\$%]\s+/, '');
    body = body.replace(/\s+#\s.*$/, '').replace(/\s*;\s*$/, '');
    if (/\\$/.test(body)) { acc = { text: body.replace(/\\$/, '').trim(), line, endLine: line }; continue; }
    cmds.push({ text: body, line, endLine: line });
  }
  if (acc) cmds.push(acc);
  return cmds;
}

export { parseRST, isRSTShellBlock, rstSectionPath, rstBlockCommands };

const SETUP_HEADING = /(getting[\s-]*started|install|set[\s-]*up|quick[\s-]*start|develop|local(ly)?\b|run(ning)?\b|how to (run|use|start)|usage|build(ing)?\b|prereq|requirement|database|configur|environment|\btests?\b|testing|contribut|start(ing)?\b|hacking|bootstrap)/i;
const EXCLUDED_HEADING = /(deploy|production|kubernetes|\bk8s\b|helm|heroku|vercel|netlify|render\.com|fly\.io|release|publish|licen[cs]e|faq|troubleshoot|changelog|api reference|endpoints?\b|screenshots?|roadmap|acknowledg|credits|sponsor|macos only|upgrad|migrating from|benchmark)/i;
// "Windows" sections are skipped, but "Pip (macOS, linux, unix, Windows)" applies to Linux too.
const excludedHeading = (h) => EXCLUDED_HEADING.test(h) || (/\bwindows\b/i.test(h) && !/\b(linux|unix|all platforms)\b/i.test(h));
const DOCKER_ALT_HEADING =/(docker|container|compose|devcontainer|codespace|gitpod|vagrant)/i;

export const DEFAULT_NODE = '22';
export const DEFAULT_PYTHON = '3.12';

export function imageFor(runtime, version) {
  if (runtime === 'node') return `node:${version}`;
  if (runtime === 'python') return `python:${version}`;
  return 'buildpack-deps:bookworm';
}

const SERVE_RE = /^(?:(?:npm|pnpm|bun)\s+(?:run\s+)?(?:start|dev|serve|develop|watch)(?::[\w:-]+)?|yarn\s+(?:run\s+)?(?:start|dev|serve|develop|watch)(?::[\w:-]+)?|npx\s+(?:next|vite|nodemon|ts-node|tsx)\b(?!.*\bbuild\b)|node\s+\S+\.(?:m?js|cjs)(?!\S)|nodemon\b|next\s+dev|vite(?:\s|$)(?!.*build)|python3?\s+(?:-m\s+)?(?:\S+\.py|flask|uvicorn|http\.server|manage\.py\s+runserver)|flask\s+(?:--app\s+\S+\s+)?run|uvicorn\s|gunicorn\s|hypercorn\s|streamlit\s+run|fastapi\s+(?:dev|run)|poetry\s+run\s+(?:python\s+\S+\.py|uvicorn|flask|gunicorn|python\s+manage\.py\s+runserver)|uv\s+run\s+(?:uvicorn|flask|python\s+\S+\.py|fastapi)|pipenv\s+run\s+(?:python|flask|uvicorn)|rails\s+s|make\s+(?:run|dev|serve|start))/i;
const TEST_RE = /^(?:node\s+--test\b|(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test(?::[\w:-]+)?\b|npx\s+(?:jest|vitest|mocha|playwright\s+test)|(?:python3?\s+-m\s+)?pytest\b|poetry\s+run\s+pytest|uv\s+run\s+pytest|tox\b|nox\b|(?:python3?\s+)?(?:\.\/)?manage\.py\s+test|make\s+test|go\s+test)/i;

export function classify(cmd, facts) {
  // "DEBUG=app:* npm run devstart" is still "npm run devstart"
  const c = cmd.trim().replace(/^sudo\s+/, '').replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '');
  const ctx = {};

  // ── 1. NON-COMMANDS ─────────────────────────────────────────────────────
  // Skip version/output lines (1.50.0, 40-char hex hash, x64)
  if (/^(\d+\.\d+\.\d+|[a-f0-9]{40}|x64|arm64|amd64)$/i.test(c)) {
    return { kind: 'other', skip: 'not a command (output, prompt or config shown in the docs)' };
  }
  // Skip lines starting with prompt characters
  if (/^[»❯$#>]\s/.test(c)) {
    return { kind: 'other', skip: 'not a command (output, prompt or config shown in the docs)' };
  }
  // Skip key=value config lines with a dot in the key (sonar.login=abc)
  if (/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*=\S+$/.test(c)) {
    return { kind: 'other', skip: 'not a command (output, prompt or config shown in the docs)' };
  }
  // Skip prose with square brackets (cd ~/dev [or your preferred dev directory])
  // Only brackets holding an instruction to the reader: `pip install -e ".[dev]"` and `[ -f .env ] || cp …` are real commands.
  // `[optional]` is not in the list: `mkdir myapp [optional]` is a command with an optional argument.
  if (/\[\s*(?:or|your|e\.g\.|i\.e\.|replace|choose|if)\b[^\]]*\]/i.test(c)) {
    return { kind: 'other', skip: 'not a command (output, prompt or config shown in the docs)' };
  }

  // ── 2. PLATFORM ──────────────────────────────────────────────────────────
  // Skip macOS-only lines
  // /Applications/ or a .app bundle ANYWHERE in the line (fastify: `mkdir -p /Applications/VSCodeFastify/…`,
  // `alias code-fastify="/Applications/…/Visual Studio Code.app/Contents/…"`), ~/Library/, xattr, brew.
  if (/\/Applications\//.test(c) || /^xattr\b/.test(c) || /\.app(\/|\s|["']|$)/.test(c) || /^brew\s+/.test(c) || /~\/Library\//.test(c)) {
    return { kind: 'prereq', skip: 'macOS-only command' };
  }

  if (/^git\s+clone\b/.test(c)) return { kind: 'other', skip: 'git clone: HUMBLE starts from a fresh clone already' };
  if (/<[a-z][\w -]*>|\*[a-z_]+\*|\bYOUR[_-]|\byour[-_](?:name|key|token|password|email)/i.test(c) && !/^(export|echo)\b/.test(c)) return { kind: 'other', skip: 'needs a value only you have (placeholder)' };
  if (/\b(user-?name|your-?(?:user|org|name)|owner|org)\/(repo|repository|project)\b|(^|\s)\/?path\/to\//i.test(c)) return { kind: 'other', skip: 'needs a value only you have (placeholder)' };
  if (/(~|\$HOME)\/Downloads\b|(^|\s)Downloads\//.test(c)) return { kind: 'other', skip: 'uses a file you download by hand first' };
  if (/^(docker(-compose|\s+compose)\s+logs|tail\s+-[fF]\b|journalctl\b|kubectl\s+logs)/.test(c)) return { kind: 'other', skip: 'follows logs; not a setup step' };
  if (/>>?\s*~?\/?\S*\.(bashrc|zshrc|bash_profile|profile|config\/fish\S*)\b|^set\s+fish_\w+/.test(c)) return { kind: 'other', skip: 'personal shell customisation, not project setup' };
  if (/^(npm|pip3?|pipx|yarn|pnpm)\s+(uninstall|remove|rm)\b|^(poetry|npm|yarn|pnpm)\s+publish\b|^twine\s+upload\b/.test(c)) return { kind: 'other', skip: 'uninstall/publish: not part of setting up' };
  if (/^vagrant\s+(up|ssh|provision|halt)\b/.test(c)) return { kind: 'other', skip: 'VM-based alternative workflow' };
  // Self-install: "npm install koa" inside koa's own repo installs the published package, not this source.
  // A CLI tool's README install ("pip3 install jello") is the setup being tested; only libraries are skipped.
  // Adding the package as a dependency (`uv add "fastapi[standard]"`, `poetry add requests`) is always about a
  // project of yours, never this repo, even for CLIs: a package can't depend on itself.
  const norm = (n) => String(n || '').toLowerCase().replace(/[-_.]+/g, '-').split('/').pop();
  const addSelf = c.match(/^(?:uv|poetry|pdm)\s+add\s+["']?((?:@[\w.-]+\/)?[\w.-]+)(?:\[[^\]]*\])?/);
  if (addSelf && facts?.selfName && norm(addSelf[1]) === norm(facts.selfName)) return { kind: 'other', skip: 'installs the published package; you already have its source' };
  // Only skip self-install check for pip/npm/etc if this is a CLI tool (not a library).
  // CLI tool = has CLI bin AND no serve/test steps (it's a tool, not an app)
  const isCliTool = facts?.cli?.length > 0 && !facts.scripts?.test && !facts.scripts?.start;
  const selfInstallName = isCliTool ? null : facts?.selfName;
  if (selfInstallName) {
    const npmSelf = c.match(/^(?:npm\s+(?:install|i)|yarn\s+add|pnpm\s+add)\s+((?:@[\w.-]+\/)?[\w.-]+)(?:@\S+)?(?:\s|$)/);
    if (npmSelf && npmSelf[1].split('/').pop() === selfInstallName.split('/').pop()) return { kind: 'other', skip: 'installs the published package; you already have its source' };
    const pipSelf = c.match(/^(?:pip3?\s+install|python3?\s+-m\s+pip\s+install)\s+["']?([\w.-]+)(?:\[[^\]]*\])?(?:==[^\s"']+)?["']?(?:\s|$)/);
    if (pipSelf && pipSelf[1].toLowerCase().replace(/[-_]/g, '-') === selfInstallName.toLowerCase().replace(/[-_]/g, '-')) return { kind: 'other', skip: 'installs the published package; you already have its source' };
    // bun add, deno add
    const bunSelf = c.match(/^bun\s+add\s+((?:@[\w.-]+\/)?[\w.-]+)(?:@\S+)?(?:\s|$)/);
    if (bunSelf && bunSelf[1].split('/').pop() === selfInstallName.split('/').pop()) return { kind: 'other', skip: 'installs the published package; you already have its source' };
    const denoSelf = c.match(/^deno\s+add\s+(?:npm:)?((?:@[\w.-]+\/)?[\w.-]+)(?:@\S+)?(?:\s|$)/);
    if (denoSelf && denoSelf[1].split('/').pop() === selfInstallName.split('/').pop()) return { kind: 'other', skip: 'installs the published package; you already have its source' };
  }
  // Live-service tests: the script name contains ":live" or ends with "-live".
  const liveScript = c.match(/^(?:npm|yarn|pnpm)\s+(?:run\s+)?([\w:.-]+)$/);
  if (liveScript && (/:live/.test(liveScript[1]) || /-live$/.test(liveScript[1]))) return { kind: 'other', skip: 'runs against live third-party services; needs real accounts' };
  if (/^(poetry|pipenv|hatch)\s+shell\b/.test(c)) return { kind: 'env', skip: 'interactive subshell: HUMBLE activates the same environment after install', subshell: c.split(/\s+/)[0] };
  if (/^(npm|yarn|pnpm|bun|make|just|npx|poetry\s+run|uv\s+run|pipenv\s+run)\s+(run\s+)?[\w:-]*(lint|prettier|format|fmt|coverage|\bcov\b|watch|storybook|husky|pre-?commit|commitlint|release|deploy|publish|typecheck|type-check|\bmm\b|makemigrations|downgrade|rollback|docs?:)/i.test(c)
    || /^(pre-commit|eslint|prettier|black|ruff|flake8|mypy|isort|pylint)\b/.test(c)) {
    return { kind: 'other', skip: 'developer tooling, not needed to run the project' };
  }
  if (/^(brew|port|xcode-select|open)\s/.test(c) || /^open$/.test(c)) return { kind: 'prereq', skip: 'macOS-only command' };
  if (/\\Scripts\\|^set\s+\w+=|^\$env:|^copy\s|\.bat\b|\.ps1\b|^start\s+http|^(choco|winget|scoop)\s|^\.\\/i.test(c)) return { kind: 'prereq', skip: 'Windows-only command' };
  if (/^(nvm|fnm|n)\s+(install|use)\b|^(pyenv)\s+(install|local|global|shell)\b|^asdf\s+install\b|^volta\s+install\s+node/.test(c)) return { kind: 'prereq', skip: 'runtime selection: the base image provides the runtime', runtimeHint: true };
  if (/^(apt(-get)?|yum|dnf|apk|pacman)\s/.test(c)) return { kind: 'prereq' };
  if (/^(code|cursor|idea|subl|vim|nano)\s/.test(c)) return { kind: 'other', skip: 'opens an editor' };
  if (/^(curl|wget)\s+(-\w+\s+)*https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(c)) return { kind: 'test', probe: true };
  // `docker compose -f docker/docker-compose.yml up -d db` is services; `docker compose run app npm start` is not.
  if (/^docker(-compose|\s+compose)(\s+(-f|--file|-p|--project-name|--env-file|--profile)\s+\S+)*\s+(up|start)\b/.test(c)) return { kind: 'services' };
  if (/^docker\s+run\b/.test(c) && /\b(postgres|redis|mysql|mariadb|mongo|rabbitmq|elasticsearch|memcached|minio|mailhog|localstack)/i.test(c)) return { kind: 'services' };
  if (/^docker(-compose|\s+compose)?\s+(build|run|exec|push|pull|login)\b|^docker(-compose)?\s+/.test(c)) return { kind: 'other', skip: 'container-based alternative workflow' };
  if (/^(cp|mv|copy)\s+\S*\.env|^(cp|mv)\s+\S*env\S*\s|^export\s+[A-Z_]+=|^echo\s+.+>>?\s*\.env|^touch\s+\.env|^source\s+\.env|^set\s+-a/.test(c)) return { kind: 'env' };
  if (/^(source|\.)\s+\S*(venv|env)\S*\/bin\/activate|^python3?\s+-m\s+venv\b|^virtualenv\b|^(uv\s+venv)/.test(c)) return { kind: 'install' };
  if (/^(npm\s+(i|install|ci)\b|yarn(\s+install)?$|yarn\s+install\b|pnpm\s+(i|install)\b|bun\s+install\b|pip3?\s+install\b|python3?\s+-m\s+pip\s+install\b|poetry\s+install\b|uv\s+(sync|pip\s+install)\b|pipenv\s+install\b|corepack\s+enable\b|npm\s+install\s+-g\b|bundle\s+install\b|composer\s+install\b|go\s+mod\s+download\b)/.test(c)) return { kind: 'install' };
  if (/(migrat|prisma\s+(migrate|db\s+push|generate)|knex\s+migrate|sequelize(-cli)?\s+db:|alembic\s+upgrade|manage\.py\s+(migrate|makemigrations)|db:(migrate|setup|push|reset|create)|typeorm\s+migration|drizzle-kit|createdb\b|psql\b|mysql\s+-u)/i.test(c)) return { kind: 'migrate' };
  if (/(db:seed|\bseed\b|loaddata|fixtures?\b)/i.test(c)) return { kind: 'migrate' };
  // `uv run ./manage.py test`, `poetry run pytest`: the runner prefix doesn't change what the command is.
  if (TEST_RE.test(c) || TEST_RE.test(c.replace(/^(?:uv|poetry|pipenv|pdm|hatch)\s+run\s+/, ''))) return { kind: 'test' };
  // `node bin/firstrun.js plan …` runs this repo's own CLI (a package.json bin): a one-shot command, not a server.
  const nodeFile = c.match(/^node\s+(?:\.\/)?(\S+\.(?:m?js|cjs))(?:\s|$)/);
  if (nodeFile && facts?.binPaths?.includes(nodeFile[1])) return { kind: 'other', ...ctx };
  if (SERVE_RE.test(c)) return { kind: 'serve' };
  if (/^(npm|pnpm|yarn|bun)\s+(run\s+)?build\b|^make(\s+(build|all))?$|^tsc\b|^npx\s+tsc\b|^python3?\s+setup\.py\s+(build|develop)/.test(c)) return { kind: 'build' };
  return { kind: 'other', ...ctx };
}

/** Does any part of a (piped) command invoke the project's own CLI? */
function usesProjectCli(cmd, facts) {
  if (!facts.cli?.length) return false;
  return cmd.split('|').some((seg) => {
    const first = seg.trim().replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '').split(/\s+/)[0];
    return facts.cli.includes(first);
  });
}

function managerOf(cmd) {
  const m = cmd.match(/^(npm|yarn|pnpm|bun|pip3?|poetry|uv|pipenv)\b/);
  return m ? m[1].replace(/3$/, '') : null;
}

/** Runtime version the docs tell a newcomer to install.
 *  Returns { version, line, match, minimum } where minimum=true means "v7.6+" style
 *  (newcomer installs current LTS), false means an exact pin like "use Node 16". */
export function declaredRuntime(text, runtime) {
  const re = runtime === 'node'
    ? /\bnode(?:\.?js)?\s*(?:version\s*)?(?:v|>=?|≥|\^|~|at least\s*)?\s*v?(\d{1,2})(?:\.\d+){0,2}(?!\d)(\s*(?:\+|or (?:higher|later|newer|above)))?/gi
    : /\bpython\s*(?:version\s*)?(?:>=?|≥|\^|~|at least\s*)?\s*(3\.\d{1,2}|2\.7)(?:\.\d+)?(\s*(?:\+|or (?:higher|later|newer|above)))?/gi;
  for (const m of text.matchAll(re)) {
    const v = m[1];
    if (runtime === 'node' && (Number(v) < 4 || Number(v) > 30)) continue;
    const line = text.slice(0, m.index).split('\n').length;
    // A version in a HEADING is a feature note, not a setup requirement (koa: '### async functions (node v7.6+)').
    const lineText = text.split('\n')[line - 1] || '';
    const nextLine = text.split('\n')[line] || '';
    if (/^\s{0,3}#{1,6}\s/.test(lineText) || /^\s*(=+|-+)\s*$/.test(nextLine)) continue;
    // minimum: trailing "+" or "or higher/later/newer/above", or a range prefix like ">=" / "at least"
    const minimum = !!(m[2]?.trim() || /(?:>=|≥|at least\s*)\s*v?\d/.test(m[0]));
    return { version: v, line, match: m[0].trim(), minimum };
  }
  return null;
}

function lowerMajor(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0);
  }
  return false;
}

// A block is a scaffolder when it:
//  • runs npx create-* / npx express-generator / yarn create / pnpm create / cookiecutter / degit
//  • globally installs a *-generator or create-* package (npm/yarn/pnpm -g)
// NOT a scaffolder: `npm init -y` / `npm init --yes` (no package name → just writes package.json)
const SCAFFOLDER_RE = /^(?:npx\s+(?:create-\S+|express-generator\b)|yarn\s+create\b|pnpm\s+create\b|cookiecutter\b|degit\b|(?:npm\s+(?:install|i)\s+(?:-g\s+|--global\s+)|npm\s+i\s+-g\s+|yarn\s+global\s+add\s+|pnpm\s+add\s+-g\s+)(?:@[\w.-]+\/)?(?:[\w.-]+-generator\b|create-[\w.-]+\b))/i;
// npm init <name> (scaffolds) but NOT npm init -y / --yes (just writes package.json)
const NPM_INIT_SCAFFOLDER_RE = /^npm\s+init\s+(?!-y\b|--yes\b)(\S)/i;

/** Build the ordered setup plan from the docs, as a newcomer would read them. */
export function buildPlan(facts, { repo, commit } = {}) {
  const conflicts = [];
  const notes = []; // facts worth telling the reader that aren't docs-vs-code drift
  const steps = [];
  const seen = new Set();
  let runtimeHint = false;

  // Resolve the project's own published name for self-install detection.
  // Node: package.json "name"; Python: pyproject.toml [project] name, [tool.poetry] name, or setup.cfg metadata name.
  let selfName = facts.node?.name || null;
  if (!selfName && facts.python) {
    const pyp = readText(path.join(facts.root, 'pyproject.toml')) || '';
    const projName = (pyp.match(/^\s*\[project\][\s\S]*?^name\s*=\s*["']?([A-Za-z0-9_.-]+)/m) || pyp.match(/^\s*\[tool\.poetry\][\s\S]*?^name\s*=\s*["']([^"']+)["']/m) || [])[1];
    const cfgName = projName ? null : (() => {
      const cfg = readText(path.join(facts.root, 'setup.cfg')) || '';
      return (cfg.match(/^\s*\[metadata\][\s\S]*?^name\s*=\s*([A-Za-z0-9_.-]+)/m) || [])[1];
    })();
    selfName = projName || cfgName || null;
  }

  // Minimal wrapper passed to classify() — avoids mutating facts.
  const classifyFacts = { ...facts, selfName };

  const docsUsed = [];
  for (const docFile of facts.docs) {
    const text = readText(path.join(facts.root, docFile));
    if (!text || !/\.(md|markdown)$/i.test(docFile) && !/^readme$/i.test(docFile)) continue;
    const md = parseMarkdown(text);
    const shellBlocks = md.blocks.filter(isShellBlock);
    const inSetup = (b) => {
      const p = sectionPath(md.sections, b.start);
      if (p.some(excludedHeading)) return false;
      return p.some((h) => SETUP_HEADING.test(h));
    };
    let chosen = shellBlocks.filter(inSetup);
    // Drop "run it with Docker" sections when a non-Docker path exists.
    const nonDocker = chosen.filter((b) => !sectionPath(md.sections, b.start).some((h) => DOCKER_ALT_HEADING.test(h)));
    if (nonDocker.length) chosen = nonDocker;
    if (!chosen.length && docFile === facts.docs[0]) {
      chosen = shellBlocks.filter((b) => !sectionPath(md.sections, b.start).some(excludedHeading));
    }
    const before = steps.filter((s) => !s.skip).length;
    // A section that scaffolds a new app for users is skipped as a whole: express splits its quick start
    // over several blocks (`npm install -g express-generator`, then `express /tmp/foo`, `cd /tmp/foo`, …).
    const isScaffold = (c) => { const t = c.text.trim().replace(/^sudo\s+/, ''); return SCAFFOLDER_RE.test(t) || NPM_INIT_SCAFFOLDER_RE.test(t); };
    const scaffoldSections = new Set(chosen.filter((b) => blockCommands(b).some(isScaffold)).map((b) => sectionPath(md.sections, b.start).join(' › ')));
    for (const b of chosen) {
      const cmds = blockCommands(b);
      if (scaffoldSections.has(sectionPath(md.sections, b.start).join(' › '))) {
        for (const c of cmds) {
          for (const rawPart of splitAnd(c.text)) {
            steps.push({ id: '', command: rawPart, kind: 'other', skip: 'scaffolds a new app for users; not this repo\'s setup', source: { file: docFile, line: c.line + 1, endLine: c.endLine + 1, section: sectionPath(md.sections, b.start).join(' › ') }, origin: 'readme' });
          }
        }
        continue;
      }
      const managers = new Set();
      // A block that runs the project's own CLI is a usage example as a whole ("cat values.yaml | jello …").
      const usageBlock = cmds.some((c) => classify(c.text, classifyFacts).kind !== 'install' && usesProjectCli(c.text, facts));
      for (const c of cmds) {
        for (const rawPart of splitAnd(c.text)) {
          // "--env local|dev|prod" documents choices; a newcomer picks the first.
          const part = rawPart.replace(/(^|[\s=])([\w.-]+)((?:\|[\w.-]+)+)(?=\s|$)/g, '$1$2');
          const cls = classify(part, classifyFacts);
          if (cls.runtimeHint) runtimeHint = true;
          const step = {
            id: '',
            command: part,
            kind: cls.kind,
            source: { file: docFile, line: c.line + 1, endLine: c.endLine + 1, section: sectionPath(md.sections, b.start).join(' › ') },
            origin: 'readme',
          };
          if (cls.skip) step.skip = cls.skip;
          // Lines calling the CLI are usage; in a usage block, so are plain helpers like "cat values.yaml".
          else if (step.kind !== 'install' && (usesProjectCli(part, facts) || (usageBlock && step.kind === 'other'))) step.usage = true;
          if (cls.subshell) step.subshell = cls.subshell;
          if (rawPart !== part) step.docCommand = rawPart;
          if (cls.probe) step.probe = true;
          // Alternatives such as "npm install" / "yarn" listed together: keep the project's manager.
          const mgr = managerOf(part);
          if (step.kind === 'install' && mgr && ['npm', 'yarn', 'pnpm', 'bun'].includes(mgr)) {
            if (managers.size && !managers.has(mgr)) {
              const preferred = facts.node?.packageManager;
              if (mgr !== preferred) step.skip = `alternative package manager (project uses ${preferred})`;
            }
            managers.add(mgr);
          }
          if (/^cd\s+(\S+)$/.test(part)) {
            const target = part.slice(3).trim().replace(/\/$/, '');
            const repoName = (repo || '').split('/').pop()?.replace(/\.git$/, '');
            const prevClone = steps.length && /^git\s+clone/.test(steps[steps.length - 1].command);
            if (prevClone || (repoName && target.toLowerCase() === repoName.toLowerCase()) || !facts.files.some((f) => f.startsWith(`${target}/`))) {
              if (prevClone || (repoName && target.toLowerCase() === repoName.toLowerCase())) step.skip = 'cd into the clone: already there';
            }
          }
          const key = `${step.command}@@${docFile === facts.docs[0] ? '' : docFile}`;
          if (seen.has(step.command) && !step.skip && docFile !== facts.docs[0]) continue; // CONTRIBUTING repeating the README
          seen.add(step.command);
          void key;
          steps.push(step);
        }
      }
    }
    if (steps.filter((s) => !s.skip).length > before) docsUsed.push(docFile);
    // Only fall through to CONTRIBUTING/docs when the README has fewer than 2 real steps.
    if (docFile === facts.docs[0] && steps.filter((s) => !s.skip).length >= 2) break;
  }

  // Also process RST docs (facts.docsRst) for reStructuredText setup guides
  for (const docFile of facts.docsRst) {
    const text = readText(path.join(facts.root, docFile));
    if (!text) continue;
    const rst = parseRST(text);
    const shellBlocks = rst.blocks.filter(isRSTShellBlock);
    const inSetup = (b) => {
      const p = rstSectionPath(rst.sections, b.start);
      if (p.some(excludedHeading)) return false;
      return p.some((h) => SETUP_HEADING.test(h));
    };
    let chosen = shellBlocks.filter(inSetup);
    // Drop "run it with Docker" sections when a non-Docker path exists.
    const nonDocker = chosen.filter((b) => !rstSectionPath(rst.sections, b.start).some((h) => DOCKER_ALT_HEADING.test(h)));
    if (nonDocker.length) chosen = nonDocker;
    if (!chosen.length && docFile === facts.docsRst[0] && facts.docs.length === 0) {
      chosen = shellBlocks.filter((b) => !rstSectionPath(rst.sections, b.start).some(excludedHeading));
    }
    const before = steps.filter((s) => !s.skip).length;
    const isScaffold = (c) => { const t = c.text.trim().replace(/^sudo\s+/, ''); return SCAFFOLDER_RE.test(t) || NPM_INIT_SCAFFOLDER_RE.test(t); };
    const scaffoldSections = new Set(chosen.filter((b) => rstBlockCommands(b).some(isScaffold)).map((b) => rstSectionPath(rst.sections, b.start).join(' › ')));
    for (const b of chosen) {
      const cmds = rstBlockCommands(b);
      if (scaffoldSections.has(rstSectionPath(rst.sections, b.start).join(' › '))) {
        for (const c of cmds) {
          for (const rawPart of splitAnd(c.text)) {
            steps.push({ id: '', command: rawPart, kind: 'other', skip: 'scaffolds a new app for users; not this repo\'s setup', source: { file: docFile, line: c.line + 1, endLine: c.endLine + 1, section: rstSectionPath(rst.sections, b.start).join(' › ') }, origin: 'readme' });
          }
        }
        continue;
      }
      const managers = new Set();
      const usageBlock = cmds.some((c) => classify(c.text, classifyFacts).kind !== 'install' && usesProjectCli(c.text, facts));
      for (const c of cmds) {
        for (const rawPart of splitAnd(c.text)) {
          const part = rawPart.replace(/(^|[\s=])([\w.-]+)((?:\|[\w.-]+)+)(?=\s|$)/g, '$1$2');
          const cls = classify(part, classifyFacts);
          if (cls.runtimeHint) runtimeHint = true;
          const step = {
            id: '',
            command: part,
            kind: cls.kind,
            source: { file: docFile, line: c.line + 1, endLine: c.endLine + 1, section: rstSectionPath(rst.sections, b.start).join(' › ') },
            origin: 'readme',
          };
          if (cls.skip) step.skip = cls.skip;
          else if (step.kind !== 'install' && (usesProjectCli(part, facts) || (usageBlock && step.kind === 'other'))) step.usage = true;
          if (cls.subshell) step.subshell = cls.subshell;
          if (rawPart !== part) step.docCommand = rawPart;
          if (cls.probe) step.probe = true;
          const mgr = managerOf(part);
          if (step.kind === 'install' && mgr && ['npm', 'yarn', 'pnpm', 'bun'].includes(mgr)) {
            if (managers.size && !managers.has(mgr)) {
              const preferred = facts.node?.packageManager;
              if (mgr !== preferred) step.skip = `alternative package manager (project uses ${preferred})`;
            }
            managers.add(mgr);
          }
          if (/^cd\s+(\S+)$/.test(part)) {
            const target = part.slice(3).trim().replace(/\/$/, '');
            const repoName = (repo || '').split('/').pop()?.replace(/\.git$/, '');
            const prevClone = steps.length && /^git\s+clone/.test(steps[steps.length - 1].command);
            if (prevClone || (repoName && target.toLowerCase() === repoName.toLowerCase()) || !facts.files.some((f) => f.startsWith(`${target}/`))) {
              if (prevClone || (repoName && target.toLowerCase() === repoName.toLowerCase())) step.skip = 'cd into the clone: already there';
            }
          }
          if (seen.has(step.command) && !step.skip) continue;
          seen.add(step.command);
          steps.push(step);
        }
      }
    }
    if (steps.filter((s) => !s.skip).length > before) docsUsed.push(docFile);
  }

  // ── CI FALLBACK ──
  // When the docs give no runnable steps at all (every docs step skipped or none),
  // but CI has a tested Linux job, plan that job's setup steps from CI.
  // Only for repos that HAVE docs files (README, CONTRIBUTING, etc.) but no runnable steps.
  // Repos with NO docs files (like koajs/koa) use the existing library/CLI contributor path logic.
  const hasDocsFiles = (facts.docs?.length || 0) + (facts.docsRst?.length || 0) > 0;
  const hasRunnableDocSteps = steps.some((s) => !s.skip && s.origin === 'readme');
  if (hasDocsFiles && !hasRunnableDocSteps) {
    const ciSteps = ciPlanSteps(facts, classify, classifyFacts);
    if (ciSteps && ciSteps.length) {
      // Add CI steps with origin 'ci'
      for (const cs of ciSteps) {
        steps.push({ id: '', ...cs });
      }
      // Mark the plan as from CI
      // (we'll add this to the returned object below)
    }
  }

  // Order: tests after the app is running, keep everything else in doc order.
  const serveIdx = steps.findIndex((s) => s.kind === 'serve' && !s.skip);
  if (serveIdx >= 0) {
    const early = steps.filter((s, i) => s.kind === 'test' && !s.probe && i < serveIdx);
    for (const t of early) { steps.splice(steps.indexOf(t), 1); steps.push(t); }
  }
  // Only the last serve step stays; earlier serve alternatives ("npm start" vs "npm run dev") are skipped.
  const serves = steps.filter((s) => s.kind === 'serve' && !s.skip);
  for (const s of serves.slice(0, -1)) {
    const later = serves[serves.length - 1];
    if (s.source.line !== later.source.line) s.skip = `alternative start command (using "${later.command}")`;
  }
  // "poetry shell" / "pipenv shell" drop the reader into the project's virtualenv; emulate it
  // non-interactively right after the matching install step.
  for (const sub of steps.filter((s) => s.subshell)) {
    const tool = sub.subshell;
    const install = steps.find((s) => !s.skip && new RegExp(`^${tool}\\s+(install|sync)\\b`).test(s.command));
    const activate = tool === 'poetry' ? 'source "$(poetry env info --path)/bin/activate"' : tool === 'pipenv' ? 'source "$(pipenv --venv)/bin/activate"' : 'source "$(hatch env find)/bin/activate"';
    const synthetic = { id: '', command: activate, kind: 'env', source: { ...sub.source }, origin: 'readme', synthetic: `emulates \`${sub.command}\`` };
    steps.splice(install ? steps.indexOf(install) + 1 : steps.indexOf(sub) + 1, 0, synthetic);
  }
  // A CLI tool is set up once its command runs; its usage examples need the reader's own input.
  // Apps that ship a CLI *and* use it for setup ("acme migrate") keep those steps.
  const cli = facts.cli?.[0];
  const cliTool = cli && !steps.some((s) => !s.skip && !s.usage && (s.kind === 'serve' || s.kind === 'test'));
  for (const s of steps.filter((x) => x.usage)) {
    delete s.usage;
    if (cliTool) s.skip = 'usage example: runs the tool on your own input once it is installed';
  }
  if (cliTool) {
    const lastInstall = steps.map((s) => !s.skip && s.kind === 'install').lastIndexOf(true);
    if (lastInstall >= 0) {
      // For Node projects, the CLI bin may not be on PATH after a local install; run it via node directly.
      let probeCmd = `${cli} --help`;
      if (facts.stack === 'node') {
        try {
          const pkg = JSON.parse(readText(path.join(facts.root, 'package.json')) || '{}');
          const binEntry = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin && pkg.bin[cli]);
          if (binEntry) probeCmd = `node ${binEntry} --help`;
        } catch {}
      }
      steps.splice(lastInstall + 1, 0, { id: '', command: probeCmd, kind: 'test', probe: true, source: { ...steps[lastInstall].source }, origin: 'readme', synthetic: `checks that the installed \`${cli}\` command runs` });
    }
  }
  // Skip installing the published package only when the docs also install this source (koa: `npm install`).
  // When pip's is the only install they give (requests: `pip install requests`), that is the setup to test.
  // npm refuses to install a package inside itself, so `npm install koa` stays skipped (the Doctor adds `npm install`).
  const SELF = 'installs the published package; you already have its source';
  // Only re-enable pip self-install for NON-library/CLI projects
  if (!steps.some((s) => !s.skip && s.kind === 'install')) {
    // Use the same library/CLI detection as below
    const isLib = (() => {
      // Check Node library
      if (facts.node?.name) {
        const repoName = (repo || '').split('/').pop()?.replace(/\.git$/, '');
        if (repoName) {
          const pkgName = facts.node.name.split('/').pop();
          if (pkgName === repoName) return true;
        }
      }
      // Check Python library (pyproject.toml name matches repo)
      if (facts.python && facts.python.pyproject) {
        const repoName = (repo || '').split('/').pop()?.replace(/\.git$/, '');
        if (repoName && selfName === repoName) return true;
      }
      return false;
    })();
    // CLI tools are NOT libraries - their README install IS the setup
    const isCli = facts.cli?.length > 0 && !steps.some((s) => s.kind === 'serve' || s.kind === 'test');
    const isLibOrCli = isLib || isCli;
    if (!isLibOrCli) {
      for (const s of steps.filter((x) => x.skip === SELF && /^(pip3?|python3?\s+-m\s+pip)\b/.test(x.command))) { delete s.skip; s.kind = 'install'; }
    }
  }

  // ── 3. AUDIENCE ─────────────────────────────────────────────────────────────
  // If the repo is a LIBRARY or CLI (package name equals repo name, no app to start),
  // skip user-install lines of that same package for ANY manager.
  // Then make sure contributor path is planned (from CONTRIBUTING or CI workflows).
  function isLibraryOrCli(facts) {
    const repoName = (repo || '').split('/').pop()?.replace(/\.git$/, '');
    if (!repoName) return false;
    // A Django app with a package.json for its frontend (wagtail/bakerydemo) is an app, not a library.
    if (readText(path.join(facts.root, 'manage.py')) != null || steps.some((s) => /(^|\s|\/)manage\.py\s/.test(s.command))) return false;
    // A Node repo that starts (scripts.start) and exports nothing (no main/exports) is an app, even when its package
    // name equals the repo name (madhums/node-express-mongoose regressed VERIFIED → PARTIAL on a CI test otherwise).
    try {
      const pkg = JSON.parse(readText(path.join(facts.root, facts.projectDir || '', 'package.json')) || 'null');
      if (pkg && pkg.scripts?.start && !pkg.main && !pkg.exports) return false;
    } catch {}
    // Library: its published name (package.json, or pyproject/setup.cfg for Python) matches the repo name.
    // BUT NOT if it's a CLI tool (has CLI bin and no serve/start/test scripts in package.json).
    const n = (x) => String(x || '').toLowerCase().replace(/[-_.]+/g, '-').split('/').pop();
    const hasNodeServeScript = facts.node?.scripts && (facts.node.scripts.start || facts.node.scripts.serve || facts.node.scripts.dev || facts.node.scripts.test);
    // For Python: check pyproject.toml [project.scripts] for entry points
    let hasPythonServeScript = false;
    if (facts.python?.pyproject) {
      try {
        const pyp = readText(path.join(facts.root, 'pyproject.toml'));
        // Check for [project.scripts] section - if it has entries that look like serve/test/start
        const scriptsSection = pyp.match(/\[project\.scripts\]([\s\S]*?)(?=\n\[)/);
        if (scriptsSection) {
          const lines = scriptsSection[1].split('\n');
          for (const line of lines) {
            const m = line.match(/^\s*(\w+)\s*=/);
            if (m) {
              const name = m[1];
              if (/^(start|serve|dev|test|run)$/i.test(name)) hasPythonServeScript = true;
            }
          }
        }
      } catch {}
    }
    const hasServeScript = hasNodeServeScript || hasPythonServeScript;
    const isCli = facts.cli?.length > 0 && !hasServeScript;
    // Repo names often carry the ecosystem (`commander.js` publishes `commander`, `node-foo` publishes `foo`).
    const bare = (x) => n(x).replace(/-(js|ts|py|node)$/, '').replace(/^(node|py|python)-/, '');
    return !!selfName && (n(selfName) === n(repoName) || bare(selfName) === bare(repoName)) && !isCli;
  }

  function isCliTool(facts, steps) {
    // Has a CLI bin but no serve/test steps (it's a CLI tool, not an app)
    const hasServeOrTest = steps.some((s) => s.kind === 'serve' || s.kind === 'test');
    return facts.cli?.length > 0 && !hasServeOrTest;
  }

  const isLibOrCli = isLibraryOrCli(facts) || isCliTool(facts, steps);
  if (isLibOrCli && selfName) {
    // Skip self-install for LIBRARIES only (not CLI tools)
    // For CLI tools, the README install instruction IS the setup being tested
    if (isLibraryOrCli(facts) && !isCliTool(facts, steps)) {
      for (const s of steps) {
        if (s.kind === 'install' && s.skip === 'installs the published package; you already have its source') {
          // Already skipped by classify
          continue;
        }
        // Check for additional self-install patterns not caught by classify
        if (s.kind === 'install') {
          const mgrPatterns = [
            /^bun\s+add\s+/,
            /^deno\s+add\s+(?:npm:)?/,
            /^yarn\s+add\s+/,
            /^pnpm\s+add\s+/,
          ];
          for (const pattern of mgrPatterns) {
            if (pattern.test(s.command) && s.command.includes(selfName.split('/').pop())) {
              s.skip = 'installs the published package; you already have its source';
              break;
            }
          }
          // Also check plain pip install <selfName> (not caught by classify when CLI exists)
          const pipSelf = s.command.match(/^(?:pip3?\s+install|python3?\s+-m\s+pip\s+install)\s+["']?([\w.-]+)(?:\[[^\]]*\])?(?:==[^\s"']+)?["']?(?:\s|$)/);
          if (pipSelf && pipSelf[1].toLowerCase().replace(/[-_]/g, '-') === selfName.toLowerCase().replace(/[-_]/g, '-')) {
            s.skip = 'installs the published package; you already have its source';
          }
        }
      }
    }
  }

  // Library/CLI repos: user guides and example programs are for people USING the package (final-engine run, 27 Sep).
  if (isLibraryOrCli(facts)) {
    // fastify: docs/Guides/Getting-Started.md builds the reader's own app (`npm i fastify-cli`, `npm start`).
    const USER_GUIDE = /(^|\/)(docs?|guides?)\/(.*\/)?[^/]*(getting[-_ ]?started|quick[-_ ]?start|tutorial|usage|recipes?|examples?)[^/]*$/i;
    for (const s of steps) {
      if (s.skip || s.origin === 'ci' || !s.source?.file) continue;
      if (USER_GUIDE.test(s.source.file) && !/contribut|develop|hacking/i.test(s.source.file)) s.skip = 'user guide for people using this library, not setup of this repo';
    }
    // commander: `extra --help`, `program -b subcommand`: example programs the docs invent, which neither the repo,
    // its package bins nor any tool provides.
    const KNOWN = /^(node|npm|npx|yarn|pnpm|bun|deno|python3?|pip3?|pipx|uv|poetry|pipenv|pdm|hatch|tox|nox|pytest|make|just|task|cargo|go|java|mvn|gradle|ruby|bundle|rake|php|composer|docker|docker-compose|git|cd|cp|mv|mkdir|rm|ln|cat|echo|export|source|\.|touch|chmod|curl|wget|tar|unzip|sudo|apt|apt-get|sh|bash|env|set|test|\[|corepack|nvm|pyenv|asdf|rustup|dotnet|flask|django-admin|uvicorn|gunicorn|alembic|prisma|next|vite|tsc|jest|vitest|mocha|eslint|prettier|nodemon|pm2|redis-server|redis-cli|psql|mysql|mongosh|createdb)$/;
    const bins = new Set([...(facts.cli || []), ...(facts.binPaths || [])]);
    for (const s of steps) {
      if (s.skip || s.origin === 'ci') continue;
      // `node string-util.js split …` names a file that isn't where the command says (it lives in examples/).
      const nodeFile = s.command.match(/^node\s+(?!-)(\S+\.(?:m?js|cjs))\b/);
      const nf = nodeFile && nodeFile[1].replace(/^\.\//, '');
      if (nf && !(facts.files || []).includes(nf) && (facts.files || []).some((f) => f.endsWith('/' + nf))) {
        s.skip = `usage example: \`${nodeFile[1]}\` is not in the repo at that path`;
        continue;
      }
      if (s.kind !== 'other') continue;
      const first = s.command.trim().replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '').split(/\s+/)[0];
      if (!first || KNOWN.test(first) || bins.has(first) || first.includes('/') || /\.(m?js|cjs|py|sh|ts)$/.test(first)) continue;
      if ((facts.files || []).includes(first)) continue;
      s.skip = `usage example: \`${first}\` is an example program in the docs, not a command this repo provides`;
    }
  }

  // Ensure contributor path is planned from CONTRIBUTING or CI workflows
  // We'll collect CI commands and add them if not already present
  // A CI `run:` block can hold several commands (requests: `make` + newline + `python -m pip install …`), so every
  // line is a candidate on its own, and each goes through classify like a README line: lint, coverage, macOS
  // (`make brew-test`) and publishing never become the check that setup worked.
  const ciLines = (facts.ci?.commands || []).flatMap((c) => String(c.run || '').replace(/\\\n\s*/g, ' ').split('\n'))
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !classify(l, classifyFacts).skip);
  const plainFirst = (a, b) => a.length - b.length;
  const ciInstallCommands = ciLines
    .filter((l) => /^(npm\s+(ci|install)|yarn(\s+install)?|pnpm\s+install|bun\s+install|pip\s+install\s+-e\s+\.|uv\s+sync|poetry\s+install|make\s+install)(\s|$)/.test(l))
    .sort(plainFirst);
  const ciTestCommands = ciLines
    .filter((l) => TEST_RE.test(l) || /^(npm|yarn|pnpm)\s+run\s+test[\w:-]*$/.test(l) || /^make\s+(test|check|ci)$/.test(l))
    .sort(plainFirst);
  
  // Only when the docs give no contributor path of their own, and only for libraries/CLIs whose README
  // is written for users: one install and one test command from CI, install first. Apps keep their
  // documented steps untouched (appending every CI command to every repo changed plans that worked).
  const ciSource = { file: 'CI', line: 0, section: 'GitHub Actions' };
  if (isLibOrCli && !steps.some((s) => !s.skip && s.kind === 'install') && ciInstallCommands[0]) {
    const at = steps.findIndex((s) => !s.skip && s.kind === 'test');
    const st = { id: '', command: ciInstallCommands[0], kind: 'install', source: ciSource, origin: 'ci', synthetic: 'from CI workflow' };
    if (at >= 0) steps.splice(at, 0, st); else steps.push(st);
  }
  // Tests only after an install: a CI test with nothing installed (requests: `make ci`) can only fail.
  // When CI's test is a variant we don't run (koa: `npm run test:coverage`), the package's own `test` script is.
  const hasInstall = steps.some((s) => !s.skip && s.kind === 'install');
  // Same package manager as the install (`bun test` is Bun's own runner, not the script, so `bun run test`).
  const mgr = (steps.find((s) => !s.skip && s.kind === 'install')?.command.match(/^(npm|yarn|pnpm|bun)\b/) || [])[1] || 'npm';
  const pkgTest = facts.node?.scripts?.test && !/no test specified/.test(facts.node.scripts.test) ? (mgr === 'bun' ? 'bun run test' : `${mgr} test`) : null;
  // The package's own test script beats a CI line (axios' CI also has a `bun test` job for Bun users).
  const libTest = pkgTest || ciTestCommands[0];
  if (isLibOrCli && hasInstall && !steps.some((s) => !s.skip && s.kind === 'test') && libTest) {
    steps.push({ id: '', command: libTest, kind: 'test', source: libTest === ciTestCommands[0] ? ciSource : { file: 'package.json', line: 0, section: 'scripts.test' }, origin: libTest === ciTestCommands[0] ? 'ci' : 'package', synthetic: libTest === ciTestCommands[0] ? 'from CI workflow' : 'the package\'s own test script' });
  }
  // A library whose docs only install the published package, with no contributor setup HUMBLE can find:
  // say so rather than invent one (psf/requests' saved docs).
  if (isLibOrCli && steps.some((s) => s.skip === SELF) && !steps.some((s) => !s.skip && (s.kind === 'install' || s.kind === 'test'))) {
    notes.push('The docs only show installing the published package. No setup from source was found in the README, CONTRIBUTING or CI, so there is no contributor path to prove.');
  }

  // ── 4. ALTERNATIVES ─────────────────────────────────────────────────────────
  // Lines that do the same job next to each other form one group:
  // python -m venv .venv vs uv venv .venv
  // pip install -r X vs uv pip install -r X
  // npm install vs yarn vs pnpm install
  // bun add vs deno add
  // Run only one per group: the one matching the lockfile or CI; otherwise the first.
  const alternativeGroups = [
    // venv alternatives
    { pattern: /^(python3?\s+-m\s+venv\s+\.venv|uv\s+venv\s+\.venv)$/, reason: 'venv' },
    // pip/uv pip install -r alternatives
    { pattern: /^(pip3?\s+install\s+-r|uv\s+pip\s+install\s+-r)/, reason: 'pip install -r' },
    // npm/yarn/pnpm/bun install alternatives
    { pattern: /^(npm\s+(i|install|ci)\b|yarn(\s+install)?\b|pnpm\s+(i|install)\b|bun\s+install\b)$/, reason: 'package manager install' },
    // bun/deno add alternatives
    { pattern: /^(bun\s+add\s+|deno\s+add\s+(?:npm:)?)/, reason: 'add package' },
  ];

  for (const group of alternativeGroups) {
    const matches = steps
      .map((s, i) => ({ step: s, index: i }))
      .filter(({ step }) => !step.skip && group.pattern.test(step.command));
    
    if (matches.length > 1) {
      // Find the one matching lockfile or CI
      let preferred = null;
      if (facts.node?.lockfile) {
        const lockfileMgr = facts.node.lockfile === 'package-lock.json' ? 'npm'
          : facts.node.lockfile === 'yarn.lock' ? 'yarn'
          : facts.node.lockfile === 'pnpm-lock.yaml' ? 'pnpm'
          : facts.node.lockfile === 'bun.lockb' || facts.node.lockfile === 'bun.lock' ? 'bun'
          : null;
        if (lockfileMgr) {
          preferred = matches.find(({ step }) => step.command.startsWith(lockfileMgr));
        }
      }
      // Check CI for preferred manager
      if (!preferred) {
        const ciInstall = (facts.ci?.commands || []).find(c => /^(npm\s+(ci|install)|yarn(\s+install)?|pnpm\s+install|bun\s+install)/.test(c.run));
        if (ciInstall) {
          const ciMgr = ciInstall.run.match(/^(npm|yarn|pnpm|bun)/)?.[1];
          if (ciMgr) {
            preferred = matches.find(({ step }) => step.command.startsWith(ciMgr));
          }
        }
      }
      // Default to first
      const keep = preferred || matches[0];
      
      // Skip the rest
      for (const { step, index } of matches) {
        if (step !== keep.step) {
          step.skip = `alternative to the step above (${group.reason})`;
        }
      }
    }
  }

  steps.forEach((s, i) => { s.id = `S${i + 1}`; });

  // Runtime: what the docs tell a newcomer to install vs what the project really needs.
  // For dual-stack repos, follow the first non-skipped install/setup step (uv/pip/poetry → Python; npm/yarn/pnpm/bun → Node).
  let runtimeName = facts.stack === 'python' ? 'python' : facts.stack === 'node' ? 'node' : 'other';
  if (facts.node && facts.python) {
    const firstInstall = steps.find((s) => !s.skip && s.kind === 'install');
    if (firstInstall) {
      const c = firstInstall.command;
      if (/^(uv\s+sync|pip3?\s+install|python3?\s+-m\s+pip|poetry\s+install|pipenv\s+install)\b/.test(c)) runtimeName = 'python';
      else if (/^(npm\s+(i|install|ci)\b|yarn(\s+install)?$|yarn\s+install\b|pnpm\s+(i|install)\b|bun\s+install\b)/.test(c)) runtimeName = 'node';
    }
    // Note the secondary stack so the report says the repo has two. A note, not a conflict: conflicts mean
    // "docs say X, code says Y" and feed the drift guard; a two-stack repo isn't docs drift.
    const other = runtimeName === 'node' ? 'Python' : 'Node.js';
    notes.push(`The repo has both Node.js and Python; HUMBLE used the ${runtimeName === 'node' ? 'Node.js' : 'Python'} image because the first install step is ${runtimeName}. The ${other} part was not set up separately.`);
  }
  const truth = runtimeName === 'node' ? facts.node?.truth : runtimeName === 'python' ? facts.python?.truth : null;
  const readmeText = facts.docs.map((d) => readText(path.join(facts.root, d)) || '').join('\n');
  const declared = runtimeName === 'other' ? null : declaredRuntime(readText(path.join(facts.root, facts.docs[0] || '')) || '', runtimeName) || declaredRuntime(readmeText, runtimeName);
  let runtime;
  if (runtimeHint && truth) {
    runtime = { name: runtimeName, version: truth.version, source: `docs say to use a version manager → ${truth.source}` };
  } else if (declared) {
    // Test at the version the docs give, minimum or not ("v7.6+" included): a newcomer who installs
    // exactly that is who a stale README breaks (koa says 7.6+ but its tests need 18). The Doctor rebases.
    runtime = { name: runtimeName, version: declared.version, source: `${facts.docs[0]}:${declared.line} ("${declared.match}")` };
    // "X or higher" is a floor: a newcomer installs the current LTS, not X. Never go below the project's own engines
    // floor either (koa: README floor 7.6, engines >= 18, CI 22–26 → node:7 had no `npm ci`).
    // Only package.json `engines` is a hard floor (npm itself enforces it); .nvmrc etc. stay a docs-vs-code conflict
    // for the Doctor to prove (acme-shop's seeded "Node 16+ vs .nvmrc 20" break).
    if (declared.minimum && runtimeName === 'node' && /engines/.test(truth?.source || '') && Number(truth.version) > Number(declared.version)) {
      runtime = { name: 'node', version: String(truth.version), source: `${truth.source}; the docs' "${declared.match}" is below the project's own engines floor` };
    }
    if (truth && lowerMajor(declared.version, truth.version)) {
      conflicts.push({ what: `${runtimeName === 'node' ? 'Node.js' : 'Python'} version`, docs: declared.match, truth: `${truth.version} (${truth.source})`, source: `${facts.docs[0]}:${declared.line}` });
    }
  } else {
    const def = runtimeName === 'python' ? DEFAULT_PYTHON : DEFAULT_NODE;
    runtime = { name: runtimeName, version: def, source: 'docs do not say; a newcomer installs the current LTS' };
    if (truth && truth.version !== def) conflicts.push({ what: `${runtimeName === 'node' ? 'Node.js' : 'Python'} version`, docs: 'not stated', truth: `${truth.version} (${truth.source})`, source: facts.docs[0] || 'README' });
  }
  if (runtimeName === 'node' && facts.ci.nodeVersions.length && truth) {
    const ciMax = facts.ci.nodeVersions.map((v) => v.version).filter(Boolean);
    if (ciMax.length && !ciMax.includes(runtime.version) && !conflicts.some((c) => c.what.startsWith('Node'))) {
      conflicts.push({ what: 'Node.js version', docs: runtime.version, truth: `CI tests ${[...new Set(ciMax)].join(', ')}`, source: facts.ci.nodeVersions[0].workflow });
    }
  }

  // Static conflicts: things the docs reference that the code no longer has, or never mention.
  const scripts = facts.node ? Object.keys(facts.node.scripts) : [];
  for (const s of steps) {
    const m = s.command.match(/^(?:npm|pnpm|bun)\s+run\s+([\w:.-]+)|^yarn\s+(?:run\s+)?([\w:.-]+)$/);
    const name = m && (m[1] || m[2]);
    if (name && facts.node && !scripts.includes(name) && !['install', 'add', 'dlx', 'set', 'config'].includes(name)) {
      conflicts.push({ what: `npm script "${name}"`, docs: s.command, truth: 'not in package.json scripts', source: `${s.source.file}:${s.source.line}` });
    }
    if (/^docker-compose\s/.test(s.command) && !conflicts.some((c) => c.what === 'Docker Compose v1')) {
      conflicts.push({ what: 'Docker Compose v1', docs: s.command, truth: 'retired in 2023; current Docker ships it as `docker compose`', source: `${s.source.file}:${s.source.line}` });
    }
    const cp = s.command.match(/^(?:cp|mv)\s+(\S+)\s+\S+/);
    if (cp && !facts.files.includes(cp[1].replace(/^\.\//, ''))) {
      conflicts.push({ what: `file ${cp[1]}`, docs: s.command, truth: 'does not exist in the repo', source: `${s.source.file}:${s.source.line}` });
    }
    const entry = s.command.match(/^(?:python3?|node)\s+([\w./-]+\.(?:py|m?js|cjs))\b/);
    if (entry && !facts.files.includes(entry[1].replace(/^\.\//, ''))) {
      conflicts.push({ what: `file ${entry[1]}`, docs: s.command, truth: 'does not exist in the repo', source: `${s.source.file}:${s.source.line}` });
    }
    const req = s.command.match(/-r\s+(\S+)/);
    if (req && /pip/.test(s.command) && !facts.files.includes(req[1].replace(/^\.\//, ''))) {
      conflicts.push({ what: `file ${req[1]}`, docs: s.command, truth: 'does not exist in the repo', source: `${s.source.file}:${s.source.line}` });
    }
  }
  const documented = new Set([...Object.keys(facts.envExample?.keys || {})]);
  // Maintainer tooling (release notes, publishing, deploy, CI helpers) isn't part of a newcomer's setup:
  // huggingface_hub's GITHUB_TOKEN, read only by utils/release_notes/, was flagged as undocumented.
  const maintainerOnly = (f) => /(^|\/)(\.github|release[_-]?notes?|releases?|publish\w*|deploy\w*|changelog|ci)(\/|\.|$)/i.test(f || '');
  for (const v of facts.envVarsInCode) {
    if (v.required && !maintainerOnly(v.file) && !documented.has(v.name) && !readmeText.includes(v.name)) {
      conflicts.push({ what: `env var ${v.name}`, docs: 'not documented', truth: `read in ${v.file}:${v.line}`, source: facts.envExample?.file || 'README' });
    }
  }
  const composeNames = (facts.compose?.services || []).map((x) => `${x.name} ${x.image || ''}`).join(' ');
  const mentioned = `${steps.filter((x) => !x.skip).map((x) => x.command).join(' ')} ${composeNames}`.toLowerCase();
  const svcSignals = [
    ['redis', /^(redis|ioredis|bullmq|bull|celery|rq|django-redis)$/],
    ['postgres', /^(pg|postgres|psycopg2?|psycopg2-binary|asyncpg|pg-promise)$/],
    ['mongodb', /^(mongoose|mongodb|pymongo|motor)$/],
    ['mysql', /^(mysql2?|pymysql|mysqlclient)$/],
  ];
  const deps = [...(facts.node?.deps || []), ...(facts.python?.deps || [])];
  for (const [svc, re] of svcSignals) {
    const dep = deps.find((d) => re.test(d));
    if (dep && !mentioned.includes(svc === 'postgres' ? 'postgres' : svc) && !(svc === 'mongodb' && mentioned.includes('mongo'))) {
      conflicts.push({ what: `${svc} service`, docs: 'setup never starts it', truth: `dependency "${dep}"`, source: facts.node?.deps.includes(dep) ? 'package.json' : 'Python requirements' });
    }
  }

  // Done-when: an HTTP check if the docs point at a URL, else the tests, else clean exits.
  // Prefer a health-style URL from the docs; trailing punctuation is prose, not path.
  const urls = [...readmeText.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})(\/[\w\-./?=&%]*[\w/])?/g)];
  const url = urls.find((u) => /health|status|ping|ready|live/i.test(u[2] || '')) || urls.find((u) => u[2] && u[2] !== '/') || urls[0];
  const serve = steps.find((s) => s.kind === 'serve' && !s.skip);
  let verify = { kind: 'exit', target: 'all steps exit 0' };
  if (serve) {
    const port = url ? Number(url[1]) : facts.ports[0] || defaultPort(serve.command);
    serve.serve = { port };
    verify = { kind: 'http', target: `http://127.0.0.1:${port}${url?.[2] && url[1] === String(port) ? url[2] : '/'}`, ...(url && url[1] === String(port) ? { fromDocs: true } : {}) };
  } else if (steps.some((s) => s.kind === 'test' && !s.skip)) {
    // Strongest honest proof first: a probe of what was installed (`git2txt --help`, a curl), then the docs'
    // own test, then a test taken from CI.
    const tests = steps.filter((s) => s.kind === 'test' && !s.skip);
    const pick = tests.find((s) => s.probe) || tests.filter((s) => s.origin !== 'ci').pop() || tests.pop();
    verify = { kind: 'command', target: pick.command };
  }

  // CI as the reference path: where the docs' path differs from what CI runs on a clean Linux machine.
  for (const f of ciFindings({ facts, steps, classify, classifyFacts, docFile: facts.docs[0], readmeText })) conflicts.push(f);

  return {
    repo: repo || path.basename(facts.root),
    commit: commit || 'working-tree',
    image: imageFor(runtime.name, runtime.version),
    runtime,
    steps,
    conflicts,
    notes,
    verify,
    docsUsed,
    fromCI: steps.some((s) => s.origin === 'ci'),
  };
}

function defaultPort(cmd) {
  if (/uvicorn|fastapi|manage\.py|gunicorn/.test(cmd)) return 8000;
  if (/flask/.test(cmd)) return 5000;
  if (/vite/.test(cmd)) return 5173;
  if (/streamlit/.test(cmd)) return 8501;
  return 3000;
}

/** "npm install && npm run build" → two steps, but keep "cd x && npm i" together. */
function splitAnd(cmd) {
  if (!/&&/.test(cmd) || /^cd\s+\S+\s*&&/.test(cmd) && cmd.split('&&').length === 2) return [cmd.trim()];
  if (/['"`]/.test(cmd)) return [cmd.trim()];
  return cmd.split('&&').map((s) => s.trim()).filter(Boolean);
}
