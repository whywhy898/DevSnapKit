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
  assert.ok(next.textDocument.layers.length>=10);assert.equal(next.compositionDocument.detailVisible,true);
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
