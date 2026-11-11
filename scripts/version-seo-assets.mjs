// Run after Vite (and any prerendering): public/ assets bypass Vite's hashing.
// Only built HTML is rewritten; source HTML and asset bytes stay unchanged.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultDist = fileURLToPath(new URL('../dist/', import.meta.url));

export function versionSeoAssets(distRoot = defaultDist) {
  const seoRoot = path.resolve(distRoot, 'seo');
  const hashes = new Map();
  let pages = 0;

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(file);
      } else if (/\.html$/i.test(entry.name)) {
        const html = readFileSync(file, 'utf8');
        // Include preloads, templates and inline references as well as src/href.
        const updated = html.replace(/(\/seo\/[^\s"'<>?#\\]+\.(?:css|js))(\?[^\s"'<>#\\]*)?(#[^\s"'<>\\]*)?/g, (reference, pathname, query = '', fragment = '') => {
          const asset = path.resolve(distRoot, '.' + decodeURIComponent(pathname));
          const relative = path.relative(seoRoot, asset);
          if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new Error(`SEO asset escapes dist/seo: ${pathname}`);
          }
          if (!hashes.has(asset)) {
            hashes.set(asset, createHash('sha256').update(readFileSync(asset)).digest('hex').slice(0, 10));
          }
          const params = new URLSearchParams(query.slice(1).replace(/&amp;/g, '&'));
          params.delete('v');
          const separator = query.includes('&amp;') ? '&amp;' : '&';
          const rest = params.toString().replace(/&/g, separator);
          return `${pathname}?v=${hashes.get(asset)}${rest ? separator + rest : ''}${fragment}`;
        });
        if (updated !== html) {
          writeFileSync(file, updated);
          pages++;
        }
      }
    }
  }

  walk(distRoot);
  return { pages, assets: hashes.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { pages, assets } = versionSeoAssets();
  console.log(`Versioned ${assets} SEO assets in ${pages} built HTML pages.`);
}
