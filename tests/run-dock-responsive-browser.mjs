import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { launchBrowser, preparePage, clickButton } from './helpers/browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const origin = process.env.UI_ORIGIN || 'http://127.0.0.1:5222';
const server = process.env.UI_ORIGIN ? null : spawn(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js'), '--host', '127.0.0.1', '--port', '5222', '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
let browser;
try {
  if (server) for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  browser = await launchBrowser();
  const page = await preparePage(browser, origin + '/?editor=1', { viewport: { width: 1440, height: 900, deviceScaleFactor: 1 } });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const rect = selector => page.$eval(selector, el => { const r = el.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, height:r.height }; });
  const sameRow = (a, b) => Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 1;
  const desktop = await rect('[data-template-trigger]');
  const desktopReplace = await rect('button[title="Upload screenshot from computer"]');
  assert.ok(desktop.height <= 56 && desktop.height - desktopReplace.height <= 20, 'desktop template card should remain visually balanced');
  assert.ok(sameRow(desktop, desktopReplace), 'desktop dock controls remain vertically aligned');
  assert.ok(await page.$$eval('[data-template-trigger] img', imgs => imgs.length === 3 && imgs.every(img => img.naturalWidth && img.getBoundingClientRect().height >= 42)), 'desktop keeps three clear previews');

  for (const width of [430, 390, 360, 320]) {
    await page.setViewport({ width, height: 780, deviceScaleFactor: 1 });
    await page.waitForSelector('[data-template-trigger]');
    const trigger = await rect('[data-template-trigger]');
    const replace = await rect('button[title="Upload screenshot from computer"]');
    const dock = await rect('[data-canvas-dock]');
    assert.ok(dock.height <= 130, `${width}px dock should fit in three compact rows (height ${dock.height})`);
    assert.ok(trigger.left >= 0 && trigger.right <= width, `${width}px template entry stays visible`);
    if (width >= 360) assert.ok(sameRow(trigger, replace), `${width}px template entry shares the first row`);
    assert.ok(await page.$eval('[data-template-trigger]', el => { const label = el.querySelector('.template-trigger-copy').getBoundingClientRect(); return [...el.querySelectorAll('img')].every(img => img.getBoundingClientRect().right <= label.left); }), `${width}px preview images do not overlap the label`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px page has no horizontal overflow`);
    if (process.env.UI_SCREENSHOT_DIR) { await page.mouse.move(0, 0); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, `dock-${width}.png`) }); }
    await page.click('button[title="More aspect ratios & social media presets"]');
    await page.waitForSelector('.dock-more-ratios-popover', { visible:true });
    const menu = await rect('.dock-more-ratios-popover');
    const visibleHit = await page.$eval('.dock-more-ratios-popover button', el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); });
    assert.ok(menu.left >= 0 && menu.right <= width && menu.top >= 0 && visibleHit, `${width}px More menu is visible and interactive: ${JSON.stringify({menu, visibleHit})}`);
    await page.click('.dock-more-ratios-popover button');
    await page.waitForSelector('.dock-more-ratios-popover', { hidden:true });
    const square = await page.evaluateHandle(() => [...document.querySelectorAll('.dock-aspect-options button')].find(b => b.textContent.trim() === '1:1'));
    assert.ok(square.asElement(), 'square preset is available');
    await page.$eval('.dock-aspect-options button', el => el.focus());
    await square.asElement().focus();
    await new Promise(resolve => setTimeout(resolve, 200));
    const visibility = await page.$eval('.dock-aspect-options', el => { const button = [...el.querySelectorAll('button')].find(b => b.textContent.trim() === '1:1'); const a = el.getBoundingClientRect(), b = button.getBoundingClientRect(); return { left:b.left - a.left, right:a.right - b.right, scroll:el.scrollLeft, scrollWidth:el.scrollWidth, clientWidth:el.clientWidth, overflow:getComputedStyle(el).overflowX, focused:document.activeElement === button }; });
    assert.ok(visibility.left >= -1.5 && visibility.right >= -1.5 && visibility.focused, `${width}px keyboard focus scrolls the square option into view: ${JSON.stringify(visibility)}`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#studio-canvas')?.offsetWidth === 1080 && document.querySelector('#studio-canvas')?.offsetHeight === 1080);
    await square.dispose();
  }
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 1 });
  await page.evaluate(() => localStorage.setItem('shotcraft_theme_mode', 'dark'));
  await page.reload({ waitUntil:'networkidle0' });
  await page.waitForSelector('[data-template-trigger]');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('theme-dark')), true);
  assert.ok((await rect('[data-canvas-dock]')).height <= 130, 'dark mobile dock remains compact');
  await page.click('button[title="More aspect ratios & social media presets"]');
  await page.waitForSelector('.dock-more-ratios-popover', { visible:true });
  assert.ok(await page.$eval('.dock-more-ratios-popover button', el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }), 'dark mobile menu remains interactive');
  if (process.env.UI_SCREENSHOT_DIR) { await page.mouse.move(0, 0); await page.screenshot({ path: path.join(process.env.UI_SCREENSHOT_DIR, 'dock-dark-menu.png') }); }
  assert.deepEqual(pageErrors, [], 'resizing and switching ratios must not produce browser errors');

  const templatePage = await preparePage(browser, origin + '/?editor=1', { viewport: { width:360, height:780, deviceScaleFactor:1 } });
  await clickButton(templatePage, 'Templates');
  await templatePage.waitForSelector('[data-template-gallery][open]');
  await templatePage.click('[aria-label="Apply Paper Launch Duo template"]');
  await templatePage.waitForSelector('[data-template-gallery]', { hidden:true });
  await templatePage.waitForSelector('[data-independent-media-status]');
  for (const width of [360, 320]) {
    await templatePage.setViewport({ width, height:780, deviceScaleFactor:1 });
    const height = await templatePage.$eval('[data-canvas-dock]', el => el.getBoundingClientRect().height);
    assert.ok(height <= 130, `${width}px dock remains compact after applying a two-image template: ${height}`);
    await templatePage.click('button[title="More aspect ratios & social media presets"]');
    assert.ok(await templatePage.$eval('.dock-more-ratios-popover button', el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }), `${width}px More menu works with a two-image template`);
    await templatePage.click('button[title="More aspect ratios & social media presets"]');
  }
  await templatePage.close();
  console.log('Responsive dock browser checks passed');
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}
