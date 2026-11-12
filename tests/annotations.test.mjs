import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';

const load = createTypeScriptLoader(fileURLToPath(new URL('../src/', import.meta.url)));
const api = load('composition/annotations.ts');
const { createIndependentComposition, moveCompositionObject, validateComposition } = load('composition/document.ts');
const { EditorHistory } = load('editorHistory.ts');
const size = { width: 1000, height: 600 };
const plain = value => JSON.parse(JSON.stringify(value));

test('annotations add immutably to the drawing order with free style presets', () => {
  assert.equal(typeof api.addAnnotation, 'function');
  const doc = createIndependentComposition();
  for (const kind of ['arrow', 'rectangle', 'highlight']) {
    const next = api.addAnnotation(doc, kind, kind, size);
    const node = next.objects[0];
    assert.equal(node.annotation, kind);
    assert.equal(next.order.at(-1), kind);
    assert.equal(node.opacity, kind === 'highlight' ? .35 : 1);
    assert.equal(validateComposition(next), next);
  }
  assert.equal(doc.objects.length, 0);
  assert.equal(api.ANNOTATION_COLORS.length, 5);
  assert.equal(Object.keys(api.ANNOTATION_WIDTHS).length, 3);
});

test('reset clears every annotation and one undo restores the complete pre-reset snapshot', () => {
  let doc = createIndependentComposition();
  for (const kind of ['arrow', 'rectangle', 'highlight']) {
    doc = api.addAnnotation(doc, kind, kind, size);
    doc = moveCompositionObject(doc, kind, { centerX: .2 + doc.objects.length * .15, heightRatio: .25 }, size);
    doc = api.styleAnnotation(doc, kind, { color: '#3b82f6', width: 'thick' });
  }
  const decoration = { ...doc.objects[1], id: 'decorated-annotation' };
  const ordinary = { id: 'ordinary', kind: 'shape', shape: 'rect', fill: '#ffffff', frame: { ...doc.objects[0].frame } };
  doc = { ...doc, objects: [...doc.objects, ordinary], decorations: [decoration],
    order: [...doc.order, ordinary.id, decoration.id], hiddenIds: ['rectangle', decoration.id, ordinary.id] };
  const before = { compositionDocument: doc, padding: 123, solidColor: '#abcdef' };
  const saved = plain(before), history = new EditorHistory(before);
  const reset = { ...before, compositionDocument: api.clearAnnotations(doc), padding: 88, solidColor: '#0b0f19' };
  history.flush(reset);
  assert.equal(history.count, 2, 'the entire reset is one history entry');
  assert.deepEqual(plain(reset.compositionDocument.objects), [ordinary]);
  assert.deepEqual(plain(reset.compositionDocument.decorations), []);
  assert.deepEqual(plain(reset.compositionDocument.order), doc.order.filter(id => !['arrow', 'rectangle', 'highlight', decoration.id].includes(id)));
  assert.deepEqual(plain(reset.compositionDocument.hiddenIds), [ordinary.id]);
  assert.deepEqual(plain(before), saved, 'reset never mutates the snapshot stored for Undo');
  assert.deepEqual(plain(history.undo(reset)), saved);
  assert.deepEqual(plain(history.redo()), plain(reset));
});

test('annotation tools render exact short labels, lucide icons and the selected kind', () => {
  const { AnnotationTools } = load('composition/AnnotationControls.tsx');
  for (const selectedKind of ['arrow', 'rectangle', 'highlight']) {
    const html = renderToStaticMarkup(createElement(AnnotationTools, { selectedKind, onAdd() {} }));
    const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    assert.deepEqual(buttons.map(([, , content]) => content.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]*>/g, '')), ['Arrow', 'Box', 'Highlight']);
    assert.equal(buttons.filter(([, attrs]) => attrs.includes('aria-pressed="true"')).length, 1);
    for (const [, attrs, content] of buttons) {
      assert.match(content, /<svg[^>]*aria-hidden="true"/);
      assert.match(content, /lucide/);
      assert.match(attrs, /class="elements-add"/);
    }
    assert.match(buttons[['arrow', 'rectangle', 'highlight'].indexOf(selectedKind)][1], /aria-pressed="true"/);
  }
});

test('endpoint drag crosses either axis and preserves the opposite endpoint, including horizontal and vertical arrows', () => {
  let doc = api.addAnnotation(createIndependentComposition(), 'arrow', 'a', size);
  const before = api.annotationEndpoints(doc.objects[0], size);
  for (const point of [{ x: 80, y: 90 }, { x: before.end.x, y: 10 }, { x: 20, y: before.end.y }, before.end]) {
    const next = api.moveAnnotationEndpoint(doc, 'a', 'start', point, size);
    const ends = api.annotationEndpoints(next.objects[0], size);
    for (const axis of ['x', 'y']) assert.ok(Math.abs(ends.end[axis] - before.end[axis]) < 1e-8);
    assert.ok(Math.abs(ends.start.x - point.x) < 1e-8 && Math.abs(ends.start.y - point.y) < 1e-8);
    assert.equal(validateComposition(next), next);
  }
  const ends = api.annotationEndpoints(api.moveAnnotationEndpoint(doc, 'a', 'end', { x: 900, y: 500 }, size).objects[0], size);
  for (const axis of ['x', 'y']) assert.ok(Math.abs(ends.start[axis] - before.start[axis]) < 1e-8);
  assert.deepEqual(plain(ends.end), { x: 900, y: 500 });
});

