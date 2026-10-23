import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { launchBrowser, preparePage, clickButton, revealInspectorControl, finishTextEditing } from './helpers/browser.mjs';

const url = process.env.TEST_UI_URL;
const output = path.resolve('../../output/devsnapkit/canvas-text-v1/outputs');
const snapshot = page => page.evaluate(() => ({ snapshot: window.__mockupBaseline.snapshot, history: window.__mockupBaseline.history, selected: document.querySelector('[aria-label="Current text"]')?.value }));
const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function fill(page, selector, value, commit = true) {
  await revealInspectorControl(page, selector);
  const element = await page.$(selector); assert.ok(element, selector); await element.focus();
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.type(String(value)); if (commit) await page.keyboard.press('Enter');
}
async function exportButton(page, label) {
  await clickButton(page, 'Export');
  await clickButton(page, label);
}
async function fixture(page, { pro = true, narrow = false } = {}) {
  await clickButton(page, 'Add text'); await finishTextEditing(page);
  await page.evaluate(({ pro, narrow }) => {
    const s = window.__mockupBaseline.snapshot, layer = s.textDocument.layers[0];
    window.__mockupBaseline.apply({ aspectRatioId: 'custom', customCanvasSize: { width: 1600, height: 1200 }, bgType: 'transparent', vfxGlow: false,
      textDocument: { version: 1, layers: [{ ...layer, content: narrow ? 'T' : 'Launch 世界🙂', fontSize: narrow ? 20 : 48, widthRatio: narrow ? .057 : .65, centerX: .5, centerY: .2, color: '#E600A9' }] } }, { pro });
  }, { pro, narrow });
  await page.waitForFunction(() => document.querySelector('#studio-canvas').offsetWidth === 1600);
  await page.evaluate(() => document.fonts.ready); await paint(page);
  await exportButton(page, '1x Web');
}
async function downloads(page, label) {
  await fs.mkdir(output, { recursive: true });
  const directory = await fs.mkdtemp(path.join(output, `.${label}-`));
  const client = await page.browser().target().createCDPSession();
  const names = new Map(), completed = new Set();
  client.on('Browser.downloadWillBegin', event => names.set(event.guid, event.suggestedFilename));
  client.on('Browser.downloadProgress', event => { if (event.state === 'completed') completed.add(names.get(event.guid)); });
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: directory, eventsEnabled: true });
  return { directory, async files() { return (await fs.readdir(directory)).filter(file => completed.has(file)); }, debug: () => page.evaluate(() => ({ busy: !!document.querySelector('[aria-busy="true"]'), alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent), size: [document.querySelector('#studio-canvas')?.offsetWidth, document.querySelector('#studio-canvas')?.offsetHeight], layers: window.__mockupBaseline.snapshot.textDocument.layers, textLayout: [...document.querySelectorAll('#studio-canvas [data-canvas-text]')].map(node => ({ offsetHeight: node.offsetHeight, scrollHeight: node.scrollHeight, width: node.offsetWidth, lineHeight: getComputedStyle(node).lineHeight })) })), async close() { await client.detach(); } };
}
async function takeDownload(stream, name) {
  let file;
  for (let i = 0; i < 500; i++) {
    file = (await stream.files()).find(file => /\.(png|webp|jpeg)$/.test(file));
    if (file) break;
    if (i > 5) { const state = await stream.debug(); if (!state.busy && state.alerts.some(text => /Export blocked|could not|invalid|failed|unavailable/i.test(text))) assert.fail(JSON.stringify(state)); }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(file, `A real browser download was received: ${JSON.stringify(await stream.debug())}`);
  const target = path.join(output, name); await fs.rename(path.join(stream.directory, file), target);
  return target;
}

test('T5 batch preflights every target before any download and keeps the whole editor unchanged', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page, { narrow: true });
    await new Promise(resolve => setTimeout(resolve, 450));
    const before = await snapshot(page), stream = await downloads(page, 'preflight');
    await exportButton(page, 'Export 4 Sizes (1x)');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && [...document.querySelectorAll('[role="alert"]')].some(node => /width|narrow|canvas/i.test(node.textContent)), { timeout: 60000 });
    assert.deepEqual(await stream.files(), [], 'A later invalid target must prevent even the earlier valid downloads');
    const message = await page.$$eval('[role="alert"]', nodes => nodes.map(node => node.textContent).join('\n'));
    assert.match(message, /1080\s*[×x]\s*1080|1:1/i, 'Error names the invalid target');
    assert.match(message, /Text.*T|T.*Text/i, 'Error identifies the offending text');
    assert.deepEqual(await snapshot(page), before, 'Output validation does not change work, dimensions, selection, or history');
    await fs.writeFile(path.join(output, 'batch-preflight.json'), JSON.stringify({ message, downloads: await stream.files(), before, after: await snapshot(page) }, null, 2));
    await stream.close();
  } finally { await browser.close(); }
});

test('T5 export lock blocks captured old range input, keyboard, paste and Inspector tools while real font preparation waits', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  let release;
  try {
    const page = await preparePage(browser, url); await fixture(page);
    await clickButton(page, 'Frame');
    const range = await page.$('input[type="range"]');
    assert.ok(range, 'An existing image/camera range is present');
    const box = await range.boundingBox();
    await page.mouse.move(box.x + box.width * .45, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height / 2); await paint(page);
    await page.setRequestInterception(true);
    let held = false;
    page.on('request', request => {
      if (!held && /poster\/fonts\/manrope-latin\.woff2/.test(request.url()) && request.resourceType() === 'fetch') {
        held = true; release = () => request.continue();
      } else void request.continue();
    });
    await page.$eval('.export-trigger-btn', button => button.click());
    await clickButton(page, 'Download 1x (1600×1200)');
    for (let i = 0; i < 100 && !held; i++) await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(held, true, 'The real owned-font request is held during export preparation');
    const before = await snapshot(page);
    await page.mouse.move(box.x + box.width * .8, box.y + box.height / 2);
    await range.evaluate(el => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(Number(el.value) + 10)); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.keyboard.press('2');
    await page.evaluate(() => {
      const dt = new DataTransfer(); dt.items.add(new File(['bad'], 'queued.png', { type: 'image/png' }));
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
      [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Text').click();
    });
    await paint(page);
    assert.deepEqual(await snapshot(page), before, 'Ongoing controls cannot mutate the frozen editor while fonts wait');
    await page.mouse.up(); await release(); release = undefined;
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    await page.setRequestInterception(false);
    await fs.writeFile(path.join(output, 'frozen-lock.json'), JSON.stringify({ before, after: await snapshot(page), realFontRequestHeld: held }, null, 2));
  } finally { if (release) await release().catch(() => {}); await browser.close(); }
});

