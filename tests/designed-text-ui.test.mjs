import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, preparePage, clickButton, finishTextEditing, revealInspectorControl } from './helpers/browser.mjs';
const url = process.env.TEST_UI_URL;
const output = path.resolve('../../output/devsnapkit/designed-text');
const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function pointAt(page, at) {
  return page.$eval('[data-text-rich-mirror]', (mirror, at) => {
    const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT); let node, remaining = at;
    while ((node = walker.nextNode())) { if (remaining <= node.textContent.length) break; remaining -= node.textContent.length; }
    const range = document.createRange(); range.setStart(node, remaining); range.collapse(true); const rect = range.getBoundingClientRect();
    return { x: rect.left + .1, y: rect.top + rect.height / 2 };
  }, at);
}
async function fixture(page) {
  await clickButton(page, 'Add text'); await finishTextEditing(page);
  await page.evaluate(() => {
    const s = window.__mockupBaseline.snapshot, layer = s.textDocument.layers[0];
    const runs = [{ text: 'Build ' }, { text: 'better 中文😀 tools', font: 'gelasio', italic: true, weight: 600, color: '#FFDD88', highlightColor: '#243040' }, { text: ' with thoughtful typography that wraps across many lines.' }];
    window.__mockupBaseline.apply({ aspectRatioId: 'custom', customCanvasSize: { width: 1600, height: 1200 }, textDocument: { version: 1, layers: [{ ...layer, content: runs.map(run => run.text).join(''), runs, widthRatio: .36, centerY: .5, fontSize: 54, lineHeight: 1.12, letterSpacing: 1.6, textTransform: 'uppercase' }] } });
  });
  await page.waitForFunction(() => document.querySelector('#studio-canvas').offsetWidth === 1600);
  await page.evaluate(() => document.fonts.ready); await paint(page);
  const id = await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers[0].id);
  await page.select('[aria-label="Current text"]', id); await clickButton(page, 'Edit text'); await paint(page);
}

