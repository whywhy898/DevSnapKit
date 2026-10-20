import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

test('Poster mode has an accessible entry and preserves the mounted Mockup canvas', async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, args: ['--no-sandbox', '--no-proxy-server'] });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.TEST_UI_URL || 'http://127.0.0.1:5179/?editor=1', { waitUntil: 'networkidle0' });
    const entries = await page.$$eval('button', buttons => buttons.filter(b => b.textContent.trim() === 'Poster').length);
    assert.equal(entries, 1, 'one visible Poster entry must be available');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Poster').click());
    await page.waitForSelector('[data-poster-editor]');
    assert.equal(await page.$eval('[data-canvas-root]', node => !!node.closest('[hidden]')), true);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Mockup').click());
    assert.equal(await page.$eval('[data-canvas-root]', node => !!node.closest('[hidden]')), false);
    assert.ok(await page.$('[data-poster-editor]'), 'poster session remains mounted');
  } finally { await browser.close(); }
});