test('T5 immediate upload export waits for real FileReader, image auto-frame and settled Auto dimensions', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page);
    await page.evaluate(() => window.__mockupBaseline.apply({ aspectRatioId: 'auto' }, { pro: true })); await paint(page);
    const oldSize = await page.$eval('#studio-canvas', el => ({ width: el.offsetWidth, height: el.offsetHeight }));
    await page.evaluate(() => {
      const original = FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL = function (blob) {
        const callback = this.onload;
        this.onload = event => { window.__releaseUpload = () => callback.call(this, event); window.__uploadReady = true; };
        FileReader.prototype.readAsDataURL = original;
        return original.call(this, blob);
      };
    });
    await (await page.$('input[aria-label="Main screenshot file"]')).uploadFile(path.resolve('../../output/devsnapkit/honeywerank-original.png'));
    await page.waitForFunction(() => window.__uploadReady === true);
    const stream = await downloads(page, 'upload-admission');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.offsetParent !== null && /^Download 1x/.test(button.innerText.trim())).click());
    await page.waitForFunction(() => !!document.querySelector('[aria-busy="true"]'));
    await page.evaluate(() => window.__releaseUpload());
    const file = await takeDownload(stream, 'immediate-upload-auto.png');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && window.__mockupBaseline.snapshot.imageName === 'honeywerank-original.png');
    const newSize = await page.$eval('#studio-canvas', el => ({ width: el.offsetWidth, height: el.offsetHeight }));
    const actual = await sharp(file).metadata();
    assert.notDeepEqual(newSize, oldSize, 'The real uploaded asset changed Auto composition dimensions');
    assert.deepEqual({ width: actual.width, height: actual.height }, newSize, 'The file uses the uploaded image and its settled dimensions, never the old Auto closure');
    await fs.writeFile(path.join(output, 'immediate-upload-auto.json'), JSON.stringify({ oldSize, newSize, actual: { width: actual.width, height: actual.height }, imageName: (await snapshot(page)).snapshot.imageName }, null, 2));
    await stream.close();
  } finally { await browser.close(); }
});

test('T5 mobile export popover fits 360, 390 and 430 without hidden horizontal overflow', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    const rows = [];
    for (const width of [360, 390, 430]) {
      const page = await preparePage(browser, url, { viewport: { width, height: 850, deviceScaleFactor: 1 } });
      await page.$eval('.export-trigger-btn', button => button.click()); await paint(page);
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth, html: document.documentElement.scrollWidth, menu: document.querySelector('.export-popover').getBoundingClientRect().toJSON() }));
      assert.ok(geometry.body <= width && geometry.html <= width, `Opened export menu must fit ${width}px: body ${geometry.body}, html ${geometry.html}`);
      assert.ok(geometry.menu.x >= 0 && geometry.menu.right <= width, 'The complete popover is visible');
      rows.push(geometry); await page.close();
    }
    await fs.writeFile(path.join(output, 'mobile-menu-geometry.json'), JSON.stringify(rows, null, 2));
  } finally { await browser.close(); }
});

test('T5 PNG, WebP and JPEG downloads contain real text at 1x and 2x with correct alpha and MIME', { skip: !url, timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page, { pro: false });
    const before = await snapshot(page), rows = [];
    const stream = await downloads(page, 'formats');
    for (const format of ['png', 'webp', 'jpeg']) for (const scale of [1, 2]) {
      await exportButton(page, format.toUpperCase()); await exportButton(page, scale === 1 ? '1x Web' : '2x HD');
      await exportButton(page, `Download ${scale}x (${1600 * scale}×${1200 * scale})`);
      const file = await takeDownload(stream, `format-${format}-${scale}x.${format}`);
      const metadata = await sharp(file).metadata();
      assert.equal(metadata.format, format); assert.equal(metadata.width, 1600 * scale); assert.equal(metadata.height, 1200 * scale);
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const corner = Array.from(data.subarray((20 * scale * info.width + 200 * scale) * 4, (20 * scale * info.width + 200 * scale) * 4 + 4));
      if (format === 'jpeg') assert.ok(corner.every(value => value >= 245), 'Transparent JPEG is composited on white');
      else assert.equal(corner[3], 0, 'PNG/WebP retain transparent padding without the preview grid');
      let ink = 0;
      for (let y = 205 * scale; y < 275 * scale; y++) for (let x = 280 * scale; x < 1320 * scale; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i] > 140 && data[i + 1] < 100 && data[i + 2] > 80 && data[i + 3] > 100) ink++;
      }
      assert.ok(ink > 100 * scale, 'Downloaded encoded pixels include the actual magenta text');
      assert.deepEqual(await snapshot(page), before);
      rows.push({ file, format: metadata.format, width: metadata.width, height: metadata.height, corner, textInk: ink });
    }
    await fs.writeFile(path.join(output, 'formats.json'), JSON.stringify(rows, null, 2)); await stream.close();
  } finally { await browser.close(); }
});

