import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { prepareTemplateFixtures } from './prepare-template-fixtures.mjs';
import { launchBrowser, clickButton, downloadPng, finishTextEditing } from './helpers/browser.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.TEMPLATE_OUTPUT || path.join(root, '../../output/devsnapkit/mockup-templates-m15-m2-2026-10-24/browser'));
const origin = process.env.TEMPLATE_ORIGIN || 'http://127.0.0.1:5198';
let server, browser;
const results = [], errors = [];
const cases = [
  ['social-launch', 'Social Launch', 1200, 630, 'saas', 'Ship HoneyWeRank.', 'Discover your next chapter.'],
  ['saas-dashboard', 'SaaS Dashboard', 1920, 1080, 'saas', 'Know your audience.', 'A clearer view of your product.'],
  ['mobile-app', 'Mobile App', 1080, 1920, 'mobile', 'Your next\nchapter.', 'A calmer way to get discovered.'],
  ['code-terminal', 'Code & Terminal', 1920, 1080, 'code', 'Build something clear.', 'Ship the update that matters.'],
];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function state(page) { return page.evaluate(() => window.__mockupBaseline.snapshot); }
async function settle(page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(image => image.decode())); });
  await pause(650);
}
async function open(viewport = { width: 1440, height: 1100, deviceScaleFactor: 1 }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.evaluateOnNewDocument(() => { localStorage.clear(); localStorage.setItem('devsnapkit_welcome_seen', '1'); sessionStorage.setItem('dsk_session_id', 'qa_templates_m2'); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/?editor=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__mockupBaseline));
  await settle(page);
  return page;
}
function sameSnapshot(actual, expected, label) {
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])];
  const differences = keys.filter(key => JSON.stringify(actual[key]) !== JSON.stringify(expected[key]));
  assert.equal(differences.length, 0, `${label}; changed fields: ${differences.join(', ')}`);
}
async function apply(page, name, id) {
  await page.click('button[aria-label="Templates"]');
  await page.click(`button[aria-label="Apply ${name} template"]`);
  await page.waitForFunction(id => window.__mockupBaseline.snapshot.templateContext?.id === id, {}, id);
  await settle(page);
  assert.equal(await page.$$eval('[data-text-layout-errors]', nodes => nodes.length), 0, `${id}: no default text overflow`);
  assert.equal(await page.$eval('button[title=\'Load "Code Terminal" sample image\']', node => node.getClientRects().length > 0), true, 'Apply returns to Frame');
}
async function edit(page, index, value) {
  const id = (await state(page)).textDocument.layers[index].id;
  await page.click(`[data-text-hit="${id}"]`);
  await page.waitForSelector('[aria-label="Text content"]', { visible: true });
  await page.focus('[aria-label="Text content"]');
  await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
  await page.keyboard.type(value);
  await finishTextEditing(page); await settle(page);
  assert.equal((await state(page)).textDocument.layers[index].content, value);
}
async function png(page, filename, width, height) {
  await clickButton(page, 'Export'); await clickButton(page, '1x Web');
  await page.mouse.move(0, 0); await settle(page);
  await page.evaluate(() => {
    const measure = canvas => {
      const scale = canvas.getBoundingClientRect().width / canvas.offsetWidth;
      const bounds = canvas.getBoundingClientRect();
      return [...canvas.querySelectorAll('[data-canvas-text], [data-scene-fit]')].map(node => {
        const r = node.getBoundingClientRect();
        return { key: node.getAttribute('data-canvas-text') || 'media', x: (r.x - bounds.x) / scale, y: (r.y - bounds.y) / scale, w: r.width / scale, h: r.height / scale, font: getComputedStyle(node).fontFamily, weight: getComputedStyle(node).fontWeight };
      });
    };
    window.__previewGeometry = measure(document.querySelector('#studio-canvas'));
    window.__exportGeometry = null;
    window.__exportObserver?.disconnect();
    window.__exportObserver = new MutationObserver(() => {
      const canvas = document.querySelector('[data-export-target] > [data-canvas-root]');
      if (canvas) window.__exportGeometry = measure(canvas);
    });
    window.__exportObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
  let contrast;
  if (filename.includes('-default')) {
    await page.$$eval('#studio-canvas [data-canvas-text]', nodes => nodes.forEach(node => { node.dataset.testVisibility = node.style.visibility; node.style.visibility = 'hidden'; }));
    let background;
    try { background = await (await page.$('#studio-canvas')).screenshot(); }
    finally { await page.$$eval('#studio-canvas [data-canvas-text]', nodes => nodes.forEach(node => { node.style.visibility = node.dataset.testVisibility; delete node.dataset.testVisibility; })); }
    const { data, info } = await sharp(background).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const layers = (await state(page)).textDocument.layers;
    const rects = await page.evaluate(() => window.__previewGeometry);
    const luminance = rgb => rgb.map(c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    contrast = layers.map((layer, i) => {
      const rect = rects.find(rect => rect.key === layer.id), ratio = info.width / width;
      const foreground = luminance(layer.color.match(/[a-f\d]{2}/gi).map(hex => parseInt(hex, 16)));
      let minimum = Infinity;
      for (let y = Math.max(0, Math.floor(rect.y * ratio)); y < Math.min(info.height, Math.ceil((rect.y + rect.h) * ratio)); y++) for (let x = Math.max(0, Math.floor(rect.x * ratio)); x < Math.min(info.width, Math.ceil((rect.x + rect.w) * ratio)); x++) {
        const offset = (y * info.width + x) * 4, bg = luminance([...data.subarray(offset, offset + 3)]);
        minimum = Math.min(minimum, (Math.max(foreground, bg) + .05) / (Math.min(foreground, bg) + .05));
      }
      assert.ok(minimum >= (i ? 4.5 : 3), `${filename} contrast ${minimum}`);
      return { role: i ? 'description' : 'headline', minimumRatio: minimum, region: rect, method: 'All pixels in the actual preview text layout box with text temporarily hidden; WCAG relative luminance' };
    });
  }
  let downloaded;
  try { downloaded = await downloadPng(page, output, filename, () => clickButton(page, `Download 1x (${width}×${height})`)); }
  catch (error) {
    if (!['ENOTEMPTY', 'EBUSY'].includes(error.code)) throw error;
    downloaded = { path: path.join(output, filename), cleanupWarning: error.code };
  }
  const bytes = await fs.readFile(downloaded.path);
  assert.equal(bytes.readUInt32BE(16), width); assert.equal(bytes.readUInt32BE(20), height);
  assert.equal(bytes.subarray(-8, -4).toString(), 'IEND');
  const geometry = await page.evaluate(() => { window.__exportObserver.disconnect(); return { preview: window.__previewGeometry, exported: window.__exportGeometry, metrics: window.__lastExportMetrics }; });
  assert.ok(geometry.exported?.length, 'Captured actual export DOM');
  let maxDelta = 0;
  for (const item of geometry.preview) {
    const actual = geometry.exported.find(node => node.key === item.key); assert.ok(actual, item.key);
    for (const field of ['x', 'y', 'w', 'h']) maxDelta = Math.max(maxDelta, Math.abs(actual[field] - item[field]));
    assert.equal(actual.font, item.font); assert.equal(actual.weight, item.weight);
  }
  assert.ok(maxDelta <= 2, `preview/export geometry ${maxDelta}px`);
  await page.screenshot({ path: path.join(output, filename.replace('.png', '.editor.png')) });
  return { ...downloaded, width, height, maxGeometryDelta: maxDelta, geometry, contrast };
}

try {
  await fs.mkdir(output, { recursive: true });
  if (!process.env.TEMPLATE_ORIGIN) {
    const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
    server = spawn(process.execPath, [vite, '--config', 'tests/vite-mockup-baseline.config.mjs', '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch {} await pause(100); }
  }
  browser = await launchBrowser();
  for (const [id, name, width, height, sampleId, title, subtitle] of process.env.TEMPLATE_SKIP_EXPORTS ? [] : cases) {
    const page = await open();
    await apply(page, name, id);
    assert.equal((await state(page)).primaryMediaOrigin.sampleId, sampleId);
    const defaultExport = await png(page, `${id}-default.png`, width, height);
    const file = await page.$('[aria-label="Main screenshot file"]');
    await file.uploadFile(path.join(root, 'tests/fixtures/poster-v1/honey-main.png'));
    await page.waitForFunction(() => window.__mockupBaseline.snapshot.primaryMediaOrigin?.kind === 'user');
    await settle(page);
    const uploaded = await state(page);
    assert.equal(uploaded.windowTheme, id === 'social-launch' ? 'browser' : id === 'mobile-app' ? 'iphone-17' : 'mac-dark');
    await edit(page, 0, title); await edit(page, 1, subtitle);
    // Exercise intermediate variable weights and the serif italic export path.
    const headlineId = (await state(page)).textDocument.layers[0].id;
    await page.click(`[data-text-hit="${headlineId}"]`); await finishTextEditing(page);
    if (id === 'code-terminal') { await page.select('[aria-label="Text font"]', 'gelasio'); await page.click('[aria-label="Text italic"]'); }
    await page.select('[aria-label="Text weight"]', '600');
    await settle(page);
    const userExport = await png(page, `${id}-user.png`, width, height);
    assert.equal((await state(page)).imageSrc, uploaded.imageSrc);
    let serifRegularExport;
    if (id === 'code-terminal') {
      await clickButton(page, 'Text'); await page.click('[aria-label="Text italic"]');
      serifRegularExport = await png(page, `${id}-gelasio-600-regular.png`, width, height);
    }
    results.push({ id, defaultExport, userExport, serifRegularExport });
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
    console.log(`${id}: default + user PNG, text edited, geometry ≤2px`);
    await page.close();
  }
  const page = await open();
  const initial = await state(page);
  for (const [id, name] of [...cases, cases[0]]) {
    await apply(page, name, id);
    if (process.env.TEMPLATE_SKIP_EXPORTS) console.log('applied', id, await page.evaluate(() => window.__mockupBaseline.history));
  }
  const final = await state(page);
  for (let i = 0; i < 5; i++) { await clickButton(page, 'Undo'); await pause(80); if (process.env.TEMPLATE_SKIP_EXPORTS) console.log('undo', i, await page.evaluate(() => ({ ...window.__mockupBaseline.history, id: window.__mockupBaseline.snapshot.templateContext?.id }))); }
  sameSnapshot(await state(page), initial, 'five Undo restore original work');
  for (let i = 0; i < 5; i++) { await clickButton(page, 'Redo'); await pause(80); }
  sameSnapshot(await state(page), final, 'five Redo keep all commands');
  const finalCount = await page.evaluate(() => window.__mockupBaseline.history.count);
  await apply(page, 'Social Launch', 'social-launch');
  sameSnapshot(await state(page), final, 'unchanged reapply retains IDs');
  assert.equal(await page.evaluate(() => window.__mockupBaseline.history.count), finalCount, 'unchanged reapply adds no command');
  await edit(page, 0, 'Edited before reapply.');
  const changed = await state(page);
  await apply(page, 'Social Launch', 'social-launch');
  assert.notEqual((await state(page)).textDocument.layers[0].id, changed.textDocument.layers[0].id, 'reset after edits creates fresh text IDs');
  await clickButton(page, 'Undo'); await settle(page);
  sameSnapshot(await state(page), changed, 'reapply reset undoes once');
  await edit(page, 0, 'Keep my words.');
  await page.evaluate(() => {
    const s = window.__mockupBaseline;
    s.apply({ mockupZoom: 180, mockupOffsetX: 90, aspectRatioId: '1-1', textDocument: { ...s.snapshot.textDocument, layers: s.snapshot.textDocument.layers.map((l, i) => i ? l : { ...l, centerX: .2, widthRatio: .4 }) } });
  });
  await settle(page); const beforeRestore = await state(page);
  await clickButton(page, 'Restore layout'); await settle(page);
  const restored = await state(page);
  assert.equal(restored.aspectRatioId, 'og'); assert.equal(restored.mockupZoom, 100);
  assert.equal(restored.textDocument.layers[0].content, 'Keep my words.'); assert.equal(restored.textDocument.layers[0].centerX, .5);
  await clickButton(page, 'Undo'); await pause(100); sameSnapshot(await state(page), beforeRestore, 'restore is one undo');
  results.push({ scenario: 'A-B-C-D-A, five Undo/Redo and layout restore', pass: true });
  await page.close();

  if (!process.env.TEMPLATE_SKIP_EXPORTS) {
    const ordinarySample = await open(); await clickButton(ordinarySample, 'Frame');
    const oldOrdinary = await state(ordinarySample);
    await ordinarySample.click('button[title=\'Load "Code Terminal" sample image\']');
    await ordinarySample.waitForFunction(() => window.__mockupBaseline.snapshot.selectedPreset === 'code'); await settle(ordinarySample);
    const newOrdinary = await state(ordinarySample);
    for (const key of ['windowTheme', 'windowTitle', 'textDocument', 'gradientId', 'aspectRatioId']) assert.equal(JSON.stringify(newOrdinary[key]), JSON.stringify(oldOrdinary[key]), `ordinary Sample images preserves ${key}`);
    assert.deepEqual(await ordinarySample.$eval('#studio-canvas [data-media-surface] img', image => [image.naturalWidth, image.naturalHeight]), [800, 460]);
    results.push({ scenario: 'ordinary Sample images only replace media with decoded dimensions', pass: true });
    await ordinarySample.close();
    const race = await open();
    const beforePreparation = await state(race);
    await race.evaluate(() => {
      const decode = Image.prototype.decode; let first = true;
      Image.prototype.decode = function () {
        if (!first) return decode.call(this);
        first = false;
        return new Promise(resolve => { window.__releaseTemplateDecode = resolve; }).then(() => decode.call(this));
      };
    });
    await race.click('button[aria-label="Templates"]');
    await race.click('button[aria-label="Apply SaaS Dashboard template"]');
    await race.waitForFunction(() => Boolean(window.__releaseTemplateDecode));
    assert.equal(await race.$eval('button[aria-label="Apply Social Launch template"]', node => node.disabled), true);
    assert.match(await race.$eval('[role="status"]', node => node.textContent), /Preparing artwork/);
    sameSnapshot(await state(race), beforePreparation, 'pending template does not write half a snapshot');
    await race.evaluate(() => window.__releaseTemplateDecode());
    await race.waitForFunction(() => window.__mockupBaseline.snapshot.templateContext?.id === 'saas-dashboard'); await settle(race);
    await clickButton(race, 'Undo'); await settle(race);
    sameSnapshot(await state(race), beforePreparation, 'prepared template is exactly one command');
    results.push({ scenario: 'template decode busy UI, no half state, one Undo', pass: true });
    await race.close();
    const fixtureDir = path.join(output, 'synthetic-fixtures');
    await prepareTemplateFixtures(fixtureDir);
    for (const filename of ['landscape.png', 'square.png', 'phone.png', 'long.png', 'transparent.png', 'user.svg']) {
      const assetPage = await open();
      const location = ['long.png', 'transparent.png', 'user.svg'].includes(filename) ? path.join(fixtureDir, filename) : path.join(root, 'tests/fixtures/poster-v1', filename);
      await (await assetPage.$('[aria-label="Main screenshot file"]')).uploadFile(location);
      await assetPage.waitForFunction(name => window.__mockupBaseline.snapshot.imageName === name, {}, filename);
      await settle(assetPage); const original = await state(assetPage);
      const mediaChecks = [];
      for (const [id, name] of cases) {
        await apply(assetPage, name, id); const next = await state(assetPage);
        assert.equal(next.imageSrc, original.imageSrc); assert.equal(next.imageName, filename); assert.equal(next.primaryMediaOrigin.kind, 'user');
        const media = await assetPage.$eval('#studio-canvas [data-media-surface] img', image => ({ naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, fit: getComputedStyle(image).objectFit, boxWidth: image.getBoundingClientRect().width, boxHeight: image.getBoundingClientRect().height }));
        assert.equal(media.fit, 'contain'); assert.ok(media.naturalWidth > 0 && media.naturalHeight > 0);
        if (id !== 'mobile-app') assert.ok(Math.abs(media.boxWidth / media.boxHeight - media.naturalWidth / media.naturalHeight) < .01, `${filename} non-phone image has intrinsic ratio`);
        mediaChecks.push({ template: id, ...media });
      }
      results.push({ scenario: `user-media-${filename}`, pass: true, mediaChecks });
      await assetPage.close();
    }
    const duo = await open();
    await (await duo.$('[aria-label="Second screenshot file"]')).uploadFile(path.join(root, 'tests/fixtures/poster-v1/square.png'));
    await duo.waitForFunction(() => Boolean(window.__mockupBaseline.snapshot.secondarySrc));
    const secondary = (await state(duo)).secondarySrc;
    await apply(duo, 'SaaS Dashboard', 'saas-dashboard');
    assert.equal((await state(duo)).secondarySrc, secondary);
    await duo.click('button[title="Dual shots (2 images)"]'); await settle(duo);
    assert.equal((await state(duo)).layoutMode, 'duo'); assert.equal(await duo.$$eval('#studio-canvas [data-media-surface]', nodes => nodes.length), 2);
    await clickButton(duo, 'Frame');
    const priorSample = await state(duo);
    await duo.click('button[title*=\'sample image\'][title*=\'Mobile\']');
    await duo.waitForFunction(() => window.__mockupBaseline.snapshot.primaryMediaOrigin.sampleId === 'mobile');
    const sample = await state(duo);
    for (const key of ['textDocument', 'gradientId', 'windowTheme', 'templateContext', 'mockupZoom']) assert.equal(JSON.stringify(sample[key]), JSON.stringify(priorSample[key]), `sample media preserves ${key}`);
    await clickButton(duo, '3D Left Launch'); await settle(duo);
    assert.deepEqual((await state(duo)).templateContext.mediaRegion, { x: 0, y: 0, width: 1, height: 1 });
    await clickButton(duo, 'Restore layout'); await settle(duo);
    assert.deepEqual((await state(duo)).templateContext.mediaRegion, { x: 0, y: .3, width: 1, height: .68 });
    results.push({ scenario: 'Duo retained secondary and Sample images only replace media', pass: true });
    await duo.close();
    for (const width of [360, 390, 430]) {
      const mobile = await open({ width, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await apply(mobile, 'Mobile App', 'mobile-app');
      await (await mobile.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(root, 'tests/fixtures/poster-v1/phone.png'));
      await mobile.waitForFunction(() => window.__mockupBaseline.snapshot.primaryMediaOrigin.kind === 'user');
      await settle(mobile); await edit(mobile, 0, 'A calmer\nmorning.');
      await clickButton(mobile, 'Restore layout'); await settle(mobile);
      assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}: no horizontal page overflow`);
      const result = await png(mobile, `mobile-${width}.png`, 1080, 1920);
      results.push({ scenario: `mobile-${width}`, pass: true, export: result });
      await mobile.close();
      console.log(`mobile ${width}: template, upload, edit, restore and PNG`);
    }
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2));
  console.log('PASS template browser flows');
} finally { await browser?.close(); server?.kill(); }
