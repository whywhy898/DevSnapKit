import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(name, overrides = {}, cache = new Map()) {
  if (overrides[name]) return overrides[name];
  if (cache.has(name)) return cache.get(name).exports;
  const file = new URL(`../src/${name}${name.endsWith('Renderer') || name.endsWith('Overlay') || name.endsWith('Controls') || name.endsWith('Presentation') ? '.tsx' : '.ts'}`, import.meta.url);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} }; cache.set(name, module);
  vm.runInNewContext(source, { module, exports: module.exports, window: { addEventListener() {}, removeEventListener() {} }, require: id => {
    if (overrides[id]) return overrides[id];
    if (id.endsWith('.css')) return {};
    if (id.startsWith('.')) return load(new URL(id, `file:///${name}`).pathname.slice(1), overrides, cache);
    return require(id);
  } });
  return module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const d = load('text/document');
const base = () => d.addText(d.emptyTextDocument(), { width: 1200, height: 900 }, '#FFFFFF', 'title');
const rich = runs => d.updateText(base(), 'title', { content: runs.map(run => run.text).join(''), runs });

test('typography retains old defaults and validates finite line height, tracking and case', () => {
  const doc = base();
  for (const patch of [{ lineHeight: NaN }, { lineHeight: 0 }, { letterSpacing: Infinity }, { textTransform: 'capitalize' }]) {
    assert.throws(() => d.updateText(doc, 'title', patch), /line|spacing|transform|case/i);
  }
  const layer = d.updateText(doc, 'title', { lineHeight: 1.05, letterSpacing: 2, textTransform: 'uppercase' }).layers[0];
  assert.equal(layer.lineHeight, 1.05); assert.equal(layer.letterSpacing, 2); assert.equal(layer.textTransform, 'uppercase');
  assert.equal(doc.layers[0].lineHeight, undefined);
});

test('rich runs normalize equivalent neighbors and derive a read-only legacy projection', () => {
  const doc = rich([{ text: 'Hello ', weight: 700 }, { text: 'world', weight: 700 }, { text: '' }]);
  assert.equal(doc.layers[0].runs.length, 1);
  assert.equal(doc.layers[0].content, 'Hello world');
  assert.throws(() => { doc.layers[0].content = 'independently changed'; }, TypeError);
  assert.throws(() => { doc.layers[0].runs[0].text = 'changed'; }, TypeError);
  assert.equal(plain(doc).layers[0].content, 'Hello world');
  assert.throws(() => d.validateText({ ...plain(doc).layers[0], content: 'stale' }), /projection|runs|content/i);
});

test('run schema rejects unsupported styles and counts projected Unicode against the existing limit', () => {
  for (const run of [{ text: 'A', color: 'red' }, { text: 'A', highlightColor: 'url(x)' }, { text: 'A', font: 'unknown' }, { text: 'A', font: null }, { text: 'A', italic: null }, { text: 'A', font: 'gelasio', weight: 800 }, { text: 'A', italic: true }, { text: 'A', fontSize: 99 }]) {
    assert.throws(() => rich([run]), /run|font|color|style/i);
  }
  assert.equal(rich([{ text: '😀'.repeat(1000) }]).layers[0].content.length, 2000);
  assert.throws(() => rich([{ text: '😀'.repeat(1001) }]), /1000/);
});

test('content patches preserve emphasis for Chinese insertion and Unicode replacement without fragmentation', () => {
  const original = rich([{ text: 'Try ' }, { text: '更好😀体验', color: '#FF0000', highlightColor: '#FFFFFF' }, { text: ' now' }]);
  const changed = d.updateText(original, 'title', { content: 'Try 更好中文😀体验 now' });
  assert.deepEqual(plain(changed.layers[0].runs), [{ text: 'Try ' }, { text: '更好中文😀体验', color: '#FF0000', highlightColor: '#FFFFFF' }, { text: ' now' }]);
  const replaced = d.updateText(changed, 'title', { content: 'Try 更好🧑‍💻体验 now' });
  assert.equal(replaced.layers[0].runs[1].text, '更好🧑‍💻体验');
  assert.equal(replaced.layers[0].runs[1].color, '#FF0000');
  const deleted = d.updateText(replaced, 'title', { content: 'Try更好🧑‍💻体验 now' });
  assert.equal(deleted.layers[0].runs[0].text, 'Try');
  assert.equal(deleted.layers[0].runs[1].text, '更好🧑‍💻体验');
  assert.equal(original.layers[0].content, 'Try 更好😀体验 now');
});

