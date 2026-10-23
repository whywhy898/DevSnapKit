import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function load(name) {
  const url = new URL(`../src/${name}.ts`, import.meta.url);
  assert.ok(fs.existsSync(url), `${name} must implement the approved text document behavior`);
  const output = ts.transpileModule(fs.readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('initial text color chooses the greater WCAG contrast only for solid backgrounds', async () => {
  const d = await load('text/document');
  assert.equal(typeof d.initialTextColor, 'function', 'Initial color must use a testable contrast calculation');
  assert.equal(d.initialTextColor('solid', '#999999'), '#111827');
  assert.equal(d.initialTextColor('solid', '#FFFFFF'), '#111827');
  assert.equal(d.initialTextColor('solid', '#000000'), '#FFFFFF');
  assert.equal(d.initialTextColor('solid', '#6366F1'), '#FFFFFF');
  for (const type of ['gradient', 'transparent', 'pattern', 'image']) assert.equal(d.initialTextColor(type, '#FFFFFF'), '#FFFFFF');
});

test('text document validates codepoints, fonts, finite geometry and object limits without truncating', async () => {
  const d = await load('text/document');
  let doc = d.emptyTextDocument();
  for (let i = 0; i < 20; i++) doc = d.addText(doc, { width: 1600, height: 1200 }, '#ffffff', `id-${i}`);
  assert.equal(doc.layers.length, 20);
  assert.throws(() => d.addText(doc, { width: 1600, height: 1200 }, '#ffffff', 'extra'), /20/);
  assert.equal(doc.layers.length, 20);
  const id = doc.layers[0].id;
  doc = d.updateText(doc, id, { content: '😀'.repeat(1000) });
  assert.equal(Array.from(doc.layers[0].content).length, 1000);
  assert.throws(() => d.updateText(doc, id, { content: '😀'.repeat(1001) }), /1000/);
  assert.throws(() => d.updateText(doc, id, { centerX: NaN }), /finite|position/i);
  assert.throws(() => d.updateText(doc, id, { widthRatio: Infinity }), /finite|width/i);
  assert.throws(() => d.updateText(doc, id, { font: 'gelasio', weight: 800 }), /font|weight/i);
  assert.throws(() => d.updateText(doc, id, { font: 'manrope', italic: true }), /font|italic/i);
  assert.throws(() => d.updateText(doc, id, { color: 'url(evil)' }), /color/i);
  assert.equal(d.updateText(doc, id, { content: '\n ' }).layers[0].content, '\n ');
  const mapped = d.changeTextFont({ ...doc.layers[0], weight: 800 }, 'gelasio');
  assert.equal(mapped.weight, 700);
  assert.equal(d.changeTextFont({ ...mapped, italic: true }, 'manrope').italic, false);
  assert.equal(d.deleteText(doc, id).layers.some(x => x.id === id), false);
});

test('text logical position, width and layout bounds are stable', async () => {
  const g = await load('text/geometry');
  const next = g.moveTextByScreenDelta({ centerX: 0.5, centerY: 0.5 }, { x: 40, y: 20 }, { previewScale: 0.5, canvasWidth: 1600, canvasHeight: 1200 });
  assert.equal(next.centerX, 0.55);
  assert.ok(Math.abs(next.centerY - (0.5 + 40 / 1200)) < 1e-9);
  assert.throws(() => g.moveTextByScreenDelta(next, { x: 1, y: 1 }, { previewScale: 0, canvasWidth: 1600, canvasHeight: 1200 }));
  assert.equal(g.textBoxIssue({ centerX: 0.5, centerY: 0.5, widthRatio: 0.3, content: 'Title' }, { width: 1600, height: 1200 }, 60), null);
  assert.match(g.textBoxIssue({ centerX: 0.5, centerY: 0.98, widthRatio: 0.3, content: 'Title' }, { width: 1600, height: 1200 }, 100), /outside/i);
  assert.equal(g.textBoxIssue({ centerX: 0.5, centerY: 0.98, widthRatio: 0.3, content: ' ' }, { width: 1600, height: 1200 }, 100), null);
});

test('new text uses available space without moving existing text and handles a full small canvas', async () => {
  const d = await load('text/document');
  const size = { width: 1600, height: 1200 };
  const one = d.addText(d.emptyTextDocument(), size, '#FFFFFF', 'first');
  const tall = d.updateText(one, 'first', { content: 'One\nTwo\nThree', fontSize: 80 });
  const two = d.addText(tall, size, '#FFFFFF', 'second');
  assert.deepEqual(two.layers[0], tall.layers[0]);
  assert.ok(Math.abs(two.layers[1].centerY - tall.layers[0].centerY) * size.height >= 180, 'New line box must clear the multiline box');
  const measured = d.addText(one, size, '#FFFFFF', 'measured', [{ left: 0, top: 0, width: 1600, height: 600 }]);
  assert.ok(measured.layers[1].centerY * size.height >= 646, 'Real measured occupancy overrides nominal line count');
  let crowded = d.emptyTextDocument();
  for (let i = 0; i < 20; i++) crowded = d.addText(crowded, { width: 200, height: 200 }, '#FFFFFF', 'text-' + i);
  assert.equal(crowded.layers.length, 20);
  assert.ok(crowded.layers.every(l => l.centerX >= 0 && l.centerX <= 1 && l.centerY >= .15 && l.centerY <= .85));
});

test('whole editor history flushes mixed values, groups updates, preserves redo for no-ops and cancels', async () => {
  const { EditorHistory } = await load('editorHistory');
  const original = { gradientId: 'a', textDocument: { layers: [] }, position: 0 };
  const h = new EditorHistory(original, 50);
  h.flush({ ...original, gradientId: 'b' });
  h.beginTransaction(h.current);
  h.commitTransaction({ ...h.current, textDocument: { layers: [{ id: 'one', content: 'Hi' }] } });
  const start = h.current;
  h.beginTransaction(start);
  for (let i = 1; i <= 100; i++) h.updateTransaction({ ...start, position: i });
  h.commitTransaction({ ...start, position: 100 });
  assert.equal(h.undo(h.current).position, 0);
  assert.deepEqual(h.undo(h.current).textDocument.layers, []);
  assert.equal(h.undo(h.current).gradientId, 'a');
  h.beginTransaction(h.current); h.commitTransaction(h.current);
  assert.equal(h.canRedo, true);
  h.beginTransaction(h.current); h.updateTransaction({ ...original, position: 99 }); h.cancelTransaction();
  assert.equal(h.canRedo, true);
  h.redo(); h.redo(); h.redo();
  assert.equal(h.current.position, 100);
  for (let n = 101; n <= 105; n++) h.flush({ ...h.current, position: n });
  for (let n = 0; n < 5; n++) h.undo(h.current);
  for (let n = 0; n < 5; n++) h.redo();
  assert.equal(h.current.position, 105);
  h.undo(h.current); h.flush({ ...h.current, position: 999 });
  assert.equal(h.canRedo, false);
  for (let n = 0; n < 100; n++) h.flush({ ...h.current, position: n });
  assert.equal(h.count, 50);
});

test('undo flushes pending changes before stepping backwards and no-op redo remains available', async () => {
  const { EditorHistory } = await load('editorHistory');
  const h = new EditorHistory({ background: 'a', text: '' });
  const pending = { background: 'b', text: '' };
  assert.deepEqual(h.undo(pending), { background: 'a', text: '' });
  assert.deepEqual(h.redo(), pending);
  h.beginTransaction(pending);
  assert.deepEqual(h.cancelTransaction(), pending);
});
