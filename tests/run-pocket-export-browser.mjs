import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {launchBrowser,clickButton} from './helpers/browser.mjs';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),sharp=require('sharp');
const output=process.env.POCKET_EXPORT_OUTPUT||path.resolve(root,'../../output/devsnapkit/template-collection-2026-10-26/a2-pocket/exports',new Date().toISOString().replace(/[:.]/g,'-'));
const origin=process.env.POCKET_ORIGIN||'http://127.0.0.1:5287',pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
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
async function expectRejectedOgBatch(selected){
 const dir=await fs.mkdtemp(path.join(output,'rejected-og-')),session=await page.createCDPSession();await session.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 const before=await page.evaluate(()=>({snapshot:window.__mockupBaseline.snapshot,history:window.__mockupBaseline.history}));
 try{
  await clickButton(page,'Export 2 Sizes (1x)');
  await page.waitForFunction(()=>[...document.querySelectorAll('[role="alert"]')].some(n=>/Export blocked/.test(n.textContent)&&/Twitter \/ OG/.test(n.textContent)&&/Make time/.test(n.textContent)),{timeout:10000});
  const alert=await page.$$eval('[role="alert"]',nodes=>nodes.map(n=>n.textContent).join('\n'));
  assert.match(alert,/Twitter \/ OG \(1200×630\)/);assert.match(alert,/Text 3/);assert.match(alert,/Make time\s+for what matters\./);assert.match(alert,/outside the canvas/);
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(n=>n.getClientRects().length&&n.innerText.trim()==='Export 2 Sizes (1x)'&&!n.disabled));await pause(250);
  const files=await fs.readdir(dir);assert.deepEqual(files,[],'Rejected batch must not emit any full or partial file');
  assert.deepEqual(await page.evaluate(()=>({snapshot:window.__mockupBaseline.snapshot,history:window.__mockupBaseline.history})),before,'Rejected cross-aspect batch preserves current work');
  const evidence={scenario:'og-custom-rejected-atomically-with-named-title-bounds-and-unchanged-document',selected,alert,downloadDirectory:dir,files,pass:true};await fs.writeFile(path.join(output,'expected-og-rejection.json'),JSON.stringify(evidence,null,2));await page.screenshot({path:path.join(output,'expected-og-rejection.png'),fullPage:true});rows.push(evidence);
 }finally{await session.detach();}
}
async function exportSingle(fmt,scale){await clickButton(page,'Export');await clickButton(page,scale===4?'4K Ultra':'1x Web');await format(fmt);const label=await page.evaluate(()=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&/^Download (4K|1x) \(/.test(n.innerText.trim()))?.innerText.trim());assert.ok(label);const [,w,h]=label.match(/\((\d+)×(\d+)\)/);const files=await downloads(1,()=>clickButton(page,label));assert.equal(files[0].format,fmt==='jpeg'?'jpeg':fmt);assert.equal(files[0].width,Number(w));assert.equal(files[0].height,Number(h));rows.push({scenario:fmt+'-'+scale+'-actual-file-signature-and-visible-dimensions',files,pass:true});}
try{
 await fs.mkdir(output,{recursive:true});if(!process.env.POCKET_ORIGIN){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5287','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await pause(100);}}
 browser=await launchBrowser();page=await browser.newPage();await page.setViewport({width:1440,height:1100});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.evaluateOnNewDocument(()=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');localStorage.setItem('devsnapkit_license_key','DSK-AAAA-BBBB-CCCC');});await page.setRequestInterception(true);page.on('request',async req=>{if(new URL(req.url()).pathname==='/api/verify-license'){await req.respond({contentType:'application/json',body:'{"valid":true,"tier":"pro_lifetime"}'});return;}await req.continue();});await page.goto(origin+'/?editor=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>localStorage.getItem('devsnapkit_pro_unlocked')==='true');await clickButton(page,'Templates');await page.click('[aria-label="Apply Pocket Flow Duo template"]');await page.waitForFunction(()=>window.__mockupBaseline.snapshot.templateContext?.id==='pocket-flow-duo');await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(n=>n.decode()));});
 for(const fmt of ['webp','jpeg'])await exportSingle(fmt,1);await exportSingle('png',4);
 // Capture the genuine ClipboardItem payload, with an explicit local sink in
 // place of the OS clipboard. This does not claim cross-application OS copying.
 await page.evaluate(()=>{window.__pocketClipboard=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{const blob=await items[0].getType('image/png');window.__pocketClipboard=Array.from(new Uint8Array(await blob.arrayBuffer()));}}});});
 const copy=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&/^Copy(?: HD| 2x)?$/.test(n.innerText.trim())));assert.ok(copy.asElement(),'Visible copy action');await copy.asElement().click();await copy.dispose();await page.waitForFunction(()=>window.__pocketClipboard);const clipboard=Buffer.from(await page.evaluate(()=>window.__pocketClipboard));await fs.writeFile(output+'/clipboard-payload.png',clipboard);const cm=await sharp(clipboard).metadata();assert.equal(cm.format,'png');assert.equal(cm.width,2160);assert.equal(cm.height,3840);rows.push({scenario:'actual-copy-png-payload-local-sink',width:cm.width,height:cm.height,pass:true});
 await clickButton(page,'Export');await clickButton(page,'1x Web');await format('png');
 const choices=await page.$$eval('aside input[type="checkbox"]',nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>({label:n.closest('label')?.textContent.trim(),checked:n.checked})));
 // Pocket is authored for portrait. Cross-aspect OG must identify the overflowing
 // title and reject the entire batch; another aspect requires its own layout.
 await expectRejectedOgBatch(await selectBatch(/Twitter \/ OG|Custom/));
 // Retry through the same UI after deselecting OG. Story and Custom are distinct
 // preset downloads with the SAME 1080×1920 dimensions, not two different sizes.
 const selected=await selectBatch(/Story|Custom/);const batch=await downloads(2,()=>clickButton(page,'Export 2 Sizes (1x)'));assert.equal(new Set(batch.map(f=>f.file)).size,2,'Two distinct actual files');assert.deepEqual(batch.map(f=>[f.width,f.height]),[[1080,1920],[1080,1920]]);assert.ok(batch.every(f=>f.format==='png'));rows.push({scenario:'compatible-story-and-custom-two-preset-downloads-same-dimensions-after-rejected-og',selected,files:batch,dimensionsAreIdentical:true,pass:true});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({output,passed:true,scenarios:rows.length}));
}catch(error){process.exitCode=1;errors.push(error.stack);await page?.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});console.error(error.message);}
finally{await fs.mkdir(output,{recursive:true});if(browser)await browser.close();if(server)server.kill();await fs.writeFile(output+'/failure.json',JSON.stringify({rows,errors},null,2));await fs.writeFile(output+'/results.json',JSON.stringify({output,rows,errors,passed:!process.exitCode,simulatedLicense:true,clipboardUsesLocalSink:true,realPayment:false},null,2));}
