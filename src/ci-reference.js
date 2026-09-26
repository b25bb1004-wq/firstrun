// CI as the reference path. A repo's CI workflow is the one setup its maintainers run on every change, on a clean
// Linux machine. Where the README's path differs from CI's, that difference is a finding worth showing: the docs
// may have drifted from what the project actually needs. Offline only: this reads the workflows, it runs nothing.
//
// Each finding is a plan conflict with a location on both sides: `source` (the docs) and `ci` (workflow:line).

const MGR = [
  ['npm', /^npm\s/], ['yarn', /^yarn(\s|$)/], ['pnpm', /^pnpm\s/], ['bun', /^bun\s/],
  ['uv', /^uv\s/], ['poetry', /^poetry\s/], ['pipenv', /^pipenv\s/], ['pdm', /^pdm\s/], ['pip', /^(pip3?|python3?\s+-m\s+pip)\s/],
];
const ECOSYSTEM = { npm: 'node', yarn: 'node', pnpm: 'node', bun: 'node', uv: 'python', poetry: 'python', pipenv: 'python', pdm: 'python', pip: 'python' };
const managerOf = (cmd) => (MGR.find(([, re]) => re.test(cmd)) || [])[0] || null;
// Creating a virtualenv (`uv venv`, `python -m venv`) is not installing the project.
const isVenv = (cmd) => /^(uv\s+venv|python3?\s+-m\s+venv|virtualenv)\b/.test(cmd);
const isGlobal = (cmd) => isVenv(cmd) || /\s(-g|--global)\b|^pipx\s|^(pip3?|python3?\s+-m\s+pip)\s+install\s+(?!-e\b|-r\b|\.)/.test(cmd);

/** The Linux CI job's commands, one per line (continuations joined), each classified like a README line. */
export function ciPlan(facts, classify, classifyFacts) {
  const out = [];
  for (const c of facts.ci?.commands || []) {
    if (c.linux === false) continue;
    const raw = String(c.run || '').split('\n');
    for (let i = 0; i < raw.length; i++) {
      let l = raw[i].trim(); const at = i;
      while (l.endsWith('\\') && i + 1 < raw.length) l = l.slice(0, -1).trim() + ' ' + raw[++i].trim();
      if (!l || l.startsWith('#')) continue;
      const k = classify(l, classifyFacts);
      if (k.skip) continue;
      out.push({ command: l, kind: k.kind, workflow: c.workflow, line: c.line ? c.line + at : 0, job: c.job });
    }
  }
  // The reference path is a job that runs the tests: docs builds, deploys, linters and bots are not setup.
  const tested = new Set(out.filter((s) => s.kind === 'test').map((s) => `${s.workflow}#${s.job}`));
  return out.filter((s) => tested.has(`${s.workflow}#${s.job}`) && !/(docs?|deploy|release|publish|lint|label|stale|codeql|pages)[\w-]*\.ya?ml$/i.test(s.workflow));
}

/** Extract the tested Linux CI job's setup steps (install, build, services, migrate, test) in CI order.
 * Returns steps with origin 'ci' and source from workflow file, or null if no tested job exists. */
