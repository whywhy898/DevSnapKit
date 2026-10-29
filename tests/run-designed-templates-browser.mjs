import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { launchBrowser,clickButton,downloadPng,finishTextEditing } from './helpers/browser.mjs';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const output=process.env.DESIGNED_OUTPUT||path.resolve(root,'../../output/devsnapkit/whole-card-free-brand/m1/designed-runs',new Date().toISOString().replace(/[:.]/g,'-'));
const origin=process.env.DESIGNED_ORIGIN||'http://127.0.0.1:5198';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let server,browser;const results=[],errors=[];
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(i=>i.decode()));});await pause(700);}
async function editRole(page,role,value){
  const id=await page.evaluate(role=>window.__mockupBaseline.snapshot.textDocument.layers.find(l=>l.id.endsWith('-'+role)).id,role);
  await page.click(`[data-text-hit="${id}"]`);
  await pause(200);
  if (!await page.$('[aria-label="Text content"]')) { assert.equal(await page.$eval('[aria-label="Current text"]', el => el.value), id); await clickButton(page, 'Edit text'); }
  await page.waitForSelector('[aria-label="Text content"]');await page.focus('[aria-label="Text content"]');
  await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type(value);await finishTextEditing(page);await settle(page);
}
async function replaceTitleSegment(page,oldText,newText){
  await page.$eval('[aria-label="Text content"]',(n,value)=>{n.focus();const start=n.value.indexOf(value);if(start<0)throw Error('Missing title segment');n.setSelectionRange(start,start+value.length);n.dispatchEvent(new Event('select',{bubbles:true}));},oldText);
  await page.keyboard.type(newText);
}
// Input preparation only: original-brand artwork stays in the private output
// directory and is subsequently uploaded through the real product UI.
async function prepareInternalReferenceCard(browser,original){
  const file=path.join(output,'honeywerank-workflow-card-reference.png');
  const image='data:image/png;base64,'+(await fs.readFile(path.join(original,'honeywerank-publishing.png'))).toString('base64');
  const input=await browser.newPage();
  try{
    await input.setViewport({width:450,height:290,deviceScaleFactor:4});
    await input.setContent('<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;width:450px;height:290px}body{background:white;border:1px solid #eae2be;border-radius:18px;font-family:Arial,sans-serif;overflow:hidden}.label{position:absolute;top:22px;font-size:10px;font-weight:600;color:#8c7c45;letter-spacing:1px;text-transform:uppercase}.left{left:20px}.right{right:20px}h1{position:absolute;left:20px;top:48px;margin:0;font-size:17px;font-weight:800;letter-spacing:-.3px;line-height:22px}img{position:absolute;left:20px;top:86px;width:410px;height:184px;object-fit:contain}</style></head><body><span class="label left">How it works</span><span class="label right">Illustrative workflow</span><h1>Publish content. Build authority.</h1><img></body></html>');
    await input.$eval('img',(node,src)=>{node.src=src;},image);await input.evaluate(async()=>{await document.fonts.ready;await document.querySelector('img').decode();});
    await input.screenshot({path:file});return file;
  }finally{await input.close();}
}
async function exportPng(page,name,scale){
  await clickButton(page,'Export');await clickButton(page,scale===1?'1x Web':'2x HD');await page.mouse.move(0,0);await settle(page);
  await page.evaluate(()=>{
    const measure=c=>{const b=c.getBoundingClientRect(),s=b.width/c.offsetWidth;return [...c.querySelectorAll('[data-canvas-text],[data-composition-object],[data-scene-bounds]')].map((n,i)=>{const r=n.getBoundingClientRect();return {id:n.dataset.canvasText||n.dataset.compositionObject||'scene-'+i,x:(r.x-b.x)/s,y:(r.y-b.y)/s,w:r.width/s,h:r.height/s};});};
    window.__designedPreview=measure(document.querySelector('#studio-canvas'));window.__designedExport=null;
    window.__designedObserver?.disconnect();window.__designedObserver=new MutationObserver(()=>{const c=document.querySelector('[data-export-target]>[data-canvas-root]');if(c)window.__designedExport=measure(c);});window.__designedObserver.observe(document.body,{subtree:true,childList:true,attributes:true});
  });
  const downloaded=await downloadPng(page,output,name,()=>clickButton(page,`Download ${scale}x (${1600*scale}×${1200*scale})`));
  const meta=await sharp(downloaded.path).metadata();assert.equal(meta.width,1600*scale);assert.equal(meta.height,1200*scale);
  const geometry=await page.evaluate(()=>{window.__designedObserver.disconnect();return {preview:window.__designedPreview,exported:window.__designedExport};});assert.ok(geometry.exported);
  let delta=0;for(const n of geometry.preview){const actual=geometry.exported.find(e=>e.id===n.id);assert.ok(actual,n.id);for(const k of ['x','y','w','h'])delta=Math.max(delta,Math.abs(n[k]-actual[k]));}assert.ok(delta<=2,`geometry delta ${delta}`);
  await fs.writeFile(path.join(output,name.replace('.png','.geometry.json')),JSON.stringify({geometry,maxDelta:delta},null,2));
  await page.screenshot({path:path.join(output,name.replace('.png','.editor.png')),fullPage:true});
  return {...downloaded,maxGeometryDelta:delta};
}
try{
  await fs.mkdir(output,{recursive:true});
  if(!process.env.DESIGNED_ORIGIN){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5198','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await pause(100);}}
  browser=await launchBrowser();const page=await browser.newPage();await page.setViewport({width:1800,height:1300,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/?editor=1',{waitUntil:'domcontentloaded'});await page.waitForSelector('button[aria-label="Templates"]');await settle(page);
  await page.click('button[aria-label="Templates"]');await page.click('button[aria-label="Apply Editorial Honey template"]');await page.waitForSelector('#studio-canvas [data-composition-object="secondary"]');await settle(page);
  const state=await page.evaluate(()=>window.__mockupBaseline?.snapshot);assert.equal(state?.compositionDocument?.templateId,'editorial-honey');assert.equal(state.textDocument.layers.length,8);
  results.push({scenario:'neutral-honey-1x',...(await exportPng(page,'editorial-honey-neutral-1600x1200.png',1))});
  results.push({scenario:'neutral-honey-2x',...(await exportPng(page,'editorial-honey-neutral-3200x2400.png',2))});
  await clickButton(page,'Frame');
  await page.click('button[aria-label="Select Image 2"]');await settle(page);
  const beforeMove=await page.evaluate(()=>structuredClone(window.__mockupBaseline.snapshot.compositionDocument.placements.secondary));
  const handle=await page.$('[aria-label="Move selected object"]'),box=await handle.boundingBox();assert.ok(box);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2-25,{steps:12});await page.mouse.up();await settle(page);
  const afterMove=await page.evaluate(()=>window.__mockupBaseline.snapshot.compositionDocument.placements.secondary);assert.ok(afterMove.centerX>beforeMove.centerX);assert.ok(afterMove.centerY<beforeMove.centerY);
  await clickButton(page,'Undo');await settle(page);assert.deepEqual(await page.evaluate(()=>window.__mockupBaseline.snapshot.compositionDocument.placements.secondary),beforeMove,'one undo restores detail movement');
  await page.click('[aria-label="Elements"]');await page.click('button[aria-label="Select Call to action"]');await page.waitForSelector('[aria-label="Button label"]');
  await page.$eval('[aria-label="Button label"]',n=>n.focus());await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('Start creating');await clickButton(page,'Canvas');await settle(page);
  assert.equal(await page.evaluate(()=>window.__mockupBaseline.snapshot.compositionDocument.objects.find(n=>n.id==='cta').text),'Start creating');
  results.push({scenario:'detail-drag-undo-and-cta-edit',pass:true});
  // Internal reference version: actual file upload and editable controls only.
  // Original-brand assets stay outside the public customer build.
  const original=path.resolve(root,'../../output/devsnapkit');
  const referenceCard=await prepareInternalReferenceCard(browser,original);
  await (await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(original,'honeywerank-original.png'));
  await (await page.$('[aria-label="Second screenshot file"]')).uploadFile(referenceCard);
  await page.waitForFunction(()=>window.__mockupBaseline.snapshot.imageName==='honeywerank-original.png'&&window.__mockupBaseline.snapshot.secondaryName==='honeywerank-workflow-card-reference.png');await settle(page);
  await editRole(page,'brand','HoneyWeRank');await editRole(page,'badge','Join the waitlist');
  const headline=await page.evaluate(()=>window.__mockupBaseline.snapshot.templateContext.textRoles.headline);await page.click(`[data-text-hit="${headline}"]`);if(!await page.$('[aria-label="Text content"]')){assert.equal(await page.$eval('[aria-label="Current text"]',el=>el.value),headline);await clickButton(page,'Edit text');}await page.waitForSelector('[aria-label="Text content"]');
  await replaceTitleSegment(page,'Make room','Be the');await replaceTitleSegment(page,'for your','brand AI');await replaceTitleSegment(page,'next idea.','recommends.');await finishTextEditing(page);await settle(page);
  const emphasized=await page.evaluate(()=>window.__mockupBaseline.snapshot.textDocument.layers.find(n=>n.id===window.__mockupBaseline.snapshot.templateContext.textRoles.headline).runs);assert.ok(emphasized.some(r=>r.text.includes('recommends.')&&r.font==='gelasio'&&r.italic));
  await editRole(page,'description','Content. Publishing. Backlinks.\nA sweeter way to get discovered.');
  // The complete second screenshot already contains the original card heading.
  await editRole(page,'website','honeywerank.com ↗');
  await editRole(page,'disclosure','Product preview · Dashboard contains illustrative sample data');
  await page.click('[aria-label="Elements"]');await page.click('button[aria-label="Select Call to action"]');
  await page.focus('[aria-label="Button label"]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('Join the waitlist');await clickButton(page,'Frame');await page.click('button[aria-label="Select Image 1"]');
  // Window title is a shipped editable input, found by its actual default value.
  await page.evaluate(()=>{const input=[...document.querySelectorAll('input')].find(n=>n.value==='bloomboard.example'&&n.getClientRects().length);if(input)input.focus();});
  const titleFocused=await page.evaluate(()=>document.activeElement?.value==='bloomboard.example');
  assert.equal(titleFocused,true,'Actual browser window title input is accessible');
  await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('honeywerank.com');
  await finishTextEditing(page);await settle(page);
  results.push({scenario:'internal-reference-honey-1x',...(await exportPng(page,'editorial-honey-internal-1600x1200.png',1))});
  results.push({scenario:'internal-reference-honey-2x',...(await exportPng(page,'editorial-honey-internal-3200x2400.png',2))});
  // Diagnostic setup only: fault injection exercises production admission and
  // download, never substitutes the renderer or creates delivery artwork.
  await page.evaluate(()=>{window.__validCompositionSnapshot=structuredClone(window.__mockupBaseline.snapshot);const s=structuredClone(window.__validCompositionSnapshot);s.compositionDocument.objects=s.compositionDocument.objects.map(n=>n.kind==='button'?{...n,autoWidth:true,text:'A'.repeat(400)}:n);window.__mockupBaseline.apply(s);});await settle(page);
  await clickButton(page,'Export');await clickButton(page,'1x Web');await clickButton(page,'Download 1x (1600×1200)');
  await page.waitForFunction(()=>document.querySelector('[data-text-export-error]')?.textContent.includes('button text is empty or overflows'));
  results.push({scenario:'auto-width-cta-overflow-blocked',pass:true});
  await page.evaluate(()=>{const s=structuredClone(window.__validCompositionSnapshot);s.secondarySrc=null;s.compositionDocument.detailVisible=true;s.compositionDocument.hiddenIds.push('secondary');window.__mockupBaseline.apply(s);});await settle(page);
  results.push({scenario:'hidden-empty-secondary-allowed',...(await exportPng(page,'hidden-detail-check.png',1))});
  await page.evaluate(()=>{const s=structuredClone(window.__validCompositionSnapshot);s.secondarySrc=null;window.__mockupBaseline.apply(s);});await settle(page);
  await clickButton(page,'Export');await clickButton(page,'1x Web');await clickButton(page,'Download 1x (1600×1200)');await page.waitForFunction(()=>!!document.querySelector('[data-text-export-error]')?.textContent);results.push({scenario:'visible-empty-secondary-blocked',pass:true});
  await page.evaluate(()=>{const s=structuredClone(window.__validCompositionSnapshot);s.compositionDocument.allowBleed=true;s.compositionDocument.placements.main.centerX=.98;window.__mockupBaseline.apply(s);});await settle(page);
  let confirmations=0;page.once('dialog',async dialog=>{confirmations++;assert.match(dialog.message(),/clipped/);await dialog.dismiss();});await clickButton(page,'Download 1x (1600×1200)');await pause(1000);assert.equal(confirmations,1,'cropping asks for confirmation');
  page.once('dialog',async dialog=>{confirmations++;await dialog.accept();});results.push({scenario:'image-bleed-confirm-accept',...(await exportPng(page,'confirmed-crop.png',1))});
  page.once('dialog',async dialog=>{confirmations++;await dialog.dismiss();});await clickButton(page,'Download 1x (1600×1200)');await pause(1000);assert.equal(confirmations,3,'a prior crop confirmation cannot authorize a later export');results.push({scenario:'image-bleed-cancel-and-confirmation-not-reused',pass:true});
  for(const file of ['phone.png','square.png','logo.png']){
    await page.evaluate(()=>window.__mockupBaseline.apply(structuredClone(window.__validCompositionSnapshot)));await settle(page);
    await(await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(root,'tests/fixtures/poster-v1',file));await page.waitForFunction(file=>window.__mockupBaseline.snapshot.imageName===file,{},file);await settle(page);
    const fit=await page.evaluate(()=>{const img=document.querySelector('[data-composition-object="main"] [data-media-surface] img');return {fit:img&&getComputedStyle(img).objectFit,natural:img&&[img.naturalWidth,img.naturalHeight]};});assert.equal(fit.fit,'contain');results.push({scenario:`contain-replacement-${file}`,fit,...(await exportPng(page,`replacement-${file}`,1))});
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'results.json'),JSON.stringify({results,errors},null,2));console.log('PASS Honey neutral actual UI exports:1600×1200,3200×2400');
}catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,errors,results},null,2));throw error;}
finally{await browser?.close();server?.kill();}
