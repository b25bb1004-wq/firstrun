// Hosted verify status: GET /api/verify-status?repo=owner/name&run_id=...
import { parseGithubRepo } from '../src/remote.js';

const GH_TOKEN = process.env.HOSTED_VERIFY_TOKEN;
const GH_REPO = process.env.HOSTED_VERIFY_REPO || 'b25bb1004-wq/firstrun';
const WORKFLOW = 'hosted-verify.yml';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (!GH_TOKEN) return res.status(500).json({ error: 'Server not configured: missing HOSTED_VERIFY_TOKEN' });

  const { repo, run_id } = req.query;
  if (!repo) return res.status(400).json({ error: 'Missing repo (owner/name)' });

  let parsed;
  try {
    parsed = parseGithubRepo(repo);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const fullRepo = `${parsed.owner}/${parsed.name}`;

  try {
    let runId = run_id;
    let runUrl = `https://api.github.com/repos/${GH_REPO}/actions/runs`;
    
    if (!runId) {
      // Find the latest run for this repo input
      const params = new URLSearchParams({
        workflow: WORKFLOW,
        per_page: '20',
        branch: 'main',
      });
      const runsResp = await fetch(`${runUrl}?${params}`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${GH_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!runsResp.ok) {
        return res.status(502).json({ error: `GitHub API error: ${runsResp.status}` });
      }
      const runsData = await runsResp.json();
      const run = runsData.workflow_runs?.find(r => 
        r.inputs?.repo === fullRepo && r.conclusion !== 'cancelled'
      );
      if (!run) {
        return res.status(404).json({ error: 'No workflow run found for this repo', status: 'not_found' });
      }
      runId = run.id;
    }

    // Get run details
    const runResp = await fetch(`${runUrl}/${runId}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GH_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!runResp.ok) {
      return res.status(502).json({ error: `GitHub API error: ${runResp.status}` });
    }
    const runData = await runResp.json();

    const status = runData.status;
    const conclusion = runData.conclusion;

    if (status === 'completed') {
      if (conclusion === 'success') {
        // Fetch artifact
        const artResp = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/runs/${runId}/artifacts`, {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${GH_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
        if (!artResp.ok) {
          return res.status(502).json({ error: `GitHub API error: ${artResp.status}` });
        }
        const artData = await artResp.json();
        const artifact = artData.artifacts?.find(a => a.name.startsWith('firstrun-verify-'));
        
        if (artifact) {
          // Download and extract the artifact
          const zipResp = await fetch(artifact.archive_download_url, {
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${GH_TOKEN}`,
              'X-GitHub-Api-Version': '2022-11-28',
            },
          });
          if (!zipResp.ok) {
            return res.status(502).json({ error: `Failed to download artifact: ${zipResp.status}` });
          }
          const zipBuffer = await zipResp.arrayBuffer();
          
          // Extract passport and evidence from zip
          // For now, return the artifact info - the UI can fetch the full data
          return res.status(200).json({
            status: 'completed',
            conclusion: 'success',
            run_id: runId,
            artifact: {
              name: artifact.name,
              size: artifact.size_in_bytes,
              download_url: artifact.archive_download_url,
            },
            message: 'Verification completed. Artifact available for download.',
          });
        }
        return res.status(200).json({
          status: 'completed',
          conclusion: 'success',
          run_id: runId,
          message: 'Verification completed but no artifact found.',
        });
      } else if (conclusion === 'failure') {
        // Try to get logs/artifact for failure details
        return res.status(200).json({
          status: 'completed',
          conclusion: 'failure',
          run_id: runId,
          message: 'Verification failed. Check workflow logs.',
        });
      }
      return res.status(200).json({
        status: 'completed',
        conclusion: conclusion,
        run_id: runId,
        message: `Verification ${conclusion}.`,
      });
    }

    // Still running
    return res.status(200).json({
      status: status,
      conclusion: conclusion,
      run_id: runId,
      message: 'Verification in progress...',
    });

  } catch (e) {
    res.status(500).json({ error: 'Failed to check workflow status' });
  }
}