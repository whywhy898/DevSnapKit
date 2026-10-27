import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const directory=path.resolve(import.meta.dirname,'../public/designed/examples/collection');
test('App Pair provides two original licensed reading screens with separate hardware-free sources',()=>{
 const file=path.join(directory,'app-pair-samples.json');
 assert.ok(fs.existsSync(file),'App Pair sample manifest exists');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(manifest.generator,'scripts/build-app-pair-samples.mjs');
 assert.match(manifest.provenance,/Self-authored fictional/);
 assert.deepEqual(manifest.records.map(record=>record.file),['shelf-library.svg','shelf-notes.svg']);
 assert.equal(new Set(manifest.records.map(record=>record.sha256)).size,2);
 const screens=[];
 for(const record of manifest.records){
  assert.equal(record.width,396);assert.equal(record.height,858);
  const source=fs.readFileSync(path.join(directory,record.file),'utf8');screens.push(source);
  assert.equal(createHash('sha256').update(source).digest('hex'),record.sha256);
  assert.match(source,/width="396" height="858" viewBox="0 0 396 858"/);
  assert.match(source,/Self-authored fictional/);
  assert.match(source,/data:font\/woff2;base64,/);
  assert.ok(!/<script|foreignObject|<image|<filter|linearGradient|radialGradient|https?:\/\/(?!www\.w3\.org)/i.test(source),'self-contained flat vector UI');
  const readable=source.replace(/url\(data:font[^)]*\)/g,'url(embedded-font)');
  assert.ok(!/9:41|battery|notch|Good ideas|kept close|A HOME FOR WHAT YOU READ|shelf\.example/i.test(readable),'no baked hardware or external poster copy');
  assert.match(readable,/#203B59/);assert.match(readable,/#557DA7/);
 }
 for(const title of ['Your library','The art of noticing','A slower kind of work','Notes on everyday things']) assert.ok(screens[0].includes(title),title);
 for(const color of ['#A8C8E5','#EDC5A3','#F4E5C5']) assert.ok(screens[0].includes(color),color);
 for(const label of ['Reading notes','Book summary','A thought to keep','A small practice','Add a note']) assert.ok(screens[1].includes(label),label);
 const font=fs.readFileSync(path.resolve(import.meta.dirname,'..',manifest.font.source));
 assert.equal(createHash('sha256').update(font).digest('hex'),manifest.font.sha256);
 assert.match(fs.readFileSync(path.join(directory,manifest.font.license),'utf8'),/SIL OPEN FONT LICENSE/);
});