test('T5 actual clipboard image reads back at 2x, native denial and unavailable API preserve the editor', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(new URL(url).origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    const page = await preparePage(browser, url); await fixture(page, { pro: false });
    await new Promise(resolve => setTimeout(resolve, 450)); const before = await snapshot(page);
    await exportButton(page, 'Copy to Clipboard (2x HD)');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    const copyState = await page.evaluate(async () => ({ focused: document.hasFocus(), readPermission: (await navigator.permissions.query({ name: 'clipboard-read' })).state, writePermission: (await navigator.permissions.query({ name: 'clipboard-write' })).state, alerts: [...document.querySelectorAll('[role="alert"]')].map(node => node.textContent), copied: [...document.querySelectorAll('button')].some(button => button.innerText.includes('Copied to Clipboard')) }));
    assert.equal(copyState.copied, true, JSON.stringify(copyState));
    const readback = await page.evaluate(async () => {
      const entries = await navigator.clipboard.read();
      const item = entries.find(item => item.types.includes('image/png')); if (!item) throw new Error('Clipboard has no PNG');
      const blob = await item.getType('image/png'); return { type: blob.type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
    });
    const file = path.join(output, 'clipboard-2x.png'); await fs.writeFile(file, Buffer.from(readback.bytes));
    const metadata = await sharp(file).metadata(); assert.equal(readback.type, 'image/png'); assert.equal(metadata.width, 3200); assert.equal(metadata.height, 2400);
    const crop = await sharp(file).extract({ left: 560, top: 410, width: 2080, height: 140 }).ensureAlpha().raw().toBuffer();
    let ink = 0; for (let i = 0; i < crop.length; i += 4) if (crop[i] > 140 && crop[i + 1] < 100 && crop[i + 2] > 80 && crop[i + 3] > 100) ink++;
    assert.ok(ink > 400, 'The actual clipboard image contains text pixels'); assert.deepEqual(await snapshot(page), before);
    await page.evaluate(() => {
      const receiver = document.createElement('div'); receiver.id = 'native-paste-receiver'; receiver.contentEditable = 'true';
      Object.assign(receiver.style, { position: 'fixed', inset: '0', background: '#fff', overflow: 'auto', zIndex: '99999' });
      receiver.addEventListener('paste', event => { receiver.dataset.trustedPaste = String(event.isTrusted); });
      document.body.append(receiver); receiver.focus();
    });
    await page.keyboard.down('Control'); await page.keyboard.press('v'); await page.keyboard.up('Control');
    await page.waitForFunction(() => document.querySelector('#native-paste-receiver img')?.naturalWidth > 0);
    const pasted = await page.$eval('#native-paste-receiver', receiver => ({ trusted: receiver.dataset.trustedPaste, width: receiver.querySelector('img').naturalWidth, height: receiver.querySelector('img').naturalHeight }));
    assert.equal(pasted.trusted, 'true'); assert.equal(pasted.width, 3200); assert.equal(pasted.height, 2400);
    await page.$eval('#native-paste-receiver', receiver => receiver.remove());
    assert.deepEqual(await snapshot(page), before);
    await context.overridePermissions(new URL(url).origin, []);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.innerText.trim() === 'Copy to Clipboard (2x HD)'));
    await exportButton(page, 'Copy to Clipboard (2x HD)');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && [...document.querySelectorAll('[role="alert"]')].some(node => /clipboard|permission|denied/i.test(node.textContent)));
    const denied = await page.$$eval('[role="alert"]', nodes => nodes.map(node => node.textContent).join('\n'));
    assert.match(denied, /download|export/i, 'Denial explains the working fallback'); assert.deepEqual(await snapshot(page), before);
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
    await exportButton(page, 'Copy to Clipboard (2x HD)');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && [...document.querySelectorAll('[role="alert"]')].some(node => /not supported|unavailable/i.test(node.textContent)));
    const unavailable = await page.$$eval('[role="alert"]', nodes => nodes.map(node => node.textContent).join('\n'));
    assert.match(unavailable, /download|export/i); assert.deepEqual(await snapshot(page), before);
    await fs.writeFile(path.join(output, 'clipboard.json'), JSON.stringify({ file, width: metadata.width, height: metadata.height, textInk: ink, pasted, denied, unavailable, readback: 'navigator.clipboard.read -> real image/png Blob; native Ctrl+V into contenteditable receiver' }, null, 2));
  } finally { await browser.close(); }
});

test('T5 batch runtime failure reports downloads already started and the failing target, then retries on the same page', { skip: !url, timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page); await new Promise(resolve => setTimeout(resolve, 450));
    const before = await snapshot(page), stream = await downloads(page, 'runtime');
    await page.evaluate(() => {
      const original = HTMLCanvasElement.prototype.toBlob; let calls = 0;
      HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
        if (++calls === 2) { HTMLCanvasElement.prototype.toBlob = original; callback(null); return; }
        return original.call(this, callback, ...args);
      };
    });
    await exportButton(page, 'Export 4 Sizes (1x)');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && [...document.querySelectorAll('[role="alert"]')].some(node => /downloads started/.test(node.textContent)), { timeout: 60000 });
    const message = await page.$$eval('[role="alert"]', nodes => nodes.map(node => node.textContent).join('\n'));
    assert.match(message, /1 downloads started/); assert.match(message, /16:9|1920×1080/); assert.match(message, /cannot be withdrawn/);
    assert.equal((await stream.files()).length, 1); assert.deepEqual(await snapshot(page), before);
    const partial = await takeDownload(stream, 'batch-partial-og.png');
    await exportButton(page, 'Export 4 Sizes (1x)');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 60000 });
    const files = await stream.files(); assert.equal(files.length, 4); assert.deepEqual(await snapshot(page), before);
    const outputs = [];
    for (const name of files) { const target = path.join(output, `retry-${name}`); await fs.rename(path.join(stream.directory, name), target); const metadata = await sharp(target).metadata(); outputs.push({ file: target, width: metadata.width, height: metadata.height }); }
    await fs.writeFile(path.join(output, 'batch-runtime.json'), JSON.stringify({ message, partial, retry: outputs, stable: true }, null, 2)); await stream.close();
  } finally { await browser.close(); }
});

