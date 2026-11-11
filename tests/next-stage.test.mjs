import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createTypeScriptLoader} from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const {buildCuratedSnapshot,restoreCuratedLayout,resetCuratedStyles}=load('templates/collection/apply.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const base={imageSrc:null,secondarySrc:null,textDocument:{version:1,layers:[]},logoDataUrl:'own-logo',qrUrl:'https://own.example',customBrandWatermark:'Own brand'};
const build=(before=base)=>buildCuratedSnapshot(before,'next-stage','next-proof');
test('NEXT proof is a 1080x1920 native composition with two distinct independent samples',()=>{
 const n=build(),d=n.compositionDocument;
 assert.deepEqual(plain(n.customCanvasSize),{width:1080,height:1920});
 assert.equal(n.bgImageSrc,null);assert.equal(d.mediaLayout,'independent');assert.equal(d.templateId,'next-stage');
 assert.equal(d.detailVisible,true);assert.notEqual(n.imageSrc,n.secondarySrc);
 assert.match(n.imageSrc,/tone-player\.svg$/);assert.match(n.secondarySrc,/tone-collection\.svg$/);
 assert.equal(d.mediaPresentation.main.frame,'phone-dark');assert.equal(d.mediaPresentation.secondary.frame,'phone-dark');
 assert.equal(d.objects.some(x=>x.kind==='button'),false);
 assert.equal(n.isProUnlocked,undefined);
});
test('the four-line NEXT headline is native editable text beneath both media planes',()=>{
 const n=build(),d=n.compositionDocument;
 const title=n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles.headline);
 assert.equal(title.content,'N\nE\nX\nT');assert.ok(title.fontSize>=400&&title.fontSize<=512);
 assert.ok(d.order.indexOf(title.id)<d.order.indexOf('main'));
 assert.ok(d.order.indexOf(title.id)<d.order.indexOf('secondary'));
 assert.ok(n.textDocument.layers.some(t=>t.id===n.templateContext.textRoles.description));
 assert.ok(d.decorations.some(t=>t.shape==='ellipse'));
});
test('user screenshots, unknown origins and brand data are preserved without mutating input',()=>{
 for(const origin of [{kind:'user'},{kind:'unknown'},undefined]){
  const b={...base,imageSrc:'my-main',secondarySrc:'my-second',imageName:'Mine',secondaryName:'Detail',primaryMediaOrigin:origin,secondaryMediaOrigin:origin};
  const saved=plain(b),n=build(b);assert.deepEqual(plain(b),saved);
  for(const k of ['imageSrc','secondarySrc','imageName','secondaryName','logoDataUrl','qrUrl','customBrandWatermark'])assert.equal(n[k],b[k]);
 }
});
test('single input and explicitly hidden secondary stay single with authored fallback',()=>{
 const n=build({...base,imageSrc:'mine',primaryMediaOrigin:{kind:'user'}});assert.equal(n.secondarySrc,null);assert.equal(n.compositionDocument.detailVisible,false);
 assert.ok(n.compositionDocument.singlePlacement);assert.equal(n.compositionDocument.adaptiveMediaLayout,'auto');
 const hidden=build({...base,imageSrc:'mine',secondarySrc:'hidden',compositionDocument:{detailVisible:false,hiddenIds:['secondary']}});
 assert.equal(hidden.secondarySrc,'hidden');assert.equal(hidden.compositionDocument.detailVisible,false);
});
test('restore/reset preserve edited copy, independent sources and hidden status',()=>{
 const n=build({...base,imageSrc:'mine',secondarySrc:'other'}),d=n.compositionDocument;
 const title=n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles.headline);title.content='Y\nO\nU\nR';
 d.detailVisible=false;d.placements.main.centerX=.1;d.decorations[0].fill='#123456';d.decorations[0].hidden=true;
 const saved=plain(n),a=restoreCuratedLayout(n),b=resetCuratedStyles(n);assert.deepEqual(plain(n),saved);
 for(const s of [a,b]){assert.equal(s.imageSrc,'mine');assert.equal(s.secondarySrc,'other');assert.equal(s.compositionDocument.detailVisible,false);assert.equal(s.compositionDocument.decorations[0].hidden,true);assert.equal(s.textDocument.layers.find(t=>t.id===s.templateContext.textRoles.headline).content,title.content);}
 assert.equal(a.compositionDocument.decorations[0].fill,'#123456');assert.equal(b.compositionDocument.placements.main.centerX,.1);
});
test('a native proof can be a single reversible history command',()=>{
 const {EditorHistory}=load('editorHistory.ts'),h=new EditorHistory(base),n=build();h.flush(n);
 assert.deepEqual(plain(h.undo(n)),plain(base));assert.deepEqual(plain(h.redo()),plain(n));
});
test('NEXT is published as a 9:16 Pro template through the shared access policy',()=>{
 const {CURATED_TEMPLATE_CATALOG:c,getCuratedTemplate}=load('templates/collection/catalog.ts');
 const {canApplyCuratedTemplate}=load('templates/collection/access.ts');
 assert.equal(c.length,19);
 const next=getCuratedTemplate('next-stage');assert.ok(next);
 assert.equal(next.name,'NEXT Stage');assert.equal(next.tier,'pro');
 assert.equal(next.width,1080);assert.equal(next.height,1920);
 assert.equal(next.thumbnail,'/designed/collection/next-stage.webp');
 assert.equal(canApplyCuratedTemplate('next-stage',false),false);assert.equal(canApplyCuratedTemplate('next-stage',true),true);
 assert.equal(c.filter(t=>t.tier==='free').length,8);
});
