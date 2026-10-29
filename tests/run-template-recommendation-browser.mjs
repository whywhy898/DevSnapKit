import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { launchBrowser, preparePage, clickButton } from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:5221';
const server = process.env.UI_ORIGIN ? null : spawn(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js'), '--host', '127.0.0.1', '--port', '5221', '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
let browser;
try {
  if (server) for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  browser = await launchBrowser();
  const page = await preparePage(browser, origin + '/?editor=1', { viewport: { width: 1440, height: 900, deviceScaleFactor: 1 } });
  const openGallery = async () => { await clickButton(page, 'Templates'); await page.waitForSelector('[data-template-gallery][open]'); };
  const closeGallery = async () => { await page.keyboard.press('Escape'); await page.waitForSelector('[data-template-gallery]', { hidden: true }); };
  const selectAspect = async ratio => { await page.$eval('[data-canvas-dock]', (dock, ratio) => [...dock.querySelectorAll('button')].find(button => button.textContent.trim() === ratio).click(), ratio); };
  const checkAll = async () => {
    assert.equal(await page.$eval('[data-template-filter="all"]', el => el.getAttribute('aria-pressed')), 'true');
    assert.equal(await page.$$eval('[data-template-gallery] article', els => els.length), 12);
  };

  await openGallery();
  await checkAll();
  assert.equal(await page.$('[data-template-recommendation]'), null, 'unmatched Auto canvas has no recommendation');
  await closeGallery();

  await selectAspect('1:1');
  await page.waitForFunction(() => document.querySelector('#studio-canvas')?.offsetWidth === 1080 && document.querySelector('#studio-canvas')?.offsetHeight === 1080);
  await openGallery();
  await checkAll();
  assert.match(await page.$eval('[data-template-recommendation]', el => el.innerText), /1:1/);
  assert.match(await page.$eval('[data-template-recommendation]', el => el.innerText), /2/);
  assert.equal(await page.$eval('.template-group h3', el => el.textContent), '1:1', 'matching group comes first');
  assert.equal(await page.$eval('[data-template-filter="1:1"]', el => el.getAttribute('aria-pressed')), 'false', 'recommendation is not an active filter');
  const height = await page.$eval('[data-template-gallery]', el => el.getBoundingClientRect().height);
  if (process.env.UI_SCREENSHOT_DIR) { await new Promise(resolve => setTimeout(resolve, 350)); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'template-match-light.png') }); }
  await page.click('[data-show-matching]');
  assert.equal(await page.$eval('[data-template-filter="1:1"]', el => el.getAttribute('aria-pressed')), 'true');
  assert.equal(await page.$$eval('[data-template-gallery] article', els => els.length), 2);
  assert.equal(await page.$eval('[data-template-gallery]', el => el.getBoundingClientRect().height), height, 'gallery height is stable when filtering');
  await page.click('[data-template-filter="all"]');
  await checkAll();
  await page.click('[data-template-filter="16:9"]');
  await page.click('[aria-label="Apply Big Type Launch template"]');
  await page.waitForSelector('[data-pro-modal]');
  await page.click('[data-pro-modal] button[title="Close"]');
  await page.waitForSelector('[data-template-gallery][open]');
  assert.equal(await page.$eval('[data-template-filter="16:9"]', el => el.getAttribute('aria-pressed')), 'true', 'manual filter survives the Pro dialog');
  assert.match(await page.$eval('[data-template-recommendation]', el => el.innerText), /1:1/);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Apply Big Type Launch template', 'focus returns to the chosen card');
  await closeGallery();

  await selectAspect('16:9');
  await page.waitForFunction(() => document.querySelector('#studio-canvas')?.offsetWidth === 1920 && document.querySelector('#studio-canvas')?.offsetHeight === 1080);
  await openGallery();
  await checkAll();
  assert.match(await page.$eval('[data-template-recommendation]', el => el.innerText), /16:9/);
  assert.equal(await page.$eval('.template-group h3', el => el.textContent), '16:9', 'recommendation is refreshed on reopening');
  await closeGallery();

  await clickButton(page, 'Export');
  const setSize = async (width, height) => {
    for (const [label, value] of [['Canvas width', width], ['Canvas height', height]]) {
      await page.focus(`[aria-label="${label}"]`);
      await page.keyboard.down('Control');
      await page.keyboard.press('A');
      await page.keyboard.up('Control');
      await page.keyboard.type(String(value));
    }
    await page.$eval('[aria-label="Canvas width"]', el => el.form.requestSubmit());
    await page.waitForFunction((width, height) => document.querySelector('#studio-canvas')?.offsetWidth === width && document.querySelector('#studio-canvas')?.offsetHeight === height, {}, width, height);
  };
  await setSize(1500, 900);
  await openGallery();
  await checkAll();
  assert.equal(await page.$('[data-template-recommendation]'), null, 'unmatched custom dimensions show all templates');
  await closeGallery();
  await setSize(1080, 1080);
  await openGallery();
  await checkAll();
  assert.match(await page.$eval('[data-template-recommendation]', el => el.innerText), /1:1/, 'matching custom dimensions get a suggestion');
  await closeGallery();

  await page.evaluate(() => localStorage.setItem('shotcraft_theme_mode', 'dark'));
  await page.reload({ waitUntil: 'networkidle0' });
  await selectAspect('16:9');
  await page.waitForFunction(() => document.querySelector('#studio-canvas')?.offsetWidth === 1920);
  await openGallery();
  await checkAll();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('theme-dark')), true);
  if (process.env.UI_SCREENSHOT_DIR) { await new Promise(resolve => setTimeout(resolve, 350)); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'template-match-dark.png') }); }
  await closeGallery();

  await page.setViewport({ width: 360, height: 844, deviceScaleFactor: 1 });
  await openGallery();
  await checkAll();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile page has no horizontal overflow');
  assert.equal(await page.$eval('[data-show-matching]', el => el.getBoundingClientRect().right <= innerWidth), true, 'recommendation action is visible on mobile');
  if (process.env.UI_SCREENSHOT_DIR) { await new Promise(resolve => setTimeout(resolve, 350)); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'template-match-mobile.png') }); }
  console.log('Template recommendation browser checks passed');
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
