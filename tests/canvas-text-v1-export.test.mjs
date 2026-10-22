import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { launchBrowser, preparePage, clickButton, downloadPng } from './helpers/browser.mjs';

const url = process.env.TEST_UI_URL;
const output = path.resolve('../../output/devsnapkit/canvas-text-v1/m1');
const raster = ['--disable-gpu', '--force-color-profile=srgb', '--disable-lcd-text', '--disable-skia-runtime-opts', '--font-render-hinting=none'];
async function exportPNG(page, name, scale = 1) {
  await clickButton(page, 'Export'); await clickButton(page, scale === 1 ? '1x Web' : '2x HD');
  return downloadPng(page, output, name, () => page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && /^Download /.test(b.innerText.trim())).click()));
}
test('M1 real upload, plain canvas text, separate Add/edit undo, 1x and 2x PNG under production CSP', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser(raster);
  try {
    const page = await preparePage(browser, url);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
    assert.ok(await page.$('button[aria-label="Add text"]'), 'Ordinary mockup editor offers Add text');
    await (await page.$('input[aria-label="Main screenshot file"]')).uploadFile(path.resolve('../../output/devsnapkit/honeywerank-original.png'));
    await page.waitForFunction(() => window.__mockupBaseline.snapshot.imageName === 'honeywerank-original.png' && document.querySelector('#studio-canvas img')?.naturalWidth > 0);
    await page.evaluate(() => window.__mockupBaseline.apply({ aspectRatioId: 'custom', customCanvasSize: { width: 1600, height: 1200 }, bgType: 'transparent', vfxGlow: false }));
    await page.waitForFunction(() => document.querySelector('#studio-canvas')?.offsetWidth === 1600);
    const before = await exportPNG(page, 'launch-no-text.png');
    await clickButton(page, 'Add text');
    const input = await page.$('[aria-label="Text content"]');
    await input.focus(); await input.press('Home'); await page.keyboard.down('Shift'); await input.press('End'); await page.keyboard.up('Shift'); await input.type('Launch today'); await input.press('Tab');
    await page.waitForFunction(() => document.querySelector('[data-canvas-text]')?.textContent === 'Launch today');
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
    await page.waitForFunction(() => document.querySelector('[data-canvas-text]')?.textContent === 'Text');
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
    await page.waitForFunction(() => !document.querySelector('[data-canvas-text]'));
    await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control');
    await page.waitForFunction(() => document.querySelector('[data-canvas-text]')?.textContent === 'Text');
    await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control');
    await page.waitForFunction(() => document.querySelector('[data-canvas-text]')?.textContent === 'Launch today');
    await fs.mkdir(output, { recursive: true });
    await page.select('[aria-label="Current text"]', '');
    await (await page.$('#studio-canvas')).screenshot({ path: path.join(output, 'launch-preview.png') });
    const rows = [];
    const snapshot = await page.evaluate(() => JSON.stringify(window.__mockupBaseline.snapshot));
    for (const scale of [1, 2]) {
      await page.$eval('[data-text-hit]', button => button.click());
      assert.ok(await page.$('[aria-label="Text content"]'), 'Valid content is still being edited immediately before export');
      const file = await exportPNG(page, `launch-${scale}x.png`, scale);
      const { data, info } = await sharp(file.path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, 1600 * scale); assert.equal(info.height, 1200 * scale);
      assert.equal(data[(20 * scale * info.width + 200 * scale) * 4 + 3], 0, 'PNG retains transparent padding');
      let textInk = 0;
      for (let y = 210 * scale; y < 270 * scale; y++) for (let x = 560 * scale; x < 1040 * scale; x++) { const i = (y * info.width + x) * 4; if (data[i] > 220 && data[i+1] > 220 && data[i+2] > 220 && data[i+3] > 100) textInk++; }
      assert.ok(textInk > 100 * scale, 'Actual downloaded pixels contain the white headline');
      rows.push({ ...file, width: info.width, height: info.height, textInk });
    }
    const blank = await sharp(before.path).ensureAlpha().raw().toBuffer();
    const text = await sharp(rows[0].path).ensureAlpha().raw().toBuffer();
    let changed = 0, outside = 0;
    for (let y = 0; y < 1200; y++) for (let x = 0; x < 1600; x++) {
      const i = (y * 1600 + x) * 4;
      if ([0, 1, 2, 3].some(c => blank[i+c] !== text[i+c])) { changed++; if (x < 560 || x >= 1040 || y < 210 || y >= 270) outside++; }
    }
    assert.ok(changed > 1000, 'Adding the headline changes actual downloaded text pixels');
    assert.equal(outside, 0, 'Adding text preserves every pixel outside its logical box');
    assert.equal(await page.evaluate(() => JSON.stringify(window.__mockupBaseline.snapshot)), snapshot, 'Export preserves the complete editor document');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(output, 'ui-downloads.json'), JSON.stringify({ rows, noTextComparison: { changed, outside }, errors }, null, 2));
  } finally { await browser.close(); }
});

