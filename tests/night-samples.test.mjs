import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const directory = path.resolve(import.meta.dirname, '../public/designed/examples/collection');
test('Night examples are two distinct, self-contained, licensed fictional UI sources', () => {
  const manifestPath = path.join(directory, 'night-samples.json');
  assert.ok(fs.existsSync(manifestPath), 'Night source manifest must exist');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.records.length, 2);
  assert.deepEqual(manifest.records.map(({width, height}) => [width, height]), [[1200, 670], [600, 534]]);
  assert.equal(new Set(manifest.records.map(record => record.sha256)).size, 2);
  for (const record of manifest.records) {
    const source = fs.readFileSync(path.join(directory, record.file), 'utf8');
    assert.equal(createHash('sha256').update(source).digest('hex'), record.sha256);
    assert.match(source, /Self-authored fictional/);
    assert.match(source, /data:font\/woff2;base64,/);
    assert.doesNotMatch(source, /<script|foreignObject|<image|https?:\/\/(?!www\.w3\.org)/i);
    assert.doesNotMatch(source, /<filter|feGaussianBlur|Explore signal|More perspective/);
  }
  assert.match(fs.readFileSync(path.join(directory, manifest.font.license), 'utf8'), /SIL OPEN FONT LICENSE/);
});
