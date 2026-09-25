import path from 'node:path';
import { parseMarkdown, isShellBlock, blockCommands, sectionPath } from './markdown.js';
import { readText } from './util.js';

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
const TEST_RE = /^(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test(?::[\w:-]+)?\b|npx\s+(?:jest|vitest|mocha|playwright\s+test)|(?:python3?\s+-m\s+)?pytest\b|poetry\s+run\s+pytest|uv\s+run\s+pytest|tox\b|nox\b|python3?\s+manage\.py\s+test|make\s+test|go\s+test)/i;

export function classify(cmd, facts) {
  // "DEBUG=app:* npm run devstart" is still "npm run devstart"
  const c = cmd.trim().replace(/^sudo\s+/, '').replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+/, '');
  const ctx = {};
  if (/^git\s+clone\b/.test(c)) return { kind: 'other', skip: 'git clone: FirstRun starts from a fresh clone already' };
  if (/<[a-z][\w -]*>|\*[a-z_]+\*|\bYOUR[_-]|\byour[-_](?:name|key|token|password|email)/i.test(c) && !/^(export|echo)\b/.test(c)) return { kind: 'other', skip: 'needs a value only you have (placeholder)' };
  if (/\b(user-?name|your-?(?:user|org|name)|owner|org)\/(repo|repository|project)\b|(^|\s)\/?path\/to\//i.test(c)) return { kind: 'other', skip: 'needs a value only you have (placeholder)' };
  if (/(~|\$HOME)\/Downloads\b|(^|\s)Downloads\//.test(c)) return { kind: 'other', skip: 'uses a file you download by hand first' };
  if (/^(docker(-compose|\s+compose)\s+logs|tail\s+-[fF]\b|journalctl\b|kubectl\s+logs)/.test(c)) return { kind: 'other', skip: 'follows logs; not a setup step' };
  if (/>>?\s*~?\/?\S*\.(bashrc|zshrc|bash_profile|profile|config\/fish\S*)\b|^set\s+fish_\w+/.test(c)) return { kind: 'other', skip: 'personal shell customisation, not project setup' };
  if (/^(npm|pip3?|pipx|yarn|pnpm)\s+(uninstall|remove|rm)\b|^(poetry|npm|yarn|pnpm)\s+publish\b|^twine\s+upload\b/.test(c)) return { kind: 'other', skip: 'uninstall/publish: not part of setting up' };
  if (/^vagrant\s+(up|ssh|provision|halt)\b/.test(c)) return { kind: 'other', skip: 'VM-based alternative workflow' };
  // Self-install: "npm install koa" inside koa's own repo installs the published package, not this source.
  // A CLI tool's README install ("pip3 install jello") is the setup being tested; only libraries are skipped.
  const selfInstallName = facts?.cli?.length ? null : facts?.selfName;
  if (selfInstallName) {
    const npmSelf = c.match(/^(?:npm\s+(?:install|i)|yarn\s+add|pnpm\s+add)\s+((?:@[\w.-]+\/)?[\w.-]+)(?:@\S+)?(?:\s|$)/);
    if (npmSelf && npmSelf[1].split('/').pop() === selfInstallName.split('/').pop()) return { kind: 'other', skip: 'installs the published package; you already have its source' };
    const pipSelf = c.match(/^(?:pip3?\s+install|python3?\s+-m\s+pip\s+install)\s+([\w.-]+)(?:==\S+)?(?:\s|$)/);
    if (pipSelf && pipSelf[1].toLowerCase().replace(/[-_]/g, '-') === selfInstallName.toLowerCase().replace(/[-_]/g, '-')) return { kind: 'other', skip: 'installs the published package; you already have its source' };
  }
  // Live-service tests: the script name contains ":live" or ends with "-live".
  const liveScript = c.match(/^(?:npm|yarn|pnpm)\s+(?:run\s+)?([\w:.-]+)$/);
  if (liveScript && (/:live/.test(liveScript[1]) || /-live$/.test(liveScript[1]))) return { kind: 'other', skip: 'runs against live third-party services; needs real accounts' };
  if (/^(poetry|pipenv|hatch)\s+shell\b/.test(c)) return { kind: 'env', skip: 'interactive subshell: FirstRun activates the same environment after install', subshell: c.split(/\s+/)[0] };
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
  if (/^docker(-compose|\s+compose)\s+(up|start)\b/.test(c)) return { kind: 'services' };
  if (/^docker\s+run\b/.test(c) && /\b(postgres|redis|mysql|mariadb|mongo|rabbitmq|elasticsearch|memcached|minio|mailhog|localstack)/i.test(c)) return { kind: 'services' };
  if (/^docker(-compose|\s+compose)?\s+(build|run|exec|push|pull|login)\b|^docker(-compose)?\s+/.test(c)) return { kind: 'other', skip: 'container-based alternative workflow' };
  if (/^(cp|mv|copy)\s+\S*\.env|^(cp|mv)\s+\S*env\S*\s|^export\s+[A-Z_]+=|^echo\s+.+>>?\s*\.env|^touch\s+\.env|^source\s+\.env|^set\s+-a/.test(c)) return { kind: 'env' };
  if (/^(source|\.)\s+\S*(venv|env)\S*\/bin\/activate|^python3?\s+-m\s+venv\b|^virtualenv\b|^(uv\s+venv)/.test(c)) return { kind: 'install' };
  if (/^(npm\s+(i|install|ci)\b|yarn(\s+install)?$|yarn\s+install\b|pnpm\s+(i|install)\b|bun\s+install\b|pip3?\s+install\b|python3?\s+-m\s+pip\s+install\b|poetry\s+install\b|uv\s+(sync|pip\s+install)\b|pipenv\s+install\b|corepack\s+enable\b|npm\s+install\s+-g\b|bundle\s+install\b|composer\s+install\b|go\s+mod\s+download\b)/.test(c)) return { kind: 'install' };
  if (/(migrat|prisma\s+(migrate|db\s+push|generate)|knex\s+migrate|sequelize(-cli)?\s+db:|alembic\s+upgrade|manage\.py\s+(migrate|makemigrations)|db:(migrate|setup|push|reset|create)|typeorm\s+migration|drizzle-kit|createdb\b|psql\b|mysql\s+-u)/i.test(c)) return { kind: 'migrate' };
  if (/(db:seed|\bseed\b|loaddata|fixtures?\b)/i.test(c)) return { kind: 'migrate' };
  if (TEST_RE.test(c)) return { kind: 'test' };
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
  if (!steps.some((s) => !s.skip && s.kind === 'install')) for (const s of steps.filter((x) => x.skip === SELF && /^(pip3?|python3?\s+-m\s+pip)\b/.test(x.command))) { delete s.skip; s.kind = 'install'; }
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
    // Note the secondary stack so the report says the repo has two.
    const other = runtimeName === 'node' ? 'Python' : 'Node.js';
    if (!conflicts.some((c) => c.what === `${other} stack`)) {
      conflicts.push({ what: `${other} stack`, docs: `repo has both Node.js and Python`, truth: `using ${runtimeName === 'node' ? 'Node.js' : 'Python'} image (first install step is ${runtimeName})`, source: facts.docs[0] || 'README' });
    }
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
  for (const v of facts.envVarsInCode) {
    if (v.required && !documented.has(v.name) && !readmeText.includes(v.name)) {
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
    verify = { kind: 'command', target: steps.filter((s) => s.kind === 'test' && !s.skip).pop().command };
  }

  return {
    repo: repo || path.basename(facts.root),
    commit: commit || 'working-tree',
    image: imageFor(runtime.name, runtime.version),
    runtime,
    steps,
    conflicts,
    verify,
    docsUsed,
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
