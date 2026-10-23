import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { launchBrowser, preparePage, clickButton, downloadPng, legacyPosterUrl } from './helpers/browser.mjs';
const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/poster-v1');
const evidence = path.resolve(fixtures, '../../../../../output/devsnapkit/poster-v1/ui');
const url = process.env.TEST_UI_URL || 'http://127.0.0.1:5179/?editor=1';
const scope = '[data-poster-editor]';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const field = label => `${scope} [aria-label="${label}"]`;
async function open(browser, width = 1600) {
  await fs.mkdir(evidence, { recursive: true });
  const page = await preparePage(browser, legacyPosterUrl(url), { viewport: { width, height: 1000, deviceScaleFactor: 1 } });
  await page.waitForSelector('[data-poster-artwork]');
  await page.evaluate(() => document.fonts.ready); return page;
}
async function fill(page, selector, value) {
  await page.focus(selector); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace'); await page.keyboard.type(String(value)); await page.keyboard.press('Tab');
}
async function position(page, role) {
  return page.$eval(`[data-poster-role="${role}"]`, n => ({ x: parseFloat(n.style.left), y: parseFloat(n.style.top), transform: n.style.transform, width: parseFloat(n.style.width), height: parseFloat(n.style.height) }));
}
async function source(page, role) { return page.$eval(`[data-poster-role="${role}"] img`, n => n.src); }
async function upload(page, role, fixture) {
  const old = role === 'logo' ? await page.$eval('.poster-brand', n => n.querySelector('img')?.src || '') : await source(page, role);
  await (await page.$(field(`Replace ${role}`))).uploadFile(path.join(fixtures, fixture));
  await page.waitForFunction((role, old) => { const image = document.querySelector(role === 'logo' ? '.poster-brand img' : `[data-poster-role="${role}"] img`); return image?.src !== old && image?.complete && image.naturalWidth > 0; }, {}, role, old);
}
async function startRecording(page, name) {
  const directory = path.join(evidence, `${name}-frames`); await fs.mkdir(directory, { recursive: true });
  const client = await page.createCDPSession(), frames = []; let chain = Promise.resolve();
  client.on('Page.screencastFrame', event => { const index = frames.length; frames.push({ file: `${String(index).padStart(6, '0')}.jpg`, timestamp: event.metadata.timestamp }); chain = chain.then(() => fs.writeFile(path.join(directory, frames[index].file), Buffer.from(event.data, 'base64'))); client.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {}); });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 75, maxWidth: 1600, maxHeight: 1000, everyNthFrame: 1 });
  return async () => { await client.send('Page.stopScreencast'); await chain; await client.detach(); if (!frames.length) return;
    const list = frames.map((frame, i) => `file '${frame.file}'\nduration ${Math.max(.04, (frames[i + 1]?.timestamp || frame.timestamp + .5) - frame.timestamp)}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`;
    await fs.writeFile(path.join(directory, 'frames.txt'), list);
    const result = spawnSync(process.env.FFMPEG_PATH || 'C:/Users/whywh/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(directory, 'frames.txt'), '-fps_mode', 'vfr', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(evidence, `${name}.mp4`)], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || 'ffmpeg recording conversion'); };
}

test('legacy uploads are independent, text stays safe, undo is transactional and resizing preserves session', { timeout: 90000 }, async () => {
  const browser = await launchBrowser(); let stop;
  try {
    const page = await open(browser); stop = await startRecording(page, 'desktop-main-flow');
    const originalDetail = await source(page, 'detail'); await upload(page, 'main', 'honey-main.png'); assert.equal(await source(page, 'detail'), originalDetail);
    await upload(page, 'detail', 'honey-detail.png'); const main = await source(page, 'main'), detail = await source(page, 'detail');
    await fill(page, field('detail X'), 340); await fill(page, field('detail Y'), 920); await page.select(field('Detail fit'), 'cover'); await page.select(field('Crop alignment'), 'right');
    const placement = await position(page, 'detail'); await upload(page, 'detail', 'square.png'); assert.deepEqual(await position(page, 'detail'), placement);
    assert.equal(await page.$eval(field('Detail fit'), n => n.value), 'cover'); assert.equal(await page.$eval(field('Crop alignment'), n => n.value), 'right'); assert.equal(await source(page, 'main'), main);
    await upload(page, 'logo', 'logo.png'); assert.ok(await page.$('.poster-brand img')); await clickButton(page, 'Clear logo'); assert.equal(await page.$('.poster-brand img'), null);
    const injection = '<script>alert(1)</script>'; await fill(page, field('Brand'), injection); assert.equal(await page.$eval('[data-poster-text="brand"]', n => n.textContent), injection); assert.equal(await page.$('[data-poster-artwork] script'), null);
    await clickButton(page, 'Undo'); assert.equal(await page.$eval('[data-poster-text="brand"]', n => n.textContent), 'Bloomboard'); await clickButton(page, 'Redo'); assert.equal(await page.$eval('[data-poster-text="brand"]', n => n.textContent), injection);
    await fill(page, field('Brand'), 'HoneyWeRank'); await fill(page, field('Headline'), 'Be the brand AI'); await fill(page, field('Highlight'), 'recommends.'); await fill(page, field('Website'), 'honeywerank.com');
    await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 }); await delay(100); await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 }); await delay(100);
    assert.equal(await source(page, 'main'), main); assert.notEqual(await source(page, 'detail'), detail); assert.equal(await page.$eval('[data-poster-text="brand"]', n => n.textContent), 'HoneyWeRank');
    await page.focus(field('Brand')); const prevented = await page.$eval(field('Brand'), n => [false,true].map(isComposing=>{ const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true, isComposing }); n.dispatchEvent(event); return event.defaultPrevented; })); assert.deepEqual(prevented, [false,false]);
    await page.$eval(field('Brand'), n => { n.selectionStart=n.selectionEnd=n.value.length; n.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); }); await page.keyboard.sendCharacter('中文'); await page.keyboard.press('Tab'); await page.$eval(field('Brand'), n => n.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文' }))); assert.equal(await page.$eval('[data-poster-text="brand"]', n => n.textContent), 'HoneyWeRank中文'); await clickButton(page,'Undo'); assert.equal(await page.$eval('[data-poster-text="brand"]', n => n.textContent), 'HoneyWeRank');
    await page.screenshot({ path: path.join(evidence, 'desktop-edited.png') }); await clickButton(page, 'Detail card'); await clickButton(page, 'Reset position');
    const result = await downloadPng(page, evidence, 'desktop-ui.png', () => clickButton(page, 'Download PNG')); assert.equal((await sharp(result.path).metadata()).width, 1600); await delay(300);
  } finally { if (stop) await stop(); await browser.close(); }
});

