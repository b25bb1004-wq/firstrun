import fs from 'node:fs';
import path from 'node:path';
import { redactSecrets, REDACTED } from '../redact.js';
import { askBob as realAskBob } from '../brain/bob.js';

/**
 * Security Guard - deterministic rules layer
 * classify(command, ctx) returns { verdict: 'ok'|'warn'|'block', reason, ruleId }
 * 
 * Block: deleting outside the repo, disk/format tools, recursive chmod 777 on home/root,
 * writing to shell profiles or SSH keys, fork bombs, disabling security tools,
 * reading credential stores, any step whose cwd resolves outside the repo
 * 
 * Warn: sudo/admin elevation; pipe-to-shell; global installs; commands not in proven run;
 * downloads from domains not in proven run
 */

const BLOCK_PATTERNS = [
  // rm -rf on dangerous paths
  { regex: /\brm\s+.*-rf\s+(\/(\s|$)|~(\s|$)|\.\.(\s|$)|[A-Za-z]:\\|\\\\\w)/i, id: 'block-rm-rf-root', reason: 'deletes outside repo' },
  { regex: /\brm\s+.*-rf\s+\//i, id: 'block-rm-rf-root-abs', reason: 'deletes from root' },
  { regex: /\brm\s+.*-rf\s+~/i, id: 'block-rm-rf-home', reason: 'deletes home directory' },
  { regex: /\brm\s+.*-rf\s+\.\./i, id: 'block-rm-rf-parent', reason: 'deletes parent directory' },
  
  // PowerShell Remove-Item -Recurse on dangerous paths
  { regex: /Remove-Item\s+.*-Recurse\s+(\/|~|\.\.|[A-Za-z]:\\|\\\\\w)/i, id: 'block-ps-remove-recurse', reason: 'deletes outside repo' },
  
  // Disk/format tools
  { regex: /\b(mkfs|fdisk|parted|format|dd\s+if=.*of=\/(dev|disk))\b/i, id: 'block-disk-tools', reason: 'disk/format tool' },
  
  // Recursive chmod 777 on home/root
  { regex: /\bchmod\s+.*-R\s+.*777\s+(\/(\s|$)|~(\s|$)|\.\.(\s|$)|home|root)/i, id: 'block-chmod-777', reason: 'recursive chmod 777 on sensitive path' },
  
  // Writing to shell profiles
  { regex: /\b(echo|printf|cat|tee)\s+.*\s*>>?\s*~?\/?\.(bashrc|zshrc|profile|bash_profile|zprofile|config\/fish)\b/i, id: 'block-shell-profile', reason: 'writes to shell profile' },
  { regex: /\b(Add-Content|Set-Content|Out-File)\s+.*\$PROFILE\b/i, id: 'block-ps-profile', reason: 'writes to PowerShell profile' },
  
  // Writing to SSH keys
  { regex: /\b(echo|printf|cat|tee)\s+.*\s*>>?\s*~?\/\.ssh\/(id_|authorized_keys|known_hosts|config)\b/i, id: 'block-ssh-keys', reason: 'writes to SSH keys' },
  
  // Fork bombs
  { regex: /:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}/, id: 'block-fork-bomb-bash', reason: 'fork bomb' },
  { regex: /while\s*\(\s*true\s*\)\s*\{\s*fork\s*&\s*\}/i, id: 'block-fork-bomb-while', reason: 'fork bomb' },
  
  // Disabling security tools
  { regex: /\b(systemctl|service)\s+(stop|disable)\s+(apparmor|selinux|firewalld|ufw|iptables)\b/i, id: 'block-disable-security', reason: 'disables security tool' },
  { regex: /setenforce\s+0\b/i, id: 'block-setenforce', reason: 'disables SELinux' },
  
  // Reading credential stores
  { regex: /\b(cat|less|more|head|tail)\s+~?\/\.ssh\/(id_rsa|id_ed25519|id_ecdsa|id_dsa)\b/i, id: 'block-read-ssh-private', reason: 'reads SSH private key' },
  { regex: /\b(cat|less|more|head|tail)\s+~?\/\.aws\/credentials\b/i, id: 'block-read-aws-creds', reason: 'reads AWS credentials' },
  { regex: /\b(cat|less|more|head|tail)\s+~?\/\.docker\/config\.json\b/i, id: 'block-read-docker-config', reason: 'reads Docker config' },
  { regex: /\b(security|certutil)\s+.*(dump|export).*keychain/i, id: 'block-keychain-dump', reason: 'dumps keychain' },
  
  // Browser profile reading
  { regex: /\b(cat|less|more|head|tail|sqlite3)\s+~?\/\.(mozilla|firefox|chrome|chromium|google-chrome|brave|edge)\/.*\/(Login Data|cookies|logins\.json|signons\.sqlite)\b/i, id: 'block-browser-creds', reason: 'reads browser credentials' },
  { regex: /\b(cat|less|more|head|tail|sqlite3)\s+~?\/\.(mozilla|firefox|chrome|chromium|google-chrome|brave|edge)\b/i, id: 'block-browser-profile', reason: 'reads browser profile' },
];

