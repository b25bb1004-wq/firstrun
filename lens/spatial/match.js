// Spatial context: find the failing line and the prompt ON SCREEN (spec section 17, layer 2). Deterministic: the
// doctor already knows which log line matched (matchedLine) and which command ran; we look for those among the OCR
// lines, tolerant to OCR noise, then fall back to generic error signatures.

const GENERIC = /(npm ERR!|\bERR_[A-Z_]+|\bE[A-Z]{4,}\b|\bError:|\berror:|Traceback \(most recent call last\)|\bFATAL\b|\bfatal:|command not found|is not recognized as|No such file or directory|ModuleNotFoundError|exit code [1-9])/;
const PROMPT = /^(PS [A-Za-z]:\\[^>]*>|[A-Za-z]:\\[^>]*>|\S*[$#%❯➜]\s)/;

export const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Share of the needle's tokens present in the line; OCR splits and merges words, so tokens beat substrings.
export function overlap(line, needle) {
  const have = new Set(squash(line).split(' '));
  const want = squash(needle).split(' ').filter((t) => t.length > 1);
  return want.length ? want.filter((t) => have.has(t)).length / want.length : 0;
}

// Newest output is at the bottom of a terminal, so the last qualifying line wins.
export function findOnScreen(ocr, { matchedLine, command } = {}) {
  const lines = ocr.lines || [];
  const last = (ok) => lines.reduce((hit, l) => (ok(l) ? l : hit), null);
  let error = matchedLine ? last((l) => overlap(l.text, matchedLine) >= 0.75) : null;
  const how = error ? 'rule' : (error = last((l) => GENERIC.test(l.text))) ? 'generic' : null;
  const prompt = (command && last((l) => overlap(l.text, command) >= 0.8)) || last((l) => PROMPT.test(l.text.trim()));
  return { error, prompt, how };
}
