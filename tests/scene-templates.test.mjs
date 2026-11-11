import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';

const root = new URL('../', import.meta.url);
const load = createTypeScriptLoader(fileURLToPath(new URL('src/', root)));
const { buildCuratedSnapshot, restoreCuratedLayout, resetCuratedStyles } = load('templates/collection/apply.ts');
const { CURATED_TEMPLATE_CATALOG } = load('templates/collection/catalog.ts');
const { canApplyCuratedTemplate } = load('templates/collection/access.ts');
const { placementBounds, validateComposition } = load('composition/document.ts');
const { validateText } = load('text/document.ts');
const { EditorHistory } = load('editorHistory.ts');
const scenes = [['producthunt', 1270, 760], ['og', 1200, 630], ['appstore', 1290, 2796]];
const json = value => JSON.parse(JSON.stringify(value));
const base = { imageSrc: 'mine.png', imageName: 'My screenshot', primaryMediaOrigin: { kind: 'user' }, secondarySrc: 'detail.png', secondaryName: 'Detail', secondaryMediaOrigin: { kind: 'user' }, textDocument: { version: 1, layers: [] }, windowTitle: 'My app', layoutMode: 'duo' };
const clear = (a, b) => a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top;

test('scene export defaults reserve exact 1x for App Store and keep 2x elsewhere', () => {
  const { sceneExportDefaults } = load('templates/collection/scenes.ts');
  for (const id of ['scene-producthunt', 'scene-og', 'other-template', undefined]) {
    const defaults = sceneExportDefaults(id);
    assert.equal(defaults.scale, 2);
    assert.equal(defaults.exactSizeLabel, undefined);
  }
  const defaults = sceneExportDefaults('scene-appstore');
  assert.equal(defaults.scale, 1);
  assert.equal(defaults.exactSizeLabel, 'Exact size App Store requires (1290×2796)');
});

for (const [scene, width, height] of scenes) {
  test(`${scene}: free catalog blueprint applies exact size, background, one screenshot and editable title/subtitle`, () => {
    const id = `scene-${scene}`;
    const entry = CURATED_TEMPLATE_CATALOG.find(item => item.id === id);
    assert.ok(entry, `Missing scene ${id}`);
    assert.equal(entry.tier, 'free');
    assert.equal(canApplyCuratedTemplate(id, false), true);
    assert.deepEqual([entry.width, entry.height], [width, height]);
    const saved = json(base), next = buildCuratedSnapshot(base, id, 'scene');
    assert.deepEqual(json(base), saved, 'input is immutable');
    assert.equal(next.aspectRatioId, 'custom');
    assert.deepEqual(json(next.customCanvasSize), { width, height });
    assert.equal(next.bgType, 'solid');
    assert.match(next.solidColor, /^#[0-9a-f]{6}$/i);
    assert.equal(next.imageSrc, base.imageSrc);
    assert.equal(next.imageName, base.imageName);
    assert.equal(next.compositionDocument.mediaLayout, 'independent');
    assert.equal(next.compositionDocument.detailVisible, false);
    assert.equal(next.textDocument.layers.length, 2);
    assert.equal(next.templateContext.textRoles.headline, 'scene-headline');
    assert.equal(next.templateContext.textRoles.description, 'scene-description');
    validateComposition(next.compositionDocument, next.textDocument.layers.map(layer => layer.id));
    const media = placementBounds(next.compositionDocument.placements.main, next.customCanvasSize);
    const textBoxes = next.textDocument.layers.map(layer => {
      validateText(layer);
      const h = layer.fontSize * (layer.lineHeight ?? 1.25) * layer.content.split('\n').length;
      return { left: (layer.centerX - layer.widthRatio / 2) * width, top: layer.centerY * height - h / 2, width: layer.widthRatio * width, height: h };
    });
    for (const box of textBoxes) {
      assert.ok(clear(box, media), 'text is outside screenshot bounds');
      assert.ok(box.left >= 0 && box.top >= 0 && box.left + box.width <= width + 0.01 && box.top + box.height <= height + 0.01, 'text is inside canvas');
    }
    assert.ok(clear(...textBoxes), 'title and subtitle do not overlap');
    const history = new EditorHistory(base);
    history.flush(next);
    assert.equal(history.count, 2);
    assert.deepEqual(json(history.undo(next)), saved);
    assert.deepEqual(json(history.redo()), json(next));
    const modified = { ...next, textDocument: { ...next.textDocument, layers: next.textDocument.layers.map(layer => ({ ...layer, content: 'Edited copy', centerX: .4 })) } };
    assert.deepEqual(json(restoreCuratedLayout(modified).textDocument.layers.map(layer => layer.content)), ['Edited copy', 'Edited copy']);
    assert.equal(resetCuratedStyles({ ...next, solidColor: '#000000' }).solidColor, next.solidColor);
    const sample = buildCuratedSnapshot({ ...base, imageSrc: '', primaryMediaOrigin: { kind: 'builtin' } }, id, 'sample');
    assert.ok(fs.existsSync(new URL(`public${sample.imageSrc}`, root)), 'built-in sample exists');
  });
}

test('scene param parsing accepts only the three scene values and leaves attribution untouched', () => {
  const sceneFile = new URL('src/templates/collection/scenes.ts', root);
  assert.ok(fs.existsSync(sceneFile), 'scene definitions live in the existing template collection');
  const { sceneTemplateId } = load('templates/collection/scenes.ts');
  for (const [scene] of scenes) {
    const params = new URLSearchParams(`editor=1&scene=${scene}&utm_source=launch&ref=partner&aspect=twitter`);
    const before = params.toString();
    assert.equal(sceneTemplateId(params), `scene-${scene}`);
    assert.equal(params.toString(), before);
  }
  for (const query of ['', 'scene=', 'scene=unknown', 'scene=PRODUCTHUNT', 'scene=toString', 'scene=__proto__']) assert.equal(sceneTemplateId(new URLSearchParams(query)), undefined);
});

const pages = {
  'product-hunt-image-maker': 'producthunt',
  'product-hunt-gallery-image-size': 'producthunt',
  'og-image-generator': 'og',
  'twitter-x-post-image-size': 'og',
  'app-store-screenshot-generator': 'appstore',
};
for (const [slug, scene] of Object.entries(pages)) {
  test(`${slug}: hero, closing, footer and floating CTA open the matching scene`, () => {
    const html = fs.readFileSync(new URL(`public/${slug}/index.html`, root), 'utf8');
    const links = [...html.matchAll(/(?:href|data-studio-cta)="(\/\?[^\"]+)"/g)].map(match => new URL(match[1].replaceAll('&amp;', '&'), 'https://devsnapkit.com'));
    assert.ok(links.length >= 4);
    for (const url of links) {
      assert.equal(url.searchParams.get('editor'), '1');
      assert.equal(url.searchParams.get('scene'), scene);
    }
  });
}

test('gallery labels scenes and exposes them without requiring Pro', () => {
  const { TemplateMenu } = load('templates/TemplateMenu.tsx');
  const html = renderToStaticMarkup(createElement(TemplateMenu, { disabled: false, busy: false, isProUnlocked: false, onDesignedApply() {} }));
  assert.match(html, /data-template-filter="scenes"/);
  for (const [scene] of scenes) assert.match(html, new RegExp(`data-scene="${scene}"`));
});

test('App Store scene uses the size demonstrated by the existing landing guide', () => {
  const html = fs.readFileSync(new URL('public/app-store-screenshot-generator/index.html', root), 'utf8');
  assert.match(html, /Real export at 1290×2796/);
  assert.match(html, /for example 1290 × 2796/);
});
