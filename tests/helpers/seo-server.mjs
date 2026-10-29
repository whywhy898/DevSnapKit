import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Local fixture server receives the browser's real beacon bytes. Puppeteer's
// request interception does not expose Blob beacon bodies reliably in Chrome.
export async function startSeoServer(getStats, requestedOrigin, allowPro = () => false) {
  const root = fileURLToPath(new URL('../../dist/', import.meta.url));
  const events = [];
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/api/telemetry/event' && request.method === 'POST') {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        events.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('{"ok":true}');
        return;
      }
      if (pathname === '/api/admin/stats') {
        const authenticated = request.headers.authorization === 'Bearer qa-fixture-token';
        response.writeHead(authenticated ? 200 : 401, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(authenticated ? getStats() : { success: false }));
        return;
      }
      if (pathname === '/api/verify-license') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ valid: allowPro(), tier: 'pro_lifetime' }));
        return;
      }
      if (pathname.startsWith('/api/')) {
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end('{"success":false,"error":"Not configured in local fixture"}');
        return;
      }
      let target = path.resolve(root, '.' + decodeURIComponent(pathname));
      if (!target.startsWith(path.resolve(root) + path.sep) && target !== path.resolve(root)) {
        response.writeHead(403); response.end(); return;
      }
      if (pathname.startsWith('/admin')) target = path.join(root, 'index.html');
      else if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
      const bytes = await fs.readFile(target);
      response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(bytes);
    } catch {
      response.writeHead(404); response.end();
    }
  });
  const wanted = requestedOrigin ? new URL(requestedOrigin) : null;
  if (wanted && !['127.0.0.1', 'localhost'].includes(wanted.hostname)) throw Error('SEO fixture server requires a loopback origin');
  await new Promise(resolve => server.listen(wanted ? Number(wanted.port || 80) : 0, '127.0.0.1', resolve));
  return { events, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