test('font matrix embeds real 600 normal/italic faces and downloaded strokes match own logical preview', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser(raster);
  try {
    const page = await preparePage(browser, url, { viewport: { width: 2800, height: 2100, deviceScaleFactor: 1 } });
    const violations = [];
    await page.exposeFunction('recordCSP', value => violations.push(value));
    await page.evaluate(() => document.addEventListener('securitypolicyviolation', event => window.recordCSP({ uri: event.blockedURI, directive: event.effectiveDirective })));
    const combinations = [400,600,700,800].map(weight => ({ font: 'manrope', weight, italic: false })).concat([false,true].flatMap(italic => [400,600,700].map(weight => ({ font: 'gelasio', weight, italic }))));
    const layers = combinations.map((style, index) => ({ ...style, id: `font-${index}`, content: 'Hamburgefonts 0123', centerX: .5, centerY: .075 + .085 * index, widthRatio: .88, fontSize: 36, color: '#E600A9', align: 'center' }));
    const transparentImage = 'data:image/png;base64,' + (await sharp({ create: { width: 1024, height: 600, channels: 4, background: '#00000000' } }).png().toBuffer()).toString('base64');
    await page.evaluate(({ layers, transparentImage }) => window.__mockupBaseline.apply({ imageSrc: transparentImage, hideMockup: true, shadowLevel: 'none', aspectRatioId: 'custom', customCanvasSize: { width: 1600, height: 1200 }, bgType: 'solid', solidColor: '#FFFFFF', vfxGlow: false, textDocument: { version: 1, layers } }), { layers, transparentImage });
    await page.waitForFunction(() => document.querySelectorAll('#studio-canvas [data-canvas-text]').length === 10 && document.querySelector('#studio-canvas').offsetWidth === 1600);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(image => image.decode())); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await new Promise(resolve => setTimeout(resolve, 400));
    const scale = await page.$eval('#studio-canvas', el => el.getBoundingClientRect().width / el.offsetWidth);
    assert.equal(scale, 1, 'Font reference is the actual unscaled logical preview');
    // Align only the preview SHELL to the physical pixel grid. Fractional flex
    // centering otherwise changes antialiasing despite identical logical glyphs.
    await page.$eval('#studio-canvas', root => { const r = root.getBoundingClientRect(); root.parentElement.style.translate = `${Math.round(r.x)-r.x}px ${Math.round(r.y)-r.y}px`; });
    const preview = path.join(output, 'font-matrix.preview.png'); await (await page.$('#studio-canvas')).screenshot({ path: preview });
    const actual = await exportPNG(page, 'font-matrix.download.png');
    const embedding = await page.evaluate(async () => {
      const { artworkFontCSS } = await import('/src/export/prepareArtworkExport.ts');
      const css = await artworkFontCSS(document.querySelector('#studio-canvas'));
      return [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].map(match => ({ family: match[0].match(/font-family:\s*([^;]+)/)?.[1], weight: match[0].match(/font-weight:\s*([^;]+)/)?.[1], style: match[0].match(/font-style:\s*([^;]+)/)?.[1], embedded: /url\(["']?data:/.test(match[0]), bytes: match[0].length }));
    });
    for (const [family, style, range] of [['Poster Manrope','normal','200 800'], ['Poster Gelasio','normal','400 700'], ['Poster Gelasio','italic','400 700']]) {
      assert.ok(embedding.some(face => face.family?.includes(family) && face.style === style && face.weight === range && face.embedded && face.bytes > 10000), `${family} ${style} includes actual embedded variable face covering 600`);
    }
    const a = await sharp(preview).ensureAlpha().raw().toBuffer();
    const b = await sharp(actual.path).ensureAlpha().raw().toBuffer();
    const stroke = (pixels, i) => pixels[i] > 140 && pixels[i+1] < 90 && pixels[i+2] > 100 && pixels[i+3] > 120;
    const comparisons = layers.map(layer => {
      let previewInk = 0, exportInk = 0, mismatch = 0, unmatched = 0;
      const previewBounds = [Infinity,Infinity,-Infinity,-Infinity], exportBounds = [...previewBounds];
      const top = Math.round(layer.centerY * 1200 - 30);
      for (let y = top; y < top + 60; y++) for (let x = 96; x < 1504; x++) {
        const i = (y*1600+x)*4, p = stroke(a,i), e = stroke(b,i); previewInk += +p; exportInk += +e; mismatch += +(p !== e);
        for (const [ink, bounds] of [[p,previewBounds],[e,exportBounds]]) if (ink) { bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y); }
        if (p !== e) {
          const other = p ? b : a;
          let near = false; for (let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) near ||= stroke(other,((y+dy)*1600+x+dx)*4);
          if (!near) unmatched++;
        }
      }
      assert.ok(exportInk > 1000, `${layer.font} ${layer.weight} italic=${layer.italic} has actual exported strokes`);
      assert.ok(previewBounds.every((v,i)=>Math.abs(v-exportBounds[i])<=1), 'Glyph bounds match own preview within one logical pixel');
      assert.ok(Math.abs(previewInk-exportInk)/exportInk < .06, 'Preview/export stroke density differs by less than 6%');
      assert.ok(unmatched / Math.max(previewInk, exportInk) < .01, 'At least 99% of strokes match within one logical pixel');
      return { ...layer, previewInk, exportInk, mismatch, unmatched, previewBounds, exportBounds };
    });
    for (const indices of [[0,1,2,3],[4,5,6],[7,8,9]]) for (let i=1;i<indices.length;i++) assert.ok(comparisons[indices[i]].exportInk > comparisons[indices[i-1]].exportInk * 1.02, 'Actual heavier face has greater stroke density, including 600');
    assert.deepEqual(violations, [], 'Font embedding and image prep obey production CSP');
    await fs.writeFile(path.join(output, 'font-matrix.json'), JSON.stringify({ embedding, comparisons, violations }, null, 2));
  } finally { await browser.close(); }
});

test('renderer perf probe uses 1/5/10/20 actual boxes for short and 1000-codepoint updates', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser(raster);
  try {
    const page = await preparePage(browser, url);
    const rows = await page.evaluate(async () => {
      const rows = [];
      for (const count of [1,5,10,20]) for (const length of [20,1000]) {
        const layers = Array.from({ length: count }, (_, index) => ({ id: `perf-${index}`, content: 'A'.repeat(length), centerX: .5, centerY: .2, widthRatio: .4, font: 'manrope', fontSize: 48, weight: 700, italic: false, color: '#FFFFFF', align: 'center' }));
        window.__mockupBaseline.apply({ textDocument: { version: 1, layers } });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const times = [];
        for (let n = 0; n < 8; n++) {
          const start = performance.now();
          window.__mockupBaseline.apply({ textDocument: { version: 1, layers: layers.map((layer, index) => index ? layer : { ...layer, content: (n % 2 ? 'B' : 'A').repeat(length) }) } });
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const nodes = [...document.querySelectorAll('#studio-canvas [data-canvas-text]')];
          if (nodes.length !== count) throw new Error('Real renderer node count mismatch');
          nodes.forEach(node => node.offsetHeight);
          times.push(performance.now() - start);
        }
        rows.push({ count, codepoints: length, samples: times, medianMs: [...times].sort((a,b) => a-b)[4], maxMs: Math.max(...times) });
      }
      return rows;
    });
    await fs.writeFile(path.join(output, 'renderer-perf.json'), JSON.stringify({ scope: 'Actual document state update, React render and intrinsic DOM layout through two animation frames; drag interaction is not implemented in M1.', rows }, null, 2));
    assert.equal(rows.length, 8);
  } finally { await browser.close(); }
});

test('real missing font, invalid text box and missing image report named actionable export errors', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser(raster);
  try {
    const page = await preparePage(browser, url);
    const missingFont = await page.evaluate(async () => {
      const { artworkFontCSS } = await import('/src/export/prepareArtworkExport.ts');
      document.fonts.add(new FontFace('M1 Missing Face', 'url(/poster/fonts/m1-missing-face.ttf)', { style: 'italic', weight: '600' }));
      try { await artworkFontCSS(document.querySelector('#studio-canvas'), ['italic 600 16px "M1 Missing Face"']); return null; }
      catch (error) { return error.message; }
    });
    assert.match(missingFont, /M1 Missing Face/); assert.match(missingFont, /italic 600/); assert.match(missingFont, /try again/i);
    const layers = [{ id:'outside', content:'Outside headline', centerX:.99, centerY:.2, widthRatio:.7, font:'manrope', fontSize:48, weight:700, italic:false, color:'#FFFFFF', align:'center' }];
    await page.evaluate(layers => window.__mockupBaseline.apply({ textDocument: { version:1, layers } }), layers);
    await page.waitForFunction(() => document.querySelector('[data-canvas-text]')?.textContent === 'Outside headline');
    const clickDownload = async () => { await clickButton(page,'Export'); await clickButton(page,'1x Web'); await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.offsetParent !== null && /^Download /.test(b.innerText.trim())).click()); };
    await clickDownload();
    await page.waitForFunction(() => [...document.querySelectorAll('[role=alert]')].some(n => /Outside headline.*outside the canvas/i.test(n.textContent)));
    await page.waitForFunction(() => !document.querySelector('[aria-busy=true]'));
    const textError = await page.$eval('[data-text-export-error]', n => n.textContent);
    await page.evaluate(() => window.__mockupBaseline.apply({ imageSrc:'', textDocument:{version:1,layers:[]} }));
    await page.waitForFunction(() => window.__mockupBaseline.snapshot.imageSrc === '');
    await clickDownload();
    await page.waitForFunction(() => [...document.querySelectorAll('[role=alert]')].some(n => /Main screenshot is required.*Upload/i.test(n.textContent)));
    await page.waitForFunction(() => !document.querySelector('[aria-busy=true]'));
    assert.equal(await page.$$eval('[aria-hidden=true] [data-canvas-root]', nodes => nodes.length), 0, 'Failed export cleans up offscreen renderer');
    await fs.writeFile(path.join(output,'export-errors.json'), JSON.stringify({ missingFont, textError, missingImage:await page.$eval('[data-text-export-error]',n=>n.textContent) },null,2));
  } finally { await browser.close(); }
});