test('T5 a frozen four-target session shares real Blob/font/asset preparation and invalidates changed images and font sets', { skip: !url, timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page);
    const first = await fs.readFile(path.resolve('../../output/devsnapkit/honeywerank-original.png'));
    const second = await fs.readFile(path.resolve('../../output/devsnapkit/honeywerank-platforms.png'));
    const report = await page.evaluate(async ({ first, second }) => {
      const { prepareMockupExport } = await import('/src/export/exportMockup.tsx');
      const originalRead = FileReader.prototype.readAsDataURL, originalDecode = HTMLImageElement.prototype.decode;
      let reads = 0, probes = 0, domReady = 0;
      FileReader.prototype.readAsDataURL = function (blob) { if (blob.type === 'image/png') reads++; return originalRead.call(this, blob); };
      HTMLImageElement.prototype.decode = function () { if (this.src.startsWith('data:image/png')) { if (this.isConnected) domReady++; else probes++; } return originalDecode.call(this); };
      const blob1 = new Blob([Uint8Array.from(first)], { type: 'image/png' }), blob2 = new Blob([Uint8Array.from(second)], { type: 'image/png' });
      const source1 = URL.createObjectURL(blob1), source2 = URL.createObjectURL(blob2);
      const lookup = source => source === source1 ? blob1 : source === source2 ? blob2 : undefined;
      const props = { ...window.__mockupBaseline.artwork(), imageSrc: source1, imageName: 'honeywerank-original.png' };
      const targets = [{ id: 'og', width: 1200, height: 630 }, { id: '16-9', width: 1920, height: 1080 }, { id: '4-3', width: 1200, height: 900 }, { id: '1-1', width: 1080, height: 1080 }].map(target => ({ ...target, outputWidth: target.width, outputHeight: target.height, format: 'png' }));
      async function run(label) {
        const start = performance.now(), before = { reads, probes, domReady };
        const session = await prepareMockupExport(props, targets, document.querySelector('#studio-canvas').parentElement, lookup);
        const targetImages = [...document.querySelectorAll('[data-export-target] img')];
        const observedPreparation = { blobReads: reads - before.reads, assetProbes: probes - before.probes, targetDOMDecodeCalls: domReady - before.domReady, targetImagesReady: targetImages.filter(image => image.complete && image.naturalWidth > 0).length };
        const files = [];
        try { for (let i = 0; i < targets.length; i++) { const blob = await session.rasterize(i); files.push({ type: blob.type, bytes: blob.size }); } }
        finally { session.dispose(); }
        return { label, observedPreparation, metrics: session.metrics, files, totalMs: performance.now() - start, totalPixels: targets.reduce((sum, target) => sum + target.outputWidth * target.outputHeight, 0) };
      }
      try {
        const rows = [await run('cold'), await run('warm')];
        props.textDocument = { version: 1, layers: props.textDocument.layers.map(layer => ({ ...layer, font: 'gelasio', weight: 600, italic: true })) };
        rows.push(await run('changed-font'));
        props.imageSrc = source2; props.imageName = 'honeywerank-platforms.png'; rows.push(await run('changed-image'));
        return rows;
      } finally { FileReader.prototype.readAsDataURL = originalRead; HTMLImageElement.prototype.decode = originalDecode; URL.revokeObjectURL(source1); URL.revokeObjectURL(source2); }
    }, { first: Array.from(first), second: Array.from(second) });
    for (const row of report) {
      assert.equal(row.metrics.resources.fontPreparationCalls, 1); assert.equal(row.metrics.resources.imagePreparationCalls, 1);
      assert.equal(row.observedPreparation.targetDOMDecodeCalls, 0, 'Target count does not repeat source decode calls');
      assert.equal(row.observedPreparation.targetImagesReady, 4, 'Each target independently has loaded intrinsic image geometry');
      assert.equal(row.metrics.resources.imageDOMReadinessCalls, 4);
      assert.equal(row.metrics.targets.length, 4); assert.ok(row.metrics.targets.every(target => target.layoutMs > 0 && target.rasterMs > 0));
      assert.ok(row.files.every(file => file.type === 'image/png' && file.bytes > 10000));
    }
    assert.equal(report[0].observedPreparation.blobReads, 1); assert.equal(report[0].observedPreparation.assetProbes, 1);
    assert.equal(report[1].observedPreparation.blobReads, 0); assert.equal(report[1].observedPreparation.assetProbes, 0);
    assert.equal(report[1].metrics.resources.fontCSSCacheHits, 1);
    assert.equal(report[2].metrics.resources.fontCSSCacheMisses, 1); assert.ok(report[2].metrics.resources.fontResourceFetches > 0);
    assert.equal(report[2].observedPreparation.assetProbes, 0, 'Changing only fonts retains the source decode');
    assert.equal(report[3].observedPreparation.blobReads, 1); assert.equal(report[3].observedPreparation.assetProbes, 1);
    assert.equal(report[3].metrics.resources.fontCSSCacheHits, 1, 'Changing only the image retains the font set');
    await fs.writeFile(path.join(output, 'resource-reuse.json'), JSON.stringify({ rows: report, method: 'Actual Image.decode/FileReader wrappers observed before raster; targets use load/complete+naturalWidth rather than repeating decode()' }, null, 2));
  } finally { await browser.close(); }
});

test('T5 actual Set controls export 200×200, 8000×200 and 200×8000 without reducing dimensions, with visible 8/160 text', { skip: !url, timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page, { pro: false });
    await page.evaluate(() => window.__mockupBaseline.apply({ hideMockup: true }));
    await clickButton(page, 'Edit text'); await fill(page, '[aria-label="Text content"]', 'I', false); await finishTextEditing(page);
    const stream = await downloads(page, 'extremes'), rows = [];
    for (const [width, height, size] of [[200, 200, 8], [8000, 200, 8], [200, 8000, 160]]) {
      await fill(page, 'input[aria-label="Canvas width"]', width, false); await fill(page, 'input[aria-label="Canvas height"]', height, false); await clickButton(page, 'Set');
      await page.waitForFunction(({ width, height }) => document.querySelector('#studio-canvas').offsetWidth === width && document.querySelector('#studio-canvas').offsetHeight === height, {}, { width, height });
      await fill(page, '[data-canvas-text-controls] [aria-label="Text size"]', size);
      await fill(page, '[data-canvas-text-controls] [aria-label="Text x"]', width / 2);
      await fill(page, '[data-canvas-text-controls] [aria-label="Text y"]', height / 2);
      await fill(page, '[data-canvas-text-controls] [aria-label="Text width"]', Math.min(160, width));
      await paint(page); const before = await snapshot(page);
      await exportButton(page, `Download 1x (${width}×${height})`);
      const file = await takeDownload(stream, `extreme-${width}x${height}-font${size}.png`), metadata = await sharp(file).metadata();
      assert.equal(metadata.width, width); assert.equal(metadata.height, height);
      const pixels = await sharp(file).ensureAlpha().raw().toBuffer(); let ink = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 140 && pixels[i + 1] < 100 && pixels[i + 2] > 80 && pixels[i + 3] > 100) ink++;
      assert.ok(ink > 1, `Font ${size} has real visible pixels`); assert.equal((await snapshot(page)).snapshot.textDocument.layers[0].fontSize, size);
      assert.deepEqual((await snapshot(page)).snapshot, before.snapshot);
      rows.push({ width, height, fontSize: size, file, textInk: ink });
    }
    await fs.writeFile(path.join(output, 'extreme-dimensions.json'), JSON.stringify(rows, null, 2)); await stream.close();
  } finally { await browser.close(); }
});