test('scaled preview drag uses logical pixels; scaling, cancel and undo preserve one gesture', { timeout: 60000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await open(browser); await page.$eval('.poster-preview', n => { n.style.flex = 'none'; n.style.width = '832px'; n.style.height = '700px'; }); await delay(300);
    const artwork = await page.$eval('[data-poster-artwork]', n => { const r=n.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width }; }), ratio=artwork.width/1600; assert.ok(Math.abs(ratio-.5)<.001, `preview scale exactly 50%: ${ratio}`);
    const before=await position(page,'main'), x=artwork.x+before.x*ratio, y=artwork.y+before.y*ratio;
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x+40,y+20,{steps:5}); await page.mouse.up(); const moved=await position(page,'main'); assert.ok(Math.abs(moved.x-before.x-40/ratio)<1); assert.ok(Math.abs(moved.y-before.y-20/ratio)<1);
    await clickButton(page,'Undo'); assert.deepEqual(await position(page,'main'),before); await clickButton(page,'Redo'); assert.deepEqual(await position(page,'main'),moved);
    const handle=await page.$('[aria-label="Scale main"]'), box=await handle.boundingBox(); await page.mouse.move(box.x+box.width/2,box.y+box.height/2); await page.mouse.down(); await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+30,{steps:4}); await page.mouse.up();
    const scaled=await position(page,'main'); assert.notEqual(scaled.transform,moved.transform); assert.equal(scaled.width/scaled.height,moved.width/moved.height); await clickButton(page,'Undo'); assert.deepEqual(await position(page,'main'),moved);
    await page.mouse.move(x+40,y+20); await page.mouse.down(); await page.mouse.move(x+80,y+40,{steps:3}); await page.$eval('.poster-preview-root', n => n.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))); await page.mouse.up(); assert.deepEqual(await position(page,'main'),moved);
    await page.mouse.move(x+40,y+20); await page.mouse.down(); await page.mouse.move(x+70,y+40,{steps:3}); await page.$eval('[data-poster-role="main"]',n=>n.releasePointerCapture(1)); await page.mouse.move(x+71,y+41); await delay(50); assert.deepEqual(await position(page,'main'),moved,'losing pointer capture cancels the uncommitted gesture'); await page.mouse.up();
    await page.mouse.move(x+40,y+20);await page.mouse.down();await page.mouse.move(x+70,y+40,{steps:3});await page.$eval('[data-poster-role="main"]',n=>n.releasePointerCapture(1));await page.mouse.up();
    await page.waitForFunction(expected=>{const node=document.querySelector('[data-poster-role="main"]');return parseFloat(node.style.left)===expected.x&&parseFloat(node.style.top)===expected.y;},{timeout:1500},moved);
    assert.deepEqual(await position(page,'main'),moved,'release immediately before pointerup also cancels the gesture after event delivery');
    await page.screenshot({path:path.join(evidence,'desktop-gesture.png')});
  } finally { await browser.close(); }
});

