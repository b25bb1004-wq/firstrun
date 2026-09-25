// Hosted instant check: GET /api/check?repo=owner/name
import { checkGithubRepo, CheckError } from '../src/remote.js';

const hits = new Map(); // best-effort per-instance rate limit
const LIMIT = 20, WINDOW_MS = 10 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return res.status(429).json({ error: 'Too many checks from your network. Try again in a few minutes.' });
  recent.push(now); hits.set(ip, recent);
  try {
    const result = await checkGithubRepo(req.query.repo);
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json(result);
  } catch (err) {
    const status = err instanceof CheckError ? err.status : 500;
    return res.status(status).json({ error: status === 500 ? 'The check failed unexpectedly. Try again, or run `firstrun plan` locally.' : err.message });
  }
}