export function ciPlanSteps(facts, classify, classifyFacts) {
  const out = [];
  // Build a map of job -> commands
  const jobCommands = new Map();
  for (const c of facts.ci?.commands || []) {
    if (c.linux === false) continue;
    const raw = String(c.run || '').split('\n');
    for (let i = 0; i < raw.length; i++) {
      let l = raw[i].trim(); const at = i;
      while (l.endsWith('\\') && i + 1 < raw.length) l = l.slice(0, -1).trim() + ' ' + raw[++i].trim();
      if (!l || l.startsWith('#')) continue;
      const k = classify(l, classifyFacts);
      if (k.skip) continue;
      const key = `${c.workflow}#${c.job}`;
      if (!jobCommands.has(key)) jobCommands.set(key, []);
      jobCommands.get(key).push({ command: l, kind: k.kind, workflow: c.workflow, line: c.line ? c.line + at : 0, job: c.job });
    }
  }
  
  // Find jobs that have test steps (the "tested" jobs)
  const testedJobs = new Set();
  for (const [key, cmds] of jobCommands) {
    if (cmds.some(s => s.kind === 'test')) testedJobs.add(key);
  }
  if (!testedJobs.size) return null;
  
  // Build dependency graph from CI facts
  const jobDeps = new Map();
  for (const j of facts.ci?.jobs || []) {
    jobDeps.set(`${j.workflow}#${j.name}`, j.needs || []);
  }
  
  // Find the main tested job (highest scoring)
  const score = (j) => (/\/ci|tests?|build|main|run-tests|node|python\./i.test(j) ? 100 : 0) - (/cover|alt|nightly|bench/i.test(j) ? 50 : 0)
    + (jobCommands.get(j)?.filter(s => ['install', 'build', 'services', 'migrate', 'test'].includes(s.kind)).length || 0);
  const mainJob = [...testedJobs].sort((a, b) => score(b) - score(a))[0];
  
  // Collect all jobs in the dependency chain of the main job
  const collectDeps = (jobKey, visited = new Set()) => {
    if (visited.has(jobKey)) return;
    visited.add(jobKey);
    const deps = jobDeps.get(jobKey) || [];
    for (const dep of deps) {
      const depKey = `${mainJob.split('#')[0]}#${dep}`;
      collectDeps(depKey, visited);
    }
  };
  const jobChain = new Set();
  collectDeps(mainJob, jobChain);
  jobChain.add(mainJob);
  
  // Get steps from all jobs in the chain, filtered to setup kinds
  const setupKinds = new Set(['install', 'build', 'services', 'migrate', 'test']);
  const steps = [];
  for (const key of jobChain) {
    const cmds = jobCommands.get(key) || [];
    for (const s of cmds) {
      if (setupKinds.has(s.kind) && !/(docs?|deploy|release|publish|lint|label|stale|codeql|pages)[\w-]*\.ya?ml$/i.test(s.workflow)) {
        steps.push({ ...s, origin: 'ci', source: { file: s.workflow, line: s.line, section: `CI: ${s.job}` } });
      }
    }
  }
  
  if (!steps.length) return null;
  return steps;
}

const where = (s) => (s.line ? `${s.workflow}:${s.line}` : s.workflow);
const docLoc = (s) => (s?.source?.file ? `${s.source.file}${s.source.line ? ':' + s.source.line : ''}` : null);

/**
 * Compare the docs plan with the CI plan. `steps` are the planned steps; only lines the docs themselves give count
 * as the docs path (steps HUMBLE added from CI are CI's, not the docs').
 */