test('T5 mobile 360/390/430 complete native composition, styles, positioning, history, modes and actual download', { skip: !url, timeout: 180000 }, async () => {
  const browser = await launchBrowser();
  try {
    const rows = [];
    for (const width of [360, 390, 430]) {
      const page = await preparePage(browser, url, { viewport: { width, height: 850, deviceScaleFactor: 1 } });
      await (await page.$('input[aria-label="Main screenshot file"]')).uploadFile(path.resolve('../../output/devsnapkit/honeywerank-original.png'));
      await page.waitForFunction(() => window.__mockupBaseline.snapshot.imageName === 'honeywerank-original.png');
      await exportButton(page, '1x Web');
      await fill(page, 'input[aria-label="Canvas width"]', 1600, false); await fill(page, 'input[aria-label="Canvas height"]', 1200, false); await clickButton(page, 'Set');
      await clickButton(page, 'Add text');
      await page.evaluate(() => { window.__imeEvents = []; for (const type of ['compositionstart', 'compositionupdate', 'compositionend', 'input']) document.querySelector('[aria-label="Text content"]').addEventListener(type, event => window.__imeEvents.push({ type: event.type, trusted: event.isTrusted, composing: event.isComposing ?? null, data: event.data })); });
      const client = await page.createCDPSession();
      await client.send('Input.imeSetComposition', { text: '发布', selectionStart: 2, selectionEnd: 2 });
      await page.$eval('.export-trigger-btn', button => button.click());
      assert.ok(await page.$('[aria-label="Text content"]'), 'Composing text is not forcibly committed by export');
      assert.equal(await page.$('.export-popover'), null, 'Export stays blocked during composition');
      const content = '发布 DevSnapKit 🙂\nBuild launch graphics';
      await client.send('Input.insertText', { text: content });
      await page.waitForFunction(content => window.__mockupBaseline.snapshot.textDocument.layers[0]?.content === content, {}, content);
      const layout = () => page.evaluate(() => { const root = document.querySelector('#studio-canvas'), text = root.querySelector('[data-canvas-text]'); return { width: root.offsetWidth, height: root.offsetHeight, textWidth: text.offsetWidth, textHeight: text.offsetHeight, scale: root.getBoundingClientRect().width / root.offsetWidth }; });
      const keyboardBefore = await layout(); await page.setViewport({ width, height: 520, deviceScaleFactor: 1 }); await paint(page); const keyboardAfter = await layout();
      assert.deepEqual(keyboardAfter, keyboardBefore, 'Height-only viewport changes preserve logical layout and actual preview scale');
      await page.evaluate(() => window.scrollTo(0, 200)); await finishTextEditing(page);
      await page.setViewport({ width, height: 850, deviceScaleFactor: 1 }); await paint(page);
      await page.select('[aria-label="Text font"]', 'gelasio'); await page.select('[aria-label="Text weight"]', '600'); await page.click('[aria-label="Text italic"]');
      await fill(page, '[data-canvas-text-controls] [aria-label="Text x"]', 550);
      await fill(page, '[data-canvas-text-controls] [aria-label="Text y"]', 240);
      await fill(page, '[data-canvas-text-controls] [aria-label="Text width"]', 640);
      await page.focus('[aria-label="Move text"]'); await page.keyboard.down('Shift'); await page.keyboard.press('ArrowRight'); await page.keyboard.up('Shift');
      const documentBeforeDelete = (await snapshot(page)).snapshot.textDocument;
      assert.equal(documentBeforeDelete.layers[0].centerX * 1600, 560);
      await clickButton(page, 'Delete text'); await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await paint(page);
      assert.deepEqual((await snapshot(page)).snapshot.textDocument, documentBeforeDelete);
      const id = documentBeforeDelete.layers[0].id; await page.select('[aria-label="Current text"]', id); await page.focus('[aria-label="Move text"]');
      await page.keyboard.press('2'); await page.waitForFunction(() => window.__mockupBaseline.snapshot.layoutMode === 'duo');
      await (await page.$('input[aria-label="Second screenshot file"]')).uploadFile(path.resolve('../../output/devsnapkit/honeywerank-platforms.png'));
      await page.waitForFunction(() => window.__mockupBaseline.snapshot.secondaryName === 'honeywerank-platforms.png');
      await page.focus('[aria-label="Move text"]'); await page.keyboard.press('1'); await clickButton(page, 'Frame'); await clickButton(page, 'Text');
      assert.deepEqual((await snapshot(page)).snapshot.textDocument, documentBeforeDelete);
      // Rotation changes the real container width while retaining the text draft.
      await clickButton(page, 'Edit text'); await page.setViewport({ width: 850, height: width, deviceScaleFactor: 1 }); await paint(page);
      assert.equal(await page.$eval('[aria-label="Text content"]', el => el.value), content);
      assert.equal((await layout()).textWidth, 640); await page.setViewport({ width, height: 850, deviceScaleFactor: 1 }); await paint(page); await finishTextEditing(page);
      const stream = await downloads(page, `mobile-${width}`);
      await page.$eval('.export-trigger-btn', button => button.click()); await paint(page);
      const geometry = await page.evaluate(() => ({ body: document.body.scrollWidth, html: document.documentElement.scrollWidth, viewport: innerWidth, menu: document.querySelector('.export-popover').getBoundingClientRect().toJSON() }));
      assert.ok(geometry.body <= width && geometry.html <= width && geometry.menu.x >= 0 && geometry.menu.right <= width);
      await clickButton(page, 'Download 1x (1600×1200)');
      const file = await takeDownload(stream, `mobile-${width}.png`), metadata = await sharp(file).metadata(); assert.equal(metadata.width, 1600); assert.equal(metadata.height, 1200);
      const events = await page.evaluate(() => window.__imeEvents);
      await fs.writeFile(path.join(output, `mobile-ime-${width}.json`), JSON.stringify(events, null, 2));
      assert.ok(events.some(event => event.type === 'compositionstart' && event.trusted));
      assert.ok(events.some(event => event.type === 'input' && event.trusted && event.composing));
      assert.ok(events.some(event => event.type === 'compositionend'), 'CDP commits composition; Chrome may mark its compositionend untrusted');
      rows.push({ width, file, keyboardBefore, keyboardAfter, geometry, events, finalDocument: (await snapshot(page)).snapshot.textDocument, platform: 'Desktop Chromium emulation/CDP; not physical OS IME or real iOS' });
      await stream.close(); await client.detach(); await page.close();
    }
    await fs.writeFile(path.join(output, 'mobile-flows.json'), JSON.stringify({ rows, realIOSSafari: '未测：没有可用真机' }, null, 2));
  } finally { await browser.close(); }
});

