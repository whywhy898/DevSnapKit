import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from '../tests/helpers/browser.mjs';
import { startSeoServer } from '../tests/helpers/seo-server.mjs';
const remote = process.argv.find(arg => arg.startsWith('--origin='))?.slice(9);
const output = process.env.TEXT_DEMO_CHECK_OUTPUT || 'D:/workspace/MarkMoney/output/devsnapkit/text-hero-redesign-2026-10-30/browser';
await fs.mkdir(output, { recursive: true });
const server = remote ? null : await startSeoServer(() => ({}));
const origin = remote || server.origin;
const browser = await launchBrowser();
const result = { origin, cases: [], errors: [] };
let active;
try {
  for (const config of [{width:1440,height:900}, {width:1366,height:768}, {width:390,height:844}, {width:390,height:844,dark:true,reduced:true}, {width:320,height:800,noScript:true}, {width:1440,height:900,autoplayDenied:true}, {width:390,height:844,failed:true}, {width:1440,height:900,legacyCache:true}]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage(); active = page;
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => result.errors.push(error.message));
    await page.setViewport({width:config.width,height:config.height,deviceScaleFactor:1});
    await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:config.reduced?'reduce':'no-preference'},{name:'prefers-color-scheme',value:config.dark?'dark':'light'}]);
    if (config.noScript) await page.setJavaScriptEnabled(false);
    if (config.autoplayDenied) await page.evaluateOnNewDocument(() => {
      const original = HTMLMediaElement.prototype.play;
      let first = true;
      HTMLMediaElement.prototype.play = function() {
        if (first) {first=false;return Promise.reject(new DOMException('Test autoplay policy','NotAllowedError'));}
        return original.call(this);
      };
    });
    let fail = config.failed;
    let legacyServed=false;
    await page.setRequestInterception(true);
    page.on('request', request => {
      if(config.legacyCache && request.url()===`${origin}/seo/text-demo.js`){legacyServed=true;return request.respond({status:200,contentType:'application/javascript',body:'document.querySelector("video").controls=true;'});}
      if(config.legacyCache && request.url()===`${origin}/seo/text-guide.css`){legacyServed=true;return request.respond({status:200,contentType:'text/css',body:'.text-task .hero{max-width:1440px}.comparison{max-width:980px;margin:auto}'});}
      if (remote && request.url().includes('/api/telemetry/event')) return request.respond({status:200,contentType:'application/json',body:'{"ok":true}'});
      if (fail && request.url().includes('/seo/video/add-text-flow.mp4')) return request.respond({status:404,body:''});
      return request.continue();
    });
    await page.goto(`${origin}/add-text-to-image/`, {waitUntil:'networkidle0'});
    const initial = await page.evaluate(() => {
      const v=document.querySelector('video'), r=v.getBoundingClientRect(), t=document.querySelector('[data-demo-play]').getBoundingClientRect(), e=document.querySelector('[data-demo-expand]').getBoundingClientRect();
      const brand=document.querySelector('.site-header .brand').getBoundingClientRect(),copy=document.querySelector('.hero-copy').getBoundingClientRect(),heading=document.querySelector('.comparison-section .section-heading').getBoundingClientRect(),comparison=document.querySelector('.comparison').getBoundingClientRect(),before=document.querySelector('.compare-before img').getBoundingClientRect(),after=document.querySelector('.compare-after img').getBoundingClientRect();
      return {paused:v.paused,muted:v.muted,loop:v.loop,controls:v.controls,overflow:document.documentElement.scrollWidth>innerWidth+1,top:r.top,bottom:r.bottom,width:r.width,height:r.height,toggleLeft:t.left<=r.left+25,toggleTop:t.top<=r.top+25,expandRight:e.right>=r.right-25,expandBottom:e.bottom>=r.bottom-25,copyAligned:Math.abs(brand.left-copy.left)<1,comparisonAligned:Math.abs(heading.left-comparison.left)<1&&Math.abs(brand.left-comparison.left)<1,imagesAligned:Math.abs(before.left-after.left)<1&&Math.abs(before.top-after.top)<1&&Math.abs(before.width-after.width)<1&&Math.abs(before.height-after.height)<1,headerCTA:!!document.querySelector('.site-header .button')};
    });
    assert.equal(initial.overflow,false);
    assert.equal(initial.muted,true); assert.equal(initial.loop,false);
    assert.equal(initial.controls,!!config.noScript);
    if(config.legacyCache) assert.equal(legacyServed,false,'Updated HTML bypasses the previously cached player and stylesheet URLs');
    assert.equal(initial.copyAligned,true,'Hero shares the header left edge');
    assert.equal(initial.comparisonAligned,true,'Comparison shares the header and section-heading left edge');
    assert.equal(initial.imagesAligned,true,'Before and after occupy the same image geometry');
    assert.equal(initial.headerCTA,false,'No duplicate header CTA');
    assert.ok(initial.bottom <= config.height - 30, 'Video is visible within the first viewport');
    assert.ok(Math.abs(initial.width/initial.height-16/9)<.02);
    if (config.noScript) {assert.equal(initial.paused,true); result.cases.push({...config,initial});await context.close();continue;}
    assert.ok(initial.toggleLeft && initial.toggleTop && initial.expandRight && initial.expandBottom);
    if (config.failed) {
      await page.waitForFunction(()=>document.querySelector('[data-demo-play]').dataset.state==='retry');
      assert.equal(await page.$eval('[data-demo-status]',n=>n.hidden),false);
      fail=false;
      await page.click('[data-demo-play]');
    } else if (config.reduced || config.autoplayDenied) {
      assert.equal(initial.paused,true);
      assert.equal(await page.$eval('[data-demo-play]',n=>n.dataset.state),'play');
      await page.focus('[data-demo-play]'); await page.keyboard.press('Space');
    }
    await page.waitForFunction(()=>{let v=document.querySelector('video');return !v.paused&&v.currentTime>.2;});
    await page.click('[data-demo-play]');
    const pausedAt=await page.$eval('video',v=>v.currentTime);
    assert.equal(await page.$eval('video',v=>v.paused),true);
    if(config.width===1440&&!config.autoplayDenied){
      await page.setViewport({width:667,height:375});
      await page.click('[data-demo-expand]');
      const geometry=await page.evaluate(()=>{
        const d=document.querySelector('dialog'),r=d.getBoundingClientRect(),v=d.querySelector('video').getBoundingClientRect(),c=d.querySelector('[data-demo-close]').getBoundingClientRect();
        return {fits:v.top>=r.top-1&&v.bottom<=r.bottom+1&&c.top>=r.top&&c.bottom<=r.bottom,scroll:d.scrollTop};
      });
      assert.equal(geometry.fits,true,'Landscape modal shows the whole video and close control');
      assert.equal(geometry.scroll,0);
      await page.keyboard.press('Escape');
      await page.setViewport({width:config.width,height:config.height});
    }
    await page.click('[data-demo-expand]');
    assert.equal(await page.$eval('dialog',d=>d.open),true);
    assert.equal(await page.$eval('video',v=>v.paused),true);
    assert.ok(Math.abs(await page.$eval('video',v=>v.currentTime)-pausedAt)<.1);
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('dialog',d=>d.open),false);
    await page.waitForFunction(()=>document.activeElement===document.querySelector('[data-demo-expand]'));
    assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('[data-demo-expand]')),true);
    assert.equal(await page.$eval('video',v=>v.paused),true);
    await page.click('[data-demo-play]');
    await page.click('[data-demo-expand]');
    await page.waitForFunction(()=>!document.querySelector('video').paused);
    const expandedAt=await page.$eval('video',v=>v.currentTime);
    await page.click('[data-demo-close]');
    await page.waitForFunction(()=>!document.querySelector('video').paused);
    assert.ok(await page.$eval('video',v=>v.currentTime)>=expandedAt-.1);
    await page.$eval('video',v=>{v.currentTime=v.duration-.1;});
    await page.waitForFunction(()=>document.querySelector('video').ended);
    assert.equal(await page.$eval('[data-demo-play]',n=>n.dataset.state),'replay');
    await page.click('[data-demo-play]');
    await page.waitForFunction(()=>{let v=document.querySelector('video');return !v.paused&&v.currentTime>.1&&v.currentTime<3;});
    await page.click('[data-demo-play]');
    await page.$eval('video',v=>{v.textTracks[0].mode='hidden';});
    await page.waitForFunction(()=>document.querySelector('video').textTracks[0].cues?.length>0);
    const media=await page.$eval('video',v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,cues:v.textTracks[0].cues.length}));
    assert.equal(media.width,1280);assert.equal(media.height,720);assert.ok(media.duration<45&&media.cues>=10);
    await page.screenshot({path:path.join(output,`hero-${config.width}${config.dark?'-dark':config.autoplayDenied?'-denied':config.failed?'-retry':''}.png`)});
    if(config.width===1440&&!config.autoplayDenied){await page.$eval('video',v=>{v.currentTime=22;});await page.screenshot({path:path.join(output,'hero-editing.png')});}
    result.cases.push({...config,initial,media,modalPreserved:true,replay:true});
    await context.close();
  }
  const range = await fetch(`${origin}/seo/video/add-text-flow.mp4`,{headers:{Range:'bytes=0-1023'}});
  assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,1024);
  const vtt=await fetch(`${origin}/seo/video/add-text-flow.en.vtt`);
  assert.ok(vtt.headers.get('content-type').includes('text/vtt'));assert.ok((await vtt.text()).startsWith('WEBVTT'));
  assert.deepEqual(result.errors,[]);result.passed=true;
} catch(error) {result.passed=false;result.error=error.stack;process.exitCode=1;await active?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally {await browser.close();await server?.close();await fs.writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,cases:result.cases.length,error:result.error?.split('\n')[0],output}));}
