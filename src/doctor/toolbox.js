// Fixed, known-good ways to install the developer tools READMEs assume. The Doctor never invents an installer:
// in the audit, Bob tried two made-up Deno URLs for axios and burned 1.23 Bobcoins on a line that should never
// have run. Every entry works on both HUMBLE images (node:* has npm, python:* has pip) and is idempotent.
// These are for HUMBLE's throwaway sandbox only (global installs are fine there); they are not advice for docs.
// Each installer puts the tool on /usr/local/bin, so the `export PATH=…` tails Bob adds are not needed.

const viaNpmOrScript = (pkg, bin, script) =>
  `command -v ${bin} >/dev/null || { if command -v npm >/dev/null; then npm install -g ${pkg}; else apt-get update -qq && apt-get install -y -qq unzip curl >/dev/null && ${script}; fi; }`;
const viaPipOrScript = (pkg, bin, script) =>
  `command -v ${bin} >/dev/null || { if command -v pip >/dev/null || command -v pip3 >/dev/null; then (pip install ${pkg} || pip3 install ${pkg}); else apt-get update -qq && apt-get install -y -qq curl >/dev/null && ${script}; fi; }`;
// Node 25+ images no longer bundle corepack: fall back to npm.
const viaCorepack = (bin) => `command -v ${bin} >/dev/null || { if command -v corepack >/dev/null; then corepack enable; else npm install -g ${bin}; fi; }`;

export const TOOLBOX = {
  bun: viaNpmOrScript('bun', 'bun', 'curl -fsSL https://bun.sh/install | bash && ln -sf "$HOME/.bun/bin/bun" /usr/local/bin/bun'),
  deno: viaNpmOrScript('deno', 'deno', 'curl -fsSL https://deno.land/install.sh | sh -s -- -y && ln -sf "$HOME/.deno/bin/deno" /usr/local/bin/deno'),
  uv: viaPipOrScript('uv', 'uv', 'curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh'),
  poetry: viaPipOrScript('poetry', 'poetry', 'curl -sSL https://install.python-poetry.org | POETRY_HOME=/opt/poetry python3 - && ln -sf /opt/poetry/bin/poetry /usr/local/bin/poetry'),
  just: viaPipOrScript('rust-just', 'just', "curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin"),
  pnpm: viaCorepack('pnpm'),
  yarn: viaCorepack('yarn'),
};

// Which download hosts mean "this is the installer for <tool>". Matching the tool NAME anywhere in the command
// replaced unrelated installers (`curl … get.docker.com | sh && echo just to be safe` became the just installer).
const HOSTS = {
  bun: /(^|\/\/|\.)bun\.sh\b/i,
  deno: /(^|\/\/|\.)deno\.(land|com)\b/i,
  uv: /(^|\/\/|\.)astral\.sh\/uv\b/i,
  poetry: /(^|\/\/|\.)install\.python-poetry\.org\b|(^|\/\/|\.)python-poetry\.org\/install/i,
  just: /(^|\/\/|\.)just\.systems\b/i,
};

/** The toolbox command for a tool name, or null. */
export const toolboxFor = (tool) => TOOLBOX[tool] || null;

/**
 * A fix command that pipes a download into a shell (`curl … | sh`) from a known tool's install host is replaced by
 * the toolbox command. Anything else is returned unchanged.
 */
export function pinInstaller(command) {
  const c = String(command || '');
  if (!/\b(curl|wget)\b[^|]*\|\s*(ba|z)?sh\b/.test(c)) return c;
  const urls = [...c.matchAll(/\b(?:curl|wget)\b[^|]*?(https?:\/\/[^\s'"|]+)/g)].map((m) => m[1]);
  for (const [tool, host] of Object.entries(HOSTS)) {
    if (urls.some((u) => host.test(u))) return TOOLBOX[tool];
  }
  return c;
}