test('delayed real font embedding freezes editor tools, keyboard, paste and mode while preserving snapshot', { skip: !url, timeout: 90000 }, async () => {
  const browser = await launchBrowser(raster); let pending = [];
  try {
    const page = await preparePage(browser, url);
    await clickButton(page,'Add text');
    await page.evaluate(() => document.fonts.ready);
    const snapshot = await page.evaluate(() => JSON.stringify(window.__mockupBaseline.snapshot));
    await page.setCacheEnabled(false); await page.setRequestInterception(true); let hold=true;
    page.on('request', request => { if(hold && request.url().includes('/poster/fonts/')) pending.push(request); else request.continue(); });
    await exportPNGWithHold();
    async function exportPNGWithHold() {
      await clickButton(page, 'Done');
      await page.click('.export-trigger-btn'); await clickButton(page,'1x Web');
      await downloadPng(page,output,'frozen-export.png',async () => {
        await page.evaluate(() => [...document.querySelectorAll('button')].find(b=>b.offsetParent!==null && /^Download /.test(b.innerText.trim())).click());
        await page.waitForFunction(()=>document.querySelector('[aria-busy=true]')?.inert);
        for(let i=0;i<50&&!pending.length;i++) await new Promise(resolve=>setTimeout(resolve,100));
        assert.ok(pending.length,'Actual font resource request is held');
        await page.click('[aria-label="Add text"]');
        await page.click('[aria-label="Text size"]'); await page.keyboard.type('999');
        await page.keyboard.press('2');
        await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
        await page.evaluate(()=>window.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true})));
        await page.evaluate(()=> { const button=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()==='Poster'); const r=button.getBoundingClientRect(); window.__m1PosterPoint={x:r.x+r.width/2,y:r.y+r.height/2}; });
        const point=await page.evaluate(()=>window.__m1PosterPoint); await page.mouse.click(point.x,point.y);
        assert.equal(await page.evaluate(()=>JSON.stringify(window.__mockupBaseline.snapshot)),snapshot,'Editing and shortcuts cannot mutate document during output');
        assert.equal(await page.$eval('nav[aria-label="Studio mode"] button',n=>n.getAttribute('aria-pressed')),'true','Mode stays Mockup');
        await page.screenshot({path:path.join(output,'frozen-export.preview.png')});
        hold=false;for(const request of pending) await request.continue();pending=[];
      });
    }
    await page.waitForFunction(()=>!document.querySelector('[aria-busy=true]'));
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__mockupBaseline.snapshot)),snapshot,'Completed output preserves full editor document');
    await page.setRequestInterception(false);
    await fs.writeFile(path.join(output,'export-freeze.json'), JSON.stringify({ heldActualFontRequest:true, documentUnchanged:true, modeUnchanged:true },null,2));
  } finally { for(const request of pending) await request.continue().catch(()=>{}); await browser.close(); }
});

