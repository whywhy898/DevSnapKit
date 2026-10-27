import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {launchBrowser} from './helpers/browser.mjs';

const require=createRequire(import.meta.url),sharp=require('sharp');
const origin=process.env.IMPACT_ORIGIN||'http://127.0.0.1:5317',externalOrigin=!!process.env.IMPACT_ORIGIN;
process.env.IMPACT_ORIGIN=origin;
const {root,config,setBrowser,fresh,apply,clickButton,fill,state,history,settle}=await import('./run-pro-impact-browser.mjs');
const output=process.env.IMPACT_EXPORT_OUTPUT||path.resolve(root,'../../output/devsnapkit/template-collection-2026-10-27/pro-impact/implementation',config.id,'exports',new Date().toISOString().replace(/[:.]/g,'-'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let server,browser,page;const rows=[],errors=[],verification=[];
async function downloadedFiles(dir){return(await fs.readdir(dir)).filter(n=>/\.(png|webp|jpe?g)$/.test(n));}
async function downloads(action,{count=1,allowAtomicRejection=false}={}){
 const dir=await fs.mkdtemp(path.join(output,'downloads-')),session=await page.createCDPSession();await session.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 const before=await state(page),h=await history(page),alertsBefore=await page.$$eval('[role="alert"],[role="alertdialog"]',ns=>ns.map(n=>n.textContent));
 await action();let files=[],rejection;
 for(let i=0;i<450;i++){
  files=await downloadedFiles(dir);if(files.length===count)break;
  const alerts=await page.$$eval('[role="alert"],[role="alertdialog"]',ns=>ns.filter(n=>n.getClientRects().length).map(n=>n.textContent.trim()));
  rejection=alerts.find(n=>n&&!alertsBefore.includes(n));if(allowAtomicRejection&&rejection)break;await pause(100);
 }
 await pause(250);files=await downloadedFiles(dir);await session.detach();
 if(allowAtomicRejection&&files.length===0&&rejection){assert.deepEqual(await state(page),before,'Rejected batch preserves document');assert.deepEqual(await history(page),h,'Rejected batch preserves history');assert.deepEqual(await fs.readdir(dir),[],'Rejected batch emits zero files');return{outcome:'named-atomic-rejection',message:rejection,files:[]};}
 assert.equal(files.length,count,'Expected real downloads; rejection: '+rejection);
 const records=[];for(const file of files){const meta=await sharp(await fs.readFile(path.join(dir,file))).metadata();records.push({file:path.join(dir,file),format:meta.format,width:meta.width,height:meta.height});}
 assert.deepEqual(await state(page),before,'Export preserves document');assert.deepEqual(await history(page),h,'Export preserves history');return{outcome:'real-files',files:records};
}
async function format(fmt){const h=await page.evaluateHandle(fmt=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&n.textContent.trim().toLowerCase()===fmt),fmt);assert.ok(h.asElement(),'Visible format '+fmt);await h.asElement().click();await h.dispose();}
async function single(fmt,scale){
 await clickButton(page,'Export');await clickButton(page,scale===4?'4K Ultra':'1x Web');await format(fmt);await settle(page);
 const label=await page.evaluate(()=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&/^Download (4K|1x) \(/.test(n.innerText.trim()))?.innerText.trim());assert.ok(label,'Actual current-canvas download label');
 const [,w,h]=label.match(/\((\d+)×(\d+)\)/),result=await downloads(()=>clickButton(page,label));
 assert.equal(result.files[0].format,fmt);assert.equal(result.files[0].width,Number(w));assert.equal(result.files[0].height,Number(h));
 const expected=scale===4?(config.id==='studio-bridge'?[3840,2160]:[3072,3840]):[config.width,config.height];assert.deepEqual([Number(w),Number(h)],expected);
 rows.push({scenario:fmt+'-'+scale+'-file-signature-and-actual-visible-dimensions',label,...result,pass:true});
}
async function chooseBatch(pattern){
 await clickButton(page,'Export');await clickButton(page,'1x Web');await format('png');
 const choices=await page.$$eval('aside input[type="checkbox"]',nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>({label:n.closest('label')?.textContent.trim(),checked:n.checked})));
 for(const checkbox of await page.$$('aside input[type="checkbox"]')){if(!await checkbox.evaluate(n=>!!n.getClientRects().length))continue;const {label,checked}=await checkbox.evaluate(n=>({label:n.closest('label')?.textContent||'',checked:n.checked}));const want=pattern.test(label);if(want!==checked)await checkbox.click();}
 const selected=await page.$$eval('aside input[type="checkbox"]',nodes=>nodes.filter(n=>n.getClientRects().length&&n.checked).map(n=>n.closest('label')?.textContent.trim()));assert.equal(selected.length,2,'Exactly two selected presets '+JSON.stringify({choices,selected}));return selected;
}
async function freeGates(mode){
 page=await fresh(mode);page.on('pageerror',e=>errors.push(e.stack||e.message));const before=await state(page),h=await history(page);
 await clickButton(page,'Export');await clickButton(page,'4K Ultra');await page.waitForSelector('input[placeholder="DSK-XXXX-XXXX-XXXX"]',{visible:true});assert.deepEqual(await state(page),before);assert.deepEqual(await history(page),h);assert.notEqual(await page.evaluate(()=>localStorage.getItem('devsnapkit_pro_unlocked')),'true');rows.push({scenario:mode+'-existing-4K-export-gate-before-impact-admission',pass:true});
 if(mode==='free'){
  await fill(page,'input[placeholder="DSK-XXXX-XXXX-XXXX"]','DSK-AAAA-BBBB-CCCC');await clickButton(page,'Activate');await page.waitForFunction(()=>localStorage.getItem('devsnapkit_pro_unlocked')==='true');assert.ok(page.requests.length);assert.deepEqual(await state(page),before,'Activation does not auto-apply a template');await apply(page);assert.equal((await state(page)).templateContext.id,config.id);verification.push(...page.requests);rows.push({scenario:'real-key-input-mock-verification-explicit-template-admission',pass:true});
 }else verification.push(...page.requests);
 await page.close();
}
try{
 await fs.mkdir(output,{recursive:true});
 if(!externalOrigin){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5317','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await pause(100);}assert.ok(ready,'Local export server ready');}
 browser=await launchBrowser();setBrowser(browser);
 for(const mode of ['free','invalid'])await freeGates(mode);
 page=await fresh('valid');page.on('pageerror',e=>errors.push(e.stack||e.message));verification.push(...page.requests);await apply(page);assert.deepEqual((await state(page)).customCanvasSize,{width:config.width,height:config.height});
 for(const fmt of ['webp','jpeg'])await single(fmt,1);await single('png',4);
 // Capture the genuine ClipboardItem payload via an explicit local sink; this
 // proves PNG encoding, not transfer into an external application's clipboard.
 await page.evaluate(()=>{window.__impactClipboard=null;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{const blob=await items[0].getType('image/png');window.__impactClipboard=Array.from(new Uint8Array(await blob.arrayBuffer()));}}});});
 const copy=await page.evaluateHandle(()=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&/^Copy(?: HD| 2x)?$/.test(n.innerText.trim())));assert.ok(copy.asElement(),'Visible copy action');await copy.asElement().click();await copy.dispose();await page.waitForFunction(()=>window.__impactClipboard);const clipboard=Buffer.from(await page.evaluate(()=>window.__impactClipboard));await fs.writeFile(path.join(output,'clipboard-payload.png'),clipboard);const cm=await sharp(clipboard).metadata();assert.equal(cm.format,'png');assert.deepEqual([cm.width,cm.height],[config.width*2,config.height*2]);rows.push({scenario:'real-clipboard-PNG-payload-current-canvas-local-sink',width:cm.width,height:cm.height,pass:true});
 let selected=await chooseBatch(/Twitter \/ OG|Custom/),result=await downloads(()=>clickButton(page,'Export 2 Sizes (1x)'),{count:2,allowAtomicRejection:true});
 if(result.outcome==='real-files')assert.deepEqual(result.files.map(n=>[n.width,n.height]).sort((a,b)=>a[0]-b[0]),[[1200,630],[config.width,config.height]].sort((a,b)=>a[0]-b[0]));
 rows.push({scenario:'OG-plus-native-Custom-observed-success-or-named-atomic-rejection',selected,...result,pass:true});
 selected=await chooseBatch(config.id==='studio-bridge'?/16:9|Custom/:/Instagram Post|4:5|Custom/);result=await downloads(()=>clickButton(page,'Export 2 Sizes (1x)'),{count:2});
 const expected=config.id==='studio-bridge'?[[1920,1080],[1920,1080]]:[[1080,1350],[1080,1350]];
 assert.deepEqual(result.files.map(n=>[n.width,n.height]),expected);rows.push({scenario:'compatible-native-ratio-plus-Custom-two-real-files',selected,...result,identicalDimensions:true,note:'Two presets may truthfully produce the same dimensions.',pass:true});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({output,template:config.id,passed:true,scenarios:rows.length}));
}catch(error){process.exitCode=1;errors.push(error.stack||error.message);await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error(error.message);}
finally{if(browser)await browser.close();if(server)server.kill();await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'results.json'),JSON.stringify({output,template:config.id,rows,errors,verification,passed:!process.exitCode,simulatedLicense:true,clipboardUsesLocalSink:true,realPayment:false},null,2));}
