import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
export async function prepareTemplateFixtures(directory) {
  await fs.mkdir(directory, { recursive: true });
  const svg = (w, h, transparent = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${transparent ? '' : '<rect width="100%" height="100%" fill="#e0f2fe"/>'}<rect x="3" y="3" width="${w - 6}" height="${h - 6}" fill="none" stroke="#ef4444" stroke-width="6"/><text x="20" y="40" font-family="Arial" font-size="22">SYNTHETIC TEST / TOP</text><text x="20" y="${h - 20}" font-family="Arial" font-size="22">BOTTOM / FULL IMAGE</text></svg>`;
  await sharp(Buffer.from(svg(600, 4000))).png().toFile(path.join(directory, 'long.png'));
  await sharp(Buffer.from(svg(600, 400, true))).png().toFile(path.join(directory, 'transparent.png'));
  await fs.writeFile(path.join(directory, 'user.svg'), svg(720, 540));
}
