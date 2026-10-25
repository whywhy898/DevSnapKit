import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { launchBrowser,clickButton,downloadPng,finishTextEditing } from './helpers/browser.mjs';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const output=process.env.WHOLE_CARD_OUTPUT||path.resolve(root,'../../output/devsnapkit/whole-card-free-brand/m1/task2');
const origin=process.env.WHOLE_CARD_ORIGIN||'http://127.0.0.1:5204';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let server,browser;const results=[],errors=[];
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(i=>i.decode()));});await pause(400);}
async function exportPng(page,name,scale){
  await clickButton(page,'Export');await clickButton(page,scale===1?'1x Web':'2x HD');await page.mouse.move(0,0);await settle(page);
  await page.evaluate(()=>{
    const measure=c=>{const b=c.getBoundingClientRect(),s=b.width/c.offsetWidth;return [...c.querySelectorAll('[data-canvas-text],[data-composition-object],[data-scene-bounds]')].map((n,i)=>{const r=n.getBoundingClientRect();return {id:n.dataset.canvasText||n.dataset.compositionObject||'scene-'+i,x:(r.x-b.x)/s,y:(r.y-b.y)/s,w:r.width/s,h:r.height/s};});};
    window.__wholePreview=measure(document.querySelector('#studio-canvas'));window.__wholeExport=null;
    window.__wholeObserver=new MutationObserver(()=>{const c=document.querySelector('[data-export-target]>[data-canvas-root]');if(c)window.__wholeExport=measure(c);});window.__wholeObserver.observe(document.body,{subtree:true,childList:true,attributes:true});
  });
  const downloaded=await downloadPng(page,output,name,()=>clickButton(page,`Download ${scale}x (${1600*scale}×${1200*scale})`));
  const meta=await sharp(downloaded.path).metadata();assert.equal(meta.width,1600*scale);assert.equal(meta.height,1200*scale);
  const geometry=await page.evaluate(()=>{window.__wholeObserver.disconnect();return {preview:window.__wholePreview,exported:window.__wholeExport};});assert.ok(geometry.exported);
  let delta=0;for(const n of geometry.preview){const actual=geometry.exported.find(e=>e.id===n.id);assert.ok(actual,n.id);for(const k of ['x','y','w','h'])delta=Math.max(delta,Math.abs(n[k]-actual[k]));}assert.ok(delta<=2,`geometry delta ${delta}`);
  await fs.writeFile(path.join(output,name+'.geometry.json'),JSON.stringify({geometry,maxDelta:delta},null,2));
  await page.screenshot({path:path.join(output,name+'.editor.png'),fullPage:true});
  return {file:downloaded.path,width:meta.width,height:meta.height,maxGeometryDelta:delta};
}
try{
  await fs.mkdir(output,{recursive:true});
  if(!process.env.WHOLE_CARD_ORIGIN){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5204','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await pause(100);}}
  browser=await launchBrowser();const page=await browser.newPage();await page.setViewport({width:1800,height:1300,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/?editor=1',{waitUntil:'domcontentloaded'});await page.waitForSelector('button[aria-label="Templates"]');await settle(page);
  const old=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/whole-card/v1-customized-snapshot.json'),'utf8'));
  await page.evaluate(s=>window.__mockupBaseline.apply(s),old);await settle(page);
  for(const role of ['detail-label','detail-status','detail-heading']){
    const id=old.templateContext.textRoles[role];assert.ok(await page.$(`[data-canvas-text="${id}"]`));
    await page.click(`[data-text-hit="${id}"]`);await page.waitForSelector('[aria-label="Text content"]',{visible:true});
    await page.focus('[aria-label="Text content"]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('Edited '+role);await finishTextEditing(page);await settle(page);
    assert.equal(await page.evaluate(id=>window.__mockupBaseline.snapshot.textDocument.layers.find(n=>n.id===id).content,id),'Edited '+role);
  }
  results.push({scenario:'real-v1-open-edit-export',...(await exportPng(page,'v1-customized-1x.png',1))});
  await clickButton(page,'Frame');await page.$eval('[data-image-advanced]',n=>{if(!n.open)n.querySelector('summary').click();});page.once('dialog',dialog=>dialog.accept());await clickButton(page,'Restore layout');await settle(page);
  const restored=await page.evaluate(()=>window.__mockupBaseline.snapshot);assert.equal(restored.templateContext.version,1);assert.deepEqual(restored.compositionDocument.placements.secondary,old.compositionDocument.placements.secondary);assert.equal(restored.secondarySrc,old.secondarySrc);
  results.push({scenario:'v1-restore-decomposed-bounds',pass:true});
  // Start with the neutral real v1 state, then use the shipped template action.
  const neutral=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/whole-card/v1-neutral-snapshot.json'),'utf8'));
  await page.evaluate(s=>window.__mockupBaseline.apply(s),neutral);await settle(page);
  await page.click('button[aria-label="Templates"]');await page.click('button[aria-label="Apply Editorial Honey template"]');await settle(page);
  const next=await page.evaluate(()=>window.__mockupBaseline.snapshot);assert.equal(next.templateContext.version,2);assert.equal(next.textDocument.layers.length,8);assert.equal(next.secondarySrc,'/designed/examples/bloom-workflow-card.png');
  const card=await page.evaluate(()=>{const img=document.querySelector('[data-composition-object="secondary"] img');return {natural:[img.naturalWidth,img.naturalHeight],fit:getComputedStyle(img).objectFit};});assert.deepEqual(card,{natural:[1800,1160],fit:'contain'});
  results.push({scenario:'v2-ui-apply-export-1x',...(await exportPng(page,'v2-whole-card-1x.png',1))});
  results.push({scenario:'v2-ui-apply-export-2x',...(await exportPng(page,'v2-whole-card-2x.png',2))});
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'results.json'),JSON.stringify({results,errors},null,2));console.log('PASS '+results.map(r=>r.scenario).join(', '));
}catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,errors,results},null,2));throw error;}
finally{await browser?.close();server?.kill();}
