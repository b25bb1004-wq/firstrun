import fs from 'node:fs';
import path from 'node:path';
import { redactSecrets, REDACTED } from '../redact.js';

/**
 * Audit log for security guard
 * Logs to .firstrun/onboard-log.jsonl
 * Fields: time, command, verdict, decidedBy, exitCode, duration, bobCost
 * NEVER logs output or env values
 */

const LOG_DIR = '.firstrun';
const LOG_FILE = 'onboard-log.jsonl';

/**
 * Get the log file path, creating directory if needed
 */
function getLogPath(repoDir = process.cwd()) {
  const logDir = path.join(repoDir, LOG_DIR);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return path.join(logDir, LOG_FILE);
}

/**
 * Write a log entry
 */
export function logEntry(entry, repoDir = process.cwd()) {
  const logPath = getLogPath(repoDir);
  const line = JSON.stringify({
    time: new Date().toISOString(),
    command: entry.command,
    verdict: entry.verdict,
    decidedBy: entry.decidedBy,
    exitCode: entry.exitCode ?? null,
    duration: entry.duration ?? null,
    bobCost: entry.bobCost ?? 0,
    ruleId: entry.ruleId ?? null
  }) + '\n';
  
  fs.appendFileSync(logPath, line);
}

/**
 * Read all log entries
 */
function readLog(repoDir = process.cwd()) {
  const logPath = getLogPath(repoDir);
  if (!fs.existsSync(logPath)) {
    return [];
  }
  
  const content = fs.readFileSync(logPath, 'utf8');
  return content.trim().split('\n').filter(l => l).map(l => JSON.parse(l));
}

/**
 * Summarize the audit log
 * Returns: { total, ok, warn, block, totalBobCost, commandsRun, commandsBlocked, commandsWarned, summaryLine }
 */
function summarize(repoDir = process.cwd()) {
  const entries = readLog(repoDir);
  
  let ok = 0, warn = 0, block = 0;
  let totalBobCost = 0;
  let commandsRun = 0;
  let commandsBlocked = 0;
  let commandsWarned = 0;
  
  for (const e of entries) {
    if (e.verdict === 'ok') ok++;
    else if (e.verdict === 'warn') warn++;
    else if (e.verdict === 'block') block++;
    
    totalBobCost += e.bobCost || 0;
    
    if (e.exitCode !== null) {
      commandsRun++;
      if (e.verdict === 'warn') commandsWarned++;
    }
    if (e.verdict === 'block') commandsBlocked++;
  }
  
  const total = entries.length;
  const summaryLine = `${commandsRun} commands run · ${commandsBlocked} blocked · ${commandsWarned} warned · ${totalBobCost.toFixed(4)} Bobcoins`;
  
  return {
    total,
    ok,
    warn,
    block,
    totalBobCost,
    commandsRun,
    commandsBlocked,
    commandsWarned,
    summaryLine,
    entries
  };
}

/**
 * Clear the audit log (for testing)
 */
export function clearLog(repoDir = process.cwd()) {
  const logPath = getLogPath(repoDir);
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }
}

export { logEntry as log, readLog, summarize };