import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, preparePage, clickButton, finishTextEditing, discardTextChanges } from './helpers/browser.mjs';
const url = process.env.TEST_UI_URL;
const output = path.resolve('../../output/devsnapkit/canvas-text-v1/editing');
const snap = page => page.evaluate(() => window.__mockupBaseline.snapshot.textDocument);
const wait = (page, content) => page.waitForFunction(content => window.__mockupBaseline.snapshot.textDocument.layers.at(-1)?.content === content, {}, content);
async function input(page, value) { await page.$eval('[aria-label="Text content"]', (el, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); }, value); }
async function undo(page) { await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); }
async function withPage(fn, viewport) { const browser = await launchBrowser(); try { const page = await preparePage(browser, url, { viewport }); try { await fn(page); } catch (error) { await fs.mkdir(output, { recursive: true }); await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); console.log(await page.$$eval('[data-canvas-stage],.studio-canvas-viewport,[data-canvas-text-controls]', nodes => nodes.map(n => ({ name: n.tagName, cls: n.className, w: n.clientWidth, h: n.clientHeight, rect: n.getBoundingClientRect().toJSON() })))); throw error; } } finally { await browser.close(); } }
test('T3 inline editor owns focus, draft, cancel, plain content, and independent Add/edit undo', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await clickButton(page, 'Add text');
  assert.equal(await page.$eval('[aria-label="Text content"]', el => el.closest('[data-canvas-root]') === null && el === document.activeElement && el.selectionStart === 0 && el.selectionEnd === 4), true);
  assert.equal(await page.$eval('[data-canvas-text]', el => getComputedStyle(el).visibility), 'hidden');
  await input(page, 'Hello\n世界🙂\n<script>alert(1)</script>'); await wait(page, 'Hello\n世界🙂\n<script>alert(1)</script>');
  await finishTextEditing(page);
  const id = (await snap(page)).layers[0].id;
  await undo(page); await wait(page, 'Text');
  await undo(page); await page.waitForFunction(() => !window.__mockupBaseline.snapshot.textDocument.layers.length);
  await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control'); await wait(page, 'Text');
  assert.equal((await snap(page)).layers[0].id, id);
  await page.select('[aria-label="Current text"]', id);
  await clickButton(page, 'Edit text'); await input(page, 'cancel me'); await page.keyboard.press('Escape'); await wait(page, 'Text');
  assert.equal(await page.$('[aria-label="Text content"]'), null);
  await clickButton(page, 'Edit text'); await input(page, '🙂'.repeat(1001));
  assert.equal(await page.$eval('[aria-label="Text content"]', el => Array.from(el.value).length), 1001);
  assert.equal((await snap(page)).layers[0].content, 'Text');
  await clickButton(page, 'Frame'); assert.equal(await page.$eval('[data-canvas-text-controls]', el => el.getClientRects().length > 0), true, 'Invalid content keeps Text Inspector active');
  assert.match(await page.$eval('[role="alert"]', el => el.textContent), /Draft not applied|finish/i);
  await page.focus('[aria-label="Text content"]'); await page.keyboard.press('Escape');
  await clickButton(page, 'Edit text'); await input(page, ''); await finishTextEditing(page);
  assert.equal((await snap(page)).layers[0].content, ''); assert.equal(await page.$('[data-canvas-text]'), null);
  await page.select('[aria-label="Current text"]', ''); assert.equal(await page.$('[aria-label="Delete text"]'), null);
  await page.select('[aria-label="Current text"]', id); await clickButton(page, 'Delete text');
  assert.equal((await snap(page)).layers.length, 0); await undo(page); await page.waitForFunction(() => window.__mockupBaseline.snapshot.textDocument.layers.length === 1);
  assert.equal((await snap(page)).layers[0].id, id);
}));
test('T3 actual style controls target selection, validate drafts, normalize fonts and group undo', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await clickButton(page, 'Add text'); await input(page, 'First'); await finishTextEditing(page);
  await clickButton(page, 'Add text'); await input(page, 'Second'); await finishTextEditing(page);
  const original = await snap(page); const id = original.layers[1].id;
  await page.select('[aria-label="Text weight"]', '800');
  await page.select('[aria-label="Text font"]', 'gelasio');
  let s = await snap(page); assert.equal(s.layers[1].weight, 700); assert.equal(s.layers[1].font, 'gelasio'); assert.deepEqual(s.layers[0], original.layers[0]);
  await page.click('[aria-label="Text italic"]'); await page.select('[aria-label="Text font"]', 'manrope');
  assert.equal((await snap(page)).layers[1].italic, false);
  const size = await page.$('[aria-label="Text size"]'); await size.focus(); await page.keyboard.down('Control'); await size.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('999');
  assert.equal((await snap(page)).layers[1].fontSize, 99); assert.match(await page.$eval('[role="alert"]', el => el.textContent), /8.*160/);
  await page.keyboard.down('Control'); await size.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('64'); await size.press('Tab');
  await page.waitForFunction(() => window.__mockupBaseline.snapshot.textDocument.layers[1].fontSize === 64);
  await page.click('[aria-label="Align left"]'); await undo(page); assert.equal((await snap(page)).layers[1].align, 'center');
  await undo(page); await page.waitForFunction(() => window.__mockupBaseline.snapshot.textDocument.layers[1].fontSize === 48);
  assert.equal((await snap(page)).layers[1].id, id);
  await page.focus('[aria-label="Text size"]'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('72');
  await discardTextChanges(page); assert.equal((await snap(page)).layers[1].fontSize, 48);
  await page.focus('[aria-label="Text size"]'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('76');
  await page.keyboard.press('Escape'); assert.equal((await snap(page)).layers[1].fontSize, 48);
  await page.focus('[aria-label="Text color picker"]');
  await page.$eval('[aria-label="Text color picker"]', el => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, '#123456'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal((await snap(page)).layers[1].color, '#123456');
  await page.keyboard.press('Escape'); assert.equal((await snap(page)).layers[1].color, '#FFFFFF');
  await clickButton(page, 'Dark text'); assert.equal((await snap(page)).layers[1].color, '#111827');
  await clickButton(page, 'Light text'); assert.equal((await snap(page)).layers[1].color, '#FFFFFF');
  await page.select('[aria-label="Current text"]', original.layers[0].id); await page.focus('[aria-label="Current text"]'); await page.keyboard.press('Delete');
  // A select owns its keyboard; explicit Delete text remains available.
  assert.equal((await snap(page)).layers.length, 2);
  await page.click('.studio-canvas-viewport [data-canvas-stage]', { offset: { x: 5, y: 5 } });
  assert.equal(await page.$eval('[aria-label="Current text"]', el => el.value), '');
}));
test('T3 IME retains complete over-limit draft and prevents tool changes until canceled', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await clickButton(page, 'Add text');
  await page.$eval('[aria-label="Text content"]', el => el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
  await input(page, '中'.repeat(1001)); assert.equal((await snap(page)).layers[0].content, 'Text');
  await clickButton(page, 'Text'); assert.ok(await page.$('[aria-label="Text content"]'), 'The real Text tab cannot finish a composing draft');
  await page.$eval('[aria-label="Text content"]', el => el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  assert.equal(await page.$eval('[aria-label="Text content"]', el => el.value.length), 1001);
  await discardTextChanges(page); await wait(page, 'Text');
}));
test('T3 native text undo stays local and selected Delete preserves the second screenshot', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await clickButton(page, 'Add text'); await page.keyboard.type('Native typing'); await undo(page);
  assert.equal((await snap(page)).layers.length, 1);
  assert.notEqual(await page.$eval('[aria-label="Text content"]', el => el.value), 'Native typing');
  await page.keyboard.press('Escape'); await wait(page, 'Text');
  await page.evaluate(() => window.__mockupBaseline.apply({ layoutMode: 'duo', secondarySrc: window.__mockupBaseline.snapshot.imageSrc, secondaryName: 'Second.png' }));
  await page.waitForFunction(() => window.__mockupBaseline.snapshot.layoutMode === 'duo');
  await page.focus('[aria-label="Delete text"]'); await page.keyboard.press('Delete');
  await page.waitForFunction(() => !window.__mockupBaseline.snapshot.textDocument.layers.length);
  assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.layoutMode), 'duo');
  assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.secondaryName), 'Second.png');
}));
test('T3 invalid style draft has reachable Discard changes and blocks keyboard tool shortcuts', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await clickButton(page, 'Add text'); await finishTextEditing(page); await page.focus('[aria-label="Text size"]');
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type('Infinity');
  assert.equal(await page.$eval('[data-text-edit-recovery] [data-text-cancel]', el => el.getClientRects().length > 0 && el.textContent.trim() === 'Discard changes'), true);
  await page.$eval('[aria-label="Text size"]', el => el.blur());
  await page.keyboard.press('2'); assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.layoutMode), 'single');
  const baseline = await page.evaluate(() => JSON.stringify(window.__mockupBaseline.snapshot));
  await clickButton(page, 'Frame');
  assert.equal(await page.$eval('[aria-label="Text size"]', el => el.getClientRects().length > 0 && el.value === 'Infinity'), true, 'Invalid draft keeps its Text tab visible when another tab is requested');
  await page.evaluate(() => {
    const data = new DataTransfer(); data.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'], 'paste.svg', { type: 'image/svg+xml' }));
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  });
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(await page.evaluate(() => JSON.stringify(window.__mockupBaseline.snapshot)), baseline);
  await discardTextChanges(page); assert.equal((await snap(page)).layers[0].fontSize, 48);
}));
test('T3 style controls cannot replace an invalid or composing content draft', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await clickButton(page, 'Add text');
  for (const composing of [false, true]) {
    if (composing) await page.$eval('[aria-label="Text content"]', el => el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    const draft = '🙂'.repeat(1001); await input(page, draft);
    await page.focus('[aria-label="Text size"]'); await page.keyboard.type('64');
    assert.equal(await page.$eval('[aria-label="Text content"]', el => el.value), draft);
    assert.equal((await snap(page)).layers[0].content, 'Text'); assert.equal((await snap(page)).layers[0].fontSize, 48);
    await page.$eval('[aria-label="Text color picker"]', el => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, '#123456'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.$eval('[aria-label="Text content"]', el => el.value), draft);
    assert.equal((await snap(page)).layers[0].color, '#FFFFFF');
    await discardTextChanges(page); await clickButton(page, 'Edit text');
  }
}));
test('T3 text cap explains 20 boxes, overlap chooser and empty text remain reachable', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await clickButton(page, 'Add text'); await finishTextEditing(page);
  await page.evaluate(() => { const layer = window.__mockupBaseline.snapshot.textDocument.layers[0]; window.__mockupBaseline.apply({ textDocument: { version: 1, layers: Array.from({ length: 20 }, (_, i) => ({ ...layer, id: 'cap-' + i, content: i ? 'Overlap' : '' })) } }); });
  await page.waitForFunction(() => document.querySelector('[aria-label="Add text"]').disabled);
  assert.match(await page.$eval('[data-canvas-text-controls]', el => el.textContent), /20 text boxes/);
  await page.select('[aria-label="Current text"]', 'cap-0'); await clickButton(page, 'Edit text'); assert.equal(await page.$eval('[aria-label="Text content"]', el => el.value), '');
}));
test('T3 mobile inline layout matches final text and keyboard height preserves logical layout', { skip: !url, timeout: 90000 }, async () => {
  await fs.mkdir(output, { recursive: true });
  const metrics = [];
  for (const width of [360, 390, 430]) await withPage(async page => {
    await clickButton(page, 'Add text'); await finishTextEditing(page);
    if (width !== 360) await page.select('[aria-label="Text font"]', 'gelasio');
    await page.select('[aria-label="Text weight"]', '600');
    if (width === 430) await page.click('[aria-label="Text italic"]');
    await clickButton(page, 'Edit text'); await input(page, 'URLhttps://example.com/longlonglong\n中文🙂 test\n');
    await page.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 100));
    const before = await page.$eval('[aria-label="Text content"]', el => { const root = document.querySelector('#studio-canvas'); return { h: el.offsetHeight, w: el.offsetWidth, scale: getComputedStyle(root).transform, previewScale: getComputedStyle(root).getPropertyValue('--canvas-preview-scale'), screenScale: root.getBoundingClientRect().width / root.offsetWidth, rootW: root.offsetWidth }; });
    const viewportBefore = await page.evaluate(() => innerHeight);
    await page.setViewport({ width, height: 520, deviceScaleFactor: 1 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.notEqual(await page.evaluate(() => innerHeight), viewportBefore); assert.equal(await page.evaluate(() => innerHeight), 520);
    const during = await page.$eval('[aria-label="Text content"]', el => { const root = document.querySelector('#studio-canvas'); return { h: el.offsetHeight, w: el.offsetWidth, scale: getComputedStyle(root).transform, previewScale: getComputedStyle(root).getPropertyValue('--canvas-preview-scale'), screenScale: root.getBoundingClientRect().width / root.offsetWidth, rootW: root.offsetWidth }; });
    assert.equal(during.rootW, before.rootW); assert.equal(during.w, before.w); assert.equal(during.h, before.h);
    assert.equal(during.scale, before.scale);
    assert.equal(during.previewScale, before.previewScale); assert.ok(Math.abs(during.screenScale - before.screenScale) < .0001);
    await page.screenshot({ path: path.join(output, 'mobile-' + width + '-editing.png'), fullPage: true });
    await page.evaluate(() => { window.scrollTo(0, 600); window.visualViewport?.dispatchEvent(new Event('scroll')); });
    assert.equal(await page.$('[data-text-edit-dock]'), null, 'A valid mobile draft has no floating action dock');
    assert.equal(await page.$('[data-text-edit-recovery]'), null);
    await finishTextEditing(page); const after = await page.$eval('[data-canvas-text]', el => ({ h: el.offsetHeight, w: el.offsetWidth }));
    assert.ok(Math.abs(after.h - before.h) <= 2, JSON.stringify({ before, after })); assert.ok(Math.abs(after.w - before.w) <= 2);
    metrics.push({ viewport: width, font: width === 360 ? 'Manrope 600 normal' : width === 390 ? 'Gelasio 600 normal' : 'Gelasio 600 italic', before, during, after });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (width === 360) {
      await page.evaluate(() => Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined }));
      await clickButton(page, 'Edit text');
      assert.equal(await page.$('[data-text-edit-dock]'), null, 'Valid editing needs no action dock without VisualViewport');
      await finishTextEditing(page);
    }
  }, { width, height: 850, deviceScaleFactor: 1 });
  await fs.writeFile(path.join(output, 'mobile-layout-metrics.json'), JSON.stringify(metrics, null, 2));
});
