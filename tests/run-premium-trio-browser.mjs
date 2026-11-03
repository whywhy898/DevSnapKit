import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createTypeScriptLoader} from './helpers/load-typescript.mjs';
import {launchBrowser,selectElement,downloadPng} from './helpers/browser.mjs';

const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),sharp=require('sharp');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const output=process.env.TRIO_OUTPUT||path.resolve(root,'../../../output/devsnapkit/premium-template-implementation-2026-11-03','run-'+stamp);
const origin=process.env.TRIO_ORIGIN||'http://127.0.0.1:5377';
const load=createTypeScriptLoader(path.join(root,'src'));
const {CURATED_TEMPLATE_CATALOG:catalog}=load('templates/collection/catalog.ts');
const configs=['violet-launch','electric-pair','peach-editorial'].map(id=>{const c=catalog.find(x=>x.id===id);assert.ok(c,id+' must be registered');return c;});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const state=p=>p.evaluate(()=>window.__mockupBaseline.snapshot);
const history=p=>p.evaluate(()=>window.__mockupBaseline.history);
const results={startedAt:new Date().toISOString(),simulatedLicense:true,realPayment:false,checks:[],templates:[],errors:[]};
let browser,server,page;
const pass=name=>{results.checks.push({name,passed:true});console.log('PASS '+name);};
async function button(p,label){
 if(label==='Text'&&await p.$('[data-elements-tab]')){
  await p.$eval('[data-elements-tab]',n=>n.click());
  await p.$eval('[data-element-section="text"]',n=>n.click());await pause(100);return;
 }
 await p.waitForFunction(label=>[...document.querySelectorAll('button')].some(n=>n.getClientRects().length&&(n.innerText.replace(/\s+/g,' ').trim()===label||n.getAttribute('aria-label')===label)),{},label);
 const n=await p.evaluateHandle(label=>[...document.querySelectorAll('button')].find(n=>n.getClientRects().length&&(n.innerText.replace(/\s+/g,' ').trim()===label||n.getAttribute('aria-label')===label)),label);
 await n.asElement().click();await n.dispose();await pause(80);
}
async function settle(p){
 await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(n=>n.decode()));});
 await pause(150);
}
async function fresh(mode='valid',width=1440){
 const p=await browser.newPage();page=p;
 await p.setViewport({width,height:1100,deviceScaleFactor:1});
 await p.evaluateOnNewDocument(mode=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');if(mode==='valid')localStorage.setItem('devsnapkit_license_key','DSK-AAAA-BBBB-CCCC');},mode);
 p.on('pageerror',e=>results.errors.push(e.message));
 p.on('dialog',async d=>{if(d.type()==='confirm')await d.accept();else await d.dismiss();});
 await p.setRequestInterception(true);
 p.on('request',async r=>{
  const u=new URL(r.url());
  if(u.pathname==='/api/verify-license')return r.respond({status:200,contentType:'application/json',body:JSON.stringify({valid:true,tier:'pro_lifetime'})});
  if(u.pathname==='/api/paypal-config')return r.respond({status:503,contentType:'application/json',body:'{"error":"Local QA, no checkout"}'});
  if(u.pathname.startsWith('/api/'))return r.respond({status:200,contentType:'application/json',body:'{}'});
  if(['http:','https:'].includes(u.protocol)&&!['127.0.0.1','localhost'].includes(u.hostname))return r.respond({status:204,body:''});
  return r.continue();
 });
 await p.goto(origin+'/?editor=1',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>!!window.__mockupBaseline);
 if(mode==='valid')await p.waitForFunction(()=>localStorage.getItem('devsnapkit_pro_unlocked')==='true');
 await settle(p);return p;
}
async function menu(p){if(!await p.$('[data-template-gallery]'))await button(p,'Templates');}
async function apply(p,c){
 await menu(p);await p.click('[aria-label="Apply '+c.name+' template"]');
 await p.waitForFunction(id=>window.__mockupBaseline.snapshot.templateContext?.id===id,{},c.id);
 await settle(p);
}
async function fill(p,selector,value){
 await p.focus(selector);await p.keyboard.down('Control');await p.keyboard.press('A');await p.keyboard.up('Control');
 await p.keyboard.type(String(value));await p.keyboard.press('Tab');await pause(100);
}
async function measure(p){
 return p.evaluate(()=>{
  const c=document.querySelector('#studio-canvas'),b=c.getBoundingClientRect(),s=b.width/c.offsetWidth;
  return [...c.querySelectorAll('[data-canvas-text],[data-composition-object],[data-media-screen],[data-media-chrome],[data-media-frame]')].map((n,i)=>{const r=n.getBoundingClientRect();return{id:i+':'+(n.dataset.canvasText||n.dataset.compositionObject||n.tagName),x:(r.x-b.x)/s,y:(r.y-b.y)/s,width:r.width/s,height:r.height/s};});
 });
}
async function png(p,c,dir,name,scale=1){
 await button(p,'Export');await button(p,scale===1?'1x Web':'2x HD');await button(p,'PNG');await settle(p);
 const before=await state(p),hist=await history(p),preview=await measure(p);
 await p.evaluate(()=>{
  window.__trioExportGeometry=null;
  window.__trioObserver=new MutationObserver(()=>{
   const c=document.querySelector('[data-export-target]>[data-canvas-root]');if(!c)return;
   const b=c.getBoundingClientRect(),s=b.width/c.offsetWidth;
   window.__trioExportGeometry=[...c.querySelectorAll('[data-canvas-text],[data-composition-object],[data-media-screen],[data-media-chrome],[data-media-frame]')].map((n,i)=>{const r=n.getBoundingClientRect();return{id:i+':'+(n.dataset.canvasText||n.dataset.compositionObject||n.tagName),x:(r.x-b.x)/s,y:(r.y-b.y)/s,width:r.width/s,height:r.height/s};});
  });window.__trioObserver.observe(document.body,{subtree:true,childList:true,attributes:true});
 });
 const d=await downloadPng(p,dir,name,()=>button(p,'Download '+scale+'x ('+c.width*scale+'×'+c.height*scale+')'));
 const metadata=await sharp(d.path).metadata();
 assert.equal(metadata.width,c.width*scale);assert.equal(metadata.height,c.height*scale);
 assert.deepEqual(await state(p),before,'Export preserves content');assert.deepEqual(await history(p),hist,'Export preserves history');
 const exported=await p.evaluate(()=>{window.__trioObserver.disconnect();return window.__trioExportGeometry;});
 assert.ok(exported);assert.equal(exported.length,preview.length);
 let maxDelta=0;for(const a of preview){const b=exported.find(x=>x.id===a.id);assert.ok(b,a.id);for(const k of ['x','y','width','height'])maxDelta=Math.max(maxDelta,Math.abs(a[k]-b[k]));}
 assert.ok(maxDelta<2,'Preview/export geometry delta '+maxDelta);
 await fs.writeFile(path.join(dir,name+'.geometry.json'),JSON.stringify({preview,exported,maxDelta},null,2));
 return {path:d.path,width:metadata.width,height:metadata.height,maxDelta};
}
async function otherFormat(p,c,dir,format){
 await button(p,'Export');await button(p,'1x Web');await button(p,format.toUpperCase());
 const folder=await fs.mkdtemp(path.join(dir,'.'+format+'-'));
 const client=await p.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:folder});
 try{
  await button(p,'Download 1x ('+c.width+'×'+c.height+')');
  let found;
  for(let i=0;i<300;i++){found=(await fs.readdir(folder)).find(n=>format==='jpeg'?/\.jpe?g$/.test(n):n.endsWith('.webp'));if(found)break;await pause(100);}
  assert.ok(found,'Actual '+format+' download');const target=path.join(dir,'default-duo-1x.'+(format==='jpeg'?'jpg':format));await fs.rename(path.join(folder,found),target);
  const m=await sharp(target).metadata();assert.equal(m.format,format);assert.equal(m.width,c.width);assert.equal(m.height,c.height);
  return {format,width:m.width,height:m.height};
 }finally{await client.detach();await fs.rmdir(folder).catch(()=>{});}
}
try{
 await fs.mkdir(output,{recursive:true});
 if(!process.env.TRIO_ORIGIN){
  server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5377','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await pause(100);}assert.ok(ready,'Server started');
 }
 browser=await launchBrowser();
 // Preview and access use the actual gallery and shared policy.
 for(const c of configs){
  page=await fresh('free');const before=await state(page),hist=await history(page);await menu(page);
  assert.equal(await page.$$eval('[data-template-gallery] article',ns=>ns.length),catalog.length);
  if(!process.env.TRIO_SKIP_PREVIEWS){
   await page.click('[aria-label="Preview '+c.name+' template"]');await page.waitForSelector('[data-template-preview][open]');
   await page.$eval('[data-template-preview] img',async n=>{await n.decode();if(!n.naturalWidth)throw Error('Missing actual preview');});
   await page.keyboard.press('Escape');await page.waitForSelector('[data-template-preview]',{hidden:true});
   assert.deepEqual(await state(page),before);assert.deepEqual(await history(page),hist);
   pass(c.id+' free preview preserves document and history');
  }
  if(c.tier==='pro'){
   await page.click('[aria-label="Apply '+c.name+' template"]');
   await page.waitForSelector('input[placeholder="DSK-XXXX-XXXX-XXXX"]',{visible:true});
   assert.deepEqual(await state(page),before);assert.deepEqual(await history(page),hist);
   pass(c.id+' free application is gated atomically');
  }else{
   await apply(page,c);assert.equal((await state(page)).templateContext.id,c.id);
   pass(c.id+' free application is available');
  }
  await page.close();page=null;
 }
 const fixtureDir=path.join(output,'fixtures');await fs.mkdir(fixtureDir,{recursive:true});
 for(const [name,w,h,bg]of [['user-square',700,700,'#BCD9CC'],['user-portrait',400,840,'#F1CDB9']]){
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'"><rect width="100%" height="100%" fill="'+bg+'"/><text x="32" y="60" font-size="25" fill="#243B42">My independent screenshot</text><rect x="32" y="110" width="'+(w-64)+'" height="'+(h-160)+'" rx="24" fill="#243B42" opacity=".12"/></svg>')).png().toFile(path.join(fixtureDir,name+'.png'));
 }
 for(const c of configs){
  const dir=path.join(output,c.id);await fs.mkdir(dir,{recursive:true});
  page=await fresh();const before=await state(page),hist=await history(page);await apply(page,c);const duo=await state(page);
  assert.equal((await history(page)).count,hist.count+1);
  await button(page,'Undo');assert.deepEqual(await state(page),before);await button(page,'Redo');assert.deepEqual(await state(page),duo);
  const media=await page.$$eval('#studio-canvas [data-media-screen] img',ns=>ns.map(n=>({width:n.naturalWidth,height:n.naturalHeight,src:n.getAttribute('src')})));
  assert.equal(media.length,2);assert.ok(media.every(n=>n.width>0&&n.height>0));assert.notEqual(media[0].src,media[1].src);
  await fs.writeFile(path.join(dir,'default-duo.snapshot.json'),JSON.stringify(duo,null,2));
  await page.mouse.move(0,0);await(await page.$('#studio-canvas')).screenshot({path:path.join(dir,'default-duo.preview.png')});
  const files=[];files.push(await png(page,c,dir,'default-duo-1x.png',1));files.push(await png(page,c,dir,'default-duo-2x.png',2));
  const formats=[];for(const format of ['webp','jpeg'])formats.push(await otherFormat(page,c,dir,format));
  pass(c.id+' native duo and 1x/2x PNG/WebP/JPEG export');
  await selectElement(page,'Headline');await button(page,'Text');
  await page.click('[data-canvas-text-controls] [aria-label="Edit text"]');
  await fill(page,'[aria-label="Text content"]','An editable product headline');
  await button(page,'Text');await settle(page);
  assert.notDeepEqual((await state(page)).textDocument,duo.textDocument);
  await button(page,'Undo');assert.deepEqual(await state(page),duo);
  pass(c.id+' editable headline with complete Undo');
  await button(page,'Frame');await button(page,'Hide Image 2');await settle(page);
  const single=await state(page);assert.equal(single.secondarySrc,duo.secondarySrc);assert.equal(single.compositionDocument.detailVisible,false);
  assert.equal(await page.$$eval('#studio-canvas [data-media-screen] img',ns=>ns.length),1);
  files.push(await png(page,c,dir,'single-1x.png',1));
  await fs.writeFile(path.join(dir,'single.snapshot.json'),JSON.stringify(single,null,2));
  await button(page,'Undo');assert.deepEqual(await state(page),duo);
  pass(c.id+' native single layout and reversible visibility');
  await button(page,'Frame');
  await(await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.join(fixtureDir,'user-square.png'));
  await page.waitForFunction(()=>window.__mockupBaseline.snapshot.imageName==='user-square.png');
  const main=await state(page);assert.equal(main.secondarySrc,duo.secondarySrc);
  await(await page.$('[aria-label="Second screenshot file"]')).uploadFile(path.join(fixtureDir,'user-portrait.png'));
  await page.waitForFunction(()=>window.__mockupBaseline.snapshot.secondaryName==='user-portrait.png');
  const uploaded=await state(page);assert.equal(uploaded.imageSrc,main.imageSrc);
  await settle(page);files.push(await png(page,c,dir,'user-duo-1x.png',1));
  const next=configs[(configs.indexOf(c)+1)%configs.length];await apply(page,next);
  assert.equal((await state(page)).imageSrc,uploaded.imageSrc);assert.equal((await state(page)).secondarySrc,uploaded.secondarySrc);
  pass(c.id+' independent uploads survive template switch');
  results.templates.push({id:c.id,name:c.name,tier:c.tier,width:c.width,height:c.height,media,files,formats});
  await page.close();page=null;
  if(!process.env.TRIO_SKIP_PREVIEWS){
   page=await fresh('free',390);await menu(page);await page.click('[aria-label="Preview '+c.name+' template"]');
   await page.waitForSelector('[data-template-preview][open]');await page.$eval('[data-template-preview] img',n=>n.decode());
   const width=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth,document.querySelector('[data-template-preview]').getBoundingClientRect().width));
   assert.ok(width<=390,'Mobile preview width '+width);
   await page.screenshot({path:path.join(dir,'gallery-mobile-390.png'),fullPage:true});
   await page.close();page=null;pass(c.id+' 390px preview no overflow');
  }
 }
 assert.deepEqual(results.errors,[]);results.passed=true;
 console.log(JSON.stringify({passed:true,checks:results.checks.length,output}));
}catch(error){
 results.passed=false;results.failure=error.stack;process.exitCode=1;console.error(error.stack);
 await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});
}finally{
 await browser?.close();server?.kill();results.finishedAt=new Date().toISOString();
 await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
}
