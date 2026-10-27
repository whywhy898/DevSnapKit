import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const api=load('templates/collection/apply.ts');
const base={imageSrc:'mine.png',imageName:'My main',windowTitle:'Own title',primaryMediaOrigin:{kind:'user'},secondarySrc:'detail.png',secondaryName:'My detail',secondaryMediaOrigin:{kind:'user'},textDocument:{version:1,layers:[]},customBrandWatermark:'Brand',logoDataUrl:'logo',qrUrl:'https://own.example'};
const plain=x=>JSON.parse(JSON.stringify(x));
const build=(b=base)=>api.buildCuratedSnapshot(b,'app-pair','pair');
const rect=f=>[f.centerX*1080-f.widthRatio*540,f.centerY*1920-f.heightRatio*960,f.widthRatio*1080,f.heightRatio*1920].map(Math.round);

test('App Pair is a Free portrait with equal manual phones and no CTA object or ghost order entry',()=>{
 const n=build({...base,imageSrc:null,secondarySrc:null}),d=n.compositionDocument;
 assert.deepEqual(plain(n.customCanvasSize),{width:1080,height:1920});assert.equal(n.solidColor,'#EAF2FA');
 assert.equal(d.mediaLayout,'independent');assert.equal(d.adaptiveMediaLayout,'manual');assert.equal(d.singlePlacement,undefined);
 assert.deepEqual(rect(d.placements.main),[64,580,464,1050]);assert.deepEqual(rect(d.placements.secondary),[552,580,464,1050]);
 for(const slot of ['main','secondary']){assert.equal(d.mediaPresentation[slot].frame,'phone-light');assert.equal(d.mediaPresentation[slot].fit,'contain');assert.equal(d.mediaPresentation[slot].align,'center');}
 assert.match(n.imageSrc,/shelf-library\.svg$/);assert.match(n.secondarySrc,/shelf-notes\.svg$/);assert.notEqual(n.imageSrc,n.secondarySrc);assert.notEqual(n.primaryMediaOrigin.sampleId,n.secondaryMediaOrigin.sampleId);
 assert.equal(n.primaryMediaOrigin.kind,'builtin');assert.equal(n.secondaryMediaOrigin.kind,'builtin');
 assert.equal(d.objects.some(o=>o.kind==='button'||o.id==='cta'),false);assert.equal(d.order.includes('cta'),false);
 assert.deepEqual(d.objects.map(o=>o.id),['brand-mark']);assert.deepEqual(rect(d.objects[0].frame),[64,72,30,36]);
 assert.deepEqual(plain(d.decorations.map(o=>({shape:o.shape,rect:rect(o.frame),fill:o.fill}))),[{shape:'rect',rect:[64,1836,92,12],fill:'#A8C8E5'},{shape:'rect',rect:[168,1836,64,12],fill:'#EDC5A3'},{shape:'rect',rect:[244,1836,44,12],fill:'#F4E5C5'}]);
 const contents={brand:'shelf',eyebrow:'A HOME FOR WHAT YOU READ',headline:'Good ideas,\nkept close.',description:'Save a thought. Find it again.',website:'shelf.example',disclosure:'Illustrative app demo'};
 for(const [role,content]of Object.entries(contents))assert.equal(n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles[role]).content,content);
 const h=n.textDocument.layers.find(t=>t.id==='pair-headline');assert.equal(h.fontSize,112);assert.equal(h.weight,800);assert.equal(h.lineHeight,1.04);assert.equal(h.color,'#203B59');
 for(const role of ['website','disclosure']){const t=n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles[role]);assert.equal(t.align,'right');assert.ok(t.centerX+t.widthRatio/2<=.85);}
});

test('App Pair footer reserves the portrait default QR area',()=>{
 const n=build();
 for(const role of ['website','disclosure']){
  const t=n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles[role]);
  const right=(t.centerX+t.widthRatio/2)*1080;
  assert.ok(right<=.8*1080,`${role} right ${right} must stay within the 864px footer reserve`);
  assert.equal(Math.round(t.widthRatio*1080),292);
 }
 assert.equal(n.qrUrl,base.qrUrl);
});

test('App Pair preserves user and unknown sources and Brand; replaces only builtins',()=>{
 for(const origin of [{kind:'user'},undefined,{kind:'unknown'}]){const b={...base,primaryMediaOrigin:origin,secondaryMediaOrigin:origin},saved=plain(b),n=build(b);assert.deepEqual(plain(b),saved);for(const k of ['imageSrc','imageName','windowTitle','secondarySrc','secondaryName','customBrandWatermark','logoDataUrl','qrUrl'])assert.equal(n[k],b[k]);}
 const n=build({...base,primaryMediaOrigin:{kind:'builtin'},secondaryMediaOrigin:{kind:'builtin'}});assert.match(n.imageSrc,/shelf-library/);assert.match(n.secondarySrc,/shelf-notes/);
 const mixed=build({...base,secondaryMediaOrigin:{kind:'builtin'}});assert.equal(mixed.imageSrc,base.imageSrc);assert.match(mixed.secondarySrc,/shelf-notes/);
});

