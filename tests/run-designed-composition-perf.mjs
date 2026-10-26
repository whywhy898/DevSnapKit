import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { launchBrowser, preparePage, clickButton, finishTextEditing } from './helpers/browser.mjs';

const root = path.resolve(process.env.DESIGNED_PERF_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const templateId = process.env.DESIGNED_PERF_TEMPLATE || 'editorial-honey';
if (!['editorial-honey', 'night-signal-duo', 'pocket-flow-duo'].includes(templateId)) throw new Error('Unsupported performance template');
const require = createRequire(import.meta.url);
const origin = 'http://127.0.0.1:5196';
const output = path.resolve(process.env.DESIGNED_PERF_OUTPUT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../output/devsnapkit/whole-card-free-brand/m2/performance',new Date().toISOString().replace(/[:.]/g,'-')));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const paint = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const p95 = values => values.length ? [...values].sort((a,b) => a-b)[Math.ceil(values.length*.95)-1] : null;
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const scenarios = [{name:'common-12-short',count:12,codepoints:20},{name:'pressure-20-short',count:20,codepoints:20},{name:'pressure-20-long',count:20,codepoints:1000}];
const budget = { inputToNextPaintOpportunityP95Ms:80, dragFrameIntervalP95Ms:33.4, minimumTrustedInputEvents:50, minimumTrustedDragEvents:120, minimumDragRafIntervals:120, minimumContinuousDragMs:2000 };
const sourceFiles = async (directory='src') => (await fs.readdir(path.join(root,directory),{withFileTypes:true})).flatMap(item => item.isDirectory() ? [] : /\.(tsx?|css)$/.test(item.name) ? [path.posix.join(directory,item.name)] : []).concat(...await Promise.all((await fs.readdir(path.join(root,directory),{withFileTypes:true})).filter(item=>item.isDirectory()).map(item=>sourceFiles(path.posix.join(directory,item.name)))));
async function sourceHashes() { const result={}; for(const file of [...await sourceFiles(),'tests/vite-mockup-baseline.config.mjs','tests/vite-poster.config.mjs']) result[file]=digest(await fs.readFile(path.join(root,file))); return result; }
const changes = (before,after) => [...new Set([...Object.keys(before),...Object.keys(after)])].filter(file=>before[file]!==after[file]);
const result = {metadata:{started:new Date().toISOString(),budget,measurement:'Trusted native pointer/input capture listener to requestAnimationFrame followed by setTimeout(0): next paint opportunity estimate, not GPU presentation. No fixture updates inside timed phases.',setup:'Real Editorial Honey template UI, cloned only for setup. Main + secondary + independent brand mark + CTA + 12 decorations in every scenario. Fonts and rendered images ready. 1440x1100 DPR1; logical canvas1600x1200.',rows:[]},rows:[],errors:[]};
let browser,server,serverError='';
async function save() { await fs.mkdir(output,{recursive:true}); await fs.writeFile(path.join(output,'interaction-performance.json'),JSON.stringify(result,null,2)); await fs.writeFile(path.join(output,'interaction-performance-summary.json'),JSON.stringify({metadata:result.metadata,rows:result.rows.map(({scenario,run,summary,checks,passed,sourceChangedDuringRun})=>({scenario,run,summary,checks,passed,sourceChangedDuringRun})),errors:result.errors},null,2)); }
try {
  await fs.mkdir(output,{recursive:true});
  result.metadata.sourceHashesStart = await sourceHashes();
  const archivedSha = process.env.DESIGNED_PERF_SOURCE_SHA;
  if (archivedSha && !/^[a-f0-9]{40}$/.test(archivedSha)) throw new Error('Archived source requires an exact commit SHA');
  result.metadata.sourceSha = archivedSha || execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  result.metadata.sourceStatus = archivedSha ? 'Read-only extracted Git archive; source hashes recorded independently.' : execFileSync('git',['status','--short'],{cwd:root,encoding:'utf8'}).trim();
  result.metadata.harnessSha256 = digest(await fs.readFile(fileURLToPath(import.meta.url)));
  result.metadata.hardware = {cpu:os.cpus()[0]?.model,logicalProcessors:os.cpus().length,ramBytes:os.totalmem(),platform:os.platform(),release:os.release(),architecture:os.arch()};
  const vite=path.join(path.dirname(require.resolve('vite/package.json')),'bin/vite.js');
  server=spawn(process.execPath,[vite,'--config','tests/vite-mockup-baseline.config.mjs','--host','127.0.0.1','--port','5196','--strictPort'],{cwd:root,stdio:['ignore','ignore','pipe'],windowsHide:true});
  server.stderr.on('data',chunk=>serverError=(serverError+chunk).slice(-4000));
  let ready=false;
  for(let n=0;n<100;n++){ if(server.exitCode!==null)throw new Error(serverError||'Vite exited');try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await pause(100); }
  assert.ok(ready,'Owned Vite server is ready');
  browser=await launchBrowser();
  result.metadata.browser=await browser.version();result.metadata.browserFlags=browser.process().spawnargs;
  const page=await preparePage(browser,origin+'/?editor=1');
  const cdp=await page.createCDPSession();await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  result.metadata.cpuThrottling={rate:1,verifiedBy:'CDP Emulation.setCPUThrottlingRate rate1'};
  await page.waitForFunction(()=>Boolean(window.__mockupBaseline));
  // Performance fixtures may set Pro through the test-only driver. Entitlement
  // admission is independently exercised through real activation browser tests.
  if(templateId!=='editorial-honey')await page.evaluate(()=>window.__mockupBaseline.apply({}, {pro:true}));
  await clickButton(page,'Templates');
  await page.click(`[aria-label="Apply ${{'editorial-honey':'Editorial Honey','night-signal-duo':'Night Signal Duo','pocket-flow-duo':'Pocket Flow Duo'}[templateId]} template"]`);
  await page.waitForFunction(id=>window.__mockupBaseline.snapshot.compositionDocument?.templateId===id,{},templateId);
  const seed=await page.evaluate(()=>structuredClone(window.__mockupBaseline.snapshot));
  assert.ok(seed.compositionDocument.objects.some(node=>node.id==='brand-mark'));
  assert.ok(seed.compositionDocument.objects.some(node=>node.id==='cta'));
  result.metadata.template={id:templateId,testOnlyProFixture:templateId!=='editorial-honey',textCount:seed.textDocument.layers.length,decorationCount:seed.compositionDocument.decorations.length,main:seed.imageSrc||seed.canonicalImageSrc,secondary:seed.secondarySrc};
  const assets=templateId==='pocket-flow-duo'?['public/designed/examples/collection/morrow-today.svg','public/designed/examples/collection/morrow-focus.svg']:templateId==='night-signal-duo'?['public/designed/examples/collection/signal-overview.svg','public/designed/examples/collection/signal-release.svg']:['public/designed/examples/bloom-dashboard.svg','public/designed/examples/bloom-workflow.svg','public/designed/examples/bloom-workflow-card.png'];
  result.metadata.assetHashes={};for(const file of assets)result.metadata.assetHashes[file]=digest(await fs.readFile(path.join(root,file)));
  await page.evaluate(()=>{
    window.__interactionPerf={active:false,frames:[],move:[],input:[],events:[],longTasks:[],hotspots:{history:[],scene:[]}};
    let previous=0;
    requestAnimationFrame(function tick(t){const p=window.__interactionPerf;if(p.active&&p.phase==='drag'){if(previous)p.frames.push({start:previous,end:t,duration:t-previous});previous=t;}else previous=0;requestAnimationFrame(tick);});
    new PerformanceObserver(list=>{const p=window.__interactionPerf;if(p.active)p.longTasks.push(...list.getEntries().map(({startTime,duration})=>({startTime,duration})));}).observe({type:'longtask',buffered:false});
    for(const type of ['pointermove','input'])document.addEventListener(type,event=>{
      const p=window.__interactionPerf;
      if(!p.active||!event.isTrusted)return;
      if(type==='pointermove'&&(p.phase!=='drag'||!event.target.closest('[data-text-gesture]')))return;
      if(type==='input'&&(p.phase!=='input'||!event.target.matches('[aria-label="Text content"]')))return;
      const sample={type,trusted:event.isTrusted,eventTimeStamp:event.timeStamp,capture:performance.now(),phase:p.phase};
      const afterDispatch=()=>{sample.bubbleEnd=performance.now();window.removeEventListener(type,afterDispatch);};
      window.addEventListener(type,afterDispatch,{once:true});
      requestAnimationFrame(rafTime=>{sample.rafTime=rafTime;sample.rafCallback=performance.now();setTimeout(()=>{sample.nextTask=performance.now();sample.captureToRafMs=sample.rafCallback-sample.capture;sample.rafToTaskMs=sample.nextTask-sample.rafCallback;sample.latencyMs=sample.nextTask-sample.capture;(type==='input'?p.input:p.move).push(sample.latencyMs);p.events.push(sample);},0);});
    },true);
  });
  for(const scenario of scenarios)for(let run=1;run<=3;run++){
    const start=performance.now(),hashBefore=await sourceHashes();
    try{
      await page.evaluate(({seed,scenario})=>{
        const compositionDocument=structuredClone(seed.compositionDocument);
        while(compositionDocument.decorations.length<12){const index=compositionDocument.decorations.length;compositionDocument.decorations.push({id:'perf-decoration-'+index,name:'Performance decoration '+index,kind:'shape',shape:index%2?'ellipse':'rect',fill:index%2?'#e8d57c':'#fbf8eb',stroke:'#d9d1ad',frame:{centerX:.1+(index-6)*.12,centerY:.94,widthRatio:.03,heightRatio:.02,rotation:0}});}
        const layers=Array.from({length:scenario.count},(_,index)=>({id:'perf-text-'+index,content:'A'.repeat(scenario.codepoints-1)+'é',centerX:scenario.codepoints===1000?.5:.35+(index%2)*.3,centerY:.2+Math.floor(index/2)*.065,widthRatio:scenario.codepoints===1000?.8:.27,font:'manrope',fontSize:scenario.codepoints===1000?12:24,weight:700,italic:false,color:'#242313',align:'left',lineHeight:1.25}));
        compositionDocument.order=compositionDocument.order.filter(id=>!seed.textDocument.layers.some(layer=>layer.id===id)).concat(layers.map(layer=>layer.id));
        window.__mockupBaseline.apply({...seed,aspectRatioId:'custom',customCanvasSize:{...seed.customCanvasSize},compositionDocument,textDocument:{version:1,layers}});
      },{seed,scenario});
      await page.waitForFunction(count=>document.querySelectorAll('#studio-canvas [data-canvas-text]').length===count,{},scenario.count);
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#studio-canvas img')].map(async img=>{if(!img.complete)await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});if(!img.naturalWidth)throw Error('Image failed');await img.decode();}));});await paint(page);
      const fixture=await page.evaluate(()=>({dpr:devicePixelRatio,viewport:{width:innerWidth,height:innerHeight},canvas:window.__mockupBaseline.snapshot.customCanvasSize,text:window.__mockupBaseline.snapshot.textDocument.layers.map(({id,content})=>({id,codepoints:[...content].length})),decorations:document.querySelectorAll('#studio-canvas [data-composition-decoration]').length,objects:[...document.querySelectorAll('#studio-canvas [data-composition-object]')].map(node=>node.dataset.compositionObject),images:[...document.querySelectorAll('#studio-canvas img')].map(img=>({src:img.currentSrc,width:img.naturalWidth,height:img.naturalHeight})),fonts:document.fonts.status}));
      assert.deepEqual(fixture.viewport,{width:1440,height:1100});assert.equal(fixture.dpr,1);assert.deepEqual(fixture.canvas,seed.customCanvasSize);assert.equal(fixture.decorations,12);assert.equal(fixture.text.length,scenario.count);assert.ok(fixture.text.every(t=>t.codepoints===scenario.codepoints));for(const id of ['main','secondary','brand-mark','cta'])assert.ok(fixture.objects.includes(id));
      // Select through the current Inspector; the obsolete native text selector was removed in M1.
      await page.click('[aria-label="Elements"]');await page.click('[data-element-picker] button[aria-label^="Select Text:"]');await paint(page);
      const handle=await page.$('[aria-label="Move text"]'),box=await handle.boundingBox();assert.ok(box?.width&&box?.height,'Visible real drag handle');
      const before=await page.evaluate(()=>({layer:structuredClone(window.__mockupBaseline.snapshot.textDocument.layers[0]),scale:document.querySelector('[data-text-logical-overlay]').getBoundingClientRect().width/document.querySelector('[data-text-logical-overlay]').offsetWidth}));
      const x=box.x+box.width/2,y=box.y+box.height/2;
      await page.mouse.move(x,y);await page.mouse.down();
      await page.evaluate(()=>Object.assign(window.__interactionPerf,{active:true,phase:'drag',started:performance.now(),frames:[],move:[],input:[],events:[],longTasks:[],hotspots:{history:[],scene:[]}}));
      // 180 real native moves with at least one frame pacing gap: >=3 seconds uninterrupted pointer capture.
      for(let n=1;n<=180;n++){await page.mouse.move(x+Math.sin(n/20)*18+n/180*10,y+Math.cos(n/20)*10);await pause(17);}
      await page.mouse.up();await paint(page);
      const drag=await page.evaluate(()=>{const p=window.__interactionPerf;p.active=false;return {duration:performance.now()-p.started,frames:p.frames,latencies:p.move,events:p.events,longTasks:p.longTasks,hotspots:p.hotspots};});
      const afterDrag=await page.evaluate(()=>({layer:structuredClone(window.__mockupBaseline.snapshot.textDocument.layers[0]),left:parseFloat(document.querySelector('#studio-canvas [data-canvas-text]').style.left),top:parseFloat(document.querySelector('#studio-canvas [data-canvas-text]').style.top)}));
      const expected={x:before.layer.centerX*seed.customCanvasSize.width+(Math.sin(9)*18+10)/before.scale,y:before.layer.centerY*seed.customCanvasSize.height+Math.cos(9)*10/before.scale};
      const dragApplied=[Math.abs(afterDrag.layer.centerX*seed.customCanvasSize.width-expected.x),Math.abs(afterDrag.layer.centerY*seed.customCanvasSize.height-expected.y),Math.abs(afterDrag.left-expected.x),Math.abs(afterDrag.top-expected.y)].every(delta=>delta<.15);
      assert.ok(dragApplied,'Trusted drag changed document and rendered layer by actual pointer displacement');
      await page.click('[data-canvas-text-controls] [aria-label="Edit text"]');await page.focus('[aria-label="Text content"]');await page.keyboard.down('Control');await page.keyboard.press('End');await page.keyboard.up('Control');
      await page.evaluate(()=>Object.assign(window.__interactionPerf,{active:true,phase:'input',started:performance.now(),frames:[],move:[],input:[],events:[],longTasks:[],hotspots:{history:[],scene:[]}}));
      for(let n=0;n<30;n++){await page.keyboard.press('Backspace');await page.keyboard.type(n%2?'B':'A');await paint(page);}
      await paint(page);
      const input=await page.evaluate(()=>{const p=window.__interactionPerf;p.active=false;return {duration:performance.now()-p.started,latencies:p.input,events:p.events,longTasks:p.longTasks,hotspots:p.hotspots,draft:document.querySelector('[aria-label="Text content"]').value};});
      const expectedContent='A'.repeat(scenario.codepoints-1)+'B';assert.equal(input.draft,expectedContent,'Native input really changed draft');await finishTextEditing(page);await paint(page);
      const committed=await page.evaluate(()=>({document:window.__mockupBaseline.snapshot.textDocument.layers[0].content,renderer:document.querySelector('#studio-canvas [data-canvas-text]').textContent}));assert.equal(committed.document,expectedContent);assert.equal(committed.renderer,expectedContent);
      const hashAfter=await sourceHashes();
      const summary={dragFrameIntervalP95Ms:p95(drag.frames.map(f=>f.duration)),dragInputToPaintOpportunityP95Ms:p95(drag.latencies),textInputToPaintOpportunityP95Ms:p95(input.latencies),dragTrustedEvents:drag.events.length,inputTrustedEvents:input.events.length,dragRafIntervals:drag.frames.length,continuousDragMs:drag.duration,stageCaptureToRafP95Ms:p95([...drag.events,...input.events].map(e=>e.captureToRafMs)),stageRafToTaskP95Ms:p95([...drag.events,...input.events].map(e=>e.rafToTaskMs)),totalRunMs:performance.now()-start};
      const checks={dragApplied,inputDraftChanged:true,inputCommittedAndRendered:true,trusted:drag.events.concat(input.events).every(e=>e.trusted),sampleMinimums:drag.events.length>=120&&input.events.length>=50&&drag.frames.length>=120&&drag.duration>=2000,latencyBudget:summary.dragInputToPaintOpportunityP95Ms<=80&&summary.textInputToPaintOpportunityP95Ms<=80,frameBudget:summary.dragFrameIntervalP95Ms<=33.4};
      const row={scenario,run,fixture,summary,checks,passed:Object.values(checks).every(Boolean),sourceHashesBefore:hashBefore,sourceHashesAfter:hashAfter,sourceChangedDuringRun:changes(hashBefore,hashAfter),applied:{before,expected,afterDrag,committed},drag,input};
      result.rows.push(row);await page.screenshot({path:path.join(output,scenario.name+'-run-'+run+'.png')});await save();console.log(JSON.stringify({scenario:scenario.name,run,...summary,checks,sourceChangedDuringRun:row.sourceChangedDuringRun}));
    }catch(error){result.errors.push({scenario,run,message:error.message,stack:error.stack});await save();console.error(JSON.stringify({scenario:scenario.name,run,error:error.message}));}
  }
  result.metadata.sourceHashesEnd=await sourceHashes();result.metadata.changedSinceStart=changes(result.metadata.sourceHashesStart,result.metadata.sourceHashesEnd);result.metadata.finished=new Date().toISOString();result.metadata.frozenSource=result.metadata.changedSinceStart.length===0&&result.rows.every(row=>row.sourceChangedDuringRun.length===0);await save();
  const complete=result.rows.length===9&&result.errors.length===0;
  const passed=complete&&result.rows.every(row=>row.passed)&&result.metadata.frozenSource;
  console.log(JSON.stringify({output,complete,passed,frozenSource:result.metadata.frozenSource,rows:result.rows.length,errors:result.errors.length}));if(!passed)process.exitCode=1;
}catch(error){result.errors.push({message:error.message,stack:error.stack});await save();console.error(error);process.exitCode=1;}
finally{if(browser)await browser.close();if(server&&!server.killed)server.kill();}
