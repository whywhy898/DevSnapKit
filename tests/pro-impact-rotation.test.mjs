import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';

const load = createTypeScriptLoader(fileURLToPath(new URL('../src/', import.meta.url)));
const { ImageControls, GeometryInput } = load('inspector/ImageControls.tsx');
const { createIndependentComposition } = load('composition/document.ts');
const noop = () => {};
function controls(overrides = {}) {
  return { document: { ...createIndependentComposition(), allowBleed: true }, selected: 'main', size: { width: 1920, height: 1080 }, onChange: noop, onStart: noop, onFinish: noop, onRestore: noop, onResetTemplate: noop, onIndependent: noop, ...overrides };
}
function find(node, predicate) {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  return [node.props?.children].flat(Infinity).map(child => find(child, predicate)).find(Boolean);
}

test('independent image advanced inspector exposes bounded degree rotation with geometry transactions', () => {
  const props = controls();
  props.document.placements.main.rotation = -2.5;
  const html = renderToStaticMarkup(createElement(ImageControls, props));
  assert.match(html, /aria-label="Object rotation"[^>]*type="number"[^>]*min="-180"[^>]*max="180"[^>]*step="any"[^>]*value="-2.5"/);
  const tree = ImageControls(props);
  const fieldset = find(tree, node => node.type === 'fieldset' && Boolean(find(node.props.children, child => child.type === GeometryInput && child.props.label === 'Object rotation')));
  assert.ok(fieldset, 'rotation belongs to a geometry transaction fieldset');
  assert.equal(fieldset.props.onFocusCapture, props.onStart);
  fieldset.props.onBlurCapture({ currentTarget: { contains: () => false }, relatedTarget: null });
  const legacy = renderToStaticMarkup(createElement(ImageControls, controls({ document: { ...props.document, mediaLayout: 'legacy' } })));
  assert.doesNotMatch(legacy, /aria-label="Object rotation"/);
});

test('rotation commits finite degrees through placement editing without silently clamping invalid drafts', () => {
  for (const selected of ['main', 'secondary']) {
    let next;
    const props = controls({ selected, onChange: value => { next = value; } });
    const input = find(ImageControls(props), node => node.type === GeometryInput && node.props.label === 'Object rotation');
    assert.ok(input, 'rotation control exists');
    const before = JSON.stringify(props.document);
    for (const rotation of [-180, -2.5, 0, 7, 180]) {
      input.props.onCommit(rotation);
      assert.equal(next.placements[selected].rotation, rotation);
      for (const key of ['centerX', 'centerY', 'widthRatio', 'heightRatio']) assert.equal(next.placements[selected][key], props.document.placements[selected][key]);
      assert.equal(next.placements[selected === 'main' ? 'secondary' : 'main'], props.document.placements[selected === 'main' ? 'secondary' : 'main']);
      assert.equal(JSON.stringify(props.document), before);
    }
    for (const rotation of [-181, 181, NaN, Infinity, -Infinity]) {
      next = undefined;
      input.props.onCommit(rotation);
      assert.equal(next, undefined, 'invalid rotation draft preserves the document');
    }
  }
});
