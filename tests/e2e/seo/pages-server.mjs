// Tiny static server that behaves like GitHub Pages for a built site: folders redirect to a
// trailing slash and serve index.html, unknown paths get the site's 404.html (status 404).
// The site can be mounted under a base path to mimic a project site (/TexturesOnline/).
//   node tests/e2e/seo/pages-server.mjs <dist> [port] [base]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

export function startPagesServer({ dist, port = 0, base = '/' }) {
  const b = base.endsWith('/') ? base : `${base}/`;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = async (file, status = 200) => {
      const body = await readFile(file);
      res.writeHead(status, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    };
    const notFound = async () => {
      try {
        await send(join(dist, '404.html'), 404);
      } catch {
        res.writeHead(404).end('not found');
      }
    };
    let path = decodeURIComponent(url.pathname);
    if (path === b.slice(0, -1)) {
      res.writeHead(301, { location: b + url.search }).end();
      return;
    }
    if (!path.startsWith(b)) return notFound();
    const rel = normalize(path.slice(b.length)).replace(/^(\.\.[/\\])+/, '');
    const file = join(dist, rel);
    try {
      const st = await stat(file);
      if (st.isDirectory()) {
        if (!path.endsWith('/')) {
          res.writeHead(301, { location: `${path}/${url.search}` }).end();
          return;
        }
        return await send(join(file, 'index.html'));
      }
      return await send(file);
    } catch {
      return notFound();
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: p } = server.address();
      resolve({ url: `http://127.0.0.1:${p}${b}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dist, port = '5780', base = '/'] = process.argv.slice(2);
  const s = await startPagesServer({ dist, port: Number(port), base });
  console.log(`serving ${dist} at ${s.url}`);
}
