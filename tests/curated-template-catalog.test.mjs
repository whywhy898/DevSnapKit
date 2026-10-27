import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const api=fs.existsSync(new URL('../src/templates/collection/apply.ts',import.meta.url))?load('templates/collection/apply.ts'):{};
const base={imageSrc:'mine.png',imageName:'My main',windowTitle:'Own title',primaryMediaOrigin:{kind:'user'},secondarySrc:'detail.png',secondaryName:'My detail',secondaryMediaOrigin:{kind:'user'},textDocument:{version:1,layers:[]},layoutMode:'duo',customBrandWatermark:'Brand',logoDataUrl:'logo',qrUrl:'https://own.example'};
const json=x=>JSON.parse(JSON.stringify(x));
const build=(before=base)=>{assert.equal(typeof api.buildCuratedSnapshot,'function','Paper factory must be implemented');return api.buildCuratedSnapshot(before,'paper-launch-duo','paper');};
test('Paper is a free 1200 canvas with editable stable roles and distinct native browser samples',()=>{
 const n=build({...base,imageSrc:'builtin',primaryMediaOrigin:{kind:'builtin'},secondarySrc:null});
 assert.deepEqual(json(n.customCanvasSize),{width:1200,height:630});assert.equal(n.solidColor,'#F6F3EC');
 assert.notEqual(n.imageSrc,n.secondarySrc);assert.match(n.imageSrc,/folio-workspace/);assert.match(n.secondarySrc,/folio-task-detail/);
 assert.equal(n.compositionDocument.mediaPresentation.main.frame,'browser-light');assert.equal(n.compositionDocument.adaptiveMediaLayout,'auto');
 assert.equal(n.compositionDocument.objects.find(o=>o.id==='cta').arrow,false);
 assert.equal(n.textDocument.layers.find(t=>t.id==='paper-website').content,'folio.example');
 assert.equal(n.compositionDocument.singlePlacement.widthRatio,640/1200);
 for(const role of ['brand','eyebrow','headline','description','website'])assert.ok(n.textDocument.layers.some(t=>t.id===n.templateContext.textRoles[role]));
 assert.equal(n.templateContext.version,1);assert.equal(n.isProUnlocked,undefined);
});
test('Paper preserves user and unknown sources, names, Brand and QR without mutating input',()=>{
 for(const origin of [{kind:'user'},undefined,{kind:'unknown'}]){const b={...base,primaryMediaOrigin:origin,secondaryMediaOrigin:origin},saved=json(b),n=build(b);assert.deepEqual(json(b),saved);for(const k of ['imageSrc','imageName','secondarySrc','secondaryName','windowTitle','customBrandWatermark','logoDataUrl','qrUrl'])assert.equal(n[k],b[k]);}
});
test('one user image and hidden secondary remain single without injecting demo content',()=>{
 const one=build({...base,secondarySrc:null});assert.equal(one.secondarySrc,null);assert.equal(one.compositionDocument.detailVisible,false);
 for(const src of [null,'hidden.png']){const n=build({...base,secondarySrc:src,compositionDocument:{detailVisible:false,hiddenIds:[]}});assert.equal(n.secondarySrc,src);assert.equal(n.compositionDocument.detailVisible,false);}
 const hidden=build({...base,compositionDocument:{detailVisible:true,hiddenIds:['secondary']}});assert.equal(hidden.secondarySrc,'detail.png');assert.equal(hidden.compositionDocument.detailVisible,false);
});
test('restore and reset preserve deleted objects, hidden status, custom content and sources',()=>{
 const b=build();b.compositionDocument.objects=b.compositionDocument.objects.filter(o=>o.id!=='brand-mark');b.textDocument.layers=b.textDocument.layers.filter(t=>t.id!=='paper-brand');
 b.compositionDocument.detailVisible=false;b.compositionDocument.adaptiveMediaLayout='manual';b.compositionDocument.placements.main.centerX=.8;
 const c=b.compositionDocument.objects.find(o=>o.id==='cta');c.text='Own CTA';c.fill='#ff0000';c.hidden=true;c.frame.centerX=.2;
 const saved=json(b),r=api.restoreCuratedLayout(b),s=api.resetCuratedStyles(b);assert.deepEqual(json(b),saved);
 for(const n of [r,s]){assert.equal(n.imageSrc,base.imageSrc);assert.equal(n.compositionDocument.detailVisible,false);assert.equal(n.compositionDocument.objects.some(o=>o.id==='brand-mark'),false);assert.equal(n.textDocument.layers.some(t=>t.id==='paper-brand'),false);assert.equal(n.compositionDocument.objects.find(o=>o.id==='cta').text,'Own CTA');assert.equal(n.compositionDocument.objects.find(o=>o.id==='cta').hidden,true);}
 assert.equal(r.compositionDocument.adaptiveMediaLayout,'auto');assert.equal(r.compositionDocument.objects.find(o=>o.id==='cta').fill,'#ff0000');assert.equal(s.compositionDocument.objects.find(o=>o.id==='cta').frame.centerX,.2);assert.notEqual(s.compositionDocument.objects.find(o=>o.id==='cta').fill,'#ff0000');
});
test('Honey dispatcher retains v2 applications and versioned v1 restores; unknown IDs fail closed',()=>{
 build();const n=api.buildCuratedSnapshot(base,'editorial-honey','h');assert.equal(n.templateContext.version,2);
 const old={...n,templateContext:{...n.templateContext,version:1}};assert.equal(api.restoreCuratedLayout(old).compositionDocument.placements.secondary.widthRatio,410/1600);
 assert.throws(()=>api.buildCuratedSnapshot(base,'studio-bridge','n'),/Unknown|unavailable/i);assert.throws(()=>api.buildCuratedSnapshot(base,'made-up','x'),/Unknown|unavailable/i);
});
test('published catalog contains implemented Honey, Paper and Pro Night/Pocket with accessible Apply actions',()=>{
 build();const {CURATED_TEMPLATE_CATALOG:catalog,getCuratedTemplate}=load('templates/collection/catalog.ts');assert.deepEqual(json(catalog.map(t=>t.id)),['editorial-honey','paper-launch-duo','calm-split','app-pair','night-signal-duo','pocket-flow-duo']);assert.ok(catalog.slice(0,4).every(t=>t.tier==='free'));assert.equal(getCuratedTemplate('night-signal-duo').tier,'pro');assert.equal(getCuratedTemplate('pocket-flow-duo').tier,'pro');assert.equal(getCuratedTemplate('studio-bridge'),undefined);
 const {TemplateMenu}=load('templates/TemplateMenu.tsx');const html=renderToStaticMarkup(createElement(TemplateMenu,{onApply:()=>{},onDesignedApply:()=>{},disabled:false,busy:false}));
 assert.match(html,/aria-label="Apply Paper Launch Duo template"/);assert.match(html,/1200/);assert.match(html,/aria-label="Apply Pocket Flow Duo template"/);assert.match(html,/pocket-flow-duo/);
 const provenance=JSON.parse(fs.readFileSync(new URL('../public/designed/collection/paper-launch-provenance.json',import.meta.url)));
 assert.match(html,/paper-launch-duo\.webp/);assert.match(provenance.method,/actual browser-triggered editor PNG/);assert.equal(provenance.records.find(r=>r.file==='paper-launch-duo.webp').width,480);
});
test('a Paper snapshot is one history command and Undo returns the complete prior document',()=>{
 const {EditorHistory}=load('editorHistory.ts');const history=new EditorHistory(base);const next=build();history.flush(next);assert.equal(history.count,2);assert.deepEqual(json(history.undo(next)),json(base));assert.deepEqual(json(history.redo()),json(next));
});
test('Paper default CTA fits its line box and centers its label while legacy buttons keep their layout',()=>{
 const n=build(),cta=n.compositionDocument.objects.find(o=>o.id==='cta');
 assert.ok(cta.fontSize*1.3+cta.padding*2 <= cta.frame.heightRatio*n.customCanvasSize.height,'CTA line box and padding must fit its frame');
 const {ButtonRenderer}=load('composition/ButtonRenderer.tsx');
 const html=renderToStaticMarkup(createElement(ButtonRenderer,{object:cta}));assert.match(html,/justify-content:center/);assert.doesNotMatch(html,/<svg/);
 const honey=api.buildCuratedSnapshot(base,'editorial-honey','legacy');const legacy=renderToStaticMarkup(createElement(ButtonRenderer,{object:honey.compositionDocument.objects.find(o=>o.id==='cta')}));assert.match(legacy,/justify-content:space-between/);
 assert.equal(n.textDocument.layers.find(t=>t.id==='paper-eyebrow').content,'A CALMER WAY TO WORK');assert.equal(n.textDocument.layers.find(t=>t.id==='paper-description').content,'One clear place for your next idea.');
});
