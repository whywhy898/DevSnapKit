import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'seo', 'examples');
for (const example of ['github', 'mdn', 'astro']) {
  for (const version of ['original', 'styled']) {
    const source = resolve(root, `${example}-${version}.png`);
    const output = resolve(root, `${example}-${version}.webp`);
    const info = await sharp(source).webp({ quality: 91 }).toFile(output);
    console.log(JSON.stringify({ example, version, width: info.width, height: info.height, bytes: info.size }));
  }
}
