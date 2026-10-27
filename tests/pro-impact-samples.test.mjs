import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const dir = path.join(root, 'public/designed/examples/collection');
test('four independent Pro Impact samples preserve source provenance and contain only app UI', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'pro-impact-samples.json'), 'utf8'));
  assert.equal(manifest.samples.length, 4);
  const expected = { 'kiln-overview': [1000, 620], 'kiln-deploy': [396, 760], 'halden-journal': [420, 840], 'halden-week': [350, 404] };
  const hashes = new Set();
  for (const sample of manifest.samples) {
    const svg = fs.readFileSync(path.join(dir, sample.file), 'utf8');
    assert.deepEqual([sample.width, sample.height], expected[sample.id]);
    assert.match(svg, new RegExp(`viewBox="0 0 ${sample.width} ${sample.height}"`));
    const hash = createHash('sha256').update(svg).digest('hex');
    assert.equal(hash, sample.sha256);
    hashes.add(hash);
    assert.match(svg, /data:font\/(?:woff2|ttf);base64,/);
    assert.doesNotMatch(svg, /<image|<filter|<foreignObject|https?:\/\/[^" ]+\.(?:png|jpg|webp)|9:41|app\.kiln\.example|Ship it\.|Think further|island|browser-chrome|phone-frame/i);
    assert.equal(sample.sourceKind, 'original vector app UI');
    const original = fs.readFileSync(path.resolve(root, sample.reference.path));
    assert.equal(createHash('sha256').update(original).digest('hex'), sample.reference.sha256);
    for (const font of sample.fonts) {
      assert.ok(fs.existsSync(path.join(root, font.file)));
      assert.match(fs.readFileSync(path.join(root, font.license), 'utf8'), /SIL OPEN FONT LICENSE/i);
    }
  }
  assert.equal(hashes.size, 4);
  const overview = fs.readFileSync(path.join(dir, 'kiln-overview.svg'), 'utf8');
  assert.match(overview, /Deployments/); assert.match(overview, /Faster image pipeline/);
  const deploy = fs.readFileSync(path.join(dir, 'kiln-deploy.svg'), 'utf8');
  for (const copy of ['41', '22s', '14s', '5s', 'Open live site']) assert.ok(deploy.includes(copy));
  const journal = fs.readFileSync(path.join(dir, 'halden-journal.svg'), 'utf8');
  assert.match(journal, /#FBF8F2/); assert.match(journal, /Gelasio/); assert.match(journal, /showing up/);
  const week = fs.readFileSync(path.join(dir, 'halden-week.svg'), 'utf8');
  assert.match(week, /3,214/); assert.equal((week.match(/data-day=/g) || []).length, 7);
  assert.equal((week.match(/data-entry=/g) || []).length, 3);
});
