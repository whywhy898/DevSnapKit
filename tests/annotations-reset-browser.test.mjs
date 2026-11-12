import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, clickButton } from './helpers/browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const enabled = process.env.TEST_ANNOTATIONS_BUILT === '1';

test('built editor Reset clears annotations as one undoable command in both themes', { skip: !enabled, timeout: 120000 }, async t => {
  // Serve the production build, using the same browser helper as test:paypal:browser.
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, 'dist', pathname === '/' ? 'index.html' : '.' + pathname);
      if (!file.startsWith(path.resolve(root, 'dist') + path.sep)) { res.writeHead(403).end(); return; }
      const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
      const bytes = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const browser = await launchBrowser(); t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(20000);
  await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('devsnapkit_welcome_seen', '1');
    localStorage.setItem('devsnapkit_welcome_dismissed', 'true');
    localStorage.setItem('shotcraft_theme_mode', 'light');
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/?editor=1`, { waitUntil: 'networkidle0' });
  console.log('Built editor loaded');
  await page.waitForSelector('#studio-canvas');
  await page.waitForFunction(() => [...document.querySelectorAll('#studio-canvas img')].some(img => img.complete && img.naturalWidth > 0));
  // Start from a changed canvas setting so Undo must restore styling and
  // annotation content together, rather than merely repopulating the objects.
  await clickButton(page, 'Export');
  for (const [label, value] of [['Canvas width', '1000'], ['Canvas height', '700']]) {
    await page.focus(`[aria-label="${label}"]`);
    await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(value);
  }
  await clickButton(page, 'Set');
  console.log('Changed canvas', await page.evaluate(() => ({ width: document.querySelector('[aria-label="Canvas width"]').value, height: document.querySelector('[aria-label="Canvas height"]').value, canvas: [document.querySelector('#studio-canvas').offsetWidth, document.querySelector('#studio-canvas').offsetHeight], error: [...document.querySelectorAll('[role="alert"]')].map(n => n.textContent) })));
  await page.waitForFunction(() => document.querySelector('#studio-canvas').offsetWidth === 1000 && document.querySelector('#studio-canvas').offsetHeight === 700);
  const snapshot = () => page.evaluate(() => ({
    canvasSize: [document.querySelector('#studio-canvas').offsetWidth, document.querySelector('#studio-canvas').offsetHeight],
    annotations: [...document.querySelectorAll('#studio-canvas [data-annotation]')].map(svg => ({
      id: svg.parentElement.dataset.compositionObject, frame: svg.parentElement.getAttribute('style'), svg: svg.outerHTML,
    })),
  }));
  const shortcut = async (modifier, key) => {
    await page.keyboard.down(modifier); await page.keyboard.press(key); await page.keyboard.up(modifier);
  };
  const drag = async (selector, dx, dy) => {
    const box = await (await page.$(selector)).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 }); await page.mouse.up();
  };
  const addAndStyle = async () => {
    await clickButton(page, 'Text'); await clickButton(page, 'Annotations');
    for (const [label, kind, color, dx, dy] of [['Arrow', 'arrow', 'blue', -100, -120], ['Box', 'rectangle', 'red', 110, 0], ['Highlight', 'highlight', 'yellow', -70, 120]]) {
      await clickButton(page, label);
      console.log(`Added ${label}`);
      await page.waitForSelector(`[data-annotation="${kind}"]`);
      await clickButton(page, `Annotation color ${color}`);
      await clickButton(page, 'Annotation width thick');
      await drag(`[data-annotation="${kind}"]`, dx, dy);
      if (kind !== 'arrow') await drag('[aria-label="Scale selected object"]', 25, 15);
    }
  };
  await addAndStyle();
  assert.deepEqual(await page.$$eval('.annotation-add button', buttons => buttons.map(b => b.textContent)), ['Arrow', 'Box', 'Highlight']);
  assert.equal(await page.$$eval('.annotation-add button[aria-pressed="true"]', buttons => buttons.length), 1);

  // Capture real editor UI, then exercise immediate keyboard undo and toolbar undo.
  const directory = process.env.ANNOTATIONS_EVIDENCE_DIR || path.join(root, 'scratch', 'annotations-evidence');
  await fs.mkdir(directory, { recursive: true });
  const before = await snapshot();
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await clickButton(page, 'Switch to Dark theme');
    await page.waitForFunction(theme => document.documentElement.classList.contains(`theme-${theme}`), {}, theme);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.studio-inspector').scrollTop = 0; });
    await page.mouse.move(1100, 100);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const contrast = await page.$$eval('.annotation-add button', buttons => buttons.map(button => {
      const css = getComputedStyle(button);
      return { color: css.color, background: css.backgroundColor, radius: css.borderRadius, font: css.fontSize, padding: css.padding, icon: !!button.querySelector('svg') };
    }));
    for (const style of contrast) { assert.equal(style.icon, true); assert.equal(style.radius, '9px'); assert.equal(style.font, '12px'); assert.equal(style.padding, '9px 12px'); }
    const filename = path.join(directory, `annotations-ui-${theme}.png`);
    await page.screenshot({ path: filename });
    // Chromium PNGs have no embedded EXIF/XMP/C2PA. Verify the delivered chunks.
    const png = await fs.readFile(filename), chunks = [];
    for (let offset = 8; offset < png.length;) { const size = png.readUInt32BE(offset); chunks.push(png.toString('ascii', offset + 4, offset + 8)); offset += size + 12; }
    assert.ok(chunks.every(type => ['IHDR', 'IDAT', 'IEND', 'sRGB'].includes(type)), `Unexpected PNG metadata: ${chunks}`);
    console.log(`${theme} screenshot: ${filename}`);
    console.log(`${theme} button styles: ${JSON.stringify(contrast)}`);
    await clickButton(page, 'Reset');
    assert.equal((await snapshot()).annotations.length, 0);
    assert.notDeepEqual((await snapshot()).canvasSize, before.canvasSize, 'Reset also changes the modified canvas size');
    await shortcut(theme === 'light' ? 'Control' : 'Meta', 'z');
    assert.deepEqual(await snapshot(), before, 'one immediate Undo restores positions, sizes, colors and canvas settings');
    await shortcut('Control', 'y'); assert.equal((await snapshot()).annotations.length, 0);
    // Editor shortcuts yield to native field editing.
    await page.evaluate(() => { const input = document.createElement('input'); input.id = 'reset-typing-test'; document.body.append(input); input.focus(); });
    await shortcut('Control', 'z'); assert.equal((await snapshot()).annotations.length, 0);
    await page.evaluate(() => document.querySelector('#reset-typing-test').remove());
    await clickButton(page, 'Undo'); assert.deepEqual(await snapshot(), before);
  }
  // Cover the separate curated-template Reset branch through its actual UI.
  await page.click('[data-template-trigger]');
  await page.waitForSelector('[data-template-gallery][open]');
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('[data-template-gallery] button[aria-label^="Apply "]')].find(button => button.closest('article').querySelector('.template-tier-free'));
    if (!button) throw new Error('No free curated template'); button.click();
  });
  await page.waitForFunction(() => !document.querySelector('[data-template-gallery][open]'));
  await addAndStyle();
  const templateBefore = await snapshot();
  await clickButton(page, 'Reset'); assert.equal((await snapshot()).annotations.length, 0);
  await shortcut('Control', 'z'); assert.deepEqual(await snapshot(), templateBefore, 'template Reset also restores all annotations with one Undo');
  assert.deepEqual(errors, []);
});
