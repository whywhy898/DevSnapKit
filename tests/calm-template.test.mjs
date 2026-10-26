import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const api=load('templates/collection/apply.ts');
const base={imageSrc:'mine.png',imageName:'My main',windowTitle:'Own title',primaryMediaOrigin:{kind:'user'},secondarySrc:'detail.png',secondaryName:'My detail',secondaryMediaOrigin:{kind:'user'},textDocument:{version:1,layers:[]},customBrandWatermark:'Brand',logoDataUrl:'logo',qrUrl:'https://own.example'};
const plain=x=>JSON.parse(JSON.stringify(x));
const build=(b=base)=>api.buildCuratedSnapshot(b,'calm-split','calm');
const rect=f=>[f.centerX*1080-f.widthRatio*540,f.centerY*1080-f.heightRatio*540,f.widthRatio*1080,f.heightRatio*1080].map(Math.round);

test('Calm is a Free square with equal independent browsers and distinct native demos',()=>{
 const n=build({...base,imageSrc:null,secondarySrc:null}),d=n.compositionDocument;
 assert.deepEqual(plain(n.customCanvasSize),{width:1080,height:1080});assert.equal(n.solidColor,'#EEF2EE');assert.equal(n.vfxGlow,false);
 assert.equal(d.mediaLayout,'independent');assert.equal(d.adaptiveMediaLayout,'manual');assert.equal(d.singlePlacement,undefined);
 assert.deepEqual(rect(d.placements.main),[64,348,464,510]);assert.deepEqual(rect(d.placements.secondary),[552,348,464,510]);assert.deepEqual(Object.keys(d.placements).sort(),['main','secondary']);
 for(const slot of ['main','secondary'])assert.deepEqual(plain(d.mediaPresentation[slot]),{frame:'browser-light',fit:'contain',align:'center',title:slot==='main'?'Notes':'Board'});
 assert.match(n.imageSrc,/calm-workspace\.svg$/);assert.match(n.secondarySrc,/calm-detail\.svg$/);assert.notEqual(n.imageSrc,n.secondarySrc);
 assert.deepEqual(plain(d.decorations),[]);assert.equal(d.objects.filter(o=>o.id==='brand-mark').length,1);assert.deepEqual(rect(d.objects.find(o=>o.id==='brand-mark').frame),[64,52,28,28]);
 const contents={brand:'moss',eyebrow:'SPACE TO THINK',headline:'Two views.\nOne clear story.',description:'Bring the whole picture into focus.',website:'moss.example',disclosure:'Illustrative product demo'};
 for(const [role,content]of Object.entries(contents))assert.equal(n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles[role]).content,content);
 const h=n.textDocument.layers.find(t=>t.id==='calm-headline');assert.equal(h.fontSize,72);assert.equal(h.lineHeight,1.05);assert.equal(h.letterSpacing,-3);assert.equal(h.color,'#214C43');
 const c=d.objects.find(o=>o.id==='cta');assert.deepEqual(rect(c.frame),[64,982,182,48]);assert.equal(c.text,'Explore moss');assert.equal(c.fontSize,19);assert.equal(c.padding,10);assert.equal(c.radius,8);assert.equal(c.fill,'#214C43');assert.equal(c.color,'#FFFFFF');assert.equal(c.arrow,false);assert.deepEqual(plain(c.referenceSize),{width:182,height:48});assert.ok(c.fontSize*1.3+c.padding*2<=48);
});

