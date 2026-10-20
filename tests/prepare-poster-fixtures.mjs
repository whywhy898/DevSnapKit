import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = path.dirname(fileURLToPath(import.meta.url));
const destination = path.join(root, 'fixtures/poster-v1');
await fs.mkdir(destination, { recursive: true });
for (const [name, width, height, color] of [
  ['landscape', 1440, 900, '#e6edf5'], ['square', 1080, 1080, '#e0f1e8'],
  ['phone', 390, 844, '#eae2fa'], ['ultrawide', 2400, 600, '#fae7cf'],
  ['detail', 800, 400, '#edf4dd'], ['logo', 128, 128, '#f1ca40'],
]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/><rect x="3" y="3" width="${width-6}" height="${height-6}" fill="none" stroke="#bd2445" stroke-width="6"/><rect x="20" y="20" width="${width-40}" height="50" rx="8" fill="#263b4c"/><text x="35" y="54" font-family="Arial" font-size="24" fill="white">ORBIT / ${name} / ${width} × ${height}</text><text x="25" y="${height-25}" font-family="Arial" font-size="22" fill="#263b4c">BOTTOM EDGE — complete image</text><circle cx="${width/2}" cy="${height/2}" r="${Math.min(width,height)/5}" fill="#e3bb34"/><path d="M 30 ${height/2} H ${width-30}" stroke="#263b4c" stroke-width="5"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(destination, name+'.png'));
}
for (const [source, target] of [['honeywerank-original.png','honey-main.png'], ['honeywerank-publishing.png','honey-detail.png']]) {
  await fs.copyFile(path.resolve(root, '../../../output/devsnapkit', source), path.join(destination, target));
}
await fs.writeFile(path.join(destination, 'corrupt.png'), 'not a PNG');
console.log('Prepared 9 local poster test fixtures with visible edge markers.');