test('D06 mixed-font rich editing uses rendered DOM caret and selection across wrapped lines', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page);
    assert.ok(await page.$('[data-text-rich-mirror]'), 'rich editing must draw the same span layout as artwork');
    await page.$eval('[aria-label="Text content"]', el => { el.setSelectionRange(15, 15); el.dispatchEvent(new Event('select', { bubbles: true })); }); await paint(page);
    const metrics = await page.evaluate(() => {
      const mirror = document.querySelector('[data-text-rich-mirror]'), artwork = document.querySelector('[data-canvas-text]'), caret = document.querySelector('[data-text-rich-caret]');
      const root = mirror.getBoundingClientRect(), walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
      let remaining = 15, node; while ((node = walker.nextNode())) { if (remaining <= node.textContent.length) break; remaining -= node.textContent.length; }
      const range = document.createRange(); range.setStart(node, remaining); range.collapse(true); const expected = range.getBoundingClientRect(), actual = caret.getBoundingClientRect();
      return { mirror: { width: mirror.offsetWidth, height: mirror.offsetHeight }, artwork: { width: artwork.offsetWidth, height: artwork.offsetHeight }, caret: { x: actual.x - root.x, y: actual.y - root.y }, expected: { x: expected.x - root.x, y: expected.y - root.y }, lineHeight: getComputedStyle(mirror).lineHeight, runs: [...mirror.querySelectorAll('[data-text-run]')].map(node => ({ family: getComputedStyle(node).fontFamily, italic: getComputedStyle(node).fontStyle })) };
    });
    assert.deepEqual(metrics.mirror, metrics.artwork);
    assert.ok(Math.abs(metrics.caret.x - metrics.expected.x) < 1, JSON.stringify(metrics));
    assert.ok(Math.abs(metrics.caret.y - metrics.expected.y) < 1, JSON.stringify(metrics));
    assert.match(metrics.runs[1].family, /Gelasio/); assert.equal(metrics.runs[1].italic, 'italic');
    await page.$eval('[aria-label="Text content"]', el => { el.setSelectionRange(8, 65); el.dispatchEvent(new Event('select', { bubbles: true })); }); await paint(page);
    assert.ok(await page.$$eval('[data-text-rich-selection]', nodes => nodes.length) >= 3, 'selection follows actual wrapped DOM lines');
    assert.deepEqual(await page.$eval('[aria-label="Text content"]', el => ({ color: getComputedStyle(el, '::selection').color, background: getComputedStyle(el, '::selection').backgroundColor })), { color: 'rgba(0, 0, 0, 0)', background: 'rgba(0, 0, 0, 0)' }, 'native textarea selection must not paint a second glyph layout over the rich mirror');
    await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'mixed-font-editor-metrics.json'), JSON.stringify(metrics, null, 2));
    await page.screenshot({ path: path.join(output, 'mixed-font-editor.png'), fullPage: true });
    await revealInspectorControl(page, '[aria-label="Emphasize selection"]'); await page.click('[aria-label="Emphasize selection"]'); await paint(page);
    assert.deepEqual(await page.$eval('[aria-label="Text content"]', el => [el.selectionStart, el.selectionEnd]), [8, 65]);
    assert.equal(await page.$eval('[aria-label="Text content"]', el => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers[0].runs.find(run => run.font === 'gelasio' && run.text.includes('中文')).weight), 700, 'toolbar must apply emphasis to the saved textarea selection');
    const point = await pointAt(page, 15); await page.mouse.click(point.x, point.y); await paint(page);
    assert.deepEqual(await page.$eval('[aria-label="Text content"]', el => [el.selectionStart, el.selectionEnd]), [15, 15], 'pointer placement follows the rendered glyph');
    await page.keyboard.press('ArrowRight'); await paint(page);
    assert.deepEqual(await page.$eval('[aria-label="Text content"]', el => [el.selectionStart, el.selectionEnd]), [17, 17], 'keyboard navigation keeps emoji surrogate pairs intact');
    const beforeDown = await page.$eval('[data-text-rich-caret]', el => el.getBoundingClientRect().top);
    await page.keyboard.press('ArrowDown'); await paint(page);
    assert.ok(await page.$eval('[data-text-rich-caret]', el => el.getBoundingClientRect().top) > beforeDown + 5, 'vertical keyboard movement follows rich DOM lines');
    const from = await pointAt(page, 8), to = await pointAt(page, 35);
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 5 }); await page.mouse.up(); await paint(page);
    assert.deepEqual(await page.$eval('[aria-label="Text content"]', el => [el.selectionStart, el.selectionEnd]), [8, 35], 'drag selection uses rendered lines');
  } finally { await browser.close(); }
});

test('D06b Chromium IME composition preserves inline Chinese insertion and undo without pinyin fragments', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page);
    const original = await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument);
    await page.$eval('[aria-label="Text content"]', el => { el.focus(); el.setSelectionRange(12, 12); });
    const client = await page.createCDPSession();
    // Browser-native IME events through Chromium; keyboard.type is NOT IME automation.
    // This exercises Chromium composition, not the operating system's candidate UI.
    await client.send('Input.imeSetComposition', { text: 'zhong', selectionStart: 5, selectionEnd: 5 });
    assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument), original);
    await client.send('Input.imeSetComposition', { text: '中文', selectionStart: 2, selectionEnd: 2 });
    await client.send('Input.insertText', { text: '中文' }); await paint(page);
    const next = await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument);
    assert.equal(next.layers[0].content, original.layers[0].content.slice(0, 12) + '中文' + original.layers[0].content.slice(12));
    assert.equal(next.layers[0].runs.length, original.layers[0].runs.length);
    assert.equal(next.layers[0].runs[1].italic, true); assert.doesNotMatch(next.layers[0].content, /zhong/);
    await page.$eval('[aria-label="Text content"]', el => el.setSelectionRange(6, 6));
    await page.keyboard.press('Backspace'); await paint(page);
    const boundary = await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers[0]);
    assert.equal(boundary.runs[0].text, 'Build'); assert.equal(boundary.runs[1].font, 'gelasio'); assert.equal(boundary.runs[1].italic, true);
    await finishTextEditing(page); await page.focus('[aria-label="Move text"]');
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await paint(page);
    assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument), original);
    await client.detach();
  } finally { await browser.close(); }
});

