import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { launchBrowser, clickButton, downloadPng } from './helpers/browser.mjs';

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const output=process.env.BRAND_OUTPUT||path.resolve(root,'../../output/devsnapkit/whole-card-free-brand/m1/task4');
const origin=process.env.BRAND_ORIGIN||'http://127.0.0.1:5217';
const toolsRequire=createRequire(path.resolve(root,'../../output/devsnapkit/whole-card-free-brand/tools/package.json'));
const jsQR=toolsRequire('jsqr');
const targetUrl='https://bloomboard.example/free-brand';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const results=[],errors=[];let browser,server,page;
const runId=new Date().toISOString().replaceAll(':','-');
const sourceHash=createHash('sha256');
for(const file of ['src/App.tsx','src/MockupArtwork.tsx','src/composition/CompositionRenderer.tsx','src/inspector/BrandControls.tsx'])sourceHash.update(file).update(await fs.readFile(path.join(root,file)));
const sourceSha256=sourceHash.digest('hex');

async function settle(){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(n=>n.decode()))});}
async function field(label,value){const selector=`[aria-label="${label}"]`;await page.focus(selector);await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type(value);await page.keyboard.press('Tab');}
async function positions(){return page.evaluate(()=>{const c=document.querySelector('#studio-canvas'),b=c.getBoundingClientRect(),scale=b.width/c.offsetWidth;const rect=n=>{const r=n.getBoundingClientRect();return{x:(r.x-b.x)/scale,y:(r.y-b.y)/scale,w:r.width/scale,h:r.height/scale}};const logo=c.querySelector('img[alt="Brand Logo"]'),qr=c.querySelector('img[alt="QR Code"]');return{logo:rect(logo),qr:rect(qr.parentElement)}});}
async function inspectPng(file,scale,opacity){
  const buffer=await fs.readFile(file),meta=await sharp(buffer).metadata();assert.equal(meta.width,1600*scale);assert.equal(meta.height,1200*scale);
  const boxes=await positions();const px=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const color=(x,y)=>{const i=(Math.round(y*scale)*px.info.width+Math.round(x*scale))*4;return [...px.data.subarray(i,i+3)]};
  const center=color(boxes.logo.x+boxes.logo.w/2,boxes.logo.y+boxes.logo.h/2);
  const background=[251,248,235],red=[229,44,72],expected=red.map((c,i)=>Math.round(c*opacity+background[i]*(1-opacity)));
  assert.ok(center.every((c,i)=>Math.abs(c-expected[i])<=3),`logo opacity ${opacity}: ${center} vs ${expected}`);
  const edge=color(boxes.logo.x+1,boxes.logo.y+1);
  assert.ok(edge.every((c,i)=>Math.abs(c-background[i])<=3),`transparent logo edge must reveal canvas: ${edge}`);
  const q=boxes.qr,left=Math.max(0,Math.floor(q.x*scale)),top=Math.max(0,Math.floor(q.y*scale));
  const crop=await sharp(buffer).extract({left,top,width:Math.min(meta.width-left,Math.ceil(q.w*scale)),height:Math.min(meta.height-top,Math.ceil(q.h*scale))}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const decoded=jsQR(new Uint8ClampedArray(crop.data),crop.info.width,crop.info.height);
  assert.equal(decoded?.data,targetUrl,'QR from real exported pixels must decode to the entered URL');
  return{width:meta.width,height:meta.height,logoCenter:center,transparentEdge:edge,qrUrl:decoded.data};
}
async function download(name,scale,opacity=1){await clickButton(page,'Export');await clickButton(page,scale===1?'1x Web':'2x HD');await settle();const artifact=await downloadPng(page,output,name,()=>clickButton(page,`Download ${scale}x (${1600*scale}×${1200*scale})`));return{file:artifact.path,...await inspectPng(artifact.path,scale,opacity)};}
async function brand(){const tab=await page.evaluateHandle(()=>[...document.querySelectorAll('[data-inspector-tabs] button')].find(n=>[...n.querySelectorAll('span')].some(s=>s.textContent==='Brand')));await tab.click();await tab.dispose();assert.ok(await page.$('[data-brand-controls]'),'free Brand form must be exposed');const text=await page.$eval('[data-brand-controls]',n=>n.textContent);assert.doesNotMatch(text,/PRO SUITE|Unlock|Dynamic QR|\$1|Text Brand Badge/);}
async function createPage(mode='free',viewport={width:1440,height:1100,deviceScaleFactor:1}){
  page=await browser.newPage();await page.setViewport(viewport);
  const verification=[],uploads=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluateOnNewDocument(mode=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');if(mode!=='free')localStorage.setItem('devsnapkit_license_key','DSK-AAAA-BBBB-CCCC');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{const b=await items[0].getType('image/png');window.__copiedPng=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(b)})}}});},mode);
  await page.setRequestInterception(true);page.on('request',async request=>{const u=new URL(request.url());if(request.method()==='POST'&&request.postData()?.includes('data:image'))uploads.push(u.pathname);if(u.pathname==='/api/verify-license'){verification.push(u.pathname);await request.respond({status:200,contentType:'application/json',body:JSON.stringify(mode==='valid-key'?{valid:true,tier:'pro_lifetime',serverVerified:true}:{valid:false,error:'Test invalid signature'})});return}if(u.pathname.startsWith('/api/')){await request.respond({status:200,contentType:'application/json',body:'{}'});return}if(u.hostname.includes('paypal.com')){await request.respond({status:200,contentType:'text/javascript',body:''});return}await request.continue()});
  await page.goto(origin+'/?editor=1',{waitUntil:'networkidle0'});await page.waitForSelector('#studio-canvas');
  if(mode!=='free')assert.ok(verification.length,'actual server-verification entrance was used');
  return{verification,uploads};
}
async function setup(scene){
  if(scene==='honey'){await page.click('[aria-label="Templates"]');await page.click('[aria-label="Apply Editorial Honey template"]');await page.waitForSelector('[data-composition-object="secondary"]');}
  else await page.evaluate(scene=>{const s=structuredClone(window.__mockupBaseline.snapshot);window.__mockupBaseline.apply({...s,compositionDocument:null,templateContext:null,layoutMode:scene==='duo'?'duo':'single',secondarySrc:s.imageSrc,secondaryName:'Second sample',aspectRatioId:'custom',customCanvasSize:{width:1600,height:1200},bgType:'solid',solidColor:'#fbf8eb',padding:100,vfxGlow:false,vfxNoise:false,logoDataUrl:null,qrUrl:'',customBrandWatermark:''})},scene);
  await settle();await brand();
  const logo=await page.$('[aria-label="Logo file"]');assert.ok(logo,'Logo upload field exists for free users');await logo.uploadFile(path.join(root,'tests/fixtures/whole-card/free-logo.svg'));
  await page.waitForFunction(()=>!!window.__mockupBaseline.snapshot.logoDataUrl);await settle();
  await field('QR website URL',targetUrl);await page.waitForFunction(()=>!!document.querySelector('#studio-canvas img[alt="QR Code"]'));await settle();
  if(scene!=='honey')await page.click('[aria-label="Logo position top-left"]');
  await page.click('[aria-label="QR position bottom-right"]');
  assert.equal(await page.evaluate(()=>window.__mockupBaseline.artwork().isProUnlocked),false,'brand actions cannot activate Pro');
}

try{
  await fs.mkdir(output,{recursive:true});
  if(!process.env.BRAND_ORIGIN){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5217','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break}}catch{}await pause(100)}if(!ready)throw Error('Brand server failed to start')}
  browser=await launchBrowser();
  for(const scene of ['single','duo','honey']){
    const {uploads}=await createPage();await setup(scene);
    results.push({scenario:`free-${scene}-download-1x`,...await download(`${scene}-free-1x.png`,1)});
    results.push({scenario:`free-${scene}-download-2x`,...await download(`${scene}-free-2x.png`,2)});
    await brand();await field('Logo opacity percent','50');assert.equal(await page.evaluate(()=>window.__mockupBaseline.snapshot.logoOpacity),.5);
    results.push({scenario:`free-${scene}-opacity50`,...await download(`${scene}-free-opacity50.png`,1,.5)});
    await clickButton(page,'Undo');await page.waitForFunction(()=>window.__mockupBaseline.snapshot.logoOpacity===1);
    await clickButton(page,'Redo');await page.waitForFunction(()=>window.__mockupBaseline.snapshot.logoOpacity===.5);
    await brand();await field('Logo opacity percent','100');
    await page.evaluate(()=>{window.__copiedPng=null});await clickButton(page,'Copy');await page.waitForFunction(()=>typeof window.__copiedPng==='string',{timeout:30000});
    const copied=await page.evaluate(()=>window.__copiedPng);const file=path.join(output,`${scene}-clipboard-2x.png`);await fs.writeFile(file,Buffer.from(copied.split(',')[1],'base64'));
    results.push({scenario:`free-${scene}-copy-payload-2x`,sink:'clipboard.write intercepted; real product image preparation/rendering',...await inspectPng(file,2,1)});
    await brand();await page.screenshot({path:path.join(output,`${scene}-brand-desktop.png`),fullPage:true});
    assert.deepEqual(uploads,[],'image bytes must not be sent to an API');
    await page.close();
  }
  // Invalid verification must not affect free branding or activate paid exports.
  for(const mode of ['invalid-key','valid-key']){
    const {verification}=await createPage(mode);await brand();
    const fieldHandle=await page.$('[aria-label="Logo file"]');assert.ok(fieldHandle);await fieldHandle.uploadFile(path.join(root,'tests/fixtures/whole-card/free-logo.svg'));
    await page.waitForFunction(()=>!!window.__mockupBaseline.snapshot.logoDataUrl);
    assert.equal(await page.evaluate(()=>window.__mockupBaseline.artwork().isProUnlocked),mode==='valid-key');
    results.push({scenario:`${mode}-free-brand`,verificationRequests:verification.length,pass:true});await page.close();
  }
  await createPage();await setup('honey');
  await brand();await page.click('button.brand-remove');await page.waitForFunction(()=>!window.__mockupBaseline.snapshot.logoDataUrl);await settle();
  assert.equal(await page.$$eval('#studio-canvas img[alt="Brand Logo"]',n=>n.length),0);assert.ok(await page.$('#studio-canvas [data-composition-object="brand-mark"] svg'));
  await clickButton(page,'Undo');await page.waitForFunction(()=>!!window.__mockupBaseline.snapshot.logoDataUrl);await settle();
  results.push({scenario:'remove-template-logo-restores-mark-and-undo',pass:true});
  const invalid=path.join(output,'invalid-logo.png');await fs.writeFile(invalid,'deliberately invalid image');
  await brand();await page.click('button.brand-remove');await page.waitForFunction(()=>!window.__mockupBaseline.snapshot.logoDataUrl);
  await(await page.$('[aria-label="Logo file"]')).uploadFile(invalid);await page.waitForFunction(()=>!!document.querySelector('[data-brand-controls] [role="alert"]'));
  await clickButton(page,'Export');await clickButton(page,'1x Web');await clickButton(page,'Download 1x (1600×1200)');
  await page.waitForFunction(()=>/Brand logo/i.test(document.querySelector('[data-text-export-error]')?.textContent||''));
  results.push({scenario:'failed-first-logo-blocks-export-until-replace-or-remove',pass:true});
  await brand();
  await(await page.$('[aria-label="Logo file"]')).uploadFile(path.join(root,'tests/fixtures/whole-card/free-logo.svg'));await page.waitForFunction(()=>!document.querySelector('[data-brand-controls] [role="alert"]'));await settle();
  results.push({scenario:'logo-decode-error-retry',...await download('recovered-logo-1x.png',1)});
  await page.close();
  for(const width of [360,390,430]){
    await createPage('free',{width,height:1000,deviceScaleFactor:1,isMobile:true,hasTouch:true});await setup('honey');await brand();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
    await page.screenshot({path:path.join(output,`brand-mobile-${width}.png`),fullPage:true});
    results.push({scenario:`brand-${width}-no-horizontal-overflow`,pass:true});await page.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'results.json'),JSON.stringify({runId,sourceSha256,results,errors},null,2));console.log(JSON.stringify({pass:results.length,errors}));
}catch(error){if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});const failure=JSON.stringify({runId,sourceSha256,message:error.message,stack:error.stack,results,errors},null,2);await fs.writeFile(path.join(output,'failure.json'),failure);await fs.writeFile(path.join(output,`failure-${runId}.json`),failure);throw error;}
finally{await browser?.close();server?.kill()}
