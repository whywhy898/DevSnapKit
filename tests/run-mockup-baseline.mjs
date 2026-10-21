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
const port = Number(process.env.MOCKUP_BASELINE_PORT || 5199);
const origin = `http://127.0.0.1:${port}`;
const rasterArgs = ['--disable-gpu', '--force-color-profile=srgb', '--disable-lcd-text', '--disable-skia-runtime-opts', '--font-render-hinting=none'];
const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
async function hashSources() {
  const hashes = {};
  for (const file of ['src/App.tsx', 'src/useHistory.ts', 'src/CanvasLayout.tsx', 'src/MockupArtwork.tsx']) {
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
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    localStorage.clear(); localStorage.setItem('devsnapkit_welcome_seen', '1');
    sessionStorage.setItem('dsk_session_id', 'qa_mockup_baseline');
    let seed = 123456789;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    Date.now = () => 1700000000000;
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const selectedCases = process.env.MOCKUP_BASELINE_CASES ? baselineCases.filter(fixture => process.env.MOCKUP_BASELINE_CASES.split(',').includes(fixture.id)) : baselineCases;
  for (const fixture of selectedCases) {
    await page.goto(origin + '/?editor=1', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => Boolean(window.__mockupBaseline));
    await page.evaluate(({ patch, extras }) => window.__mockupBaseline.apply(patch, extras), fixture);
    assert.equal(await page.evaluate(() => window.__mockupBaseline.snapshot.textDocument?.layers.length ?? 0), 0, 'Baseline contains no generic text layers');
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    await page.waitForFunction(id => window.__mockupBaseline.snapshot.imageName === 'baseline-primary.svg' && document.querySelector('#studio-canvas')?.offsetWidth === 960, {}, fixture.id);
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
    await (await page.$('#studio-canvas')).screenshot({ path: screenshot });
    await clickButton(page, 'Export');
    await clickButton(page, '1x Web');
    const downloaded = await downloadPng(page, directory, `${fixture.id}.download.png`, async () => {
      const handle = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(button => /^Download 1x/.test(button.innerText.trim())));
      assert.ok(await handle.evaluate(button => Boolean(button)));
      await handle.evaluate(button => button.click()); await handle.dispose();
    });
    const geometry = await page.evaluate(() => [...document.querySelectorAll('#studio-canvas,#studio-canvas [data-scene-inner],#studio-canvas [data-scene-fit],#studio-canvas [data-scene-projection],#studio-canvas [data-scene-slot]')].map(element => ({ tag: element.tagName, attributes: [...element.attributes].filter(attribute => attribute.name.startsWith('data-') || attribute.name === 'style').map(attribute => [attribute.name, attribute.value]), rect: JSON.stringify(element.getBoundingClientRect()) })));
    const row = { id: fixture.id, screenshot, download: downloaded.path, geometry };
    if (reference) {
      row.previewDiff = await rgbaDiff(path.join(output, reference, `${fixture.id}.preview.png`), screenshot);
      row.downloadDiff = await rgbaDiff(path.join(output, reference, `${fixture.id}.download.png`), downloaded.path);
    }
    results.push(row);
    await fs.writeFile(path.join(output, `${phase}-report.json`), JSON.stringify({ phase, reference, results, errors }, null, 2));
    console.log(`${fixture.id}${reference ? ` preview=${row.previewDiff.differentPixels} download=${row.downloadDiff.differentPixels}` : ' captured'}`);
  }
  assert.deepEqual(await hashSources(), sourceHashes, 'Artwork source must stay frozen during capture');
  await fs.writeFile(path.join(output, `${phase}-metadata.json`), JSON.stringify({ sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), sourceHashes, dirty: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }), browser: await browser.version(), rasterArgs, viewport: { width: 1440, height: 1100, deviceScaleFactor: 1 }, seed: 123456789, fixedDateNow: 1700000000000, fontReady: true, imageDecode: true, animations: 'disabled in test only', fixtures: baselineCases }, null, 2));
  assert.deepEqual(errors, [], 'No browser runtime errors');
  if (reference) for (const row of results) for (const type of ['previewDiff', 'downloadDiff']) {
    assert.equal(row[type].dimensionsEqual, true, `${row.id} ${type} dimensions`);
    assert.equal(row[type].differentPixels, 0, `${row.id} ${type} exact RGBA equality`);
  }
  console.log(`PASS ${results.length} cases ${reference ? 'with zero RGBA pixel changes' : 'captured'}`);
} finally {
  await browser?.close(); server.kill();
}