test('browser title font overflow blocks export and preserves the fixed browser header', {timeout:60000}, async()=>{
  const browser=await launchBrowser();
  try{
    const page=await open(browser); await fill(page,field('Browser title'),'X');
    const header=()=>page.$eval('[data-poster-text="browserTitle"]',n=>n.parentElement.parentElement.offsetHeight);
    const original=await header(); await page.select(field('Style text area'),'browserTitle'); await fill(page,field('Font size'),160);
    await delay(250); assert.equal(await header(),original,'title style cannot change browser frame height'); assert.ok(Math.abs(original-49)<=2,`nominal browser header 49px, got ${original}`);
    await clickButton(page,'Download PNG'); await page.waitForFunction(()=>document.querySelector('.poster-error')?.textContent.includes('browserTitle'));
    assert.match(await page.$eval('.poster-error',n=>n.textContent),/browserTitle.*exceeds/i);
  }finally{await browser.close();}
});

test('legacy delayed font embedding freezes editing and export size until download completes',{timeout:90000},async()=>{
  const browser=await launchBrowser();let pending=[];
  try{
    const page=await open(browser); await fill(page,field('Brand'),'Frozen during export');
    await page.setCacheEnabled(false); await page.setRequestInterception(true); let hold=true;
    page.on('request',request=>{if(hold&&request.url().includes('/poster/fonts/'))pending.push(request);else request.continue();});
    const result=await downloadPng(page,evidence,'export-controls-frozen.png',async()=>{
      await clickButton(page,'Download PNG'); await page.waitForFunction(()=>[...document.querySelectorAll('[data-poster-editor] button')].some(n=>n.textContent==='Preparing PNG…'));
      for(let attempt=0;attempt<50&&!pending.length;attempt++)await delay(100);
      assert.ok(pending.length>0,'actual font embedding request is held while controls are inspected');
      const state=await page.$eval('[data-poster-editor]',n=>({disabled:n.querySelector('.poster-controls-lock')?.matches(':disabled'),error:n.querySelector('.poster-error')?.textContent,toolbar:n.querySelector('.poster-toolbar')?.innerText}));
      assert.equal(state.disabled,true,JSON.stringify(state));
      const unlocked=await page.$$eval(`${scope} .poster-controls input, ${scope} .poster-controls textarea, ${scope} .poster-controls select, ${scope} .poster-controls button, ${scope} [aria-label="Poster export size"]`,nodes=>nodes.filter(n=>!n.matches(':disabled')).map(n=>n.getAttribute('aria-label')||n.textContent));
      assert.deepEqual(unlocked,[],'no editable control stays enabled during export');
      assert.equal(await page.$('nav[aria-label="Studio mode"]'),null,'Legacy editor has no mode navigation during output');
      await page.click(field('Brand')); await page.keyboard.type('Blocked edit');
      assert.equal(await page.$eval('[data-poster-text="brand"]',n=>n.textContent),'Frozen during export');
      await page.screenshot({path:path.join(evidence,'export-controls-frozen-preview.png')});
      hold=false; for(const request of pending)await request.continue(); pending=[];
    });
    assert.equal((await sharp(result.path).metadata()).width,1600);
    await page.waitForFunction(()=>!document.querySelector('[data-poster-editor] .poster-controls-lock')?.matches(':disabled'));
    await page.setRequestInterception(false);
  }finally{for(const request of pending)await request.continue().catch(()=>{});await browser.close();}
});

