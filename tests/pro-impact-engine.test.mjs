import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';

const load = createTypeScriptLoader(fileURLToPath(new URL('../src/', import.meta.url)));
const text = load('text/document.ts');
const composition = load('composition/document.ts');
const Shell = load('composition/MediaShell.tsx').MediaShell;
const layer = { id: 'headline', content: 'Ship\nit. 😀中文', centerX: .5, centerY: .5, widthRatio: .8, font: 'manrope', fontSize: 452, weight: 800, italic: false, color: '#16130F', align: 'left', letterSpacing: -28.024 };
const shadow = { x: 16, y: 16, blur: 0, color: '#16130F', referenceWidth: 960 };
const shell = (presentation, logicalWidth) => Shell({ src: 'demo.svg', presentation: { frame: 'plain', fit: 'contain', align: 'center', ...presentation }, logicalWidth });
const documentWith = presentation => ({ ...composition.createIndependentComposition(), mediaPresentation: { main: { frame: 'plain', fit: 'contain', align: 'center', ...presentation } } });

test('large editable text retains authored size, tracking, Unicode and runs', () => {
  const result = text.validateText({ ...layer, runs: [{ text: layer.content }] });
  assert.equal(result.fontSize, 452); assert.equal(result.letterSpacing, -28.024); assert.equal(result.content, layer.content);
  for (const fontSize of [8, 512]) assert.equal(text.validateText({ ...layer, fontSize }).fontSize, fontSize);
  for (const letterSpacing of [-40, 40]) assert.equal(text.validateText({ ...layer, letterSpacing }).letterSpacing, letterSpacing);
});

test('text rejects out of range and nonfinite values without changing existing limits', () => {
  for (const fontSize of [7, 513, NaN, Infinity, -Infinity]) assert.throws(() => text.validateText({ ...layer, fontSize }), /8.*512/);
  for (const letterSpacing of [-41, 41, NaN, Infinity, -Infinity]) assert.throws(() => text.validateText({ ...layer, letterSpacing }), /-40.*40/);
  assert.equal(text.TEXT_LIMITS.layers, 20); assert.equal(text.TEXT_LIMITS.codepoints, 1000);
  assert.equal(Array.from(text.validateText({ ...layer, content: '😀'.repeat(1000) }).content).length, 1000);
  assert.throws(() => text.validateText({ ...layer, content: '😀'.repeat(1001) }), /1000/);
});

test('typed presentation shadows and plain radius scale with authored reference width', () => {
  assert.equal(shell({ shadow }, 960).props.style.boxShadow, '16px 16px 0px #16130F');
  assert.equal(shell({ shadow, radius: 14 }, 480).props.style.boxShadow, '8px 8px 0px #16130F');
  assert.equal(shell({ shadow, radius: 14 }, 480).props.style.borderRadius, 7);
  assert.equal(shell({ shadow: { x: 0, y: 40, blur: 80, color: '#14080659', referenceWidth: 440 }, frame: 'phone-light' }, 220).props.style.boxShadow, '0px 20px 40px #14080659');
  assert.equal(shell({ shadow: { x: -12, y: 24, blur: 50, color: '#28180C38' }, radius: 14 }, 700).props.style.borderRadius, 14);
  assert.equal(shell({ shadow: { ...shadow, referenceWidth: undefined } }, 480).props.style.boxShadow, '16px 16px 0px #16130F');
});

test('missing optional presentation fields retain exact legacy native styles', () => {
  assert.equal(shell({}, 960).props.style.boxShadow, undefined);
  assert.equal(shell({}, 960).props.style.borderRadius, 0);
  assert.equal(shell({ frame: 'browser-dark' }, 960).props.style.boxShadow, '0 10px 28px #15203320');
  assert.equal(shell({ frame: 'browser-dark' }, 960).props.style.borderRadius, 12);
  assert.equal(shell({ frame: 'phone-light' }, 430).props.style.boxShadow, '0 10px 24px #211b2526');
  const doc = documentWith({}); assert.equal(composition.validateComposition(doc), doc);
});

test('presentation validation accepts finite bounds and rejects malformed new fields', () => {
  for (const x of [-128, 128]) assert.doesNotThrow(() => composition.validateComposition(documentWith({ shadow: { x, y: -128, blur: 128, color: '#ABCDEF12', referenceWidth: .5 }, radius: 128 })));
  const invalidShadows = [null, '0 0 url(https://example.com)', [], {}, ...['x','y','blur','referenceWidth'].flatMap(key => [NaN, Infinity, -Infinity, '16'].map(value => ({ ...shadow, [key]: value }))), ...[-129,129].map(x => ({ ...shadow, x })), ...[-129,129].map(y => ({ ...shadow, y })), ...[-1,129].map(blur => ({ ...shadow, blur })), ...[0,-1].map(referenceWidth => ({ ...shadow, referenceWidth })), ...['red','#abc','#1234567','url(x)',null,123].map(color => ({ ...shadow, color })), { ...shadow, filter: 'url(x)' }];
  for (const value of invalidShadows) assert.throws(() => composition.validateComposition(documentWith({ shadow: value })), /presentation|shadow/i, JSON.stringify(value));
  for (const radius of [-1,129,NaN,Infinity,null,'14']) assert.throws(() => composition.validateComposition(documentWith({ radius })), /presentation|radius/i);
});

test('browser and plain presented frames receive current logical width for authored effects', () => {
  const Renderer = load('composition/CompositionRenderer.tsx').CompositionRenderer;
  const doc = documentWith({ frame: 'browser-dark', shadow, radius: 14 });
  const html = renderToStaticMarkup(createElement(Renderer, { document: doc, size: { width: 960, height: 600 }, imageSrc: 'demo.svg', textDocument: { version: 1, layers: [] } }));
  assert.match(html, /box-shadow:11\.2px 11\.2px 0px #16130F/);
});

test('text inspector communicates current size and tracking ranges', () => {
  const Controls = load('text/TextControls.tsx').TextControls;
  const html = renderToStaticMarkup(createElement(Controls, { document: { version: 1, layers: [layer] }, editor: { active: layer, activeId: layer.id, size: { width: 1920, height: 1080 } }, disabled: false }));
  assert.match(html, /aria-label="Text size"[^>]*title="8–512 px"[^>]*min="8"[^>]*max="512"/);
  assert.match(html, /aria-label="Text letterSpacing"[^>]*title="−40–40 px"[^>]*min="-40"[^>]*max="40"/);
});
