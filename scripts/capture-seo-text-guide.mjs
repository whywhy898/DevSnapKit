import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { launchBrowser, clickButton, finishTextEditing, downloadPng } from '../tests/helpers/browser.mjs';
import { startSeoServer } from '../tests/helpers/seo-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(process.env.SEO_GUIDE_OUTPUT || 'D:/workspace/MarkMoney/output/devsnapkit/seo-text-guide-2026-10-30');
const capture = process.argv.includes('--capture');
const remote = process.argv.find(arg => arg.startsWith('--origin='))?.slice(9);
if (capture && remote) throw Error('Capture assets only from the local build.');
await fs.mkdir(output, { recursive: true });
const server = remote ? null : await startSeoServer(() => ({}));
const origin = remote || server.origin;
const browser = await launchBrowser();
const result = { origin, capture, cases: [], pageErrors: [], assets: [] };
let activePage;

async function pageAt(width, { dark = false, noScript = false } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(20000);
  await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);
  if (noScript) await page.setJavaScriptEnabled(false);
  await page.evaluateOnNewDocument(() => localStorage.setItem('devsnapkit_welcome_seen', '1'));
  page.on('pageerror', error => result.pageErrors.push(error.message));
  if (remote) {
    await page.setRequestInterception(true);
    page.on('request', request => request.url().includes('/api/telemetry/event')
      ? request.respond({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
      : request.continue());
  }
  await page.goto(`${origin}/add-text-to-image/`, { waitUntil: 'networkidle0' });
  return { page, context };
}

// Decode and losslessly re-encode pixels. Never copy source metadata.
async function publishAsset(input, name) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const target = path.join(root, 'public/seo/examples', name);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .webp({ lossless: true, effort: 6 }).toFile(target);
  const decoded = await sharp(target).ensureAlpha().raw().toBuffer();
  assert.ok(decoded.equals(data), `${name}: lossless pixel round trip`);
  const bytes = await fs.readFile(target);
  const chunks = [];
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const type = bytes.subarray(offset, offset + 4).toString('ascii');
    const size = bytes.readUInt32LE(offset + 4);
    chunks.push(type);
    offset += 8 + size + (size % 2);
  }
  assert.ok(chunks.every(type => ['VP8X', 'ALPH', 'VP8 ', 'VP8L'].includes(type)), `${name}: image chunks only`);
  const metadata = await sharp(target).metadata();
  assert.ok(!metadata.exif && !metadata.xmp && !metadata.icc);
  result.assets.push({ name, width: info.width, height: info.height, bytes: bytes.length, chunks, pixelsUnchanged: true });
}

async function changeField(page, label, value) {
  const selector = `[aria-label="${label}"]`;
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.type(value);
  await page.keyboard.press('Enter');
}

