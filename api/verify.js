// Hosted verify trigger: POST /api/verify { repo, ref? }
import { parseGithubRepo } from '../src/remote.js';

const GH_TOKEN = process.env.HOSTED_VERIFY_TOKEN;
const GH_REPO = process.env.HOSTED_VERIFY_REPO || 'b25bb1004-wq/firstrun';
const WORKFLOW = 'hosted-verify.yml';

// Simple in-memory rate limit: 5 requests per IP per minute
const RATE_LIMIT = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const window = RATE_LIMIT.get(ip) || { count: 0, windowStart: now };
  if (now - window.windowStart > RATE_WINDOW_MS) {
    window.count = 0;
    window.windowStart = now;
  }
  if (window.count >= RATE_MAX) return false;
  window.count++;
  RATE_LIMIT.set(ip, window);
  return true;
}

function validateRef(ref) {
  if (!ref) return true;
  if (ref.length > 100) return false;
  if (ref.includes('..')) return false;
  return /^[A-Za-z0-9._/-]{1,100}$/.test(ref);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!GH_TOKEN) return res.status(500).json({ error: 'Server not configured: missing HOSTED_VERIFY_TOKEN' });

  // Rate limit per IP
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
  }

  const { repo, ref } = req.body || {};
  if (!repo) return res.status(400).json({ error: 'Missing repo (owner/name)' });

  // Validate ref
  if (!validateRef(ref)) {
    return res.status(400).json({ error: 'Invalid ref format' });
  }

  const parsed = parseGithubRepo(repo);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid repository format. Use owner/name or a GitHub URL.' });
  }

  // Generate unique request_id for run correlation
  const requestId = crypto.randomBytes(8).toString('hex');

  try {
    const response = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GH_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { 
          repo: `${parsed.owner}/${parsed.name}`, 
          ref: ref || '',
          request_id: requestId
        }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: `GitHub API error: ${response.status} ${err}` });
    }

    res.status(202).json({ 
      status: 'triggered', 
      repo: `${parsed.owner}/${parsed.name}`, 
      ref: ref || 'default',
      request_id: requestId
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to trigger workflow' });
  }
}