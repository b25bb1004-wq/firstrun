// Setup commands written as list items with inline code (gothinkster/react-redux-realworld-example-app):
//   ## Getting started
//   - `npm install` to install all req'd dependencies
// Before this, HUMBLE reported NO-SETUP-DOCS for that README.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, blockCommands, isShellBlock } from '../src/markdown.js';

const README = `# app

## Getting started

To get the frontend running locally:

- Clone this repo
- \`npm install\` to install all req'd dependencies
- \`npm start\` to start the local server
- Set \`PORT\` in \`.env\` to change the port
1. Run \`yarn build\`

## Contributing

- \`npm run test\`
`;

test('inline list-item commands become one-line blocks; prose and non-commands do not', () => {
  const md = parseMarkdown(README);
  const inline = md.blocks.filter((b) => b.inline);
  assert.deepEqual(inline.map((b) => blockCommands(b).map((c) => c.text)[0]), ['npm install', 'npm start', 'yarn build', 'npm run test']);
  assert.ok(inline.every(isShellBlock));
  assert.equal(inline[0].code, 'npm install');
  assert.equal(md.lines[inline[0].start], "- `npm install` to install all req'd dependencies");
});

test('a fenced block in the same section wins over a bullet summary of it', () => {
  const md = parseMarkdown('## Install\n\n- `npm install`\n\n```bash\nnpm ci\n```\n');
  assert.equal(md.blocks.filter((b) => b.inline).length, 1);
  assert.equal(md.blocks.filter((b) => !b.inline).length, 1); // plan.js keeps only the fence for this section
});

test('a port pinned in the start script is the one HUMBLE waits on', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { scout } = await import('../src/scout/index.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'humble-port-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { start: 'cross-env PORT=4100 react-scripts start' }, dependencies: { react: '^16' } }));
  fs.writeFileSync(path.join(dir, 'README.md'), '# x\n\n## Getting started\n\n- `npm install` to install\n- `npm start` to start\n');
  const facts = await scout(dir);
  assert.equal(Number(facts.ports[0]), 4100);
});

test('a README URL on another port (the backend API) does not override the start-script port', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { scout } = await import('../src/scout/index.js');
  const { buildPlan } = await import('../src/plan.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'humble-port2-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', scripts: { start: 'cross-env PORT=4100 react-scripts start' }, dependencies: { react: '^16' } }));
  fs.writeFileSync(path.join(dir, 'README.md'), '# x\n\n## Getting started\n\n- `npm install` to install\n- `npm start` to start the local server\n\nTo use a local API, set API_ROOT to `http://localhost:3000/api`.\n');
  const plan = buildPlan(await scout(dir));
  assert.equal(plan.verify.target, 'http://127.0.0.1:4100/');
});