const WARN_PATTERNS = [
  // sudo/admin elevation
  { regex: /^\s*sudo\s+/i, id: 'warn-sudo', reason: 'requires sudo/admin elevation' },
  { regex: /^\s*runas\s+/i, id: 'warn-runas', reason: 'requires admin elevation' },
  { regex: /^\s*Start-Process\s+.*-Verb\s+runAs\b/i, id: 'warn-ps-admin', reason: 'requires admin elevation' },
  
  // Pipe-to-shell
  { regex: /\bcurl\s+.*\|\s*(sh|bash|zsh|fish)\b/i, id: 'warn-curl-pipe-shell', reason: 'pipe-to-shell' },
  { regex: /\bwget\s+.*\|\s*(sh|bash|zsh|fish)\b/i, id: 'warn-wget-pipe-shell', reason: 'pipe-to-shell' },
  { regex: /\biwr\s+.*\|\s*iex\b/i, id: 'warn-iwr-pipe-iex', reason: 'pipe-to-shell (PowerShell)' },
  { regex: /\binvoke-webrequest\s+.*\|\s*iex\b/i, id: 'warn-invoke-webrequest-iex', reason: 'pipe-to-shell (PowerShell)' },
  
  // Global npm installs
  { regex: /\bnpm\s+(i|install|add)\s+-g\b/i, id: 'warn-npm-global', reason: 'global npm install' },
  { regex: /\byarn\s+global\s+add\b/i, id: 'warn-yarn-global', reason: 'global yarn install' },
  { regex: /\bpnpm\s+add\s+-g\b/i, id: 'warn-pnpm-global', reason: 'global pnpm install' },
  
  // Global pip installs (outside venv)
  { regex: /\bpip\s+(install|3?\s+install)\s+(?!.*--user)(?!.*-e\s+\.)\S+/i, id: 'warn-pip-global', reason: 'pip install outside venv' },
  { regex: /\bpip3\s+(install)\s+(?!.*--user)(?!.*-e\s+\.)\S+/i, id: 'warn-pip3-global', reason: 'pip3 install outside venv' },
  
  // Commands not in proven run - handled separately
  
  // Downloads from new domains - handled separately
];

// Allow-list of read-only probe commands (proven to write nothing outside temp dir)
const PROBE_ALLOWLIST = [
  /^\s*(node|npm|npx|pnpm|yarn|bun)\s+--version\s*$/i,
  /^\s*(python3?|pip3?|pipx|uv|poetry|pipenv)\s+--version\s*$/i,
  /^\s*(docker|docker-compose|docker compose)\s+version\s*$/i,
  /^\s*(git|make|cmake|gcc|clang)\s+--version\s*$/i,
  /^\s*(which|where|command\s+-v|type)\s+\S+\s*$/i,
  /^\s*(ss|netstat|lsof)\s+-[a-z]*\s*$/i,
  /^\s*(uname|lsb_release|cat\s+\/etc\/os-release)\s*$/i,
  /^\s*(free|df|lsblk)\s+-[a-z]*\s*$/i,
  /^\s*(ps|top|htop)\s+-[a-z]*\s*$/i,
  /^\s*(env|printenv)\s*$/i,
];

