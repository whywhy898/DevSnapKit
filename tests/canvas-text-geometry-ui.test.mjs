import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { launchBrowser, preparePage, clickButton, downloadPng, revealInspectorControl } from './helpers/browser.mjs';
const url = process.env.TEST_UI_URL;
const output = path.resolve('../../output/devsnapkit/canvas-text-v1/geometry');
const snapshot = page => page.evaluate(() => window.__mockupBaseline.snapshot);
const paint = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function withPage(fn) { const browser = await launchBrowser(); try { const page = await preparePage(browser, url); await fn(page); } finally { await browser.close(); } }
async function field(page, name, value) { const selector = `[data-canvas-text-controls] [aria-label="${name}"]`; await revealInspectorControl(page, selector); const el = await page.$(selector); assert.ok(el, `${name} exists`); await el.focus(); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.keyboard.type(value); await page.keyboard.press('Enter'); }
async function undo(page) { await page.focus('[aria-label="Move text"]'); await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await paint(page); }
async function fixture(page, recovery = false) {
  await clickButton(page, 'Add text'); await clickButton(page, 'Done');
  await page.evaluate(recovery => { const s = window.__mockupBaseline.snapshot, l = s.textDocument.layers[0]; window.__mockupBaseline.apply({ aspectRatioId: 'custom', customCanvasSize: { width: 1600, height: 1200 }, textDocument: { version: 1, layers: [{ ...l, content: recovery ? 'MMMMMMMMMMMM\nMMMMMMMMMMMM\nMMMMMMMMMMMM' : 'A title that reflows when its width changes', centerX: .5, centerY: recovery ? .2 : .5, widthRatio: recovery ? .6875 : .3, fontSize: recovery ? 80 : 48 }] } }); }, recovery);
  await page.waitForFunction(() => document.querySelector('#studio-canvas').offsetWidth === 1600); await page.evaluate(() => document.fonts.ready); await paint(page);
  await page.select('[aria-label="Current text"]', (await snapshot(page)).textDocument.layers[0].id);
}
test('T4 real 50% handle drag converts 40 screen px to 80 logical and 100 updates undo once', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page);
  // Fix only viewport available space: the real stage computes the resulting preview scale.
  await page.$eval('.studio-canvas-viewport [data-canvas-stage]', el => { el.style.setProperty('flex', 'none', 'important'); el.style.setProperty('width', '832px', 'important'); el.style.setProperty('height', '632px', 'important'); el.style.setProperty('min-width', '832px', 'important'); el.style.setProperty('min-height', '632px', 'important'); el.style.setProperty('max-width', '832px', 'important'); el.style.setProperty('max-height', '632px', 'important'); }); await paint(page);
  await page.waitForFunction(() => Math.abs(document.querySelector('[data-text-logical-overlay]').getBoundingClientRect().width / 1600 - .5) < .001);
  const before = await snapshot(page), handle = await page.$('[aria-label="Move text"]'), box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  for (let i = 1; i <= 100; i++) await page.mouse.move(box.x + box.width / 2 + .4 * i, box.y + box.height / 2);
  await page.mouse.up(); await paint(page);
  assert.ok(Math.abs((await snapshot(page)).textDocument.layers[0].centerX * 1600 - 880) < .1);
  await undo(page); assert.deepEqual((await snapshot(page)).textDocument, before.textDocument);
}));
test('T4 actual left and right width handles reflow at 50% and retain the opposite edge without scaling the font', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page);await page.$eval('.studio-canvas-viewport [data-canvas-stage]',el=>{for(const [key,value]of Object.entries({flex:'none',width:'832px',height:'632px','min-width':'832px','min-height':'632px','max-width':'832px','max-height':'632px'}))el.style.setProperty(key,value,'important');});await page.waitForFunction(()=>Math.abs(document.querySelector('[data-text-logical-overlay]').getBoundingClientRect().width/1600-.5)<.001);
  const before=(await snapshot(page)).textDocument;
  for(const edge of ['right','left']){const h=await page.$(`[aria-label="Text ${edge} width handle"]`),box=await h.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+(edge==='right'?40:-40),box.y+box.height/2);await page.mouse.up();await paint(page);const layer=(await snapshot(page)).textDocument.layers[0];assert.ok(Math.abs(layer.widthRatio*1600-560)<.1);assert.equal(layer.fontSize,before.layers[0].fontSize);assert.ok(Math.abs(layer.centerX*1600-(edge==='right'?840:760))<.1);await undo(page);assert.deepEqual((await snapshot(page)).textDocument,before);}
}));
test('T4 width reflows without font scaling, numeric invalid drafts stay local, keyboard repeat groups', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page); const before = (await snapshot(page)).textDocument.layers[0];
  const originalHeight = await page.$eval('[data-canvas-text]', el => el.offsetHeight);
  await field(page, 'Text width', '240'); await paint(page);
  const layer = (await snapshot(page)).textDocument.layers[0]; assert.equal(layer.fontSize, before.fontSize); assert.equal(layer.widthRatio * 1600, 240);
  assert.ok(await page.$eval('[data-canvas-text]', el => el.offsetHeight) > originalHeight);
  await field(page, 'Text x', 'Infinity'); assert.equal((await snapshot(page)).textDocument.layers[0].centerX, .5);
  assert.equal(await page.$eval('[aria-label="Text x"]', el => el.value), 'Infinity'); assert.equal(await page.$eval('[aria-label="Text x"]', el => el.getAttribute('aria-invalid')), 'true');
  await clickButton(page, 'Cancel'); await page.focus('[aria-label="Move text"]');
  for (let i = 0; i < 10; i++) await page.keyboard.down('ArrowRight'); await page.keyboard.up('ArrowRight');
  assert.ok(Math.abs((await snapshot(page)).textDocument.layers[0].centerX * 1600 - 810) < .01);
  await undo(page); assert.equal((await snapshot(page)).textDocument.layers[0].centerX, .5);
}));
test('T4 pointercancel and lost capture roll back; no-op drag keeps Redo', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page); const before = (await snapshot(page)).textDocument;
  for (const event of ['pointercancel', 'lostpointercapture']) {
    const handle = await page.$('[aria-label="Move text"]'), box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2);
    await handle.evaluate((el, event) => el.dispatchEvent(new PointerEvent(event, { bubbles: true, pointerId: 1 })), event); await page.mouse.up(); await paint(page);
    assert.deepEqual((await snapshot(page)).textDocument, before);
  }
  await field(page, 'Text x', '810'); await undo(page);
  assert.equal(await page.evaluate(() => window.__mockupBaseline.history.canRedo), true);
  const handle = await page.$('[aria-label="Move text"]'); await handle.click(); await paint(page);
  assert.equal(await page.evaluate(() => window.__mockupBaseline.history.canRedo), true);
  assert.equal(await page.evaluate(() => window.__mockupBaseline.history.inTransaction), false);
}));
test('T4 invalid size chain retains valid anchor, new restore preserves text, Undo returns final invalid size', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page, true); assert.equal(await page.$('[data-text-layout-errors]'), null);
  assert.equal(await page.$eval('[data-canvas-text]',el=>el.offsetHeight/(parseFloat(getComputedStyle(el).fontSize)*1.25)),3,'A is the approved actual three-line layout');
  await clickButton(page, '1:1'); await paint(page);
  await page.waitForSelector('[data-text-layout-errors]');
  assert.match(await page.$eval('[data-text-size-recovery]', el => el.textContent), /Undo size change.*1600×1200/);
  await page.click('[data-text-size-recovery]'); await paint(page); assert.equal((await snapshot(page)).aspectRatioId, 'custom');
  await clickButton(page, '1:1'); await paint(page);
  await clickButton(page, 'Twitter'); await paint(page);
  assert.match(await page.$eval('[data-text-size-recovery]', el => el.textContent), /Restore to 1600×1200/);
  await field(page, 'Text color', '#123456');
  assert.equal((await snapshot(page)).textDocument.layers[0].color, '#123456');
  await page.click('[data-text-size-recovery]'); await paint(page);
  assert.equal((await snapshot(page)).textDocument.layers[0].color, '#123456');
  assert.equal((await snapshot(page)).customCanvasSize.width, 1600);
  await undo(page); assert.equal((await snapshot(page)).aspectRatioId, 'og');
  assert.equal(await page.$('[data-text-size-recovery]'), null);
  await fs.mkdir(output, { recursive: true }); await page.screenshot({ path: path.join(output, 'recovery-chain.png'), fullPage: true });
}));
test('T4 recovered A to Twitter uses A; valid intermediate and history clear stale recovery actions', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page, true); const original = (await snapshot(page)).textDocument;
  await clickButton(page, '1:1'); await paint(page); await page.click('[data-text-size-recovery]'); await paint(page);
  await clickButton(page, 'Twitter'); await paint(page);
  assert.match(await page.$eval('[data-text-size-recovery]', el => el.textContent), /1600×1200/);
  await clickButton(page, 'Poster'); await paint(page); await clickButton(page, 'Mockup'); await paint(page);
  assert.match(await page.$eval('[data-text-size-recovery]', el => el.textContent), /1600×1200/);
  // Cancel a geometry draft must not be mistaken for Undo/Redo navigation.
  await field(page, 'Text x', 'Infinity'); await clickButton(page, 'Cancel');
  assert.match(await page.$eval('[data-text-size-recovery]', el => el.textContent), /1600×1200/);
  await page.click('[data-text-size-recovery]'); await paint(page);
  assert.deepEqual((await snapshot(page)).textDocument, original);
  await clickButton(page, '16:9'); await paint(page); assert.equal(await page.$('[data-text-layout-errors]'), null);
  await clickButton(page, 'Twitter'); await paint(page);
  assert.match(await page.$eval('[data-text-size-recovery]', el => el.textContent), /1920×1080/);
  await undo(page); assert.equal(await page.$('[data-text-size-recovery]'), null);
  await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control'); await paint(page);
  assert.ok(await page.$('[data-text-layout-errors]')); assert.equal(await page.$('[data-text-size-recovery]'), null);
}));
test('T4 initial invalid has no recovery promise and text editing remains accessible through overlap selector', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await page.evaluate(() => { const layer = { id:'initial-invalid', content:'Outside', centerX:.5, centerY:0, widthRatio:.6, font:'manrope', fontSize:100, weight:700, italic:false, color:'#123456', align:'center' }; window.__mockupBaseline.apply({textDocument:{version:1,layers:[layer,{...layer,id:'overlap'}]}}); }); await paint(page);
  assert.ok(await page.$('[data-text-layout-errors]')); assert.equal(await page.$('[data-text-size-recovery]'), null);
  await clickButton(page, 'Text');
  await page.select('[aria-label="Current text"]', 'initial-invalid'); await clickButton(page,'Edit text');
  assert.equal(await page.$eval('[aria-label="Text content"]', el => el.value), 'Outside'); await clickButton(page,'Done');
  await page.select('[aria-label="Current text"]', 'overlap'); await field(page,'Text y','400');
  assert.equal((await snapshot(page)).textDocument.layers[0].centerY,0);
}));
test('T4 Auto upload recovery names image action and later edits use exact Custom dimensions', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fs.mkdir(output,{recursive:true});
  const tall=path.join(output,'auto-original.png'), wide=path.join(output,'auto-wide.png');
  await sharp({create:{width:1600,height:1200,channels:3,background:'#123456'}}).png().toFile(tall);
  await sharp({create:{width:1600,height:300,channels:3,background:'#654321'}}).png().toFile(wide);
  const upload = async file => { await page.$eval('[aria-label="Main screenshot file"]',el=>el.value=''); await (await page.$('[aria-label="Main screenshot file"]')).uploadFile(file); await page.waitForFunction(name=>window.__mockupBaseline.snapshot.imageName===name,{},path.basename(file)); await new Promise(r=>setTimeout(r,180)); await paint(page); };
  await upload(tall); await clickButton(page,'Auto'); await clickButton(page,'Add text');
  await page.$eval('[aria-label="Text content"]', el => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'First line\nSecond line\nThird line'); el.dispatchEvent(new Event('input',{bubbles:true})); }); await clickButton(page,'Done');
  const original=await page.$eval('#studio-canvas', el=>({width:el.offsetWidth,height:el.offsetHeight}));
  assert.equal(await page.$('[data-text-layout-errors]'),null);
  await upload(wide); await page.waitForSelector('[data-text-size-recovery]');
  assert.match(await page.$eval('[data-text-size-recovery]',el=>el.textContent),new RegExp(`Undo image change.*${original.width}×${original.height}`));
  await page.click('[data-text-size-recovery]'); await paint(page); await page.waitForFunction(()=>window.__mockupBaseline.snapshot.imageName==='auto-original.png');
  assert.equal(await page.$('[data-text-layout-errors]'),null);
  await upload(wide); await field(page,'Text color','#123456');
  assert.match(await page.$eval('[data-text-size-recovery]',el=>el.textContent),/\(Custom\)/);
  await page.click('[data-text-size-recovery]'); await paint(page);
  const restored=await snapshot(page); assert.equal(restored.imageName,'auto-wide.png');assert.equal(restored.aspectRatioId,'custom'); assert.deepEqual(restored.customCanvasSize,original); assert.equal(restored.textDocument.layers[0].color,'#123456');
  await undo(page); assert.equal((await snapshot(page)).aspectRatioId,'auto');assert.equal((await snapshot(page)).imageName,'auto-wide.png');
}));
test('T4 Auto starter preset recovery accurately names the preset action and retains text ids', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await (await page.$('[aria-label="Main screenshot file"]')).uploadFile(path.resolve('../../output/devsnapkit/honeywerank-original.png'));await page.waitForFunction(()=>window.__mockupBaseline.snapshot.imageName==='honeywerank-original.png');await new Promise(r=>setTimeout(r,200));
  await clickButton(page,'Add text');await clickButton(page,'Done');await page.evaluate(()=>{const layer=window.__mockupBaseline.snapshot.textDocument.layers[0];window.__mockupBaseline.apply({textDocument:{version:1,layers:[{...layer,content:'A\nB\nC',fontSize:100,centerY:.22,widthRatio:.6}]}});});await page.evaluate(()=>document.fonts.ready);await paint(page);assert.equal(await page.$('[data-text-layout-errors]'),null);
  const before=await snapshot(page),size=await page.$eval('#studio-canvas',el=>({width:el.offsetWidth,height:el.offsetHeight}));await page.click('button[title="Select starter demo template"]');await clickButton(page,'Code Terminal Dev');await page.waitForSelector('[data-text-size-recovery]');
  assert.match(await page.$eval('[data-text-size-recovery]',el=>el.textContent),new RegExp(`Undo preset change.*${size.width}×${size.height}`));await page.click('[data-text-size-recovery]');await paint(page);await paint(page);assert.equal((await snapshot(page)).imageName,before.imageName);assert.deepEqual((await snapshot(page)).textDocument,before.textDocument);assert.equal(await page.$('[data-text-layout-errors]'),null);
}));
test('T4 movement cannot run with other tools; Escape, scroll, mode and export end transactions', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page); const initial=(await snapshot(page)).textDocument;
  const start = async () => { const h=await page.$('[aria-label="Move text"]'),b=await h.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+15,b.y+b.height/2);return h; };
  await start();await page.keyboard.press('Escape');await page.mouse.up();await paint(page);assert.deepEqual((await snapshot(page)).textDocument,initial);
  await start();await page.evaluate(()=>window.dispatchEvent(new Event('scroll')));await page.mouse.up();await paint(page);assert.deepEqual((await snapshot(page)).textDocument,initial);
  await start(); await clickButton(page,'Poster');await page.mouse.up();await paint(page);assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),false);
  await clickButton(page,'Mockup');await paint(page); await start(); await clickButton(page,'Export');await page.mouse.up();await paint(page);assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),false);
}));
test('T4 camera, background, frame, duo, presets and reset retain independent text above artwork', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page); const initial=(await snapshot(page)).textDocument;
  await clickButton(page, 'Frame');
  for (const [label,value] of [['Mockup zoom','250'],['Mockup position X','20']]) {
    const el=await page.$(`[aria-label="${label}"]`);await el.focus();await page.keyboard.down('Control');await page.keyboard.press('a');await page.keyboard.up('Control');await page.keyboard.type(value);await page.keyboard.press('Tab');
    assert.deepEqual((await snapshot(page)).textDocument,initial);
  }
  await page.focus('[aria-label="Move text"]');await page.keyboard.press('2');await paint(page);assert.equal((await snapshot(page)).layoutMode,'duo');assert.deepEqual((await snapshot(page)).textDocument,initial);
  await clickButton(page,'Frame');await clickButton(page,'Safari Browser');await paint(page);assert.deepEqual((await snapshot(page)).textDocument,initial);
  await clickButton(page,'Canvas');await clickButton(page,'Solid');await paint(page);
  await clickButton(page,'Floating Tilt');await paint(page);assert.equal((await snapshot(page)).layoutPreset,'float');
  assert.deepEqual((await snapshot(page)).textDocument,initial);
  assert.ok(await page.$eval('[data-canvas-text-layer]',el=>Number(getComputedStyle(el).zIndex)>=40));
  await page.$eval('button[title="Reset default styling; canvas text is preserved"]',el=>el.click());await paint(page);assert.deepEqual((await snapshot(page)).textDocument,initial);
  assert.match(await page.$eval('[data-reset-preserves-text]',el=>el.textContent),/text is preserved/);
}));
test('T4 delayed actual Auto measurement retains upload commit identity after a later style edit', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fs.mkdir(output,{recursive:true});const tall=path.join(output,'delayed-original.png'),wide=path.join(output,'delayed-wide.png');
  await sharp({create:{width:1600,height:1200,channels:3,background:'#123456'}}).png().toFile(tall);
  await sharp({create:{width:1600,height:300,channels:3,background:'#654321'}}).png().toFile(wide);
  await (await page.$('[aria-label="Main screenshot file"]')).uploadFile(tall);await page.waitForFunction(()=>window.__mockupBaseline.snapshot.imageName==='delayed-original.png');await new Promise(r=>setTimeout(r,200));await paint(page);
  await clickButton(page,'Add text');await page.$eval('[aria-label="Text content"]',el=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'First line\nSecond line\nThird line');el.dispatchEvent(new Event('input',{bubbles:true}));});await clickButton(page,'Done');
  const before=await page.$eval('#studio-canvas',el=>({width:el.offsetWidth,height:el.offsetHeight}));
  // Test-only delivery gate holds the REAL renderer's measured natural size,
  // leaving image upload, decode, DOM layout and all editing handlers intact.
  await page.evaluate(()=>window.__mockupBaseline.holdNaturalSize(true));
  await (await page.$('[aria-label="Main screenshot file"]')).uploadFile(wide);await page.waitForFunction(()=>window.__mockupBaseline.snapshot.imageName==='delayed-wide.png');await new Promise(r=>setTimeout(r,500));
  const uploadCommit=await page.evaluate(()=>window.__mockupBaseline.history.commitId);
  await field(page,'Text color','#123456');const styleCommit=await page.evaluate(()=>window.__mockupBaseline.history.commitId);assert.notEqual(styleCommit,uploadCommit);
  await page.evaluate(()=>window.__mockupBaseline.holdNaturalSize(false));await page.waitForSelector('[data-text-size-recovery]');
  const label=await page.$eval('[data-text-size-recovery]',el=>el.textContent);assert.match(label,/^Restore to.*\(Custom\)/);assert.doesNotMatch(label,/Undo/);
  await page.click('[data-text-size-recovery]');await paint(page);const after=await snapshot(page);assert.equal(after.textDocument.layers[0].color,'#123456');assert.equal(after.imageName,'delayed-wide.png');assert.deepEqual(after.customCanvasSize,before);
  await fs.writeFile(path.join(output,'delayed-auto-origin.json'),JSON.stringify({before,uploadCommit,styleCommit,label,after:{size:after.customCanvasSize,color:after.textDocument.layers[0].color,image:after.imageName},measurement:'Real FittedScene callback delivery held in test-only source transform'},null,2));
}));
test('T4 one padding range gesture with 100 input updates creates one commit and restores valid baseline dimensions', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await clickButton(page,'Add text');await clickButton(page,'Done');await new Promise(r=>setTimeout(r,450));
  await clickButton(page, 'Frame');
  const before=await snapshot(page), initialHistory=await page.evaluate(()=>window.__mockupBaseline.history.count);
  const slider=await page.$('[aria-label="Canvas padding slider"]');await slider.evaluate(el=>el.scrollIntoView({block:'center'}));const box=await slider.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height/2);await page.mouse.down();
  // Exercise the actual native range control and React onChange 100 times while
  // its real pointer gesture stays active; do not inject document snapshots.
  await slider.evaluate(async el=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(let i=0;i<100;i++){setter.call(el,String(100+i%25*4));el.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(requestAnimationFrame);}});
  await page.mouse.up();await paint(page);assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.count),initialHistory+1);assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),false);
  await undo(page);assert.equal((await snapshot(page)).padding,before.padding);assert.equal((await snapshot(page)).aspectRatioId,before.aspectRatioId);
}));
test('T4 invalid padding gesture recovery names and restores its full valid transaction baseline', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await clickButton(page,'Add text');await clickButton(page,'Done');
  await clickButton(page, 'Frame');
  await page.evaluate(()=>{const layer=window.__mockupBaseline.snapshot.textDocument.layers[0];window.__mockupBaseline.apply({padding:200,textDocument:{version:1,layers:[{...layer,content:'A\nB\nC',fontSize:160,centerY:.35,widthRatio:.6}]}});});await page.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,200));await paint(page);
  const before=await page.$eval('#studio-canvas',el=>({width:el.offsetWidth,height:el.offsetHeight}));assert.equal(await page.$('[data-text-layout-errors]'),null);await new Promise(r=>setTimeout(r,450));const count=await page.evaluate(()=>window.__mockupBaseline.history.count);
  const slider=await page.$('[aria-label="Canvas padding slider"]');await slider.evaluate(el=>el.scrollIntoView({block:'center'}));const box=await slider.boundingBox();await page.mouse.move(box.x+box.width*.98,box.y+box.height/2);await page.mouse.down();
  await slider.evaluate(async el=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(let i=0;i<100;i++){set.call(el,String(Math.max(0,196-i*2)));el.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(requestAnimationFrame);}});await page.mouse.up();await paint(page);
  assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.count),count+1);
  assert.match(await page.$eval('[data-text-size-recovery]',el=>el.textContent),new RegExp(`Undo size change.*${before.width}×${before.height}`));
  await page.click('[data-text-size-recovery]');await paint(page);await paint(page);assert.equal((await snapshot(page)).padding,200);assert.deepEqual(await page.$eval('#studio-canvas',el=>({width:el.offsetWidth,height:el.offsetHeight})),before);assert.equal(await page.$('[data-text-layout-errors]'),null);
}));
test('T4 numeric composition keeps native Enter and arrows local until composition ends', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page);const before=(await snapshot(page)).textDocument;
  await page.focus('[aria-label="Text width"]');await page.$eval('[aria-label="Text width"]',el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'320');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));});
  assert.deepEqual((await snapshot(page)).textDocument,before);assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),true);
  await page.keyboard.press('ArrowLeft');assert.deepEqual((await snapshot(page)).textDocument,before);
  await page.$eval('[aria-label="Text width"]',el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));await page.keyboard.press('Enter');assert.equal((await snapshot(page)).textDocument.layers[0].widthRatio*1600,320);
}));
test('T4 physically clicked padding number keeps one focus transaction through typing and blur', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await clickButton(page,'Add text');await clickButton(page,'Done');await new Promise(r=>setTimeout(r,450));const before=await snapshot(page),count=await page.evaluate(()=>window.__mockupBaseline.history.count);
  await clickButton(page, 'Frame');
  await page.click('[aria-label="Canvas padding"]');assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),true,'Initial pointer release must not end number focus session');
  await page.keyboard.down('Control');await page.keyboard.press('a');await page.keyboard.up('Control');await page.keyboard.type('160');assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),true);
  await page.keyboard.press('Tab');await paint(page);assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.count),count+1);assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),false);await undo(page);assert.equal((await snapshot(page)).padding,before.padding);
}));
test('T4 an old pointer release cannot finish a newer style session', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page);const handle=await page.$('[aria-label="Move text"]'),box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2);
  const input=await page.$('[data-canvas-text-controls] [aria-label="Text size"]');await input.focus();await page.keyboard.down('Control');await page.keyboard.press('a');await page.keyboard.up('Control');await page.keyboard.type('64');await page.mouse.up();await paint(page);
  assert.equal(await page.evaluate(()=>window.__mockupBaseline.history.inTransaction),true,'New style session still owns its transaction');await clickButton(page,'Cancel');assert.equal((await snapshot(page)).textDocument.layers[0].fontSize,48);assert.notEqual((await snapshot(page)).textDocument.layers[0].centerX,.5,'Completed movement remains committed');
}));
test('T4 old pointer completion cannot split a replacement keyboard gesture or cancel another pointer id', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page);const initial=(await snapshot(page)).textDocument;const handle=await page.$('[aria-label="Move text"]'),box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2);await paint(page);
  const moved=(await snapshot(page)).textDocument;
  await handle.evaluate(el=>el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:999})));assert.deepEqual((await snapshot(page)).textDocument,moved,'Another pointer cancellation cannot cancel this drag');
  for(let i=0;i<5;i++)await page.keyboard.down('ArrowRight');
  await page.mouse.up();for(let i=0;i<5;i++)await page.keyboard.down('ArrowRight');await page.keyboard.up('ArrowRight');await paint(page);
  const final=(await snapshot(page)).textDocument;assert.ok(Math.abs((final.layers[0].centerX-moved.layers[0].centerX)*1600-10)<.01);
  await undo(page);assert.deepEqual((await snapshot(page)).textDocument,moved,'All ten keyboard repeats undo once');await undo(page);assert.deepEqual((await snapshot(page)).textDocument,initial,'Previous pointer movement is a separate prior step');
}));
test('T4 selected move handle remains above overlapping hit targets', { skip: !url, timeout: 60000 }, () => withPage(async page => {
  await fixture(page);await page.evaluate(()=>{const layer=window.__mockupBaseline.snapshot.textDocument.layers[0];window.__mockupBaseline.apply({textDocument:{version:1,layers:[layer,{...layer,id:'above-hit',content:'Overlap\nOverlap\nOverlap\nOverlap'}]}});});await paint(page);
  const first=(await snapshot(page)).textDocument.layers[0];await page.select('[aria-label="Current text"]',first.id);const h=await page.$('[aria-label="Move text"]'),b=await h.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+20,b.y+b.height/2);await page.mouse.up();await paint(page);
  assert.equal(await page.$('[aria-label="Text content"]'),null);assert.notEqual((await snapshot(page)).textDocument.layers[0].centerX,first.centerX);assert.equal((await snapshot(page)).textDocument.layers[1].centerX,first.centerX);
}));
test('T4 scene geometry families retain preview/export agreement after measured remeasurement optimization', { skip: !url, timeout: 120000 }, () => withPage(async page => {
  await fixture(page);const text=(await snapshot(page)).textDocument, image=(await snapshot(page)).imageSrc;
  await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
  await page.evaluate(()=>{
    window.__exportGeometry=[];
    const read=root=>{const style=root.querySelector('[data-scene-bounds]')?.style;return{width:root.offsetWidth,height:root.offsetHeight,fit:Number(root.querySelector('[data-scene-fit]')?.dataset.sceneFit),bounds:Object.fromEntries(['left','top','width','height'].map(key=>[key,parseFloat(style?.[key]??'NaN')]))};};
    window.__geometryRead=read;
    new MutationObserver(()=>{const root=document.querySelector('[aria-hidden="true"] [data-canvas-root]');if(root&&root.offsetWidth)window.__exportGeometry.push(read(root));}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','data-scene-fit']});
  });
  const rows=[];
  for(const [id,patch] of [['browser',{windowTheme:'browser',windowTitle:'Geometry browser',imageName:'Geometry image.png'}],['phone',{windowTheme:'iphone-17'}],['duo',{layoutMode:'duo',secondarySrc:image,secondaryName:'Geometry second.png',duoLayout:'side'}],['duo-stack',{duoLayout:'stack'}],['projection',{layoutPreset:'dramatic'}],['decoration',{roundedCorners:32,shadowLevel:'3d',shadowOpacity:90,cornerStyle:'stack-2'}],['borderless',{hideMockup:true}]]){
    await page.evaluate(patch=>window.__mockupBaseline.apply(patch),patch);await page.evaluate(()=>document.fonts.ready);await new Promise(r=>setTimeout(r,150));await paint(page);
    const preview=await page.$eval('#studio-canvas',root=>window.__geometryRead(root));await page.evaluate(()=>window.__exportGeometry=[]);
    await clickButton(page,'Export');await clickButton(page,'1x Web');
    const file=await downloadPng(page,output,'scene-'+id+'.png',()=>page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.offsetParent!==null&&/^Download 1x/.test(b.innerText.trim())).click()));
    const exported=await page.evaluate(()=>window.__exportGeometry.at(-1));assert.ok(exported,'Actual offscreen shared export renderer was observed');
    assert.equal(exported.width,preview.width);assert.equal(exported.height,preview.height);assert.ok(Math.abs(exported.fit-preview.fit)<.00001,JSON.stringify({id,preview,exported}));
    // Same 0.05 logical-px comparison used by FittedScene's geometry state;
    // preview and offscreen projected DOM may round by thousandths of a px.
    // The separate 20-case raster baseline still requires exactly zero pixels.
    for(const key of ['left','top','width','height'])assert.ok(Math.abs(exported.bounds[key]-preview.bounds[key])<.05,JSON.stringify({id,key,preview,exported}));
    assert.deepEqual((await snapshot(page)).textDocument,text);rows.push({id,patchKeys:Object.keys(patch),preview,exported,file:file.path});
  }
  await fs.writeFile(path.join(output,'scene-geometry-parity.json'),JSON.stringify(rows,null,2));
}));
