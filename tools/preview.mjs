#!/usr/bin/env node
// Local preview of the hosted site: serves web/public with vercel.json's rewrites (so /api/* resolves to the static
// data), exactly like firstrun-sigma.vercel.app. No dependencies; works on macOS, Linux and Windows.
//
//   node tools/preview.mjs            → http://localhost:4390
//   PORT=5000 node tools/preview.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const pub = path.join(root, 'web', 'public');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const port = Number(process.env.PORT) || 4390;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.md': 'text/plain; charset=utf-8', '.ndjson': 'text/plain; charset=utf-8',
};
const match = (src, p) => {
  const keys = [];
  const re = new RegExp('^' + src.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  const m = p.match(re); if (!m) return null;
  const o = {}; keys.forEach((k, i) => { o[k] = m[i + 1]; }); return o;
};

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  let p = u.pathname;
  for (const r of cfg.rewrites || []) {
    const m = match(r.source, p); if (!m) continue;
    if (r.has && !u.searchParams.get('path')) continue;
    m.p = u.searchParams.get('path');
    p = r.destination.replace(/:(\w+)/g, (_, k) => m[k]);
    break;
  }
  let f = path.join(pub, decodeURIComponent(p));
  if (!f.startsWith(pub)) { res.writeHead(403); return res.end('403'); } // never serve outside web/public
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('404 ' + p); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`HUMBLE preview: http://localhost:${port}`));
