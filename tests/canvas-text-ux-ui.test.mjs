import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser, preparePage, finishTextEditing } from './helpers/browser.mjs';

const url = process.env.TEST_UI_URL;
const output = path.resolve('../../output/devsnapkit/canvas-text-v1/ux-review-fix');
const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function click(page, selector, text) {
  const handle = await page.evaluateHandle(({ selector, text }) => [...document.querySelectorAll(selector)].find(node => node.getClientRects().length && (!text || node.textContent.trim() === text)), { selector, text });
  const element = handle.asElement(); assert.ok(element, `Visible ${selector}: ${text ?? ''}`);
  await element.evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest' })); await element.click(); await element.dispose(); await paint(page);
}
const button = (page, text) => click(page, 'button', text);
async function chooserDuring(page, action) {
  const pending = page.waitForFileChooser({ timeout: 800 }).then(async chooser => { await chooser.cancel(); return true; }).catch(error => { if (error.name === 'TimeoutError') return false; throw error; });
  await action(); return pending;
}

test('UX text properties live in Inspector and remain usable at desktop and three mobile widths', { skip: !url, timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const rows = [];
    for (const width of [1440, 360, 390, 430]) {
      const page = await preparePage(browser, url, { viewport: { width, height: width < 600 ? 850 : 1100, deviceScaleFactor: 1 } });
      assert.equal(await page.$eval('[data-canvas-text-controls]', node => !!node.closest('.studio-inspector')), true, 'Full text properties belong to Inspector, not the canvas viewport');
      assert.equal(await page.$('.studio-canvas-viewport [aria-label="Text font"]'), null);
      await button(page, 'Add text'); await finishTextEditing(page);
      assert.equal(await page.$eval('[data-canvas-text-controls]', node => !!node.getClientRects().length), true);
      await button(page, 'Frame');
      await click(page, '[data-text-hit]');
      assert.equal(await page.$eval('[aria-label="Text content"]', node => node.value), 'Text');
      await finishTextEditing(page);
      const font = await page.$('[data-canvas-text-controls] [aria-label="Text font"]');
      await font.evaluate(node => node.scrollIntoView({ block: 'center' })); await font.select('gelasio'); await paint(page);
      assert.equal(await font.evaluate(node => !!node.getClientRects().length), true);
      for (const theme of ['light', 'dark']) {
        if (!await page.$(`html.theme-${theme}`)) await click(page, `button[title="Switch to ${theme === 'light' ? 'Light' : 'Dark'} theme"]`);
        const bounds = await page.evaluate(theme => ({ theme, width: innerWidth, body: document.body.scrollWidth, html: document.documentElement.scrollWidth, properties: document.querySelector('[data-canvas-text-controls]').getBoundingClientRect().toJSON() }), theme);
        assert.ok(await page.$(`html.theme-${theme}`), `The actual ${theme} theme is active`);
        assert.ok(bounds.body <= width && bounds.html <= width, JSON.stringify(bounds));
        assert.ok(bounds.properties.left >= 0 && bounds.properties.right <= width + 1);
        await fs.mkdir(output, { recursive: true }); await page.screenshot({ path: path.join(output, `text-panel-${width}-${theme}.png`), fullPage: true });
        rows.push(bounds);
      }
      await page.close();
    }
    await fs.writeFile(path.join(output, 'layout.json'), JSON.stringify(rows, null, 2));
  } finally { await browser.close(); }
});

test('UX text artwork disables image click upload across frame variants while explicit Replace Image still works', { skip: !url, timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url);
    const pictureClick = async (slot = 1) => {
      const image = await page.$(`#studio-canvas [data-scene-slot="${slot}"] img`);
      await image.evaluate(node => node.scrollIntoView({ block: 'center' })); await paint(page);
      const bounds = await image.boundingBox(); assert.ok(bounds);
      await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .7);
      await page.mouse.click(bounds.x + bounds.width * .5, bounds.y + bounds.height * .7);
    };
    assert.equal(await chooserDuring(page, pictureClick), true, 'Old image-only canvas click remains available');
    await button(page, 'Add text'); await finishTextEditing(page);
    const rows = [];
    for (const theme of ['none', 'mac-dark', 'browser', 'macbook', 'studio-display', 'iphone-17', 'phone-clay']) {
      await page.evaluate(theme => window.__mockupBaseline.apply({ windowTheme: theme }), theme); await paint(page);
      const opened = await chooserDuring(page, pictureClick);
      assert.equal(opened, false, `${theme}: text artwork must not open image upload on a canvas click`);
      const hover = await page.$$eval('#studio-canvas .media-hover-overlay', nodes => nodes.map(node => Number(getComputedStyle(node).opacity)));
      assert.ok(hover.every(opacity => opacity === 0), `${theme}: text artwork must not dim for upload`);
      rows.push({ theme, opened, hover });
    }
    await page.evaluate(() => window.__mockupBaseline.apply({ hideMockup: true })); await paint(page);
    assert.equal(await chooserDuring(page, pictureClick), false, 'Hidden-frame artwork also protects text from image upload');
    const hiddenFrameHover = await page.$$eval('#studio-canvas .media-hover-overlay', nodes => nodes.map(node => Number(getComputedStyle(node).opacity)));
    assert.ok(hiddenFrameHover.every(opacity => opacity === 0));
    rows.push({ hideMockup: true, opened: false, hover: hiddenFrameHover });
    await page.evaluate(() => window.__mockupBaseline.apply({ hideMockup: false, layoutMode: 'duo', secondarySrc: window.__mockupBaseline.snapshot.imageSrc, secondaryName: 'UX second screenshot.png' })); await paint(page);
    assert.equal(await chooserDuring(page, () => pictureClick(2)), false, 'The second screenshot also protects text from image upload');
    rows.push({ layoutMode: 'duo', slot: 2, opened: false });
    await button(page, 'Frame');
    assert.equal(await chooserDuring(page, () => click(page, 'button[title="Open Media Picker to replace Slot 2"]')), true, 'The explicit second-slot replacement remains available');
    assert.equal(await chooserDuring(page, () => click(page, 'button[title="Upload screenshot from computer"]')), true, 'Explicit Replace Image remains available');
    await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'image-interaction.json'), JSON.stringify(rows, null, 2));
  } finally { await browser.close(); }
});
