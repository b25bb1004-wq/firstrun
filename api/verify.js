// Hosted verify trigger: POST /api/verify { repo, ref? }
import { parseGithubRepo } from '../src/remote.js';

const GH_TOKEN = process.env.HOSTED_VERIFY_TOKEN;
const GH_REPO = process.env.HOSTED_VERIFY_REPO || 'b25bb1004-wq/firstrun';
const WORKFLOW = 'hosted-verify.yml';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!GH_TOKEN) return res.status(500).json({ error: 'Server not configured: missing HOSTED_VERIFY_TOKEN' });

  const { repo, ref } = req.body || {};
  if (!repo) return res.status(400).json({ error: 'Missing repo (owner/name)' });

  let parsed;
  try {
    parsed = parseGithubRepo(repo);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

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
        inputs: { repo: `${parsed.owner}/${parsed.name}`, ref: ref || '' }
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: `GitHub API error: ${response.status} ${err}` });
    }

    res.status(202).json({ status: 'triggered', repo: `${parsed.owner}/${parsed.name}`, ref: ref || 'default' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to trigger workflow' });
  }
}