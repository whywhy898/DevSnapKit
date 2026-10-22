import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { launchBrowser, preparePage } from './helpers/browser.mjs';
const url=process.env.TEST_UI_URL;
const output=path.resolve('../../output/devsnapkit/canvas-text-v1/geometry');
const paint=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*p)-1)];
test('T4 actual handle and native text input response protocol, 3 runs per 1/5/10/20 short and 1000 codepoint case', {skip:!url||!process.env.CANVAS_TEXT_PERF,timeout:240000},async()=>{
  const browser=await launchBrowser();
  try{
    const page=await preparePage(browser,url),image=path.resolve('../../output/devsnapkit/honeywerank-original.png');
    const sourceHashes={};for(const file of ['src/App.tsx','src/editorHistory.ts','src/useHistory.ts','src/CanvasLayout.tsx','src/MockupArtwork.tsx','src/canvasDimensions.ts','src/text/geometry.ts','src/text/CanvasTextOverlay.tsx','src/text/TextControls.tsx','src/text/useCanvasTextEditor.ts','src/text/useTextLayoutValidation.ts','src/text/document.ts'])sourceHashes[file]=createHash('sha256').update(await fs.readFile(file)).digest('hex');
    await (await page.$('[aria-label="Main screenshot file"]')).uploadFile(image);
    await page.waitForFunction(()=>window.__mockupBaseline.snapshot.imageName==='honeywerank-original.png'&&document.querySelector('#studio-canvas img')?.naturalWidth>0);
    const metadata={date:new Date().toISOString(),sourceHashes,sceneReferenceCommit:process.env.CANVAS_TEXT_SCENE_REFERENCE_COMMIT||null,sceneSkipExperiment:Boolean(process.env.CANVAS_TEXT_SKIP_REDUNDANT_SCENE),warmup:'Actual uploaded image naturalWidth>0, exact rendered layer count, document.fonts.ready, two settled rAFs before each timed phase. No CPU throttling. Short48px/long24px keeps the1000-codepoint case valid on1600x1200.',browser:await browser.version(),browserFlags:browser.process().spawnargs.filter(a=>a.startsWith('--')),hardware:{cpu:'13th Gen Intel(R) Core(TM) i9-13900H',logicalProcessors:20,ramGiB:31.75,os:'Windows NT 10.0.26300.0'},cpuThrottling:'none',image:{path:image,bytes:(await fs.stat(image)).size,width:1440,height:1000},...await page.evaluate(()=>({dpr:devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},canvas:{width:1600,height:1200},font:'same-origin Poster Manrope 700 normal'})),budget:{frameP95Ms:33.4,inputToPaintOpportunityP95Ms:100},measurement:'Trusted pointermove and native textarea input through production React handlers. Continuous requestAnimationFrame intervals during drag. Event timestamp to rAF-following task estimates a paint opportunity; this is not GPU presentation timing. No bridge state update is timed. Fixture snapshots only set up layer counts/content.'};
    await page.evaluate(()=>{
      window.__interactionPerf={active:false,frames:[],move:[],input:[],events:[],hotspots:{history:[],scene:[]}};
      let last=0;
      const tick=t=>{const p=window.__interactionPerf;if(p.active&&last)p.frames.push(t-last);last=p.active?t:0;requestAnimationFrame(tick);};requestAnimationFrame(tick);
      for(const type of ['pointermove','input'])document.addEventListener(type,event=>{
        const p=window.__interactionPerf;if(!p.active||!event.isTrusted)return;
        if(type==='pointermove'&&!event.target.closest('[data-text-gesture]'))return;
        if(type==='input'&&!event.target.matches('[aria-label="Text content"],[aria-label="Mockup zoom"]'))return;
        const start=performance.now();requestAnimationFrame(()=>setTimeout(()=>{(type==='input'?p.input:p.move).push(performance.now()-start);p.events.push({type,timeStamp:event.timeStamp,start,end:performance.now(),trusted:event.isTrusted});},0));
      },true);
    });
    const baseline=[];
    await page.evaluate(()=>window.__mockupBaseline.apply({aspectRatioId:'custom',customCanvasSize:{width:1600,height:1200},textDocument:{version:1,layers:[]}}));await paint(page);
    for(let run=1;run<=3;run++){
      await page.evaluate(()=>Object.assign(window.__interactionPerf,{active:true,frames:[],move:[],input:[],events:[],hotspots:{history:[],scene:[]}}));
      await new Promise(resolve=>setTimeout(resolve,700));
      const idle=await page.evaluate(()=>({frames:window.__interactionPerf.frames}));
      await page.focus('[aria-label="Mockup zoom"]');
      await page.evaluate(()=>Object.assign(window.__interactionPerf,{frames:[],input:[],events:[],hotspots:{history:[],scene:[]}}));
      for(let n=0;n<24;n++){await page.keyboard.press(n<12?'ArrowUp':'ArrowDown');await paint(page);}
      await paint(page);await page.evaluate(()=>window.__interactionPerf.active=false);
      const input=await page.evaluate(()=>({latencies:window.__interactionPerf.input,hotspots:window.__interactionPerf.hotspots,events:window.__interactionPerf.events}));
      baseline.push({run,description:'Zero text, same uploaded image and canvas; idle rAF and trusted native Mockup zoom number input as old-tool control',idle,input,summary:{idleFrameP50Ms:percentile(idle.frames,.5),idleFrameP95Ms:percentile(idle.frames,.95),inputPaintP50Ms:percentile(input.latencies,.5),inputPaintP95Ms:percentile(input.latencies,.95)}});
    }
    const rows=[];
    for(const count of [1,5,10,20])for(const length of [20,1000])for(let run=1;run<=3;run++){
      await page.evaluate(({count,length})=>{const fontSize=length===1000?24:48;const layers=Array.from({length:count},(_,i)=>({id:'interaction-'+i,content:'A'.repeat(length),centerX:.5,centerY:.5+i*.003,widthRatio:.8,font:'manrope',fontSize,weight:700,italic:false,color:'#FFFFFF',align:'center'}));window.__mockupBaseline.apply({aspectRatioId:'custom',customCanvasSize:{width:1600,height:1200},textDocument:{version:1,layers}});},{count,length});
      await page.waitForFunction(count=>document.querySelectorAll('#studio-canvas [data-canvas-text]').length===count,{},count);await page.evaluate(()=>document.fonts.ready);await paint(page);
      await page.select('[aria-label="Current text"]','interaction-0');await paint(page);
      const handle=await page.$('[aria-label="Move text"]'),box=await handle.boundingBox();
      const beforeDrag=await page.evaluate(()=>({layer:window.__mockupBaseline.snapshot.textDocument.layers[0],scale:document.querySelector('[data-text-logical-overlay]').getBoundingClientRect().width/document.querySelector('[data-text-logical-overlay]').offsetWidth}));
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
      await page.evaluate(()=>Object.assign(window.__interactionPerf,{active:true,frames:[],move:[],input:[],events:[],hotspots:{history:[],scene:[]}}));
      for(let n=1;n<=45;n++)await page.mouse.move(box.x+box.width/2+Math.sin(n/8)*25,box.y+box.height/2+Math.cos(n/8)*10);
      await page.mouse.up();await paint(page);await page.evaluate(()=>window.__interactionPerf.active=false);
      const drag=await page.evaluate(()=>({frames:window.__interactionPerf.frames,latencies:window.__interactionPerf.move,events:window.__interactionPerf.events,hotspots:window.__interactionPerf.hotspots}));
      const afterDrag=await page.evaluate(()=>({layer:window.__mockupBaseline.snapshot.textDocument.layers[0],left:parseFloat(document.querySelector('#studio-canvas [data-canvas-text]').style.left),top:parseFloat(document.querySelector('#studio-canvas [data-canvas-text]').style.top)}));
      const expectedDrag={x:beforeDrag.layer.centerX*1600+Math.sin(45/8)*25/beforeDrag.scale,y:beforeDrag.layer.centerY*1200+Math.cos(45/8)*10/beforeDrag.scale};
      for(const [actual,expected] of [[afterDrag.layer.centerX*1600,expectedDrag.x],[afterDrag.layer.centerY*1200,expectedDrag.y],[afterDrag.left,expectedDrag.x],[afterDrag.top,expectedDrag.y]])assert.ok(Math.abs(actual-expected)<.1,`Actual applied drag ${actual} agrees with native pointer displacement ${expected}`);
      await page.click('[data-canvas-text-controls] [aria-label="Edit text"]');await page.focus('[aria-label="Text content"]');await page.keyboard.down('Control');await page.keyboard.press('End');await page.keyboard.up('Control');
      await page.evaluate(()=>Object.assign(window.__interactionPerf,{active:true,frames:[],move:[],input:[],events:[],hotspots:{history:[],scene:[]}}));
      for(let n=0;n<12;n++){await page.keyboard.press('Backspace');await page.keyboard.type(n%2?'B':'A');await paint(page);}
      await paint(page);await page.evaluate(()=>window.__interactionPerf.active=false);
      const input=await page.evaluate(()=>({latencies:window.__interactionPerf.input,events:window.__interactionPerf.events,hotspots:window.__interactionPerf.hotspots}));
      const expectedContent='A'.repeat(length-1)+'B';
      const appliedInput=await page.evaluate(()=>({textarea:document.querySelector('[aria-label="Text content"]').value,renderer:document.querySelector('#studio-canvas [data-canvas-text]').textContent,document:window.__mockupBaseline.snapshot.textDocument.layers[0].content}));
      assert.equal(appliedInput.textarea,expectedContent,'The native input draft really changed');
      await page.click('[data-text-edit-dock] button');
      await paint(page);
      const committedInput=await page.evaluate(()=>({renderer:document.querySelector('#studio-canvas [data-canvas-text]').textContent,document:window.__mockupBaseline.snapshot.textDocument.layers[0].content}));
      assert.equal(committedInput.renderer,expectedContent);assert.equal(committedInput.document,expectedContent);
      const row={count,codepoints:length,fontSize:length===1000?24:48,run,previewScale:beforeDrag.scale,appliedChecks:{protocol:'v2 non-timed document/render state assertions',expectedDrag,afterDrag,inputCodepoints:[...appliedInput.textarea].length,inputLastCharacter:appliedInput.textarea.at(-1),committedInput},drag,input,summary:{frameP50Ms:percentile(drag.frames,.5),frameP95Ms:percentile(drag.frames,.95),movePaintP50Ms:percentile(drag.latencies,.5),movePaintP95Ms:percentile(drag.latencies,.95),inputPaintP50Ms:percentile(input.latencies,.5),inputPaintP95Ms:percentile(input.latencies,.95)}};
      assert.ok(drag.frames.length>=20&&drag.latencies.length>=40&&input.latencies.length>=20,'Actual trusted interactions produce sufficient samples');rows.push(row);
      await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'interaction-performance.json'),JSON.stringify({metadata,baseline,rows},null,2));
      console.log(JSON.stringify({count,codepoints:length,run,...row.summary}));
    }
    await page.screenshot({path:path.join(output,'performance-20-long.png'),fullPage:true});
    const worst={frameP95Ms:Math.max(...rows.map(r=>r.summary.frameP95Ms)),inputPaintP95Ms:Math.max(...rows.map(r=>r.summary.inputPaintP95Ms)),movePaintP95Ms:Math.max(...rows.map(r=>r.summary.movePaintP95Ms))};
    await fs.writeFile(path.join(output,'interaction-performance-summary.json'),JSON.stringify({metadata,baseline:baseline.map(({run,summary})=>({run,...summary})),worst,rows:rows.map(({count,codepoints,run,summary})=>({count,codepoints,run,...summary}))},null,2));
    for(const [file,hash] of Object.entries(sourceHashes))assert.equal(createHash('sha256').update(await fs.readFile(file)).digest('hex'),hash,`${file} source remains frozen during timing`);
    assert.ok(worst.frameP95Ms<=metadata.budget.frameP95Ms,`frame p95 ${worst.frameP95Ms} exceeds ${metadata.budget.frameP95Ms}`);
    assert.ok(Math.max(worst.inputPaintP95Ms,worst.movePaintP95Ms)<=metadata.budget.inputToPaintOpportunityP95Ms,`input p95 exceeds ${metadata.budget.inputToPaintOpportunityP95Ms}`);
  }finally{await browser.close();}
});