test('T5 failed unused secondary/background slots do not deadlock a valid Single/solid export', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page);
    const invalid = path.join(output, 'invalid-image.png'); await fs.writeFile(invalid, 'This is not an image.');
    await page.focus('[aria-label="Move text"]'); await page.keyboard.press('2');
    await (await page.$('input[aria-label="Second screenshot file"]')).uploadFile(invalid);
    await page.waitForFunction(() => [...document.querySelectorAll('[role="alert"]')].some(node => /Second screenshot.*decoded/i.test(node.textContent)));
    await page.focus('[aria-label="Move text"]'); await page.keyboard.press('1');
    const stream = await downloads(page, 'unused-slots');
    await exportButton(page, 'Download 1x (1600×1200)');
    const single = await takeDownload(stream, 'unused-failed-secondary.png');
    await page.evaluate(() => window.__mockupBaseline.apply({ bgType: 'image' }, { pro: true })); await clickButton(page, 'Canvas');
    await (await page.$('[data-testid="bg-file-input"]')).uploadFile(invalid);
    await page.waitForFunction(() => [...document.querySelectorAll('[role="alert"]')].some(node => /Canvas background.*decoded/i.test(node.textContent)));
    await clickButton(page, 'Solid'); await exportButton(page, 'Download 1x (1600×1200)');
    const solid = await takeDownload(stream, 'unused-failed-background.png');
    await fs.writeFile(path.join(output, 'unused-slot-recovery.json'), JSON.stringify({ single, solid, mode: (await snapshot(page)).snapshot.layoutMode, bgType: (await snapshot(page)).snapshot.bgType }, null, 2)); await stream.close();
  } finally { await browser.close(); }
});

test('T5 switching to solid invalidates an older real background upload completion', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page);
    await page.evaluate(() => window.__mockupBaseline.apply({ bgType: 'image' }, { pro: true })); await clickButton(page, 'Canvas');
    await page.evaluate(() => {
      const original = FileReader.prototype.readAsDataURL;
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function () {
        const ready = decode.call(this);
        if (!this.isConnected && this.src.startsWith('data:image/png')) void ready.then(() => { window.__backgroundDecoded = true; HTMLImageElement.prototype.decode = decode; });
        return ready;
      };
      FileReader.prototype.readAsDataURL = function (blob) {
        const callback = this.onload;
        this.onload = event => { window.__releaseBackground = () => callback.call(this, event); window.__backgroundReady = true; };
        FileReader.prototype.readAsDataURL = original; return original.call(this, blob);
      };
    });
    await (await page.$('[data-testid="bg-file-input"]')).uploadFile(path.resolve('../../output/devsnapkit/honeywerank-original.png'));
    await page.waitForFunction(() => window.__backgroundReady);
    await clickButton(page, 'Solid'); const before = (await snapshot(page)).snapshot;
    await page.evaluate(() => window.__releaseBackground());
    await page.waitForFunction(() => window.__backgroundDecoded === true); await paint(page);
    assert.equal((await snapshot(page)).snapshot.bgType, 'solid');
    assert.equal((await snapshot(page)).snapshot.bgImageSrc, before.bgImageSrc);
    await fs.writeFile(path.join(output, 'background-last-intent.json'), JSON.stringify({ before: { bgType: before.bgType, bgImageSrc: before.bgImageSrc }, after: { bgType: (await snapshot(page)).snapshot.bgType, bgImageSrc: (await snapshot(page)).snapshot.bgImageSrc } }, null, 2));
  } finally { await browser.close(); }
});

test('T5 validation uses the actual centered offset box plus its lower scroll extent, not a symmetrized maximum height', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page, { pro: false });
    await page.evaluate(() => window.__mockupBaseline.apply({ hideMockup: true }));
    await clickButton(page, 'Edit text'); await fill(page, '[aria-label="Text content"]', 'I', false); await finishTextEditing(page);
    await fill(page, '[aria-label="Canvas width"]', 200, false); await fill(page, '[aria-label="Canvas height"]', 210, false); await clickButton(page, 'Set');
    for (const [field, value] of [['Text size', 160], ['Text x', 100], ['Text y', 105], ['Text width', 160]]) await fill(page, `[data-canvas-text-controls] [aria-label="${field}"]`, value);
    await paint(page);
    const measured = await page.$eval('#studio-canvas [data-canvas-text]', node => ({ offsetHeight: node.offsetHeight, scrollHeight: node.scrollHeight, originY: 105 - node.offsetHeight / 2, bottom: 105 - node.offsetHeight / 2 + node.scrollHeight }));
    assert.ok(measured.bottom > 211, 'Real lower scroll extent exceeds the one-pixel allowance');
    await fs.writeFile(path.join(output, 'scroll-extent-measurement.json'), JSON.stringify(measured, null, 2));
    assert.ok(await page.$('[data-text-layout-errors]'), 'The preview flags the actual out-of-bounds extent');
    const stream = await downloads(page, 'scroll-extent');
    await exportButton(page, 'Download 1x (200×210)');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && [...document.querySelectorAll('[role="alert"]')].some(node => /Export blocked/.test(node.textContent)));
    assert.deepEqual(await stream.files(), []);
    await fill(page, '[data-canvas-text-controls] [aria-label="Text y"]', 100); await paint(page);
    assert.equal(await page.$('[data-text-layout-errors]'), null, 'Moving the real top to zero makes all 209 layout pixels fit');
    await exportButton(page, 'Download 1x (200×210)'); const file = await takeDownload(stream, 'scroll-extent-repaired.png');
    const metadata = await sharp(file).metadata(); assert.equal(metadata.width, 200); assert.equal(metadata.height, 210); await stream.close();
  } finally { await browser.close(); }
});

