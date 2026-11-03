import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..'),dir=path.join(root,'public/designed/examples/collection');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'premium-trio-samples.json'),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
test('six distinct authored samples match their declared dimensions and source hashes',()=>{
 assert.equal(manifest.records.length,6);const hashes=new Set();
 for(const record of manifest.records){
  const bytes=fs.readFileSync(path.join(dir,record.file)),svg=bytes.toString('utf8');
  assert.equal(digest(bytes),record.sha256);hashes.add(record.sha256);
  assert.match(svg,new RegExp(`width="${record.width}" height="${record.height}" viewBox="0 0 ${record.width} ${record.height}"`));
  assert.ok(fs.existsSync(path.join(root,record.source)));assert.ok(record.license);
  const markup=svg.replace(/<style>[\s\S]*?<\/style>/g,'');
  assert.doesNotMatch(markup,/<(?:script|foreignObject|image|metadata)\b|https?:\/\/(?!www\.w3\.org\/2000\/svg)|exif|xmp|c2pa/i);
  assert.doesNotMatch(svg,/data-phone-status|data-media-chrome|9:41|10:24/);
 }
 assert.equal(hashes.size,6);
});
test('journal landscapes are original vector illustrations and bundled fonts retain their licenses',()=>{
 for(const record of manifest.records.filter(x=>x.file.includes('journal'))){
  assert.match(record.illustration,/vector desert/);assert.match(record.illustration,/not a photograph/);
  assert.match(fs.readFileSync(path.join(dir,record.file),'utf8'),/<path d="M0 119/);
 }
 for(const font of manifest.fonts){
  assert.equal(digest(fs.readFileSync(path.join(root,font.source))),font.sha256);
  assert.ok(fs.existsSync(path.join(root,'public/poster/fonts',font.license)));
 }
});
test('rebuilding the samples produces identical bytes and manifest',()=>{
 const before=new Map([...manifest.records.map(x=>x.file),'premium-trio-samples.json'].map(file=>[file,digest(fs.readFileSync(path.join(dir,file)))]));
 execFileSync(process.execPath,['scripts/build-premium-trio-samples.mjs'],{cwd:root,stdio:'pipe'});
 for(const [file,expected]of before)assert.equal(digest(fs.readFileSync(path.join(dir,file))),expected,file);
});
