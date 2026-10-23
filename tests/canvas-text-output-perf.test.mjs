import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { launchBrowser, preparePage, clickButton, finishTextEditing } from './helpers/browser.mjs';

const url = process.env.TEST_UI_URL;
const output = path.resolve('../../output/devsnapkit/canvas-text-v1/outputs');
async function setup(browser, scale, batch) {
  const page = await preparePage(browser, url);
  await (await page.$('input[aria-label="Main screenshot file"]')).uploadFile(path.resolve('../../output/devsnapkit/honeywerank-original.png'));
  await page.waitForFunction(() => window.__mockupBaseline.snapshot.imageName === 'honeywerank-original.png');
  await clickButton(page, 'Add text'); await finishTextEditing(page);
  await page.evaluate(batch => {
    const layer = window.__mockupBaseline.snapshot.textDocument.layers[0];
    window.__mockupBaseline.apply({ aspectRatioId: 'custom', customCanvasSize: { width: 1600, height: 1200 }, bgType: 'transparent', vfxGlow: false,
      textDocument: { version: 1, layers: [{ ...layer, content: 'Launch DevSnapKit 世界🙂', widthRatio: .8, fontSize: 48, centerY: .2, color: '#E600A9' }] } }, { pro: batch });
  }, batch);
  await clickButton(page, 'Export'); await clickButton(page, scale === 1 ? '1x Web' : '2x HD');
  await page.evaluate(async () => { await document.fonts.ready; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  return page;
}
async function receive(page, label, expected, trigger) {
  const directory = await fs.mkdtemp(path.join(output, '.perf-'));
  const client = await page.browser().target().createCDPSession();
  const names = new Map(), completed = new Set();
  client.on('Browser.downloadWillBegin', event => names.set(event.guid, event.suggestedFilename));
  client.on('Browser.downloadProgress', event => { if (event.state === 'completed') completed.add(names.get(event.guid)); });
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory, eventsEnabled: true });
  const start = performance.now();
  try {
    await trigger();
    for (let i = 0; i < 1200 && completed.size < expected; i++) await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(completed.size, expected, 'All actual browser downloads complete');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    const totalMs = performance.now() - start;
    const metrics = await page.evaluate(() => window.__lastExportMetrics);
    const files = [];
    for (const [index, name] of [...completed].entries()) {
      const file = path.join(output, `${label}-${index + 1}.png`); await fs.rename(path.join(directory, name), file);
      const metadata = await sharp(file).metadata(); files.push({ file, width: metadata.width, height: metadata.height, bytes: (await fs.stat(file)).size });
    }
    return { totalMs, metrics, files, totalPixels: files.reduce((sum, file) => sum + file.width * file.height, 0) };
  } finally { await client.detach(); await fs.rm(directory, { recursive: true, force: true }); }
}

test('T5 measured UI exports record three cold/warm 1x, 2x and four-target batches with stage timings and real files', { skip: !url, timeout: 300000 }, async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await launchBrowser();
  try {
    const rows = [];
    for (let repeat = 1; repeat <= 3; repeat++) for (const [scale, batch] of [[1, false], [2, false], [1, true]]) {
      const page = await setup(browser, scale, batch);
      for (const condition of ['cold', 'warm']) {
        const label = `performance-${batch ? 'batch' : `${scale}x`}-${condition}-${repeat}`;
        const record = await receive(page, label, batch ? 4 : 1, () => clickButton(page, batch ? 'Export 4 Sizes (1x)' : `Download ${scale}x (${1600 * scale}×${1200 * scale})`));
        const resource = record.metrics.resources;
        assert.equal(resource.fontPreparationCalls, 1); assert.equal(resource.imagePreparationCalls, 1);
        assert.equal(resource.imageAssetDecodeCalls, condition === 'cold' ? 1 : 0);
        assert.equal(resource.fontCSSCacheMisses, condition === 'cold' ? 1 : 0);
        assert.equal(resource.fontCSSCacheHits, condition === 'warm' ? 1 : 0);
        assert.equal(record.metrics.targets.length, batch ? 4 : 1);
        assert.ok(record.metrics.targets.every(target => target.layoutMs > 0 && target.rasterMs > 0));
        rows.push({ repeat, scale, batch, condition, ...record });
      }
      await page.close();
    }
    const hashes = {};
    async function hashSources(directory) { for (const entry of await fs.readdir(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name); if (entry.isDirectory()) await hashSources(file); else if (/\.(tsx?|css)$/.test(entry.name)) hashes[path.relative(process.cwd(), file).replaceAll('\\', '/')] = createHash('sha256').update(await fs.readFile(file)).digest('hex'); } }
    await hashSources(path.resolve('src'));
    const groups = [];
    for (const [scale, batch] of [[1, false], [2, false], [1, true]]) for (const condition of ['cold', 'warm']) {
      const samples = rows.filter(row => row.scale === scale && row.batch === batch && row.condition === condition); assert.equal(samples.length, 3);
      groups.push({ scale, batch, condition, samples: 3, milliseconds: samples.map(row => row.totalMs), meanMs: samples.reduce((sum, row) => sum + row.totalMs, 0) / 3, totalPixelsPerRun: samples[0].totalPixels });
    }
    const report = { browser: await browser.version(), hardware: { cpu: os.cpus()[0]?.model, logicalProcessors: os.cpus().length, memoryBytes: os.totalmem(), platform: os.platform(), release: os.release() },
      protocol: { viewport: '1440×1100', DPR: 1, logicalCanvas: '1600×1200', image: 'honeywerank-original.png 1440×1000', font: 'Manrope 700 / 48px plus OS Chinese/emoji fallback',
        cold: 'First export preparation on a fresh page; browser HTTP cache enabled, preview/upload decoding already completed', warm: 'Same page and frozen artwork repeated immediately',
        timer: 'Before actual UI export click through all Browser.downloadProgress completed events and editor unlock; per-target preparation/layout/raster are separately measured',
        noClaim: 'No arbitrary relative-time budget; batch includes four necessary rasterizations. These are measured desktop results, not mobile or Safari timing.' },
      effectiveTestFlags: { sceneReferenceCommit: process.env.CANVAS_TEXT_SCENE_REFERENCE_COMMIT || null, sceneSkipExperiment: Boolean(process.env.CANVAS_TEXT_SKIP_REDUNDANT_SCENE) }, sourceHashes: hashes, groups, rows };
    await fs.writeFile(path.join(output, 'export-performance.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ exportPerformance: groups, sourceFiles: Object.keys(hashes).length }));
  } finally { await browser.close(); }
});
