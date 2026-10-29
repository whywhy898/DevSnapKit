import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const file = new URL('../src/inspector/model.ts', import.meta.url);
const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const module = { exports: {} };
if (source) vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, Set, Array });
const api = module.exports;
const texts = { layers: [{ id: 'headline', content: '😀'.repeat(40) }, { id: 'empty', content: '' }] };
const doc = { mediaLayout: 'independent', detailVisible: true, hiddenIds: ['secondary', 'empty'], order: ['main', 'secondary', 'headline'], objects: [{ id: 'cta', kind: 'button', name: 'Button' }, { id: 'logo', kind: 'shape', shape: 'mark', name: 'Mark' }], decorations: [{ id: 'line', kind: 'shape', shape: 'line', name: 'Rule' }] };
test('selection routes image, text, button, decoration and mark to the five existing panes', () => {
  assert.equal(typeof api.inspectorTabFor, 'function');
  for (const [id, tab] of [['main','style'],['secondary','style'],['headline','text'],['empty','text'],['cta','text'],['line','text'],['logo','brand']]) assert.equal(api.inspectorTabFor(id, texts, doc), tab);
});
test('one slot resolver lists independent detail even in single layout and counts real sources', () => {
  assert.equal(typeof api.resolveImageSlots, 'function');
  const slots = api.resolveImageSlots(doc, 'single', 'main.png', null);
  assert.deepEqual(Array.from(slots, slot => slot.id), ['main', 'secondary']);
  assert.equal(slots.filter(slot => slot.loaded).length, 1);
  assert.equal(api.resolveImageSlots({ ...doc, detailVisible: false }, 'duo', 'x', 'y').length, 1);
  assert.equal(api.resolveImageSlots(null, 'duo', 'x', 'y').length, 2);
});
test('Elements preserves hidden, empty and overlapping objects with semantic Unicode previews', () => {
  assert.equal(typeof api.elementItems, 'function');
  const items = api.elementItems(doc, texts, { textRoles: { headline: 'headline' } });
  assert.equal(new Set(items.map(x => x.id)).size, 7);
  const headline = items.find(x => x.id === 'headline');
  assert.equal(headline.label, 'Headline');
  assert.equal(Array.from(headline.preview).length, 24);
  assert.equal(headline.title.includes('😀'.repeat(40)), true);
  assert.equal(headline.selectionLabel, 'Select Headline: ' + '😀'.repeat(40));
  assert.equal(items.find(x => x.id === 'empty').label, 'Text');
  assert.equal(items.find(x => x.id === 'empty').hidden, true);
  assert.equal(items.find(x => x.id === 'secondary').hidden, true);
});