export function ciFindings({ facts, steps, classify, classifyFacts, docFile, readmeText }) {
  const ci = ciPlan(facts, classify, classifyFacts);
  if (!ci.length) return [];
  const docs = steps.filter((s) => !s.skip && s.origin !== 'ci' && !s.synthetic);
  const findings = [];
  const docsFile = docFile || facts.docs?.[0] || 'README.md';
  const add = (f) => findings.push({ ...f, from: 'ci-reference' });

  const ciInstalls = ci.filter((s) => s.kind === 'install' && !isGlobal(s.command));
  const docInstalls = docs.filter((s) => s.kind === 'install' && !isGlobal(s.command));

  // 0. The docs give no setup at all; CI's tested job is the only path there is.
  if (!docs.length) {
    // One job, the main one: a workflow named ci/test/build beats coverage or alternative-runtime ones.
    const SETUP = ['install', 'build', 'test', 'services', 'migrate'];
    const jobs = [...new Set(ci.map((s) => `${s.workflow}#${s.job}`))];
    const score = (j) => (/\/(ci|tests?|build|main|run-tests|node|python)\.ya?ml#/i.test(j) ? 100 : 0) - (/cover|alt|nightly|bench/i.test(j) ? 50 : 0)
      + ci.filter((s) => `${s.workflow}#${s.job}` === j && SETUP.includes(s.kind)).length;
    const best = jobs.sort((a, b) => score(b) - score(a))[0];
    const path = ci.filter((s) => `${s.workflow}#${s.job}` === best && SETUP.includes(s.kind));
    if (path.length) add({ what: 'Setup path', docs: 'none documented', truth: `CI runs ${path.map((s) => '`' + s.command + '`').join(', ')}`, source: docsFile, ci: where(path[0]) });
    return findings;
  }

  // 1. CI installs the project's dependencies; the docs never do.
  if (ciInstalls.length && !docInstalls.length && docs.some((s) => ['test', 'serve', 'build', 'migrate'].includes(s.kind))) {
    const c = ciInstalls[0];
    add({ what: 'Install step', docs: 'never installs the dependencies', truth: `CI runs \`${c.command}\` first`, source: docsFile, ci: where(c) });
  }

  // 2. Same ecosystem, different package manager (docs `npm install`, CI `pnpm install --frozen-lockfile`).
  for (const d of docInstalls) {
    const dm = managerOf(d.command); if (!dm) continue;
    const c = ciInstalls.find((x) => ECOSYSTEM[managerOf(x.command)] === ECOSYSTEM[dm]);
    const cm = c && managerOf(c.command);
    if (cm && cm !== dm && !(dm === 'pip' && cm === 'pip')) {
      add({ what: 'Package manager', docs: `\`${d.command}\` (${dm})`, truth: `CI installs with \`${c.command}\` (${cm})`, source: docLoc(d) || docsFile, ci: where(c) });
      break;
    }
  }

  // 3. CI builds before it tests or starts; the docs skip the build.
  const ciBuild = ci.find((s) => s.kind === 'build');
  if (ciBuild && !docs.some((s) => s.kind === 'build') && docs.some((s) => s.kind === 'test' || s.kind === 'serve')) {
    add({ what: 'Build step', docs: 'no build step', truth: `CI runs \`${ciBuild.command}\``, source: docsFile, ci: where(ciBuild) });
  }

  // 4. System packages CI installs that the docs never mention (apt-get install libpq-dev …).
  const docText = docs.map((s) => s.command).join('\n') + '\n' + (readmeText || '');
  const sys = [];
  for (const s of ci.filter((x) => x.kind === 'prereq')) {
    const m = s.command.match(/apt(?:-get)?\s+install\s+(.+)/); if (!m) continue;
    for (const p of m[1].split(/\s+/).filter((x) => x && !x.startsWith('-') && !/^(lcov|xvfb|git|curl|wget|ca-certificates)$/.test(x))) {
      if (!docText.includes(p) && !sys.some((y) => y.p === p)) sys.push({ p, s });
    }
  }
  if (sys.length) add({ what: 'System packages', docs: 'not mentioned', truth: `CI installs ${sys.map((x) => x.p).join(', ')}`, source: docsFile, ci: where(sys[0].s) });

  // 5. CI starts services (docker compose / service containers) the docs never start.
  const ciSvc = (facts.ci?.services || []).map((s) => s.name);
  const docSvc = docs.filter((s) => s.kind === 'services').map((s) => s.command).join(' ');
  const missing = ciSvc.filter((n) => !new RegExp(`\\b${n.replace(/[^\w-]/g, '')}\\b`, 'i').test(docSvc + ' ' + (readmeText || '')));
  if (missing.length) {
    const wf = facts.ci.services.find((s) => missing.includes(s.name))?.workflow;
    add({ what: 'Services', docs: 'not started or mentioned', truth: `CI runs ${[...new Set(missing)].join(', ')} as service containers`, source: docsFile, ci: wf });
  }

  return findings;
}