test('invalid numbers preserve state; overflow, missing main and crop confirmation guard downloads', { timeout: 90000 }, async () => {
  const browser=await launchBrowser();
  try {
    const page=await open(browser); let downloads=0; const cdp=await page.createCDPSession(); await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:evidence,eventsEnabled:true}); cdp.on('Browser.downloadWillBegin',()=>downloads++);
    const original=await position(page,'main'); for(const value of ['','NaN','Infinity','0','99999']) { await fill(page,field('main Scale'),value); assert.deepEqual(await position(page,'main'),original); await page.waitForFunction(() => Boolean(document.querySelector('[data-poster-editor] [role=alert]')), {timeout:1000}).catch(()=>{}); assert.ok(await page.$(`${scope} [role=alert]`),`invalid scale ${JSON.stringify(value)} must report an error`); } await fill(page,field('main Scale'),1);
    await fill(page,field('Description'),'Overflow line\n'.repeat(25)); await clickButton(page,'Download PNG'); await delay(500); assert.match(await page.$eval('.poster-error',n=>n.textContent),/description.*exceeds/i); assert.equal(downloads,0);
    await clickButton(page,'Undo'); await clickButton(page,'Clear main image'); await clickButton(page,'Download PNG'); assert.match(await page.$eval('.poster-error',n=>n.textContent),/main screenshot is required/i); assert.equal(downloads,0); await clickButton(page,'Undo');
    await fill(page,field('main X'),1590); await clickButton(page,'Download PNG'); assert.ok(await page.$('[role=alertdialog]')); await clickButton(page,'Return to adjust'); assert.equal(await page.$('[role=alertdialog]'),null); assert.equal(downloads,0);
    await clickButton(page,'Download PNG'); await fill(page,field('main X'),1500); await page.waitForSelector('[role=alertdialog]',{hidden:true,timeout:2000}); assert.equal(await page.$('[role=alertdialog]'),null,'edit invalidates confirmation'); await clickButton(page,'Download PNG');
    const result=await downloadPng(page,evidence,'confirmed-crop.png',()=>clickButton(page,'Export current crop')); assert.equal((await sharp(result.path).metadata()).width,1600); await cdp.detach();
  } finally { await browser.close(); }
});

for(const width of [360,390,430]) test(`mobile ${width}px supports complete flow without horizontal overflow`,{timeout:90000},async()=>{
  const browser=await launchBrowser(); let stop;
  try{
    const page=await open(browser,width); if(width===390)stop=await startRecording(page,'mobile-main-flow'); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`initial overflow at ${width}`);
    await clickButton(page,'Edit poster'); await upload(page,'main','phone.png'); await upload(page,'detail','square.png'); await fill(page,field('Brand'),'Mobile launch'); await clickButton(page,'Main browser'); await fill(page,field('main X'),1020); await fill(page,field('main Scale'),.9); await clickButton(page,'Close controls');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`edited overflow at ${width}`); assert.equal(await page.$eval('[data-poster-text="brand"]',n=>n.textContent),'Mobile launch');
    const result=await downloadPng(page,evidence,`mobile-${width}.png`,()=>clickButton(page,'Download PNG')); const metadata=await sharp(result.path).metadata(); assert.equal(metadata.width,1600); assert.equal(metadata.height,1200); await page.screenshot({path:path.join(evidence,`mobile-${width}-preview.png`),fullPage:true});
  }finally{if(stop)await stop();await browser.close();}
});