/**
 * Check if a command is in the probe allow-list (read-only)
 */
export function isProbeCommand(command) {
  const trimmed = command.trim();
  return PROBE_ALLOWLIST.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a path resolves outside the repo
 */
export function pathResolvesOutsideRepo(targetPath, repoDir) {
  const resolved = path.resolve(repoDir, targetPath);
  const resolvedRepo = path.resolve(repoDir);
  return !resolved.startsWith(resolvedRepo + path.sep) && resolved !== resolvedRepo;
}

/**
 * Extract domains from a command (for download checks)
 */
function extractDomains(command) {
  const domains = [];
  // curl/wget URLs
  const urlMatches = command.matchAll(/(?:curl|wget|iwr|invoke-webrequest)\s+(?:-O\s+|-o\s+)?(['"]?)((?:https?:\/\/)?([^\/\s'"]+))/gi);
  for (const match of urlMatches) {
    const domain = match[3];
    if (domain && !domain.startsWith('$') && !domain.startsWith('{')) {
      domains.push(domain.toLowerCase());
    }
  }
  // npm/yarn/pnpm registry
  const registryMatches = command.matchAll(/(?:npm|yarn|pnpm)\s+(?:config\s+set\s+registry|publish|install)\s+(?:https?:\/\/)?([^\/\s]+)/gi);
  for (const match of registryMatches) {
    domains.push(match[1].toLowerCase());
  }
  return [...new Set(domains)];
}

/**
 * Deterministic classification of a command
 */
export function classify(command, ctx = {}) {
  const { repoDir = process.cwd(), provenRunCommands = [], provenRunDomains = [] } = ctx;
  
  // Check block patterns first
  for (const rule of BLOCK_PATTERNS) {
    if (rule.regex.test(command)) {
      return { verdict: 'block', reason: rule.reason, ruleId: rule.id };
    }
  }
  
  // Check if cwd resolves outside repo
  if (ctx.cwd && pathResolvesOutsideRepo(ctx.cwd, repoDir)) {
    return { verdict: 'block', reason: 'cwd resolves outside repo', ruleId: 'block-cwd-outside-repo' };
  }
  
  // Check warn patterns
  for (const rule of WARN_PATTERNS) {
    if (rule.regex.test(command)) {
      return { verdict: 'warn', reason: rule.reason, ruleId: rule.id };
    }
  }
  
  // Check if command is in proven run
  const normalizedCmd = command.trim();
  const inProvenRun = provenRunCommands.some(c => c.trim() === normalizedCmd);
  
  if (!inProvenRun && provenRunCommands.length > 0) {
    return { verdict: 'warn', reason: 'command not in proven run', ruleId: 'warn-not-in-proven-run' };
  }
  
  // Check download domains
  const cmdDomains = extractDomains(command);
  const newDomains = cmdDomains.filter(d => !provenRunDomains.includes(d));
  if (newDomains.length > 0) {
    return { verdict: 'warn', reason: `download from new domain(s): ${newDomains.join(', ')}`, ruleId: 'warn-new-domain' };
  }
  
  return { verdict: 'ok', reason: 'no issues found', ruleId: 'ok' };
}

/**
 * Security review with Bob (only for warn or not-in-proven-run)
 * Final verdict = STRICTER of rules and Bob; Bob can never loosen
 */
export async function securityReview(command, ctx, { askBob = realAskBob, maxCost = 0.05 } = {}) {
  const { repoDir = process.cwd(), provenRunCommands = [], provenRunDomains = [] } = ctx;
  
  // First, run deterministic rules
  const ruleResult = classify(command, { repoDir, provenRunCommands, provenRunDomains, cwd: ctx.cwd });
  
  // Only call Bob if rules return warn or command not in proven run
  const shouldAskBob = ruleResult.verdict === 'warn' || 
    (provenRunCommands.length > 0 && !provenRunCommands.some(c => c.trim() === command.trim()));
  
  if (!shouldAskBob) {
    return { ...ruleResult, decidedBy: 'rules', bobCost: 0 };
  }
  
  // Prepare request for Bob
  const request = `# HUMBLE Security Review

Command: \`${command}\`
CWD: ${ctx.cwd || repoDir}
Repo: ${repoDir}
Rule verdict: ${ruleResult.verdict} (${ruleResult.ruleId}: ${ruleResult.reason})

Proven run commands (${provenRunCommands.length}):
${provenRunCommands.slice(0, 20).map(c => `- \`${c}\``).join('\n')}
${provenRunCommands.length > 20 ? `... and ${provenRunCommands.length - 20} more` : ''}

Proven run domains (${provenRunDomains.length}):
${provenRunDomains.map(d => `- ${d}`).join('\n')}

Decide: ok, warn, or block.
Your verdict can ONLY make the command stricter (ok → warn → block), NEVER looser than the rules.
Rules said: ${ruleResult.verdict}
- If rules say "ok", you may say "warn" or "block"
- If rules say "warn", you may say "block"  
- You can NEVER loosen (block → warn, warn → ok, block → ok are forbidden)

Block criteria: deleting outside repo, disk/format tools, recursive chmod 777 on home/root, writing to shell profiles/SSH keys, fork bombs, disabling security tools, reading credential stores (~/.ssh, ~/.aws, browser profiles, keychains), any step whose cwd resolves outside the repo.

Warn criteria: sudo/admin elevation; pipe-to-shell (curl … | sh, iwr … | iex; show the domain); global installs (npm i -g, pip install outside venv); commands not in the proven run; downloads from domains not in the proven run.

Reply with ONLY one JSON object in a \`\`\`json block:
\`\`\`json
{ "verdict": "ok"|"warn"|"block", "reason": "string", "evidence": ["rule-id-or-domain"] }
\`\`\``;
  
  try {
    const res = await askBob({ 
      mode: 'firstrun-security', 
      request, 
      workspace: repoDir, 
      maxCost,
      maxTurns: 4,
      name: 'security-review'
    });
    
    if (!res.ok || !res.json) {
      return { ...ruleResult, decidedBy: 'rules', bobCost: 0, bobError: res.error };
    }
    
    const bobVerdict = res.json.verdict;
    const bobReason = res.json.reason;
    const bobEvidence = Array.isArray(res.json.evidence) ? res.json.evidence : [];
    
    // Validate Bob's verdict - can only tighten
    const severity = { ok: 0, warn: 1, block: 2 };
    const ruleSeverity = severity[ruleResult.verdict];
    const bobSeverity = severity[bobVerdict] ?? 0;
    
    // Discard Bob answer without evidence
    if (!Array.isArray(bobEvidence) || bobEvidence.length === 0) {
      return { ...ruleResult, decidedBy: 'rules', bobCost: res.bobcoins || 0, bobError: 'Bob answer discarded: missing evidence citations' };
    }
    
    if (bobSeverity < ruleSeverity) {
      // Bob tried to loosen - reject, keep rules verdict
      return { 
        ...ruleResult, 
        decidedBy: 'rules', 
        bobCost: res.bobcoins || 0,
        bobAttemptedLoosen: true,
        bobVerdict: bobVerdict,
        bobReason: bobReason
      };
    }
    
    // Bob tightened or agreed - use Bob's verdict (stricter)
    return {
      verdict: bobVerdict,
      reason: bobReason,
      ruleId: bobEvidence[0] || 'bob',
      decidedBy: 'bob',
      bobCost: res.bobcoins || 0,
      bobEvidence: bobEvidence,
      ruleVerdict: ruleResult.verdict
    };
  } catch (e) {
    // Bob failed - fall back to rules
    return { ...ruleResult, decidedBy: 'rules', bobCost: 0, bobError: e.message };
  }
}

/**
 * Summarize a security review for the audit log
 */
export function summarizeSecurityReview(result) {
  return {
    verdict: result.verdict,
    reason: result.reason,
    decidedBy: result.decidedBy,
    ruleId: result.ruleId,
    bobCost: result.bobCost || 0
  };
}

export { classify as default };