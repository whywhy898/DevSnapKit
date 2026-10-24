import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { launchBrowser, clickButton, downloadPng } from './helpers/browser.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.env.SCENE_OUTPUT || path.join(root, '../../output/devsnapkit/template-composition-2026-10-24/local'));
const origin = process.env.SCENE_ORIGIN || 'http://127.0.0.1:5199';
const server = process.env.SCENE_ORIGIN ? null : spawn(process.execPath, [path.join(path.dirname(require.resolve('vite/package.json')), 'bin/vite.js'), '--config', 'tests/vite-mockup-baseline.config.mjs', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
const pause = ms => new Promise(r => setTimeout(r, ms));
let browser;
const results = [];
// The Code preset's blue background and dark frame are separable along these
// DOM-derived scan lines. Do not apply this colour rule to arbitrary gradients.
async function codeRasterBounds(file, logical, scene) {
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const ratio=info.width/logical.width;
  const dark=(x,y)=>{const i=(y*info.width+x)*4;return data[i]<22&&data[i+1]<27&&data[i+2]<42&&data[i+3]>250;};
  const cx=Math.round((scene.x+scene.w/2)*ratio), cy=Math.round((scene.y+scene.h/2)*ratio);
  assert.ok(dark(cx,cy),'Code centre must be inside the dark frame');
  // Take the outermost dark pixels, rather than stopping on the SVG's lighter
  // inner panel stroke (which would measure the panel instead of the window).
  const xs=Array.from({length:info.width},(_,x)=>x).filter(x=>dark(x,cy));
  const ys=Array.from({length:info.height},(_,y)=>y).filter(y=>dark(cx,y));
  const left=xs[0],right=xs.at(-1),top=ys[0],bottom=ys.at(-1);
  return {x:left/ratio,y:top/ratio,w:(right-left+1)/ratio,h:(bottom-top+1)/ratio};
}
try {
  await fs.mkdir(output, { recursive: true });
  for (let i=0;i<100;i++) { try { if ((await fetch(origin)).ok) break; } catch {} await pause(100); }
  browser = await launchBrowser();
  for (const [id,name] of [['code-terminal','Code & Terminal'],['saas-dashboard','SaaS Dashboard'],['social-launch','Social Launch']]) {
    const page=await browser.newPage();
    // Code pixel evidence uses a native logical-size preview, avoiding a
    // downscaled editor screenshot's sampling error at the 2px boundary.
    await page.setViewport({width:id==='code-terminal'?3000:1440,height:id==='code-terminal'?2200:1100,deviceScaleFactor:1});
    await page.evaluateOnNewDocument(()=>localStorage.setItem('devsnapkit_welcome_seen','1'));
    await page.goto(origin+'/?editor=1',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('button[aria-label="Templates"]');
    await page.click('button[aria-label="Templates"]'); await page.click(`button[aria-label="Apply ${name} template"]`);
    await page.waitForFunction(()=>document.querySelector('#studio-canvas [data-canvas-text]')&&document.querySelector('#studio-canvas [data-media-surface] img')?.complete);
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(i=>i.decode()));}); await pause(900);
    await clickButton(page,'Export'); await page.mouse.move(0,0);
    for (const scale of [1,2]) {
      await clickButton(page,scale===1?'1x Web':'2x HD'); await pause(500);
      await page.evaluate(()=>{
        window.__measureScene=canvas=>{
          const b=canvas.getBoundingClientRect(), scale=b.width/canvas.offsetWidth;
          return [...canvas.querySelectorAll('[data-scene-inner],[data-scene-fit],[data-scene-bounds],[data-scene-slot],[data-media-surface],[data-media-surface] img')].map((n,i)=>{const r=n.getBoundingClientRect();return {key:n.tagName+':'+i,x:(r.x-b.x)/scale,y:(r.y-b.y)/scale,w:r.width/scale,h:r.height/scale,transform:getComputedStyle(n).transform,natural:n.tagName==='IMG'?[n.naturalWidth,n.naturalHeight]:null};});
        };
        window.__previewScene=window.__measureScene(document.querySelector('#studio-canvas')); window.__exportScene=null;
        window.__sceneObserver?.disconnect();window.__sceneObserver=new MutationObserver(()=>{const c=document.querySelector('[data-export-target]>[data-canvas-root]');if(c)window.__exportScene=window.__measureScene(c);});
        window.__sceneObserver.observe(document.body,{subtree:true,childList:true,attributes:true});
      });
      await (await page.$('#studio-canvas')).screenshot({path:path.join(output,`${id}-${scale}x-preview.png`)});
      const label=await page.$$eval('button',ns=>ns.find(n=>n.offsetParent!==null&&/^Download [12]x \(/.test(n.innerText))?.innerText.trim());
      const download=await downloadPng(page,output,`${id}-${scale}x.png`,()=>clickButton(page,label));
      const data=await page.evaluate(()=>{window.__sceneObserver.disconnect();return {preview:window.__previewScene,exported:window.__exportScene,metrics:window.__lastExportMetrics};});
      const logical=await page.$eval('#studio-canvas',n=>({width:n.offsetWidth,height:n.offsetHeight}));
      let maxDelta=0;
      for(const item of data.preview){const actual=data.exported.find(n=>n.key===item.key);assert.ok(actual,item.key);for(const key of ['x','y','w','h'])maxDelta=Math.max(maxDelta,Math.abs(item[key]-actual[key]));assert.deepEqual(actual.natural,item.natural);}
      assert.ok(maxDelta<=2,`${id}: actual media DOM delta ${maxDelta}`);
      const metadata=await sharp(download.path).metadata();
      const expected=scale===1?logical:id==='social-launch'?{width:2400,height:1260}:{width:2560,height:1440};
      assert.equal(metadata.width,expected.width);assert.equal(metadata.height,expected.height);
      let raster;
      if(id==='code-terminal'){
        const scene=data.preview.find(n=>n.key==='DIV:2');
        const preview=await codeRasterBounds(path.join(output,`${id}-${scale}x-preview.png`),logical,scene);
        const exported=await codeRasterBounds(download.path,logical,scene);
        const delta=Math.max(...['x','y','w','h'].map(k=>Math.abs(preview[k]-exported[k])));
        assert.equal((await sharp(path.join(output,`${id}-${scale}x-preview.png`)).metadata()).width,logical.width,'Code preview pixels must be native logical size');
        const pixelBudget=2;
        assert.ok(delta<=pixelBudget,`Code PNG frame delta ${delta}, budget ${pixelBudget}`);
        for(const key of ['x','y','w','h'])assert.ok(Math.abs(preview[key]-scene[key])<=2,`Code raster scan must find the actual outer window: ${key}`);
        raster={preview,exported,maxLogicalDelta:delta,pixelBudget,method:'Outermost dark pixels along DOM-derived horizontal/vertical centre lines; Code/Atlantic only; preview scan verified against outer window DOM'};
      }
      results.push({id,scale,label,logical,download,maxDOMDelta:maxDelta,raster,...data}); await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));
      console.log(`${id} ${scale}x: DOM delta ${maxDelta.toFixed(4)}px${raster?', PNG frame delta '+raster.maxLogicalDelta.toFixed(4)+'px':''}`);
    }
    await page.close();
  }
} finally {await browser?.close(); server?.kill();}