try {
  for (const width of capture ? [1440] : [1440, 390]) {
    const { page, context } = await pageAt(width);
    if (!capture) {
      await page.waitForSelector('#how-to-write-on-a-screenshot');
      const layout = await page.evaluate(async () => {
        const images = [...document.querySelectorAll('.text-guide img')];
        for (const image of images) { image.loading = 'eager'; await image.decode(); }
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          images: images.length,
          broken: images.filter(image => !image.naturalWidth).length,
          canonical: document.querySelector('link[rel="canonical"]').href,
          headings: [...document.querySelectorAll('h1')].length,
        };
      });
      assert.equal(layout.overflow, false);
      assert.equal(layout.images, 4);
      assert.equal(layout.broken, 0);
      assert.equal(layout.headings, 1);
      assert.equal(layout.canonical, 'https://devsnapkit.com/add-text-to-image/');
      // The existing comparison remains keyboard-operable.
      await page.focus('#reveal');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.$eval('#reveal', node => node.value), '51');
      const guide = await page.$('.text-guide');
      await guide.screenshot({ path: path.join(output, `guide-${width}.png`) });
      await page.screenshot({ path: path.join(output, `page-${width}.png`), fullPage: true });
      await page.click('.text-guide a[data-guide-editor]');
    } else {
      await page.click('.hero-copy a.button');
    }
    await page.waitForSelector('#studio-canvas');
    await page.waitForSelector('[data-canvas-text-controls]', { visible: true });
    assert.equal(new URL(page.url()).searchParams.get('tool'), 'text');
    const chooser = page.waitForFileChooser();
    await page.click('button[title="Upload screenshot from computer"]');
    await (await chooser).accept([path.join(root, 'public/seo/examples/text-source.png')]);
    await page.waitForFunction(() => [...document.querySelectorAll('#studio-canvas img')].some(image => image.complete && image.naturalWidth > 0 && /^(blob:|data:image\/png)/.test(image.src)));
    await page.evaluate(() => document.fonts.ready);
    if (capture) await publishAsset(await page.screenshot(), 'text-guide-upload.webp');
    await clickButton(page, 'Add text');
    await page.waitForSelector('[aria-label="Text content"]', { visible: true });
    await page.keyboard.down('Control');
    await page.keyboard.press('a');
    await page.keyboard.up('Control');
    await page.keyboard.type('Understand CSS grid.');
    await finishTextEditing(page);
    await changeField(page, 'Text size', '38');
    await changeField(page, 'Text color', '#182638');
    await changeField(page, 'Text width', '900');
    await changeField(page, 'Text y', '44');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-canvas-text]')].some(node => node.textContent === 'Understand CSS grid.'));
    await page.$eval('aside.studio-inspector', node => { node.scrollTop = 0; });
    if (capture) await publishAsset(await page.screenshot(), 'text-guide-edit.webp');
    await clickButton(page, 'Export');
    const downloaded = await downloadPng(page, output, `text-export-${width}.png`, async () => {
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.getClientRects().length && /^Download (?:[124]x|4K)/.test(node.textContent.trim())));
      await page.evaluate(() => [...document.querySelectorAll('button')].find(node => node.getClientRects().length && /^Download (?:[124]x|4K)/.test(node.textContent.trim())).click());
    });
    const metadata = await sharp(downloaded.path).metadata();
    const attribution = await page.evaluate(() => JSON.parse(sessionStorage.getItem('dsk_attribution_v1')));
    assert.equal(attribution.entry, '/add-text-to-image/');
    if (server) {
      for (let attempt = 0; attempt < 100 && !server.events.some(event => event.sessionId === attribution.sid && event.event === 'export_image'); attempt++) await new Promise(resolve => setTimeout(resolve, 50));
      const stages = server.events.filter(event => event.sessionId === attribution.sid);
      for (const name of ['seo_landing_view', 'seo_editor_open', 'upload_image', 'export_image']) {
        assert.ok(stages.some(event => event.event === name && event.metadata.seo_entry === '/add-text-to-image/'), `${name}: the guide preserves source attribution`);
      }
    }
    if (capture) await publishAsset(downloaded.path, 'text-guide-export.webp');
    result.cases.push({ width, exportWidth: metadata.width, exportHeight: metadata.height, export: downloaded.path, text: 'Understand CSS grid.' });
    await context.close();
  }
  if (!capture) for (const options of [{ width: 320 }, { width: 768 }, { width: 1024 }, { width: 390, dark: true }, { width: 1440, dark: true }, { width: 390, noScript: true }]) {
    const { page, context } = await pageAt(options.width, options);
    const layout = await page.evaluate(async () => {
      const guide = document.querySelector('.text-guide');
      for (const image of guide.querySelectorAll('img')) { image.loading = 'eager'; await image.decode(); }
      const heading = guide.querySelector('h2');
      return {
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        paragraphSize: parseFloat(getComputedStyle(guide.querySelector('.guide-copy p:not(.eyebrow)')).fontSize),
        headingVisible: getComputedStyle(heading).visibility === 'visible' && getComputedStyle(heading).opacity === '1',
      };
    });
    assert.equal(layout.overflow, false, JSON.stringify(options));
    assert.ok(layout.paragraphSize >= 14, 'Walkthrough copy remains readable');
    assert.equal(layout.headingVisible, true);
    if (options.dark || options.noScript) await page.screenshot({ path: path.join(output, `page-${options.width}-${options.dark ? 'dark' : 'no-script'}.png`), fullPage: true });
    result.cases.push({ ...options, layoutOnly: true, ...layout });
    await context.close();
  }
  assert.deepEqual(result.pageErrors, []);
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.error = error.stack;
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    result.diagnostics = await activePage.evaluate(() => ({ text: document.body.innerText.slice(-7000), controls: [...document.querySelectorAll('[data-canvas-text-controls] input')].map(node => ({ label: node.getAttribute('aria-label'), value: node.value, visible: node.getClientRects().length > 0 })) })).catch(() => null);
  }
  process.exitCode = 1;
} finally {
  await browser.close();
  await server?.close();
  await fs.writeFile(path.join(output, capture ? 'capture.json' : 'acceptance.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, cases: result.cases.length, assets: result.assets, error: result.error?.split('\n')[0], output }));
}
