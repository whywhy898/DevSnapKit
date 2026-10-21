import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { rgbaDiff } from './mockup-pixel-diff.mjs';

test('RGBA comparison rejects one changed channel including fully transparent RGB', async () => {
  const png = data => sharp(Buffer.from(data), { raw: { width: 2, height: 1, channels: 4 } }).png().toBuffer();
  const a = await png([1, 2, 3, 255, 0, 0, 0, 0]);
  assert.equal((await rgbaDiff(a, a)).differentPixels, 0);
  const b = await png([1, 2, 3, 255, 1, 0, 0, 0]);
  assert.equal((await rgbaDiff(a, b)).differentPixels, 1);
  const c = await sharp({ create: { width: 1, height: 1, channels: 4, background: '#000' } }).png().toBuffer();
  assert.equal((await rgbaDiff(a, c)).dimensionsEqual, false);
});
