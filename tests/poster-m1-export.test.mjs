import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { launchBrowser, preparePage, clickButton, downloadPng } from './helpers/browser.mjs';

test('M1 actual product PNG downloads prepare and embed fonts at 1x and 2x', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const directory = path.resolve('../../output/devsnapkit/poster-v1/m1');
  const evidence = [];
  try {
    const page = await preparePage(browser, process.env.TEST_UI_URL || 'http://127.0.0.1:5179/?editor=1');
    await clickButton(page, 'Poster');
    await page.waitForSelector('[data-poster-artwork]');
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('[data-poster-artwork] img')].map(i => i.decode())); });
    const fonts = await page.evaluate(() => ({ manrope: document.fonts.check('800 73px "Poster Manrope"'), gelasio: document.fonts.check('italic 400 78px "Poster Gelasio"') }));
    assert.deepEqual(fonts, { manrope: true, gelasio: true });
    await fs.mkdir(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, 'preview.png') });
    for (const [label, ratio] of [['cold-1x',1],['warm-1x',1],['cold-2x',2],['warm-2x',2]]) {
      if (label === 'cold-2x') {
        await page.reload({waitUntil:'networkidle0'});
        await clickButton(page,'Poster');
      }
      await page.select('select[aria-label="Poster export size"]', String(ratio));
      const result = await downloadPng(page, directory, `${label}.png`, () => clickButton(page, 'Download PNG'));
      const metadata = await sharp(result.path).metadata();
      assert.equal(metadata.width,1600*ratio); assert.equal(metadata.height,1200*ratio);
      assert.equal(metadata.format,'png');
      const {data} = await sharp(result.path).extract({left:90*ratio,top:1120*ratio,width:1,height:1}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      assert.deepEqual([...data], [251,248,235,255], 'Art footer must retain cream paper, independent of application theme');
      evidence.push({ label, ...result, width: metadata.width, height: metadata.height });
    }
    await fs.writeFile(path.join(directory,'results.json'), JSON.stringify({ fonts, evidence, browser: await browser.version() },null,2));
    console.log(JSON.stringify(evidence));
  } finally { await browser.close(); }
});
