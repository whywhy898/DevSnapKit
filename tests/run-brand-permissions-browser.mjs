import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { launchBrowser, clickButton, downloadPng } from './helpers/browser.mjs';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const output=process.env.BRAND_PERMISSIONS_OUTPUT||path.resolve(root,'../../output/devsnapkit/whole-card-free-brand/m1/permissions');
const jsQR=createRequire(path.resolve(root,'../../output/devsnapkit/whole-card-free-brand/tools/package.json'))('jsqr');
const {getCanonicalDimensions}=createTypeScriptLoader(path.join(root,'src'))('canvasDimensions.ts');
const origin='http://127.0.0.1:5218',url='https://bloomboard.example/license-check';
const pause=ms=>new Promise(r=>setTimeout(r,ms));let server,browser,page;const results=[],errors=[];
async function closeUpsell(){await page.waitForSelector('button[title="Close"]',{visible:true});await page.click('button[title="Close"]')}
async function verifyQr(file,logicalWidth){
  const meta=await sharp(file).metadata();const s=await page.evaluate(()=>window.__mockupBaseline.snapshot);
  const scale=meta.width/logicalWidth;
  const margin=Math.max(12,Math.round(s.padding*.45))*scale,side=meta.height*s.qrScale/100;
  const crop=await sharp(file).extract({left:Math.max(0,Math.floor(margin-2)),top:Math.max(0,Math.floor(meta.height-margin-side-2)),width:Math.ceil(side+4),height:Math.ceil(side+4)}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(jsQR(new Uint8ClampedArray(crop.data),crop.info.width,crop.info.height)?.data,url);
  const logoSide=meta.height*s.logoScale/100;
  const pixel=await sharp(file).extract({left:Math.floor(meta.width-margin-logoSide/2),top:Math.floor(meta.height-margin-logoSide/2),width:1,height:1}).removeAlpha().raw().toBuffer();
  assert.ok([229,44,72].every((c,i)=>Math.abs(c-pixel[i])<=3),'logo pixels survive high-resolution and batch export');
  return{width:meta.width,height:meta.height,logoCenter:[...pixel]};
}
try{
  await fs.mkdir(output,{recursive:true});
  server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5218','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break}}catch{}await pause(100)}assert.ok(ready,'server started');
  browser=await launchBrowser();
  for(const mode of ['free','invalid-key','valid-key']){
    page=await browser.newPage();await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});
    const requests=[];page.on('pageerror',e=>errors.push(e.message));
    await page.evaluateOnNewDocument(mode=>{localStorage.clear();localStorage.setItem('devsnapkit_welcome_seen','1');if(mode!=='free')localStorage.setItem('devsnapkit_license_key','DSK-AAAA-BBBB-CCCC')},mode);
    await page.setRequestInterception(true);page.on('request',async request=>{const u=new URL(request.url());if(u.pathname==='/api/verify-license'){requests.push(u.pathname);await request.respond({status:200,contentType:'application/json',body:JSON.stringify(mode==='valid-key'?{valid:true,tier:'pro_lifetime',serverVerified:true}:{valid:false,error:'Fixture invalid signature'})});return}if(u.pathname.startsWith('/api/')){await request.respond({status:200,contentType:'application/json',body:'{}'});return}if(u.hostname.includes('paypal.com')){await request.respond({status:200,contentType:'text/javascript',body:''});return}await request.continue()});
    await page.goto(origin+'/?editor=1',{waitUntil:'networkidle0'});await page.waitForSelector('#studio-canvas');
    if(mode!=='free')assert.ok(requests.length,'license validation really called the server entrance');
    await clickButton(page,'Brand');
    await(await page.$('[aria-label="Logo file"]')).uploadFile(path.join(root,'tests/fixtures/whole-card/free-logo.svg'));
    await page.waitForFunction(()=>!!window.__mockupBaseline.snapshot.logoDataUrl);
    await page.focus('[aria-label="QR website URL"]');await page.keyboard.type(url);await page.keyboard.press('Tab');
    await page.waitForSelector('#studio-canvas img[alt="QR Code"]');
    assert.equal(await page.evaluate(()=>window.__mockupBaseline.artwork().isProUnlocked),mode==='valid-key');
    await clickButton(page,'Export');
    await clickButton(page,'4K Ultra');
    if(mode!=='valid-key'){
      await closeUpsell();await clickButton(page,'Unlock Batch Export in Pro');await closeUpsell();
      await clickButton(page,'Canvas');
      const before=await page.evaluate(()=>window.__mockupBaseline.snapshot.gradientId);
      const paidGradient=await page.$('button[title$=" (Pro)"]');assert.ok(paidGradient,'paid gradient is available to request');await paidGradient.click();await closeUpsell();
      assert.equal(await page.evaluate(()=>window.__mockupBaseline.snapshot.gradientId),before);
      assert.equal(await page.evaluate(()=>window.__mockupBaseline.artwork().isProUnlocked),false);
      results.push({scenario:`${mode}-brand-free-paid-export-and-gradient-still-gated`,verificationRequests:requests.length,pass:true});
    }else{
      const dims=await page.evaluate(()=>{const c=document.querySelector('#studio-canvas');return{width:parseFloat(c.style.width),height:parseFloat(c.style.height)}});
      await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(n=>n.getClientRects().length&&n.innerText.startsWith('Download 4K (')));
      const label=await page.$$eval('button',nodes=>nodes.find(n=>n.getClientRects().length&&n.innerText.startsWith('Download 4K (')).innerText.trim());
      const downloaded=await downloadPng(page,output,'valid-pro-4x.png',()=>clickButton(page,label));
      const meta=await verifyQr(downloaded.path,dims.width);
      const expected=getCanonicalDimensions('auto',4,0,0,dims.width,dims.height);
      assert.equal(meta.width,Math.round(expected.width));assert.equal(meta.height,Math.round(expected.height));
      results.push({scenario:'verified-pro-existing-4K-with-free-brand',note:'Existing legacy 4K output is not a uniform 4x multiplier; product behavior retained.',...meta,file:downloaded.path});
      await clickButton(page,'2x HD');const dir=await fs.mkdtemp(path.join(output,'batch-'));
      const client=await page.createCDPSession();await client.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
      await clickButton(page,'Export 4 Sizes (2x)');let files=[];
      for(let i=0;i<450;i++){files=(await fs.readdir(dir)).filter(n=>n.endsWith('.png'));if(files.length===4)break;await pause(100)}
      assert.equal(files.length,4,'all four batch downloads completed');
      const batch=[];for(const name of files){const file=path.join(dir,name),meta=await sharp(file).metadata();const id=['og','16-9','4-3','1-1'].find(id=>{const size=getCanonicalDimensions(id,2,0,0);return size.width===meta.width&&size.height===meta.height});assert.ok(id,'known batch target dimensions');batch.push({file,target:id,...await verifyQr(file,getCanonicalDimensions(id,1,0,0).width)})}
      await client.detach();results.push({scenario:'verified-pro-batch-four-sizes-retains-QR',files:batch});
      await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(n=>!n.disabled&&n.innerText.startsWith('Export 4 Sizes (2x)')));
      await clickButton(page,'Canvas');const paid=await page.waitForSelector('button[title$=" (Pro)"]',{visible:true});await paid.click();assert.equal(await page.$('button[title="Close"]'),null,'valid Pro can select paid gradient');
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({pass:results.length,errors}));
}catch(error){const result=JSON.stringify({message:error.message,stack:error.stack,results,errors},null,2);await fs.writeFile(path.join(output,'failure.json'),result);await fs.writeFile(path.join(output,`failure-${Date.now()}.json`),result);throw error}
finally{await browser?.close();server?.kill()}
