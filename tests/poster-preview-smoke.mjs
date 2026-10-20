import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { launchBrowser, preparePage, clickButton, downloadPng } from './helpers/browser.mjs';
const url = process.env.PREVIEW_URL;
if (!url) throw new Error('PREVIEW_URL is required.');
const output = path.resolve('../../output/devsnapkit/poster-v1/preview');
const fixture = name => path.resolve(`tests/fixtures/poster-v1/${name}.png`);
await fs.mkdir(output, { recursive: true });
const response = await fetch(url);
assert.equal(response.status, 200);
assert.match(response.headers.get('x-robots-tag') || '', /noindex/);
const expectedPolicy = (await fs.readFile('public/_headers', 'utf8')).match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1].trim();
assert.equal(response.headers.get('content-security-policy'), expectedPolicy);
const browser = await launchBrowser(), downloads = [];
try {
  for (const width of [1440, 1280, 390]) {
    const page = await preparePage(browser, url, { viewport: { width, height: 1000, deviceScaleFactor: 1 } });
    await clickButton(page, 'Poster');
    if (width === 390) await clickButton(page, 'Edit poster');
    for (const [role, name] of [['main', width === 390 ? 'phone' : 'honey-main'], ['detail', 'honey-detail']]) {
      const imagePath = width === 1280 ? path.resolve(`public/seo/examples/${role === 'main' ? 'astro' : 'github'}-original.png`) : fixture(name);
      await (await page.$(`input[aria-label="Replace ${role}"]`)).uploadFile(imagePath);
      await page.waitForFunction(role => document.querySelector(`[data-poster-role="${role}"] img`)?.src.startsWith('blob:'), {}, role);
      await page.waitForFunction(() => !document.querySelector('.poster-controls-lock').matches(':disabled'));
    }
    const brand = await page.$('textarea[aria-label="Brand"]');
    await brand.focus(); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
    await page.keyboard.type(width === 390 ? 'Mobile review' : width === 1280 ? 'Astro reference' : 'HoneyWeRank'); await page.keyboard.press('Tab');
    if (width === 390) await clickButton(page, 'Close controls');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, `preview-${width}.png`), fullPage: true });
    for (const ratio of width === 1440 ? [1, 2] : [1]) {
      await page.select('[aria-label="Poster export size"]', String(ratio));
      const result = await downloadPng(page, output, `live-${width}-${ratio}x.png`, () => clickButton(page, 'Download PNG'));
      const metadata = await sharp(result.path).metadata();
      assert.equal(metadata.width, 1600 * ratio); assert.equal(metadata.height, 1200 * ratio);
      const pixels = await sharp(result.path).resize(80,60).removeAlpha().raw().toBuffer();
      let nonPaper=0;for(let index=0;index<pixels.length;index+=3)if(pixels[index]<200||pixels[index+1]<200)nonPaper++;
      assert.ok(nonPaper>100, 'Live PNG must contain the template and uploaded image.');
      downloads.push({ viewport: width, ...result, width: metadata.width, height: metadata.height });
    }
    await page.close();
  }
  const production = await fetch('https://devsnapkit.com/');
  const productionSHA = createHash('sha256').update(await production.text()).digest('hex');
  assert.equal(productionSHA, '0a17d06bf762b1de11bf2ffcdb07b282d7d120b529308b77a86e01eaa0f445be', 'Production HTML must remain unchanged by preview deployment.');
  const result = { previewURL: url, xRobotsTag: response.headers.get('x-robots-tag'), browser: await browser.version(), downloads, productionSHA, productionUnchanged: true };
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
