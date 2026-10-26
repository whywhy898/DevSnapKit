import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { launchBrowser, preparePage, finishTextEditing } from './helpers/browser.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'http://127.0.0.1:5197';
let server;
before(async () => {
  const vite = path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js');
  server = spawn(process.execPath, [vite, '--config', 'tests/vite-mockup-baseline.config.mjs', '--host', '127.0.0.1', '--port', '5197', '--strictPort'], { cwd: root, stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error('Hover test server exited');
    try { if ((await fetch(origin)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Hover test server did not become ready');
});
after(() => server?.kill());

const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function chooserDuring(page, action) {
  const pending = page.waitForFileChooser({ timeout: 700 }).then(async chooser => { await chooser.cancel(); return true; }).catch(error => { if (error.name === 'TimeoutError') return false; throw error; });
  await action(); return pending;
}
async function drag(page, selector, dx, dy) {
  const node = await page.$(selector); assert.ok(node, selector);
  const box = await node.boundingBox(); assert.ok(box, selector);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 }); await page.mouse.up();
  await node.dispose(); await paint(page);
}

test('screenshot upload hover coexists with text hit boxes, editing and drag handles', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, origin + '/?editor=1');
    await page.hover('[data-media-surface]');
    await page.waitForFunction(() => +getComputedStyle(document.querySelector('.media-hover-overlay')).opacity > .95);
    assert.equal(await chooserDuring(page, () => page.click('[data-media-surface]')), true, 'ordinary screenshot still opens upload');

    // Legacy Basic entries retired from the curated gallery. Exercise the same
    // original factory through saved-state restoration, retaining hover coverage.
    await page.evaluate(async () => {
      const { buildSocialLaunchSnapshot } = await import('/src/templates/apply.ts');
      const state = window.__mockupBaseline;
      state.apply(buildSocialLaunchSnapshot(state.snapshot, { headline: 'legacy-hover-headline', description: 'legacy-hover-description' }));
    });
    await page.waitForFunction(() => document.querySelectorAll('[data-text-hit]').length === 2);
    await page.hover('[data-media-surface]');
    await page.waitForFunction(() => +getComputedStyle(document.querySelector('.media-hover-overlay')).opacity > .95);
    assert.equal(await chooserDuring(page, () => page.click('[data-media-surface]')), true, 'template screenshot opens upload with text present');
    assert.equal(await chooserDuring(page, () => drag(page, '[data-media-surface]', 45, 15)), false, 'dragging screenshot does not open upload');

    // Put real editable text over the screenshot to exercise the competing hit areas.
    await page.evaluate(() => {
      const state = window.__mockupBaseline;
      state.apply({ textDocument: { ...state.snapshot.textDocument, layers: state.snapshot.textDocument.layers.map((layer, i) => i ? layer : { ...layer, centerY: .64, widthRatio: .4, fontSize: 36 }) } });
    });
    await paint(page);
    await page.hover('[data-text-hit]');
    await page.waitForFunction(() => !document.querySelector('.media-hover-overlay') || +getComputedStyle(document.querySelector('.media-hover-overlay')).opacity < .05);
    assert.equal(await chooserDuring(page, () => page.click('[data-text-hit]')), false, 'overlapping text enters editing without chooser');
    await page.waitForSelector('[aria-label="Text content"]', { visible: true });
    assert.equal(await page.$eval('#studio-canvas', node => node.dataset.mediaUploadEnabled), 'false');
    assert.equal(await page.$('.media-hover-overlay'), null, 'inline editing disables upload hover');
    assert.equal(await chooserDuring(page, () => page.click('[aria-label="Text content"]')), false, 'editing text never uploads');
    await page.type('[aria-label="Text content"]', '!');
    await finishTextEditing(page); await paint(page);
    assert.equal(await chooserDuring(page, () => drag(page, '[data-text-gesture="move"]', 20, 15)), false, 'move handle does not upload');
    assert.equal(await chooserDuring(page, () => drag(page, '[data-text-gesture="right"]', 15, 0)), false, 'width handle does not upload');
    await page.hover('[data-media-surface]');
    assert.equal(await page.$eval('.media-hover-overlay', node => node.dataset.exportIgnore), 'true');

    // The actual frozen export artwork mounts without interactive overlays or titles.
    const exported = await page.evaluate(async () => {
      const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
      const react = await import('/node_modules/.vite/deps/react.js');
      const { createRoot } = dom.default ?? dom;
      const { createElement } = react.default ?? react;
      const { MockupArtwork } = await import('/src/MockupArtwork.tsx');
      const { freezeArtworkProps } = await import('/src/export/exportMockup.tsx');
      const host = document.createElement('div'); host.style.position = 'fixed'; host.style.left = '-10000px'; document.body.append(host);
      const root = createRoot(host); root.render(createElement(MockupArtwork, freezeArtworkProps(window.__mockupBaseline.artwork())));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = { overlays: host.querySelectorAll('.media-hover-overlay').length, uploadTitles: host.querySelectorAll('[title*="replace screenshot"]').length, enabled: host.querySelector('[data-canvas-root]')?.getAttribute('data-media-upload-enabled') };
      root.unmount(); host.remove(); return result;
    });
    assert.deepEqual(exported, { overlays: 0, uploadTitles: 0, enabled: 'false' });
  } finally { await browser.close(); }
});