test('App Pair single-image and hidden-slot intent retain sources without injected demo or automatic geometry',()=>{
 const one=build({...base,secondarySrc:null});assert.equal(one.secondarySrc,null);assert.equal(one.compositionDocument.detailVisible,false);assert.deepEqual(rect(one.compositionDocument.placements.main),[64,580,464,1050]);
 for(const secondarySrc of [null,'hidden.png'])for(const doc of [{detailVisible:false,hiddenIds:[]},{detailVisible:true,hiddenIds:['secondary']}]){const n=build({...base,secondarySrc,compositionDocument:doc});assert.equal(n.secondarySrc,secondarySrc);assert.equal(n.compositionDocument.detailVisible,false);assert.equal(n.compositionDocument.adaptiveMediaLayout,'manual');}
});

test('App Pair restore and reset preserve content, hidden source, deletions and absent CTA',()=>{
 const b=build();b.compositionDocument.objects=[];b.compositionDocument.decorations.shift();b.textDocument.layers=b.textDocument.layers.filter(t=>t.id!=='pair-brand');
 const h=b.textDocument.layers.find(t=>t.id==='pair-headline');h.content='Own headline';h.centerX=.9;
 const stripe=b.compositionDocument.decorations[0];stripe.fill='#ff0000';stripe.hidden=true;stripe.frame.centerX=.2;
 b.compositionDocument.detailVisible=false;b.compositionDocument.placements.main.centerX=.7;b.compositionDocument.mediaPresentation.main.fit='cover';
 const saved=plain(b),r=api.restoreCuratedLayout(b),s=api.resetCuratedStyles(b);assert.deepEqual(plain(b),saved);
 for(const n of [r,s]){for(const k of ['imageSrc','secondarySrc','logoDataUrl','qrUrl','customBrandWatermark'])assert.equal(n[k],base[k]);assert.equal(n.compositionDocument.detailVisible,false);assert.equal(n.compositionDocument.adaptiveMediaLayout,'manual');assert.equal(n.compositionDocument.singlePlacement,undefined);assert.equal(n.compositionDocument.objects.length,0);assert.equal(n.compositionDocument.order.includes('cta'),false);assert.equal(n.compositionDocument.decorations.length,2);assert.equal(n.compositionDocument.decorations[0].hidden,true);assert.equal(n.textDocument.layers.some(t=>t.id==='pair-brand'),false);assert.equal(n.textDocument.layers.find(t=>t.id==='pair-headline').content,'Own headline');}
 assert.deepEqual(rect(r.compositionDocument.placements.main),[64,580,464,1050]);assert.notEqual(r.textDocument.layers.find(t=>t.id==='pair-headline').centerX,.9);assert.equal(r.compositionDocument.decorations[0].fill,'#ff0000');assert.equal(r.compositionDocument.mediaPresentation.main.fit,'cover');
 assert.equal(s.compositionDocument.placements.main.centerX,.7);assert.equal(s.compositionDocument.decorations[0].frame.centerX,.2);assert.equal(s.compositionDocument.decorations[0].fill,'#EDC5A3');assert.equal(s.compositionDocument.mediaPresentation.main.fit,'contain');
 const {EditorHistory}=load('editorHistory.ts'),history=new EditorHistory(base),n=build();history.flush(n);assert.deepEqual(plain(history.undo(n)),plain(base));assert.deepEqual(plain(history.redo()),plain(n));
});

test('catalog places App Pair after Calm as fourth Free and fresh demo uses shelf.example',()=>{
 const {CURATED_TEMPLATE_CATALOG:catalog,getCuratedTemplate}=load('templates/collection/catalog.ts');assert.deepEqual(plain(catalog.map(t=>t.id)),['editorial-honey','paper-launch-duo','calm-split','app-pair','night-signal-duo','pocket-flow-duo','studio-bridge','editorial-story']);assert.equal(catalog.filter(t=>t.tier==='free').length,4);assert.equal(catalog.filter(t=>t.tier==='pro').length,4);assert.equal(getCuratedTemplate('app-pair').tier,'free');
 const {canApplyCuratedTemplate}=load('templates/collection/access.ts');for(const unlocked of [false,true])assert.equal(canApplyCuratedTemplate('app-pair',unlocked),true);
 const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert.match(app,/id === 'app-pair' \? 'shelf\.example'/);
});

test('existing curated CTA objects and order remain exactly their blueprints',()=>{
 for(const [id,file,key]of [['paper-launch-duo','paper-launch-duo','PAPER_LAUNCH_DUO'],['calm-split','calm-split','CALM_SPLIT'],['night-signal-duo','night-signal-duo','NIGHT_SIGNAL_DUO'],['pocket-flow-duo','pocket-flow-duo','POCKET_FLOW_DUO']]){const n=api.buildCuratedSnapshot(base,id,'old'),blueprint=load('templates/collection/definitions/'+file+'.ts')[key];assert.deepEqual(plain(n.compositionDocument.objects.find(o=>o.id==='cta')),plain(blueprint.cta));assert.deepEqual(plain(n.compositionDocument.order),['main','secondary','brand-mark','cta',...n.textDocument.layers.map(t=>t.id)]);}
 const honey=api.buildCuratedSnapshot(base,'editorial-honey','h');assert.ok(honey.compositionDocument.objects.some(o=>o.id==='cta'&&o.kind==='button'));assert.ok(honey.compositionDocument.order.includes('cta'));
});