test('Calm preserves user and unknown sources, Brand, hidden secondary and single-image intent',()=>{
 for(const origin of [{kind:'user'},undefined,{kind:'unknown'}]){const b={...base,primaryMediaOrigin:origin,secondaryMediaOrigin:origin},saved=plain(b),n=build(b);assert.deepEqual(plain(b),saved);for(const k of ['imageSrc','imageName','windowTitle','secondarySrc','secondaryName','customBrandWatermark','logoDataUrl','qrUrl'])assert.equal(n[k],b[k]);}
 const one=build({...base,secondarySrc:null});assert.equal(one.secondarySrc,null);assert.equal(one.compositionDocument.detailVisible,false);assert.deepEqual(rect(one.compositionDocument.placements.main),[64,348,464,510]);
 for(const secondarySrc of [null,'hidden.png'])for(const doc of [{detailVisible:false,hiddenIds:[]},{detailVisible:true,hiddenIds:['secondary']}]){const n=build({...base,secondarySrc,compositionDocument:doc});assert.equal(n.secondarySrc,secondarySrc);assert.equal(n.compositionDocument.detailVisible,false);}
 const {EditorHistory}=load('editorHistory.ts'),history=new EditorHistory(base),n=build();history.flush(n);assert.equal(history.count,2);assert.deepEqual(plain(history.undo(n)),plain(base));assert.deepEqual(plain(history.redo()),plain(n));
});

test('Calm restore and reset separate geometry from styles and preserve extant content and deletions',()=>{
 const b=build();b.compositionDocument.objects=b.compositionDocument.objects.filter(o=>o.id!=='brand-mark');b.textDocument.layers=b.textDocument.layers.filter(t=>t.id!=='calm-brand');
 const headline=b.textDocument.layers.find(t=>t.id==='calm-headline');headline.content='My headline';headline.centerX=.9;
 const c=b.compositionDocument.objects.find(o=>o.id==='cta');c.text='Own CTA';c.fill='#ff0000';c.hidden=true;c.frame.centerX=.2;b.compositionDocument.detailVisible=false;b.compositionDocument.placements.main.centerX=.7;
 const saved=plain(b),r=api.restoreCuratedLayout(b),s=api.resetCuratedStyles(b);assert.deepEqual(plain(b),saved);
 for(const n of [r,s]){assert.equal(n.imageSrc,base.imageSrc);assert.equal(n.compositionDocument.detailVisible,false);assert.equal(n.compositionDocument.singlePlacement,undefined);assert.equal(n.compositionDocument.adaptiveMediaLayout,'manual');assert.equal(n.compositionDocument.objects.some(o=>o.id==='brand-mark'),false);assert.equal(n.textDocument.layers.some(t=>t.id==='calm-brand'),false);assert.equal(n.textDocument.layers.find(t=>t.id==='calm-headline').content,'My headline');assert.equal(n.compositionDocument.objects.find(o=>o.id==='cta').text,'Own CTA');assert.equal(n.compositionDocument.objects.find(o=>o.id==='cta').hidden,true);}
 assert.deepEqual(rect(r.compositionDocument.placements.main),[64,348,464,510]);assert.notEqual(r.textDocument.layers.find(t=>t.id==='calm-headline').centerX,.9);assert.equal(r.compositionDocument.objects.find(o=>o.id==='cta').fill,'#ff0000');assert.equal(s.compositionDocument.objects.find(o=>o.id==='cta').frame.centerX,.2);assert.equal(s.compositionDocument.objects.find(o=>o.id==='cta').fill,'#214C43');assert.equal(s.compositionDocument.placements.main.centerX,.7);
});

test('Calm is available without Pro and fresh demo title identifies moss',()=>{
 const {getCuratedTemplate}=load('templates/collection/catalog.ts'),n=getCuratedTemplate('calm-split');assert.equal(n?.tier,'free');assert.equal(n.width,1080);assert.equal(n.height,1080);assert.equal(n.thumbnail,'/designed/collection/calm-split.webp');
 const {canApplyCuratedTemplate}=load('templates/collection/access.ts');for(const unlocked of [true,false])assert.equal(canApplyCuratedTemplate('calm-split',unlocked),true);
 const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert.match(app,/id === 'calm-split' \? 'moss\.example'/);
});

test('Calm footer copy reserves the default bottom-right QR area without changing user QR state',()=>{
 const n=build();
 for(const role of ['website','disclosure']){
  const layer=n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles[role]);
  assert.ok(layer.centerX+layer.widthRatio/2<=.85,`${role} must end before the default QR reserve`);
  assert.equal(Math.round(layer.widthRatio*1080),312);
 }
 assert.equal(n.qrUrl,base.qrUrl);
 assert.equal(n.customBrandWatermark,base.customBrandWatermark);
});