test('T5 font160 inline editing keeps the renderer origin while covering its complete scroll extent', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page);
    await page.evaluate(() => window.__mockupBaseline.apply({ hideMockup: true }, { pro: true }));
    await clickButton(page, 'Edit text'); await fill(page, '[aria-label="Text content"]', 'I', false); await finishTextEditing(page);
    await fill(page, '[data-canvas-text-controls] [aria-label="Text size"]', 160);
    await clickButton(page, 'Edit text'); await paint(page);
    const measurements = await page.evaluate(() => {
      const root = document.querySelector('#studio-canvas'), normal = root.querySelector('[data-canvas-text]'), textarea = document.querySelector('[aria-label="Text content"]'), wrapper = textarea.closest('[data-text-edit-layout]');
      const scale = root.getBoundingClientRect().width / root.offsetWidth;
      const measure = node => ({ top: (node.getBoundingClientRect().top - root.getBoundingClientRect().top) / scale, width: node.getBoundingClientRect().width / scale, offsetHeight: node.offsetHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop });
      return { normal: measure(normal), textarea: measure(textarea), layout: measure(wrapper), scale };
    });
    assert.ok(Math.abs(measurements.normal.top - measurements.textarea.top) <= .1);
    assert.ok(Math.abs(measurements.normal.width - measurements.textarea.width) <= .1);
    assert.equal(measurements.layout.offsetHeight, measurements.normal.offsetHeight);
    assert.equal(measurements.textarea.offsetHeight, Math.max(measurements.normal.offsetHeight, measurements.normal.scrollHeight));
    assert.equal(measurements.textarea.scrollTop, 0);
    const move = await (await page.$('[aria-label="Move text"]')).boundingBox();
    const inputBox = await (await page.$('[aria-label="Text content"]')).boundingBox();
    assert.ok(move.y + move.height <= inputBox.y + .1, JSON.stringify({ move, inputBox }));
    // Exclude editor chrome from this glyph-only comparison: the Move handle is
    // intentionally visible while typing, and its antialiasing shares the test
    // glyph's color mask. Its actual non-overlap is asserted above. Textarea
    // font, origin, size and rendering stay untouched.
    await page.$$eval('[data-text-gesture]', nodes => nodes.forEach(node => { node.style.visibility = 'hidden'; }));
    await page.$eval('[aria-label="Text content"]', textarea => { textarea.setSelectionRange(0, 0); textarea.style.caretColor = 'transparent'; });
    const beforeFile = path.join(output, 'inline-font160.png'), afterFile = path.join(output, 'inline-font160-committed.png');
    await page.screenshot({ path: beforeFile, clip: await (await page.$('#studio-canvas')).boundingBox() });
    await finishTextEditing(page); await page.select('[aria-label="Current text"]', ''); await paint(page);
    await page.screenshot({ path: afterFile, clip: await (await page.$('#studio-canvas')).boundingBox() });
    const boxes = [];
    for (const file of [beforeFile, afterFile]) {
      const { data, info } = await sharp(file).resize(1600, 1200).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const bounds = [Infinity, Infinity, -Infinity, -Infinity];
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const i = (y * info.width + x) * 4; if (data[i] > 140 && data[i + 1] < 100 && data[i + 2] > 80 && data[i + 3] > 100) { bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y); bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y); } }
      assert.ok(Number.isFinite(bounds[0])); boxes.push(bounds);
    }
    assert.ok(boxes[0].every((value, index) => Math.abs(value - boxes[1][index]) <= 2), JSON.stringify(boxes));
    await fs.writeFile(path.join(output, 'inline-scroll-extent.json'), JSON.stringify({ ...measurements, normalizedGlyphBounds: boxes, beforeFile, afterFile, caretExcludedFromComparison: true }, null, 2));
  } finally { await browser.close(); }
});

test('T5 corrupt main screenshot blocks output with its name and a real replacement recovers on the same page', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page, { pro: false }); await new Promise(resolve => setTimeout(resolve, 450));
    const before = await snapshot(page), stream = await downloads(page, 'bad-main');
    const invalid = path.join(output, 'invalid-image.png'); await fs.writeFile(invalid, 'This is not an image.');
    await (await page.$('input[aria-label="Main screenshot file"]')).uploadFile(invalid);
    await page.waitForFunction(() => [...document.querySelectorAll('[role="alert"]')].some(node => /Main screenshot.*decoded/i.test(node.textContent)));
    assert.deepEqual(await snapshot(page), before, 'Failed data never replaces the last valid screenshot');
    await exportButton(page, 'Download 1x (1600×1200)'); await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    assert.deepEqual(await stream.files(), []);
    const message = await page.$$eval('[role="alert"]', nodes => nodes.map(node => node.textContent).join('\n'));
    assert.match(message, /Main screenshot.*decoded.*Replace/i);
    await (await page.$('input[aria-label="Main screenshot file"]')).uploadFile(path.resolve('../../output/devsnapkit/honeywerank-original.png'));
    await exportButton(page, 'Download 1x (1600×1200)'); const file = await takeDownload(stream, 'recovered-main.png');
    assert.equal((await sharp(file).metadata()).width, 1600);
    assert.equal((await snapshot(page)).snapshot.imageName, 'honeywerank-original.png');
    await fs.writeFile(path.join(output, 'image-failure-recovery.json'), JSON.stringify({ message, file, samePageRetry: true, initialDocumentPreserved: true }, null, 2)); await stream.close();
  } finally { await browser.close(); }
});

test('T5 4K and batch stay Pro gated while ordinary text and 1x/2x remain available', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, url); await fixture(page, { pro: false });
    const stream = await downloads(page, 'pro-gates');
    await exportButton(page, '4K Ultra');
    await page.waitForSelector('button[title="Close"]'); assert.deepEqual(await stream.files(), []);
    await page.click('button[title="Close"]');
    await exportButton(page, 'Unlock Batch Export in Pro'); await page.waitForSelector('button[title="Close"]');
    assert.deepEqual(await stream.files(), []); await page.click('button[title="Close"]');
    const before = (await snapshot(page)).snapshot;
    await page.evaluate(() => window.__mockupBaseline.apply({}, { pro: true }));
    await exportButton(page, '4K Ultra'); await exportButton(page, 'Download 4K (3840×2880)');
    const file = await takeDownload(stream, 'pro-4k.png'), metadata = await sharp(file).metadata();
    assert.equal(metadata.width, 3840); assert.equal(metadata.height, 2880);
    assert.deepEqual((await snapshot(page)).snapshot.textDocument, before.textDocument);
    await fs.writeFile(path.join(output, 'pro-gates.json'), JSON.stringify({ free4KBlocked: true, freeBatchBlocked: true, testOnlyPro: 'Vite bridge extras.pro; no real key, no production unlock', file, width: metadata.width, height: metadata.height }, null, 2)); await stream.close();
  } finally { await browser.close(); }
});

test('T5 CDP composition cancellation and over-limit drafts keep all text, with a usable no-VisualViewport fallback', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 850, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => { localStorage.setItem('devsnapkit_welcome_seen', '1'); Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined }); });
    await page.goto(url, { waitUntil: 'networkidle0' }); await page.waitForSelector('#studio-canvas');
    await clickButton(page, 'Add text'); const client = await page.createCDPSession();
    await client.send('Input.imeSetComposition', { text: '取消', selectionStart: 2, selectionEnd: 2 });
    await client.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
    await page.keyboard.press('Escape');
    assert.equal((await snapshot(page)).snapshot.textDocument.layers[0].content, 'Text');
    await clickButton(page, 'Edit text');
    const excessive = '中'.repeat(1001);
    await client.send('Input.imeSetComposition', { text: excessive, selectionStart: 1001, selectionEnd: 1001 });
    assert.equal(await page.$eval('[aria-label="Text content"]', node => Array.from(node.value).length), 1001);
    assert.equal((await snapshot(page)).snapshot.textDocument.layers[0].content, 'Text');
    await page.$eval('.export-trigger-btn', button => button.click()); assert.equal(await page.$('.export-popover'), null);
    await client.send('Input.insertText', { text: excessive });
    assert.equal(await page.$eval('[aria-label="Text content"]', node => Array.from(node.value).length), 1001, 'Committed too-long draft remains complete for correction');
    assert.equal((await snapshot(page)).snapshot.textDocument.layers[0].content, 'Text');
    await page.keyboard.press('Escape'); await clickButton(page, 'Edit text');
    await client.send('Input.insertText', { text: '无需键盘 API 🙂' });
    await page.setViewport({ width: 390, height: 520, deviceScaleFactor: 1 }); await paint(page);
    assert.equal(await page.$('[data-text-edit-dock]'), null, 'A valid draft has no floating actions without VisualViewport');
    assert.equal(await page.$('[data-text-edit-recovery]'), null);
    await finishTextEditing(page); assert.equal((await snapshot(page)).snapshot.textDocument.layers[0].content, '无需键盘 API 🙂');
    await fs.writeFile(path.join(output, 'ime-fallback.json'), JSON.stringify({ cancellationPreserved: true, completeDraftCodepoints: 1001, oldDocumentKept: true, validDraftDockAbsent: true, API: 'CDP Chromium; real iOS/physical OS IME untested' }, null, 2));
    await client.detach();
  } finally { await browser.close(); }
});

