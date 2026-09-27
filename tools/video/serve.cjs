// Minimal static server for tools/video/capture.cjs: node tools/video/serve.cjs <root> <port>
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2]); const port = +process.argv[3] || 4190;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ndjson': 'application/x-ndjson', '.md': 'text/markdown', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(port, '127.0.0.1', () => console.log('serving', root, 'on', port));
