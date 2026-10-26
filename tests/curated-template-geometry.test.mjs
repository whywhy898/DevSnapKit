import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';

const load = createTypeScriptLoader(fileURLToPath(new URL('../src/', import.meta.url)));
const geometry = load('templates/collection/geometry.ts');
const plain = value => JSON.parse(JSON.stringify(value));
function frameFromRect(...args) {
  assert.equal(typeof geometry.frameFromRect, 'function', 'canvas-aware frameFromRect must be implemented');
  return geometry.frameFromRect(...args);
}

for (const [width, height] of [[1200, 630], [1600, 1200], [1080, 1920]]) {
  test(`full ${width}×${height} canvas maps to a centered unit frame`, () => {
    assert.deepEqual(plain(frameFromRect({ width, height }, { x: 0, y: 0, width, height })), {
      centerX: .5, centerY: .5, widthRatio: 1, heightRatio: 1, rotation: 0,
    });
  });
}

test('offset rectangles use each canvas axis and preserve rotation without mutation', () => {
  const canvas = { width: 1200, height: 630 };
  const rect = { x: 120, y: 63, width: 600, height: 315 };
  const before = structuredClone({ canvas, rect });
  assert.deepEqual(plain(frameFromRect(canvas, rect, -3)), {
    centerX: .35, centerY: .35, widthRatio: .5, heightRatio: .5, rotation: -3,
  });
  assert.deepEqual({ canvas, rect }, before);
});

test('bleed coordinates remain allowed', () => {
  assert.deepEqual(plain(frameFromRect({ width: 100, height: 200 }, { x: -50, y: -100, width: 200, height: 400 }, 360)), {
    centerX: .5, centerY: .5, widthRatio: 2, heightRatio: 2, rotation: 360,
  });
});

test('non-finite geometry and non-positive dimensions fail with a clear message', () => {
  const canvas = { width: 1200, height: 630 };
  const rect = { x: 10, y: 20, width: 600, height: 300 };
  const error = /Template geometry requires finite coordinates and positive dimensions/;
  // Check the API separately so a missing implementation cannot satisfy throws().
  assert.equal(typeof geometry.frameFromRect, 'function');
  for (const invalid of [NaN, Infinity, -Infinity]) {
    for (const key of Object.keys(canvas)) assert.throws(() => frameFromRect({ ...canvas, [key]: invalid }, rect), error);
    for (const key of Object.keys(rect)) assert.throws(() => frameFromRect(canvas, { ...rect, [key]: invalid }), error);
    assert.throws(() => frameFromRect(canvas, rect, invalid), error);
  }
  for (const invalid of [0, -1]) {
    for (const key of ['width', 'height']) {
      assert.throws(() => frameFromRect({ ...canvas, [key]: invalid }, rect), error);
      assert.throws(() => frameFromRect(canvas, { ...rect, [key]: invalid }), error);
    }
  }
});