test('real file decoder rejects corrupt, unsupported, oversized and excessive-pixel images; JPEG, WebP and Unicode export work',{timeout:120000},async()=>{
  const generated=path.join(evidence,'generated-fixtures');await fs.mkdir(generated,{recursive:true});
  await fs.writeFile(path.join(generated,'over-20mb.png'),Buffer.alloc(20*1024*1024+1));
  await sharp({create:{width:5000,height:5000,channels:3,background:'#fedc50'}}).png().toFile(path.join(generated,'over-24mp.png'));
  for(const format of ['jpeg','webp'])await sharp(path.join(fixtures,'landscape.png'))[format]().toFile(path.join(generated,`valid.${format}`));
  const browser=await launchBrowser();
  try{
    const page=await open(browser), original=await source(page,'main');
    for(const [file,message]of [[path.join(fixtures,'corrupt.png'),'decoded'],[path.resolve(fixtures,'../../../public/poster/examples/bloomboard.svg'),'PNG, JPEG or WebP'],[path.join(generated,'over-20mb.png'),'20 MB'],[path.join(generated,'over-24mp.png'),'24 megapixels']]){
      await(await page.$(field('Replace main'))).uploadFile(file);
      await page.waitForFunction(message=>[...document.querySelectorAll('[data-poster-editor] .poster-controls [role=alert]')].some(n=>n.textContent.includes(message)),{},message);
      assert.equal(await source(page,'main'),original,`failed ${path.basename(file)} retains the current image`);
    }
    for(const format of ['jpeg','webp']){
      const previous=await source(page,'main');await(await page.$(field('Replace main'))).uploadFile(path.join(generated,`valid.${format}`));
      await page.waitForFunction(previous=>{const n=document.querySelector('[data-poster-role="main"] img');return n?.src!==previous&&n?.complete&&n.naturalWidth>0;},{},previous);
      assert.equal(await page.$eval('[data-poster-role="main"] img',n=>n.naturalWidth/n.naturalHeight),1.6);
    }
    await fill(page,field('Brand'),'中文 🚀');
    const downloaded=await downloadPng(page,evidence,'unicode-webp.png',()=>clickButton(page,'Download PNG'));assert.equal((await sharp(downloaded.path).metadata()).width,1600);
    assert.equal(await page.$eval('[data-poster-text="brand"]',n=>n.textContent),'中文 🚀');
    await page.screenshot({path:path.join(evidence,'unicode-webp-preview.png')});
  }finally{await browser.close();}
});

test('optional text and detail can be hidden, and resetting placement is one undoable action',{timeout:60000},async()=>{
  const browser=await launchBrowser();
  try{
    const page=await open(browser);
    for(const label of ['Badge','Eyebrow','CTA label'])await fill(page,field(label),'');
    assert.equal(await page.$('.poster-badge'),null);assert.equal(await page.$('.poster-cta'),null);
    await page.$eval('.poster-upload-slot input[type=checkbox]',n=>n.click());assert.equal(await page.$('[data-poster-role="detail"]'),null);
    await clickButton(page,'Undo');assert.ok(await page.$('[data-poster-role="detail"]'));
    await fill(page,field('main X'),1010);const changed=await position(page,'main');await clickButton(page,'Reset position');assert.equal((await position(page,'main')).x,1040);await clickButton(page,'Undo');assert.deepEqual(await position(page,'main'),changed);
    const downloaded=await downloadPng(page,evidence,'optional-fields.png',()=>clickButton(page,'Download PNG'));assert.equal((await sharp(downloaded.path).metadata()).height,1200);
  }finally{await browser.close();}
});

test('export cannot race a real image decode during replacement',{timeout:60000},async()=>{
  const browser=await launchBrowser();
  try{
    const page=await open(browser), original=await source(page,'main');
    // Decode real pixels first, then delay settlement to exercise the asynchronous resource gate.
    await page.evaluate(()=>{const decode=HTMLImageElement.prototype.decode;window.__restoreDecode=()=>{HTMLImageElement.prototype.decode=decode;};HTMLImageElement.prototype.decode=async function(){await decode.call(this);if(this.src.startsWith('blob:'))await new Promise(resolve=>{window.__releaseAssetDecode=resolve;});};});
    await(await page.$(field('Replace main'))).uploadFile(path.join(fixtures,'square.png'));
    await page.waitForFunction(()=>typeof window.__releaseAssetDecode==='function');
    assert.equal(await source(page,'main'),original,'current image stays visible until replacement is decoded');
    assert.equal(await page.$$eval(`${scope} .poster-toolbar button`,nodes=>nodes.find(n=>n.textContent==='Loading image…')?.disabled),true,'download waits for pending replacement');
    await page.evaluate(()=>{window.__restoreDecode();window.__releaseAssetDecode();});
    await page.waitForFunction(original=>{const n=document.querySelector('[data-poster-role="main"] img');return n?.src!==original&&n?.complete&&n.naturalWidth>0;},{},original);
    assert.equal(await page.$eval('[data-poster-role="main"] img',n=>n.naturalWidth/n.naturalHeight),1);
  }finally{await browser.close();}
});

