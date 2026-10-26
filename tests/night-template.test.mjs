import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const api=load('templates/collection/apply.ts');
const base={imageSrc:'mine.png',imageName:'My main',primaryMediaOrigin:{kind:'user'},secondarySrc:'detail.png',secondaryName:'My detail',secondaryMediaOrigin:{kind:'user'},textDocument:{version:1,layers:[]},customBrandWatermark:'Brand',logoDataUrl:'logo',qrUrl:'https://own.example'};
const plain=x=>JSON.parse(JSON.stringify(x));
const build=(b=base)=>api.buildCuratedSnapshot(b,'night-signal-duo','night');
const rect=(f)=>[f.centerX*1600-f.widthRatio*800,f.centerY*1200-f.heightRatio*600,f.widthRatio*1600,f.heightRatio*1200].map(x=>Math.round(x));
test('Night uses the native dark duo and reviewed single geometry with editable copy',()=>{
 const n=build({...base,imageSrc:null,secondarySrc:null});
 assert.deepEqual(plain(n.customCanvasSize),{width:1600,height:1200});assert.equal(n.solidColor,'#101513');
 assert.deepEqual(rect(n.compositionDocument.placements.main),[96,370,1193,693]);assert.deepEqual(rect(n.compositionDocument.placements.secondary),[1065,632,465,432]);assert.deepEqual(rect(n.compositionDocument.singlePlacement),[185,370,1230,714]);
 for(const slot of ['main','secondary'])assert.equal(n.compositionDocument.mediaPresentation[slot].frame,'browser-dark');
 assert.match(n.imageSrc,/signal-overview\.svg$/);assert.match(n.secondarySrc,/signal-release\.svg$/);
 const contents={brand:'signal',eyebrow:'PRODUCT UPDATE / 01',headline:'Less noise.\nMore perspective.',description:'Your workspace, seen from every angle.',website:'signal.example',disclosure:'Illustrative product demo'};
 for(const [role,content]of Object.entries(contents))assert.equal(n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles[role]).content,content);
 const headline=n.textDocument.layers.find(t=>t.id==='night-headline');assert.equal(headline.fontSize,98);assert.equal(headline.lineHeight,1);
 const cta=n.compositionDocument.objects.find(o=>o.id==='cta');assert.equal(cta.text,'Explore signal');assert.equal(cta.arrow,false);assert.ok(cta.fontSize*1.3+cta.padding*2<=50);
});
test('Night has exactly one subdued native glow, and legacy decorations omit CSS blur',()=>{
 const n=build(),glows=n.compositionDocument.decorations.filter(o=>o.blur!==undefined);assert.equal(glows.length,1);
 assert.equal(glows[0].opacity,.10);assert.ok(glows[0].blur>=300&&glows[0].blur<=420);assert.equal(glows[0].fill,'#D9F58B');assert.ok(glows[0].frame.centerX>.5&&glows[0].frame.centerY<.5);
 const {DecorationRenderer}=load('composition/DecorationRenderer.tsx');const html=o=>renderToStaticMarkup(createElement(DecorationRenderer,{object:o}));assert.match(html(glows[0]),/filter:blur\(360px\)/);
 assert.doesNotMatch(html({...glows[0],blur:undefined}),/filter:/);
});
test('Night preserves user sources, Brand, hidden secondary and isolates history without input mutation',()=>{
 for(const origin of [{kind:'user'},undefined,{kind:'unknown'}]){const b={...base,primaryMediaOrigin:origin,secondaryMediaOrigin:origin},saved=plain(b),n=build(b);assert.deepEqual(plain(b),saved);for(const k of ['imageSrc','imageName','secondarySrc','secondaryName','customBrandWatermark','logoDataUrl','qrUrl'])assert.equal(n[k],b[k]);}
 const one=build({...base,secondarySrc:null});assert.equal(one.secondarySrc,null);assert.equal(one.compositionDocument.detailVisible,false);
 for(const doc of [{detailVisible:false,hiddenIds:[]},{detailVisible:true,hiddenIds:['secondary']}]){const n=build({...base,compositionDocument:doc});assert.equal(n.secondarySrc,base.secondarySrc);assert.equal(n.compositionDocument.detailVisible,false);}
 const {EditorHistory}=load('editorHistory.ts');const h=new EditorHistory(base),n=build();h.flush(n);assert.equal(h.count,2);assert.deepEqual(plain(h.undo(n)),plain(base));
});
test('Night restore and reset preserve deletions, custom text, hidden status and source content',()=>{
 const b=build();b.compositionDocument.objects=b.compositionDocument.objects.filter(o=>o.id!=='brand-mark');b.textDocument.layers=b.textDocument.layers.filter(t=>t.id!=='night-brand');
 const headline=b.textDocument.layers.find(t=>t.id==='night-headline');headline.content='My headline';headline.centerX=.9;
 const c=b.compositionDocument.objects.find(o=>o.id==='cta');c.text='Own CTA';c.fill='#ff0000';c.hidden=true;c.frame.centerX=.2;b.compositionDocument.detailVisible=false;
 const saved=plain(b),r=api.restoreCuratedLayout(b),s=api.resetCuratedStyles(b);assert.deepEqual(plain(b),saved);
 for(const n of [r,s]){assert.equal(n.imageSrc,base.imageSrc);assert.equal(n.compositionDocument.detailVisible,false);assert.equal(n.compositionDocument.objects.some(o=>o.id==='brand-mark'),false);assert.equal(n.textDocument.layers.some(t=>t.id==='night-brand'),false);assert.equal(n.textDocument.layers.find(t=>t.id==='night-headline').content,'My headline');const c=n.compositionDocument.objects.find(o=>o.id==='cta');assert.equal(c.text,'Own CTA');assert.equal(c.hidden,true);}
 assert.notEqual(r.textDocument.layers.find(t=>t.id==='night-headline').centerX,.9);assert.equal(r.compositionDocument.objects.find(o=>o.id==='cta').fill,'#ff0000');assert.equal(s.compositionDocument.objects.find(o=>o.id==='cta').frame.centerX,.2);assert.equal(s.compositionDocument.objects.find(o=>o.id==='cta').fill,'#D9F58B');
});
test('Night and Pocket are the two implemented Pro templates',()=>{
 const {getCuratedTemplate,CURATED_TEMPLATE_CATALOG}=load('templates/collection/catalog.ts');const n=getCuratedTemplate('night-signal-duo');assert.equal(n?.tier,'pro');assert.equal(n.thumbnail,'/designed/collection/night-signal-duo.webp');assert.equal(n.width,1600);assert.equal(n.height,1200);assert.equal(getCuratedTemplate('pocket-flow-duo').tier,'pro');assert.equal(CURATED_TEMPLATE_CATALOG.length,4);
 assert.throws(()=>api.buildCuratedSnapshot(base,'studio-bridge','p'),/Unknown|unavailable/i);
});
test('Night CTA scales from its reference box on short canvases while default and legacy styles stay identical',()=>{
 const n=build(),cta=n.compositionDocument.objects.find(o=>o.id==='cta');
 assert.deepEqual(plain(cta.referenceSize),{width:225,height:50});
 const {ButtonRenderer}=load('composition/ButtonRenderer.tsx');
 const render=(object,contentScale)=>renderToStaticMarkup(createElement(ButtonRenderer,{object,contentScale}));
 assert.equal(render(cta,1),render(cta));
 const scale=Math.min(1,(cta.frame.widthRatio*1200)/cta.referenceSize.width,(cta.frame.heightRatio*630)/cta.referenceSize.height);
 assert.equal(scale,.525);
 const html=render(cta,scale);assert.match(html,/font-size:11\.025px/);assert.match(html,/padding:5\.25px/);assert.match(html,/border-radius:4\.2px/);
 const {CompositionRenderer}=load('composition/CompositionRenderer.tsx');
 const compositionHtml=renderToStaticMarkup(createElement(CompositionRenderer,{document:{...n.compositionDocument,objects:[cta],decorations:[],order:['cta']},size:{width:1200,height:630},textDocument:{version:1,layers:[]}}));
 assert.match(compositionHtml,/font-size:11\.025px/);assert.match(compositionHtml,/data-composition-text="cta"/);assert.match(compositionHtml,/data-composition-label/);
 assert.ok(cta.fontSize*scale*1.3+cta.padding*scale*2<=cta.frame.heightRatio*630);
 assert.match(html,/Explore signal/);assert.doesNotMatch(html,/overflow:hidden|text-overflow|<svg/);
 const paper=api.buildCuratedSnapshot(base,'paper-launch-duo','paper').compositionDocument.objects.find(o=>o.id==='cta');
 assert.equal(paper.referenceSize,undefined);assert.match(render(paper),/font-size:21px/);assert.match(render(paper),/padding:12px/);
});
