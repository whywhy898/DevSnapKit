import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'public/designed/examples/next-stage');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('NEXT samples are two self-contained fictional screens with traceable raw assets', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'samples.json'), 'utf8'));
  assert.match(manifest.provenance, /self-authored/i);
  assert.match(manifest.artwork.sourceKind, /generated/i);
  assert.equal(manifest.artwork.sha256, sha(fs.readFileSync(path.join(root, manifest.artwork.file))));
  assert.equal(manifest.font.sha256, sha(fs.readFileSync(path.join(root, manifest.font.file))));
  assert.match(fs.readFileSync(path.join(root, manifest.font.license), 'utf8'), /SIL OPEN FONT LICENSE/);
  assert.equal(manifest.samples.length, 2);
  const ids = new Set();
  for (const sample of manifest.samples) {
    const raw = fs.readFileSync(path.join(dir, sample.file));
    const svg = raw.toString('utf8');
    assert.equal(sample.sha256, sha(raw));
    assert.equal(sample.sourceKind, 'self-authored fictional app UI');
    assert.deepEqual([sample.width, sample.height], [410, 722]);
    assert.match(svg, /viewBox="0 0 410 722"/);
    assert.match(svg, /data:font\/woff2;base64,/);
    assert.match(svg, /data:image\/png;base64,/);
    assert.doesNotMatch(svg, /\r|<foreignObject|<filter|9:41|10:24|data-phone|phone-frame|battery|status-bar/i);
    assert.doesNotMatch(svg, /(?:href|src)="https?:/);
    ids.add(sample.id);
  }
  assert.deepEqual([...ids], ['tone-player', 'tone-collection']);
  const player = fs.readFileSync(path.join(dir, 'tone-player.svg'), 'utf8');
  const collection = fs.readFileSync(path.join(dir, 'tone-collection.svg'), 'utf8');
  assert.match(player, /A new perspective/);
  assert.equal((player.match(/data-wave=/g) || []).length, 56);
  assert.match(collection, /Your collection/);
  assert.equal((collection.match(/data-playlist=/g) || []).length, 3);
});

test('NEXT sample generator rebuilds identical bytes', () => {
  const files = ['tone-player.svg', 'tone-collection.svg', 'samples.json'];
  const before = files.map(file => sha(fs.readFileSync(path.join(dir, file))));
  execFileSync(process.execPath, ['scripts/build-next-stage-samples.mjs'], {cwd: root, stdio: 'pipe'});
  assert.deepEqual(files.map(file => sha(fs.readFileSync(path.join(dir, file)))), before);
});