test('export releases an existing captured gesture and freezes its position until PNG download',{timeout:60000},async()=>{
  const browser=await launchBrowser();
  try{
    const page=await open(browser);
    // Delay settlement after real image decoding, without replacing the artwork or exporter.
    await page.evaluate(()=>{
      const decode=HTMLImageElement.prototype.decode;
      window.__posterDecodeQueue=[];
      window.__restorePosterDecode=()=>{HTMLImageElement.prototype.decode=decode;};
      HTMLImageElement.prototype.decode=async function(){await decode.call(this);await new Promise(resolve=>window.__posterDecodeQueue.push(resolve));};
    });
    const point=await page.$eval('[data-poster-role="main"]',n=>{const r=n.getBoundingClientRect();return{x:r.x+r.width*.6,y:r.y+r.height*.4};});
    await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+5,point.y+5);
    const frozen=await position(page,'main');
    assert.equal(await page.$eval('[data-poster-role="main"]',n=>n.hasPointerCapture(1)),true,'drag owns pointer capture before export');
    const result=await downloadPng(page,evidence,'captured-gesture-export.png',async()=>{
      // A second touch can activate Download while the first pointer is still held.
      await clickButton(page,'Download PNG');
      await page.waitForFunction(()=>[...document.querySelectorAll('[data-poster-editor] button')].some(n=>n.textContent==='Preparing PNG…')&&window.__posterDecodeQueue.length>0);
      assert.equal(await page.$eval('[data-poster-role="main"]',n=>n.hasPointerCapture(1)),false,'export releases the existing capture');
      await page.mouse.move(point.x+50,point.y+5);
      assert.deepEqual(await position(page,'main'),frozen,'held pointer cannot change the export snapshot');
      await page.mouse.up();
      await page.evaluate(()=>{window.__restorePosterDecode();for(const resolve of window.__posterDecodeQueue.splice(0))resolve();});
    });
    const metadata=await sharp(result.path).metadata();assert.equal(metadata.width,1600);assert.equal(metadata.height,1200);
    assert.deepEqual(await position(page,'main'),frozen,'gesture completion cannot alter the downloaded composition');
  }finally{await browser.close();}
});

test('uploaded image exports under the unchanged production Content-Security-Policy',{timeout:60000},async()=>{
  const browser=await launchBrowser();
  try{
    const page=await browser.newPage();
    const response=await page.goto(url,{waitUntil:'networkidle0'});
    const policy=response.headers()['content-security-policy'];
    assert.ok(policy,'browser runner must serve the production CSP');
    const productionHeaders=await fs.readFile(new URL('../public/_headers',import.meta.url),'utf8');
    assert.equal(policy,productionHeaders.match(/^\s+Content-Security-Policy:\s*(.+)$/m)?.[1].trim());
    const connect=policy.split(';').find(value=>value.trim().startsWith('connect-src'));
    assert.ok(connect&&!connect.includes('blob:'),'production connect-src still blocks fetching blob URLs');
    await page.close();
    const editor=await open(browser);
    const violations=[];
    await editor.evaluate(()=>{window.__posterCspViolations=[];document.addEventListener('securitypolicyviolation',event=>window.__posterCspViolations.push({directive:event.effectiveDirective,blocked:event.blockedURI}));});
    await upload(editor,'main','square.png');
    assert.match(await source(editor,'main'),/^blob:/,'replacement uses the real decoded local file');
    const result=await downloadPng(editor,path.join(evidence,'csp'),'uploaded-production-csp.png',()=>clickButton(editor,'Download PNG'));
    const metadata=await sharp(result.path).metadata();assert.equal(metadata.width,1600);assert.equal(metadata.height,1200);
    const pixels=await sharp(result.path).resize(80,60).removeAlpha().raw().toBuffer();
    let nonPaper=0;for(let index=0;index<pixels.length;index+=3)if(pixels[index]<200||pixels[index+1]<200)nonPaper++;
    assert.ok(nonPaper>100,'download must contain the actual template and image, not only a paper background');
    violations.push(...await editor.evaluate(()=>window.__posterCspViolations.filter(event=>event.directive==='connect-src'&&event.blocked.startsWith('blob:'))));
    assert.deepEqual(violations,[],'export must embed uploaded bytes without a forbidden blob fetch');
  }finally{await browser.close();}
});
