const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
function createPreviewServer() {
  return http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const requested = path.resolve(root, `.${pathname}`);
      if (requested !== root && !requested.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      const candidates = [requested, requested + '.html', path.join(requested, 'index.html')];
      // Expo dynamic app routes boot from the index, like Vercel's SPA fallback.
      if (!path.extname(pathname)) candidates.push(path.join(root, 'index.html'));
      for (const candidate of candidates) {
        try {
          if (!(await fs.stat(candidate)).isFile()) continue;
          res.writeHead(200, { 'Content-Type': types[path.extname(candidate)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
          res.end(await fs.readFile(candidate)); return;
        } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
      }
      res.writeHead(404).end('Not found');
    } catch { res.writeHead(500).end('Preview error'); }
  });
}
module.exports = { createPreviewServer };
if (require.main === module) createPreviewServer().listen(Number(process.env.PORT || 4190), '127.0.0.1', () => console.log('Rankr preview ready'));
