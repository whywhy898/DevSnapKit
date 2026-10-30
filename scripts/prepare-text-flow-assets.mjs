import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.TEXT_DEMO_OUTPUT || 'D:/workspace/MarkMoney/output/devsnapkit/text-hero-redesign-2026-10-30';
const assets = path.join(root, 'public/seo/examples');
const records = {};
for (const [source, target] of [['captured-source.png', 'text-source.png'], ['actual-export.png', 'text-result.png'], ['guide-upload.png', 'text-flow-upload.webp'], ['guide-edit.png', 'text-flow-edit.webp']]) {
  const bytes = await fs.readFile(path.join(output, source));
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const file = path.join(assets, target);
  const image = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  await (target.endsWith('.webp') ? image.webp({ lossless: true }) : image.png()).toFile(file);
  assert.ok(data.equals(await sharp(file).ensureAlpha().raw().toBuffer()), target + ': decoded pixels unchanged');
  const metadata = await sharp(file).metadata();
  assert.ok(!metadata.exif && !metadata.xmp && !metadata.iptc && !metadata.icc, target + ': metadata removed');
  const result = await fs.readFile(file);
  const chunks = [];
  if (target.endsWith('.png')) {
    for (let offset = 8; offset + 12 <= result.length;) {
      const size = result.readUInt32BE(offset);
      chunks.push(result.toString('ascii', offset + 4, offset + 8));
      offset += size + 12;
    }
    assert.ok(chunks.every(type => ['IHDR','IDAT','IEND','pHYs'].includes(type)), target + ': no ancillary provenance chunks');
  } else {
    for (let offset = 12; offset + 8 <= result.length;) {
      const size = result.readUInt32LE(offset + 4);
      chunks.push(result.toString('ascii', offset, offset + 4));
      offset += size + 8 + size % 2;
    }
    assert.ok(chunks.every(type => ['VP8L','VP8X','ALPH','VP8 '].includes(type)), target + ': image chunks only');
  }
  records[target] = { file: target, width: info.width, height: info.height, sha256: createHash('sha256').update(result).digest('hex') };
}
const manifestPath = path.join(assets, 'landing-examples.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const example = manifest.examples.find(item => item.page === 'add-text-to-image');
Object.assign(example, {
  source: 'https://devsnapkit.com/seo/examples/text-source.png',
  description: 'Owned illustrative Clear Skies interface, captured as a real browser screenshot from tests/fixtures/text-demo-source.html. Imported through the actual studio UI; one editable Gelasio 42 px headline added above it. Actual 2x PNG download. The capture introduction provides OS shortcut instructions; it does not claim to record the OS overlay.',
  originals: [records['text-source.png']], export: records['text-result.png'],
});
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
// Keep intrinsic dimensions and social metadata tied to the genuine download.
const htmlPath = path.join(root, 'public/add-text-to-image/index.html');
const html = await fs.readFile(htmlPath, 'utf8');
await fs.writeFile(htmlPath, html.replaceAll('1632', String(records['text-result.png'].height)));
await fs.writeFile(path.join(output, 'assets.json'), JSON.stringify(records, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, assets: records }));
