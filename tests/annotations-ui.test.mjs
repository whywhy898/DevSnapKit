import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { launchBrowser, clickButton } from './helpers/browser.mjs';

const origin = process.env.TEST_UI_URL;
test('adding the first annotation preserves the Duo upload placeholder and media geometry', { skip: !origin, timeout: 30000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1100 });
    await page.goto(new URL('/?editor=1&mode=duo', origin).href, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#studio-canvas');
    await page.evaluate(() => window.__mockupBaseline.apply({ aspectRatioId: 'custom', customCanvasSize: { width: 800, height: 600 }, duoLayout: 'vertical', secondarySrc: null }));
    const geometry = () => page.evaluate(async () => {
      const { stableArtworkLayout } = await import('/src/export/prepareArtworkExport.ts');
      const root = document.querySelector('#studio-canvas'); await stableArtworkLayout(root);
      const canvas = root.getBoundingClientRect(), scale = canvas.width / root.offsetWidth;
      const rect = root.querySelector('[data-scene-slot="1"]').getBoundingClientRect();
      return { placeholder: root.querySelector('[data-scene-slot="2"]')?.textContent.trim(), box: [rect.x - canvas.x, rect.y - canvas.y, rect.width, rect.height].map(value => value / scale) };
    });
    const before = await geometry(); assert.ok(before.placeholder);
    await clickButton(page, 'Text'); await clickButton(page, 'Annotations'); await clickButton(page, 'Add rectangle');
    const after = await geometry(); assert.equal(after.placeholder, before.placeholder);
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(after.box[i] - before.box[i]) < .2, 'annotation preserves screenshot placement');
  } finally { await browser.close(); }
});

