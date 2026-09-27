// For each lablab submission: pull its declared links from the page, then inspect the GitHub repo for what was built.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const GH = 'C:/Program Files/GitHub CLI/gh.exe';
const slugs = fs.readFileSync('slugs.txt', 'utf8').trim().split('\n');
const pick = (h, k) => { const m = h.match(new RegExp('\\\\"' + k + '\\\\":\\\\"([^\\\\"]*)')); return m ? m[1] : ''; };
const gh = (path) => { try { return JSON.parse(execFileSync(GH, ['api', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 })); } catch { return null; } };
const ghRaw = (args) => { try { return execFileSync(GH, ['api', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); } catch { return ''; } };

async function page(slug) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch('https://lablab.ai/ai-hackathons/ibm-bob-2-hackathon/' + slug, { headers: { 'user-agent': 'Mozilla/5.0' } }); if (r.ok) return await r.text(); } catch {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  return '';
}

function inspectRepo(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/#?]+)/); if (!m) return { repo: url ? 'non-github' : 'none' };
  const full = m[1] + '/' + m[2].replace(/\.git$/, '');
  const r = gh('repos/' + full); if (!r) return { repo: full, error: 'not found/private' };
  const tree = gh(`repos/${full}/git/trees/${r.default_branch}?recursive=1`);
  const files = (tree?.tree || []).filter((t) => t.type === 'blob').map((t) => t.path);
  const codeExt = /\.(js|ts|tsx|jsx|mjs|py|go|rs|java|kt|swift|rb|php|cs|c|cpp|sol|sh)$/i;
  const code = files.filter((f) => codeExt.test(f) && !/node_modules|dist\/|build\/|vendor\//.test(f));
  const tests = files.filter((f) => /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[jt]sx?$|(^|\/)test_[^/]+\.py$/i.test(f));
  // commit count via the Link header of a 1-per-page listing
  const head = ghRaw(['-i', `repos/${full}/commits?per_page=1`]);
  const last = (head.match(/page=(\d+)>; rel="last"/) || [])[1];
  const commits = last ? Number(last) : (head.includes('"sha"') ? 1 : 0);
  const langs = gh(`repos/${full}/languages`) || {};
  const topLang = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k).join('+');
  return {
    repo: full, created: (r.created_at || '').slice(0, 10), pushed: (r.pushed_at || '').slice(0, 16), sizeKB: r.size, stars: r.stargazers_count,
    files: files.length, codeFiles: code.length, testFiles: tests.length, commits, lang: topLang,
    docker: files.some((f) => /(^|\/)(Dockerfile|docker-compose\.ya?ml|compose\.ya?ml)$/.test(f)),
    bobModes: files.some((f) => /(^|\/)\.bob\//.test(f)), bobSessions: files.some((f) => /bob[_-]?sessions?\//i.test(f)),
    ci: files.some((f) => f.startsWith('.github/workflows/')), mcp: files.some((f) => /mcp/i.test(f)),
  };
}

const out = [];
let i = 0;
async function worker() {
  while (i < slugs.length) {
    const slug = slugs[i++];
    const h = await page(slug);
    const rec = { slug, repoLink: pick(h, 'repoLink'), demoUrl: pick(h, 'demoUrl'), demoPlatform: pick(h, 'demoPlatform'),
      slides: !!pick(h, 'presentationLink'), video: /lablab-video-submissions/.test(h) };
    Object.assign(rec, inspectRepo(rec.repoLink));
    out.push(rec);
    process.stderr.write('.');
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync('scan.json', JSON.stringify(out, null, 1));
console.log('\n' + out.length + ' scanned');
