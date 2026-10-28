import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {launchBrowser,selectElement,openImageAdvanced,downloadPng} from './helpers/browser.mjs';

export const root=path.resolve(import.meta.dirname,'..'), require=createRequire(import.meta.url), sharp=require('sharp');
export const config=process.env.IMPACT_TEMPLATE==='editorial-story'?{id:'editorial-story',name:'Cover Story',width:1080,height:1350,main:'halden-journal.svg',secondary:'halden-week.svg',font:136,spacing:-3.4}: {id:'studio-bridge',name:'Big Type Launch',width:1920,height:1080,main:'kiln-overview.svg',secondary:'kiln-deploy.svg',font:452,spacing:-28.024};
if(process.env.IMPACT_TEMPLATE&&!['studio-bridge','editorial-story'].includes(process.env.IMPACT_TEMPLATE))throw Error('Unsupported IMPACT_TEMPLATE');
export const output=process.env.IMPACT_OUTPUT||path.resolve(root,'../../output/devsnapkit/template-collection-2026-10-27/pro-impact/implementation',config.id,'browser',new Date().toISOString().replace(/[:.]/g,'-'));
export const origin=process.env.IMPACT_ORIGIN||'http://127.0.0.1:5313';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rows=[],errors=[],networkFailures=[],dialogs=[];let browser,server,page;
export function setBrowser(value){browser=value;}
export {clickButton,state,history,settle,fresh,menu,apply,fill,png,capture,fixtures};
async function clickButton(p,label){
 await p.waitForFunction(label=>[...document.querySelectorAll('button')].some(n=>n.getClientRects().length&&n.innerText.replace(/\s+/g,' ').trim()===label),{},label);
 const handle=await p.evaluateHandle(label=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&n.innerText.replace(/\s+/g,' ').trim()===label),label);
 await handle.asElement().click();await handle.dispose();await pause(100);
}
const state=p=>p.evaluate(()=>window.__mockupBaseline.snapshot);
const history=p=>p.evaluate(()=>window.__mockupBaseline.history);
async function settle(p){await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(n=>n.decode()));});await pause(120);}
async function fresh(mode='valid',width=1440){
 const p=await browser.newPage();page=p;await p.setViewport({width,height:1100,deviceScaleFactor:1});
 await p.evaluateOnNewDocument(mode=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');if(mode!=='free')localStorage.setItem('devsnapkit_license_key','DSK-AAAA-BBBB-CCCC');},mode);
 p.dialogs=[];
 p.on('pageerror',e=>errors.push(e.stack||e.message));p.on('dialog',async d=>{const entry={type:d.type(),message:d.message(),accepted:true,pageMode:mode};p.dialogs.push(entry);dialogs.push(entry);await d.accept();});p.on('requestfailed',request=>networkFailures.push({url:request.url(),error:request.failure()?.errorText}));
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
 if(mode!=='free')assert.ok(p.requests.length,'Saved key reaches mock verification API');
 if(mode==='valid'){await p.waitForFunction(()=>localStorage.getItem('devsnapkit_pro_unlocked')==='true');}
 return p;
}
async function menu(p){if(!await p.$('[data-template-gallery]'))await clickButton(p,'Templates');}
async function apply(p,name=config.name){await menu(p);await p.click(`[aria-label="Apply ${name} template"]`);await p.waitForFunction(name=>window.__mockupBaseline.snapshot.templateContext?.id===name,{},name===config.name?config.id:'paper-launch-duo');await settle(p);}
async function fill(p,selector,value){await p.focus(selector);await p.keyboard.down('Control');await p.keyboard.press('A');await p.keyboard.up('Control');await p.keyboard.type(String(value));await p.keyboard.press('Tab');await pause(100);}
async function png(p,name,scale){
 await clickButton(p,'Export');await clickButton(p,scale===1?'1x Web':'2x HD');await settle(p);
 const cropEvidence=await p.evaluate(()=>{const canvas=document.querySelector('#studio-canvas'),bounds=canvas.getBoundingClientRect();const rect=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom});const media=[...canvas.querySelectorAll('[data-composition-object="main"],[data-composition-object="secondary"]')].map(n=>({slot:n.dataset.compositionObject,...rect(n.getBoundingClientRect())}));return{allowBleed:window.__mockupBaseline.snapshot.compositionDocument.allowBleed,canvas:rect(bounds),media,outside:media.some(r=>r.left<bounds.left-.5||r.top<bounds.top-.5||r.right>bounds.right+.5||r.bottom>bounds.bottom+.5)};});
 const dialogStart=p.dialogs.length;
 await p.evaluate(()=>{
  const measure=canvas=>{const b=canvas.getBoundingClientRect(),s=b.width/canvas.offsetWidth;return[...canvas.querySelectorAll('[data-canvas-text],[data-composition-object],[data-media-screen],[data-media-chrome],[data-media-frame],[data-phone-home],[data-phone-capsule],[data-phone-status],img[alt="QR Code"],img[alt="Brand Logo"]')].map((n,i)=>{const r=n.getBoundingClientRect(),css=getComputedStyle(n);return{id:i+':'+(n.dataset.canvasText||n.dataset.compositionObject||n.closest('[data-composition-object]')?.dataset.compositionObject||n.tagName),x:(r.x-b.x)/s,y:(r.y-b.y)/s,width:r.width/s,height:r.height/s,boxShadow:css.boxShadow,radius:css.borderRadius,fontSize:css.fontSize,letterSpacing:css.letterSpacing};});};

  window.__impactPreviewGeometry=measure(document.querySelector('#studio-canvas'));window.__impactExportGeometry=null;
  window.__impactObserver=new MutationObserver(()=>{const c=document.querySelector('[data-export-target]>[data-canvas-root]');if(c)window.__impactExportGeometry=measure(c);});window.__impactObserver.observe(document.body,{subtree:true,childList:true,attributes:true});
 });
 const downloaded=await downloadPng(p,output,name,()=>clickButton(p,`Download ${scale}x (${config.width*scale}×${config.height*scale})`));
 const exportDialogs=p.dialogs.slice(dialogStart);if(cropEvidence.outside&&cropEvidence.allowBleed)assert.ok(exportDialogs.some(d=>d.type==='confirm'&&d.message==='Screenshot content outside the canvas will be clipped. Export this crop?'&&d.accepted),'Actual out-of-canvas media requires the crop confirmation');
 await fs.writeFile(path.join(output,name+'.dialogs.json'),JSON.stringify({cropEvidence,dialogs:exportDialogs},null,2));
 const metadata=await sharp(downloaded.path).metadata();assert.equal(metadata.format,'png');assert.equal(metadata.width,config.width*scale);assert.equal(metadata.height,config.height*scale);
 const geometry=await p.evaluate(()=>{window.__impactObserver.disconnect();return{preview:window.__impactPreviewGeometry,exported:window.__impactExportGeometry};});assert.ok(geometry.exported);
 assert.equal(geometry.preview.length,geometry.exported.length);assert.equal(new Set(geometry.preview.map(n=>n.id)).size,geometry.preview.length);
 let maxDelta=0;for(const a of geometry.preview){const b=geometry.exported.find(n=>n.id===a.id);assert.ok(b,a.id);for(const key of ['x','y','width','height']){assert.ok(Number.isFinite(a[key])&&Number.isFinite(b[key]));maxDelta=Math.max(maxDelta,Math.abs(a[key]-b[key]));}}
 for(const a of geometry.preview){const b=geometry.exported.find(n=>n.id===a.id);assert.equal(b.boxShadow,a.boxShadow,'Native shadow survives export '+a.id);assert.equal(b.radius,a.radius,'Native radius survives export '+a.id);}
 assert.ok(maxDelta<=2,'Preview/export geometry '+maxDelta);await fs.writeFile(path.join(output,name+'.geometry.json'),JSON.stringify({...geometry,maxDelta},null,2));return downloaded;
}
async function capture(p,name){await p.mouse.move(0,0);await settle(p);await(await p.$('#studio-canvas')).screenshot({path:path.join(output,name+'.preview.png')});for(const scale of [1,2])await png(p,name+'-'+scale+'x.png',scale);await fs.writeFile(path.join(output,name+'.snapshot.json'),JSON.stringify(await state(p),null,2));}
async function arrangedBrand(p){
 const jsQR=createRequire(path.resolve(root,'../../output/devsnapkit/whole-card-free-brand/tools/package.json'))('jsqr');
 const target='https://impact.example/'+config.id+'/qa';
 const tab=await p.evaluateHandle(()=>[...document.querySelectorAll('[data-inspector-tabs] button')].find(n=>[...n.querySelectorAll('span')].some(s=>s.textContent==='Brand')));assert.ok(tab.asElement());await tab.asElement().click();await tab.dispose();
 await(await p.$('[aria-label="Logo file"]')).uploadFile(path.join(root,'tests/fixtures/whole-card/free-logo.svg'));await p.waitForFunction(()=>!!window.__mockupBaseline.snapshot.logoDataUrl);
 await fill(p,'[aria-label="QR website URL"]',target);await p.waitForSelector('#studio-canvas img[alt="QR Code"]');await p.click('[aria-label="QR position bottom-left"]');await settle(p);
 const boxes=()=>p.evaluate(()=>{const c=document.querySelector('#studio-canvas'),b=c.getBoundingClientRect(),s=b.width/c.offsetWidth,roles=window.__mockupBaseline.snapshot.templateContext.textRoles;const rect=n=>{if(!n)throw Error('Missing brand geometry');const r=n.getBoundingClientRect();return{x:(r.x-b.x)/s,y:(r.y-b.y)/s,width:r.width/s,height:r.height/s};};return{qr:rect(c.querySelector('img[alt="QR Code"]').parentElement),logo:rect(c.querySelector('img[alt="Brand Logo"]')),website:rect(c.querySelector('[data-canvas-text="'+roles.website+'"]')),disclosure:rect(c.querySelector('[data-canvas-text="'+roles.disclosure+'"]'))};});
 const before=await boxes(),documentBefore=await state(p),moves=[];
 const intersects=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 if(config.id==='editorial-story'){
  // The default footer is one printed line. For this user-arranged QR variant,
  // stack both editable fields in the remaining paper area instead of overlapping them.
  await clickButton(p,'Text');
  for(const role of ['website','disclosure']){
   await p.select('[aria-label="Current text"]',documentBefore.templateContext.textRoles[role]);
   const layer=documentBefore.textDocument.layers.find(n=>n.id===documentBefore.templateContext.textRoles[role]);
   const oldCenter=Number(await p.$eval('[aria-label="Text x"]',n=>n.value)),oldY=Number(await p.$eval('[aria-label="Text y"]',n=>n.value));
   const newCenter=160+layer.widthRatio*config.width/2,newY=role==='website'?1272:1302;
   await fill(p,'[aria-label="Text x"]',newCenter);await fill(p,'[aria-label="Text y"]',newY);
   moves.push({role,oldCenter,newCenter,oldY,newY,userArrangedStack:true});
  }
 }else for(const role of ['website','disclosure'])if(intersects(before[role],before.qr)){
  await clickButton(p,'Text');await p.select('[aria-label="Current text"]',documentBefore.templateContext.textRoles[role]);
  const oldCenter=Number(await p.$eval('[aria-label="Text x"]',n=>n.value)),shift=Math.ceil(before.qr.x+before.qr.width+24-before[role].x);
  await fill(p,'[aria-label="Text x"]',oldCenter+shift);moves.push({role,oldCenter,newCenter:oldCenter+shift,shift});
 }
 await settle(p);const after=await boxes(),current=await state(p);assert.equal(current.qrScale,9);assert.equal(current.qrPos,'bottom-left');assert.ok(moves.length,'Default QR conflict is resolved by explicit user edits');
 for(const role of ['website','disclosure']){assert.ok(!intersects(after[role],after.qr),'User-arranged footer clearance '+role);const id=current.templateContext.textRoles[role];assert.equal(current.textDocument.layers.find(n=>n.id===id).content,documentBefore.textDocument.layers.find(n=>n.id===id).content,'Full footer content retained');}
 assert.ok(!intersects(after.logo,after.qr),'Visible uploaded logo clears QR');
 assert.ok(!intersects(after.website,after.disclosure),'User-arranged footer fields remain separate');
 const files=[];for(const scale of [1,2]){const file=await png(p,'impact-user-arranged-logo-qr-'+scale+'x.png',scale);files.push(file.path);const q=after.qr,left=Math.max(0,Math.floor(q.x*scale)),top=Math.max(0,Math.floor(q.y*scale));const cropped=await sharp(file.path).extract({left,top,width:Math.min(config.width*scale-left,Math.ceil(q.width*scale)),height:Math.min(config.height*scale-top,Math.ceil(q.height*scale))}).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(jsQR(new Uint8ClampedArray(cropped.data),cropped.info.width,cropped.info.height)?.data,target,'Actual exported QR decodes at '+scale+'x');}
 const l=after.logo,rendered=await sharp(files[0]).extract({left:Math.max(0,Math.floor(l.x)),top:Math.max(0,Math.floor(l.y)),width:Math.ceil(l.width),height:Math.ceil(l.height)}).ensureAlpha().raw().toBuffer();let red=0;for(let i=0;i<rendered.length;i+=4)if(rendered[i]>190&&rendered[i+1]<80&&rendered[i+2]<110)red++;assert.ok(red>4,'Actual exported uploaded logo pixels');
 await fs.writeFile(path.join(output,'user-arranged-qr-evidence.json'),JSON.stringify({variant:'User-arranged QR variant, not default clearance',before,after,moves,qrScale:9,fullFooterContentPreserved:true,files,decodedUrl:target,redPixels:red,simulatedLicense:true},null,2));rows.push({scenario:'pro-real-logo-and-QR-user-arranged-footer-two-scales',pass:true});
}
async function fixtures(){const dir=path.join(output,'fixtures');await fs.mkdir(dir,{recursive:true});for(const [name,w,h,bg,ink]of [['long.png',396,810,'#EEEDE7','#34453B'],['square.png',650,650,'#F2F4F5','#2B3C53'],['dark.png',430,932,'#192536','#D7E3EB'],['transparent.png',600,420,'none','#D9F58B']]){let body=`<rect width="${w}" height="${h}" fill="${bg}"/><text x="32" y="58" font-size="26" fill="${ink}">Self-authored QA interface</text>`;for(let i=0;i<5;i++)body+=`<rect x="32" y="${95+i*(h-140)/5}" width="${w-64}" height="${(h-180)/6}" rx="5" fill="${ink}" opacity=".12"/><text x="48" y="${124+i*(h-140)/5}" font-size="16" fill="${ink}">Illustrative item ${i+1}</text>`;await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`)).png().toFile(path.join(dir,name));}return dir;}
export async function run(){try{
 await fs.mkdir(output,{recursive:true});
 if(!process.env.IMPACT_ORIGIN){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5313','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await pause(100);}assert.ok(ready,'Test server started');}
 browser=await launchBrowser();
 for(const mode of ['free','invalid']){
  page=await fresh(mode);const before=await state(page),h=await history(page);await menu(page);
  assert.equal(await page.$$eval('[data-template-gallery] article',nodes=>nodes.length),12);
  const gallery=await page.$$eval('[data-template-gallery] article',nodes=>nodes.map(n=>({name:n.querySelector('button[aria-label^="Preview"]')?.getAttribute('aria-label')?.replace(/^Preview | template$/g,''),tier:n.querySelector('div.flex span:last-child')?.textContent})));
  assert.deepEqual(gallery,[{name:'Editorial Honey',tier:'Free'},{name:'Paper Launch Duo',tier:'Free'},{name:'Calm Split',tier:'Free'},{name:'App Pair',tier:'Free'},{name:'Night Signal Duo',tier:'Pro'},{name:'Pocket Flow Duo',tier:'Pro'},{name:'Big Type Launch',tier:'Pro'},{name:'Cover Story',tier:'Pro'},{name:'Feature Spotlight',tier:'Pro'},{name:'Web & Mobile',tier:'Pro'},{name:'Metric Focus',tier:'Pro'},{name:'Before & After',tier:'Pro'}]);
  await page.click(`[aria-label="Preview ${config.name} template"]`);await page.waitForSelector('[data-template-preview][open]');await page.$eval('[data-template-preview] img',async n=>{await n.decode();if(!n.naturalWidth)throw Error('Preview image failed');});await page.keyboard.press('Escape');await page.waitForSelector('[data-template-preview]',{hidden:true});assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')),`Preview ${config.name} template`);
  await page.click(`[aria-label="Apply ${config.name} template"]`);await page.waitForSelector('input[placeholder="DSK-XXXX-XXXX-XXXX"]',{visible:true});
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
 page=await fresh('free');await apply(page,'Paper Launch Duo');await selectElement(page,'Headline');await page.click('[data-canvas-text-controls] [aria-label="Edit text"]');await page.focus('[aria-label="Text content"]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('An Impact permission draft to keep.');await pause(150);
 const draftBefore=await state(page),draftHistory=await history(page),draftValue=await page.$eval('[aria-label="Text content"]',n=>n.value);
 assert.equal(draftHistory.inTransaction,true);await menu(page);await page.click(`[aria-label="Apply ${config.name} template"]`);await page.waitForSelector('input[placeholder="DSK-XXXX-XXXX-XXXX"]',{visible:true});
 assert.deepEqual(await state(page),draftBefore);assert.deepEqual(await history(page),draftHistory);assert.equal(await page.$eval('[aria-label="Text content"]',n=>n.value),draftValue);rows.push({scenario:'impact-denied-apply-preserves-active-text-draft-history-and-document',pass:true});await page.close();
 page=await fresh();const before=await state(page),h=await history(page);await apply(page);const duo=await state(page);

 assert.deepEqual(duo.customCanvasSize,{width:config.width,height:config.height});
 assert.equal(duo.compositionDocument.detailVisible,true);assert.notEqual(duo.imageSrc,duo.secondarySrc);
 assert.equal(duo.compositionDocument.mediaLayout,'independent');assert.equal(duo.compositionDocument.allowBleed,true);
 const headline=duo.textDocument.layers.find(n=>n.id===duo.templateContext.textRoles.headline);
 assert.ok(headline,'Editable headline exists');assert.equal(headline.fontSize,config.font);assert.equal(headline.letterSpacing,config.spacing);
 if(config.id==='studio-bridge')assert.ok(duo.compositionDocument.order.indexOf(headline.id)<duo.compositionDocument.order.indexOf('main'),'headline behind browser');
 else {assert.equal(headline.font,'gelasio');assert.ok(headline.runs.some(n=>n.italic&&n.text.includes('Think further.')));}
 await selectElement(page,'Headline');await clickButton(page,'Text');
 assert.equal(Number(await page.$eval('[aria-label="Text size"]',n=>n.value)),config.font);
 await fill(page,'[aria-label="Text size"]',config.font);await fill(page,'[aria-label="Text letterSpacing"]',config.spacing);
 assert.equal((await state(page)).textDocument.layers.find(n=>n.id===headline.id).fontSize,config.font);
 const measuredType=await page.$eval(`#studio-canvas [data-canvas-text="${headline.id}"]`,n=>({fontSize:parseFloat(getComputedStyle(n).fontSize),letterSpacing:parseFloat(getComputedStyle(n).letterSpacing),fontFamily:getComputedStyle(n).fontFamily}));
 assert.ok(Math.abs(measuredType.fontSize-config.font)<.01);assert.ok(Math.abs(measuredType.letterSpacing-config.spacing)<.01);await fs.writeFile(path.join(output,'headline-typography.json'),JSON.stringify(measuredType,null,2));
 if(config.id==='editorial-story'){
  const renderedRuns=await page.$$eval(`#studio-canvas [data-canvas-text="${headline.id}"] [data-text-run]`,nodes=>nodes.map(n=>({text:n.textContent,fontStyle:getComputedStyle(n).fontStyle,fontSize:parseFloat(getComputedStyle(n).fontSize),fontFamily:getComputedStyle(n).fontFamily})));
  assert.ok(renderedRuns.some(n=>n.fontStyle==='normal'&&n.text.includes('Write slower.')),'Rendered first line is normal');assert.ok(renderedRuns.some(n=>n.fontStyle==='italic'&&n.text.includes('Think further.')),'Rendered second line is italic');for(const run of renderedRuns){assert.equal(run.fontSize,136);assert.ok(run.fontFamily.includes('Gelasio'));}
  await fs.writeFile(path.join(output,'headline-rendered-runs.json'),JSON.stringify(renderedRuns,null,2));
 }

 const sources=await page.$$eval('#studio-canvas [data-media-screen] img',nodes=>nodes.map(n=>({src:n.currentSrc,w:n.naturalWidth,h:n.naturalHeight,fit:getComputedStyle(n).objectFit})));
 assert.equal(sources.length,2);assert.notEqual(sources[0].src,sources[1].src);
 assert.ok(sources[0].src.endsWith('/'+config.main));assert.ok(sources[1].src.endsWith('/'+config.secondary));
 for(const src of sources){assert.ok(src.w>0&&src.h>0);assert.equal(src.fit,'contain');}
 const canonicalHashes=[];for(const asset of [config.main,config.secondary]){const bytes=await page.evaluate(async asset=>{const response=await fetch('/designed/examples/collection/'+asset);if(!response.ok)throw Error('Missing canonical '+asset);return Array.from(new Uint8Array(await response.arrayBuffer()));},asset);canonicalHashes.push({asset,sha256:createHash('sha256').update(Buffer.from(bytes)).digest('hex')});}
 await fs.writeFile(path.join(output,'canonical-media.json'),JSON.stringify({sources,canonicalHashes},null,2));
 assert.equal(duo.compositionDocument.objects.filter(n=>n.kind==='button').length,0,'No poster CTA');
 const nativeStyles=await page.$$eval('#studio-canvas [data-media-frame]',nodes=>nodes.map(n=>({frame:n.dataset.mediaFrame,width:n.getBoundingClientRect().width,cssWidth:n.offsetWidth,shadow:getComputedStyle(n).boxShadow,radius:getComputedStyle(n).borderRadius})));
 if(config.id==='studio-bridge'){assert.equal(nativeStyles[0].shadow,'rgb(22, 19, 15) 16px 16px 0px 0px');assert.equal(nativeStyles[0].cssWidth,960);assert.equal(nativeStyles[1].shadow,'rgb(22, 19, 15) 12px 12px 0px 0px');assert.equal(nativeStyles[1].cssWidth,308);}
 else assert.equal(nativeStyles[1].radius,'14px');
 await fs.writeFile(path.join(output,'native-styles.json'),JSON.stringify(nativeStyles,null,2));
 await capture(page,'impact-default-duo');await clickButton(page,'Undo');assert.deepEqual(await state(page),before);await clickButton(page,'Redo');assert.deepEqual(await state(page),duo);assert.equal((await history(page)).count,h.count+1);rows.push({scenario:'valid-saved-key-apply-single-history-undo-redo-and-real-duo-exports',pass:true});
 await selectElement(page,'Headline');await clickButton(page,'Text');await page.click('[data-canvas-text-controls] [aria-label="Edit text"]');await page.focus('[aria-label="Text content"]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type(config.id==='studio-bridge'?'Ship\nit!':'Write slower.\nThink deeper.');await clickButton(page,'Text');await settle(page);assert.equal((await state(page)).textDocument.layers.find(n=>n.id===headline.id).fontSize,config.font);await capture(page,'impact-edited-headline');await clickButton(page,'Undo');assert.deepEqual(await state(page),duo);await clickButton(page,'Redo');await clickButton(page,'Undo');
 await arrangedBrand(page);await page.close();page=await fresh();await apply(page);
 await clickButton(page,'Frame');await clickButton(page,'Hide Image 2');const single=await state(page);assert.equal(single.secondarySrc,duo.secondarySrc);assert.deepEqual(single.compositionDocument.placements,duo.compositionDocument.placements);await capture(page,'impact-default-single');
 await selectElement(page,'Image 1');await openImageAdvanced(page);
 const original=(await state(page)).compositionDocument.placements;
 const center=await page.$eval('[aria-label="Object centerX"]',n=>n.value);
 await fill(page,'[aria-label="Object centerX"]',Number(center)-15);
 assert.notDeepEqual((await state(page)).compositionDocument.placements.main,original.main);
 assert.deepEqual((await state(page)).compositionDocument.placements.secondary,original.secondary);
 await fill(page,'[aria-label="Object widthRatio"]',420);
 assert.ok(Math.abs((await state(page)).compositionDocument.placements.main.widthRatio*config.width-420)<.01);
 await fill(page,'[aria-label="Object rotation"]',-8);assert.ok(Number.isFinite((await state(page)).compositionDocument.placements.main.rotation)&&Math.abs((await state(page)).compositionDocument.placements.main.rotation+8)<1e-9);assert.deepEqual((await state(page)).compositionDocument.placements.secondary,original.secondary);
 await capture(page,'impact-user-moved-resized-rotated');
 await selectElement(page,'Image 1');await openImageAdvanced(page);
 const editedBeforeReset=await state(page);await clickButton(page,'Reset');assert.deepEqual((await state(page)).compositionDocument.placements,editedBeforeReset.compositionDocument.placements,'Style Reset preserves manually edited geometry');assert.equal((await state(page)).imageSrc,editedBeforeReset.imageSrc);assert.equal((await state(page)).secondarySrc,editedBeforeReset.secondarySrc);
 await clickButton(page,'Restore layout');assert.deepEqual((await state(page)).compositionDocument.placements,duo.compositionDocument.placements);
 assert.equal((await state(page)).compositionDocument.detailVisible,false);assert.equal((await state(page)).secondarySrc,duo.secondarySrc);
 await clickButton(page,'Enable Image 2');await selectElement(page,'Image 2');
 const secondBefore=(await state(page)).compositionDocument.placements.main;
 await openImageAdvanced(page);const secondaryCenter=Number(await page.$eval('[aria-label="Object centerX"]',n=>n.value));await fill(page,'[aria-label="Object centerX"]',secondaryCenter+8);await fill(page,'[aria-label="Object rotation"]',11);assert.ok(Number.isFinite((await state(page)).compositionDocument.placements.secondary.rotation)&&Math.abs((await state(page)).compositionDocument.placements.secondary.rotation-11)<1e-9);assert.deepEqual((await state(page)).compositionDocument.placements.main,secondBefore);
 await page.select('[aria-label="Image 2 fit"]','cover');
 assert.equal((await state(page)).compositionDocument.mediaPresentation.main.fit,'contain');
 assert.equal((await state(page)).compositionDocument.mediaPresentation.secondary.fit,'cover');await settle(page);
 assert.deepEqual(await page.$$eval('#studio-canvas [data-media-screen] img',nodes=>nodes.map(n=>getComputedStyle(n).objectFit)),['contain','cover']);
 await page.select('[aria-label="Image 2 fit"]','contain');await page.focus('[aria-label="Image 2 focus"]');await page.keyboard.press('Tab');
 await capture(page,'impact-independent-secondary-user-edit');await selectElement(page,'Image 2');
 await openImageAdvanced(page);await clickButton(page,'Restore layout');await clickButton(page,'Reset template');
 assert.equal((await state(page)).templateContext.id,config.id);assert.deepEqual((await state(page)).compositionDocument.placements,duo.compositionDocument.placements);
 rows.push({scenario:'single-preserves-duo-frames-move-resize-restore-hidden-source-and-isolated-fit',pass:true});await page.close();
 const dir=await fixtures();
 page=await fresh();await(await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(dir,'long.png'));await page.waitForFunction(()=>window.__mockupBaseline.snapshot.primaryMediaOrigin?.kind==='user');const uploaded=await state(page);await apply(page);assert.equal((await state(page)).imageSrc,uploaded.imageSrc);assert.equal((await state(page)).secondarySrc,null);assert.equal((await state(page)).compositionDocument.detailVisible,false);assert.deepEqual((await state(page)).compositionDocument.placements,duo.compositionDocument.placements);await capture(page,'impact-user-one-image');rows.push({scenario:'one-user-upload-remains-single-no-injected-demo-both-export-scales',pass:true});await page.close();
 for(const [label,a,b]of [['long-square','long.png','square.png'],['two-long-phones','long.png','dark.png']]){
  page=await fresh();await page.click('button[title="Dual shots (2 images)"]');await(await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(dir,a));await page.waitForFunction(name=>window.__mockupBaseline.snapshot.imageName===name,{},a);await(await page.$('[aria-label="Second screenshot file"]')).uploadFile(path.join(dir,b));await page.waitForFunction(name=>window.__mockupBaseline.snapshot.secondaryName===name,{},b);const old=await state(page);await apply(page);assert.equal((await state(page)).imageSrc,old.imageSrc);assert.equal((await state(page)).secondarySrc,old.secondarySrc);await capture(page,'impact-'+label);
 const sourceHash=value=>createHash('sha256').update(value||'').digest('hex');
 const beforeHash=sourceHash((await state(page)).secondarySrc);
 await(await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(dir,'transparent.png'));
 await page.waitForFunction(()=>window.__mockupBaseline.snapshot.imageName==='transparent.png');
 assert.equal(sourceHash((await state(page)).secondarySrc),beforeHash,'Replace main preserves secondary bytes');
 await fs.writeFile(path.join(output,'impact-'+label+'.source-hashes.json'),JSON.stringify({before:{main:sourceHash(old.imageSrc),secondary:sourceHash(old.secondarySrc)},after:{main:sourceHash((await state(page)).imageSrc),secondary:sourceHash((await state(page)).secondarySrc)},localUserFixtures:true},null,2));
 await clickButton(page,'Frame');await clickButton(page,'Hide Image 2');await capture(page,'impact-'+label+'-single');rows.push({scenario:'two-independent-uploads-'+label+'-duo-single-both-scales',pass:true});await page.close();
 }
 for(const cancellation of ['escape','toggle']){
  page=await fresh();await page.setCacheEnabled(false);let held;page.hook=async request=>{if(!held&&new URL(request.url()).pathname.endsWith('/'+config.secondary)){held=request;return true;}return false;};const before=await state(page),h=await history(page);await menu(page);await page.click(`[aria-label="Apply ${config.name} template"]`);for(let i=0;i<100&&!held;i++)await pause(50);assert.ok(held,'Real secondary decode request held');
  if(cancellation==='escape')await page.keyboard.press('Escape');else await clickButton(page,'Templates');await page.waitForSelector('[data-template-gallery]',{hidden:true});await held.continue();await pause(500);assert.deepEqual(await state(page),before);assert.deepEqual(await history(page),h);page.hook=null;await apply(page,'Paper Launch Duo');assert.equal((await state(page)).templateContext.id,'paper-launch-duo');rows.push({scenario:'pending-decode-'+cancellation+'-cancels-without-state-change-and-next-apply-works',pass:true});await page.close();
 }
 page=await fresh();await page.setCacheEnabled(false);let abort=true,hits=0;page.hook=async request=>{if(abort&&new URL(request.url()).pathname.endsWith('/'+config.secondary)){hits++;await request.abort();return true;}return false;};{const before=await state(page),h=await history(page);await menu(page);await page.click(`[aria-label="Apply ${config.name} template"]`);await page.waitForFunction(()=>[...document.querySelectorAll('[role="alert"]')].some(n=>n.textContent.trim()));assert.ok(hits);assert.deepEqual(await state(page),before);assert.deepEqual(await history(page),h);abort=false;await apply(page);rows.push({scenario:'secondary-resource-failure-is-atomic-and-retry-succeeds',pass:true});}await page.close();
 for(const width of [360,390,430])for(const theme of ['light','dark']){
  page=await fresh('free',width);const label=theme==='light'?'Switch to Light theme':'Switch to Dark theme';if(await page.$(`[aria-label="${label}"]`))await page.click(`[aria-label="${label}"]`);await menu(page);await page.click(`[aria-label="Preview ${config.name} template"]`);await page.$eval('[data-template-preview] img',async n=>n.decode());const sizes=await page.evaluate(()=>({html:document.documentElement.scrollWidth,body:document.body.scrollWidth,dialog:document.querySelector('[data-template-preview]').getBoundingClientRect().width}));assert.ok(sizes.html<=width&&sizes.body<=width&&sizes.dialog<=width);await page.screenshot({path:path.join(output,`gallery-${width}-${theme}.png`),fullPage:true});await page.keyboard.press('Escape');await page.close();rows.push({scenario:`gallery-preview-${width}-${theme}-no-overflow`,pass:true});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({output,passed:true,scenarios:rows.length}));
}catch(error){process.exitCode=1;errors.push(error.stack||error.message);await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,rows,errors},null,2));console.error(error.message);}
finally{if(browser)await browser.close();if(server)server.kill();await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'results.json'),JSON.stringify({output,rows,errors,networkFailures,dialogs,passed:!process.exitCode,simulatedLicense:true,physicalPhone:false},null,2));}


}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename))await run();

