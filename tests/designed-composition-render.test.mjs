import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const path=new URL('../src/composition/CompositionRenderer.tsx',import.meta.url);
const Renderer=fs.existsSync(path)?load('composition/CompositionRenderer.tsx').CompositionRenderer:null;
const doc=load('composition/document.ts').createIndependentComposition();
test('shared composition renders only the two canonical screenshot roles and visible CTA',()=>{
  assert.equal(typeof Renderer,'function','shared composition renderer is not implemented');
  doc.detailVisible=true;doc.objects=[{id:'cta',kind:'button',name:'Join',frame:{centerX:.2,centerY:.5,widthRatio:.2,heightRatio:.05,rotation:0},text:'Join the waitlist',color:'#fff',fill:'#111',fontSize:20,radius:8,padding:12,autoWidth:false,arrow:true}];doc.order=['main','secondary','cta'];
  const html=renderToStaticMarkup(createElement(Renderer,{document:doc,size:{width:1600,height:1200},imageSrc:'main.svg',imageName:'Main',secondarySrc:'second.svg',secondaryName:'Second',windowTheme:'browser',windowTitle:'demo.example',shadowLevel:'soft',shadowOpacity:35,cornerStyle:'default',roundedCorners:14,hideMockup:false,layoutPreset:'flat',textDocument:{version:1,layers:[]},preview:false}));
  assert.match(html,/data-composition-object="main"/);assert.match(html,/data-composition-object="secondary"/);assert.match(html,/Join the waitlist/);assert.doesNotMatch(html,/Select Media|data-text-editor-ui/);
  assert.equal((html.match(/src="main.svg"/g)||[]).length,1);assert.equal((html.match(/src="second.svg"/g)||[]).length,1);
});
