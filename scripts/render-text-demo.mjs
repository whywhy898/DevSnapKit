import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(process.env.TEXT_DEMO_OUTPUT || 'D:/workspace/MarkMoney/output/devsnapkit/text-demo-video-2026-10-30');
const assets = path.join(root, 'public/seo/video');
const flow = process.env.TEXT_DEMO_FLOW === '1';
const name = flow ? 'add-text-flow' : 'add-text-demo';
await fs.mkdir(assets, { recursive: true });
const recording = JSON.parse(await fs.readFile(path.join(output, 'recording.json'), 'utf8'));
assert.equal(recording.passed, true, 'A genuine successful recording is required.');
const probe = file => {
  const process = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size,tags:stream=codec_name,codec_type,width,height,pix_fmt,avg_frame_rate', '-of', 'json', file], { encoding: 'utf8', windowsHide: true });
  assert.equal(process.status, 0, process.stderr);
  return JSON.parse(process.stdout);
};
const raw = probe(path.join(output, 'raw.mp4'));
const rawDuration = Number(raw.format.duration);
const hold = 3.6;
const fade = .4;
const stage = { x: 112, y: 52, width: 1056, height: 594 };
const duration = rawDuration + hold - fade;
const xml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
async function png(bytes, file) {
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toFile(file);
}

const groups = [
  ...(flow ? [{ name: 'capture', title: 'Capture an area. Windows: Win + Shift + S', step: '01 / 06' }, { name: 'import', title: 'Replace Image. Import your screenshot.', step: '02 / 06' }] : []),
  { name: 'original', title: 'Start with your screenshot.', step: '01 / 05' },
  { name: 'add', title: 'Add a text box. Write your headline.', step: '02 / 05' },
  { name: 'font', title: 'Choose the type. Set the size.', step: '03 / 05' },
  { name: 'move', title: 'Give your words room to breathe.', step: '04 / 05' },
  { name: 'export', title: 'Download the finished image.', step: '05 / 05' },
];
if (flow) {
  groups.splice(groups.findIndex(group => group.name === 'original'), 1);
  groups.forEach((group, index) => group.step = `${String(index + 1).padStart(2, '0')} / ${String(groups.length).padStart(2, '0')}`);
}
const captions = groups.map((group, index) => ({ ...group, start: index === 0 ? 0 : recording.marks.find(mark => mark.name === group.name).at, end: index + 1 < groups.length ? recording.marks.find(mark => mark.name === groups[index + 1].name).at : duration }));
const captionFiles = [];
for (let i = 0; i < captions.length; i++) {
  const caption = captions[i];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect x="112" y="12" width="74" height="28" rx="14" fill="#e7e1fc"/><text x="149" y="31" text-anchor="middle" font-family="Segoe UI,Arial" font-size="12" font-weight="700" fill="#5941b8">${caption.step}</text><text x="202" y="33" font-family="Segoe UI,Arial" font-size="22" font-weight="600" fill="#182638">${xml(caption.title)}</text><text x="1168" y="31" text-anchor="end" font-family="Segoe UI,Arial" font-size="14" font-weight="600" fill="#53657c">DevSnapKit</text></svg>`;
  const file = path.join(output, `caption-${i + 1}.png`);
  await png(Buffer.from(svg), file);
  captionFiles.push(file);
}

const mask = path.join(output, 'stage-mask.png');
await png(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}"><rect width="${stage.width}" height="${stage.height}" rx="18" fill="white"/></svg>`), mask);
const exported = await fs.readFile(path.join(output, 'actual-export.png'));
const exportMetadata = await sharp(exported).metadata();
const finalImage = await sharp(exported).resize({ width: 1056, height: 586, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
const finalSize = await sharp(finalImage).metadata();
const end = path.join(output, 'result-card.png');
const resultLabel = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><text x="112" y="33" font-family="Segoe UI,Arial" font-size="22" font-weight="600" fill="#182638">Your screenshot. Your words. Ready to share.</text><text x="1168" y="31" text-anchor="end" font-family="Segoe UI,Arial" font-size="14" font-weight="600" fill="#53657c">DevSnapKit</text></svg>')).png().toBuffer();
const endBuffer = await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#f2f5fa' } }).composite([
  { input: finalImage, left: Math.round((1280 - finalSize.width) / 2), top: 56 },
  { input: resultLabel, left: 0, top: 0 },
]).png().toBuffer();
await png(endBuffer, end);

