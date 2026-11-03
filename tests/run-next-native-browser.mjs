import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {launchBrowser,downloadPng,selectElement,openImageAdvanced} from './helpers/browser.mjs';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),sharp=require('sharp');
const output=process.env.NEXT_OUTPUT||path.resolve(root,'../../../output/devsnapkit/next-native-export-2026-11-03','run-'+new Date().toISOString().replace(/[:.]/g,'-'));
const origin=process.env.NEXT_ORIGIN||'http://127.0.0.1:5391';
process.env.IMPACT_ORIGIN=origin;process.env.IMPACT_OUTPUT=output;
const {fresh,state,history,settle,fill,clickButton,setBrowser,fixtures}=await import('./run-pro-impact-browser.mjs');
const results={authoringOnly:false,publishedCatalogChanged:true,simulatedLicense:true,realPayment:false,checks:[],downloads:[],errors:[],startedAt:new Date().toISOString()};
let browser,server,page;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const pass=name=>{results.checks.push({name,passed:true});console.log('PASS '+name);};
async function captureState(name){await fs.writeFile(path.join(output,name+'.snapshot.json'),JSON.stringify(await state(page),null,2));}
async function screenshot(name){await page.mouse.move(0,0);await settle(page);await(await page.$('#studio-canvas')).screenshot({path:path.join(output,name+'.preview.png')});}
async function nativePng(name,scale=1){
 await clickButton(page,'Export');await clickButton(page,scale===1?'1x Web':'2x HD');await clickButton(page,'PNG');await settle(page);
 const before=await state(page),hist=await history(page);
 await page.evaluate(()=>{
  const measure=c=>{const b=c.getBoundingClientRect(),s=b.width/c.offsetWidth;return [...c.querySelectorAll('[data-canvas-text],[data-composition-object],[data-media-screen],[data-media-frame],[data-composition-decoration]')].map((n,i)=>{const r=n.getBoundingClientRect(),css=getComputedStyle(n);return {id:i+':'+(n.dataset.canvasText||n.dataset.compositionObject||n.dataset.compositionDecoration||n.tagName),x:(r.x-b.x)/s,y:(r.y-b.y)/s,width:r.width/s,height:r.height/s,shadow:css.boxShadow,radius:css.borderRadius};});};
  window.__nextPreviewGeometry=measure(document.querySelector('#studio-canvas'));window.__nextExportGeometry=null;
  window.__nextExportObserver=new MutationObserver(()=>{const c=document.querySelector('[data-export-target]>[data-canvas-root]');if(c)window.__nextExportGeometry=measure(c);});
  window.__nextExportObserver.observe(document.body,{subtree:true,childList:true,attributes:true});
 });
 const file=await downloadPng(page,output,name,()=>clickButton(page,'Download '+scale+'x ('+1080*scale+'×'+1920*scale+')'));
 const meta=await sharp(file.path).metadata();assert.equal(meta.width,1080*scale);assert.equal(meta.height,1920*scale);
 assert.deepEqual(await state(page),before,'Download keeps document');assert.deepEqual(await history(page),hist,'Download keeps history');
 const geo=await page.evaluate(()=>{window.__nextExportObserver.disconnect();return {preview:window.__nextPreviewGeometry,exported:window.__nextExportGeometry};});
 assert.ok(geo.exported);assert.equal(geo.preview.length,geo.exported.length);let maxDelta=0;
 for(const a of geo.preview){const b=geo.exported.find(x=>x.id===a.id);assert.ok(b,a.id);for(const k of ['x','y','width','height'])maxDelta=Math.max(maxDelta,Math.abs(a[k]-b[k]));assert.equal(a.shadow,b.shadow);assert.equal(a.radius,b.radius);}
 assert.ok(maxDelta<2,'Preview/export geometry '+maxDelta);
 await fs.writeFile(path.join(output,name+'.geometry.json'),JSON.stringify({...geo,maxDelta},null,2));
 results.downloads.push({file:path.basename(file.path),width:meta.width,height:meta.height,maxDelta,source:'actual-editor-download'});
 return file.path;
}
try{
 await fs.mkdir(output,{recursive:true});
 if(!process.env.NEXT_ORIGIN){
  server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5391','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await pause(100);}assert.ok(ready,'QA server started');
 }
 browser=await launchBrowser();setBrowser(browser);
 page=await fresh('free',390);page.on('pageerror',e=>results.errors.push(e.message));
 const freeBefore=await state(page),freeHistory=await history(page);
 await clickButton(page,'Templates');await page.click('[data-template-filter="9:16"]');
 assert.equal(await page.$$eval('[data-template-gallery] article',ns=>ns.length),3);
 await page.click('[aria-label="Preview NEXT Stage template"]');
 await page.waitForSelector('[data-template-preview][open]');
 await page.$eval('[data-template-preview] img',n=>n.decode());
 assert.ok(await page.$eval('[data-template-preview] img',n=>n.naturalWidth===1080&&n.naturalHeight===1920));
 assert.ok(await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth,document.querySelector('[data-template-preview]').getBoundingClientRect().width)<=390));
 await page.screenshot({path:path.join(output,'gallery-mobile-preview.png'),fullPage:true});
 await clickButton(page,'Close template preview');await page.click('[aria-label="Apply NEXT Stage template"]');
 await page.waitForSelector('[data-pro-modal]');
 assert.deepEqual(await state(page),freeBefore);assert.deepEqual(await history(page),freeHistory);
 pass('free users can preview NEXT at390px and Pro admission preserves their document');
 await page.close();page=await fresh('valid');page.on('pageerror',e=>results.errors.push(e.message));
 await clickButton(page,'Templates');const names=await page.$$eval('[data-template-gallery] article',ns=>ns.map(n=>n.textContent));
 assert.equal(names.length,16);assert.ok(names.some(s=>s.includes('NEXT Stage')));
 await page.click('[aria-label="Preview NEXT Stage template"]');await page.waitForSelector('[data-template-preview][open]');
 await page.$eval('[data-template-preview] img',n=>n.decode());await clickButton(page,'Close template preview');
 pass('published gallery includes NEXT with a complete native export preview');
 const before=await state(page),h=await history(page);
 await page.click('[aria-label="Apply NEXT Stage template"]');
 await page.waitForFunction(()=>window.__mockupBaseline.snapshot.templateContext?.id==='next-stage');await settle(page);
 const duo=await state(page);assert.equal((await history(page)).count,h.count+1);
 await clickButton(page,'Undo');assert.deepEqual(await state(page),before);await clickButton(page,'Redo');assert.deepEqual(await state(page),duo);
 pass('gallery Use template applies NEXT as one reversible history command');
 const layers=await page.evaluate(async()=>{
  const {textHorizontalExtent,textBoxIssue}=await import('/src/text/geometry.ts');
  const c=document.querySelector('#studio-canvas'),snap=window.__mockupBaseline.snapshot,b=c.getBoundingClientRect(),s=b.width/c.offsetWidth;
  const title=c.querySelector('[data-canvas-text="'+snap.templateContext.textRoles.headline+'"]');
  const r=title.getBoundingClientRect(),textParent=title.closest('[data-composition-text]');
  const horizontal=textHorizontalExtent(title,s),issue=textBoxIssue(snap.textDocument.layers.find(t=>t.id===snap.templateContext.textRoles.headline),{width:1080,height:1920},Math.max(title.offsetHeight,title.scrollHeight),title.offsetHeight,horizontal);
  return {text:title.textContent,titleZ:Number(getComputedStyle(textParent).zIndex),media:[...c.querySelectorAll('[data-composition-object="main"],[data-composition-object="secondary"]')].map(n=>{const r=n.getBoundingClientRect();return {slot:n.dataset.compositionObject,z:Number(getComputedStyle(n).zIndex),left:(r.left-b.left)/s,right:(r.right-b.left)/s,top:(r.top-b.top)/s,bottom:(r.bottom-b.top)/s};}),titleBounds:{x:(r.x-b.x)/s,y:(r.y-b.y)/s,width:r.width/s,height:r.height/s},textValidation:{horizontal,offsetHeight:title.offsetHeight,scrollHeight:title.scrollHeight,issue},imageCount:c.querySelectorAll('[data-media-screen] img').length,background:snap.bgImageSrc};
 });
 assert.equal(layers.text,'N\nE\nX\nT');assert.equal(layers.imageCount,2);assert.equal(layers.background,null);
 assert.ok(layers.media.every(n=>n.z>layers.titleZ));assert.ok(layers.titleBounds.y>=-1&&layers.titleBounds.y+layers.titleBounds.height<=1921);
 await fs.writeFile(path.join(output,'native-layers.json'),JSON.stringify(layers,null,2));
 assert.equal(layers.textValidation.issue,null,'Authored native headline must pass the actual export text validator');
 assert.ok(layers.media.every(m=>m.left>=0&&m.right<=1080&&m.top>=0&&m.bottom<=1920),'Authored native phones must stay fully inside the canvas');
 pass('editable NEXT glyphs are native DOM beneath two independently rendered phones');
 await captureState('default-duo');await screenshot('default-duo');await nativePng('default-duo-1x.png',1);await nativePng('default-duo-2x.png',2);
 pass('real native PNG1080x1920 and2160x3840 with matching preview/export geometry');
 await selectElement(page,'Headline');await clickButton(page,'Text');
 await page.click('[data-canvas-text-controls] [aria-label="Edit text"]');
 await fill(page,'[aria-label="Text content"]','B\nO\nL\nD');await clickButton(page,'Text');await settle(page);
 const edited=await state(page);assert.equal(edited.textDocument.layers.find(t=>t.id===edited.templateContext.textRoles.headline).content,'B\nO\nL\nD');
 assert.equal(edited.imageSrc,duo.imageSrc);assert.equal(edited.secondarySrc,duo.secondarySrc);
 await nativePng('edited-headline-1x.png',1);await clickButton(page,'Undo');assert.deepEqual(await state(page),duo);pass('four-line headline edits in Inspector and Undo restores complete document');
 await clickButton(page,'Frame');await clickButton(page,'Hide Image 2');await settle(page);
 const single=await state(page);assert.equal(single.secondarySrc,duo.secondarySrc);assert.equal(single.compositionDocument.detailVisible,false);
 assert.equal(await page.$$eval('#studio-canvas [data-media-screen] img',ns=>ns.length),1);
 await captureState('single');await screenshot('single');await nativePng('single-1x.png',1);
 await clickButton(page,'Undo');assert.deepEqual(await state(page),duo);pass('authored single layout exports and preserves hidden source for Undo');
 const fixtureDir=await fixtures();await clickButton(page,'Frame');
 await(await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(fixtureDir,'dark.png'));
 await page.waitForFunction(()=>window.__mockupBaseline.snapshot.imageName==='dark.png');
 const main=await state(page);assert.equal(main.secondarySrc,duo.secondarySrc);
 await(await page.$('[aria-label="Second screenshot file"]')).uploadFile(path.join(fixtureDir,'long.png'));
 await page.waitForFunction(()=>window.__mockupBaseline.snapshot.secondaryName==='long.png');
 const own=await state(page);assert.equal(own.imageSrc,main.imageSrc);await settle(page);
 await captureState('user-duo');await nativePng('user-duo-1x.png',1);pass('independent user screenshot replacements preserve the other source');
 await selectElement(page,'Image 1');await openImageAdvanced(page);await clickButton(page,'Restore layout');
 assert.equal((await state(page)).imageSrc,own.imageSrc);assert.equal((await state(page)).secondarySrc,own.secondarySrc);
 await clickButton(page,'Reset');assert.equal((await state(page)).imageSrc,own.imageSrc);assert.equal((await state(page)).secondarySrc,own.secondarySrc);
 assert.deepEqual((await state(page)).textDocument,own.textDocument);pass('native Restore layout and Reset retain user media and copy');
 assert.deepEqual(results.errors,[]);results.passed=true;
 console.log(JSON.stringify({passed:true,checks:results.checks.length,output}));
}catch(error){
 results.passed=false;results.failure=error.stack;process.exitCode=1;console.error(error.stack);
 await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});
}finally{
 await browser?.close();server?.kill();results.finishedAt=new Date().toISOString();
 await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
}
