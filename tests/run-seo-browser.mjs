import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'node:dns/promises';
import { launchBrowser } from './helpers/browser.mjs';

const origin = process.argv[2] || 'http://127.0.0.1:4179';
const output = path.resolve(process.argv[3] || 'D:/workspace/MarkMoney/output/devsnapkit/seo-landing-pages-2026-10-23/local-browser');
const slugs = ['screenshot-beautifier', 'og-image-generator', 'product-hunt-image-maker', 'add-text-to-image'];
const targets = process.argv[4] ? [process.argv[4]] : slugs;
assert.ok(targets.every(slug => slugs.includes(slug)), 'supported landing page target');
await fs.mkdir(output, { recursive: true });
const browserArgs = ['--disable-quic'];
// Opt in when the host's local DNS proxy differs from Chrome's resolver.
if (process.env.SEO_SYSTEM_DNS === '1') {
  const hostname = new URL(origin).hostname;
  const { address } = await lookup(hostname, { family: 4 });
  browserArgs.push(`--host-resolver-rules=MAP ${hostname} ${address}`);
}
const browser = await launchBrowser(browserArgs);
const results = { origin, startedAt: new Date().toISOString(), routes: [], layouts: [], staticContent: [], errors: [] };

try {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => results.errors.push(error.message));
  for (const slug of targets) {
    await page.setCacheEnabled(false);
    const response = await page.goto(`${origin}/${slug}/`, { waitUntil: 'networkidle0' });
    assert.equal(response.status(), 200, slug);
    assert.equal(await page.$$eval('h1', nodes => nodes.length), 1, slug);
    const canonical = await page.$eval('link[rel="canonical"]', node => node.href);
    assert.equal(canonical, `https://devsnapkit.com/${slug}/`);
    const body = await response.text();
    assert.ok(body.includes('id="hero-title"') && !body.includes('id="root"'), `${slug}: independent HTML`);
    const noSlash = await page.goto(`${origin}/${slug}`, { waitUntil: 'networkidle0' });
    assert.equal(noSlash.status(), 200, `${slug}: no-slash route`);
    assert.equal(await page.$eval('link[rel="canonical"]', node => node.href), canonical);
    results.routes.push({ slug, status: response.status(), noSlashStatus: noSlash.status(), finalUrl: page.url(), canonical });
    await page.setCacheEnabled(true);

    for (const width of [1440, 360, 390, 430]) {
      await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
      await page.goto(`${origin}/${slug}/`, { waitUntil: 'networkidle0' });
      await page.evaluate(async () => { await document.fonts.ready; });
      for (const theme of ['light', 'dark']) {
        const toggle = await page.$('.theme-toggle');
        const label = await toggle.evaluate(node => node.getAttribute('aria-label'));
        if (label !== `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`) await toggle.click();
        if (await page.evaluate(() => document.documentElement.dataset.theme) !== theme) {
          await toggle.click();
          await toggle.click();
        }
        assert.equal(await page.$eval('.theme-toggle', node => node.getAttribute('aria-label')), `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
        await page.reload({ waitUntil: 'networkidle0' });
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme, `${slug}: theme persists`);
        for (const selector of ['.comparison-section', '.workflow-section', '.details-section', '.use-section', '.faq-section', '.closing']) {
          await page.$eval(selector, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await page.waitForFunction(selector => getComputedStyle(document.querySelector(selector)).opacity === '1', {}, selector);
        }
        await page.waitForFunction(() => [...document.querySelectorAll('.reveal')].every(node => getComputedStyle(node).opacity === '1'));
        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth, html: document.documentElement.scrollWidth }));
        assert.ok(dimensions.body <= width && dimensions.html <= width, `${slug} ${width} ${theme}: horizontal overflow ${JSON.stringify(dimensions)}`);
        for (const image of await page.$$('img')) {
          if (!await image.evaluate(node => node.complete && node.naturalWidth > 0)) {
            await image.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
            await page.waitForFunction(node => node.complete && node.naturalWidth > 0, { timeout: 15000 }, image);
          }
        }
        const images = await page.$$eval('img', nodes => nodes.map(node => ({ src: node.getAttribute('src'), loaded: node.complete && node.naturalWidth > 0 })));
        assert.ok(images.every(image => image.loaded), `${slug}: images loaded`);
        const heroRatio = await page.$eval('.finished-shot img', node => ({ rendered: node.offsetWidth / node.offsetHeight, intrinsic: node.naturalWidth / node.naturalHeight }));
        // The legacy hero has a decorative rotation; new cases preserve the image's ratio.
        if (slug !== 'screenshot-beautifier') assert.ok(Math.abs(heroRatio.rendered - heroRatio.intrinsic) < 0.1, `${slug}: undistorted hero`);
        await page.$eval('#reveal', node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        const sliderBox = await (await page.$('#reveal')).boundingBox();
        await page.mouse.click(sliderBox.x + sliderBox.width / 4, sliderBox.y + sliderBox.height / 2);
        const mouseValue = Number(await page.$eval('#reveal', node => node.value));
        assert.ok(mouseValue >= 20 && mouseValue <= 30, `${slug}: pointer slider control (value ${mouseValue})`);
        await page.focus('#reveal');
        await page.keyboard.press('Home');
        assert.equal(await page.$eval('#reveal', node => node.getAttribute('aria-valuetext')), '100% of the styled export revealed');
        await page.keyboard.press('End');
        assert.equal(await page.$eval('#reveal', node => node.getAttribute('aria-valuetext')), '0% of the styled export revealed');
        await page.keyboard.press('ArrowLeft');
        assert.equal(await page.$eval('#reveal', node => node.value), '99');
        await page.keyboard.press('Home');
        for (let step = 0; step < 50; step++) await page.keyboard.press('ArrowRight');
        const firstFaq = await page.$('.faq-list summary');
        await firstFaq.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
        await firstFaq.click();
        assert.equal(await firstFaq.evaluate(node => node.parentElement.open), true);
        await firstFaq.click();
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        const screenshot = `${slug}-${width}-${theme}.png`;
        await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
        results.layouts.push({ slug, width, theme, overflow: false, images: images.length, screenshot, sliderKeyboard: true, sliderPointer: true, faq: true, themePersistence: true });
      }
    }
  }

  for (const slug of targets) {
    await page.setJavaScriptEnabled(false);
    await page.goto(`${origin}/${slug}/`, { waitUntil: 'networkidle0' });
    const staticState = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent.trim(), faqs: document.querySelectorAll('details').length, visible: [...document.querySelectorAll('.reveal')].every(node => getComputedStyle(node).opacity === '1') }));
    assert.equal(staticState.faqs, 6);
    assert.ok(staticState.visible && staticState.h1, `${slug}: content without JS`);
    await page.setJavaScriptEnabled(true);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(`${origin}/${slug}/`, { waitUntil: 'networkidle0' });
    assert.equal(await page.$$eval('.reveal', nodes => nodes.every(node => getComputedStyle(node).opacity === '1')), true);
    results.staticContent.push({ slug, noJavaScript: true, reducedMotion: true });
  }

  await page.goto(`${origin}/og-image-generator/`, { waitUntil: 'networkidle0' });
  await page.click('.hero-copy a.button');
  await page.waitForSelector('#studio-canvas');
  assert.equal(new URL(page.url()).search, '?editor=1&aspect=og');
  assert.deepEqual(await page.$eval('#studio-canvas', node => ({ width: node.offsetWidth, height: node.offsetHeight })), { width: 1200, height: 630 });
  const tools = await page.$$eval('nav[aria-label="Screenshot tools"] a', nodes => nodes.map(node => new URL(node.href).pathname));
  for (const slug of slugs) assert.ok(tools.includes(`/${slug}/`), `editor footer: ${slug}`);
  results.editorEntry = { url: page.url(), canvas: true, toolLinks: tools };
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  results.passed = false;
  results.failure = error.stack;
  throw error;
} finally {
  results.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
  console.log(JSON.stringify({ passed: results.passed, routes: results.routes.length, layouts: results.layouts.length, staticContent: results.staticContent.length, errors: results.errors, output }));
}
