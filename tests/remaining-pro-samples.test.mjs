import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
test('remaining Pro examples are eight original independently replaceable chrome-free UI images with traceable sources',()=>{
 const dir=path.join(root,'public/designed/examples/collection');
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'remaining-pro-samples.json'),'utf8'));
 assert.equal(manifest.samples.length,8);const hashes=new Set();
 for(const item of manifest.samples){
  const bytes=fs.readFileSync(path.join(dir,item.file));
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);hashes.add(item.sha256);
  assert.equal(bytes.readUInt32BE(16),item.width);assert.equal(bytes.readUInt32BE(20),item.height);
  assert.equal(item.chromeIncluded,false);assert.equal(item.sourceKind,'original native UI rendered to PNG');assert.equal(item.uiTypographyMatched,true);
  assert.ok(item.width>500&&item.height>300);
  const source=fs.readFileSync(path.join(root,item.source));assert.equal(createHash('sha256').update(source).digest('hex'),item.sourceSHA256);
  assert.ok(item.fonts.every(f=>/SIL OPEN FONT LICENSE/i.test(fs.readFileSync(path.join(root,f.license),'utf8'))));
 }
 assert.equal(hashes.size,8);
});
