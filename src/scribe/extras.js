import YAML from 'yaml';
import { serviceKind } from '../doctor/services.js';
import { errorSignature } from '../util.js';

const REPO = process.env.FIRSTRUN_GITHUB || 'b25bb1004-wq/firstrun';

/** A devcontainer that reproduces exactly the machine FirstRun verified on. */
export function devcontainer({ plan, services, name }) {
  const setup = plan.steps.filter((s) => !s.skip && s.status !== 'needs-human' && ['install', 'env', 'build', 'migrate', 'other'].includes(s.kind) && !/^cd\s/.test(s.command));
  const post = setup.map((s) => s.command).join(' && ') || undefined;
  const port = plan.steps.find((s) => s.serve)?.serve?.port;
  if (!services.length) {
    return {
      files: {
        '.devcontainer/devcontainer.json': json({
          name, image: plan.image, workspaceFolder: '/workspaces/${localWorkspaceFolderBasename}',
          postCreateCommand: post, forwardPorts: port ? [port] : undefined,
          customizations: { vscode: { extensions: extensionsFor(plan) } },
        }),
      },
    };
  }
  // Sidecars share the app container's network, the same topology FirstRun verified.
  const compose = { services: { app: { image: plan.image, command: 'sleep infinity', volumes: ['..:/workspace:cached'] } } };
  for (const s of services) {
    compose.services[s.name] = { image: s.image, network_mode: 'service:app', restart: 'unless-stopped' };
    if (s.env && Object.keys(s.env).length) compose.services[s.name].environment = s.env;
  }
  return {
    files: {
      '.devcontainer/devcontainer.json': json({
        name, dockerComposeFile: 'docker-compose.yml', service: 'app', workspaceFolder: '/workspace',
        postCreateCommand: post, forwardPorts: port ? [port] : undefined,
        customizations: { vscode: { extensions: extensionsFor(plan) } },
      }),
      '.devcontainer/docker-compose.yml': YAML.stringify(compose),
    },
  };
}

function extensionsFor(plan) {
  return plan.runtime.name === 'python' ? ['ms-python.python'] : ['dbaeumer.vscode-eslint'];
}

function json(o) {
  return JSON.stringify(o, (k, v) => (v === undefined ? undefined : v), 2) + '\n';
}

/** The drift guard: re-check setup on PRs that touch setup-relevant files. */
export function workflow() {
  return `name: FirstRun setup guard
on:
  pull_request:
    paths:
      - 'README*'
      - 'CONTRIBUTING*'
      - 'docs/**'
      - 'package.json'
      - 'package-lock.json'
      - 'pnpm-lock.yaml'
      - 'yarn.lock'
      - '.nvmrc'
      - '.node-version'
      - 'pyproject.toml'
      - 'requirements*.txt'
      - '.python-version'
      - 'docker-compose*.yml'
      - 'compose*.yml'
      - '.env.example'
      - '.env.sample'
      - '.github/firstrun/plan.json'
      - '**/*.py'
      - 'src/**'
permissions:
  contents: read
  pull-requests: write
jobs:
  guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Check for setup drift and replay the verified plan
        env:
          GH_TOKEN: \${{ github.token }}
        run: npx -y github:${REPO} guard --base origin/\${{ github.base_ref }} --replay --comment \${{ github.event.pull_request.number }}
`;
}

/**
 * A Clicky-style onboarding buddy that lives in the newcomer's IDE: an IBM Bob
 * custom mode that walks them through the verified setup one step at a time,
 * checks each result, and recognises the failure signatures FirstRun recorded.
 */
export function bobGuide({ plan, evidence, passport }) {
  const steps = plan.steps.filter((s) => !s.skip && s.status !== 'needs-human');
  const signatures = evidence.filter((e) => e.status === 'verified').map((e) => {
    const sig = (e.before.logTail.split('\n').reverse().find((l) => /error|ERR|refused|not found|missing|cannot|No such/i.test(l)) || '').trim().slice(0, 200);
    return { signature: sig, cause: e.diagnosis.cause, fix: e.fix?.doc?.text || '', evidence: e.id };
  });
  const modes = {
    customModes: [
      {
        slug: 'firstrun-guide',
        name: '🧭 FirstRun Guide',
        description: 'Walks you from git clone to a running app using the verified setup',
        roleDefinition: 'You are FirstRun Guide, a patient onboarding buddy for this repository. You help a new contributor get the project running on their machine for the first time, using a setup procedure that FirstRun has verified from a clean machine.',
        whenToUse: 'Use when someone is setting up this repository for the first time, or their local setup is broken.',
        customInstructions: [
          'Read .bob/rules-firstrun-guide/verified-setup.md before anything else. It is the source of truth; the README may be older.',
          'Go one step at a time. Before each step, say in one sentence what it does and why. Then run exactly the verified command, and check the result against "Expect".',
          'Ask before running anything that installs software globally or starts containers.',
          'If a command fails, compare the output with the "Known failure signatures" table first. If one matches, explain the cause in plain words and apply the recorded fix. Otherwise read the relevant config or source file and explain what you find before changing anything.',
          'Detect the OS first (macOS, Linux, Windows/WSL). The verified run was on Linux; translate package-manager commands for the user\'s OS when needed and say so.',
          'Never invent secrets. For variables marked "your own key", tell the user where to get one.',
          'When the app is running, point the user to where key features live (open the files) and suggest a good first issue, then stop.',
        ].join('\n'),
        groups: ['read', 'command', ['edit', { fileRegex: '(^|/)\\.env$', description: 'Only the local .env file' }]],
        source: 'project',
      },
    ],
  };
  const md = [];
  md.push(`# Verified setup for ${passport.repo}`, '');
  md.push(`Verified by FirstRun on ${passport.verifiedAt.slice(0, 10)} at commit \`${passport.commit}\` on a clean \`${passport.image}\` machine. Clone to running took ${passport.replaySeconds}s.`, '');
  md.push(`Prerequisites: ${passport.runtime}${steps.some((s) => s.kind === 'services') ? ', Docker (for backing services)' : ''}.`, '');
  md.push('## Steps', '');
  steps.forEach((s, i) => {
    md.push(`${i + 1}. \`${s.command}\``);
    md.push(`   - Kind: ${s.kind}${s.origin === 'repair' ? ' (added by FirstRun: the README missed it)' : ''}${s.readmeCommand ? ` (the README used to say \`${s.readmeCommand}\`)` : ''}`);
    if (s.kind === 'serve') md.push(`   - Expect: the app answers at ${plan.verify.target}${s.probe?.status ? ` (HTTP ${s.probe.status})` : ''}. Leave it running in its own terminal.`);
    else md.push('   - Expect: exits with code 0.');
  });
  md.push('', '## Known failure signatures', '', '| If you see | Cause | Fix |', '|---|---|---|');
  for (const s of signatures) md.push(`| \`${s.signature.replace(/\|/g, '\\|')}\` | ${s.cause.replace(/\|/g, '\\|')} | ${s.fix.replace(/\|/g, '\\|')} |`);
  md.push('');
  return {
    '.bob/custom_modes.yaml': YAML.stringify(modes),
    '.bob/rules-firstrun-guide/verified-setup.md': md.join('\n'),
  };
}

export function servicesUsed(sandboxServices, plan) {
  return sandboxServices.filter((s) => serviceKind(s.image, s.name));
}
