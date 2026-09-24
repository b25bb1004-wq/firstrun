#!/usr/bin/env node
// Stands in for Bob Shell in tests: answers `bob run --format json` like the real CLI.
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
if (args[0] === '--version') { console.log('2.0.5-fake'); process.exit(0); }
const ws = args[args.indexOf('-w') + 1];
const prompt = args[args.length - 1];
const rel = prompt.match(/Read the file (\S+)/)[1];
const request = fs.readFileSync(path.join(ws, rel), 'utf8');
const failing = request.match(/- Command: `([^`]+)`/)[1];
const answer = {
  class: 'missing-tool',
  cause: `\`${failing.split(' ')[0]}\` needs the make build tool, which the README never lists (Makefile:1).`,
  confidence: 0.82,
  fix: { actions: [{ type: 'exec', command: 'apt-get install -y make' }], doc: { kind: 'prerequisite', text: 'GNU make' } },
};
console.log(JSON.stringify({ type: 'result', timestamp: new Date().toISOString(), status: 'success', stats: { task_id: 'fake-task-1', session_costs: 0.42 }, last_message: '```json\n' + JSON.stringify(answer) + '\n```' }));
