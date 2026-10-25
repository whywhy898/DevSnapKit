import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const { nearestTextHit }=createTypeScriptLoader(fileURLToPath(new URL('../src/',import.meta.url)))('text/hitTesting.ts');
test('padded neighboring text targets select the closest actual text, not the last padded layer',()=>{
  const a={id:'heading',rect:{left:0,top:20,right:200,bottom:30}},b={id:'eyebrow',rect:{left:0,top:3,right:200,bottom:11}};
  assert.equal(nearestTextHit([a,b],60,8),'eyebrow');assert.equal(nearestTextHit([a,b],60,26),'heading');assert.equal(nearestTextHit([a,b],60,13),'eyebrow');
});
test('actual overlapping text retains front-to-back order and no candidates returns undefined',()=>{
  const rect={left:0,top:0,right:100,bottom:20};assert.equal(nearestTextHit([{id:'front',rect},{id:'back',rect}],30,10),'front');assert.equal(nearestTextHit([],30,10),undefined);
});
