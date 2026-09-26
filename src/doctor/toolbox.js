// Fixed, known-good ways to install the developer tools READMEs assume. The Doctor never invents an installer:
// in the audit, Bob tried two made-up Deno URLs for axios and burned 1.23 Bobcoins on a line that should never
// have run. Every entry works on both HUMBLE images (node:* has npm, python:* has pip) and is idempotent.

const viaNpmOrScript = (pkg, bin, script) =>
  `command -v ${bin} >/dev/null || { if command -v npm >/dev/null; then npm install -g ${pkg}; else apt-get update -qq && apt-get install -y -qq unzip curl >/dev/null && ${script}; fi; }`;
const viaPipOrScript = (pkg, bin, script) =>
  `command -v ${bin} >/dev/null || { if command -v pip >/dev/null || command -v pip3 >/dev/null; then (pip install ${pkg} || pip3 install ${pkg}); else apt-get update -qq && apt-get install -y -qq curl >/dev/null && ${script}; fi; }`;

export const TOOLBOX = {
  bun: viaNpmOrScript('bun', 'bun', 'curl -fsSL https://bun.sh/install | bash && ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun'),
  deno: viaNpmOrScript('deno', 'deno', 'curl -fsSL https://deno.land/install.sh | sh -s -- -y && ln -sf "$HOME/.deno/bin/deno" /usr/local/bin/deno'),
  uv: viaPipOrScript('uv', 'uv', 'curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh'),
  poetry: viaPipOrScript('poetry', 'poetry', 'curl -sSL https://install.python-poetry.org | POETRY_HOME=/opt/poetry python3 - && ln -sf /opt/poetry/bin/poetry /usr/local/bin/poetry'),
  just: viaPipOrScript('rust-just', 'just', "curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin"),
  pnpm: 'corepack enable',
  yarn: 'corepack enable',
};

/** The toolbox command for a tool name, or null. */
export const toolboxFor = (tool) => TOOLBOX[tool] || null;

/**
 * A fix command that pipes a downloaded installer into a shell (`curl … | sh`) for a tool the toolbox knows is
 * replaced by the toolbox command. Returns the command to use (unchanged when it isn't such an installer).
 */
export function pinInstaller(command) {
  const c = String(command || '');
  if (!/\b(curl|wget)\b[^|]*\|\s*(ba|z)?sh\b/.test(c)) return c;
  for (const tool of Object.keys(TOOLBOX)) {
    if (new RegExp(`\\b${tool}\\b`, 'i').test(c) && !c.startsWith(TOOLBOX[tool])) return TOOLBOX[tool];
  }
  return c;
}
