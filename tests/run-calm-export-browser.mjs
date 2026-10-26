import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {launchBrowser,clickButton} from './helpers/browser.mjs';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),sharp=require('sharp');
const output=process.env.CALM_EXPORT_OUTPUT||path.resolve(root,'../../output/devsnapkit/template-collection-2026-10-27/b1-calm/exports',new Date().toISOString().replace(/[:.]/g,'-'));
const origin=process.env.CALM_ORIGIN||'http://127.0.0.1:5297',pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let server,browser,page;const rows=[],errors=[];
async function downloads(count,action){
 const dir=await fs.mkdtemp(path.join(output,'downloads-')),session=await page.createCDPSession();await session.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});await action();let files=[];
 for(let i=0;i<450;i++){files=(await fs.readdir(dir)).filter(n=>/\.(png|webp|jpeg)$/.test(n));if(files.length===count)break;await pause(100);}await session.detach();
 assert.equal(files.length,count,'Expected real downloads: '+await page.evaluate(()=>[...document.querySelectorAll('[role="alert"]')].map(n=>n.textContent).join('; ')));
 const records=[];for(const file of files){const bytes=await fs.readFile(path.join(dir,file)),meta=await sharp(bytes).metadata();records.push({file:path.join(dir,file),format:meta.format,width:meta.width,height:meta.height});}return records;
}
async function format(fmt){const h=await page.evaluateHandle(fmt=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&n.textContent.trim().toLowerCase()===fmt),fmt);assert.ok(h.asElement(),fmt);await h.asElement().click();await h.dispose();}
async function selectBatch(pattern){
 for(const checkbox of await page.$$('aside input[type="checkbox"]')){if(!await checkbox.evaluate(n=>!!n.getClientRects().length))continue;const {label,checked}=await checkbox.evaluate(n=>({label:n.closest('label')?.textContent||'',checked:n.checked}));if(pattern.test(label)!==checked)await checkbox.click();}
 const selected=await page.$$eval('aside input[type="checkbox"]',nodes=>nodes.filter(n=>n.getClientRects().length&&n.checked).map(n=>n.closest('label')?.textContent.trim()));assert.equal(selected.length,2);return selected;
}
async function observeOgBatch(selected){
 const dir=await fs.mkdtemp(path.join(output,'og-custom-')),session=await page.createCDPSession();await session.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 const before=await page.evaluate(()=>({snapshot:window.__mockupBaseline.snapshot,history:window.__mockupBaseline.history}));
 try{
  await clickButton(page,'Export 2 Sizes (1x)');let files=[],alert='';
  for(let i=0;i<450;i++){
   files=(await fs.readdir(dir)).filter(n=>/\.png$/.test(n));
   alert=await page.$$eval('[role="alert"]',nodes=>nodes.map(n=>n.textContent).filter(t=>/Export blocked/.test(t)).join('\n'));
   if(files.length===2||alert)break;await pause(100);
  }
  assert.deepEqual(await page.evaluate(()=>({snapshot:window.__mockupBaseline.snapshot,history:window.__mockupBaseline.history})),before,'Batch outcome preserves current work');
  let evidence;
  if(alert){
   assert.match(alert,/Twitter \/ OG \(1200×630\)/);assert.match(alert,/Text \d+|Image [12]|main|secondary|CTA|Website/i);assert.match(alert,/outside the canvas/);
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(n=>n.getClientRects().length&&n.innerText.trim()==='Export 2 Sizes (1x)'&&!n.disabled));await pause(250);
   assert.deepEqual(await fs.readdir(dir),[],'Rejected batch must not emit any full or partial file');
   evidence={scenario:'og-custom-rejected-atomically-with-named-object-bounds-and-unchanged-document',outcome:'named-rejection',selected,alert,downloadDirectory:dir,files:[],pass:true};
  }else{
   assert.equal(files.length,2,'Batch must finish with two real PNGs or a genuine named bounds error');
   const records=[];for(const file of files){const meta=await sharp(await fs.readFile(path.join(dir,file))).metadata();assert.equal(meta.format,'png');records.push({file:path.join(dir,file),format:meta.format,width:meta.width,height:meta.height});}
   assert.deepEqual(records.map(f=>[f.width,f.height]).sort((a,b)=>a[0]-b[0]),[[1080,1080],[1200,630]]);
   evidence={scenario:'og-custom-two-actual-pngs-existing-batch-layout',outcome:'success',selected,files:records,independentlyDesignedOg:false,pass:true};
  }
  await fs.writeFile(path.join(output,'og-batch-outcome.json'),JSON.stringify(evidence,null,2));await page.screenshot({path:path.join(output,'og-batch-outcome.png'),fullPage:true});rows.push(evidence);return evidence.outcome;
 }finally{await session.detach();}
}
async function exportSingle(fmt,scale){await clickButton(page,'Export');await clickButton(page,scale===4?'4K Ultra':'1x Web');await format(fmt);const label=await page.evaluate(()=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&/^Download (4K|1x) \(/.test(n.innerText.trim()))?.innerText.trim());assert.ok(label);const [,w,h]=label.match(/\((\d+)×(\d+)\)/);const files=await downloads(1,()=>clickButton(page,label));assert.equal(files[0].format,fmt==='jpeg'?'jpeg':fmt);assert.equal(files[0].width,Number(w));assert.equal(files[0].height,Number(h));rows.push({scenario:fmt+'-'+scale+'-actual-file-signature-and-visible-dimensions',files,pass:true});}
try{
 await fs.mkdir(output,{recursive:true});if(!process.env.CALM_ORIGIN){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5297','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await pause(100);}}
 browser=await launchBrowser();page=await browser.newPage();await page.setViewport({width:1440,height:1100});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.evaluateOnNewDocument(()=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');});await page.setRequestInterception(true);page.on('request',async req=>{if(new URL(req.url()).pathname==='/api/verify-license'){await req.respond({contentType:'application/json',body:'{"valid":true,"tier":"pro_lifetime"}'});return;}const u=new URL(req.url());if(u.pathname.startsWith('/api/')){await req.respond({contentType:'application/json',body:'{}'});return;}if(['http:','https:'].includes(u.protocol)&&!['127.0.0.1','localhost'].includes(u.hostname)){await req.respond({status:204,body:''});return;}await req.continue();});await page.goto(origin+'/?editor=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__mockupBaseline);await clickButton(page,'Templates');await page.click('[aria-label="Apply Calm Split template"]');await page.waitForFunction(()=>window.__mockupBaseline.snapshot.templateContext?.id==='calm-split');await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(n=>n.decode()));});
 for(const fmt of ['webp','jpeg'])await exportSingle(fmt,1);
 // Capture the genuine ClipboardItem payload, with an explicit local sink in
 // place of the OS clipboard. This does not claim cross-application OS copying.
 await page.evaluate(()=>{window.__calmClipboard=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{const blob=await items[0].getType('image/png');window.__calmClipboard=Array.from(new Uint8Array(await blob.arrayBuffer()));}}});});
 const copy=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&/^Copy(?: HD| 2x)?$/.test(n.innerText.trim())));assert.ok(copy.asElement(),'Visible copy action');await copy.asElement().click();await copy.dispose();await page.waitForFunction(()=>window.__calmClipboard);const clipboard=Buffer.from(await page.evaluate(()=>window.__calmClipboard));await fs.writeFile(output+'/clipboard-payload.png',clipboard);const cm=await sharp(clipboard).metadata();assert.equal(cm.format,'png');assert.equal(cm.width,2160);assert.equal(cm.height,2160);rows.push({scenario:'actual-copy-png-payload-local-sink',width:cm.width,height:cm.height,pass:true});
 // Both paid actions must preserve the Free document, history and scale.
 await clickButton(page,'Export');await clickButton(page,'1x Web');await format('png');
 const freeBefore=await page.evaluate(()=>({snapshot:window.__mockupBaseline.snapshot,history:window.__mockupBaseline.history}));
 const gateDir=await fs.mkdtemp(path.join(output,'free-gates-'));const gateSession=await page.createCDPSession();await gateSession.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:gateDir});
 await clickButton(page,'4K Ultra');await page.waitForSelector('input[placeholder="DSK-XXXX-XXXX-XXXX"]',{visible:true});assert.deepEqual(await page.evaluate(()=>({snapshot:window.__mockupBaseline.snapshot,history:window.__mockupBaseline.history})),freeBefore);await page.click('button[title="Close"]');
 await clickButton(page,'Unlock Batch Export in Pro');await page.waitForSelector('input[placeholder="DSK-XXXX-XXXX-XXXX"]',{visible:true});assert.deepEqual(await page.evaluate(()=>({snapshot:window.__mockupBaseline.snapshot,history:window.__mockupBaseline.history})),freeBefore);assert.deepEqual(await fs.readdir(gateDir),[]);await gateSession.detach();
 rows.push({scenario:'free-4k-and-batch-gates-unchanged-document-history-zero-downloads',pass:true});
 // Use the real activation entrance with a local server response fixture.
 await page.type('input[placeholder="DSK-XXXX-XXXX-XXXX"]','DSK-AAAA-BBBB-CCCC');await clickButton(page,'Activate');await page.waitForFunction(()=>localStorage.getItem('devsnapkit_pro_unlocked')==='true');
 assert.deepEqual(await page.evaluate(()=>window.__mockupBaseline.snapshot),freeBefore.snapshot);await exportSingle('png',4);
 await clickButton(page,'Export');await clickButton(page,'1x Web');await format('png');

 const choices=await page.$$eval('aside input[type="checkbox"]',nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>({label:n.closest('label')?.textContent.trim(),checked:n.checked})));
 // Observe the genuine OG/Custom result: existing batch placement may fit.
 // A bounds error must name the target/object and reject atomically; success
 // must produce the two real dimensions. Neither outcome claims an authored OG design.
 const ogOutcome=await observeOgBatch(await selectBatch(/Twitter \/ OG|Custom/));
 // Square and Custom are two distinct presets with identical dimensions.
 const selected=await selectBatch(/Square|Custom/);const batch=await downloads(2,()=>clickButton(page,'Export 2 Sizes (1x)'));assert.equal(new Set(batch.map(f=>f.file)).size,2,'Two distinct actual files');assert.deepEqual(batch.map(f=>[f.width,f.height]),[[1080,1080],[1080,1080]]);assert.ok(batch.every(f=>f.format==='png'));rows.push({scenario:'compatible-square-and-custom-two-preset-downloads-same-dimensions',precedingOgOutcome:ogOutcome,selected,files:batch,dimensionsAreIdentical:true,pass:true});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({output,passed:true,scenarios:rows.length}));
}catch(error){process.exitCode=1;errors.push(error.stack);await page?.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});console.error(error.message);}
finally{await fs.mkdir(output,{recursive:true});if(browser)await browser.close();if(server)server.kill();await fs.writeFile(output+'/failure.json',JSON.stringify({rows,errors},null,2));await fs.writeFile(output+'/results.json',JSON.stringify({output,rows,errors,passed:!process.exitCode,simulatedLicense:true,clipboardUsesLocalSink:true,realPayment:false},null,2));}

