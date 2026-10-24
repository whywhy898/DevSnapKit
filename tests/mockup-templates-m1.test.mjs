import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const compile = file => ts.transpileModule(fs.readFileSync(new URL(`../src/${file}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const catalog = { exports: {} };
vm.runInNewContext(compile('templates'), { exports: catalog.exports, module: catalog });
const module = { exports: {} };
const descriptors = { exports: {} };
vm.runInNewContext(compile('templates/catalog'), { exports: descriptors.exports, module: descriptors });
vm.runInNewContext(compile('templates/apply'), { exports: module.exports, module, require: name => name === './catalog' ? descriptors.exports : catalog.exports });
const { buildSocialLaunchSnapshot: build, SOCIAL_SAMPLE } = module.exports;
const before = { imageSrc: 'user.svg', imageName: 'My screenshot.svg', windowTitle: 'My product', secondarySrc: 'second.png', secondaryName: 'Keep second', customBrandWatermark: 'Acme', logoDataUrl: 'brand.png', qrUrl: 'https://example.com', textDocument: { version: 1, layers: [{ id: 'old' }] } };
const ids = { headline: 'headline', description: 'description' };

test('template conservatively preserves unknown or user media, branding and inactive secondary asset', () => {
  for (const origin of [undefined, { kind: 'unknown' }, { kind: 'user' }]) {
    const input = { ...before, primaryMediaOrigin: origin };
    const result = build(input, ids);
    for (const key of ['imageSrc', 'imageName', 'windowTitle', 'secondarySrc', 'secondaryName', 'customBrandWatermark', 'logoDataUrl', 'qrUrl']) assert.equal(result[key], before[key], key);
    assert.equal(result.primaryMediaOrigin.kind, origin?.kind ?? 'unknown');
    assert.equal(result.layoutMode, 'single');
    assert.equal(input.textDocument.layers[0].id, 'old', 'builder must not mutate its baseline');
  }
});

test('template replaces explicitly builtin media with a clean screenshot and two editable role-bound layers', () => {
  const result = build({ ...before, primaryMediaOrigin: { kind: 'builtin', sampleId: 'social' } }, ids);
  assert.equal(result.imageSrc, SOCIAL_SAMPLE.svgDataUri);
  assert.equal(result.primaryMediaOrigin.sampleId, 'saas');
  assert.equal(result.windowTitle, before.windowTitle, 'manually edited window title survives builtin sample replacement');
  assert.equal(result.textDocument.layers.length, 2);
  assert.equal(result.textDocument.layers[0].content, 'Ship it.');
  assert.equal(result.textDocument.layers[1].content, 'One screenshot. One clear update.');
  assert.deepEqual(JSON.parse(JSON.stringify(result.templateContext.textRoles)), ids);
  assert.equal(result.templateContext.mediaRegion.y, .30);
  assert.equal(result.templateContext.mediaRegion.height, .68);
  assert.equal(result.aspectRatioId, 'og');
  assert.equal(result.windowTheme, 'browser');
  assert.equal(result.bgImageSrc, null);
  assert.equal(result.vfxGlow, false);
  assert.equal(JSON.stringify(build(result, ids)), JSON.stringify(result), 'reapply with command-owned IDs is deterministic');
});
