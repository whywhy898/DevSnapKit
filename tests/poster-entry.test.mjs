import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyPosterUrl, launchBrowser } from './helpers/browser.mjs';

test('ordinary editor omits Poster while the retained legacy URL opens its renderer', async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const url = process.env.TEST_UI_URL || 'http://127.0.0.1:5179/?editor=1';
    await page.goto(url, { waitUntil: 'networkidle0' });
    const entries = await page.$$eval('button', buttons => buttons.filter(b => b.textContent.trim() === 'Poster').length);
    assert.equal(entries, 0, 'ordinary editor has no Poster entry');
    assert.equal(await page.$('nav[aria-label="Studio mode"]'), null);
    assert.equal(await page.$('[data-poster-editor]'), null, 'ordinary editor does not mount a hidden Poster session');
    assert.ok(await page.$('#studio-canvas'));
    await page.goto(legacyPosterUrl(url), { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-poster-editor]');
    assert.ok(await page.$('[data-poster-artwork]'), 'legacy URL retains the real Poster renderer');
    assert.equal(await page.$('nav[aria-label="Studio mode"]'), null, 'legacy editor has no in-page mode switch');
  } finally { await browser.close(); }
});