test('one failed embedded italic face blocks actual PNG even when another used face embeds successfully', { skip: !url, timeout: 60000 }, async () => {
  const browser = await launchBrowser(raster);
  try {
    const page = await preparePage(browser,url);
    const layers = [
      {id:'used-manrope',content:'Manrope 600',font:'manrope',italic:false},
      {id:'used-gelasio',content:'Gelasio 600 italic',font:'gelasio',italic:true},
    ].map((layer,i)=>({...layer,centerX:.5,centerY:.2+i*.15,widthRatio:.7,fontSize:48,weight:600,color:'#FFFFFF',align:'center'}));
    await page.evaluate(layers=>window.__mockupBaseline.apply({textDocument:{version:1,layers}}),layers);
    await page.waitForFunction(()=>document.querySelectorAll('#studio-canvas [data-canvas-text]').length===2);
    await page.evaluate(async()=>{await document.fonts.load('normal 600 48px "Poster Manrope"');await document.fonts.load('italic 600 48px "Poster Gelasio"');await document.fonts.ready;});
    let failed=0,downloaded=0,failItalic=true;
    const snapshot=await page.evaluate(()=>JSON.stringify(window.__mockupBaseline.snapshot));
    const cdp=await page.createCDPSession();await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:output,eventsEnabled:true});cdp.on('Browser.downloadWillBegin',()=>downloaded++);
    await page.setCacheEnabled(false);await page.setRequestInterception(true);
    page.on('request',request=>{if(failItalic&&request.url().includes('/poster/fonts/Gelasio-Italic.ttf')){failed++;request.abort('failed');}else request.continue();});
    await clickButton(page,'Export');await clickButton(page,'1x Web');
    await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.offsetParent!==null&&/^Download /.test(b.innerText.trim())).click());
    await page.waitForFunction(()=>[...document.querySelectorAll('[role=alert]')].some(n=>/Poster Gelasio/.test(n.textContent)&&/embedded/.test(n.textContent)));
    assert.ok(failed>0,'Actual italic font embedding resource fails after the preview face has loaded');
    const error=await page.$eval('[data-text-export-error]',n=>n.textContent);
    assert.match(error,/italic 600/);assert.match(error,/try again/i);assert.equal(downloaded,0,'Partial font CSS must never download fallback text');
    await page.waitForFunction(()=>!document.querySelector('[aria-busy=true]'));
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__mockupBaseline.snapshot)),snapshot,'Failed font embedding preserves the document');
    failItalic=false;
    const retry=await exportPNG(page,'single-face-retry.png');
    assert.ok((await sharp(retry.path).metadata()).width>0,'Same-page retry creates actual product PNG after resource recovers');
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__mockupBaseline.snapshot)),snapshot,'Same-page recovery preserves document, without reload');
    await fs.writeFile(path.join(output,'single-face-error.json'),JSON.stringify({failedFontRequests:failed,firstAttemptDownloads:0,error,retry,recoveredWithoutReload:true,documentUnchanged:true},null,2));
    await page.setRequestInterception(false);await cdp.detach();
  } finally {await browser.close();}
});

