import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { launchBrowser,clickButton,downloadPng,finishTextEditing } from './helpers/browser.mjs';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const output=process.env.COPY_OUTPUT||path.resolve(root,'../../output/devsnapkit/whole-card-free-brand/m2/task5/browser',new Date().toISOString().replace(/[:.]/g,'-'));
const origin=process.env.COPY_ORIGIN||'http://127.0.0.1:5230';
const results=[],errors=[],dialogs=[];let server,browser,page;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function newPage(width=1440,welcome=false){
  page=await browser.newPage();await page.setViewport({width,height:1100,deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.accept()});
  await page.evaluateOnNewDocument(welcome=>{localStorage.clear();if(!welcome)localStorage.setItem('devsnapkit_welcome_seen','1');window.paypal={Buttons:config=>({render(container){const n=typeof container==='string'?document.querySelector(container):container;const b=document.createElement('button');b.textContent='Test checkout';b.onclick=async()=>{const id=await config.createOrder();await config.onApprove({orderID:id})};n.append(b)}})}},welcome);
  await page.setRequestInterception(true);page.on('request',async request=>{const u=new URL(request.url());let data;
    if(u.hostname.includes('paypal.com')){await request.respond({status:200,contentType:'text/javascript',body:''});return}
    if(u.pathname==='/api/paypal-config')data={clientId:'test-client',mode:'sandbox'};
    else if(u.pathname==='/api/paypal-create-order')data={id:'ORDER1234567890123'};
    else if(u.pathname==='/api/paypal-capture-order'||u.pathname==='/api/claim-license')data={success:true,licenseKey:'DSK-AAAA-BBBB-CCCC'};
    else if(u.pathname==='/api/verify-license')data={valid:true,tier:'pro_lifetime',serverVerified:true};
    else if(u.pathname.startsWith('/api/'))data={};
    if(data){await request.respond({status:200,contentType:'application/json',body:JSON.stringify(data)});return}await request.continue();
  });await page.goto(origin+(welcome?'/':'/?editor=1'),{waitUntil:'networkidle0'});await page.waitForSelector('#studio-canvas');
}
async function modal(name){await page.waitForSelector('[data-pro-benefits]');const info=await page.$eval('[data-pro-benefits]',n=>({text:n.textContent,items:n.querySelectorAll('li').length,bottom:n.getBoundingClientRect().bottom}));assert.equal(info.items,3);for(const s of ['High-resolution export presets','Batch export','Premium gradient backgrounds','Text, logo uploads and QR codes are included in Free.'])assert.ok(info.text.includes(s),s);assert.doesNotMatch(info.text,/Dynamic|3840|4×|4x|Everything Included/);assert.ok(info.bottom<=1100,'benefit explanation fits initial viewport');await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});results.push({scenario:name,pass:true});}
async function closeModal(){await page.click('button[title="Close"]')}
try{
  await fs.mkdir(output,{recursive:true});if(!process.env.COPY_ORIGIN){server=spawn(process.execPath,[path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js'),'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5230','--strictPort'],{cwd:root,stdio:'ignore',windowsHide:true});let ready=false;for(let i=0;i<100;i++){try{if((await fetch(origin)).ok){ready=true;break}}catch{}await pause(100)}assert.ok(ready)}
  browser=await launchBrowser();
  if(process.argv.includes('--assets')){
    await newPage();await page.click('[aria-label="Templates"]');await page.click('[aria-label="Apply Editorial Honey template"]');await page.waitForSelector('[data-composition-object="secondary"]');
    const credit=await page.evaluate(()=>window.__mockupBaseline.snapshot.templateContext.textRoles.credit);await page.click(`[data-text-hit="${credit}"]`);await page.waitForSelector('[aria-label="Text content"]');await page.focus('[aria-label="Text content"]');await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await finishTextEditing(page);
    await clickButton(page,'Brand');await(await page.$('[aria-label="Logo file"]')).uploadFile(path.resolve(root,'../../output/devsnapkit/whole-card-free-brand/m2/neutral-logo.svg'));await page.waitForFunction(()=>!!window.__mockupBaseline.snapshot.logoDataUrl);
    await page.focus('[aria-label="QR website URL"]');await page.keyboard.type('https://devsnapkit.com');await page.keyboard.press('Tab');await page.waitForSelector('#studio-canvas img[alt="QR Code"]');await page.click('[aria-label="QR position bottom-right"]');
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(n=>n.decode()))});
    const bounds=await(await page.$('#studio-canvas')).boundingBox();await page.mouse.click(bounds.x+bounds.width*.5625,bounds.y+bounds.height*.9583);await page.mouse.move(0,0);
    const ui=path.join(output,'brand-free-ui.png');await(await page.$('main')).screenshot({path:ui});
    await clickButton(page,'Export');await clickButton(page,'2x HD');const png=await downloadPng(page,output,'brand-free-3200x2400.png',()=>clickButton(page,'Download 2x (3200×2400)'));
    assert.equal(await page.evaluate(()=>window.__mockupBaseline.artwork().isProUnlocked),false);
    const records=[];for(const [name,src]of[['feature-brand.webp',ui],['welcome-brand.webp',png.path],['showcase-8.webp',png.path]]){const target=path.join(root,'public/welcome',name);await sharp(src).resize({width:1562}).webp({quality:90}).toFile(target);records.push({name,source:src,sha256:createHash('sha256').update(await fs.readFile(target)).digest('hex'),...(await sharp(target).metadata().then(x=>({width:x.width,height:x.height})))})}
    await fs.writeFile(path.join(output,'branding-assets.json'),JSON.stringify({freeUser:true,method:'Real editor screenshot + actual in-product PNG download; neutral logo uploaded, static QR added, editable credit cleared using Text UI.',records},null,2));await page.close();
  }
  for(const width of [1440,360,390,430]){
    await newPage(width);await clickButton(page,'Export');await clickButton(page,'4K Ultra');await modal(`pro-high-resolution-${width}`);await closeModal();await clickButton(page,'Unlock Batch Export in Pro');await modal(`pro-batch-${width}`);await closeModal();await clickButton(page,'Canvas');const g=await page.$('button[title$=" (Pro)"]');await g.click();await modal(`pro-gradient-${width}`);await closeModal();await clickButton(page,'Brand');const brand=await page.$eval('[data-brand-controls]',n=>n.textContent);assert.doesNotMatch(brand,/Pro|Unlock|\$1|Dynamic/);await page.close();
  }
  await newPage(1440);await page.click('button[title="Activate or Redeem License Key"]');await page.type('input[placeholder="DSK-XXXX-XXXX-XXXX"]','DSK-AAAA-BBBB-CCCC');await clickButton(page,'Activate Pro Lifetime Pass');await page.waitForFunction(()=>localStorage.getItem('devsnapkit_pro_unlocked')==='true');assert.ok(dialogs.some(s=>s.includes('high-resolution export presets')&&s.includes('batch export')&&!s.includes('QR')));results.push({scenario:'activation-confirmation-actual-verification-entry',pass:true});await page.close();
  await newPage(390);await page.evaluate(()=>[...document.querySelectorAll('button')].find(n=>n.textContent.includes('Pro ($1)')).click());await page.waitForSelector('[data-pro-benefits]');await clickButton(page,'Test checkout');await page.waitForFunction(()=>document.body.textContent.includes('High-resolution export presets, batch export and premium gradient backgrounds are unlocked for life.'));await page.screenshot({path:path.join(output,'purchase-success-390.png'),fullPage:true});results.push({scenario:'purchase-success-simulated-payment-only',pass:true});await page.close();
  await newPage(1440,true);await page.waitForSelector('.welcome-brand-section');assert.match(await page.$eval('.welcome-brand-section',n=>n.textContent),/Logo & QR — Free/);assert.doesNotMatch(await page.$eval('.welcome-brand-section',n=>n.textContent),/\$1|Exclusively|Dynamic/);await page.$eval('.welcome-brand-section',n=>n.scrollIntoView());await page.screenshot({path:path.join(output,'welcome-brand-free.png'),fullPage:true});results.push({scenario:'welcome-free-brand',pass:true});await page.close();
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'results.json'),JSON.stringify({output,results,errors},null,2));console.log(JSON.stringify({output,pass:results.length,errors}));
}catch(error){if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,results,errors},null,2));throw error}finally{await browser?.close();server?.kill()}