test('D06 typography controls apply actual tracking, line height and visual uppercase', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page); await finishTextEditing(page);
    for (const [label, value] of [['Text lineHeight', '1.3'], ['Text letterSpacing', '2.5']]) {
      const selector = `[aria-label="${label}"]`; await revealInspectorControl(page, selector); await page.focus(selector);
      await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type(value); await page.keyboard.press('Enter');
    }
    await page.select('[aria-label="Text case"]', 'none'); await paint(page);
    const styles = await page.$eval('[data-canvas-text]', el => ({ lineHeight: getComputedStyle(el).lineHeight, letterSpacing: getComputedStyle(el).letterSpacing, textTransform: getComputedStyle(el).textTransform }));
    assert.deepEqual(styles, { lineHeight: '70.2px', letterSpacing: '2.5px', textTransform: 'none' });
  } finally { await browser.close(); }
});

test('D06 native beforeinput preserves distinct styles while deleting or inserting identical glyphs', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page); await finishTextEditing(page);
    const reset = async () => {
      await page.evaluate(() => { const s = window.__mockupBaseline.snapshot, l = s.textDocument.layers[0]; window.__mockupBaseline.apply({ textDocument: { version: 1, layers: [{ ...l, content: 'aa', runs: [{ text: 'a', color: '#FF0000' }, { text: 'a', color: '#0000FF' }] }] } }); });
      await clickButton(page, 'Edit text');
    };
    for (const [at, key, expected, keydownFallback] of [[0, 'Delete', [{ text: 'a', color: '#0000FF' }]], [2, 'Backspace', [{ text: 'a', color: '#FF0000' }]], [1, 'Backspace', [{ text: 'a', color: '#0000FF' }]], [1, 'Backspace', [{ text: 'a', color: '#0000FF' }], true]]) {
      await reset(); await page.$eval('[aria-label="Text content"]', (el, at) => { el.focus(); el.setSelectionRange(at, at); }, at);
      if (keydownFallback) await page.evaluate(() => document.addEventListener('beforeinput', event => event.stopPropagation(), { capture: true, once: true }));
      await page.keyboard.press(key); await paint(page);
      assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers[0].runs), expected, `${key} at ${at}`);
      await finishTextEditing(page);
    }
    for (const [at, expected] of [[0, [{ text: 'aa', color: '#FF0000' }, { text: 'a', color: '#0000FF' }]], [2, [{ text: 'a', color: '#FF0000' }, { text: 'aa', color: '#0000FF' }]]]) {
      await reset(); await page.$eval('[aria-label="Text content"]', (el, at) => { el.focus(); el.setSelectionRange(at, at); }, at);
      await page.keyboard.type('a'); await paint(page);
      assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers[0].runs), expected, `insert a at ${at}`);
      await finishTextEditing(page);
    }
    const client = await page.createCDPSession();
    for (const [at, expected] of [[0, [{ text: 'aa', color: '#FF0000' }, { text: 'a', color: '#0000FF' }]], [2, [{ text: 'a', color: '#FF0000' }, { text: 'aa', color: '#0000FF' }]]]) {
      await reset(); await page.$eval('[aria-label="Text content"]', (el, at) => { el.focus(); el.setSelectionRange(at, at); }, at);
      await client.send('Input.imeSetComposition', { text: 'zhong', selectionStart: 5, selectionEnd: 5 });
      await client.send('Input.insertText', { text: 'a' }); await paint(page);
      assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers[0].runs), expected, `native composition of a at ${at}`);
      await finishTextEditing(page);
    }
    await client.detach();
  } finally { await browser.close(); }
});

