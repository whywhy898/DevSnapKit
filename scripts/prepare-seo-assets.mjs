import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { stat } from 'node:fs/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = resolve(root, 'public/seo');
const backdrop = process.argv[2];
for (const name of ['screenshot-before', 'screenshot-after']) {
  const output = resolve(assets, `${name}.webp`);
  await sharp(resolve(assets, `${name}.png`)).webp({ quality: 88 }).toFile(output);
  console.log(`${name}.webp: ${(await stat(output)).size} bytes`);
}
if (backdrop) {
  const output = resolve(assets, 'studio-backdrop.webp');
  await sharp(backdrop).resize({ width: 1100, withoutEnlargement: true }).webp({ quality: 78 }).toFile(output);
  console.log(`studio-backdrop.webp: ${(await stat(output)).size} bytes`);
}
