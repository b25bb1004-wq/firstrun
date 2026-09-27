import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function templateKeys(template) {
  const keys = [];
  for (const line of template.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match && !keys.includes(match[1])) keys.push(match[1]);
  }
  return keys;
}

function readValues(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match && !values.has(match[1])) values.set(match[1], match[2]);
  }
  return values;
}

function needsValue(value) {
  const raw = String(value ?? '').trim();
  const trimmed = raw.replace(/^(?:"(.*)"|'(.*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
  return !trimmed || /^(?:<[^>]+>|your[-_].*|changeme|change[-_.]me|replace[-_].*|example|sample)$/i.test(trimmed);
}

function quoteEnvValue(value) {
  if (/[\r\n]/.test(value)) throw new Error('Values must be a single line.');
  if (!value || /[\s#"'\\]/.test(value)) return JSON.stringify(value);
  return value;
}

async function ensureRegularFile(filePath, { optional = false } = {}) {
  try {
    const stat = await fs.lstat(filePath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${path.basename(filePath)} must be a regular file.`);
    return true;
  } catch (error) {
    if (optional && error.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Create or update a local .env from .env.example. Values stay in memory and
 * are written only to the project file; the result deliberately contains no values.
 */
export async function writeEnvFile({ projectDir = process.cwd(), values = {} } = {}) {
  const root = path.resolve(projectDir);
  const templatePath = path.join(root, '.env.example');
  const outputPath = path.join(root, '.env');
  await ensureRegularFile(templatePath);
  const template = await fs.readFile(templatePath, 'utf8');
  const existing = await ensureRegularFile(outputPath, { optional: true });
  const currentText = existing ? await fs.readFile(outputPath, 'utf8') : '';
  const current = readValues(currentText);
  const originalKeys = new Set(current.keys());
  const supplied = new Map(Object.entries(values));
  for (const [key, value] of supplied) {
    if (!KEY.test(key) || typeof value !== 'string') throw new Error('Invalid environment field.');
    if (/[\r\n]/.test(value)) throw new Error(`Value for ${key} must be a single line.`);
  }

  const keys = templateKeys(template);
  const lines = template.split(/\r?\n/).map((line) => {
    const match = line.match(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=)(.*)$/);
    if (!match) return line;
    const [, prefix, key, assignment] = match;
    if (current.has(key) && !needsValue(current.get(key))) return line;
    if (!supplied.has(key)) return line;
    return `${prefix}${key}${assignment}${quoteEnvValue(supplied.get(key))}`;
  });

  const extras = [...supplied.keys()].filter((key) => !keys.includes(key) && !current.has(key));
  for (const key of extras) lines.push(`${key}=${quoteEnvValue(supplied.get(key))}`);
  if (existing) {
    // Keep existing entries byte-for-byte and append missing template keys. Never echo values.
    const oldLines = currentText.split(/\r?\n/).filter((line, index, all) => index < all.length - 1 || line).map((line) => {
      const match = line.match(/^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=)(.*)$/);
      if (!match || !needsValue(current.get(match[2])) || !supplied.has(match[2])) return line;
      return `${match[1]}${match[2]}${match[3]}${quoteEnvValue(supplied.get(match[2]))}`;
    });
    const added = lines.filter((line) => {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      return match && !originalKeys.has(match[1]);
    });
    lines.splice(0, lines.length, ...oldLines, ...added);
  }

  const output = `${lines.join('\n').replace(/\n*$/, '')}\n`;
  const tempPath = path.join(root, `.env.${crypto.randomBytes(8).toString('hex')}.tmp`);
  let handle;
  try {
    handle = await fs.open(tempPath, 'wx', 0o600);
    await handle.writeFile(output, 'utf8');
    await handle.chmod(0o600).catch(() => {});
    await handle.close();
    handle = null;
    await ensureRegularFile(outputPath, { optional: true });
    await fs.rename(tempPath, outputPath);
    await fs.chmod(outputPath, 0o600).catch(() => {});
  } catch (error) {
    await handle?.close().catch(() => {});
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
  return {
    path: outputPath,
    keysWritten: keys.filter((key) => supplied.has(key) && (!originalKeys.has(key) || needsValue(current.get(key)))).length + extras.length,
    checker: { type: 'env-complete', keys },
  };
}

/** Prompt without echoing supplied characters; TTY input is always masked. */
export function readMasked(prompt, { input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Masked environment input requires an interactive terminal.'));
  }
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = input.isRaw;
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(wasRaw);
      input.pause();
    };
    const onData = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === '\u0003') { cleanup(); output.write('\n'); reject(new Error('Input cancelled.')); return; }
        if (char === '\r' || char === '\n') { cleanup(); output.write('\n'); resolve(value); return; }
        if (char === '\u007f' || char === '\b') {
          if (value.length) { value = value.slice(0, -1); output.write('\b \b'); }
          continue;
        }
        if (char >= ' ') { value += char; output.write('•'); }
      }
    };
    output.write(prompt);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

/** Run the local wizard. The callback owns UI only and must not log the returned value. */
export async function runEnvWizard({ projectDir = process.cwd(), ask = readMasked } = {}) {
  const template = await fs.readFile(path.join(path.resolve(projectDir), '.env.example'), 'utf8');
  const currentPath = path.join(path.resolve(projectDir), '.env');
  const currentExists = await ensureRegularFile(currentPath, { optional: true });
  const current = currentExists ? readValues(await fs.readFile(currentPath, 'utf8')) : new Map();
  const values = {};
  for (const key of templateKeys(template)) {
    if (current.has(key) && !needsValue(current.get(key))) continue;
    const templateValue = current.get(key) ?? readValues(template).get(key) ?? '';
    if (!needsValue(templateValue)) continue;
    const value = await ask(`${key}: `);
    values[key] = value;
  }
  return writeEnvFile({ projectDir, values });
}