test('explicit replacement ranges preserve which identical styled character was deleted or inserted', () => {
  const doc = rich([{ text: 'a', color: '#FF0000' }, { text: 'a', color: '#0000FF' }]);
  const edit = (content, start, end) => plain(d.updateText(doc, 'title', { content }, { start, end }).layers[0].runs);
  assert.deepEqual(edit('a', 0, 1), [{ text: 'a', color: '#0000FF' }], 'deleting FIRST a retains blue');
  assert.deepEqual(edit('a', 1, 2), [{ text: 'a', color: '#FF0000' }], 'deleting SECOND a retains red');
  assert.deepEqual(edit('aaa', 0, 0), [{ text: 'aa', color: '#FF0000' }, { text: 'a', color: '#0000FF' }]);
  assert.deepEqual(edit('aaa', 2, 2), [{ text: 'a', color: '#FF0000' }, { text: 'aa', color: '#0000FF' }]);
  assert.deepEqual(edit('a中', 1, 2), [{ text: 'a', color: '#FF0000' }, { text: '中', color: '#0000FF' }]);
  assert.deepEqual(plain(d.updateText(doc, 'title', { content: 'a' }).layers[0].runs), [{ text: 'a', color: '#FF0000' }], 'programmatic callers retain deterministic fallback');
  const emoji = rich([{ text: '😀', color: '#FF0000' }, { text: '😀', color: '#0000FF' }]);
  assert.deepEqual(plain(d.updateText(emoji, 'title', { content: '😀' }, { start: 0, end: 2 }).layers[0].runs), [{ text: '😀', color: '#0000FF' }]);
  assert.throws(() => d.replaceTextContent(emoji.layers[0], '😀', { start: 1, end: 2 }), /Unicode/);
});

test('composition keeps its original replacement range across intermediate browser changes', () => {
  const doc = rich([{ text: 'a', color: '#FF0000' }, { text: 'a', color: '#0000FF' }]);
  for (const [start, end, expected] of [[0, 1, [{ text: 'a', color: '#FF0000' }, { text: 'a', color: '#0000FF' }]], [1, 2, [{ text: 'a', color: '#FF0000' }, { text: 'a', color: '#0000FF' }]]]) {
    const h = editorHarness(doc); h.api.edit('title'); h.render();
    h.api.change('aa', true, { start, end }); h.render();
    h.api.change(start === 0 ? 'zhonga' : 'azhong'); h.render();
    h.api.change(start === 0 ? '中a' : 'a中', false); h.render();
    const runs = plain(h.doc.layers[0].runs);
    assert.equal(runs[start].color, expected[start].color);
    assert.equal(runs[start].text, '中');
    assert.equal(h.calls, 1); h.api.finish(); assert.deepEqual(plain(h.undo), plain(doc));
  }
  const h = editorHarness(doc); h.api.edit('title'); h.render();
  h.api.change('aa', true, { start: 0, end: 0 }); h.render();
  h.api.change('zhongaa'); h.render(); h.api.change('aaa', false); h.render();
  assert.deepEqual(plain(h.doc.layers[0].runs), [{ text: 'aa', color: '#FF0000' }, { text: 'a', color: '#0000FF' }]);
});

test('range emphasis uses textarea UTF-16 offsets and never splits a surrogate pair', () => {
  assert.equal(typeof d.emphasizeTextRange, 'function');
  const doc = d.updateText(base(), 'title', { content: 'A😀中文B' });
  const next = d.emphasizeTextRange(doc, 'title', 2, 4, { weight: 800 });
  assert.deepEqual(plain(next.layers[0].runs), [{ text: 'A' }, { text: '😀中', weight: 800 }, { text: '文B' }]);
  const joined = d.emphasizeTextRange(next, 'title', 4, 5, { weight: 800 });
  assert.deepEqual(plain(joined.layers[0].runs), [{ text: 'A' }, { text: '😀中文', weight: 800 }, { text: 'B' }]);
  assert.equal(d.emphasizeTextRange(doc, 'title', 3, 3, { weight: 800 }), doc);
  assert.throws(() => d.emphasizeTextRange(doc, 'title', 0, 1, { text: 'changed' }), /style/i);
});

function editorHarness(initial) {
  const slots = [], effects = []; let cursor = 0, snapshot = { textDocument: initial }, api, calls = 0, start, undo;
  const input = { selectionStart: 4, selectionEnd: 6, focus() {}, setSelectionRange() {} };
  const react = { useRef(value) { return slots[cursor++] ??= { current: value }; }, useState(value) { const at = cursor++; slots[at] ??= { value }; return [slots[at].value, value => { slots[at].value = typeof value === 'function' ? value(slots[at].value) : value; }]; }, useEffect(fn) { cursor++; effects.push(fn); } };
  const hook = load('text/useCanvasTextEditor', { react });
  const history = { beginTransaction(value) { start = value; }, commitTransaction() { undo = start; }, cancelTransaction() { snapshot = start; } };
  const root = { current: { querySelector: () => input } };
  const render = () => { cursor = 0; effects.length = 0; api = hook.useCanvasTextEditor(snapshot, doc => { calls++; snapshot = { ...snapshot, textDocument: doc }; }, { width: 1200, height: 900 }, history, root); effects.forEach(fn => fn()); return api; };
  render();
  return { render, get api() { return api; }, get doc() { return snapshot.textDocument; }, get calls() { return calls; }, get undo() { return undo?.textDocument; }, input };
}