test('T5 clipboard reports the underlying named admission failure rather than a generic rejected Blob promise', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser();
  try {
    await browser.defaultBrowserContext().overridePermissions(new URL(url).origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    const page = await preparePage(browser, url); await fixture(page, { pro: false });
    const invalid = path.join(output, 'invalid-image.png'); await fs.writeFile(invalid, 'This is not an image.');
    await (await page.$('input[aria-label="Main screenshot file"]')).uploadFile(invalid);
    await page.waitForFunction(() => [...document.querySelectorAll('[role="alert"]')].some(node => /Main screenshot.*decoded/.test(node.textContent)));
    const before = await snapshot(page);
    await exportButton(page, 'Copy to Clipboard (2x HD)');
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    const message = await page.$$eval('[role="alert"]', nodes => nodes.map(node => node.textContent).join('\n'));
    assert.match(message, /Main screenshot.*decoded/, 'The real preparation failure survives clipboard promise rejection');
    assert.match(message, /Download/); assert.deepEqual(await snapshot(page), before);
    await fs.writeFile(path.join(output, 'clipboard-admission-failure.json'), JSON.stringify({ message, stable: true }, null, 2));
  } finally { await browser.close(); }
});

test('T5 indivisible grapheme overflow is checked on both horizontal sides in preview and every output path', { skip: !url, timeout: 150000 }, async () => {
  const browser = await launchBrowser();
  try {
    await browser.defaultBrowserContext().overridePermissions(new URL(url).origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    const page = await preparePage(browser, url); await fixture(page);
    await page.evaluate(() => window.__mockupBaseline.apply({ hideMockup: true }, { pro: true }));
    await clickButton(page, 'Edit text'); await fill(page, '[aria-label="Text content"]', 'W', false); await finishTextEditing(page);
    await fill(page, '[aria-label="Canvas width"]', 200, false); await fill(page, '[aria-label="Canvas height"]', 400, false); await clickButton(page, 'Set');
    for (const [field, value] of [['Text size', 160], ['Text y', 200], ['Text width', 64]]) await fill(page, `[data-canvas-text-controls] [aria-label="${field}"]`, value);
    const stream = await downloads(page, 'horizontal'), rows = [];
    for (const [align, x] of [['left', 150], ['center', 150], ['right', 150]]) {
      await clickButton(page, 'Text');
      await page.click(`[data-canvas-text-controls] [aria-label="Align ${align}"]`); await fill(page, '[data-canvas-text-controls] [aria-label="Text x"]', x); await paint(page);
      const measured = await page.$eval('#studio-canvas [data-canvas-text]', node => {
        const root = node.closest('[data-canvas-root]'), rootRect = root.getBoundingClientRect(), scale = rootRect.width / root.offsetWidth, range = document.createRange(); range.selectNodeContents(node);
        return { scale, align: getComputedStyle(node).textAlign, width: node.offsetWidth, scrollWidth: node.scrollWidth, fragments: [...range.getClientRects()].map(rect => ({ left: (rect.left - rootRect.left) / scale, right: (rect.right - rootRect.left) / scale })) };
      });
      rows.push({ align, x, ...measured });
      await fs.writeFile(path.join(output, 'horizontal-overflow-measurement.json'), JSON.stringify(rows, null, 2));
      assert.ok(measured.fragments.some(rect => rect.left < -1 || rect.right > 201), 'Native text fragment really overflows the canvas');
      assert.ok(await page.$('[data-text-layout-errors]'), 'Preview flags actual grapheme overflow rather than only the nominal box');
      await exportButton(page, 'Download 1x (200×400)'); await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
      assert.deepEqual(await stream.files(), []);
    }
    for (const format of ['WEBP', 'JPEG']) { await exportButton(page, format); await exportButton(page, 'Download 1x (200×400)'); await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]')); assert.deepEqual(await stream.files(), []); }
    await exportButton(page, 'Copy to Clipboard (2x HD)'); await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    assert.match(await page.$$eval('[role="alert"]', nodes => nodes.map(node => node.textContent).join('\n')), /Text 1.*W.*outside/i);
    await page.evaluate(() => [...document.querySelectorAll('.studio-inspector label')].find(label => /^Custom/.test(label.textContent.trim()) && label.querySelector('input[type="checkbox"]')).querySelector('input').click());
    await exportButton(page, 'Export 5 Sizes (1x)'); await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
    assert.deepEqual(await stream.files(), []); assert.match(await page.$$eval('[role="alert"]', nodes => nodes.map(node => node.textContent).join('\n')), /Custom \(200×400\).*Text 1.*W/i);
    await clickButton(page, 'Text'); await page.click('[data-canvas-text-controls] [aria-label="Align center"]'); await fill(page, '[data-canvas-text-controls] [aria-label="Text x"]', 50); await exportButton(page, 'PNG'); await paint(page);
    assert.equal(await page.$('[data-text-layout-errors]'), null);
    await exportButton(page, 'Download 1x (200×400)'); const file = await takeDownload(stream, 'horizontal-repaired.png');
    const metadata = await sharp(file).metadata(); assert.equal(metadata.width, 200); assert.equal(metadata.height, 400); await stream.close();
    await fs.writeFile(path.join(output, 'horizontal-overflow.json'), JSON.stringify({ rows, blocked: ['PNG', 'WebP', 'JPEG', 'Clipboard', 'Batch including Custom'], recovered: file }, null, 2));
  } finally { await browser.close(); }
});
