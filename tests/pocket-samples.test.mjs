import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const directory=path.resolve(import.meta.dirname,'../public/designed/examples/collection');
test('Pocket examples contain two distinct licensed app screens without baked phone hardware',()=>{
 const file=path.join(directory,'pocket-samples.json');assert.ok(fs.existsSync(file),'Pocket sample manifest exists');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(manifest.records.length,2);
 assert.equal(new Set(manifest.records.map(r=>r.sha256)).size,2);
 for(const record of manifest.records){assert.equal(record.width,396);assert.equal(record.height,810);const source=fs.readFileSync(path.join(directory,record.file),'utf8');assert.equal(createHash('sha256').update(source).digest('hex'),record.sha256);assert.ok(/Self-authored fictional/.test(source),record.file+' documents its source');assert.ok(/data:font\/woff2;base64,/.test(source),record.file+' embeds the licensed font');assert.ok(!/<script|foreignObject|<image|<filter|https?:\/\/(?!www\.w3\.org)/i.test(source),record.file+' is self-contained SVG');assert.ok(!/9:41|Find your flow|Make time|phone frame|battery|notch/i.test(source.replace(/url\(data:font[^)]*\)/g,'url(embedded-font)')),record.file+' contains app content without hardware or poster copy');}
 assert.match(fs.readFileSync(path.join(directory,manifest.font.license),'utf8'),/SIL OPEN FONT LICENSE/);
});
