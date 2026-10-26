import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { launchBrowser, clickButton } from './helpers/browser.mjs';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const output=process.env.BRAND_LEGACY_OUTPUT||path.resolve(root,'../../output/devsnapkit/whole-card-free-brand/m2/legacy-brand',new Date().toISOString().replace(/[:.]/g,'-'));
const origin='http://127.0.0.1:5219';const pause=ms=>new Promise(r=>setTimeout(r,ms));let browser,server;
try{
  await fs.mkdir(output,{recursive:true});server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5219','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break}}catch{}await pause(100)}assert.ok(ready);
  browser=await launchBrowser();const page=await browser.newPage();await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});
  await page.evaluateOnNewDocument(()=>localStorage.setItem('devsnapkit_welcome_seen','1'));
  await page.goto(origin+'/?editor=1',{waitUntil:'networkidle0'});await page.waitForSelector('#studio-canvas');
  await page.click('[aria-label="Templates"]');await page.click('[aria-label="Apply Editorial Honey template"]');await page.waitForSelector('[data-composition-object="secondary"]');
  await page.evaluate(()=>window.__mockupBaseline.apply({customBrandWatermark:'My old saved brand'}));
  await clickButton(page,'Text');await page.focus('input[aria-label="Saved brand text"]');
  await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');
  await page.waitForFunction(()=>window.__mockupBaseline.snapshot.customBrandWatermark==='');
  await page.keyboard.press('Tab');await pause(100);
  assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),false,'clearing legacy text must finish its transaction on blur');
  await clickButton(page,'Undo');await page.waitForFunction(()=>window.__mockupBaseline.snapshot.customBrandWatermark==='My old saved brand');
  await clickButton(page,'Redo');await page.waitForFunction(()=>window.__mockupBaseline.snapshot.customBrandWatermark==='');
  assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),false);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.click('[aria-label="Elements"]');await page.click('[aria-label="Select Image 1"]');
  for(const label of ['QR website URL','Logo size percent']){
    await clickButton(page,'Brand');await page.focus(`[aria-label="${label}"]`);
    await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type(label.startsWith('QR')?'https://bloomboard.example/history':'5');
    const before=await page.evaluate(()=>window.__mockupBaseline.snapshot.compositionDocument.placements.main.centerX);
    const move=await page.$('[aria-label="Move selected object"]'),box=await move.boundingBox();assert.ok(box);
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+12,box.y+box.height/2,{steps:3});await page.mouse.up();
    assert.deepEqual(errors,[],'a focused Brand field must finish before a canvas gesture');
    assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),false);
    assert.notEqual(await page.evaluate(()=>window.__mockupBaseline.snapshot.compositionDocument.placements.main.centerX),before);
    if(label==='Logo size percent')assert.equal(await page.evaluate(()=>window.__mockupBaseline.snapshot.compositionDocument.objects.find(n=>n.id==='brand-mark').frame.heightRatio),.05,'leaving numeric draft for canvas commits its value');
  }
  const result={pass:true,scenarios:['existing saved badge editable in Text','empty draft remains mounted until blur','empty edit is one transaction','Undo restores exact saved content','Redo deletes without dangling transaction','focused QR to canvas drag','focused numeric draft to canvas drag']};
  await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(error){await fs.writeFile(path.join(output,`failure-${Date.now()}.json`),JSON.stringify({message:error.message,stack:error.stack},null,2));throw error}
finally{await browser?.close();server?.kill()}
