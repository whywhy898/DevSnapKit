import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { launchBrowser, downloadPng, selectElement, openImageAdvanced } from './helpers/browser.mjs';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const origin=process.env.DESIGNED_UX_ORIGIN||'http://127.0.0.1:5199';
const output=process.env.DESIGNED_UX_OUTPUT||path.resolve(root,'../../output/devsnapkit/designed-templates-2026-10-25/ux');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const results=[],errors=[];let server,browser,recorder;
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;for(let attempt=0;attempt<4;attempt++){try{const images=[...document.querySelectorAll('#studio-canvas img')];await Promise.all(images.map(i=>i.decode()));if(images.every(i=>i.isConnected&&i.complete&&i.naturalWidth))return;}catch(error){if(attempt===3)throw error;}await new Promise(resolve=>setTimeout(resolve,100));}});await pause(350);}
async function click(page,text){
  const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&(n.innerText.replace(/\s+/g,' ').trim()===text||n.getAttribute('aria-label')===text)),text);
  assert.ok(await handle.evaluate(n=>!!n),`Visible button ${text}`);await handle.evaluate(n=>n.scrollIntoView({block:'center'}));await handle.click();await handle.dispose();await pause(120);
}
async function tapSelector(page,selector){const handle=await page.$(selector);assert.ok(handle,selector);await handle.evaluate(n=>n.scrollIntoView({block:'center'}));const b=await handle.boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);await pause(150);}
async function fill(page,selector,value){await page.focus(selector);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type(String(value),{delay:25});await page.keyboard.press('Enter');await pause(150);}
async function objects(page){await click(page,'Frame');}
async function snapshot(page){return page.evaluate(()=>window.__mockupBaseline?.snapshot);}
async function applyHoney(page){await page.click('[aria-label="Templates"]');await page.click('[aria-label="Apply Editorial Honey template"]');await page.waitForSelector('[data-composition-object="secondary"]');await settle(page);}
async function newPage(viewport){const page=await browser.newPage();await page.setViewport(viewport);await page.evaluateOnNewDocument(()=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());await page.goto(origin+'/?editor=1',{waitUntil:'domcontentloaded'});await page.waitForSelector('[aria-label="Templates"]');await settle(page);return page;}
async function verifyPng(page,name){await click(page,'Export');await click(page,'1x Web');const png=await downloadPng(page,output,name,()=>click(page,'Download 1x (1600×1200)'));const meta=await sharp(png.path).metadata();assert.equal(meta.width,1600);assert.equal(meta.height,1200);return png;}
try{
  await fs.mkdir(output,{recursive:true});
  if(!process.env.DESIGNED_UX_ORIGIN){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5199','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await pause(100);}}
  browser=await launchBrowser();const page=await newPage({width:1600,height:1100,deviceScaleFactor:1});
  if(process.env.DESIGNED_RECORD==='1')recorder=await page.screencast({path:path.join(output,'honey-complete-operation.webm'),fps:15,quality:28,ffmpegPath:'C:/Users/whywh/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe'});
  await applyHoney(page);await objects(page);const seed=await snapshot(page);
  // These actions exercise the visible shipped controls. Snapshots only assert state.
  await selectElement(page,'Image 2');await openImageAdvanced(page);await fill(page,'[aria-label="Object centerX"]',500);let s=await snapshot(page);if(s){assert.equal(s.compositionDocument.placements.secondary.centerX,500/1600);await click(page,'Undo');assert.deepEqual((await snapshot(page)).compositionDocument.placements.secondary,seed.compositionDocument.placements.secondary);await click(page,'Redo');assert.equal((await snapshot(page)).compositionDocument.placements.secondary.centerX,500/1600);await click(page,'Undo');}
  results.push({scenario:'precision-position-native-input-and-undo-redo',pass:true});
  await click(page,'Use layout presets');await click(page,'Restore layout');s=await snapshot(page);if(s){assert.equal(s.compositionDocument.mediaLayout,'independent');assert.deepEqual(s.textDocument,seed.textDocument);assert.equal(s.imageSrc,seed.imageSrc);}
  results.push({scenario:'restore-independent-layout-preserves-content',pass:true});
  await selectElement(page,'Call to action');await fill(page,'[aria-label="Button label"]','Start creating');await selectElement(page,'Image 1');await click(page,'Reset');s=await snapshot(page);if(s)assert.equal(s.compositionDocument.objects.find(n=>n.id==='cta').text,'Start creating');
  results.push({scenario:'style-reset-preserves-button-label',pass:true});
  if(seed){
    const headline=seed.templateContext.textRoles.headline;await selectElement(page,'Headline');await click(page,'Duplicate text');s=await snapshot(page);assert.equal(s.textDocument.layers.length,seed.textDocument.layers.length+1);assert.notEqual(s.textDocument.layers.at(-1).id,headline);await click(page,'Undo');
    // Repeated history replay must not empty Redo through a derived state update.
    const before=await snapshot(page);await selectElement(page,'Call to action');
    for(let i=1;i<=5;i++){await fill(page,'[aria-label="Button radius"]',10+i);await selectElement(page,'Call to action');}
    for(let i=0;i<5;i++)await click(page,'Undo');assert.equal((await snapshot(page)).compositionDocument.objects.find(n=>n.id==='cta').radius,before.compositionDocument.objects.find(n=>n.id==='cta').radius);
    for(let i=0;i<5;i++)await click(page,'Redo');assert.equal((await snapshot(page)).compositionDocument.objects.find(n=>n.id==='cta').radius,15);
    results.push({scenario:'rich-text-copy-and-five-undo-five-redo',pass:true});
  }
  await click(page,'Frame');
  // Both screenshot regions open a genuine native file chooser.
  for(const [button,file] of [['Replace Image 1','bloom-dashboard.svg'],['Replace Image 2','bloom-workflow.svg']]){
    const chooserPromise=page.waitForFileChooser();await click(page,button);const chooser=await chooserPromise;await chooser.accept([path.join(root,'public/designed/examples',file)]);await settle(page);
  }
  results.push({scenario:'main-and-detail-native-file-choosers',pass:true});
  const brand=await page.$('[data-text-hit]');await brand.evaluate(n=>n.scrollIntoView({block:'center'}));await brand.click();await page.waitForSelector('[aria-label="Text content"]');await page.focus('[aria-label="Text content"]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('Bloom Studio',{delay:70});await click(page,'Text');
  await selectElement(page,'Call to action');await fill(page,'[aria-label="Button label"]','Find your focus');
  results.push({scenario:'desktop-final-download',...(await verifyPng(page,'honey-ux-desktop.png'))});
  await pause(1000);if(recorder){await recorder.stop();recorder=null;}
  if(seed){
    // Diagnostic setup creates a supported covered-text state; it does not create delivery artwork.
    await page.evaluate(()=>{const s=structuredClone(window.__mockupBaseline.snapshot),id=s.templateContext.textRoles.description;s.textDocument.layers=s.textDocument.layers.map(l=>l.id===id?{...l,centerX:.75,centerY:.5,widthRatio:.2}:l);s.compositionDocument.order=[id,...s.compositionDocument.order.filter(x=>x!==id)];window.__mockupBaseline.apply(s);});await settle(page);
    const top=await page.evaluate(()=>{const canvas=document.querySelector('#studio-canvas'),r=canvas.getBoundingClientRect(),n=document.elementFromPoint(r.x+r.width*.75,r.y+r.height*.5);return {text:!!n?.closest('[data-text-hit]'),media:!!n?.closest('[data-composition-object="main"]')};});assert.equal(top.text,false);assert.equal(top.media,true);results.push({scenario:'covered-text-does-not-intercept-media',pass:true});
    await page.close();
    const legacy=await newPage({width:1500,height:1100,deviceScaleFactor:1});await legacy.keyboard.press('2');await objects(legacy);await click(legacy,'Canvas');await click(legacy,'Add button');await click(legacy,'Frame');await click(legacy,'Hide Image 2');assert.equal((await snapshot(legacy)).layoutMode,'single');await click(legacy,'Enable Image 2');assert.equal((await snapshot(legacy)).layoutMode,'duo');await openImageAdvanced(legacy);await click(legacy,'Remove detail');assert.equal((await snapshot(legacy)).layoutMode,'single');assert.equal((await snapshot(legacy)).compositionDocument.detailVisible,false);results.push({scenario:'ordinary-duo-add-cta-hide-show-remove',pass:true});await legacy.close();
  }else await page.close();
  // Touch-capable narrow viewports, not a substitute for physical iOS/Android tests.
  for(const width of [360,390,430]){
    const mobile=await newPage({width,height:900,deviceScaleFactor:1,isMobile:true,hasTouch:true});await applyHoney(mobile);await objects(mobile);
    await selectElement(mobile,'Image 2');await openImageAdvanced(mobile);await fill(mobile,'[aria-label="Object centerX"]',350);await mobile.select('[aria-label="Detail fit"]','cover');await mobile.select('[aria-label="Detail fit"]','contain');
    const chooserPromise=mobile.waitForFileChooser();await click(mobile,'Replace Image 2');await(await chooserPromise).accept([path.join(root,'public/designed/examples/bloom-workflow.svg')]);await settle(mobile);
    await selectElement(mobile,'Call to action');await fill(mobile,'[aria-label="Button label"]','Start creating');
    await click(mobile,'Text');const first=await mobile.$('[data-text-hit]');await first.evaluate(n=>n.scrollIntoView({block:'center'}));const b=await first.boundingBox();await mobile.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);await mobile.waitForSelector('[aria-label="Text content"]');await mobile.focus('[aria-label="Text content"]');await mobile.keyboard.down('Control');await mobile.keyboard.press('A');await mobile.keyboard.up('Control');await mobile.keyboard.type('Bloomboard');await click(mobile,'Text');
    const widths=await mobile.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth,doc:document.documentElement.scrollWidth}));assert.equal(widths.body,width);assert.equal(widths.doc,width);
    const png=await verifyPng(mobile,`honey-mobile-${width}.png`);await mobile.screenshot({path:path.join(output,`mobile-${width}-editor.png`),fullPage:true});results.push({scenario:`mobile-${width}-touch-upload-edit-position-export`,pass:true,widths,...png});await mobile.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'results.json'),JSON.stringify({origin,physicalPhoneTest:false,results,errors},null,2));console.log(`PASS ${results.length} designed-template UX scenarios`);
}catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,results,errors},null,2));throw error;}
finally{await recorder?.stop().catch(()=>{});await browser?.close();server?.kill();}
