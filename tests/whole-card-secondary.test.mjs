import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const api=load('composition/designedCatalog.ts');
const {EditorHistory}=load('editorHistory.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const fixture=name=>JSON.parse(fs.readFileSync(new URL(`./fixtures/whole-card/v1-${name}-snapshot.json`,import.meta.url)));
const baked=['detail-label','detail-status','detail-heading'];
test('v2 has two canonical screenshot sources and eight editable poster roles',()=>{
  const before=fixture('neutral'),copy=plain(before),next=api.buildDesignedSnapshot(before,'editorial-honey','v2');
  assert.equal(next.templateContext.version,2);assert.equal(next.compositionDocument.version,1);
  assert.deepEqual(plain(next.compositionDocument.placements),{main:plain(api.logicalFrame(560,275,980,780,-3)),secondary:plain(api.logicalFrame(80,798,450,290))});
  for(const [key,value] of Object.entries({detailVisible:true,detailFit:'contain',detailRadius:0,detailBorder:'none',detailShadow:'none'}))assert.equal(next.compositionDocument[key],value);
  assert.equal(next.secondarySrc,'/designed/examples/bloom-workflow-card.png');assert.equal(next.secondaryName,'bloom-workflow-card.png');assert.deepEqual(plain(next.secondaryMediaOrigin),{kind:'builtin',sampleId:'bloom-workflow-card'});
  assert.equal(next.textDocument.layers.length,8);assert.equal(Object.keys(next.templateContext.textRoles).length,8);
  assert.ok(!next.compositionDocument.decorations.some(n=>n.id==='detail-panel'));
  for(const role of baked){assert.equal(next.templateContext.textRoles[role],undefined);assert.ok(!next.textDocument.layers.some(n=>n.id.endsWith('-'+role)));assert.ok(!next.compositionDocument.order.some(id=>id.endsWith('-'+role)));}
  for(const role of Object.keys(next.templateContext.textRoles)){const previous=before.textDocument.layers.find(l=>l.id===before.templateContext.textRoles[role]),actual=next.textDocument.layers.find(l=>l.id===next.templateContext.textRoles[role]);assert.deepEqual({...plain(actual),id:previous.id},previous);}
  assert.deepEqual(plain(before),copy);
});
test('apply preserves user/unknown screenshots and can undo as one transaction',()=>{
  for(const kind of ['user','unknown']){
    const before=fixture('customized');before.secondaryMediaOrigin={kind};const copy=plain(before);
    const history=new EditorHistory(before);history.beginTransaction(before);const next=api.buildDesignedSnapshot(before,'editorial-honey','new');history.updateTransaction(next);history.commitTransaction(next);
    for(const key of ['secondarySrc','secondaryName','secondaryMediaOrigin','imageSrc','primaryMediaOrigin'])assert.deepEqual(plain(next[key]),plain(before[key]));
    assert.deepEqual(plain(history.undo(next)),copy);assert.deepEqual(plain(history.redo()),plain(next));assert.deepEqual(before,copy);
  }
});
for(const version of [1,2])test(`restore and reset use v${version} geometry without changing content or deleted nodes`,()=>{
  const before=version===1?fixture('customized'):api.buildDesignedSnapshot(fixture('customized'),'editorial-honey','v2');
  const original=plain(before);before.compositionDocument.placements.secondary.centerX=.9;before.compositionDocument.detailRadius=42;
  before.compositionDocument.objects=before.compositionDocument.objects.filter(n=>n.id!=='brand-mark');
  const custom={...before.compositionDocument.objects[0],id:'user-button',text:'Mine'};before.compositionDocument.objects.push(custom);
  before.textDocument.layers.push({...before.textDocument.layers[0],id:'custom-text',content:'My own',centerX:.9});
  const deleted=before.templateContext.textRoles.credit;before.textDocument.layers=before.textDocument.layers.filter(n=>n.id!==deleted);
  const copy=plain(before),restored=api.restoreDesignedLayout(before),reset=api.resetDesignedStyles(before);
  assert.deepEqual(plain(restored.compositionDocument.placements.secondary),version===1?original.compositionDocument.placements.secondary:plain(api.logicalFrame(80,798,450,290)));
  assert.equal(reset.compositionDocument.detailRadius,version===1?original.compositionDocument.detailRadius:0);
  for(const next of [restored,reset]){
    assert.equal(next.templateContext.version,version);assert.deepEqual(plain(next.templateContext),copy.templateContext);
    assert.deepEqual(next.textDocument.layers.map(n=>[n.id,n.content]),before.textDocument.layers.map(n=>[n.id,n.content]));
    assert.equal(next.textDocument.layers.find(n=>n.id==='custom-text').centerX,.9);
    assert.ok(!next.compositionDocument.objects.some(n=>n.id==='brand-mark'));assert.deepEqual(plain(next.compositionDocument.objects.find(n=>n.id==='user-button')),plain(custom));
    for(const key of ['secondarySrc','secondaryName','secondaryMediaOrigin','imageSrc','primaryMediaOrigin'])assert.deepEqual(plain(next[key]),copy[key]);
  }
  if(version===1)for(const role of baked)assert.equal(restored.textDocument.layers.find(n=>n.id===before.templateContext.textRoles[role]).content,original.textDocument.layers.find(n=>n.id===before.templateContext.textRoles[role]).content);
  assert.deepEqual(plain(before),copy);
});
