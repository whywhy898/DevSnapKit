import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const publicRoot = new URL('../public/', import.meta.url);
const exampleRoot = new URL('seo/examples/', publicRoot);
const manifest = JSON.parse(readFileSync(new URL('landing-examples.json', exampleRoot), 'utf8'));

test('published example records match the actual downloaded PNG files', () => {
  assert.equal(manifest.examples.length, 3);
  assert.deepEqual(manifest.examples.map(item => item.page).sort(), ['add-text-to-image', 'og-image-generator', 'product-hunt-image-maker']);
  for (const item of manifest.examples) {
    assert.equal(new URL(item.source).protocol, 'https:');
    assert.equal(item.originals.length, item.page === 'product-hunt-image-maker' ? 2 : 1);
    for (const asset of [...item.originals, item.export]) {
      const bytes = readFileSync(new URL(asset.file, exampleRoot));
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', asset.file);
      assert.equal(bytes.readUInt32BE(16), asset.width, `${asset.file}: width`);
      assert.equal(bytes.readUInt32BE(20), asset.height, `${asset.file}: height`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.file);
    }
  }
});

test('static resource URLs and page-local anchors resolve before deployment', () => {
  for (const slug of ['screenshot-beautifier', ...manifest.examples.map(item => item.page)]) {
    const html = readFileSync(new URL(`${slug}/index.html`, publicRoot), 'utf8');
    for (const [, target] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (target.startsWith('#')) {
        assert.ok(html.includes(`id="${target.slice(1)}"`), `${slug}: ${target}`);
      } else if (target.startsWith('/') && !target.startsWith('/?') && target !== '/') {
        const path = target.endsWith('/') ? `${target.slice(1)}index.html` : target.slice(1);
        assert.ok(existsSync(new URL(path, publicRoot)), `${slug}: ${target}`);
      }
    }
  }
});
