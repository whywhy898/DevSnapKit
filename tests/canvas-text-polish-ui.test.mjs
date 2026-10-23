import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, preparePage } from './helpers/browser.mjs';
const url = process.env.TEST_UI_URL;
const output = path.resolve('../../output/devsnapkit/canvas-text-v1/inspector-polish');
const paint = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function click(page, selector) { const el = await page.$(selector); assert.ok(el, selector); await el.evaluate(n => n.scrollIntoView({ block: 'center' })); await el.click(); await paint(page); }
async function textTab(page) { const el = await page.evaluateHandle(() => [...document.querySelectorAll('[data-inspector-tabs] button')].find(n => n.textContent.trim() === 'Text')); await el.asElement().click(); await paint(page); }

test('Polish normal editing has no confirmation buttons and applies through real Inspector navigation', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url);
    await click(page, '[aria-label="Add text"]'); await page.type('[aria-label="Text content"]', 'Applied automatically'); await paint(page);
    const initial = await page.evaluate(() => ({ mode: !!document.querySelector('[aria-label="Studio mode"]'), poster: !!document.querySelector('[data-poster-artwork]'), confirmations: [...document.querySelectorAll('[data-text-editor-ui] button')].filter(n => n.getClientRects().length && ['Done', 'Cancel'].includes(n.textContent.trim())).map(n => n.textContent.trim()), deletion: getComputedStyle(document.querySelector('[aria-label="Delete text"]')).backgroundColor, alignIcon: !!document.querySelector('[aria-label="Align left"] svg'), palette: !!document.querySelector('[data-text-color-control]') }));
    assert.deepEqual(initial, { mode: false, poster: false, confirmations: [], deletion: 'rgb(220, 38, 38)', alignIcon: true, palette: true });
    assert.equal(await page.$('[data-text-edit-dock]'), null);
    await textTab(page);
    assert.equal(await page.$('[aria-label="Text content"]'), null);
    assert.equal(await page.$eval('[data-canvas-text]', n => n.textContent), 'Applied automatically');
    assert.equal(await page.evaluate(() => window.__mockupBaseline.history.inTransaction), false);
    const deletion = await page.$eval('[aria-label="Delete text"]', n => ({ red: getComputedStyle(n).backgroundColor, icon: !!n.querySelector('svg') }));
    assert.ok(deletion.icon); assert.equal(deletion.red, 'rgb(220, 38, 38)');
    await click(page, '[aria-label="Delete text"]'); assert.equal(await page.$('[data-canvas-text]'), null);
    await click(page, 'button[title="Undo (Ctrl+Z / ⌘Z)"]'); assert.equal(await page.$eval('[data-canvas-text]', n => n.textContent), 'Applied automatically');
  } finally { await browser.close(); }
});

test('Polish alignment icons and labeled native color palette are clear across themes and four widths', { skip: !url, timeout: 120000 }, async () => {
  const browser = await launchBrowser(); const rows = [];
  try {
    for (const width of [1440, 360, 390, 430]) {
      const page = await preparePage(browser, url, { viewport: { width, height: width < 600 ? 850 : 1100, deviceScaleFactor: 1 } });
      await click(page, '[aria-label="Add text"]'); await textTab(page);
      for (const align of ['left', 'center', 'right']) {
        const sel = `[aria-label="Align ${align}"]`;
        assert.equal(await page.$eval(sel, n => n.textContent.trim()), ''); assert.ok(await page.$eval(sel, n => !!n.querySelector('svg') && !!n.title));
        await click(page, sel); assert.equal(await page.$eval(sel, n => n.getAttribute('aria-pressed')), 'true');
        assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers[0].align), align);
      }
      const picker = '[aria-label="Text color picker"]';
      assert.equal(await page.$eval(picker, n => n.type), 'color');
      await page.$eval(picker, n => { n.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(n, '#124abc'); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); n.blur(); }); await paint(page);
      assert.equal((await page.$eval('[aria-label="Text color"]', n => n.value)).toUpperCase(), '#124ABC');
      for (const theme of ['light', 'dark']) {
        if (!await page.$(`html.theme-${theme}`)) await click(page, `button[title="Switch to ${theme === 'light' ? 'Light' : 'Dark'} theme"]`);
        const box = await page.$eval('[data-text-color-control]', n => { const b = n.getBoundingClientRect(); return { label: n.textContent, width: b.width, height: b.height, border: getComputedStyle(n).borderColor }; });
        assert.match(box.label, /Choose color/); assert.ok(box.width > 180 && box.height >= 44);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth));
        await fs.mkdir(output, { recursive: true }); await page.screenshot({ path: path.join(output, `inspector-${width}-${theme}.png`), fullPage: true }); rows.push({ width, theme, ...box });
      }
      await page.close();
    }
    await fs.writeFile(path.join(output, 'layout.json'), JSON.stringify(rows, null, 2));
  } finally { await browser.close(); }
});

test('Polish invalid drafts have an explicit discard recovery without normal Done Cancel controls', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url, { viewport: { width: 360, height: 520, deviceScaleFactor: 1 } });
    await click(page, '[aria-label="Add text"]'); await page.$eval('[aria-label="Text content"]', n => { const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(n, 'a'.repeat(1001)); n.dispatchEvent(new Event('input', { bubbles: true })); }); await paint(page);
    await page.waitForSelector('[data-text-edit-recovery]', { visible: true, timeout: 3000 });
    assert.equal(await page.$('[data-text-edit-dock]'), null);
    assert.ok(await page.$eval('[data-text-edit-recovery]', n => { const b = n.getBoundingClientRect(), v = visualViewport; return b.top >= (v?.offsetTop || 0) && b.bottom <= (v ? v.offsetTop + v.height : innerHeight) + 1; }));
    assert.equal(await page.$eval('[aria-label="Text content"]', n => n.value.length), 1001);
    await click(page, '[data-text-edit-recovery] [data-text-cancel]');
    assert.equal(await page.$('[aria-label="Text content"]'), null); assert.equal(await page.$('[data-text-edit-recovery]'), null);
    assert.equal(await page.evaluate(() => window.__mockupBaseline.history.inTransaction), false);
  } finally { await browser.close(); }
});
