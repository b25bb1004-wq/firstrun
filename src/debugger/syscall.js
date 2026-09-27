/**
 * Syscall lens: build strace command and summarise strace logs.
 * - Builds: strace -f -e trace=file,network,process -o <file> <command>
 * - Summariser extracts: ENOENT (missing files), ECONNREFUSED (refused connections),
 *   failed execs (tool not found)
 * - All output goes through redaction
 */

import { redactSecrets } from '../redact.js';

/**
 * Build the strace command to wrap a step inside the container.
 * Returns the full command string.
 */
export function buildStraceCommand(command, outputFile) {
  // strace -f -e trace=file,network,process -o <file> -- <command>
  // -f: follow forks
  // -e trace=file,network,process: trace file ops, network, process exec
  // -o: output to file
  // --: end of options, command follows
  const straceArgs = [
    'strace',
    '-f',
    '-e', 'trace=file,network,process',
    '-o', outputFile,
    '--',
    ...command.split(' ')
  ];
  return straceArgs.join(' ');
}

/**
 * Parse a single strace line and extract useful information.
 * Returns an evidence object or null if not interesting.
 */
function parseStraceLine(line) {
  // Handle [pid N] prefix
  const cleanLine = line.replace(/^\[pid \d+\]\s*/, '');

  // ENOENT - missing file (from openat, stat, access, lstat, etc.)
  // Matches patterns like:
  // openat(AT_FDCWD, "/path", ...) = -1 ENOENT
  // stat("/path", 0x...) = -1 ENOENT
  // access("/path", F_OK) = -1 ENOENT
  // The first argument before the path is optional: openat(AT_FDCWD, "/p", ...) and access("/p", F_OK) alike.
  const enoentMatch = cleanLine.match(/(openat?|stat|lstat|access)\s*\((?:[^,"]+,\s*)?"([^"]+)"/);
  if (enoentMatch) {
    // Check if this is an ENOENT result
    if (cleanLine.includes('ENOENT')) {
      const path = enoentMatch[2];
      return {
        type: 'ENOENT',
        path,
        syscall: enoentMatch[1],
        line: line.trim(),
        severity: 'error'
      };
    }
  }

  // Also handle stat/access with hex address instead of quoted string
  // e.g., stat("/workspace/.venv", 0x7ffc12345678) = -1 ENOENT
  const enoentMatch2 = cleanLine.match(/(stat|lstat|access)\s*\(\s*"([^"]+)"\s*,\s*0x[0-9a-fA-F]+\s*\)\s*=\s*-1\s+ENOENT/);
  if (enoentMatch2) {
    const path = enoentMatch2[2];
    return {
      type: 'ENOENT',
      path,
      syscall: enoentMatch2[1],
      line: line.trim(),
      severity: 'error'
    };
  }

  // ECONNREFUSED - connection refused
  const connRefusedMatch = cleanLine.match(/connect\s*\([^)]*\{[^}]+\}[^)]*\)\s*=\s*-1\s+ECONNREFUSED\s+\(Connection refused\)/);
  if (connRefusedMatch) {
    // Extract address and port from sockaddr
    const addrMatch = cleanLine.match(/connect\s*\([^,]+,\s*\{[^}]*sin_port=htons\((\d+)\)[^}]*sin_addr=inet_addr\("([^"]+)"\)/);
    let host = 'unknown';
    let port = 'unknown';
    if (addrMatch) {
      port = addrMatch[1];
      host = addrMatch[2];
    } else {
      // Try IPv6 format
      const addrMatch6 = cleanLine.match(/connect\s*\([^,]+,\s*\{[^}]*sin6_port=htons\((\d+)\)/);
      if (addrMatch6) {
        port = addrMatch6[1];
        const hostMatch6 = cleanLine.match(/sin6_addr=inet_pton\([^,]+,\s*"([^"]+)"\)/);
        if (hostMatch6) host = hostMatch6[1];
      }
    }
    return {
      type: 'ECONNREFUSED',
      host,
      port: Number(port),
      line: line.trim(),
      severity: 'error'
    };
  }

  // Failed exec - tool not found (ENOENT on execve)
  const execMatch = cleanLine.match(/execve\s*\(\s*"([^"]+)"\s*,\s*\[([^\]]*)\]\s*(?:,\s*[^)]*)?\)\s*=\s*-1\s+ENOENT\s+\(No such file or directory\)/);
  if (execMatch) {
    const tool = execMatch[1];
    const args = execMatch[2];
    return {
      type: 'EXEC_NOT_FOUND',
      tool,
      args,
      line: line.trim(),
      severity: 'error'
    };
  }

  // Other exec failures (permission denied, etc.)
  const execFailMatch = cleanLine.match(/execve\s*\(\s*"([^"]+)"\s*,\s*\[([^\]]*)\]\s*(?:,\s*[^)]*)?\)\s*=\s*-1\s+E(\w+)/);
  if (execFailMatch) {
    const tool = execFailMatch[1];
    const args = execFailMatch[2];
    const errno = execFailMatch[3];
    return {
      type: 'EXEC_FAILED',
      tool,
      args,
      errno,
      line: line.trim(),
      severity: errno === 'ENOENT' ? 'error' : 'warn'
    };
  }

  return null;
}

/**
 * Summarise a strace log file into short evidence lines.
 * Returns array of evidence objects with type, details, and redacted line.
 */
export function summariseStraceLog(logContent) {
  const evidence = [];
  const seen = new Set(); // Deduplicate by type+path/host+port/tool

  for (const line of logContent.split('\n')) {
    const parsed = parseStraceLine(line);
    if (!parsed) continue;

    // Create a dedup key
    let key;
    if (parsed.type === 'ENOENT' || parsed.type === 'STAT_ENOENT') {
      key = `${parsed.type}:${parsed.path}`;
    } else if (parsed.type === 'ECONNREFUSED') {
      key = `${parsed.type}:${parsed.host}:${parsed.port}`;
    } else if (parsed.type === 'EXEC_NOT_FOUND' || parsed.type === 'EXEC_FAILED') {
      key = `${parsed.type}:${parsed.tool}`;
    } else {
      key = `${parsed.type}:${parsed.line.slice(0, 100)}`;
    }

    if (seen.has(key)) continue;
    seen.add(key);

    // Redact the line
    const redactedLine = redactSecrets(parsed.line);

    evidence.push({
      id: `strace-${evidence.length + 1}`,
      type: parsed.type,
      severity: parsed.severity,
      detail: {
        ...parsed,
        line: redactedLine
      }
    });
  }

  return evidence;
}

/**
 * Convenience function to run a command under strace in the sandbox
 * and return the summarised evidence.
 * This is the injected runner for testing.
 */
export async function runWithStrace(sandbox, command, outputPath) {
  const straceCmd = buildStraceCommand(command, outputPath);
  const result = await sandbox.exec(straceCmd);

  // Read the strace output file
  const logContent = await sandbox.readFile(outputPath);
  if (!logContent) {
    return { evidence: [], rawOutput: result.out, exitCode: result.exitCode };
  }

  const evidence = summariseStraceLog(logContent);
  return { evidence, rawOutput: result.out, exitCode: result.exitCode };
}

/**
 * Convert evidence to short human-readable lines for the debugger UI.
 */
export function evidenceToLines(evidence) {
  return evidence.map(e => {
    const d = e.detail;
    switch (e.type) {
      case 'ENOENT':
        return `ENOENT missing file: ${d.path}`;
      case 'ECONNREFUSED':
        return `ECONNREFUSED connection refused: ${d.host}:${d.port}`;
      case 'EXEC_NOT_FOUND':
        return `exec: ${d.tool} not found`;
      case 'EXEC_FAILED':
        return `exec: ${d.tool} failed (${d.errno})`;
      case 'STAT_ENOENT':
        return `${d.syscall}: ${d.path} not found`;
      default:
        return `${e.type}: ${d.line}`;
    }
  });
}