import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(process.env.TEXT_DEMO_OUTPUT || 'D:/workspace/MarkMoney/output/devsnapkit/text-demo-video-2026-10-30');
const directory = path.join(output, 'review');
await fs.mkdir(directory, { recursive: true });
const manifest = JSON.parse(await fs.readFile(path.join(output, 'render.json'), 'utf8'));
const times = [...new Set([0, 2.5, 4.8, 7, 9.8, 12.9, 16, 18, 21.8, 24.6, 26.8, 29, manifest.duration - .3].map(time => Math.min(time, manifest.duration - .3)))];
const records = [];
for (const seconds of times) {
  const process = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', String(seconds), '-i', path.join(root, 'public/seo/video/add-text-demo.mp4'), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'], { windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  assert.equal(process.status, 0, process.stderr?.toString());
  assert.ok(process.stdout.length, 'A decoded frame is required at ' + seconds);
  const file = `frame-${String(seconds).padStart(4, '0')}.png`;
  const { data, info } = await sharp(process.stdout).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toFile(path.join(directory, file));
  records.push({ seconds, file });
}
for (let offset = 0; offset < records.length; offset += 9) {
  const batch = records.slice(offset, offset + 9), overlays = [];
  for (let index = 0; index < batch.length; index++) {
    const record = batch[index], left = index % 3 * 480, top = Math.floor(index / 3) * 298;
    overlays.push({ input: await sharp(path.join(directory, record.file)).resize({ width: 480 }).png().toBuffer(), left, top });
    overlays.push({ input: Buffer.from(`<svg width="480" height="28"><rect width="480" height="28" fill="#182638"/><text x="10" y="20" font-family="Arial" font-size="18" fill="white">${record.seconds}s</text></svg>`), left, top: top + 270 });
  }
  await sharp({ create: { width: 1440, height: Math.ceil(batch.length / 3) * 298, channels: 3, background: '#182638' } }).composite(overlays).png().toFile(path.join(directory, `contact-${Math.floor(offset / 9) + 1}.png`));
}
await fs.writeFile(path.join(directory, 'frames.json'), JSON.stringify(records, null, 2) + '\n');
console.log(JSON.stringify({ frames: records.length, output: directory }));
