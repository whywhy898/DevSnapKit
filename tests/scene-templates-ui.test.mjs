import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { launchBrowser, clickButton, downloadPng } from './helpers/browser.mjs';

const origin = process.env.TEST_UI_URL;
const scenes = [['producthunt', 1270, 760], ['og', 1200, 630], ['appstore', 1290, 2796]];
async function withPage(run) {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    page.on('dialog', dialog => dialog.accept());
    await page.setViewport({ width: 1440, height: 1100 });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/') || (url.protocol.startsWith('http') && url.origin !== new URL(origin).origin)) {
        void request.respond({ status: 200, contentType: 'application/json', body: '{}' });
      } else void request.continue();
    });
    await run(page);
  } finally { await browser.close(); }
}
async function waitScene(page, scene) {
  await page.waitForFunction(scene => window.__mockupBaseline?.snapshot.templateContext?.id === `scene-${scene}`, {}, scene);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('#studio-canvas img')].every(image => image.complete && image.naturalWidth > 0));
}
async function assertTextBounds(page) {
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('#studio-canvas').getBoundingClientRect();
    const media = document.querySelector('#studio-canvas [data-media-surface]').getBoundingClientRect();
    const text = [...document.querySelectorAll('#studio-canvas [data-canvas-text]')].map(node => node.getBoundingClientRect());
    const clear = (a, b) => a.bottom <= b.top + .5 || b.bottom <= a.top + .5 || a.right <= b.left + .5 || b.right <= a.left + .5;
    return { count: text.length, outside: text.every(box => clear(box, media)), inside: text.every(box => box.left >= canvas.left - 1 && box.right <= canvas.right + 1 && box.top >= canvas.top - 1 && box.bottom <= canvas.bottom + 1), separate: clear(...text) };
  });
  assert.deepEqual(result, { count: 2, outside: true, inside: true, separate: true });
}

test('scene URLs apply once, preserve attribution parameters, have clear rendered text and undo/redo completely', { skip: !origin }, () => withPage(async page => {
  for (const [scene, width, height] of scenes) {
    await page.goto(new URL(`/?editor=1&scene=${scene}&utm_source=launch&ref=partner&aspect=twitter&mode=duo`, origin).href, { waitUntil: 'networkidle0' });
    await waitScene(page, scene);
    assert.equal(await page.$('[data-testid="welcome-overlay"], .welcome-container, [data-pro-modal]'), null);
    const snapshot = await page.evaluate(() => window.__mockupBaseline.snapshot);
    assert.deepEqual(snapshot.customCanvasSize, { width, height });
    assert.equal(snapshot.layoutMode, 'single');
    assert.equal(snapshot.compositionDocument.detailVisible, false);
    assert.equal(new URL(page.url()).searchParams.get('utm_source'), 'launch');
    assert.equal(new URL(page.url()).searchParams.get('ref'), 'partner');
    await assertTextBounds(page);
    await page.click('[title^="Undo ("]');
    await page.waitForFunction(() => window.__mockupBaseline.snapshot.templateContext === null);
    await new Promise(resolve => setTimeout(resolve, 450));
    assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument.layers.length), 0);
    await page.click('[title^="Redo ("]');
    await waitScene(page, scene);
    assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot), snapshot);
  }
}));

test('free gallery scenes keep uploaded screenshots, replace with real input, and restore the prior canvas in one undo', { skip: !origin }, () => withPage(async page => {
  await page.goto(new URL('/?editor=1', origin).href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#studio-canvas');
  const upload = await page.$('[aria-label="Main screenshot file"]');
  await upload.uploadFile(fileURLToPath(new URL('../public/seo/examples/ph-original.png', import.meta.url)));
  await page.waitForFunction(() => window.__mockupBaseline?.snapshot.primaryMediaOrigin?.kind === 'user');
  for (const [scene] of scenes) {
    const before = await page.evaluate(() => window.__mockupBaseline.snapshot);
    await page.click('[data-template-trigger]');
    await page.waitForSelector('[data-template-gallery][open]');
    await page.click('[data-template-filter="scenes"]');
    assert.equal(await page.$$eval('[data-template-gallery] [data-scene]', nodes => nodes.length), 3);
    await page.click(`[data-scene="${scene}"] [aria-label^="Preview "]`);
    await page.waitForSelector('[data-template-preview][open]');
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-template-preview]', { hidden: true });
    await page.click(`[data-scene="${scene}"] [aria-label^="Apply "]`);
    await waitScene(page, scene);
    await page.waitForSelector('[data-template-gallery]', { hidden: true });
    assert.equal(await page.$('[data-pro-modal]'), null);
    assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.imageSrc), before.imageSrc);
    await assertTextBounds(page);
    await page.click('[title^="Undo ("]');
    await page.waitForFunction(() => window.__mockupBaseline.snapshot.templateContext === null);
    assert.deepEqual(await page.evaluate(() => window.__mockupBaseline.snapshot), before);
  }
  await page.goto(new URL('/?editor=1&scene=appstore', origin).href, { waitUntil: 'networkidle0' });
  await waitScene(page, 'appstore');
  const before = await page.evaluate(() => window.__mockupBaseline.snapshot);
  await (await page.$('[aria-label="Main screenshot file"]')).uploadFile(fileURLToPath(new URL('../public/seo/examples/og-original.png', import.meta.url)));
  await page.waitForFunction(() => window.__mockupBaseline.snapshot.primaryMediaOrigin?.kind === 'user');
  const after = await page.evaluate(() => window.__mockupBaseline.snapshot);
  assert.notEqual(after.imageSrc, before.imageSrc);
  assert.deepEqual(after.customCanvasSize, before.customCanvasSize);
  assert.deepEqual(after.compositionDocument, before.compositionDocument);
  assert.deepEqual(after.textDocument, before.textDocument);
  await assertTextBounds(page);
}));

