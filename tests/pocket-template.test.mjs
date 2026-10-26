import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const api=load('templates/collection/apply.ts');
const base={imageSrc:'mine.png',imageName:'My main',windowTitle:'My title',primaryMediaOrigin:{kind:'user'},secondarySrc:'detail.png',secondaryName:'My detail',secondaryMediaOrigin:{kind:'user'},textDocument:{version:1,layers:[]},customBrandWatermark:'Brand',logoDataUrl:'logo',qrUrl:'https://own.example'};
const plain=x=>JSON.parse(JSON.stringify(x));
const build=(b=base)=>api.buildCuratedSnapshot(b,'pocket-flow-duo','pocket');
const rect=f=>[f.centerX*1080-f.widthRatio*540,f.centerY*1920-f.heightRatio*960,f.widthRatio*1080,f.heightRatio*1920].map(Math.round);

test('Pocket has the reviewed portrait duo geometry, editable copy and flat light phones',()=>{
 const n=build({...base,imageSrc:null,secondarySrc:null});assert.deepEqual(plain(n.customCanvasSize),{width:1080,height:1920});assert.equal(n.solidColor,'#F4E4D6');
 const d=n.compositionDocument;assert.equal(d.mediaLayout,'independent');assert.equal(d.adaptiveMediaLayout,'manual');assert.equal(d.singlePlacement,undefined);
 assert.deepEqual(rect(d.placements.main),[85,535,460,1000]);assert.deepEqual(rect(d.placements.secondary),[557,665,445,1015]);assert.deepEqual(Object.keys(d.placements).sort(),['main','secondary']);
 for(const slot of ['main','secondary']){assert.equal(d.mediaPresentation[slot].frame,'phone-light');assert.equal(d.mediaPresentation[slot].fit,'contain');}
 assert.match(n.imageSrc,/morrow-today\.svg$/);assert.match(n.secondarySrc,/morrow-focus\.svg$/);assert.notEqual(n.imageSrc,n.secondarySrc);
 const contents={brand:'morrow',eyebrow:'A LITTLE SPACE FOR YOUR DAY',headline:'Make time\nfor what matters.',description:'Plan clearly. Move gently.',website:'morrow.example',disclosure:'Illustrative app demo'};
 for(const [role,content]of Object.entries(contents)){const layer=n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles[role]);assert.equal(layer.content,content);assert.equal(layer.color,'#34242D');}
 const h=n.textDocument.layers.find(t=>t.id==='pocket-headline');assert.equal(h.fontSize,120);assert.equal(h.lineHeight,1.02);assert.equal(n.textDocument.layers.find(t=>t.id==='pocket-description').fontSize,42);
 const c=d.objects.find(o=>o.id==='cta');assert.deepEqual(rect(c.frame),[335,1720,410,75]);assert.equal(c.text,'Find your flow');assert.equal(c.fill,'#34242D');assert.equal(c.color,'#FBF5EF');assert.equal(c.arrow,false);assert.deepEqual(plain(c.referenceSize),{width:410,height:75});assert.ok(c.fontSize*1.3+c.padding*2<=75);
 assert.equal(d.objects.filter(o=>o.id==='brand-mark').length,1);assert.ok(d.decorations.length>0);assert.ok(d.decorations.every(o=>o.shape==='ellipse'&&!o.blur&&o.fill==='transparent'&&o.stroke));
 const ids=[...d.objects,...d.decorations].map(o=>o.id);assert.equal(new Set(ids).size,ids.length);assert.equal(new Set(d.order).size,d.order.length);for(const id of d.order)assert.ok(['main','secondary',...ids,...n.textDocument.layers.map(t=>t.id)].includes(id));
});
test('Pocket preserves sources, Brand, hidden secondary and a single image without mutating history input',()=>{
 for(const origin of [{kind:'user'},undefined,{kind:'unknown'}]){const b={...base,primaryMediaOrigin:origin,secondaryMediaOrigin:origin},saved=plain(b),n=build(b);assert.deepEqual(plain(b),saved);for(const k of ['imageSrc','imageName','windowTitle','secondarySrc','secondaryName','customBrandWatermark','logoDataUrl','qrUrl'])assert.equal(n[k],b[k]);}
 const one=build({...base,secondarySrc:null});assert.equal(one.secondarySrc,null);assert.equal(one.compositionDocument.detailVisible,false);assert.deepEqual(rect(one.compositionDocument.placements.main),[85,535,460,1000]);assert.equal(one.compositionDocument.singlePlacement,undefined);
 for(const secondarySrc of [null,'hidden.png'])for(const doc of [{detailVisible:false,hiddenIds:[]},{detailVisible:true,hiddenIds:['secondary']}]){const n=build({...base,secondarySrc,compositionDocument:doc});assert.equal(n.secondarySrc,secondarySrc);assert.equal(n.compositionDocument.detailVisible,false);}
 const {EditorHistory}=load('editorHistory.ts');const h=new EditorHistory(base),n=build();h.flush(n);assert.equal(h.count,2);assert.deepEqual(plain(h.undo(n)),plain(base));assert.deepEqual(plain(h.redo()),plain(n));
});
test('Pocket restores extant geometry and resets styles without resurrecting deletions or rewriting content',()=>{
 const b=build();b.compositionDocument.objects=b.compositionDocument.objects.filter(o=>o.id!=='brand-mark');b.textDocument.layers=b.textDocument.layers.filter(t=>t.id!=='pocket-brand');
 const headline=b.textDocument.layers.find(t=>t.id==='pocket-headline');headline.content='My headline';headline.centerX=.9;
 const c=b.compositionDocument.objects.find(o=>o.id==='cta');c.text='Own CTA';c.fill='#ff0000';c.hidden=true;c.frame.centerX=.2;b.compositionDocument.detailVisible=false;b.compositionDocument.placements.main.centerX=.7;
 const saved=plain(b),r=api.restoreCuratedLayout(b),s=api.resetCuratedStyles(b);assert.deepEqual(plain(b),saved);
 for(const n of [r,s]){assert.equal(n.imageSrc,base.imageSrc);assert.equal(n.compositionDocument.detailVisible,false);assert.equal(n.compositionDocument.singlePlacement,undefined);assert.equal(n.compositionDocument.adaptiveMediaLayout,'manual');assert.equal(n.compositionDocument.objects.some(o=>o.id==='brand-mark'),false);assert.equal(n.textDocument.layers.some(t=>t.id==='pocket-brand'),false);assert.equal(n.textDocument.layers.find(t=>t.id==='pocket-headline').content,'My headline');const c=n.compositionDocument.objects.find(o=>o.id==='cta');assert.equal(c.text,'Own CTA');assert.equal(c.hidden,true);}
 assert.deepEqual(rect(r.compositionDocument.placements.main),[85,535,460,1000]);assert.notEqual(r.textDocument.layers.find(t=>t.id==='pocket-headline').centerX,.9);assert.equal(r.compositionDocument.objects.find(o=>o.id==='cta').fill,'#ff0000');assert.equal(s.compositionDocument.objects.find(o=>o.id==='cta').frame.centerX,.2);assert.equal(s.compositionDocument.objects.find(o=>o.id==='cta').fill,'#34242D');assert.equal(s.compositionDocument.placements.main.centerX,.7);
});
test('Pocket is an available Pro template and fresh demo title identifies morrow',()=>{
 const {getCuratedTemplate}=load('templates/collection/catalog.ts'),n=getCuratedTemplate('pocket-flow-duo');assert.equal(n?.tier,'pro');assert.equal(n.width,1080);assert.equal(n.height,1920);assert.equal(n.thumbnail,'/designed/collection/pocket-flow-duo.webp');
 const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert.match(app,/id === 'pocket-flow-duo' \? 'morrow\.example'/);
});
test('Pocket CTA keeps its complete label within shorter export boxes using its reference size',()=>{
 const n=build(),cta=n.compositionDocument.objects.find(o=>o.id==='cta');
 const {ButtonRenderer}=load('composition/ButtonRenderer.tsx');
 const render=contentScale=>renderToStaticMarkup(createElement(ButtonRenderer,{object:cta,contentScale}));assert.equal(render(1),render(undefined));
 const {CompositionRenderer}=load('composition/CompositionRenderer.tsx');
 for(const size of [{width:1080,height:1920},{width:1200,height:630},{width:1600,height:1200}]){
  const scale=Math.min(1,cta.frame.widthRatio*size.width/410,cta.frame.heightRatio*size.height/75);
  const html=renderToStaticMarkup(createElement(CompositionRenderer,{document:{...n.compositionDocument,objects:[cta],decorations:[],order:['cta']},size,textDocument:{version:1,layers:[]}}));
  assert.match(html,new RegExp(`font-size:${cta.fontSize*scale}px`));assert.match(html,/Find your flow/);assert.doesNotMatch(html,/text-overflow|<svg/);assert.ok((cta.fontSize*1.3+cta.padding*2)*scale<=cta.frame.heightRatio*size.height);
 }
});
