import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function load(name) {
  const file = new URL(`../src/poster/${name}.ts`, import.meta.url);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('logical geometry preserves aspect, rejects invalid placement and detects rotated crop', async () => {
  const g = await load('geometry');
  assert.deepEqual(g.toLogicalDelta({ x: 20, y: 10 }, 0.5), { x: 40, y: 20 });
  assert.throws(() => g.toLogicalDelta({ x: 20, y: 10 }, 0));
  const base = { width: 800, height: 400 }, canvas = { width: 1600, height: 1200 };
  assert.equal(g.scaleRect(base, 1.5).width / g.scaleRect(base, 1.5).height, 2);
  assert.deepEqual(g.getScaleBounds(base, 'main', canvas), { minScale: 0.3, maxScale: 4 });
  assert.equal(g.validatePlacement({ centerX: 800, centerY: 600, scale: NaN }, base, 'main', canvas).ok, false);
  assert.equal(g.validatePlacement({ centerX: -1, centerY: 600, scale: 1 }, base, 'main', canvas).ok, false);
  assert.equal(g.validatePlacement({ centerX: 800, centerY: 600, scale: 0.2 }, base, 'main', canvas).ok, false);
  assert.equal(g.isPlacementClipped({ centerX: 400, centerY: 200, scale: 1 }, base, canvas, -3), true);
  assert.equal(g.isPlacementClipped({ centerX: 800, centerY: 600, scale: 1 }, base, canvas, -3), false);
  assert.deepEqual(g.clampCenter({ centerX: -50, centerY: 1400, scale: 1 }, canvas), { centerX: 0, centerY: 1200, scale: 1 });
});

test('all material proportions fit complete browser and have material-based bounds', async () => {
  const g = await load('geometry');
  for (const image of [{ width: 1440, height: 900 }, { width: 1080, height: 1080 }, { width: 390, height: 844 }, { width: 2400, height: 600 }]) {
    const box = g.fittedMainBox(image, { width: 900, height: 780 });
    assert.ok(box.width <= 900 && box.height <= 780);
    assert.ok(Math.abs((box.height - box.chromeHeight) / box.width - image.height / image.width) < 1e-10);
    const bounds = g.getScaleBounds(box, 'main', { width: 1600, height: 1200 });
    assert.ok(bounds.minScale * Math.max(box.width, box.height) >= 240 - 1e-8);
  }
});

test('one hundred updates make one undo; cancel restores baseline; new edit clears redo', async () => {
  const h = await load('history');
  let state = h.createHistory({ x: 0 });
  state = h.beginTransaction(state);
  for (let i = 1; i <= 100; i++) state = h.updateTransaction(state, { x: i });
  state = h.commitTransaction(state);
  assert.equal(state.past.length, 1);
  state = h.undoHistory(state);
  assert.equal(state.present.x, 0);
  state = h.redoHistory(state);
  assert.equal(state.present.x, 100);
  state = h.beginTransaction(state);
  state = h.updateTransaction(state, { x: 999 });
  state = h.cancelTransaction(state);
  assert.equal(state.present.x, 100);
  state = h.undoHistory(state);
  state = h.beginTransaction(state);
  state = h.updateTransaction(state, { x: 50 });
  state = h.commitTransaction(state);
  assert.equal(state.future.length, 0);
  for (let x = 51; x < 120; x++) { state = h.beginTransaction(state); state = h.updateTransaction(state, { x }); state = h.commitTransaction(state); }
  assert.equal(state.past.length, 50);
});

test('asset gate accepts supported files only and enforces file and pixel limits', async () => {
  const a = await load('assets');
  assert.equal(a.validateAssetFile({ type: 'image/png', size: 20 * 1024 * 1024 }).ok, true);
  assert.equal(a.validateAssetFile({ type: 'image/svg+xml', size: 100 }).ok, false);
  assert.equal(a.validateAssetFile({ type: 'image/jpeg', size: 20 * 1024 * 1024 + 1 }).ok, false);
  assert.equal(a.validateImageDimensions(6000, 4000).ok, true);
  assert.equal(a.validateImageDimensions(6001, 4000).ok, false);
  assert.equal(a.validateImageDimensions(0, 100).ok, false);
  assert.equal(a.validateImageDimensions(NaN, 100).ok, false);
});

test('no-op and canceled edits preserve redo; asset repository keeps undo references until disposal', async () => {
  const h = await load('history');
  let state = h.createHistory({ image: 'first' });
  state = h.commitTransaction(h.updateTransaction(h.beginTransaction(state), { image: 'second' }));
  state = h.undoHistory(state);
  state = h.commitTransaction(h.beginTransaction(state));
  assert.equal(state.future.length, 1);
  state = h.cancelTransaction(h.updateTransaction(h.beginTransaction(state), { image: 'third' }));
  assert.equal(state.present.image, 'first');
  assert.equal(state.future.length, 1);
  const { AssetRegistry } = await load('assets');
  const repo = new AssetRegistry();
  const firstURL = URL.createObjectURL(new Blob(['first']));
  const secondURL = URL.createObjectURL(new Blob(['second']));
  repo.register({ id: 'first', url: firstURL, width: 1, height: 1, name: 'first', type: 'image/png' });
  repo.register({ id: 'second', url: secondURL, width: 1, height: 1, name: 'second', type: 'image/png' });
  assert.equal(await (await fetch(repo.resolve(state.present.image))).text(), 'first');
  state = h.redoHistory(state);
  assert.equal(await (await fetch(repo.resolve(state.present.image))).text(), 'second');
  repo.dispose();
  assert.equal(repo.get('first'), undefined);
  await assert.rejects(fetch(firstURL));
  await assert.rejects(fetch(secondURL));
});
