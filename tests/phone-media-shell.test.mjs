import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load = createTypeScriptLoader(fileURLToPath(new URL('../src/', import.meta.url)));
const Shell = load('composition/MediaShell.tsx').MediaShell;
const Renderer = load('composition/CompositionRenderer.tsx').CompositionRenderer;
const api = load('composition/document.ts');
const shell = (frame, logicalWidth, fit = 'contain', align = 'center') => renderToStaticMarkup(createElement(Shell, {
  src: 'content.svg', name: 'App content', presentation: { frame, fit, align }, logicalWidth,
}));
test('phone chrome surrounds one canonical content image with separate status and home bars', () => {
  for (const frame of ['phone-light', 'phone-dark']) {
    const html = shell(frame, 430);
    assert.match(html, new RegExp(`data-media-frame="${frame}"`));
    assert.match(html, /data-media-chrome="phone-/);
    assert.match(html, /data-phone-status/); assert.match(html, /9:41/);
    assert.match(html, /data-phone-capsule/); assert.match(html, /data-phone-home/);
    assert.equal((html.match(/<img /g) || []).length, 1);
    assert.match(html, /data-media-screen[^>]*><img[^>]*src="content.svg"[^>]*object-fit:contain;object-position:center;pointer-events:none[^>]*\/><\/div><div data-phone-home/);
    assert.match(html, /border-radius:56px/); assert.match(html, /border:10px solid/);
    assert.match(html, /height:54px/); assert.match(html, /height:24px/);
    assert.doesNotMatch(html, /NaN|undefined|perspective|rotateY/);
  }
});
test('phone fit and alignment remain independent while native hardware scales with logical width', () => {
  const full = shell('phone-dark', 430, 'cover', 'bottom');
  const half = shell('phone-light', 215, 'contain', 'top');
  assert.match(full, /object-fit:cover;object-position:bottom/);
  assert.match(half, /object-fit:contain;object-position:top/);
  assert.match(half, /border-radius:28px/); assert.match(half, /border:5px solid/);
  assert.match(half, /height:27px/); assert.match(half, /height:12px/);
  assert.match(full, /background:#141A1C/i); assert.match(half, /background:#FBF5EF/i);
  for (const invalid of [undefined, 0, NaN, Infinity, -12]) assert.match(shell('phone-light', invalid), /border-radius:56px/);
});
test('renderer supplies each phone placement width and retains exactly two canonical sources', () => {
  const doc = api.createIndependentComposition(); doc.detailVisible = true;
  doc.mediaPresentation = { main: { frame: 'phone-light', fit: 'contain', align: 'top' }, secondary: { frame: 'phone-dark', fit: 'cover', align: 'bottom' } };
  doc.placements.main = { centerX: .3, centerY: .5, widthRatio: .43, heightRatio: .9, rotation: 0 };
  doc.placements.secondary = { centerX: .75, centerY: .5, widthRatio: .215, heightRatio: .8, rotation: 0 };
  const html = renderToStaticMarkup(createElement(Renderer, { document: doc, size: { width: 1000, height: 1100 }, imageSrc: 'main.svg', secondarySrc: 'second.svg', textDocument: { version: 1, layers: [] }, preview: true }));
  assert.equal((html.match(/<img /g) || []).length, 2);
  assert.equal((html.match(/data-media-chrome="phone-/g) || []).length, 2);
  assert.equal((html.match(/src="main.svg"/g) || []).length, 1);
  assert.equal((html.match(/src="second.svg"/g) || []).length, 1);
  assert.match(html, /border-radius:56px/); assert.match(html, /border-radius:28px/);
});
test('logical width leaves browser and plain markup unchanged', () => {
  for (const frame of ['browser-light', 'browser-dark', 'plain']) assert.equal(shell(frame, 215), shell(frame));
  assert.match(shell('browser-light'), /height:26px/);
  assert.doesNotMatch(shell('plain'), /data-media-chrome|data-phone-/);
});