test('history restores add, move, resize, endpoints, color, width and delete as separate commands', () => {
  const initial = createIndependentComposition(), history = new EditorHistory(initial);
  const states = [initial];
  const commit = doc => { history.flush(doc); states.push(doc); return doc; };
  let doc = commit(api.addAnnotation(initial, 'arrow', 'a', size));
  for (const patch of [{ centerX: .6 }, { widthRatio: .4, heightRatio: .2 }]) {
    history.beginTransaction(doc);
    doc = moveCompositionObject(doc, 'a', patch, size);
    history.commitTransaction(doc); states.push(doc);
  }
  history.beginTransaction(doc);
  for (let x = 10; x <= 100; x += 10) history.updateTransaction(api.moveAnnotationEndpoint(doc, 'a', 'start', { x, y: 50 }, size));
  doc = api.moveAnnotationEndpoint(doc, 'a', 'start', { x: 100, y: 50 }, size);
  history.commitTransaction(doc); states.push(doc);
  doc = commit(api.styleAnnotation(doc, 'a', { color: '#3b82f6' }));
  doc = commit(api.styleAnnotation(doc, 'a', { width: 'thick' }));
  doc = commit(api.deleteAnnotation(doc, 'a'));
  assert.equal(history.count, states.length);
  for (let i = states.length - 2; i >= 0; i--) { doc = history.undo(doc); assert.deepEqual(plain(doc), plain(states[i])); }
  for (let i = 1; i < states.length; i++) assert.deepEqual(plain(history.redo()), plain(states[i]));
  assert.deepEqual(plain(doc.objects), []);
});

test('invalid annotation geometry and styles are rejected before export', () => {
  const base = api.addAnnotation(createIndependentComposition(), 'arrow', 'a', size);
  for (const patch of [{ strokeWidth: Infinity }, { stroke: 'url(bad)' }, { referenceWidth: 0 }, { start: { x: NaN, y: 0 } }, { annotation: 'pen' }]) {
    const doc = { ...base, objects: [{ ...base.objects[0], ...patch }] };
    assert.throws(() => validateComposition(doc), /annotation/i);
  }
});

test('cancelled gestures preserve redo and a new annotation edit replaces the redo branch', () => {
  const initial = api.addAnnotation(createIndependentComposition(), 'rectangle', 'a', size);
  const edited = api.styleAnnotation(initial, 'a', { width: 'thick' });
  const history = new EditorHistory(initial); history.flush(edited);
  assert.deepEqual(plain(history.undo(edited)), plain(initial));
  history.beginTransaction(initial);
  history.updateTransaction(moveCompositionObject(initial, 'a', { centerX: .7 }, size));
  assert.deepEqual(plain(history.cancelTransaction()), plain(initial));
  assert.equal(history.canRedo, true);
  const replacement = api.styleAnnotation(initial, 'a', { color: '#22c55e' }); history.flush(replacement);
  assert.equal(history.canRedo, false);
  assert.equal(initial.objects[0].stroke, '#ef4444');
  const hidden = { ...replacement, hiddenIds: ['a'] }, removed = api.deleteAnnotation(hidden, 'a');
  assert.equal(removed.objects.length, 0); assert.equal(removed.order.includes('a'), false); assert.equal(removed.hiddenIds.includes('a'), false);
});

test('SVG export geometry scales endpoints, arrowheads and strokes at arbitrary logical sizes', () => {
  const { AnnotationRenderer } = load('composition/AnnotationRenderer.tsx');
  const doc = api.addAnnotation(createIndependentComposition(), 'arrow', 'a', size), node = doc.objects[0];
  const first = api.annotationGeometry(node, size);
  for (const scale of [1, 2, 1.37]) {
    const target = { width: size.width * scale, height: size.height * scale };
    const geometry = api.annotationGeometry(node, target);
    for (const key of ['width', 'height', 'strokeWidth']) assert.ok(Math.abs(geometry[key] - first[key] * scale) < 1e-8);
    for (const key of ['start', 'end']) for (const axis of ['x', 'y']) assert.ok(Math.abs(geometry[key][axis] - first[key][axis] * scale) < 1e-8);
    for (let i = 0; i < 2; i++) for (const axis of ['x', 'y']) assert.ok(Math.abs(geometry.head[i][axis] - first.head[i][axis] * scale) < 1e-8);
    const html = renderToStaticMarkup(createElement(AnnotationRenderer, { object: node, size: target }));
    assert.match(html, /<svg/); assert.match(html, /<polyline/);
    assert.doesNotMatch(html, /vector-effect|marker-end|data-export-ignore/);
  }
});