// Smooth camera paths are computed over the raw recording's real timeline.
// The recorded UI and pointer remain untouched; only the view into it moves.
const points = recording.marks.filter(mark => mark.name !== 'done');
function expression(property) {
  let expression = String(points[0][property]);
  for (let i = 1; i < points.length; i++) {
    const mark = points[i], previous = points[i - 1];
    const start = mark.at, transition = .75;
    const u = `min(1,max(0,(on/30-${start.toFixed(5)})/${transition}))`;
    const ease = `(${u}*${u}*(3-2*${u}))`;
    const lerp = `(${previous[property]}+(${mark[property]}-${previous[property]})*${ease})`;
    expression = `if(lt(on/30,${start.toFixed(5)}),${expression},${lerp})`;
  }
  return expression;
}
const zoom = expression('zoom'), x = expression('x'), y = expression('y');
const graph = [
  `[0:v]fps=30,scale=3200:1800:flags=lanczos,zoompan=z='${zoom}':x='max(0,min(iw-iw/zoom,iw*(${x})-iw/(2*zoom)))':y='max(0,min(ih-ih/zoom,ih*(${y})-ih/(2*zoom)))':d=1:s=${stage.width}x${stage.height}:fps=30,format=rgba[view]`,
  '[1:v]alphaextract[mask]',
  '[view][mask]alphamerge[rounded]',
  `color=c=0xf2f5fa:s=1280x720:r=30:d=${rawDuration}[background]`,
  `[background][rounded]overlay=${stage.x}:${stage.y}:shortest=1[framed]`,
];
let previous = 'framed';
for (let i = 0; i < captions.length; i++) {
  const caption = captions[i], label = `captioned${i}`;
  graph.push(`[${previous}][${i + 2}:v]overlay=0:0:enable='gte(t,${caption.start.toFixed(5)})*lt(t,${Math.min(caption.end, rawDuration).toFixed(5)})':shortest=1[${label}]`);
  previous = label;
}
const finalIndex = 2 + captionFiles.length;
graph.push(`[${previous}]format=yuv420p,settb=AVTB[footage]`);
graph.push(`[${finalIndex}:v]fps=30,trim=duration=${hold},settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p[end]`);
graph.push(`[footage][end]xfade=transition=fade:duration=${fade}:offset=${(rawDuration - fade).toFixed(5)},format=yuv420p[video]`);
const filterFile = path.join(output, 'edit-filter.txt');
await fs.writeFile(filterFile, graph.join(';\n'));
const target = path.join(assets, `${name}.mp4`);
const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(output, 'raw.mp4'), '-loop', '1', '-i', mask];
for (const file of captionFiles) args.push('-loop', '1', '-i', file);
args.push('-loop', '1', '-i', end, '-filter_complex_script', filterFile, '-map', '[video]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30', '-t', duration.toFixed(5), '-map_metadata', '-1', '-movflags', '+faststart', target);
const render = spawnSync('ffmpeg', args, { encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 2 * 1024 * 1024 });
assert.equal(render.status, 0, render.stderr);

// The poster is a real successful export laid out on the same final card.
const { data, info } = await sharp(end).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const poster = path.join(assets, `${name}-poster.webp`);
await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).webp({ lossless: true }).toFile(poster);
assert.ok(data.equals(await sharp(poster).ensureAlpha().raw().toBuffer()), 'Poster preserves pixels.');
const posterBytes = await fs.readFile(poster);
const posterChunks = [];
for (let offset = 12; offset + 8 <= posterBytes.length;) {
  const size = posterBytes.readUInt32LE(offset + 4), type = posterBytes.subarray(offset, offset + 4).toString();
  posterChunks.push(type); offset += 8 + size + size % 2;
}
assert.ok(posterChunks.every(type => ['VP8L', 'VP8X', 'ALPH', 'VP8 '].includes(type)), 'Poster contains image chunks only.');
function stamp(time) {
  const ms = Math.round(time * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
const cues = recording.marks.filter(mark => mark.name !== 'done').map((mark, index, all) => ({ start: mark.at, end: index + 1 < all.length ? all[index + 1].at : rawDuration - fade, text: mark.caption }));
cues.push({ start: rawDuration - fade, end: duration, text: 'The actual downloaded image, with the finished headline.' });
await fs.writeFile(path.join(assets, `${name}.en.vtt`), 'WEBVTT\n\n' + cues.map(cue => `${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.text}\n`).join('\n'));
const final = probe(target);
assert.equal(final.streams[0].codec_name, 'h264');
assert.equal(final.streams[0].width, 1280);
assert.equal(final.streams[0].height, 720);
assert.equal(final.streams[0].pix_fmt, 'yuv420p');
assert.ok(Number(final.format.size) < 20 * 1024 * 1024, 'Video remains within static asset size budget.');
const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', target, '-f', 'null', '-'], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
assert.equal(decode.status, 0, decode.stderr);
const bytes = await fs.readFile(target);
const manifest = { passed: true, capture: recording.capture, reference: 'Editing grammar only; no Google footage or music reused.', rawDuration, duration: Number(final.format.duration), format: final.streams[0], bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), actualExport: { width: exportMetadata.width, height: exportMetadata.height, sha256: createHash('sha256').update(exported).digest('hex') }, captions, cues, poster: { chunks: posterChunks, pixelsUnchanged: true }, published: `/seo/video/${name}.mp4` };
await fs.writeFile(path.join(output, 'render.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, duration: manifest.duration, bytes: manifest.bytes, target }));
