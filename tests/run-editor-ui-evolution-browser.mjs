import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { launchBrowser, preparePage, clickButton } from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:5219';
const server = process.env.UI_ORIGIN ? null : spawn(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js'), '--host', '127.0.0.1', '--port', '5219', '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
let browser;
try {
  if (server) for (let i=0; i<100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  browser = await launchBrowser();
  const page = await preparePage(browser, origin + '/?editor=1', { viewport: { width:1440, height:900, deviceScaleFactor:1 } });
  if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'editor.png') });
  const gaps = await page.evaluate(() => {
    const artwork = document.querySelector('[data-canvas-stage] > div').getBoundingClientRect();
    const top = document.querySelector('[data-canvas-toolbar]').getBoundingClientRect();
    const bottom = document.querySelector('[data-canvas-dock]').getBoundingClientRect();
    return [artwork.top - top.bottom, bottom.top - artwork.bottom];
  });
  assert.ok(gaps.every(gap => gap >= 8 && gap <= 32), `canvas toolbar gaps: ${gaps}`);
  assert.equal(await page.$$eval('[data-3d-angles]', xs => xs.filter(x => x.getClientRects().length).length), 1, 'Frame has one visible 3D section');
  assert.equal(await page.$eval('[data-3d-angles]', el => !!(el.compareDocumentPosition(document.querySelector('[data-mockup-camera]')) & Node.DOCUMENT_POSITION_FOLLOWING)), true, '3D precedes camera controls');
  await page.click('[data-3d-angles] button[title^="Isometric Left"]');
  assert.equal(await page.$eval('[data-3d-angles] button[title^="Isometric Left"]', el => el.getAttribute('aria-pressed')), 'true');
  await clickButton(page, 'Templates');
  await page.waitForSelector('dialog[data-template-gallery][open]', { timeout: 5000 });
  if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'gallery.png') });
  assert.equal(await page.$eval('[data-template-filter="all"]', el => el.getAttribute('aria-pressed')), 'true');
  assert.equal(await page.$$eval('[data-template-gallery] article', xs => xs.length), 12);
  await page.click('[data-template-filter="1:1"]');
  assert.equal(await page.$$eval('[data-template-gallery] article', xs => xs.length), 2);
  await page.click('[data-template-filter="all"]');
  await page.click('[aria-label="Preview Editorial Honey template"]');
  await page.waitForSelector('dialog[data-template-preview][open]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[data-template-preview]'));
  assert.ok(await page.$('dialog[data-template-gallery][open]'));
  await page.click('[data-template-filter="16:9"]');
  await page.click('[aria-label="Apply Big Type Launch template"]');
  await page.waitForSelector('[data-pro-modal]', { visible: true });
  assert.equal(await page.$eval('dialog[data-template-gallery]', el => el.open), false, 'purchase dialog is above the gallery');
  await page.click('[data-pro-modal] button[title="Close"]');
  await page.waitForSelector('dialog[data-template-gallery][open]');
  assert.equal(await page.$eval('[data-template-filter="16:9"]', el => el.getAttribute('aria-pressed')), 'true', 'filter is retained after closing Pro');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Apply Big Type Launch template');
  await page.click('[aria-label="Apply Big Type Launch template"]');
  await clickButton(page, 'Claim with PayPal Transaction ID');
  assert.equal(await page.$eval('dialog[data-template-gallery]', el => el.open), false, 'license recovery remains above the gallery');
  await page.click('[aria-label="Close license dialog"]');
  await page.waitForSelector('dialog[data-template-gallery][open]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[data-template-gallery]'));
  assert.equal(await page.evaluate(() => document.activeElement?.hasAttribute('data-template-trigger')), true);
  await page.click('[aria-label="Switch to Dark theme"]');
  await page.waitForFunction(() => document.documentElement.classList.contains('theme-dark'));
  await new Promise(resolve => setTimeout(resolve, 300));
  if (process.env.UI_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'editor-dark.png') });
  const mobile = await preparePage(browser, origin + '/?editor=1', { viewport: { width:360, height:844, deviceScaleFactor:1 } });
  const overflow = await mobile.evaluate(() => ({width:document.body.scrollWidth, nodes:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(el=>`${el.tagName}.${el.className}`)}));
  assert.equal(overflow.width, 360, `mobile body does not overflow: ${overflow.nodes.join(', ')}`);
  if (await mobile.$('[aria-label="Switch to Dark theme"]')) await mobile.click('[aria-label="Switch to Dark theme"]');
  assert.equal(await mobile.evaluate(() => document.documentElement.classList.contains('theme-dark')), true);
  await mobile.click('[data-template-trigger]');
  await mobile.waitForSelector('dialog[data-template-gallery][open]');
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 360, 'mobile page does not overflow');
  assert.ok(await mobile.$eval('dialog[data-template-gallery]', el => el.getBoundingClientRect().right <= innerWidth));
  if (process.env.UI_SCREENSHOT_DIR) await mobile.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'gallery-mobile-dark.png') });
  await mobile.close();
  const initialTheme = await browser.newPage();
  await initialTheme.evaluateOnNewDocument(() => {
    localStorage.setItem('shotcraft_theme_mode', 'dark');
    localStorage.setItem('devsnapkit_welcome_seen', '1');
    const observer = new MutationObserver(() => {
      if (document.body?.classList.contains('theme-dark')) {
        window.__initialTheme = { html: document.documentElement.className, body: document.body.className };
        observer.disconnect();
      }
    });
    observer.observe(document, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
  });
  await initialTheme.goto(origin + '/?editor=1', {waitUntil:'domcontentloaded'});
  assert.equal(await initialTheme.evaluate(() => window.__initialTheme?.html.includes('theme-dark') && window.__initialTheme?.body.includes('theme-dark')), true);
  await initialTheme.close();
  console.log('Editor gallery browser checks passed');
} finally { if(browser) await browser.close(); server?.kill(); }
