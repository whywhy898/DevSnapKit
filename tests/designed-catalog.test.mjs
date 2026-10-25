import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)));
const file=new URL('../src/composition/designedCatalog.ts',import.meta.url);
const api=fs.existsSync(file)?load('composition/designedCatalog.ts'):{};
const user={imageSrc:'user-main.png',imageName:'mine.png',windowTitle:'My page',primaryMediaOrigin:{kind:'user'},secondarySrc:'user-detail.png',secondaryName:'detail.png',secondaryMediaOrigin:{kind:'user'},textDocument:{version:1,layers:[]},layoutMode:'duo',customBrandWatermark:'Own brand',logoDataUrl:null};
test('Honey descriptor contains a complete neutral composition and preserves both user screenshots',()=>{
  assert.equal(typeof api.buildDesignedSnapshot,'function','designed template catalog is not implemented');
  const next=api.buildDesignedSnapshot(user,'editorial-honey','test');
  assert.equal(next.imageSrc,user.imageSrc);assert.equal(next.secondarySrc,user.secondarySrc);assert.equal(next.windowTitle,'My page');
  assert.equal(next.aspectRatioId,'custom');assert.deepEqual(JSON.parse(JSON.stringify(next.customCanvasSize)),{width:1600,height:1200});
  // Three card labels are baked into screenshot 2; eight poster roles remain editable.
  assert.equal(next.textDocument.layers.length,8);assert.equal(next.compositionDocument.detailVisible,true);
  assert.ok(next.compositionDocument.objects.some(n=>n.kind==='button'));assert.ok(next.compositionDocument.decorations.length>=3);
  assert.match(next.textDocument.layers.find(n=>n.id==='test-brand').content,/Bloom/);
});
test('empty/builtin slots load neutral examples, unknown second-image provenance is preserved',()=>{
  assert.equal(typeof api.buildDesignedSnapshot,'function');
  const empty=api.buildDesignedSnapshot({...user,imageSrc:'builtin.svg',primaryMediaOrigin:{kind:'builtin',sampleId:'saas'},windowTitle:'dashboard.analytics — PulseSaaS',secondarySrc:null},'editorial-honey','a');
  assert.match(empty.imageSrc,/bloom-dashboard/);assert.match(empty.secondarySrc,/bloom-workflow/);
  const unknown=api.buildDesignedSnapshot({...user,secondaryMediaOrigin:undefined},'editorial-honey','b');assert.equal(unknown.secondarySrc,user.secondarySrc);
  assert.doesNotMatch(JSON.stringify(empty),/HoneyWeRank|honeywerank|Spotfight|spotfight/);
});
test('designed template preserves a custom or deliberately empty title even when replacing a builtin sample',()=>{
  for(const title of ['My own title',''])assert.equal(api.buildDesignedSnapshot({...user,primaryMediaOrigin:{kind:'builtin',sampleId:'saas'},windowTitle:title},'editorial-honey','t').windowTitle,title);
});
test('reset styling and restore layout preserve user content, user objects and deleted template objects',()=>{
  assert.equal(typeof api.resetDesignedStyles,'function','designed styling reset is not implemented');
  assert.equal(typeof api.restoreDesignedLayout,'function','designed layout restore is not implemented');
  const d=api.buildDesignedSnapshot(user,'editorial-honey','t');d.compositionDocument.objects=d.compositionDocument.objects.filter(n=>n.id!=='brand-mark');
  const cta=d.compositionDocument.objects.find(n=>n.id==='cta');cta.fill='#ff0000';cta.text='My label';cta.frame.centerX=.4;
  d.compositionDocument.placements.main.centerX=.7;
  const reset=api.resetDesignedStyles(d);assert.equal(reset.compositionDocument.objects.find(n=>n.id==='cta').text,'My label');assert.equal(reset.compositionDocument.objects.find(n=>n.id==='cta').fill,'#272617');assert.equal(reset.compositionDocument.objects.find(n=>n.id==='cta').frame.centerX,.4);assert.equal(reset.compositionDocument.objects.some(n=>n.id==='brand-mark'),false);
  assert.deepEqual(JSON.parse(JSON.stringify(reset.textDocument)),JSON.parse(JSON.stringify(d.textDocument)));
  d.compositionDocument.mediaLayout='legacy';
  d.textDocument.layers.push({...d.textDocument.layers[0],id:'user-added-brand',centerX:.9});
  const restored=api.restoreDesignedLayout(d);assert.equal(restored.compositionDocument.mediaLayout,'independent');assert.equal(restored.compositionDocument.objects.find(n=>n.id==='cta').fill,'#ff0000');assert.equal(restored.compositionDocument.objects.find(n=>n.id==='cta').text,'My label');assert.equal(restored.imageSrc,user.imageSrc);assert.equal(restored.compositionDocument.objects.some(n=>n.id==='brand-mark'),false);
  assert.equal(restored.textDocument.layers.find(n=>n.id==='user-added-brand').centerX,.9,'user-added object with a similar suffix is not a template role');
  assert.equal(d.compositionDocument.placements.main.centerX,.7,'restore does not mutate before');assert.notEqual(restored.compositionDocument.placements.main.centerX,.7);
});
