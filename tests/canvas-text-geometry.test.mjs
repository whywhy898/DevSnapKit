import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
async function load(name) {
  const output = ts.transpileModule(fs.readFileSync(new URL(`../src/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}
test('commit identity survives undo, redo and limits; conditional undo never removes a later edit', async () => {
  const { EditorHistory } = await load('editorHistory');
  const h = new EditorHistory({ value: 0 }, 3);
  h.flush({ value: 1 }); const first = h.currentCommitId;
  assert.equal(typeof first, 'number');
  h.beginTransaction(h.current); h.commitTransaction(h.current);
  assert.equal(h.currentCommitId, first);
  h.flush({ value: 2 }); const second = h.currentCommitId;
  assert.notEqual(first, second);
  assert.equal(h.undoCommit(first, h.current), null);
  assert.equal(h.undoCommit(second, { value: 3 }), null);
  assert.deepEqual(h.undoCommit(second, h.current), { value: 1 });
  h.redo(); assert.equal(h.currentCommitId, second);
  h.undo(h.current); h.flush({ value: 4 }); assert.ok(h.currentCommitId > second);
  for (let value = 5; value < 10; value++) h.flush({ value });
  assert.equal(h.count, 3); assert.ok(h.currentCommitId > second);
});
test('logical numeric geometry rejects drafts without clamping and width resize keeps opposite edge', async () => {
  const g = await load('text/geometry');
  const size = { width: 1600, height: 1200 }, layer = { centerX: .5, centerY: .5, widthRatio: .3 };
  assert.deepEqual(g.geometryPatch('x', '880', size), { centerX: .55 });
  assert.deepEqual(g.geometryPatch('width', '64', size), { widthRatio: .04 });
  for (const value of ['', 'NaN', 'Infinity', '-1', '1601']) assert.throws(() => g.geometryPatch('x', value, size));
  assert.throws(() => g.geometryPatch('width', '63', size));
  assert.deepEqual(g.resizeTextByScreenDelta(layer, 40, 'right', .5, size), { centerX: .525, widthRatio: .35 });
  assert.deepEqual(g.resizeTextByScreenDelta(layer, -40, 'left', .5, size), { centerX: .475, widthRatio: .35 });
});
test('scroll overflow extends from the centered offset origin rather than a symmetric maximum height', async () => {
  const { textBoxIssue } = await load('text/geometry');
  const layer = { content: 'I', centerX: .5, centerY: .5, widthRatio: .8 };
  assert.match(textBoxIssue(layer, { width: 200, height: 210 }, 209, 200), /outside/);
  assert.equal(textBoxIssue({ ...layer, centerY: 100 / 210 }, { width: 200, height: 210 }, 209, 200), null);
  assert.equal(textBoxIssue(layer, { width: 200, height: 210 }, 200), null, 'Legacy three-argument callers retain symmetric box semantics');
});
test('native horizontal fragments extend beyond either side of the nominal text box', async () => {
  const { textBoxIssue, textHorizontalExtent } = await load('text/geometry');
  const size = { width: 200, height: 400 }, layer = { content: 'W', centerX: .75, centerY: .5, widthRatio: .32 };
  assert.equal(textBoxIssue(layer, size, 200), null);
  assert.match(textBoxIssue(layer, size, 200, 200, { left: 0, right: 156 }), /outside/);
  assert.match(textBoxIssue({ ...layer, centerX: .25 }, size, 200, 200, { left: -92, right: 64 }), /outside/);
  assert.equal(textBoxIssue({ ...layer, centerX: .5 }, size, 200, 200, { left: -46, right: 110 }), null);
  // Contract coverage for browser-provided negative fragments, not a claim that
  // the production Chromium fixture generates negative overflow for its W.
  let selected;
  const node = { getBoundingClientRect: () => ({ left: 100, width: 32 }), ownerDocument: { createRange: () => ({
    selectNodeContents: value => { selected = value; }, getClientRects: () => [{ left: 77, right: 155 }],
  }) } };
  assert.deepEqual(textHorizontalExtent(node, .5), { left: -46, right: 110 });
  assert.equal(selected, node);
});
test('canonical dimensions preserve prior Auto, preset, custom and 2K/4K semantics', async () => {
  const { getCanonicalDimensions: size } = await load('canvasDimensions');
  assert.deepEqual(size('auto', 1, 999, 111, 1600, 1200), { width: 1600, height: 1200 });
  assert.deepEqual(size('auto', 1, 999, 111), { width: 1200, height: 776 });
  assert.deepEqual(size('custom', 2, 0, 0, 100, 200, 1600, 1200), { width: 3200, height: 2400 });
  assert.deepEqual(size('custom', 4, 0, 0, 100, 200, 1200, 1600), { width: 2880, height: 3840 });
  for (const [id, base, twice, ultra] of [['og',[1200,630],[2400,1260],[3840,2016]], ['16-9',[1920,1080],[2560,1440],[3840,2160]], ['4-3',[1200,900],[2400,1800],[3200,2400]], ['1-1',[1080,1080],[2160,2160],[3840,3840]], ['ig-post',[1080,1350],[2160,2700],[3072,3840]], ['ig-story',[1080,1920],[2160,3840],[2160,3840]], ['linkedin',[1200,627],[2400,1254],[3840,2006]], ['youtube',[1280,720],[2560,1440],[3840,2160]]]) {
    for (const [scale, expected] of [[1,base],[2,twice],[4,ultra]]) assert.deepEqual(size(id, scale, 0, 0), { width: expected[0], height: expected[1] });
  }
});
test('history compares immutable JSON values without key-order or optional-property no-op commits', async () => {
  const { EditorHistory }=await load('editorHistory');
  const original={image:'data:image/png;base64,'+'ABC'.repeat(100000),doc:{layers:[{id:'a',content:'Hi',style:{size:48,color:'#FFFFFF'}}]},optional:undefined};
  const equivalent={doc:{layers:[{style:{color:'#FFFFFF',size:48},content:'Hi',id:'a'}]},image:original.image};
  const h=new EditorHistory(original);assert.equal(h.equal(original,equivalent),true);
  h.flush({...original,image:'other'});const latest=h.currentCommitId;h.undo(h.current);assert.equal(h.canRedo,true);
  h.beginTransaction(equivalent);h.commitTransaction(equivalent);assert.equal(h.canRedo,true);assert.equal(h.count,2);
  h.redo();assert.equal(h.currentCommitId,latest);
  assert.equal(h.equal([undefined,NaN,Infinity],[null,null,null]),true);
  assert.equal(h.equal({value:null},{}),false);assert.equal(h.equal([1,2],[2,1]),false);
  assert.equal(h.equal({...original,doc:{layers:[{id:'a',content:'Changed',style:{size:48,color:'#FFFFFF'}}]}},original),false);
});