test('a failed initial owned CSS font load recovers on the next click in the same editor document', { skip: !url, timeout: 60000 }, async () => {
  const browser=await launchBrowser(raster);
  try {
    const page=await preparePage(browser,url);
    await page.setCacheEnabled(false);await page.setRequestInterception(true);
    let fail=true,failed=0,recoveredRequests=0;
    page.on('request',request=>{if(request.url().includes('/poster/fonts/Gelasio-Italic.ttf')){if(fail){failed++;request.abort('failed');}else{recoveredRequests++;request.continue();}}else request.continue();});
    const layer={id:'first-load',content:'Recover this draft',font:'gelasio',italic:true,weight:600,fontSize:48,color:'#FFFFFF',align:'center',centerX:.5,centerY:.2,widthRatio:.7};
    await page.evaluate(layer=>window.__mockupBaseline.apply({textDocument:{version:1,layers:[layer]}}),layer);
    await page.waitForFunction(()=>document.querySelector('[data-canvas-text]')?.textContent==='Recover this draft');
    for(let i=0;i<50&&!failed;i++)await new Promise(resolve=>setTimeout(resolve,100));
    assert.ok(failed>0,'Actual initial CSS face load is rejected before export');
    const snapshot=await page.evaluate(()=>JSON.stringify(window.__mockupBaseline.snapshot));
    await clickButton(page,'Export');await clickButton(page,'1x Web');await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.offsetParent!==null&&/^Download /.test(b.innerText.trim())).click());
    await page.waitForFunction(()=>[...document.querySelectorAll('[role=alert]')].some(n=>/italic 600.*Poster Gelasio.*could not be loaded/i.test(n.textContent)));
    await page.waitForFunction(()=>!document.querySelector('[aria-busy=true]'));
    const firstError=await page.$eval('[data-text-export-error]',n=>n.textContent);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__mockupBaseline.snapshot)),snapshot);
    fail=false;
    let retry;
    try { retry=await exportPNG(page,'initial-font-load-retry.png'); }
    catch(error){console.log('Initial-load recovery failure',await page.evaluate(()=>({errors:[...document.querySelectorAll('[role=alert]')].map(n=>n.textContent),faces:[...document.fonts].filter(f=>f.family.includes('Gelasio')).map(f=>({family:f.family,style:f.style,weight:f.weight,status:f.status})),check:document.fonts.check('italic 600 16px "Poster Gelasio"')})));throw error;}
    assert.ok(recoveredRequests>0,'Retry fetches a fresh owned face after the CSS face has permanent error status');
    assert.ok((await sharp(retry.path).metadata()).width>0);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.__mockupBaseline.snapshot)),snapshot);
    const faces=await page.evaluate(()=>[...document.fonts].filter(face=>face.family.replaceAll('"','')==='Poster Gelasio'&&face.style==='italic').map(face=>({status:face.status,weight:face.weight})));
    assert.ok(faces.some(face=>face.status==='error')&&faces.some(face=>face.status==='loaded'),'A newly loaded face recovers without reusing the failed CSS FontFace');
    const glyphWidths=await page.evaluate(async()=>{
      const reference=new FontFace('M1 Reference Gelasio','url(/poster/fonts/Gelasio-Italic.ttf)',{style:'italic',weight:'400 700'});await reference.load();document.fonts.add(reference);
      return ['Poster Gelasio','M1 Reference Gelasio'].map(family=>{const span=document.createElement('span');Object.assign(span.style,{position:'absolute',left:'-10000px',whiteSpace:'pre',fontFamily:`"${family}"`,fontWeight:'600',fontStyle:'italic',fontSize:'48px'});span.textContent='Recover this draft';document.body.appendChild(span);const range=document.createRange();range.selectNodeContents(span);const width=range.getBoundingClientRect().width;span.remove();return width;});
    });
    assert.ok(Math.abs(glyphWidths[0]-glyphWidths[1])<.1,'Recovered preview family uses actual Gelasio glyph advances instead of fallback');
    // Switching modes must reuse the recovered face, not await the old CSS error.
    await clickButton(page,'Poster');await page.select('select[aria-label="Poster export size"]','1');
    const posterRetry=await downloadPng(page,output,'initial-font-load-poster-retry.png',()=>clickButton(page,'Download PNG'));
    assert.equal((await sharp(posterRetry.path).metadata()).width,1600);
    await fs.writeFile(path.join(output,'initial-font-load-recovery.json'),JSON.stringify({firstError,failed,recoveredRequests,retry,faces,glyphWidths,posterRetry,documentUnchanged:true,reloaded:false},null,2));
    await page.setRequestInterception(false);
  } finally {await browser.close();}
});
