import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.env.TEMPLATE_OUTPUT || path.join(root, '../../output/devsnapkit/mockup-templates-m15-m2-2026-10-24/browser'));
const destination = path.join(root, 'public/templates');
await fs.mkdir(destination, { recursive: true });
const assets = [];
for (const id of ['social-launch', 'saas-dashboard', 'mobile-app', 'code-terminal']) {
  const filename = `${id}-default.png`, input = await fs.readFile(path.join(source, filename));
  const target = `${id}-v1.webp`;
  // Encoding and proportional downsampling only: composition is the site's real PNG.
  await sharp(input).resize({ width: 480, height: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(destination, target));
  const metadata = await sharp(path.join(destination, target)).metadata();
  assets.push({ id, version: 1, thumbnail: target, source: filename, sourceSHA256: createHash('sha256').update(input).digest('hex'), width: metadata.width, height: metadata.height, bytes: (await fs.stat(path.join(destination, target))).size, method: 'Actual in-app PNG download; proportional resize and WebP encoding only' });
}
await fs.writeFile(path.join(destination, 'sources.json'), JSON.stringify({ assets }, null, 2) + '\n');
console.log(assets.map(({ id, width, height, bytes }) => ({ id, width, height, bytes })));
