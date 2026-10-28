import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load = createTypeScriptLoader(fileURLToPath(new URL('../src/', import.meta.url)));
const api = load('templates/collection/apply.ts');
const { resolveMediaPlacements } = load('templates/collection/mediaLayout.ts');
const plain = x => JSON.parse(JSON.stringify(x));
const base = { imageSrc: 'mine.png', imageName: 'Main', primaryMediaOrigin: {kind:'user'}, secondarySrc: 'detail.png', secondaryName: 'Detail', secondaryMediaOrigin: {kind:'user'}, textDocument:{version:1,layers:[]}, logoDataUrl:'logo', qrUrl:'https://own.example', customBrandWatermark:'Own brand' };
const cases = [
 ['feature-spotlight','Feature Spotlight',1200,630,'#F2EEE4','Less\nbusywork.','motive-board','motive-rules',[396,104,750,348,-2],[628,350,510,230,3],'browser-light'],
 ['code-preview','Web & Mobile',1600,1200,'#E7EDAF','Same rhythm.\nEvery screen.','sidea-web','sidea-mobile',[67,543,1110,566,-2],[1167,328,348,770,4],'phone-light'],
 ['metric-focus','Metric Focus',1920,1080,'#F8F7F2','Make the\nsignal clear.','north-overview','north-audience',[64,480,1052,500,0],[1240,520,616,460,0],'plain'],
 ['before-after','Before & After',1080,1080,'#E6E9CD','THEN.','outline-before','outline-after',[56,314,452,590,0],[572,314,452,590,0],'browser-light'],
];
const rect=(f,w,h)=>[f.centerX*w-f.widthRatio*w/2,f.centerY*h-f.heightRatio*h/2,f.widthRatio*w,f.heightRatio*h,f.rotation].map(Math.round);
for(const [id,name,width,height,bg,headline,main,secondary,mainRect,secondaryRect,secondaryFrame] of cases){
 test(`${name} applies native authored geometry, editable copy, sample origins and no invented controls`,()=>{
  const n=api.buildCuratedSnapshot({...base,imageSrc:null,secondarySrc:null},id,'remaining'),d=n.compositionDocument;
  assert.deepEqual(plain(n.customCanvasSize),{width,height});assert.equal(n.solidColor,bg);
  assert.equal(n.textDocument.layers.find(x=>x.id==='remaining-headline').content,headline);
  assert.equal(n.imageSrc,`/designed/examples/collection/${main}.png`);assert.equal(n.secondarySrc,`/designed/examples/collection/${secondary}.png`);
  assert.equal(n.primaryMediaOrigin.sampleId,main);assert.equal(n.secondaryMediaOrigin.sampleId,secondary);
  assert.deepEqual(rect(d.placements.main,width,height),mainRect);assert.deepEqual(rect(d.placements.secondary,width,height),secondaryRect);
  assert.equal(d.mediaPresentation.main.frame,'browser-light');assert.equal(d.mediaPresentation.secondary.frame,secondaryFrame);
  assert.equal(d.objects.length,0);assert.ok(d.decorations.some(x=>x.kind==='shape'));
  assert.deepEqual(plain(d.order),['main','secondary',...n.textDocument.layers.map(x=>x.id)]);assert.deepEqual(plain(d.knownTextIds),plain(n.textDocument.layers.map(x=>x.id)));
  assert.equal(d.adaptiveMediaLayout,'auto');assert.ok(d.singlePlacement);
  const {validateComposition}=load('composition/document.ts');assert.doesNotThrow(()=>validateComposition(d));
 });
 test(`${name} adapts to one uploaded image and restores duo without losing source or Brand`,()=>{
  const original=plain(base),n=api.buildCuratedSnapshot(base,id,'own'),d=n.compositionDocument;
  assert.deepEqual(plain(base),original);for(const key of ['imageSrc','imageName','secondarySrc','secondaryName','logoDataUrl','qrUrl','customBrandWatermark'])assert.equal(n[key],base[key]);
  assert.deepEqual(plain(resolveMediaPlacements(d)),plain(d.placements));
  for(const change of [{detailVisible:false},{hiddenIds:['secondary']}]){const single=resolveMediaPlacements({...d,...change});assert.deepEqual(plain(single.main),plain(d.singlePlacement));assert.notDeepEqual(plain(single.main),plain(d.placements.main));assert.ok(single.main.widthRatio*single.main.heightRatio>d.placements.main.widthRatio*d.placements.main.heightRatio,'Single-image layout enlarges the primary media area');assert.deepEqual(plain(single.secondary),plain(d.placements.secondary));}
  assert.deepEqual(plain(resolveMediaPlacements({...d,detailVisible:true,hiddenIds:[]})),plain(d.placements));
  const one=api.buildCuratedSnapshot({...base,secondarySrc:null},id,'single');assert.equal(one.secondarySrc,null);assert.equal(one.compositionDocument.detailVisible,false);
  const hidden=api.buildCuratedSnapshot({...base,compositionDocument:{detailVisible:false,hiddenIds:[]}},id,'hidden');assert.equal(hidden.secondarySrc,base.secondarySrc);assert.equal(hidden.compositionDocument.detailVisible,false);
 });
 test(`${name} Restore and Reset preserve edits, deletion, hidden state and one-step history`,()=>{
  const n=plain(api.buildCuratedSnapshot(base,id,'edit')),d=n.compositionDocument;
  n.textDocument.layers=n.textDocument.layers.filter(x=>x.id!=='edit-brand');n.textDocument.layers.find(x=>x.id==='edit-headline').content='My own headline 中文';
  d.detailVisible=false;d.hiddenIds=['edit-headline'];d.placements.main.centerX=.1;d.order.reverse();d.mediaPresentation.main.shadow={x:1,y:2,blur:3,color:'#000000'};
  d.decorations[0].fill='#FF0000';d.decorations[0].frame.centerX=.3;const saved=plain(n),r=api.restoreCuratedLayout(n),s=api.resetCuratedStyles(n);
  assert.deepEqual(plain(n),saved);assert.notEqual(r.compositionDocument.placements.main.centerX,.1);assert.equal(s.compositionDocument.placements.main.centerX,.1);assert.equal(r.compositionDocument.decorations[0].fill,'#FF0000');assert.equal(s.compositionDocument.decorations[0].frame.centerX,.3);assert.notEqual(s.compositionDocument.decorations[0].fill,'#FF0000');assert.deepEqual(plain(s.compositionDocument.order),plain(d.order));
  assert.deepEqual(plain(r.compositionDocument.order),['main','secondary',...n.textDocument.layers.map(x=>x.id)]);
  for(const a of [r,s]){assert.equal(a.textDocument.layers.find(x=>x.id==='edit-headline').content,'My own headline 中文');assert.equal(a.textDocument.layers.some(x=>x.id==='edit-brand'),false);assert.equal(a.compositionDocument.detailVisible,false);assert.deepEqual(plain(a.compositionDocument.hiddenIds),['edit-headline']);assert.equal(a.imageSrc,base.imageSrc);assert.equal(a.qrUrl,base.qrUrl);}
  const {EditorHistory}=load('editorHistory.ts');const history=new EditorHistory(base);history.flush(n);assert.equal(history.count,2);assert.deepEqual(plain(history.undo(n)),plain(base));assert.deepEqual(plain(history.redo()),plain(n));
 });
}
test('all twelve collection entries include four Free and eight gated Pro templates',()=>{
 const {CURATED_TEMPLATE_CATALOG:c}=load('templates/collection/catalog.ts');const {canApplyCuratedTemplate}=load('templates/collection/access.ts');
 assert.equal(c.length,12);assert.equal(c.filter(x=>x.tier==='free').length,4);assert.equal(c.filter(x=>x.tier==='pro').length,8);
 assert.deepEqual(plain(c.slice(8).map(x=>[x.id,x.name])),cases.map(x=>x.slice(0,2)));
 for(const [id]of cases){assert.equal(canApplyCuratedTemplate(id,false),false);assert.equal(canApplyCuratedTemplate(id,true),true);}
});
test('metrics and comparison labels remain editable semantic text',()=>{
 const metric=api.buildCuratedSnapshot(base,'metric-focus','m');assert.equal(metric.textDocument.layers.find(x=>x.id==='m-metric').content,'24.8k');assert.equal(metric.textDocument.layers.find(x=>x.id==='m-metric-label').content,'TOTAL VISITS / EXAMPLE DATA');
 const comparison=api.buildCuratedSnapshot(base,'before-after','b');for(const [role,value]of [['after-heading','NOW.'],['description','Same content.'],['after-caption','Clearer hierarchy.'],['before-label','01 / BEFORE'],['after-label','02 / AFTER']])assert.equal(comparison.textDocument.layers.find(x=>x.id===`b-${role}`).content,value);
});
