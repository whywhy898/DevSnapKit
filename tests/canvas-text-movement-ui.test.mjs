import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, preparePage, clickButton, finishTextEditing } from './helpers/browser.mjs';

const url = process.env.TEST_UI_URL;
const output = path.resolve('../../output/devsnapkit/canvas-text-v1/movement-fix');
const paint = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const doc = page => page.evaluate(() => window.__mockupBaseline.snapshot.textDocument);
async function drag(page, dx, dy) {
  const handle = await page.$('[aria-label="Move text"]'); assert.ok(handle, 'Move is available while typing');
  await handle.evaluate(el => el.scrollIntoView({ block: 'center' })); await paint(page);
  const box = await handle.boundingBox(); assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 }); await page.mouse.up(); await paint(page);
}
async function history(page, redo = false) {
  await page.focus('[aria-label="Move text"]'); await page.keyboard.down('Control'); if (redo) await page.keyboard.down('Shift');
  await page.keyboard.press('z'); if (redo) await page.keyboard.up('Shift'); await page.keyboard.up('Control'); await paint(page);
}
async function bounds(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#studio-canvas'), node = canvas.querySelector('[data-canvas-text]');
    const a = canvas.getBoundingClientRect(), b = node.getBoundingClientRect(), scale = a.width / canvas.offsetWidth;
    const range = document.createRange(); range.selectNodeContents(node);
    const fragments = [...range.getClientRects()];
    return { left: (Math.min(b.left, ...fragments.map(r => r.left)) - a.left) / scale,
      right: (Math.max(b.right, ...fragments.map(r => r.right)) - a.left) / scale,
      top: (b.top - a.top) / scale, bottom: (b.top - a.top) / scale + Math.max(b.height / scale, node.offsetHeight, node.scrollHeight),
      width: canvas.offsetWidth, height: canvas.offsetHeight, scale };
  });
}
test('UX movement works immediately while typing and preserves text through move Undo Redo', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await clickButton(page, 'Add text');
    await page.type('[aria-label="Text content"]', 'Move me now'); await paint(page);
    assert.ok(await page.$('[aria-label="Text content"]'), 'Still editing before the drag');
    assert.equal(await page.$('[data-text-edit-dock]'), null, 'Valid editing has no floating dock');
    const before = (await doc(page)).layers[0]; await drag(page, 35, 20);
    const moved = (await doc(page)).layers[0]; assert.equal(moved.content, 'Move me now');
    assert.ok(moved.centerX > before.centerX && moved.centerY > before.centerY);
    assert.equal(await page.$('[aria-label="Text content"]'), null, 'Move automatically finishes valid input');
    await history(page); assert.deepEqual((await doc(page)).layers[0], before);
    await history(page, true); assert.deepEqual((await doc(page)).layers[0], moved);
    await page.click('[data-text-hit]'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await page.keyboard.type('Edit then move'); await drag(page, -25, 0);
    assert.equal((await doc(page)).layers[0].content, 'Edit then move');
    const labels = await page.$$eval('[aria-label="Current text"] option', nodes => nodes.map(n => n.textContent));
    assert.ok(labels.every(label => !label.includes(moved.id.slice(0, 6))), 'Internal IDs are not user-facing labels');
  } finally { await browser.close(); }
});

test('UX movement stops the full multiline box at every canvas edge at desktop and mobile preview scales', { skip: !url, timeout: 120000 }, async () => {
  const browser = await launchBrowser(); const rows = [];
  try {
    for (const width of [1440, 360, 390, 430]) {
      const page = await preparePage(browser, url, { viewport: { width, height: width < 600 ? 850 : 1100, deviceScaleFactor: 1 } });
      await clickButton(page, 'Add text'); await finishTextEditing(page);
      await page.evaluate(() => {
        const layer = window.__mockupBaseline.snapshot.textDocument.layers[0];
        window.__mockupBaseline.apply({ aspectRatioId: 'custom', customCanvasSize: { width: 1600, height: 1200 },
          textDocument: { version: 1, layers: [{ ...layer, content: 'Multiline title\n中文 boundary 🚀', centerX: .5, centerY: .5, widthRatio: .4003, fontSize: 49 }] } });
      }); await page.evaluate(() => document.fonts.ready); await paint(page);
      for (const [edge, dx, dy] of [['right', 3000, 0], ['left', -3000, 0], ['bottom', 0, 3000], ['top', 0, -3000]]) {
        const before = await doc(page); await drag(page, dx, dy); const b = await bounds(page);
        assert.ok(b.left >= -.01 && b.right <= b.width + .01 && b.top >= -.01 && b.bottom <= b.height + .01, JSON.stringify({ width, edge, ...b }));
        const gap = edge === 'right' ? b.width - b.right : edge === 'left' ? b.left : edge === 'bottom' ? b.height - b.bottom : b.top;
        assert.ok(Math.abs(gap) < .1, 'Text stops exactly at the requested edge');
        assert.equal(await page.$('[data-text-layout-errors]'), null, 'Valid movement never triggers overflow warning');
        const atEdge = await doc(page); await drag(page, dx, dy); assert.deepEqual(await doc(page), atEdge, 'Continuing beyond edge is a no-op');
        await history(page); assert.deepEqual(await doc(page), before, 'One Undo restores one complete drag');
        rows.push({ width, edge, ...b });
      }
      await fs.mkdir(output, { recursive: true }); await page.screenshot({ path: path.join(output, `movement-${width}.png`), fullPage: true }); await page.close();
    }
    await fs.writeFile(path.join(output, 'movement-bounds.json'), JSON.stringify(rows, null, 2));
  } finally { await browser.close(); }
});

test('UX movement protects composing input and pointer cancellation keeps the committed text', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await clickButton(page, 'Add text');
    await page.type('[aria-label="Text content"]', 'Keep my draft'); await paint(page);
    const before = await doc(page);
    await page.$eval('[aria-label="Text content"]', el => el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    await drag(page, 50, 0); assert.deepEqual(await doc(page), before);
    assert.ok(await page.$('[aria-label="Text content"]'), 'A composition cannot be silently committed by dragging');
    await page.$eval('[aria-label="Text content"]', el => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    const handle = await page.$('[aria-label="Move text"]'); const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2); await paint(page);
    assert.notEqual((await doc(page)).layers[0].centerX, before.layers[0].centerX);
    await handle.evaluate(el => el.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 })));
    await page.mouse.up(); await paint(page); assert.deepEqual(await doc(page), before);
    assert.equal(await page.evaluate(() => window.__mockupBaseline.history.inTransaction), false);
  } finally { await browser.close(); }
});