test('annotation tools, gesture history, typing guard and native scaled exports in single and duo', { skip: !origin, timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/?editor=1', origin).href, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#studio-canvas');
    await page.evaluate(() => window.__mockupBaseline.apply({ aspectRatioId: 'custom', customCanvasSize: { width: 800, height: 600 } }));
    await page.waitForFunction(() => document.querySelector('#studio-canvas').offsetWidth === 800);
    await clickButton(page, 'Text'); await clickButton(page, 'Annotations'); await clickButton(page, 'Add arrow');
    const snapshot = async () => {
      await page.waitForFunction(() => !window.__mockupBaseline.history.inTransaction);
      return page.evaluate(async () => {
        let previous = '', stable = 0;
        for (let i = 0; i < 30 && stable < 3; i++) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const current = JSON.stringify(window.__mockupBaseline.snapshot.compositionDocument);
          stable = current === previous ? stable + 1 : 0; previous = current;
        }
        return window.__mockupBaseline.snapshot.compositionDocument;
      });
    };
    const undo = async () => { await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); };
    const redo = async () => { await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control'); };
    const drag = async (selector, dx, dy) => {
      const node = await page.$(selector), box = await node.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 }); await page.mouse.up();
    };
    await page.waitForSelector('[aria-label="Arrow start endpoint"]');
    const initial = await snapshot();
    await drag('[aria-label="Arrow start endpoint"]', -50, -30);
    const endpoint = await snapshot(); assert.notDeepEqual(endpoint, initial);
    await undo(); assert.deepEqual(await snapshot(), initial); await redo(); assert.deepEqual(await snapshot(), endpoint);
    await drag('[aria-label="Arrow end endpoint"]', 25, 20);
    const endMoved = await snapshot(); assert.notDeepEqual(endMoved, endpoint);
    await undo(); assert.deepEqual(await snapshot(), endpoint); await redo();
    await drag('[data-annotation="arrow"]', 30, 15);
    const moved = await snapshot(); assert.notDeepEqual(moved.objects[0].frame, endMoved.objects[0].frame);
    await undo(); assert.deepEqual(await snapshot(), endMoved); await redo();
    await clickButton(page, 'Annotation color blue');
    assert.equal((await snapshot()).objects[0].stroke, '#3b82f6');
    await undo(); assert.deepEqual(await snapshot(), moved); await redo();
    await clickButton(page, 'Annotation width thick'); assert.equal((await snapshot()).objects[0].strokeWidth, 8);
    await undo(); assert.equal((await snapshot()).objects[0].strokeWidth, 4); await redo();
    await page.evaluate(() => { const input = document.createElement('input'); input.id = 'annotation-typing-test'; document.body.append(input); input.focus(); });
    await page.keyboard.press('Backspace'); assert.equal((await snapshot()).objects.length, 1);
    await page.evaluate(() => document.querySelector('#annotation-typing-test').remove());
    await page.keyboard.press('Delete'); assert.equal((await snapshot()).objects.length, 0);
    await undo(); assert.equal((await snapshot()).objects.length, 1); await redo();
    await clickButton(page, 'Add rectangle'); const rectangle = await snapshot();
    const cancelHandle = await page.$('[aria-label="Scale selected object"]'), cancelBox = await cancelHandle.boundingBox();
    await page.mouse.move(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2); await page.mouse.down();
    await page.mouse.move(cancelBox.x + 40, cancelBox.y + 40, { steps: 5 }); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await snapshot(), rectangle, 'Escape cancels the entire resize');
    await drag('[aria-label="Scale selected object"]', 50, 25);
    const resized = await snapshot(); assert.notDeepEqual(resized.objects[0].frame, rectangle.objects[0].frame);
    await undo(); assert.deepEqual(await snapshot(), rectangle); await redo();
    await clickButton(page, 'Add highlight');
    assert.equal((await snapshot()).objects.at(-1).opacity, .35);
    const highlight = await snapshot();
    await drag('[data-annotation="highlight"]', -35, 20);
    const highlightMoved = await snapshot();
    assert.notDeepEqual(highlightMoved.objects.at(-1).frame, highlight.objects.at(-1).frame);
    await undo(); assert.deepEqual(await snapshot(), highlight); await redo();
    await drag('[aria-label="Scale selected object"]', 40, -20);
    const highlightResized = await snapshot();
    assert.notDeepEqual(highlightResized.objects.at(-1).frame, highlightMoved.objects.at(-1).frame);
    await undo(); assert.deepEqual(await snapshot(), highlightMoved); await redo();
    await clickButton(page, 'Annotation color green');
    assert.equal((await snapshot()).objects.at(-1).fill, '#22c55e');
    await undo(); assert.deepEqual(await snapshot(), highlightResized); await redo();
    for (const tag of ['textarea', 'select', 'div']) {
      await page.evaluate(tag => {
        const field = document.createElement(tag); field.id = 'annotation-typing-test';
        if (tag === 'div') field.contentEditable = 'true';
        document.body.append(field); field.focus();
      }, tag);
      await page.keyboard.press('Delete'); assert.equal((await snapshot()).objects.length, 2);
      await page.evaluate(() => document.querySelector('#annotation-typing-test').remove());
    }
    await page.keyboard.press('Backspace'); assert.equal((await snapshot()).objects.length, 1);
    await undo(); assert.equal((await snapshot()).objects.length, 2); await redo();
    await clickButton(page, 'Add arrow');
    const beforeDeleteDrag = await snapshot(), draggedId = beforeDeleteDrag.objects.at(-1).id;
    const deleteHandle = await page.$('[aria-label="Arrow end endpoint"]'), deleteBox = await deleteHandle.boundingBox();
    await page.mouse.move(deleteBox.x + deleteBox.width / 2, deleteBox.y + deleteBox.height / 2); await page.mouse.down();
    await page.mouse.move(deleteBox.x + 35, deleteBox.y + 25, { steps: 5 });
    await page.keyboard.press('Delete'); await page.mouse.up();
    assert.equal((await snapshot()).objects.some(node => node.id === draggedId), false, 'Delete during a drag must not resurrect the annotation on pointer release');
    await undo(); assert.deepEqual(await snapshot(), beforeDeleteDrag, 'Undo restores the full pre-drag annotation geometry');
    await redo(); assert.equal((await snapshot()).objects.some(node => node.id === draggedId), false);
    // Exercise the real detached export renderer, independently of preview handles.
    const results = await page.evaluate(async () => {
      const { prepareMockupExport } = await import('/src/export/exportMockup.tsx');
      const { addAnnotation } = await import('/src/composition/annotations.ts');
      const { createIndependentComposition } = await import('/src/composition/document.ts');
      const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="white"/></svg>');
      const results = [];
      for (const layoutMode of ['single', 'duo']) {
        let doc = { ...createIndependentComposition(), mediaLayout: 'legacy', detailVisible: layoutMode === 'duo' };
        for (const kind of ['rectangle', 'arrow', 'highlight']) doc = addAnnotation(doc, kind, kind, { width: 800, height: 600 });
        doc.objects = doc.objects.map((node, index) => ({ ...node, frame: { ...node.frame, centerY: [.2, .5, .8][index] } }));
        const props = { ...window.__mockupBaseline.artwork(), compositionDocument: doc, layoutMode, imageSrc: image, secondarySrc: image, hideMockup: true, bgType: 'solid', solidColor: '#ffffff', vfxGlow: false, vfxNoise: false, shadowLevel: 'none', customBrandWatermark: '', textDocument: { version: 1, layers: [] } };
        const targets = [[800, 600, 800, 600], [800, 600, 1600, 1200], [1096, 822, 1096, 822]].map(([width, height, outputWidth, outputHeight]) => ({ width, height, outputWidth, outputHeight, format: 'png' }));
        const session = await prepareMockupExport(props, targets, document.body);
        try {
          for (let i = 0; i < targets.length; i++) {
            const blob = await session.rasterize(i);
            const data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
            results.push({ mode: layoutMode, ...targets[i], data });
          }
        } finally { session.dispose(); }
      }
      return results;
    });
    for (const result of results) {
      const image = sharp(Buffer.from(result.data, 'base64'));
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, result.outputWidth); assert.equal(info.height, result.outputHeight);
      const pixel = (x, y) => [...data.subarray((Math.round(y * info.height) * info.width + Math.round(x * info.width)) * 4, (Math.round(y * info.height) * info.width + Math.round(x * info.width)) * 4 + 3)];
      const red = ([r, g, b]) => r > 190 && g < 140 && b < 140;
      assert.ok(red(pixel(.5, .11)), `${result.mode} rectangle outline at correct scale`);
      assert.ok(red(pixel(.5, .5)), `${result.mode} arrow at correct scale`);
      const [r, g, b] = pixel(.5, .8);
      assert.ok(r >= 245 && g > 220 && b > 150 && b < 190, `${result.mode} highlight blends at 35% opacity: ${r},${g},${b}`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
