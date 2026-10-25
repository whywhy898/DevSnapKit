import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';

const load = createTypeScriptLoader(fileURLToPath(new URL('../src/', import.meta.url)));
const { MockupArtwork } = load('MockupArtwork.tsx');
const { createHoneyComposition } = load('composition/designedCatalog.ts');
const logo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="red"/%3E%3C/svg%3E';
const base = {
  textDocument: { version: 1, layers: [] }, gradient: { className: '' },
  canvasLogicalSize: { width: 1600, height: 1200 }, bgType: 'solid', solidColor: '#ffffff',
  effectivePaddingX: 0, effectivePaddingY: 0, padding: 0,
  layoutMode: 'single', duoLayout: 'side', layoutPreset: 'flat', windowTheme: 'browser',
  imageSrc: 'main.svg', imageName: 'main.svg', secondarySrc: 'secondary.svg', secondaryName: 'secondary.svg',
  mockupZoom: 100, mockupOffsetX: 0, mockupOffsetY: 0, zoomStyle: {},
  windowTitle: 'example.test', roundedCorners: 14, cornerStyle: 'default', shadowLevel: 'soft', shadowOpacity: 30,
  logoDataUrl: logo, logoOpacity: 1, logoScale: 7, logoPos: 'top-left',
  qrDataUrl: 'qr-test.png', qrPos: 'bottom-right', qrScale: 8,
  customBrandWatermark: 'My saved legacy badge',
  isProUnlocked: false, preview: false,
};
const render = extra => renderToStaticMarkup(createElement(MockupArtwork, { ...base, ...extra }));

test('template logo sizing preserves its aspect ratio and does not move screenshots', () => {
  const { resizeTemplateLogo, moveTemplateLogo, templateLogo } = load('inspector/brandModel.ts');
  const doc = createHoneyComposition(), before = JSON.parse(JSON.stringify(doc));
  const resized = resizeTemplateLogo(doc, 6, { width: 1600, height: 1200 });
  const a = templateLogo(doc), b = templateLogo(resized);
  assert.equal(b.frame.heightRatio, .06);
  assert.ok(Math.abs(a.frame.widthRatio / a.frame.heightRatio - b.frame.widthRatio / b.frame.heightRatio) < 1e-9);
  assert.deepEqual(JSON.parse(JSON.stringify(resized.placements)), JSON.parse(JSON.stringify(doc.placements)));
  const moved = moveTemplateLogo(resized, { centerX: .4, centerY: .2 }, { width: 1600, height: 1200 });
  assert.equal(templateLogo(moved).frame.centerX, .4);
  assert.deepEqual(JSON.parse(JSON.stringify(doc)), before, 'no mutation');
});

for (const [name, extra] of [
  ['ordinary single', {}],
  ['legacy duo', { layoutMode: 'duo' }],
  ['independent Honey', { compositionDocument: createHoneyComposition() }],
]) {
  test(`free Logo, QR and saved badge render in ${name} without a license`, () => {
    const html = render(extra);
    assert.match(html, /alt="Brand Logo"/, 'custom logo must be in the actual artwork');
    assert.match(html, /alt="QR Code"/, 'QR must be in the actual artwork');
    assert.match(html, /My saved legacy badge/, 'legacy text content must not disappear');
    assert.equal((html.match(/alt="Brand Logo"/g) || []).length, 1, 'one custom logo');
  });
}

test('ordinary and template logos share the same 0–1 opacity unit', () => {
  for (const opacity of [1, .5]) {
    for (const compositionDocument of [null, createHoneyComposition()]) {
      const html = render({ compositionDocument, logoOpacity: opacity, isProUnlocked: true });
      const image = html.match(/<img[^>]*alt="Brand Logo"[^>]*>/)?.[0];
      assert.ok(image, 'logo exists');
      assert.ok(image.includes(`opacity:${opacity}`), `expected ${opacity} in ${image}`);
      assert.doesNotMatch(image, /opacity:0\.005|opacity:0\.01(?:;|")/);
    }
  }
});

test('removing a custom Honey logo restores the builtin mark with no duplicate image', () => {
  const html = render({ compositionDocument: createHoneyComposition(), logoDataUrl: null });
  assert.doesNotMatch(html, /alt="Brand Logo"/);
  assert.match(html, /data-composition-object="brand-mark"/);
});

test('Brand exposes only free Logo and static QR controls, with file recovery', () => {
  assert.ok(fs.existsSync(new URL('../src/inspector/BrandControls.tsx', import.meta.url)), 'dedicated free Brand form exists');
  const { BrandControls } = load('inspector/BrandControls.tsx');
  const noop = () => {};
  const html = renderToStaticMarkup(createElement(BrandControls, {
    logoDataUrl: logo, logoOpacity: .5, logoScale: 7, logoPos: 'top-left', logoError: 'Try another image.', isProcessingLogo: false,
    qrUrl: 'https://example.test', qrDataUrl: 'qr.png', qrScale: 8, qrPos: 'bottom-right',
    onUploadLogo: noop, onRemoveLogo: noop, onLogoOpacity: noop, onLogoScale: noop, onLogoPosition: noop,
    onTemplateLogoMove: noop, onTemplateLogoReset: noop,
    onQrUrl: noop, onQrSize: noop, onQrPosition: noop, onRemoveQr: noop,
    onStart: noop, onFinish: noop,
  }));
  assert.match(html, /Add your logo and a QR code\. Included in Free\./);
  assert.match(html, /aria-label="Logo file"/);
  assert.match(html, /aria-label="QR website URL"/);
  assert.match(html, /Try another image\./);
  assert.doesNotMatch(html, /PRO|Pro suite|Dynamic QR|\$1|Text Brand Badge|Unlock/);
});
