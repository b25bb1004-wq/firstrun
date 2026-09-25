// Unified-diff renderer with line numbers, word-level highlights and evidence tags.
import { h, raw, esc } from './lib.js';

const tok = s => s.split(/(\s+|[^\w\s])/).filter(x => x !== '');

function intraline(a, b) {
  const A = tok(a), B = tok(b);
  let p = 0;
  while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let s = 0;
  while (s < A.length - p && s < B.length - p && A[A.length - 1 - s] === B[B.length - 1 - s]) s++;
  const wrap = (T) => esc(T.slice(0, p).join('')) + (T.length - s > p ? `<mark>${esc(T.slice(p, T.length - s).join(''))}</mark>` : '') + esc(T.slice(T.length - s).join(''));
  // only highlight when the lines are recognisably related
  if (p + s < 1) return [esc(a), esc(b)];
  return [wrap(A), wrap(B)];
}

function evidenceFor(line, evidence) {
  const l = line.toLowerCase();
  if (l.includes('verified by firstrun')) return null;
  for (const e of evidence) {
    const c = [];
    const f = e.fix || {};
    if (f.doc?.text && f.doc.text.length < 90) c.push(f.doc.text);
    for (const a of f.actions || []) {
      if (a.command) c.push(a.command);
      if (a.type === 'rebase' && a.image) { const tag = (a.image.split(':')[1] || '').match(/\d+(\.\d+)+/); if (tag) c.push(tag[0]); }
      if (a.type === 'service' && a.name) c.push(a.name);
    }
    if (c.some(x => x && x.length >= 4 && l.includes(x.toLowerCase()))) return e;
    if (c.some(x => x && x.length >= 4 && x.toLowerCase().includes(l.trim()) && l.trim().length > 8)) return e;
  }
  return null;
}

export function renderDiff(text, { evidence = [], runId = '' } = {}) {
  const rows = [];
  let o = 0, n = 0;
  const lines = text.replace(/\n$/, '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('--- ') || l.startsWith('+++ ')) continue;
    const m = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
    if (m) { o = +m[1]; n = +m[2]; rows.push({ t: 'hunk', text: l }); continue; }
    if (l.startsWith('-')) rows.push({ t: 'del', o: o++, text: l.slice(1) });
    else if (l.startsWith('+')) rows.push({ t: 'add', n: n++, text: l.slice(1) });
    else rows.push({ t: 'ctx', o: o++, n: n++, text: l.slice(1) });
  }
  // pair del/add blocks for word highlights
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].t !== 'del') continue;
    let j = i; while (j < rows.length && rows[j].t === 'del') j++;
    let k = j; while (k < rows.length && rows[k].t === 'add') k++;
    const dels = rows.slice(i, j), adds = rows.slice(j, k);
    for (let x = 0; x < Math.min(dels.length, adds.length); x++) {
      const [a, b] = intraline(dels[x].text, adds[x].text);
      dels[x].html = a; adds[x].html = b;
    }
    i = k - 1;
  }
  let adds = 0, dels = 0;
  const body = rows.map(r => {
    if (r.t === 'hunk') return h`<tr class="d-hunk"><td colspan="4">${r.text}</td></tr>`;
    if (r.t === 'add') adds++; if (r.t === 'del') dels++;
    const ev = r.t === 'add' ? evidenceFor(r.text, evidence) : null;
    const sign = r.t === 'add' ? '+' : r.t === 'del' ? '-' : '';
    return h`<tr class="d-${r.t}"><td class="ln">${r.o ?? ''}</td><td class="ln">${r.n ?? ''}</td><td class="sg">${sign}</td><td class="tx"><span>${raw(r.html ?? esc(r.text))}</span>${ev ? h`<a class="ev-tag" href="#/run/${runId}/${ev.id}" title="Backed by evidence ${ev.id}">${ev.id}</a>` : ''}</td></tr>`;
  });
  return { html: h`<table class="diff"><colgroup><col class="c-ln"><col class="c-ln"><col class="c-sg"><col></colgroup><tbody>${body}</tbody></table>`, adds, dels };
}
