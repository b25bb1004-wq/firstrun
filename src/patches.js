import path from 'node:path';
import YAML from 'yaml';
import { readText } from './util.js';

/**
 * Repo patches are the file changes FirstRun proposes in its PR (for example a
 * missing variable in .env.example, or a missing Redis service in
 * docker-compose.yml). They are kept as operations and folded into final file
 * contents on demand, so the replay runs against exactly what the PR contains.
 */
export function applyPatchOps(original, ops) {
  let text = original ?? '';
  for (const op of ops) {
    if (op.op === 'write') text = op.content;
    else if (op.op === 'append-env') {
      const re = new RegExp(`^\\s*(export\\s+)?${op.key}\\s*=`, 'm');
      if (re.test(text)) continue;
      if (text && !text.endsWith('\n')) text += '\n';
      text += `${op.comment ? `\n# ${op.comment}\n` : ''}${op.key}=${op.value}\n`;
    } else if (op.op === 'set-env') {
      // Replace a placeholder value in place (keeps comments and order), or append if the key is missing.
      const re = new RegExp(`^(\\s*(?:export\\s+)?${op.key}\\s*=).*$`, 'm');
      if (re.test(text)) text = text.replace(re, (_, lhs) => `${lhs}${op.value}`);
      else text += `${text && !text.endsWith('\n') ? '\n' : ''}${op.key}=${op.value}\n`;
    } else if (op.op === 'compose-add-service') {
      const doc = YAML.parseDocument(text || 'services: {}\n');
      if (!doc.hasIn(['services', op.name])) {
        const svc = { image: op.image, ports: [`${op.port}:${op.port}`] };
        if (op.env && Object.keys(op.env).length) svc.environment = op.env;
        doc.setIn(['services', op.name], doc.createNode(svc));
      }
      text = String(doc);
    } else if (op.op === 'tsconfig-skip-lib-check') {
      // tsconfig files can have // comments and trailing commas, so avoid JSON.parse.
      if (/\bskipLibCheck\b/.test(text)) {
        // key present: normalise its value to true regardless of what it was.
        text = text.replace(/("skipLibCheck"\s*:\s*)(?:false|true)/, '$1true');
      } else if (/"?compilerOptions"?\s*:\s*\{/.test(text)) {
        // the key is quoted in real tsconfigs ("compilerOptions": {); detect indentation from the next line
        const m = text.match(/"?compilerOptions"?\s*:\s*\{[^\n]*\n(\s+)/);
        const indent = m ? m[1] : '    ';
        text = text.replace(/("?compilerOptions"?\s*:\s*\{)/, `$1\n${indent}"skipLibCheck": true,`);
      } else {
        // no compilerOptions at all: insert after the file's first `{`
        const m2 = text.match(/\{[^\n]*\n(\s+)/);
        const indent = m2 ? m2[1] : '  ';
        text = text.replace(/(\{)/, `$1\n${indent}"compilerOptions": {\n${indent}${indent}"skipLibCheck": true\n${indent}},`);
      }
    }
  }
  return text;
}

/** Fold patch ops into { path → new content } against the repo on disk. */
export function materialize(root, patchOps) {
  const byPath = new Map();
  for (const op of patchOps) {
    if (!byPath.has(op.path)) byPath.set(op.path, []);
    byPath.get(op.path).push(op);
  }
  const out = [];
  for (const [p, ops] of byPath) {
    const original = readText(path.join(root, p));
    out.push({ path: p, original, content: applyPatchOps(original, ops) });
  }
  return out;
}