test('D06 rich over-limit composition draft can be recovered through native deletion', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page);
    // Synthetic composition events exercise invalid-draft recovery, separate from native IME tests.
    await page.$eval('[aria-label="Text content"]', el => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, '😀'.repeat(1001));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      el.setSelectionRange(el.value.length, el.value.length);
    }); await paint(page);
    assert.equal(await page.$eval('[aria-label="Text content"]', el => Array.from(el.value).length), 1001);
    await page.keyboard.press('Backspace'); await paint(page);
    assert.equal(await page.$eval('[aria-label="Text content"]', el => Array.from(el.value).length), 1000);
    assert.equal(await page.evaluate(() => Array.from(window.__mockupBaseline.snapshot.textDocument.layers[0].content).length), 1000);
  } finally { await browser.close(); }
});

test('D06 native rich undo and redo restore removed styles within the same textarea transaction', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page); await finishTextEditing(page);
    await page.evaluate(() => { const s = window.__mockupBaseline.snapshot, l = s.textDocument.layers[0]; window.__mockupBaseline.apply({ textDocument: { version: 1, layers: [{ ...l, content: 'aa', runs: [{ text: 'a', color: '#FF0000' }, { text: 'a', color: '#0000FF' }] }] } }); });
    const original = await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument);
    await clickButton(page, 'Edit text');
    await page.$eval('[aria-label="Text content"]', el => { el.focus(); el.setSelectionRange(0, 0); });
    await page.keyboard.press('Delete'); await paint(page);
    const deleted = await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument);
    assert.deepEqual(deleted.layers[0].runs, [{ text: 'a', color: '#0000FF' }]);
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await paint(page);
    assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument), original, 'native local Undo restores the deleted red run');
    await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control'); await paint(page);
    assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument), deleted, 'native local Redo restores the blue survivor');
    assert.equal(await page.$eval('[aria-label="Text content"]', el => el === document.activeElement), true);
    await finishTextEditing(page); await page.focus('[aria-label="Move text"]');
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await paint(page);
    assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument), original, 'whole editor history still groups the session once');
    await clickButton(page, 'Edit text');
    await page.$eval('[aria-label="Text content"]', el => { el.focus(); el.select(); });
    await page.keyboard.type('aa'); await paint(page);
    assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers[0].runs), [{ text: 'aa', color: '#FF0000' }]);
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await paint(page);
    assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers[0].runs), [{ text: 'a', color: '#FF0000' }]);
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await paint(page);
    assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument), original, 'multiple native Undo groups distinguish historical styles for repeated plain values');
  } finally { await browser.close(); }
});

test('D06 backward Shift-click keeps the fixed selection anchor before emphasis', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page); await finishTextEditing(page);
    await page.evaluate(() => { const s = window.__mockupBaseline.snapshot, l = s.textDocument.layers[0]; window.__mockupBaseline.apply({ textDocument: { version: 1, layers: [{ ...l, content: 'abcdefghij', runs: [{ text: 'abcdefghij', color: '#FF0000' }], textTransform: 'none' }] } }); });
    await clickButton(page, 'Edit text');
    await page.$eval('[aria-label="Text content"]', el => { el.setSelectionRange(2, 8, 'backward'); el.dispatchEvent(new Event('select', { bubbles: true })); }); await paint(page);
    const point = await pointAt(page, 4); await page.keyboard.down('Shift'); await page.mouse.click(point.x, point.y); await page.keyboard.up('Shift'); await paint(page);
    assert.deepEqual(await page.$eval('[aria-label="Text content"]', el => [el.selectionStart, el.selectionEnd, el.selectionDirection]), [4, 8, 'backward']);
    await revealInspectorControl(page, '[aria-label="Italicize selection"]'); await page.click('[aria-label="Italicize selection"]'); await paint(page);
    assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers[0].runs.find(run => run.italic)?.text), 'efgh', 'emphasis targets the correctly anchored range');
  } finally { await browser.close(); }
});