test('invalid scene values keep the ordinary CTA editor', { skip: !origin }, () => withPage(async page => {
  await page.goto(new URL('/?editor=1&scene=unknown', origin).href, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#studio-canvas');
  assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.templateContext), null);
  assert.equal(await page.$('[data-testid="welcome-overlay"], .welcome-container'), null);
}));

test('scene exports default to exact App Store pixels or 2x and follow gallery changes', { skip: !origin }, () => withPage(async page => {
  for (const [scene, width, height] of scenes) {
    await page.goto(new URL(`/?editor=1&scene=${scene}`, origin).href, { waitUntil: 'networkidle0' });
    await waitScene(page, scene);
    await clickButton(page, 'Export');
    const scale = scene === 'appstore' ? 1 : 2;
    await page.waitForFunction(({ width, height, scale }) => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === `Download ${scale}x (${width * scale}×${height * scale})`), {}, { width, height, scale });
  }
  const exact = 'Exact size App Store requires (1290×2796)';
  await page.click('.export-trigger-btn');
  await page.waitForSelector('.export-popover');
  assert.equal(await page.$$eval('[data-export-scale="1"]', nodes => nodes.length), 2, 'both export surfaces offer 1x');
  assert.equal(await page.$$eval('[data-export-scale="1"]', (nodes, exact) => nodes.every(node => node.textContent.includes(exact) && node.getAttribute('aria-pressed') === 'true'), exact), true);
  await page.click('.export-popover [title="Close"]');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dsk-appstore-export-'));
  try {
    const result = await downloadPng(page, directory, 'appstore.png', () => clickButton(page, 'Download 1x (1290×2796)'));
    const png = await fs.readFile(result.path);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1290, 2796]);
    await fs.unlink(result.path);
  } finally { await fs.rmdir(directory).catch(() => {}); }
  await page.click('[data-export-scale="4"]');
  await page.waitForSelector('[data-pro-modal]');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-pro-modal]', { hidden: true });
  assert.equal(await page.$eval('[data-export-scale="1"]', el => el.getAttribute('aria-pressed')), 'true');
  await clickButton(page, 'Free 2x');
  for (const scene of ['og', 'appstore', 'producthunt', 'appstore']) {
    await page.click('[data-template-trigger]');
    await page.click('[data-template-filter="scenes"]');
    await page.click(`[data-scene="${scene}"] [aria-label^="Apply "]`);
    await waitScene(page, scene);
    const scale = scene === 'appstore' ? '1' : '2';
    await clickButton(page, 'Export');
    await page.waitForFunction(scale => [...document.querySelectorAll(`[data-export-scale="${scale}"]`)].every(el => el.getAttribute('aria-pressed') === 'true'), {}, scale);
    assert.equal(await page.$$eval('[data-export-scale="1"]', (nodes, exact) => nodes.some(el => el.textContent.includes(exact)), exact), scene === 'appstore');
    // Manual choices survive ordinary edits within this scene.
    await clickButton(page, scene === 'appstore' ? 'Free 2x' : 'Free 1x');
    await page.evaluate(() => window.__mockupBaseline.apply({ imageName: 'Edited screenshot' }));
    const chosen = scene === 'appstore' ? '2' : '1';
    assert.equal(await page.$$eval(`[data-export-scale="${chosen}"]`, nodes => nodes.every(el => el.getAttribute('aria-pressed') === 'true')), true);
  }
}));
