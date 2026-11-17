import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
export function lastModified(source) {
  const options = { cwd: root, encoding: 'utf8' };
  const changed = execFileSync('git', ['status', '--porcelain', '--', source], options).trim();
  if (changed) return new Date().toISOString().slice(0, 10);
  return execFileSync('git', ['log', '-1', '--format=%cs', '--', source], options).trim();
}
export function renderSitemap() {
  const slugs = fs.readdirSync(new URL('public/', root), { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(new URL(`public/${e.name}/index.html`, root)))
    .map(e => e.name).filter(s => !['welcome', 'poster'].includes(s)).sort();
  const entries = [['/', 'index.html'], ...slugs.map(s => [`/${s}/`, ['terms', 'privacy'].includes(s) ? 'src/legal/legalContent.json' : `public/${s}/index.html`])];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + entries.map(([url, source]) => `  <url>\n    <loc>https://devsnapkit.com${url}</loc>\n    <lastmod>${lastModified(source)}</lastmod>\n  </url>\n`).join('') + '</urlset>\n';
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(new URL('public/sitemap.xml', root), renderSitemap());
  console.log('Sitemap generated from individual source dates.');
}
