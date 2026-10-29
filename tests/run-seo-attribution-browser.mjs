import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, clickButton, downloadPng } from './helpers/browser.mjs';
import { startSeoServer } from './helpers/seo-server.mjs';

const output = path.resolve(process.argv[3] || 'D:/workspace/MarkMoney/output/devsnapkit/seo-attribution-2026-10-29');
const image = fileURLToPath(new URL('../public/seo/examples/mdn-original.png', import.meta.url));
await fs.mkdir(output, { recursive: true });
const browser = await launchBrowser();
const entries = ['screenshot-beautifier', 'og-image-generator', 'product-hunt-image-maker', 'add-text-to-image'];
const funnelRows = entries.map((slug, i) => ({ entry: `/${slug}/`, label: slug, landings: 10, editorOpens: 8, uploads: 6, exports: 4, proOpens: 2, checkoutClicks: 1 }));
const stats = {
  success: true, timestamp: new Date().toISOString(),
  system: { storageEngine: 'D1', isD1Connected: true, isKvConnected: false, isEmailConfigured: false, notificationRecipient: '' },
  overview: {}, dailyTrends: [], recentOrders: [], topCountries: [], topReferrers: [], recentVisits: [],
  seoFunnel: { available: true, windowDays: 30, rows: funnelRows },
};
let proFixture = false;
const server = await startSeoServer(() => stats, process.argv[2], () => proFixture);
const origin = server.origin;
const result = { cases: [], errors: [], startedAt: new Date().toISOString(), origin };
let activePage;
async function setup(width, denied = false, pro = false) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  activePage = page;
  await page.setViewport({ width, height: 1100, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => result.errors.push(error.message));
  server.events.length = 0;
  const events = server.events;
  await page.evaluateOnNewDocument(({ denied, pro }) => {
    localStorage.setItem('devsnapkit_welcome_seen', '1');
    localStorage.setItem('devsnapkit_admin_token', 'qa-fixture-token');
    if (pro) localStorage.setItem('devsnapkit_license_key', 'DSK-TEST-TEST-TEST');
    if (denied) Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
  }, { denied, pro });
  return { context, page, events };
}
async function exportImage(page, filename) {
  await clickButton(page, 'Export');
  let downloaded;
  try { downloaded = await downloadPng(page, output, filename, async () => {
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.getClientRects().length && /^Download (?:[124]x|4K)/.test(b.textContent.trim())));
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.getClientRects().length && /^Download (?:[124]x|4K)/.test(b.textContent.trim())).click());
  }); } catch (error) {
    result.exportDiagnostics = await page.evaluate(() => ({
      visibleText: document.body.innerText,
      alerts: [...document.querySelectorAll('[role="alert"],[role="alertdialog"]')].map(node => node.textContent),
    }));
    await page.screenshot({ path: path.join(output, 'export-failure.png'), fullPage: true });
    throw error;
  }
  const bytes = await fs.readFile(downloaded.path);
  assert.ok(bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
async function upload(page) {
  const chooser = page.waitForFileChooser();
  await page.click('button[title="Upload screenshot from computer"]');
  await (await chooser).accept([image]);
  await page.waitForFunction(() => [...document.querySelectorAll('#studio-canvas img')].some(img => img.complete && img.naturalWidth > 0 && /^(blob:|data:image\/png)/.test(img.src)));
}
async function waitForEvent(events, type) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (events.some(event => Array.isArray(type) ? type.includes(event.event) : event.event === type)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail('Missing real telemetry event: ' + type);
}
try {
  if (!process.env.SEO_BATCH_ONLY) for (const width of (process.env.SEO_TEST_SLUG ? [1440] : [1440, 390])) for (const slug of entries.filter(slug => !process.env.SEO_TEST_SLUG || slug === process.env.SEO_TEST_SLUG)) {
    const { context, page, events } = await setup(width);
    result.running = `${slug}:${width}:landing`;
    await page.goto(`${origin}/${slug}/?private=do-not-collect`, { waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('body', node => node.scrollWidth <= window.innerWidth + 1), true, `${slug}: no horizontal overflow`);
    assert.ok(await page.$('main a.text-link'));
    await page.screenshot({ path: path.join(output, `${slug}-${width}.png`), fullPage: true });
    result.running = `${slug}:${width}:editor`;
    await page.click('.hero-copy a.button');
    await page.waitForSelector('#studio-canvas');
    if (['og-image-generator', 'product-hunt-image-maker'].includes(slug)) {
      assert.deepEqual(await page.$eval('#studio-canvas', node => ({ width: node.offsetWidth, height: node.offsetHeight })), { width: 1200, height: 630 });
    }
    if (slug === 'add-text-to-image') await page.waitForSelector('[data-canvas-text-controls]', { visible: true });
    result.running = `${slug}:${width}:upload`;
    await upload(page);
    if (slug === 'product-hunt-image-maker') {
      await clickButton(page, 'Frame');
      const chooser = page.waitForFileChooser();
      await page.click('button[aria-label="Replace Image 2"]');
      await (await chooser).accept([image]);
      await waitForEvent(events, ['media_slot_add', 'media_slot_replace']);
    }
    result.running = `${slug}:${width}:export`;
    const dimensions = await exportImage(page, `${slug}-${width}-export.png`);
    result.running = `${slug}:${width}:telemetry`;
    await waitForEvent(events, 'export_image');
    const tracked = ['seo_landing_view', 'seo_editor_open', 'upload_image', 'export_image'].map(type => {
      const event = events.find(e => e.event === type);
      assert.ok(event, `${slug}: ${type}; captured=${events.map(e => e.event).join(',')}`);
      assert.equal(event.metadata.seo_entry, `/${slug}/`);
      assert.equal(event.metadata.attribution_storage, 'session');
      return event;
    });
    assert.equal(new Set(tracked.map(e => e.sessionId)).size, 1, 'one session across real navigation/upload/export');
    assert.ok(tracked.every((e, i) => !i || e.metadata.event_sequence > tracked[i - 1].metadata.event_sequence));
    assert.ok(!JSON.stringify(events).includes('do-not-collect'));
    assert.ok(!JSON.stringify(events).includes('data:image'));
    assert.ok(!events.some(e => ['upload_image', 'upload_logo'].includes(e.event) && e.metadata.name));
    assert.equal(tracked.at(-1).metadata.format, 'png');
    result.running = `${slug}:${width}:refresh`;
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('dsk_attribution_v1')).sid), tracked[0].sessionId);
    result.cases.push({ slug, width, dimensions, sessionRetained: true, events: tracked.map(e => e.event) });
    await context.close();
  }
  {
    result.running = 'pro-batch:setup';
    proFixture = true;
    const { context, page, events } = await setup(1440, false, true);
    await page.goto(`${origin}/product-hunt-image-maker/`, { waitUntil: 'networkidle0' });
    await page.click('.hero-copy a.button');
    await page.waitForSelector('#studio-canvas');
    await clickButton(page, 'Frame');
    const chooser = page.waitForFileChooser();
    await page.click('button[aria-label="Replace Image 2"]');
    await (await chooser).accept([image]);
    await waitForEvent(events, ['media_slot_add', 'media_slot_replace']);
    result.running = 'pro-batch:choose-sizes';
    await clickButton(page, 'Export');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.getClientRects().length && /^Export \d+ Sizes/.test(b.textContent.trim())));
    await page.evaluate(async () => {
      const button = [...document.querySelectorAll('button')].find(b => b.getClientRects().length && /^Export \d+ Sizes/.test(b.textContent.trim()));
      const checkboxes = [...button.parentElement.querySelectorAll('input[type="checkbox"]')];
      for (let i = 0; i < checkboxes.length; i++) if (checkboxes[i].checked !== (i === 0)) {
        checkboxes[i].click();
        await new Promise(requestAnimationFrame);
      }
    });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.getClientRects().length && /^Export 1 Sizes/.test(b.textContent.trim())));
    result.running = 'pro-batch:download';
    await downloadPng(page, output, 'pro-batch-export.png', () => page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.getClientRects().length && /^Export 1 Sizes/.test(b.textContent.trim())).click()));
    await waitForEvent(events, 'export_image');
    assert.equal(events.find(e => e.event === 'export_image').metadata.method, 'batch');
    assert.ok(!events.some(e => e.event === 'upload_image'), 'secondary-only upload is tested independently');
    result.cases.push({ case: 'Pro secondary-only upload and actual batch export', passed: true });
    await context.close();
    proFixture = false;
  }
  if (!process.env.SEO_BATCH_ONLY) {
    const { context, page, events } = await setup(390, true);
    await page.goto(`${origin}/og-image-generator/`, { waitUntil: 'networkidle0' });
    await page.click('.hero-copy a.button');
    await page.waitForSelector('#studio-canvas');
    await upload(page);
    await exportImage(page, 'denied-storage-export.png');
    await waitForEvent(events, 'export_image');
    const event = events.find(e => e.event === 'export_image');
    assert.equal(event?.metadata.seo_entry, '/og-image-generator/');
    assert.equal(event?.metadata.attribution_storage, 'memory');
    result.cases.push({ case: 'denied storage still navigates, uploads and exports', passed: true });
    await context.close();
  }
  {
    const { context, page } = await setup(1440);
    await page.goto(`${origin}/admin`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-seo-funnel] tbody tr');
    assert.equal((await page.$$('[data-seo-funnel] tbody tr')).length, 4);
    assert.ok((await page.$eval('[data-seo-funnel]', node => node.textContent)).includes('40.0%'));
    await page.screenshot({ path: path.join(output, 'admin-seo-funnel.png'), fullPage: true });
    stats.seoFunnel.available = false;
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-seo-funnel] [role="status"]');
    assert.equal((await page.$$('[data-seo-funnel] tbody')).length, 0);
    result.cases.push({ case: 'admin shows four entry rows and explicit unavailable state', passed: true });
    await context.close();
  }
  assert.deepEqual(result.errors, []);
  result.passed = true;
} catch (error) {
  result.passed = false;
  result.failure = error.stack;
  try {
    result.failureState = await activePage.evaluate(() => document.body.innerText);
    await activePage.screenshot({ path: path.join(output, 'browser-failure.png'), fullPage: true });
  } catch {}
  throw error;
} finally {
  result.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
  await browser.close();
  await server.close();
  console.log(JSON.stringify({ passed: result.passed, cases: result.cases.length, output }));
}
