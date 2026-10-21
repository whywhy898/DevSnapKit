import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { launchBrowser, preparePage, clickButton, downloadPng } from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const output = process.env.TEST_EVIDENCE_DIR || path.join(root, 'output/devsnapkit/poster-v1/mockup-baseline');
const url = process.env.TEST_UI_URL;

async function exportCurrent(page, filename) {
  await page.waitForFunction(() => [...document.querySelectorAll('#studio-canvas img')].every(img => img.complete && img.naturalWidth > 0));
  await page.evaluate(() => document.fonts.ready);
  await clickButton(page, 'Export');
  await clickButton(page, '1x Web');
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /^Download 1x/.test(b.innerText.trim())));
  return downloadPng(page, output, filename, async () => {
    const handle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && /^Download 1x/.test(b.innerText.trim())));
    assert.ok(await handle.evaluate(button => Boolean(button)), '1x export control exists');
    await handle.evaluate(button => button.click());
    await handle.dispose();
  });
}

test('old Mockup downloads: single, duo, browser, phone and transparent PNG alpha', { skip: !url, timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const results = [];
  try {
    const page = await preparePage(browser, url);
    const primary = await page.$('input[aria-label="Main screenshot file"]');
    const secondary = await page.$('input[aria-label="Second screenshot file"]');
    await primary.uploadFile(path.join(root, 'output/devsnapkit/honeywerank-original.png'));
    await page.waitForFunction(() => document.querySelector('#studio-canvas img')?.src.startsWith('data:'));
    for (const scenario of ['single', 'duo', 'browser', 'phone']) {
      if (scenario === 'duo') {
        await page.click('button[title="Dual shots (2 images)"]');
        await secondary.uploadFile(path.join(root, 'output/devsnapkit/honeywerank-platforms.png'));
        await page.waitForFunction(() => document.querySelector('#studio-canvas [data-scene-slot="2"] img')?.src.startsWith('data:'));
      } else if (scenario === 'browser' || scenario === 'phone') {
        await page.click('button[title="Single shot (1 image)"]');
        await clickButton(page, 'Frame');
        await clickButton(page, scenario === 'browser' ? 'Safari Browser' : 'iPhone 17 Pro\nPopular');
      }
      const downloaded = await exportCurrent(page, `${scenario}.png`);
      const metadata = await sharp(downloaded.path).metadata();
      assert.ok(metadata.width > 0 && metadata.height > 0);
      results.push({ scenario, ...downloaded, width: metadata.width, height: metadata.height });
    }
    await clickButton(page, 'Frame');
    await clickButton(page, 'Borderless\nDefault');
    await clickButton(page, 'Canvas');
    await clickButton(page, 'Alpha');
    const downloaded = await exportCurrent(page, 'transparent.png');
    const { data, info } = await sharp(downloaded.path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    // Sample the top padding, away from the frame, its shadow and canvas ring.
    // The same 120×24 probe detects 45 checkerboard pixels in the unfixed PNG.
    let opaquePixels = 0;
    for (let y = 8; y < 32; y++) for (let x = 128; x < 248; x++) if (data[(y * info.width + x) * 4 + 3] !== 0) opaquePixels++;
    results.push({ scenario: 'transparent', ...downloaded, width: info.width, height: info.height, nonzeroAlphaInBackground: opaquePixels });
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    assert.equal(opaquePixels, 0, 'transparent background must exclude preview checkerboard pixels');
  } finally { await browser.close(); }
});
