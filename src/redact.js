export const REDACTED = '<redacted-by-firstrun>';

// Known token prefixes that must always be masked anywhere they appear
const TOKEN_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{10,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{10,}\b/g,
  /\b(?:sk-ant-|sk-proj-|sk-)[A-Za-z0-9_-]{10,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9_-]{10,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bbob_prod_[A-Za-z0-9_-]{8,}\b/g,
  /\bnvapi-[A-Za-z0-9_-]{10,}\b/g,
  /\bwagtail_[A-Za-z0-9_-]{8,}\b/g,
  /\b[MN][A-Za-z0-9_-]{23,25}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

// Secret-holding variable names in assignments
const SECRET_VAR_REGEX = /^(?:export\s+)?([A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD))$/i;

/**
 * Check whether a value is a harmless, readable placeholder rather than a real credential.
 * Plain words like `your-api-key`, `email-server-password`, `sample`, etc. are kept readable.
 */
export function isPlainPlaceholder(val) {
  if (!val || typeof val !== 'string') return true;
  const s = val.trim();
  if (!s || s === REDACTED) return true;

  // Never treat known token prefixes as placeholders
  if (/^(?:gh[pousr]_|github_pat_|sk-|xox[baprs]-|AKIA|bob_prod_|nvapi-|wagtail_)/.test(s)) {
    return false;
  }

  // Brackets: e.g. <your-api-key>, [secret], {token}
  if (/^<[^>]+>$|^\[[^\]]+\]$|^\{[^\}]+\}$/.test(s)) return true;

  // Explicit placeholder keywords
  if (/(?:your[-_]|sample|example|placeholder|dummy|changeme|change[-.]me|email-server|not[-.]a[-.]secret|mysecret|testpassword)/i.test(s)) {
    return true;
  }

  // Plain word slugs: lowercase words separated by hyphens or underscores (no digits, no hex)
  // e.g. "your-api-key", "email-server-password", "secret", "password", "local-dev"
  if (/^[a-z]+(?:[-_][a-z]+)*$/i.test(s) && !/^[0-9a-f]{16,}$/i.test(s)) {
    if (s.length < 40 && !/(?:[a-z]{30,})/.test(s)) {
      return true;
    }
  }

  return false;
}

/**
 * Mask token-shaped values and secrets in text, replacing them with <redacted-by-firstrun>.
 * Keeps readable plain-word placeholders intact.
 */
export function redactSecrets(text) {
  if (text == null) return text;
  if (typeof text !== 'string') return text;

  let result = text;

  // 1. Redact known token prefixes anywhere in text
  for (const pat of TOKEN_PATTERNS) {
    result = result.replace(pat, REDACTED);
  }

  // 2. Redact shell and env variable assignments:
  // (export )?NAME_TOKEN=value or NAME_TOKEN="value"
  result = result.replace(
    /(^|[ \t\n;])((?:export\s+)?([A-Za-z0-9_]*(?:TOKEN|SECRET|KEY|PASSWORD))\s*=\s*)(['"]?)([^'"\r\n\s]+)\4/gi,
    (match, prefix, assignment, varName, quote, value) => {
      if (isPlainPlaceholder(value)) return match;
      return `${prefix}${assignment}${quote}${REDACTED}${quote}`;
    },
  );

  // 3. Redact JSON key-value pairs:
  // "apiKey": "..." or "jwt_secret": "..."
  result = result.replace(
    /(["'])([A-Za-z0-9_]*(?:token|secret|key|password)[A-Za-z0-9_]*)\1(\s*:\s*)(["'])([^"'\r\n]+)\4/gi,
    (match, q1, keyName, colon, q2, value) => {
      // Avoid false matches on keys like "keyword", "keyboard"
      if (!/(?:^|_|[a-z])(?:token|secret|key|password)(?:$|_|[A-Z])/i.test(keyName)) return match;
      if (isPlainPlaceholder(value)) return match;
      return `${q1}${keyName}${q1}${colon}${q2}${REDACTED}${q2}`;
    },
  );

  return result;
}

/**
 * Deeply redact all strings within an object, array, or primitive.
 */
export function redactDeep(val) {
  if (val == null) return val;
  if (typeof val === 'string') return redactSecrets(val);
  if (Array.isArray(val)) return val.map(redactDeep);
  if (typeof val === 'object' && val.constructor === Object) {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = redactDeep(v);
    }
    return out;
  }
  return val;
}
