import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} }; cache.set(file, module.exports);
  const code = ts.transpileModule(fs.readFileSync(new URL(`../src/${file}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => load(name === '../templates' ? 'templates' : `templates/${name.replace('./', '')}`) });
  return module.exports;
}
const { TEMPLATE_CATALOG } = load('templates/catalog');
const { buildTemplateSnapshot, restoreTemplateLayout, releaseTemplateMediaRegion } = load('templates/apply');
const json = value => JSON.parse(JSON.stringify(value));
const ids = { headline: 'h', description: 'd' };
const before = { imageSrc: 'user.png', imageName: 'My image', windowTitle: 'Keep title', primaryMediaOrigin: { kind: 'user' }, secondarySrc: 'second.png', secondaryName: 'Second', customBrandWatermark: 'Acme', logoDataUrl: 'logo.png', qrUrl: 'https://example.com', textDocument: { version: 1, layers: [] }, vfxNoise: true, vfxGlow: true, hideMockup: true, mockupZoom: 220, mockupOffsetX: 999, layoutMode: 'duo' };

test('exactly four free descriptors construct complete deterministic snapshots without sharing mutable layers', () => {
  assert.equal(TEMPLATE_CATALOG.length, 4);
  assert.equal(new Set(TEMPLATE_CATALOG.map(t => t.id)).size, 4);
  for (const template of TEMPLATE_CATALOG) {
    const next = buildTemplateSnapshot(before, template, ids);
    for (const key of ['imageSrc', 'imageName', 'windowTitle', 'secondarySrc', 'secondaryName', 'customBrandWatermark', 'logoDataUrl', 'qrUrl']) assert.equal(next[key], before[key]);
    assert.equal(next.gradientId, template.style.gradientId);
    assert.equal(next.aspectRatioId, template.canvas.aspectRatioId);
    assert.equal(next.windowTheme, template.style.windowTheme);
    assert.equal(next.vfxGlow, false); assert.equal(next.vfxNoise, false); assert.equal(next.hideMockup, false);
    assert.equal(next.mockupZoom, 100); assert.equal(next.mockupOffsetX, 0); assert.equal(next.layoutMode, 'single');
    assert.equal(next.textDocument.layers.length, 2);
    assert.deepEqual(json(next.templateContext.textRoles), ids);
    assert.equal(JSON.stringify(buildTemplateSnapshot(next, template, ids)), JSON.stringify(next));
    next.textDocument.layers[0].content = 'Mutated'; next.templateContext.mediaRegion.y = .9;
    assert.notEqual(template.text.headline.content, 'Mutated'); assert.equal(template.mediaRegion.y, .30);
  }
});

test('builtin samples follow the destination; unknown origins and user SVG remain protected', () => {
  for (const template of TEMPLATE_CATALOG) {
    const next = buildTemplateSnapshot({ ...before, primaryMediaOrigin: { kind: 'builtin', sampleId: 'social' } }, template, ids);
    assert.equal(next.primaryMediaOrigin.sampleId, template.sampleId);
    assert.match(next.imageSrc, /^data:image\/svg\+xml/);
    if (template.sampleId === 'code') assert.doesNotMatch(next.imageSrc, /@devsnap|createMockup|exportRetina/);
    for (const origin of [undefined, { kind: 'unknown' }, { kind: 'user' }]) assert.equal(buildTemplateSnapshot({ ...before, primaryMediaOrigin: origin, imageSrc: 'data:image/svg+xml,user' }, template, ids).imageSrc, 'data:image/svg+xml,user');
  }
});

test('restore only changes layout and extant role geometry; composition release preserves bindings and contain context', () => {
  const template = TEMPLATE_CATALOG[0];
  const applied = buildTemplateSnapshot(before, template, ids);
  const edited = { ...applied, gradientId: 'custom-user-bg', windowTheme: 'none', padding: 22, aspectRatioId: 'square', mockupZoom: 180, mockupOffsetY: 70, textDocument: { version: 1, layers: [{ ...applied.textDocument.layers[0], content: 'Keep edited words', fontSize: 80, color: '#FF0000', centerX: .2 }, { ...applied.textDocument.layers[1], id: 'new', content: 'Added text', centerX: .1 }] } };
  const released = releaseTemplateMediaRegion(edited);
  assert.deepEqual(json(released.templateContext.mediaRegion), { x: 0, y: 0, width: 1, height: 1 });
  assert.deepEqual(json(released.templateContext.textRoles), ids);
  const restored = restoreTemplateLayout(released, template);
  for (const key of ['imageSrc', 'windowTheme', 'gradientId', 'padding']) assert.equal(restored[key], edited[key]);
  assert.equal(restored.aspectRatioId, template.canvas.aspectRatioId); assert.equal(restored.mockupZoom, 100); assert.equal(restored.mockupOffsetY, 0);
  const [headline, added] = restored.textDocument.layers;
  assert.equal(headline.content, 'Keep edited words'); assert.equal(headline.fontSize, 80); assert.equal(headline.color, '#FF0000'); assert.equal(headline.centerX, .5);
  assert.equal(added.id, 'new'); assert.equal(added.centerX, .1); assert.equal(restored.textDocument.layers.length, 2, 'deleted role must not return');
});
