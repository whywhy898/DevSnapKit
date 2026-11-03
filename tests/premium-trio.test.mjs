import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createTypeScriptLoader} from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const {buildCuratedSnapshot,restoreCuratedLayout,resetCuratedStyles}=load('templates/collection/apply.ts');
const {CURATED_TEMPLATE_CATALOG:catalog}=load('templates/collection/catalog.ts');
const {EditorHistory}=load('editorHistory.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const configs=[['violet-launch',1920,1080],['electric-pair',1920,1080],['peach-editorial',1080,1350]];
const user={imageSrc:'data:image/png;base64,main',imageName:'My main',primaryMediaOrigin:{kind:'user'},secondarySrc:'data:image/png;base64,secondary',secondaryName:'My second',secondaryMediaOrigin:{kind:'user'},textDocument:{version:1,layers:[]},customBrandWatermark:'Own brand',logoDataUrl:'own-logo',qrUrl:'https://own.example',windowTitle:'My title'};
for(const [id,width,height] of configs){
 test(id+' applies native editable composition and preserves original media and brand',()=>{
  const before=structuredClone(user),next=buildCuratedSnapshot(before,id,'trio');
  assert.deepEqual(before,user);assert.deepEqual(plain(next.customCanvasSize),{width,height});
  for(const key of Object.keys(user).filter(k=>k!=='textDocument'))assert.deepEqual(plain(next[key]),plain(user[key]),key);
  assert.equal(next.compositionDocument.templateId,id);assert.equal(next.compositionDocument.adaptiveMediaLayout,'auto');
  assert.equal(next.compositionDocument.detailVisible,true);assert.equal(next.bgImageSrc,null);
  assert.ok(next.textDocument.layers.length>=4);assert.ok(next.compositionDocument.decorations.length>=2);
  assert.equal(next.compositionDocument.objects.some(n=>n.kind==='button'),false,'No decorative CTA');
  assert.ok(next.compositionDocument.singlePlacement);
  assert.equal(new Set(next.textDocument.layers.map(n=>n.id)).size,next.textDocument.layers.length);
  for(const role of ['headline','description'])assert.ok(next.textDocument.layers.some(n=>n.id===next.templateContext.textRoles[role]));
  assert.equal(next.isProUnlocked,undefined);
 });
 test(id+' is one reversible history entry; restore and reset keep edits and hidden media',()=>{
  const history=new EditorHistory(user),next=buildCuratedSnapshot(user,id,'trio');history.flush(next);
  assert.deepEqual(plain(history.undo(next)),user);assert.deepEqual(plain(history.redo()),plain(next));
  const headline=next.textDocument.layers.find(n=>n.id===next.templateContext.textRoles.headline);
  headline.content='用户自己的标题 / My product';
  next.compositionDocument.detailVisible=false;next.compositionDocument.placements.main.centerX=.3;
  next.compositionDocument.decorations[0].fill='#112233';next.compositionDocument.decorations[0].hidden=true;
  const saved=plain(next),restored=restoreCuratedLayout(next),reset=resetCuratedStyles(next);
  assert.deepEqual(plain(next),saved);
  for(const n of [restored,reset]){
   assert.equal(n.imageSrc,user.imageSrc);assert.equal(n.secondarySrc,user.secondarySrc);
   assert.equal(n.compositionDocument.detailVisible,false);
   assert.equal(n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles.headline).content,headline.content);
   assert.equal(n.compositionDocument.decorations[0].hidden,true);
  }
  assert.equal(restored.compositionDocument.decorations[0].fill,'#112233');
  assert.equal(reset.compositionDocument.placements.main.centerX,.3);
 });
 test(id+' loads two distinct local samples only for a demo; a hidden or missing user secondary stays absent',()=>{
  const demo=buildCuratedSnapshot({...user,imageSrc:null,secondarySrc:null},id,'demo');
  assert.notEqual(demo.imageSrc,demo.secondarySrc);
  for(const key of ['imageSrc','secondarySrc']){
   assert.match(demo[key],/^\/designed\/examples\/collection\//);
   assert.ok(fs.existsSync(new URL('../public'+demo[key],import.meta.url)));
  }
  assert.equal(demo.primaryMediaOrigin.kind,'builtin');assert.equal(demo.secondaryMediaOrigin.kind,'builtin');
  const single=buildCuratedSnapshot({...user,secondarySrc:null},id,'single');
  assert.equal(single.secondarySrc,null);assert.equal(single.compositionDocument.detailVisible,false);
  const hidden=buildCuratedSnapshot({...user,compositionDocument:{detailVisible:false,hiddenIds:['secondary']}},id,'hidden');
  assert.equal(hidden.secondarySrc,user.secondarySrc);assert.equal(hidden.compositionDocument.detailVisible,false);
 });
}
test('the three additions preserve the complete original catalog and published tiers',()=>{
 const originals=['editorial-honey','paper-launch-duo','calm-split','app-pair','night-signal-duo','pocket-flow-duo','studio-bridge','editorial-story','feature-spotlight','code-preview','metric-focus','before-after'];
 assert.deepEqual(plain(catalog.slice(0,12).map(x=>x.id)),originals);
 assert.ok(catalog.slice(0,4).every(x=>x.tier==='free'));assert.ok(catalog.slice(4,12).every(x=>x.tier==='pro'));
 assert.equal(catalog.length,16);
 for(const [id,width,height] of configs){const c=catalog.find(x=>x.id===id);assert.ok(c,id);assert.equal(c.width,width);assert.equal(c.height,height);}
});
