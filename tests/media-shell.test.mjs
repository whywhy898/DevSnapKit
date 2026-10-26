import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const api=load('composition/document.ts');
const Renderer=load('composition/CompositionRenderer.tsx').CompositionRenderer;
const layout=load('templates/collection/mediaLayout.ts');
const ImageControls=load('inspector/ImageControls.tsx').ImageControls;
const plain=x=>JSON.parse(JSON.stringify(x));
const adaptive=()=>({...api.createIndependentComposition(),adaptiveMediaLayout:'auto',singlePlacement:{centerX:.5,centerY:.54,widthRatio:.8,heightRatio:.7,rotation:0},mediaPresentation:{main:{frame:'browser-light',fit:'contain',align:'center',title:'Main browser'},secondary:{frame:'browser-dark',fit:'contain',align:'top',title:'Detail browser'}}});
const props=document=>({document,size:{width:1200,height:630},imageSrc:'main.svg',imageName:'Main',secondarySrc:'second.svg',secondaryName:'Second',windowTheme:'browser',windowTitle:'demo.example',shadowLevel:'soft',shadowOpacity:35,cornerStyle:'default',roundedCorners:14,hideMockup:false,layoutPreset:'flat',textDocument:{version:1,layers:[]},preview:false});
const render=d=>renderToStaticMarkup(createElement(Renderer,props(d)));
test('two independent browser shells render native chrome and exactly their canonical source',()=>{
 const d=adaptive();d.detailVisible=true;const html=render(d);
 assert.equal((html.match(/data-media-chrome=/g)||[]).length,2);
 assert.match(html,/data-media-frame="browser-light"/);assert.match(html,/data-media-frame="browser-dark"/);
 assert.equal((html.match(/src="main.svg"/g)||[]).length,1);assert.equal((html.match(/src="second.svg"/g)||[]).length,1);
 assert.match(html,/Main browser/);assert.match(html,/Detail browser/);assert.match(html,/object-fit:contain/);
});
test('plain shell has no browser chrome and respects cover and independent alignment',()=>{
 const d=adaptive();d.detailVisible=true;d.mediaPresentation.main={frame:'plain',fit:'cover',align:'bottom'};
 const html=render(d);assert.equal((html.match(/data-media-chrome=/g)||[]).length,1);assert.match(html,/object-fit:cover;object-position:bottom/);assert.match(html,/object-fit:contain;object-position:top/);
});
test('old documents retain the existing main and detail rendering path',()=>{
 const d=api.createIndependentComposition();d.detailVisible=true;const html=render(d);
 assert.doesNotMatch(html,/data-media-frame|data-media-chrome/);assert.match(html,/data-composition-object="secondary"/);
});
test('auto single geometry is effective only, then showing secondary restores original duo',()=>{
 const d=adaptive(),saved=plain(d.placements);assert.deepEqual(plain(api.compositionFrame(d,'main')),d.singlePlacement);
 assert.deepEqual(plain(d.placements),saved);assert.deepEqual(plain(api.compositionFrame({...d,detailVisible:true},'main')),saved.main);
 assert.deepEqual(plain(api.compositionFrame({...d,detailVisible:true,hiddenIds:['secondary']},'main')),d.singlePlacement);
 const html=render(d);assert.match(html,/left:50%;top:54%;width:80%;height:70%/);
});
test('missing secondary resource is not interpreted as hidden',()=>{
 const d=adaptive();d.detailVisible=true;const html=renderToStaticMarkup(createElement(Renderer,{...props(d),secondarySrc:null}));
 assert.deepEqual(plain(api.compositionFrame(d,'main')),plain(d.placements.main));assert.doesNotMatch(html,/left:50%;top:54%;width:80%;height:70%/);
});
test('first media edit materializes effective frames in the same immutable update without jumping',()=>{
 const d=adaptive(),saved=plain(d),n=api.moveCompositionObject(d,'main',{centerX:.51},{width:1200,height:630});
 assert.equal(n.adaptiveMediaLayout,'manual');assert.equal(n.placements.main.centerX,.51);assert.equal(n.placements.main.widthRatio,.8);assert.deepEqual(plain(n.placements.secondary),saved.placements.secondary);assert.deepEqual(plain(d),saved);
 assert.deepEqual(plain(api.compositionFrame({...n,detailVisible:true},'main')),plain(n.placements.main));
});
test('other object edits and documents without adaptive fields retain layout behavior',()=>{
 const d=adaptive();d.objects=[{id:'panel',kind:'shape',name:'Panel',shape:'rect',fill:'#fff',frame:d.placements.main}];
 assert.equal(api.moveCompositionObject(d,'panel',{centerX:.5},{width:1200,height:630}).adaptiveMediaLayout,'auto');
 const old=api.createIndependentComposition();const n=api.moveCompositionObject(old,'main',{centerX:.5},{width:1200,height:630});assert.equal('adaptiveMediaLayout' in n,false);
});
test('layout helpers preserve old document identity and materialize both effective placements together',()=>{
 const old=api.createIndependentComposition();assert.equal(layout.resolveMediaPlacements(old),old.placements);assert.equal(layout.materializeMediaPlacements(old),old);
 const d=adaptive(),n=layout.materializeMediaPlacements(d);assert.equal(n.adaptiveMediaLayout,'manual');assert.deepEqual(plain(n.placements.main),d.singlePlacement);assert.deepEqual(plain(n.placements.secondary),plain(d.placements.secondary));
 const secondaryEdit=api.moveCompositionObject(d,'secondary',{centerX:.25},{width:1200,height:630});assert.deepEqual(plain(secondaryEdit.placements.main),d.singlePlacement);assert.equal(secondaryEdit.adaptiveMediaLayout,'manual');
});
test('inspector uses displayed geometry and exposes independent slot fit while retaining old Detail controls',()=>{
 const noop=()=>{};const inspect=(document,selected)=>renderToStaticMarkup(createElement(ImageControls,{document,selected,size:{width:1200,height:630},onChange:noop,onStart:noop,onFinish:noop,onRestore:noop,onResetTemplate:noop,onIndependent:noop}));
 const d=adaptive();const main=inspect(d,'main');assert.match(main,/aria-label="Object widthRatio"[^>]*value="960"/);assert.match(main,/aria-label="Image 1 fit"/);assert.doesNotMatch(main,/aria-label="Detail fit"/);
 assert.match(inspect(d,'secondary'),/aria-label="Image 2 fit"/);assert.match(inspect(api.createIndependentComposition(),'secondary'),/aria-label="Detail fit"/);
});
