import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'node:dns/promises';
import { launchBrowser, clickButton, downloadPng, legacyPosterUrl } from './helpers/browser.mjs';

const origin = process.argv[2] || 'http://127.0.0.1:4179';
const output = path.resolve(process.argv[3] || 'D:/workspace/MarkMoney/output/devsnapkit/seo-entry-fixes-2026-10-24/local');
const args = ['--disable-quic'];
if (process.env.SEO_SYSTEM_DNS === '1') {
  const hostname = new URL(origin).hostname;
  args.push(`--host-resolver-rules=MAP ${hostname} ${(await lookup(hostname, { family: 4 })).address}`);
}
await fs.mkdir(output, { recursive: true });
const browser = await launchBrowser(args);
const results = { origin, cases: [], errors: [], startedAt: new Date().toISOString() };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  page.setDefaultNavigationTimeout(60000);
  page.on('pageerror', error => results.errors.push(error.message));
  await page.evaluateOnNewDocument(() => localStorage.setItem('devsnapkit_welcome_seen', '1'));
  const open = async search => {
    await page.goto(`${origin}/${search}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#studio-canvas');
  };
  const size = () => page.$eval('#studio-canvas', node => ({ width: node.offsetWidth, height: node.offsetHeight }));
  const selected = title => page.$eval(`button[title="${title}"]`, node => node.className.includes('bg-white/15'));
  const waitSize = async (width, height) => page.waitForFunction((w, h) => {
    const node = document.querySelector('#studio-canvas');
    return node?.offsetWidth === w && node?.offsetHeight === h;
  }, {}, width, height);
  await open('?editor=1');
  const defaultSize = await size();
  assert.equal(await selected('Single shot (1 image)'), true);
  assert.equal(await page.$eval('[data-canvas-text-controls]', node => node.getClientRects().length > 0), false);
  await open('?editor=1&aspect=bad&tool=bad&mode=bad');
  assert.deepEqual(await size(), defaultSize);
  assert.equal(await selected('Single shot (1 image)'), true);
  assert.equal(await page.$eval('[data-canvas-text-controls]', node => node.getClientRects().length > 0), false);
  results.cases.push({ case: 'default and invalid values', size: defaultSize });
  for (const alias of ['og', 'twitter']) {
    await open(`?editor=1&aspect=${alias}`);
    assert.deepEqual(await size(), { width: 1200, height: 630 }, alias);
    results.cases.push({ case: `aspect=${alias}`, size: await size() });
  }
  await open('?editor=1&aspect=og');
  assert.equal(await page.$eval('button[title^="Undo ("]', node => node.disabled), true, 'entry is the history baseline');
  await clickButton(page, '1:1');
  await waitSize(1080, 1080);
  await page.waitForFunction(() => !document.querySelector('button[title^="Undo ("]').disabled);
  await clickButton(page, 'Undo');
  await waitSize(1200, 630);
  await clickButton(page, 'Redo');
  await waitSize(1080, 1080);
  await page.reload({ waitUntil: 'networkidle0' });
  await waitSize(1200, 630);
  results.cases.push({ case: 'manual changes, undo/redo, refresh', passed: true });
  await open('?editor=1&tool=text');
  await page.waitForSelector('[data-canvas-text-controls]', { visible: true });
  assert.equal((await page.$$('[data-canvas-text]')).length, 0, 'no unsolicited empty text');
  await clickButton(page, 'Frame');
  assert.equal(await page.$eval('[data-canvas-text-controls]', node => node.getClientRects().length > 0), false, 'manual tab change persists');
  results.cases.push({ case: 'tool=text opens panel without adding content', passed: true });

  const entries = [
    ['og-image-generator', '?editor=1&aspect=og'],
    ['product-hunt-image-maker', '?editor=1&mode=duo&aspect=og'],
    ['add-text-to-image', '?editor=1&tool=text'],
  ];
  for (const width of [1440, 390]) {
    await page.setViewport({ width, height: 1100, deviceScaleFactor: 1 });
    for (const [slug, expected] of entries) {
      await page.goto(`${origin}/${slug}/`, { waitUntil: 'networkidle0' });
      const targets = await page.$$eval('a[href^="/?"]', nodes => nodes.map(node => new URL(node.href).search));
      assert.ok(targets.length >= 3 && targets.every(target => target === expected), `${slug}: all CTAs`);
      await page.click('.hero-copy a.button');
      await page.waitForSelector('#studio-canvas');
      assert.equal(new URL(page.url()).search, expected);
      if (slug === 'add-text-to-image') {
        await page.waitForSelector('[data-canvas-text-controls]', { visible: true });
        assert.equal((await page.$$('[data-canvas-text]')).length, 0);
      } else {
        await waitSize(1200, 630);
        if (slug === 'product-hunt-image-maker') {
          assert.equal(await selected('Dual shots (2 images)'), true);
          await clickButton(page, 'Frame');
          await page.waitForSelector('button[aria-label="Replace Image 2"]', { visible: true });
        }
      }
      await page.screenshot({ path: path.join(output, `${slug}-${width}-entry.png`), fullPage: true });
      results.cases.push({ case: `${slug} CTA ${width}px`, query: expected, passed: true });
    }
  }

  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await open('?editor=1&mode=duo&aspect=og&tool=text&title=Entry%20demo&theme=aurora');
  await page.waitForSelector('[data-canvas-text-controls]', { visible: true });
  assert.equal(await selected('Dual shots (2 images)'), true);
  await waitSize(1200, 630);
  await clickButton(page, 'Frame');
  const chooser = page.waitForFileChooser();
  await page.click('button[aria-label="Replace Image 2"]');
  await (await chooser).accept([new URL('../public/seo/examples/ph-secondary-original.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')]);
  await page.waitForFunction(() => document.querySelector('[aria-label="Select Image 2"] img')?.complete && document.querySelector('[aria-label="Select Image 2"] img')?.naturalWidth > 0);
  await waitSize(1200, 630);
  await page.click('button[title="Single shot (1 image)"]');
  assert.equal(await selected('Single shot (1 image)'), true);
  results.cases.push({ case: 'combined params, actual secondary upload, manual single mode', passed: true });

  await open('?editor=1&aspect=og');
  await clickButton(page, 'Download');
  const downloaded = await downloadPng(page, output, 'og-entry-export-2x.png', () => clickButton(page, 'Download 2x (2400×1260)'));
  const bytes = await fs.readFile(downloaded.path);
  assert.deepEqual({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }, { width: 2400, height: 1260 });
  results.cases.push({ case: 'real OG entry PNG export', width: 2400, height: 1260 });
  await page.goto(legacyPosterUrl(origin + '/?editor=1'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-poster-editor]');
  assert.ok(await page.$('[data-poster-artwork]'));
  assert.equal(await page.$('nav[aria-label="Studio mode"]'), null);
  results.cases.push({ case: 'legacy Poster compatibility retained', passed: true });
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
  console.log(JSON.stringify({ passed: results.passed, cases: results.cases.length, output }));
}
