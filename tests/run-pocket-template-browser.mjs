import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {launchBrowser,selectElement,openImageAdvanced,downloadPng} from './helpers/browser.mjs';

const root=path.resolve(import.meta.dirname,'..'), require=createRequire(import.meta.url), sharp=require('sharp');
const output=process.env.POCKET_OUTPUT||path.resolve(root,'../../output/devsnapkit/template-collection-2026-10-26/a2-pocket/browser',new Date().toISOString().replace(/[:.]/g,'-'));
const origin=process.env.POCKET_ORIGIN||'http://127.0.0.1:5283';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rows=[],errors=[],networkFailures=[];let browser,server,page;
async function clickButton(p,label){
 await p.waitForFunction(label=>[...document.querySelectorAll('button')].some(n=>n.getClientRects().length&&(n.innerText.replace(/\s+/g,' ').trim()===label||n.getAttribute('aria-label')===label)),{},label);
 const handle=await p.evaluateHandle(label=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&(n.innerText.replace(/\s+/g,' ').trim()===label||n.getAttribute('aria-label')===label)),label);
 await handle.asElement().click();await handle.dispose();await pause(100);
}
const state=p=>p.evaluate(()=>window.__mockupBaseline.snapshot);
const history=p=>p.evaluate(()=>window.__mockupBaseline.history);
async function settle(p){await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(n=>n.decode()));});await pause(120);}
async function fresh(mode='valid',width=1440){
 const p=await browser.newPage();page=p;await p.setViewport({width,height:1100,deviceScaleFactor:1});
 await p.evaluateOnNewDocument(mode=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');if(mode==='valid')localStorage.setItem('devsnapkit_license_key','DSK-AAAA-BBBB-CCCC');},mode);
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());p.on('requestfailed',request=>networkFailures.push({url:request.url(),error:request.failure()?.errorText}));
 p.requests=[];await p.setRequestInterception(true);p.on('request',async request=>{
  const u=new URL(request.url());
  if(u.pathname==='/api/verify-license'){p.requests.push({path:u.pathname,body:request.postData()});await request.respond({status:200,contentType:'application/json',body:JSON.stringify(mode==='invalid'?{valid:false,error:'Fixture invalid signature'}:{valid:true,tier:'pro_lifetime'})});return;}
  if(u.pathname==='/api/paypal-config'){await request.respond({status:503,contentType:'application/json',body:'{"error":"Local fixture: checkout disabled"}'});return;}
  if(u.pathname.startsWith('/api/')){await request.respond({status:200,contentType:'application/json',body:'{}'});return;}
  if(u.hostname.includes('paypal.com')){await request.respond({contentType:'text/javascript',body:''});return;}
  // Local behavior tests wait for artwork assets, not third-party telemetry.
  if(['http:','https:'].includes(u.protocol)&&!['127.0.0.1','localhost'].includes(u.hostname)){await request.respond({status:204,body:''});return;}
  if(p.hook&&await p.hook(request))return;
  await request.continue();
 });
 await p.goto(origin+'/?editor=1',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__mockupBaseline);await settle(p);
 if(mode==='valid'){assert.ok(p.requests.length);await p.waitForFunction(()=>localStorage.getItem('devsnapkit_pro_unlocked')==='true');}
 return p;
}
async function menu(p){if(!await p.$('[data-template-gallery]'))await clickButton(p,'Templates');}
async function apply(p,name='Pocket Flow Duo'){await menu(p);await p.click(`[aria-label="Apply ${name} template"]`);await p.waitForFunction(name=>window.__mockupBaseline.snapshot.templateContext?.id===name,{},name==='Pocket Flow Duo'?'pocket-flow-duo':'paper-launch-duo');await settle(p);}
async function fill(p,selector,value){await p.focus(selector);await p.keyboard.down('Control');await p.keyboard.press('A');await p.keyboard.up('Control');await p.keyboard.type(String(value));await p.keyboard.press('Tab');await pause(100);}
async function png(p,name,scale){
 await clickButton(p,'Export');await clickButton(p,scale===1?'1x Web':'2x HD');await settle(p);
 await p.evaluate(()=>{
  const measure=canvas=>{const b=canvas.getBoundingClientRect(),s=b.width/canvas.offsetWidth;return[...canvas.querySelectorAll('[data-canvas-text],[data-composition-object],[data-media-screen],[data-media-chrome],[data-phone-home],[data-phone-capsule]')].map(n=>{const r=n.getBoundingClientRect(),part=['data-media-screen','data-media-chrome','data-phone-home','data-phone-capsule'].find(key=>n.hasAttribute(key));return{id:n.dataset.canvasText||n.dataset.compositionObject||n.closest('[data-composition-object]')?.dataset.compositionObject+'/'+part,x:(r.x-b.x)/s,y:(r.y-b.y)/s,width:r.width/s,height:r.height/s};});};
  window.__pocketPreviewGeometry=measure(document.querySelector('#studio-canvas'));window.__pocketExportGeometry=null;
  window.__pocketObserver=new MutationObserver(()=>{const c=document.querySelector('[data-export-target]>[data-canvas-root]');if(c)window.__pocketExportGeometry=measure(c);});window.__pocketObserver.observe(document.body,{subtree:true,childList:true,attributes:true});
 });
 const downloaded=await downloadPng(p,output,name,()=>clickButton(p,`Download ${scale}x (${1080*scale}×${1920*scale})`));
 const metadata=await sharp(downloaded.path).metadata();assert.equal(metadata.format,'png');assert.equal(metadata.width,1080*scale);assert.equal(metadata.height,1920*scale);
 const geometry=await p.evaluate(()=>{window.__pocketObserver.disconnect();return{preview:window.__pocketPreviewGeometry,exported:window.__pocketExportGeometry};});assert.ok(geometry.exported);
 assert.equal(geometry.preview.length,geometry.exported.length);assert.equal(new Set(geometry.preview.map(n=>n.id)).size,geometry.preview.length);
 let maxDelta=0;for(const a of geometry.preview){const b=geometry.exported.find(n=>n.id===a.id);assert.ok(b,a.id);for(const key of ['x','y','width','height']){assert.ok(Number.isFinite(a[key])&&Number.isFinite(b[key]));maxDelta=Math.max(maxDelta,Math.abs(a[key]-b[key]));}}
 assert.ok(maxDelta<=2,'Preview/export geometry '+maxDelta);await fs.writeFile(path.join(output,name+'.geometry.json'),JSON.stringify({...geometry,maxDelta},null,2));return downloaded;
}
async function capture(p,name){await p.mouse.move(0,0);await settle(p);await(await p.$('#studio-canvas')).screenshot({path:path.join(output,name+'.preview.png')});for(const scale of [1,2])await png(p,name+'-'+scale+'x.png',scale);await fs.writeFile(path.join(output,name+'.snapshot.json'),JSON.stringify(await state(p),null,2));}
async function fixtures(){const dir=path.join(output,'fixtures');await fs.mkdir(dir,{recursive:true});for(const [name,w,h,bg,ink]of [['long.png',396,810,'#EEEDE7','#34453B'],['square.png',650,650,'#F2F4F5','#2B3C53'],['dark.png',430,932,'#192536','#D7E3EB'],['transparent.png',600,420,'none','#D9F58B']]){let body=`<rect width="${w}" height="${h}" fill="${bg}"/><text x="32" y="58" font-size="26" fill="${ink}">Self-authored QA interface</text>`;for(let i=0;i<5;i++)body+=`<rect x="32" y="${95+i*(h-140)/5}" width="${w-64}" height="${(h-180)/6}" rx="5" fill="${ink}" opacity=".12"/><text x="48" y="${124+i*(h-140)/5}" font-size="16" fill="${ink}">Illustrative item ${i+1}</text>`;await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`)).png().toFile(path.join(dir,name));}return dir;}
try{
 await fs.mkdir(output,{recursive:true});
 if(!process.env.POCKET_ORIGIN){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5283','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await pause(100);}assert.ok(ready,'Test server started');}
 browser=await launchBrowser();
 for(const mode of ['free','invalid']){
  page=await fresh(mode);const before=await state(page),h=await history(page);await menu(page);
  assert.equal(await page.$$eval('[data-template-gallery] article',nodes=>nodes.length),12);
  const gallery=await page.$$eval('[data-template-gallery] article',nodes=>nodes.map(n=>({name:n.querySelector('button[aria-label^="Preview"]')?.getAttribute('aria-label')?.replace(/^Preview | template$/g,''),tier:n.querySelector('div.flex span:last-child')?.textContent})));
  assert.deepEqual(gallery.sort((a,b)=>a.name.localeCompare(b.name)),[{name:'Editorial Honey',tier:'Free'},{name:'Paper Launch Duo',tier:'Free'},{name:'Calm Split',tier:'Free'},{name:'App Pair',tier:'Free'},{name:'Night Signal Duo',tier:'Pro'},{name:'Pocket Flow Duo',tier:'Pro'},{name:'Big Type Launch',tier:'Pro'},{name:'Cover Story',tier:'Pro'},{name:'Feature Spotlight',tier:'Pro'},{name:'Web & Mobile',tier:'Pro'},{name:'Metric Focus',tier:'Pro'},{name:'Before & After',tier:'Pro'}].sort((a,b)=>a.name.localeCompare(b.name)));
  await page.click('[aria-label="Preview Pocket Flow Duo template"]');await page.waitForSelector('[data-template-preview][open]');await page.$eval('[data-template-preview] img',async n=>{await n.decode();if(!n.naturalWidth)throw Error('Preview image failed');});await page.keyboard.press('Escape');await page.waitForSelector('[data-template-preview]',{hidden:true});assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Preview Pocket Flow Duo template');
  await page.click('[aria-label="Apply Pocket Flow Duo template"]');await page.waitForSelector('input[placeholder="DSK-XXXX-XXXX-XXXX"]',{visible:true});
  assert.deepEqual(await state(page),before);assert.deepEqual(await history(page),h);assert.notEqual(await page.evaluate(()=>localStorage.getItem('devsnapkit_pro_unlocked')),'true');
  const modal=await page.$eval('[data-pro-upsell]',n=>n.textContent).catch(()=>page.evaluate(()=>document.body.innerText));for(const text of ['Premium templates','High-resolution export presets','Batch export','Premium gradient backgrounds'])assert.ok(modal.includes(text),text);
  rows.push({scenario:mode+'-preview-no-state-change-escape-focus-and-pro-gate-no-mutation',pass:true});
  if(mode==='free'){
   await fill(page,'input[placeholder="DSK-XXXX-XXXX-XXXX"]','DSK-AAAA-BBBB-CCCC');await clickButton(page,'Activate');await page.waitForFunction(()=>localStorage.getItem('devsnapkit_pro_unlocked')==='true');assert.ok(page.requests.length);assert.deepEqual(await state(page),before,'Activation must not auto-apply');
   await apply(page);rows.push({scenario:'actual-key-activation-server-response-then-explicit-apply',pass:true});
  }else{await fill(page,'input[placeholder="DSK-XXXX-XXXX-XXXX"]','DSK-AAAA-BBBB-CCCC');await clickButton(page,'Activate');await page.waitForFunction(()=>document.body.innerText.includes('Fixture invalid signature'));assert.deepEqual(await state(page),before);assert.deepEqual(await history(page),h);rows.push({scenario:'invalid-key-activation-keeps-current-work',pass:true});}
  await page.close();page=null;
 }
 // A live text draft is a distinct state from the committed document/history.
 page=await fresh('free');await apply(page,'Paper Launch Duo');await selectElement(page,'Headline');await page.click('[data-canvas-text-controls] [aria-label="Edit text"]');await page.focus('[aria-label="Text content"]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('A Pocket permission draft to keep.');await pause(150);
 const draftBefore=await state(page),draftHistory=await history(page),draftValue=await page.$eval('[aria-label="Text content"]',n=>n.value);
 assert.equal(draftHistory.inTransaction,true);await menu(page);await page.click('[aria-label="Apply Pocket Flow Duo template"]');await page.waitForSelector('input[placeholder="DSK-XXXX-XXXX-XXXX"]',{visible:true});
 assert.deepEqual(await state(page),draftBefore);assert.deepEqual(await history(page),draftHistory);assert.equal(await page.$eval('[aria-label="Text content"]',n=>n.value),draftValue);rows.push({scenario:'pocket-denied-apply-preserves-active-text-draft-history-and-document',pass:true});await page.close();
 page=await fresh();const before=await state(page),h=await history(page);await apply(page);const duo=await state(page);
 assert.deepEqual(duo.customCanvasSize,{width:1080,height:1920});assert.equal(duo.compositionDocument.detailVisible,true);assert.notEqual(duo.imageSrc,duo.secondarySrc);assert.equal(await page.$$eval('[data-media-screen] img',n=>n.length),2);
 assert.equal(duo.compositionDocument.mediaLayout,'independent');
 assert.deepEqual(duo.compositionDocument.mediaPresentation.main,{...duo.compositionDocument.mediaPresentation.main,frame:'phone-light',fit:'contain'});
 assert.equal(duo.compositionDocument.mediaPresentation.secondary.frame,'phone-light');
 for(const [slot,rect] of [['main',[85,535,460,1000]],['secondary',[557,665,445,1015]]]){
  const f=duo.compositionDocument.placements[slot],actual=[(f.centerX-f.widthRatio/2)*1080,(f.centerY-f.heightRatio/2)*1920,f.widthRatio*1080,f.heightRatio*1920];
  actual.forEach((n,i)=>assert.ok(Math.abs(n-rect[i])<.01,slot+' authored placement'));
 }
 const sources=await page.$$eval('#studio-canvas [data-media-screen] img',nodes=>nodes.map(n=>({src:n.currentSrc,w:n.naturalWidth,h:n.naturalHeight,fit:getComputedStyle(n).objectFit,hardware:n.closest('[data-media-frame]')?.querySelectorAll('[data-phone-capsule],[data-phone-home],[data-phone-status]').length})));
 assert.equal(sources.length,2);assert.notEqual(sources[0].src,sources[1].src);
 for(const src of sources){assert.equal(src.w,396);assert.equal(src.h,810);assert.equal(src.fit,'contain');assert.ok(src.hardware>=3,'Native hardware separate from canonical artwork');}
 assert.ok(sources[0].src.endsWith('/morrow-today.svg'));assert.ok(sources[1].src.endsWith('/morrow-focus.svg'));
 await fs.writeFile(path.join(output,'canonical-media.json'),JSON.stringify(sources,null,2));
 await capture(page,'pocket-default-duo');await clickButton(page,'Undo');assert.deepEqual(await state(page),before);await clickButton(page,'Redo');assert.deepEqual(await state(page),duo);assert.equal((await history(page)).count,h.count+1);rows.push({scenario:'valid-saved-key-apply-single-history-undo-redo-and-real-duo-exports',pass:true});
 await clickButton(page,'Frame');await clickButton(page,'Hide Image 2');const single=await state(page);assert.equal(single.secondarySrc,duo.secondarySrc);assert.deepEqual(single.compositionDocument.placements,duo.compositionDocument.placements);await capture(page,'pocket-default-single');
 await selectElement(page,'Image 1');await openImageAdvanced(page);
 const original=(await state(page)).compositionDocument.placements;
 const center=await page.$eval('[aria-label="Object centerX"]',n=>n.value);
 await fill(page,'[aria-label="Object centerX"]',Number(center)-15);
 assert.notDeepEqual((await state(page)).compositionDocument.placements.main,original.main);
 assert.deepEqual((await state(page)).compositionDocument.placements.secondary,original.secondary);
 await fill(page,'[aria-label="Object widthRatio"]',420);
 assert.ok(Math.abs((await state(page)).compositionDocument.placements.main.widthRatio*1080-420)<.01);
 await clickButton(page,'Restore layout');assert.deepEqual((await state(page)).compositionDocument.placements,duo.compositionDocument.placements);
 assert.equal((await state(page)).compositionDocument.detailVisible,false);assert.equal((await state(page)).secondarySrc,duo.secondarySrc);
 await clickButton(page,'Enable Image 2');await selectElement(page,'Image 2');
 await page.select('[aria-label="Image 2 fit"]','cover');
 assert.equal((await state(page)).compositionDocument.mediaPresentation.main.fit,'contain');
 assert.equal((await state(page)).compositionDocument.mediaPresentation.secondary.fit,'cover');await settle(page);
 assert.deepEqual(await page.$$eval('#studio-canvas [data-media-screen] img',nodes=>nodes.map(n=>getComputedStyle(n).objectFit)),['contain','cover']);
 await page.select('[aria-label="Image 2 fit"]','contain');await page.focus('[aria-label="Image 2 focus"]');await page.keyboard.press('Tab');
 await openImageAdvanced(page);await clickButton(page,'Reset template');
 assert.equal((await state(page)).templateContext.id,'pocket-flow-duo');assert.deepEqual((await state(page)).compositionDocument.placements,duo.compositionDocument.placements);
 rows.push({scenario:'single-preserves-duo-frames-move-resize-restore-hidden-source-and-isolated-fit',pass:true});await page.close();
 const dir=await fixtures();
 page=await fresh();await(await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(dir,'long.png'));await page.waitForFunction(()=>window.__mockupBaseline.snapshot.primaryMediaOrigin?.kind==='user');const uploaded=await state(page);await apply(page);assert.equal((await state(page)).imageSrc,uploaded.imageSrc);assert.equal((await state(page)).secondarySrc,null);assert.equal((await state(page)).compositionDocument.detailVisible,false);assert.deepEqual((await state(page)).compositionDocument.placements,duo.compositionDocument.placements);await capture(page,'pocket-user-one-image');rows.push({scenario:'one-user-upload-remains-single-no-injected-demo-both-export-scales',pass:true});await page.close();
 for(const [label,a,b]of [['long-square','long.png','square.png'],['two-long-phones','long.png','dark.png']]){
  page=await fresh();await page.click('button[title="Dual shots (2 images)"]');await(await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(dir,a));await page.waitForFunction(name=>window.__mockupBaseline.snapshot.imageName===name,{},a);await(await page.$('[aria-label="Second screenshot file"]')).uploadFile(path.join(dir,b));await page.waitForFunction(name=>window.__mockupBaseline.snapshot.secondaryName===name,{},b);const old=await state(page);await apply(page);assert.equal((await state(page)).imageSrc,old.imageSrc);assert.equal((await state(page)).secondarySrc,old.secondarySrc);await capture(page,'pocket-'+label);
 const sourceHash=value=>createHash('sha256').update(value||'').digest('hex');
 const beforeHash=sourceHash((await state(page)).secondarySrc);
 await(await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(dir,'transparent.png'));
 await page.waitForFunction(()=>window.__mockupBaseline.snapshot.imageName==='transparent.png');
 assert.equal(sourceHash((await state(page)).secondarySrc),beforeHash,'Replace main preserves secondary bytes');
 await fs.writeFile(path.join(output,'pocket-'+label+'.source-hashes.json'),JSON.stringify({before:{main:sourceHash(old.imageSrc),secondary:sourceHash(old.secondarySrc)},after:{main:sourceHash((await state(page)).imageSrc),secondary:sourceHash((await state(page)).secondarySrc)},localUserFixtures:true},null,2));
 await clickButton(page,'Frame');await clickButton(page,'Hide Image 2');await capture(page,'pocket-'+label+'-single');rows.push({scenario:'two-independent-uploads-'+label+'-duo-single-both-scales',pass:true});await page.close();
 }
 for(const cancellation of ['escape','toggle']){
  page=await fresh();await page.setCacheEnabled(false);let held;page.hook=async request=>{if(!held&&new URL(request.url()).pathname.endsWith('/morrow-focus.svg')){held=request;return true;}return false;};const before=await state(page),h=await history(page);await menu(page);await page.click('[aria-label="Apply Pocket Flow Duo template"]');for(let i=0;i<100&&!held;i++)await pause(50);assert.ok(held,'Real secondary decode request held');
  if(cancellation==='escape')await page.keyboard.press('Escape');else await page.click('[aria-label="Close template gallery"]');await page.waitForSelector('[data-template-gallery]',{hidden:true});await held.continue();await pause(500);assert.deepEqual(await state(page),before);assert.deepEqual(await history(page),h);page.hook=null;await apply(page,'Paper Launch Duo');assert.equal((await state(page)).templateContext.id,'paper-launch-duo');rows.push({scenario:'pending-decode-'+cancellation+'-cancels-without-state-change-and-next-apply-works',pass:true});await page.close();
 }
 page=await fresh();await page.setCacheEnabled(false);let abort=true,hits=0;page.hook=async request=>{if(abort&&new URL(request.url()).pathname.endsWith('/morrow-focus.svg')){hits++;await request.abort();return true;}return false;};{const before=await state(page),h=await history(page);await menu(page);await page.click('[aria-label="Apply Pocket Flow Duo template"]');await page.waitForFunction(()=>[...document.querySelectorAll('[role="alert"]')].some(n=>n.textContent.trim()));assert.ok(hits);assert.deepEqual(await state(page),before);assert.deepEqual(await history(page),h);abort=false;await apply(page);rows.push({scenario:'secondary-resource-failure-is-atomic-and-retry-succeeds',pass:true});}await page.close();
 for(const width of [360,390,430])for(const theme of ['light','dark']){
  page=await fresh('free',width);const label=theme==='light'?'Switch to Light theme':'Switch to Dark theme';if(await page.$(`[aria-label="${label}"]`))await page.click(`[aria-label="${label}"]`);await menu(page);await page.click('[aria-label="Preview Pocket Flow Duo template"]');await page.$eval('[data-template-preview] img',async n=>n.decode());const sizes=await page.evaluate(()=>({html:document.documentElement.scrollWidth,body:document.body.scrollWidth,dialog:document.querySelector('[data-template-preview]').getBoundingClientRect().width}));assert.ok(sizes.html<=width&&sizes.body<=width&&sizes.dialog<=width);await page.screenshot({path:path.join(output,`gallery-${width}-${theme}.png`),fullPage:true});await page.keyboard.press('Escape');await page.close();rows.push({scenario:`gallery-preview-${width}-${theme}-no-overflow`,pass:true});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({output,passed:true,scenarios:rows.length}));
}catch(error){process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,rows,errors},null,2));console.error(error.message);}
finally{if(browser)await browser.close();if(server)server.kill();await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'results.json'),JSON.stringify({output,rows,errors,networkFailures,passed:!process.exitCode,simulatedLicense:true,physicalPhone:false},null,2));}
