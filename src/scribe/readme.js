import path from 'node:path';
import { readText, fmtDuration } from '../util.js';
import { parseMarkdown } from '../markdown.js';

/**
 * Rewrite the setup instructions in place with the smallest possible diff:
 * corrected commands replace stale ones on the same line, missing commands are
 * inserted where they belong, version prerequisites are updated in the prose,
 * and one short verification line is added under the setup heading. Everything
 * else in the README stays byte-for-byte identical.
 */
export function rewriteDoc({ root, docFile, plan, evidence, passport }) {
  const original = readText(path.join(root, docFile));
  if (original == null) return null;
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.replace(/\r\n/g, '\n').split('\n');
  const md = parseMarkdown(original);
  const steps = plan.steps.filter((s) => s.source?.file === docFile);
  const byLine = new Map();
  for (const s of steps) {
    if (s.origin !== 'readme') continue;
    // Steps IBM Bob's planner read from prose may cite a file without a line (or a line outside it): the
    // README diff can't anchor them, so they're left to FIRSTRUN.md instead of crashing the Scribe.
    const k = s.source.line - 1;
    if (!Number.isInteger(k) || k < 0 || k >= lines.length) continue;
    if (!byLine.has(k)) byLine.set(k, []);
    byLine.get(k).push(s);
  }
  const inserted = (step) => plan.steps.filter((x) => x.origin === 'repair' && x.source?.insertedBefore === step.id && !x.skip);
  const evFor = (step) => evidence.filter((e) => e.stepId === step.id);
  const notesAfterBlock = new Map(); // block end line → [notes]
  const replacements = new Map(); // line index → { lines: [...], span }
  const blockOf = (line) => md.blocks.find((b) => b.start < line && line < b.end);

  for (const [lineIdx, group] of byLine) {
    const origLine = lines[lineIdx];
    const indent = origLine.match(/^\s*/)[0];
    const prompt = (origLine.trim().match(/^([$%]\s+)/) || [])[1] || '';
    let changed = false;
    const out = [];
    const parts = [];
    for (const s of group) {
      for (const ins of inserted(s)) {
        out.push(`${indent}${prompt}${ins.command}`);
        changed = true;
      }
      if (s.readmeCommand && s.readmeCommand !== s.command) changed = true;
      parts.push(s.readmeCommand ? s.command : (s.docCommand || s.command));
      for (const e of evFor(s)) {
        const d = e.fix?.doc;
        if (d?.kind === 'note' && e.status === 'verified') {
          // Env notes belong next to the env-file step, service notes next to the services step.
          const anchorStep = d.envVar ? steps.find((x) => x.kind === 'env' && !x.skip && x.origin === 'readme')
            : d.service ? steps.find((x) => x.kind === 'services' && !x.skip && x.origin === 'readme') : null;
          const b = blockOf(anchorStep ? anchorStep.source.line - 1 : lineIdx);
          if (b) {
            if (!notesAfterBlock.has(b.end)) notesAfterBlock.set(b.end, []);
            notesAfterBlock.get(b.end).push(noteText(e));
          }
        }
      }
      if (s.status === 'needs-human') {
        const e = evFor(s).slice(-1)[0];
        out.push(`${indent}# FirstRun: this step still fails on a clean machine: ${e?.diagnosis?.cause || 'see FIRSTRUN.md'}`);
        changed = true;
      }
    }
    if (!changed) continue;
    const span = Math.max(...group.map((s) => s.source.endLine || s.source.line)) - 1 - lineIdx;
    // Keep an unchanged multi-line command as written; rewrite only what changed.
    const cmdLine = `${indent}${prompt}${parts.join(' && ')}`;
    const needsCmdRewrite = group.some((s) => s.readmeCommand && s.readmeCommand !== s.command);
    const finalLines = needsCmdRewrite ? [...out.filter((l) => !l.includes('# FirstRun:')), cmdLine, ...out.filter((l) => l.includes('# FirstRun:'))]
      : [...out.filter((l) => !l.includes('# FirstRun:')), ...lines.slice(lineIdx, lineIdx + span + 1), ...out.filter((l) => l.includes('# FirstRun:'))];
    replacements.set(lineIdx, { lines: finalLines, span: needsCmdRewrite ? span : span });
  }

  // Runtime prerequisite: fix the version in the prose where the docs state it.
  const runtimeEv = evidence.find((e) => e.status === 'verified' && e.diagnosis.class === 'runtime-version' && e.fix?.doc?.runtime);
  const proseEdits = new Map();
  let prereqAdded = [];
  if (runtimeEv) {
    const { name, version } = runtimeEv.fix.doc.runtime;
    const m = (plan.originalRuntime?.source || '').match(/:(\d+) \("(.+)"\)$/);
    if (m && plan.originalRuntime.source.startsWith(docFile)) {
      const li = Number(m[1]) - 1;
      const oldFrag = m[2];
      const newFrag = oldFrag.replace(/(\d+(?:\.\d+)*)/, version);
      if (lines[li]?.includes(oldFrag)) proseEdits.set(li, lines[li].replace(oldFrag, newFrag));
    } else {
      prereqAdded.push(`${name === 'node' ? 'Node.js' : 'Python'} ${version} (${runtimeEv.fix.doc.text.replace(/^.*?\(see /, 'see ').replace(/\)$/, '')})`);
    }
  }
  for (const e of evidence) {
    if (e.status === 'verified' && e.fix?.doc?.kind === 'prerequisite' && e.diagnosis.class !== 'runtime-version') prereqAdded.push(e.fix.doc.text);
  }

  // Where does the setup section start? Put the verification line under it.
  const firstStep = steps.find((s) => s.origin === 'readme' && !s.skip) || steps[0];
  const containing = firstStep ? md.sections.filter((s) => s.line < firstStep.source.line - 1 && firstStep.source.line - 1 <= s.end) : [];
  const setupish = containing.filter((s) => /(getting[\s-]*started|install|set[\s-]*up|quick[\s-]*start|develop|local|run|usage|build|start|contribut)/i.test(s.text)).sort((a, b) => a.level - b.level);
  const setupHeading = setupish[0] || containing.sort((a, b) => b.level - a.level)[0] || null;

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (replacements.has(i)) {
      const r = replacements.get(i);
      out.push(...r.lines);
      i += r.span;
      continue;
    }
    out.push(proseEdits.has(i) ? proseEdits.get(i) : lines[i]);
    if (setupHeading && i === setupHeading.line && passport) {
      out.push('', verificationLine(passport));
      if (prereqAdded.length) {
        out.push('', 'Prerequisites verified by FirstRun:', '', ...[...new Set(prereqAdded)].map((p) => `- ${p}`));
        prereqAdded = [];
      }
    }
    if (notesAfterBlock.has(i)) {
      out.push('', ...[...new Set(notesAfterBlock.get(i))].map((n) => `> ${n}`));
    }
  }
  return { original, content: out.join('\n').replace(/\n/g, eol) };
}

function noteText(e) {
  const d = e.fix.doc;
  if (d.envVar) return `**Note:** \`${d.text.match(/^(\S+)/)[1]}\` includes \`${d.envVar}\`, which the app requires at startup${/generated|dev-/.test(JSON.stringify(e.fix.patches)) ? ' (any random string works locally)' : ''}.`;
  if (d.service) return `**Note:** ${d.text.replace(/ now also starts /, ' starts ')}`;
  return `**Note:** ${d.text}`;
}

export function verificationLine(p) {
  const when = p.verifiedAt.slice(0, 10);
  const icon = p.verdict === 'VERIFIED' ? '✅' : p.verdict === 'PARTIAL' ? '🟡' : '❌';
  return `${icon} **${p.verdict === 'VERIFIED' ? 'Verified' : p.verdict === 'PARTIAL' ? 'Partly verified' : 'Not verified'} by [FirstRun](FIRSTRUN.md)** on ${when} from a clean \`${p.image}\` machine at \`${p.commit}\`${p.verdict !== 'FAILED' ? `: clone to running in ${fmtDuration(p.replaySeconds * 1000)}` : ''}.`;
}
