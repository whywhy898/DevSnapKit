import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { launchBrowser, clickButton, downloadPng } from './helpers/browser.mjs';
import { baselineCases } from './mockup-baseline-cases.mjs';
import { rgbaDiff } from './mockup-pixel-diff.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.env.MOCKUP_BASELINE_DIR || path.join(root, '../../output/devsnapkit/canvas-text-v1/baseline'));
const phase = process.env.MOCKUP_BASELINE_PHASE || 'before';
const reference = process.env.MOCKUP_BASELINE_REFERENCE || '';
const archiveSource = process.env.MOCKUP_BASELINE_SOURCE_SHA || '';
if (archiveSource && !/^[a-f0-9]{40}$/.test(archiveSource)) throw new Error('Archived source requires an exact commit SHA');
const port = Number(process.env.MOCKUP_BASELINE_PORT || 5199);
const origin = `http://127.0.0.1:${port}`;
const rasterArgs = ['--disable-gpu', '--force-color-profile=srgb', '--disable-lcd-text', '--disable-skia-runtime-opts', '--font-render-hinting=none'];
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
async function hashSources() {
  const hashes = {};
  for (const file of ['src/App.tsx', 'src/useHistory.ts', 'src/CanvasLayout.tsx', 'src/MockupArtwork.tsx', 'src/MockupUnit.tsx', 'src/export/exportMockup.tsx', 'src/export/prepareArtworkExport.ts', 'src/text/CanvasTextLayerRenderer.tsx']) {
    try { hashes[file] = createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return hashes;
}
const sourceHashes = await hashSources();
await fs.mkdir(output, { recursive: true });
const server = spawn(process.execPath, [vite, '--config', 'tests/vite-mockup-baseline.config.mjs', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let serverErrors = '';
server.stdout.on('data', () => {});
server.stderr.on('data', data => { serverErrors = (serverErrors + data).slice(-2000); });
let browser;
try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(serverErrors || 'Vite exited');
    try { if ((await fetch(origin)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await launchBrowser(rasterArgs);
  const results = [];
  const initPage = () => {
    localStorage.clear(); localStorage.setItem('devsnapkit_welcome_seen', '1');
    sessionStorage.setItem('dsk_session_id', 'qa_mockup_baseline');
    let seed = 123456789;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    Date.now = () => 1700000000000;
  };
  const errors = [];
  const cleanupWarnings = [];
  const selectedCases = process.env.MOCKUP_BASELINE_CASES ? baselineCases.filter(fixture => process.env.MOCKUP_BASELINE_CASES.split(',').includes(fixture.id)) : baselineCases;
  for (const fixture of selectedCases) {
    const page = await browser.newPage();
    // A 1:1 preview avoids compositor rounding of a fractional CSS-scaled
    // canvas. This fixes the environment, not artwork pixels or tolerances.
    await page.setViewport({ width: 1920, height: 1200, deviceScaleFactor: 1 });
    // The UI's optional remote Inter stylesheet must not race the local artwork
    // fonts. Both sides use the shipped system fallback with external requests
    // blocked; local Manrope/Gelasio still load and embed normally.
    await page.setRequestInterception(true);
    page.on('request', request => request.url().startsWith(origin) || /^(data:|blob:)/.test(request.url()) ? request.continue() : request.abort());
    await page.evaluateOnNewDocument(initPage);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/?editor=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__mockupBaseline));
    await page.evaluate(({ patch, extras }) => window.__mockupBaseline.apply(patch, extras), fixture);
    assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument?.layers.length ?? 0), fixture.patch.textDocument.layers.length, 'Expected ordinary text fixture');
    await page.mouse.move(0, 0);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    await page.waitForFunction(id => {
      const canvas = document.querySelector('#studio-canvas');
      return window.__mockupBaseline.snapshot.imageName === 'baseline-primary.svg' && canvas?.offsetWidth === 960 && canvas.getBoundingClientRect().width === 960;
    }, {}, fixture.id);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(img => img.decode()));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    // FittedScene's ResizeObserver and the export layout settle before measuring.
    await new Promise(resolve => setTimeout(resolve, 600));
    const directory = path.join(output, phase);
    await fs.mkdir(directory, { recursive: true });
    const screenshot = path.join(directory, `${fixture.id}.preview.png`);
    await page.bringToFront();
    // Flush the page compositor before the element capture. A single headless
    // first frame can otherwise contain an unpainted canvas despite ready DOM.
    await page.screenshot({ captureBeyondViewport: false });
    const canvas = await page.$('#studio-canvas');
    let prior = await canvas.screenshot(), stable = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const next = await canvas.screenshot();
      if ((await rgbaDiff(prior, next)).differentPixels === 0) { await fs.writeFile(screenshot, next); stable = true; break; }
      prior = next;
    }
    assert.equal(stable, true, `${fixture.id}: two consecutive painted frames must match`);
    await clickButton(page, 'Export');
    await clickButton(page, '1x Web');
    let downloaded;
    try { downloaded = await downloadPng(page, directory, `${fixture.id}.download.png`, async () => {
      const handle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(button => button.offsetParent !== null && /^Download 1x/.test(button.innerText.trim())));
      assert.ok(await handle.evaluate(button => Boolean(button)));
      await handle.evaluate(button => button.click()); await handle.dispose();
    }); } catch (error) {
      // Windows Chrome can leave an empty bookkeeping file after the complete PNG
      // has already been moved. Keep the directory as evidence; never hide a failed download.
      if (!['ENOTEMPTY', 'EBUSY'].includes(error.code)) throw error;
      const target = path.join(directory, `${fixture.id}.download.png`);
      const png = await fs.readFile(target);
      assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(png.subarray(-8, -4).toString(), 'IEND');
      assert.equal(png.readUInt32BE(16), 960);
      assert.equal(png.readUInt32BE(20), 720);
      cleanupWarnings.push({ id: fixture.id, code: error.code, path: error.path });
      downloaded = { path: target };
    }
    const geometry = await page.evaluate(() => [...document.querySelectorAll('#studio-canvas,#studio-canvas [data-scene-inner],#studio-canvas [data-scene-fit],#studio-canvas [data-scene-projection],#studio-canvas [data-scene-slot]')].map(element => ({ tag: element.tagName, attributes: [...element.attributes].filter(attribute => attribute.name.startsWith('data-') || attribute.name === 'style').map(attribute => [attribute.name, attribute.value]), rect: JSON.stringify(element.getBoundingClientRect()) })));
    const row = { id: fixture.id, screenshot, download: downloaded.path, geometry };
    if (reference) {
      row.previewDiff = await rgbaDiff(path.join(output, reference, `${fixture.id}.preview.png`), screenshot);
      row.downloadDiff = await rgbaDiff(path.join(output, reference, `${fixture.id}.download.png`), downloaded.path);
    }
    results.push(row);
    await fs.writeFile(path.join(output, `${phase}-report.json`), JSON.stringify({ phase, reference, results, errors, cleanupWarnings }, null, 2));
    console.log(`${fixture.id}${reference ? ` preview=${row.previewDiff.differentPixels} download=${row.downloadDiff.differentPixels}` : ' captured'}`);
    await page.close();
  }
  assert.deepEqual(await hashSources(), sourceHashes, 'Artwork source must stay frozen during capture');
  const sceneReferenceCommit = process.env.CANVAS_TEXT_SCENE_REFERENCE_COMMIT || null;
  const effectiveSceneHash = sceneReferenceCommit ? createHash('sha256').update(execFileSync('git', ['show', `${sceneReferenceCommit}:src/CanvasLayout.tsx`], { cwd: root })).digest('hex') : sourceHashes['src/CanvasLayout.tsx'];
  await fs.writeFile(path.join(output, `${phase}-metadata.json`), JSON.stringify({ sha: archiveSource || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceHashes, sceneReferenceCommit, effectiveSceneHash, dirty: archiveSource ? 'Archived committed production source; current test harness only' : execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }), browser: await browser.version(), rasterArgs, viewport: { width: 1920, height: 1200, deviceScaleFactor: 1 }, seed: 123456789, fixedDateNow: 1700000000000, fontReady: true, imageDecode: true, animations: 'disabled in test only', fixtures: baselineCases }, null, 2));
  assert.deepEqual(errors, [], 'No browser runtime errors');
  if (reference) for (const row of results) for (const type of ['previewDiff', 'downloadDiff']) {
    assert.equal(row[type].dimensionsEqual, true, `${row.id} ${type} dimensions`);
    assert.equal(row[type].differentPixels, 0, `${row.id} ${type} exact RGBA equality`);
  }
  console.log(`PASS ${results.length} cases ${reference ? 'with zero RGBA pixel changes' : 'captured'}`);
} finally {
  await browser?.close(); server.kill();
}
