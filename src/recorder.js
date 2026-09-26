import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { ensureDir, writeJson, nowIso, tail, redactSecrets, redactDeep } from './util.js';

/**
 * Everything a run produces goes through here: the append-only event log the
 * dashboard streams, run.json (current state), plan.json, evidence records and
 * full step logs. See docs/ARCHITECTURE.md.
 */
export class Recorder extends EventEmitter {
  constructor(dir, { id, repo, commit }) {
    super();
    this.dir = ensureDir(dir);
    ensureDir(path.join(dir, 'logs'));
    ensureDir(path.join(dir, 'evidence'));
    ensureDir(path.join(dir, 'out'));
    this.eventsFile = path.join(dir, 'events.ndjson');
    fs.writeFileSync(this.eventsFile, '');
    this.state = { id, repo, commit, startedAt: nowIso(), phase: 'scout', steps: {}, evidence: [], bobcoins: 0, conflicts: [] };
    this.logThrottle = new Map();
    this.save();
  }

  emitEvent(agent, type, data = {}) {
    const cleanData = redactDeep(data);
    const ev = { t: nowIso(), run: this.state.id, agent, type, data: cleanData };
    fs.appendFileSync(this.eventsFile, `${JSON.stringify(ev)}\n`);
    this.emit('event', ev);
    return ev;
  }

  /** Stream step output, batched so the event log stays small. */
  log(stepId, n, chunk) {
    const key = `${stepId}#${n}`;
    const entry = this.logThrottle.get(key) || { buf: '', last: 0 };
    entry.buf += chunk;
    const now = Date.now();
    if (now - entry.last > 700 || entry.buf.length > 4000) {
      this.emitEvent('runner', 'step.log', { stepId, n, chunk: tail(entry.buf, 25) });
      entry.buf = '';
      entry.last = now;
    }
    this.logThrottle.set(key, entry);
  }

  flushLog(stepId, n) {
    const key = `${stepId}#${n}`;
    const entry = this.logThrottle.get(key);
    if (entry?.buf) this.emitEvent('runner', 'step.log', { stepId, n, chunk: tail(entry.buf, 25) });
    this.logThrottle.delete(key);
  }

  phase(phase, agent = 'swarm') {
    this.state.phase = phase;
    this.save();
    this.emitEvent(agent, 'phase', { phase });
  }

  stepStatus(stepId, status, attempts) {
    const s = this.state.steps[stepId] || { status: 'pending', attempts: 0 };
    s.status = status;
    if (attempts !== undefined) s.attempts = attempts;
    this.state.steps[stepId] = s;
    this.save();
  }

  writeLog(name, text) {
    const file = path.join(this.dir, 'logs', `${name}.log`);
    fs.writeFileSync(file, redactSecrets(text));
    return `logs/${name}.log`;
  }

  evidence(record) {
    const cleanRecord = redactDeep(record);
    writeJson(path.join(this.dir, 'evidence', `${cleanRecord.id}.json`), cleanRecord);
    if (!this.state.evidence.includes(cleanRecord.id)) this.state.evidence.push(cleanRecord.id);
    this.save();
    this.emitEvent('doctor', 'evidence', cleanRecord);
  }

  artifact(name, rel) {
    this.emitEvent('scribe', 'artifact', { name, path: rel });
  }

  savePlan(plan) {
    const cleanPlan = redactDeep(plan);
    this.state.plan = cleanPlan;
    writeJson(path.join(this.dir, 'plan.json'), cleanPlan);
    this.save();
  }

  save() {
    writeJson(path.join(this.dir, 'run.json'), redactDeep(this.state));
  }
}
