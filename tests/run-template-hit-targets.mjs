import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { launchBrowser, clickButton, finishTextEditing, downloadPng } from './helpers/browser.mjs';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const output=process.env.HIT_TARGET_OUTPUT||path.resolve(root,'../../output/devsnapkit/honey-m1-review-fixes-2026-10-25');
const origin=process.env.HIT_TARGET_ORIGIN||'http://127.0.0.1:5198',phase=process.env.HIT_TARGET_PHASE||'after';
const pause=ms=>new Promise(r=>setTimeout(r,ms)),results=[],errors=[];let browser,server,activePage;
try{
  await fs.mkdir(output,{recursive:true});if(!process.env.HIT_TARGET_ORIGIN){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5198','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await pause(100);}}
  browser=await launchBrowser();
  for(const width of [1800,360,390,430]){
    const touch=width<500,page=await browser.newPage();activePage=page;page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width,height:1100,deviceScaleFactor:1,isMobile:touch,hasTouch:touch});await page.evaluateOnNewDocument(()=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');});await page.goto(origin+'/?editor=1',{waitUntil:'domcontentloaded'});await page.waitForSelector('[aria-label="Templates"]');await page.click('[aria-label="Templates"]');await page.click('[aria-label="Apply Editorial Honey template"]');await page.waitForSelector('[data-composition-object="secondary"]');await page.evaluate(()=>document.fonts.ready);await pause(500);
    const sizes=await page.$$eval('[data-text-hit]',nodes=>nodes.map(n=>({id:n.dataset.textHit,width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,coarse:matchMedia('(pointer: coarse)').matches})));
    results.push({width,touch,sizes});for(const size of sizes){assert.ok(size.height>=(touch?44:32)-.1,`${width}px ${size.id} target height ${size.height}`);assert.ok(size.width>=(touch?44:32)-.1,`${width}px target width`);}
    assert.ok(await page.$('[data-independent-media-status]'),'independent media status is explicit');assert.equal(await page.$('button[title="Single shot (1 image)"]'),null,'Single/Duo does not mislabel independent slots');
    const main=await page.$('[data-composition-object="main"] [data-media-surface]');await main.evaluate(n=>n.scrollIntoView({block:'center'}));await pause(200);const mb=await main.boundingBox(),mainChooser=page.waitForFileChooser();if(touch)await page.touchscreen.tap(mb.x+mb.width/2,mb.y+mb.height/2);else await page.mouse.click(mb.x+mb.width/2,mb.y+mb.height/2);await(await mainChooser).cancel();
    const roles=await page.$$eval('[data-canvas-text]',nodes=>nodes.map(n=>({id:n.dataset.canvasText,text:n.textContent})));
    for(const role of roles){
      const node=await page.$(`[data-canvas-text="${role.id}"]`);await node.evaluate(n=>n.scrollIntoView({block:'center'}));await pause(100);const b=await node.boundingBox();
      if(touch)await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);else await page.mouse.click(b.x+b.width/2,b.y+b.height/2);
      await page.waitForSelector('[aria-label="Text content"]');assert.equal(await page.$eval('[aria-label="Text content"]',n=>n.value),role.text,`click opens correct neighboring text ${role.id}`);await finishTextEditing(page);await pause(150);
    }
    // Keep image replacement available after editing and despite padded text hits.
    const image=await page.$('[data-composition-object="secondary"]');await image.evaluate(n=>n.scrollIntoView({block:'center'}));await pause(250);const b=await image.boundingBox();results.at(-1).imageHit=await page.evaluate(({x,y})=>({point:{x,y},elements:document.elementsFromPoint(x,y).slice(0,8).map(n=>({tag:n.tagName,text:n.getAttribute('data-text-hit'),object:n.getAttribute('data-composition-object'),media:n.hasAttribute('data-media-surface')}))}),{x:b.x+b.width/2,y:b.y+b.height/2});const chooserPromise=page.waitForFileChooser();if(touch)await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);else await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await(await chooserPromise).cancel();
    const beforeToggle=await page.evaluate(()=>window.__mockupBaseline?.snapshot);
    await clickButton(page,'Hide detail image');assert.equal(await page.$('[data-composition-object="secondary"]'),null);await page.click('button[title^="Undo ("]');assert.ok(await page.$('[data-composition-object="secondary"]'));await clickButton(page,'Hide detail image');await clickButton(page,'Show detail image');assert.ok(await page.$('[data-composition-object="secondary"]'));
    await page.focus('[data-independent-media-status] button');await page.keyboard.press('1');assert.equal(await page.$('[data-composition-object="secondary"]'),null);await page.keyboard.press('2');assert.ok(await page.$('[data-composition-object="secondary"]'));
    if(beforeToggle){const afterToggle=await page.evaluate(()=>window.__mockupBaseline.snapshot);assert.equal(afterToggle.imageSrc,beforeToggle.imageSrc);assert.equal(afterToggle.secondarySrc,beforeToggle.secondarySrc);assert.deepEqual(afterToggle.compositionDocument.placements,beforeToggle.compositionDocument.placements);assert.equal(afterToggle.compositionDocument.mediaLayout,'independent');}
    if(!process.env.HIT_TARGET_ORIGIN){
      await page.evaluate(()=>{const s=structuredClone(window.__mockupBaseline.snapshot),first=s.textDocument.layers[0];s.textDocument.layers=[{...first,id:'empty-text',content:'',runs:undefined,centerX:.7,centerY:.6,widthRatio:.2}];s.compositionDocument.knownTextIds.push('empty-text');s.compositionDocument.order.push('empty-text');window.__mockupBaseline.apply(s);});await pause(200);
      const empty=await page.$('[data-text-hit="empty-text"]');await empty.evaluate(n=>n.scrollIntoView({block:'center'}));await pause(150);const eb=await empty.boundingBox();if(touch)await page.touchscreen.tap(eb.x+eb.width/2,eb.y+eb.height/2);else await empty.click();await page.waitForSelector('[aria-label="Text content"]');assert.equal(await page.$eval('[aria-label="Text content"]',n=>n.value),'');await finishTextEditing(page);
    }
    await page.screenshot({path:path.join(output,`${phase}-${width}.png`),fullPage:true});await page.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,`${phase}.json`),JSON.stringify({origin,results,errors},null,2));console.log(`PASS desktop/mobile text target sizes, native selection, two-slot labels and replacement: ${results.length} viewports`);
}catch(error){await activePage?.screenshot({path:path.join(output,`${phase}-failure.png`),fullPage:true}).catch(()=>{});await fs.writeFile(path.join(output,`${phase}-failure.json`),JSON.stringify({message:error.message,stack:error.stack,results,errors},null,2));throw error;}
finally{await browser?.close();server?.kill();}
