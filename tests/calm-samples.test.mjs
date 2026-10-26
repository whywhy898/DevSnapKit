import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const directory=path.resolve(import.meta.dirname,'../public/designed/examples/collection');
test('Calm examples are distinct licensed notes and board screens without baked browser chrome',()=>{
 const file=path.join(directory,'calm-samples.json');assert.ok(fs.existsSync(file),'Calm sample manifest exists');const manifest=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(manifest.records.length,2);assert.equal(new Set(manifest.records.map(r=>r.sha256)).size,2);
 for(const record of manifest.records){assert.equal(record.width,800);assert.equal(record.height,834);const source=fs.readFileSync(path.join(directory,record.file),'utf8');assert.equal(createHash('sha256').update(source).digest('hex'),record.sha256);assert.ok(source.includes('#7C9C88'),record.file+' uses the specified teal accent');assert.ok(/Self-authored fictional/.test(source),record.file+' source description');assert.ok(/data:font\/woff2;base64,/.test(source),record.file+' font embedded');assert.ok(!/<script|foreignObject|<image|<filter|https?:\/\/(?!www\.w3\.org)/i.test(source),record.file+' self-contained native SVG');assert.ok(!/Explore moss|Two views\.|One clear story\.|data-media-chrome/i.test(source.replace(/url\(data:font[^)]*\)/g,'url(embedded-font)')),record.file+' contains only app content');}
 assert.match(fs.readFileSync(path.join(directory,manifest.font.license),'utf8'),/SIL OPEN FONT LICENSE/);
});