test('D06b: composition events apply final Chinese once, keep emphasis, and undo restores exact runs', () => {
  const original = rich([{ text: 'Try ' }, { text: '更好体验', weight: 800 }, { text: ' now' }]);
  const h = editorHarness(original); h.api.edit('title'); h.render();
  h.api.change('Try 更好体验 now', true); h.render();
  for (const draft of ['Try 更好z体验 now', 'Try 更好zhong体验 now', 'Try 更好中文体验 now']) { h.api.change(draft); h.render(); }
  assert.equal(h.calls, 0); assert.equal(h.api.finish(), false);
  h.api.change('Try 更好中文体验 now', false); h.render();
  h.api.change('Try 更好中文体验 now'); h.render();
  assert.equal(h.calls, 1, 'compositionend followed by browser input must apply only once');
  assert.equal(h.doc.layers[0].content, 'Try 更好中文体验 now');
  assert.deepEqual(plain(h.doc.layers[0].runs), [{ text: 'Try ' }, { text: '更好中文体验', weight: 800 }, { text: ' now' }]);
  assert.equal(h.api.finish(), true);
  assert.deepEqual(plain(h.undo), plain(original));
});

test('rich composing drafts retain all over-limit codepoints for recovery without changing the document', () => {
  const original = rich([{ text: '中文', weight: 800 }]);
  const draft = '😀'.repeat(1001);
  assert.equal(d.replaceTextContent(original.layers[0], draft).map(run => run.text).join(''), draft, 'transient rich visual must not truncate or crash');
  const h = editorHarness(original); h.api.edit('title'); h.render(); h.api.change(draft, true); h.render();
  assert.equal(h.api.session.value, draft); assert.equal(h.calls, 0);
  h.api.change(draft, false); h.render();
  assert.match(h.api.session.error, /1000/); assert.deepEqual(plain(h.doc), plain(original));
});

test('selection toolbar applies through the current edit transaction without losing its range', () => {
  const original = d.updateText(base(), 'title', { content: 'Try 中文 now' });
  const h = editorHarness(original); h.api.edit('title'); h.render();
  assert.equal(typeof h.api.emphasize, 'function');
  h.api.emphasize({ color: '#FF0000' }); h.render();
  assert.equal(h.api.editingId, 'title');
  assert.deepEqual(plain(h.doc.layers[0].runs), [{ text: 'Try ' }, { text: '中文', color: '#FF0000' }, { text: ' now' }]);
  h.api.finish(); assert.deepEqual(plain(h.undo), plain(original));
});

test('native rich historyUndo and historyRedo restore exact run snapshots while global history stays grouped', () => {
  const original = rich([{ text: 'a', color: '#FF0000' }, { text: 'a', color: '#0000FF' }]);
  const h = editorHarness(original); h.api.edit('title'); h.render();
  h.api.change('a', false, { start: 0, end: 1 }, 'deleteContentForward'); h.render();
  const deleted = plain(h.doc);
  h.api.change('aa', false, undefined, 'historyUndo'); h.render(); assert.deepEqual(plain(h.doc), plain(original));
  h.api.change('a', false, undefined, 'historyRedo'); h.render(); assert.deepEqual(plain(h.doc), deleted);
  h.api.finish(); assert.deepEqual(plain(h.undo), plain(original));
});

test('preview and editor presentation share typography and per-run visual styles', () => {
  const p = load('text/textPresentation');
  assert.equal(typeof p.textLayoutStyle, 'function');
  assert.equal(p.textLayoutStyle(base().layers[0]).lineHeight, 1.25);
  assert.equal(p.textLayoutStyle(base().layers[0]).letterSpacing, 'normal');
  const layer = d.updateText(rich([{ text: 'Hello ', font: 'gelasio', italic: true, weight: 600, color: '#FF0000', highlightColor: '#FFFFFF' }]), 'title', { lineHeight: 1.1, letterSpacing: 3, textTransform: 'uppercase' }).layers[0];
  assert.equal(p.textLayoutStyle(layer).lineHeight, 1.1);
  assert.equal(p.textLayoutStyle(layer).letterSpacing, 3);
  assert.equal(p.textLayoutStyle(layer).textTransform, 'uppercase');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { CanvasTextLayerRenderer } = load('text/CanvasTextLayerRenderer');
  const html = renderToStaticMarkup(require('react').createElement(CanvasTextLayerRenderer, { document: { version: 1, layers: [layer] }, size: { width: 1200, height: 900 } }));
  assert.match(html, /letter-spacing:3px/); assert.match(html, /line-height:1.1/); assert.match(html, /text-transform:uppercase/);
  assert.match(html, /font-family:&quot;Poster Gelasio&quot;/); assert.match(html, /background-image:linear-gradient\(transparent 72%, #FFFFFF 72%/); assert.match(html, /box-decoration-break:clone/);
});
