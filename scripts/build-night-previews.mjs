import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),sharp=require('sharp');
const source=process.argv[2];
if(!source)throw new Error('Pass the directory containing actual night-default-duo/single-1x.png editor downloads.');
const output=path.join(root,'public/designed/collection'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const results=JSON.parse(await fs.readFile(path.join(source,'results.json'),'utf8'));
if(!results.passed)throw new Error('Use a completed, passing real-browser export run.');
const records=[];await fs.mkdir(output,{recursive:true});
for(const [input,file,width]of [['night-default-duo-1x.png','night-signal-duo.webp',480],['night-default-duo-1x.png','night-signal-duo-preview.webp',1600],['night-default-single-1x.png','night-signal-single-preview.webp',1600]]){
 const original=await fs.readFile(path.join(source,input)),meta=await sharp(original).metadata();
 if(meta.width!==1600||meta.height!==1200)throw new Error('Expected a real 1600x1200 export.');
 const bytes=await sharp(original).resize({width}).webp({quality:92}).toBuffer();await fs.writeFile(path.join(output,file),bytes);const actual=await sharp(bytes).metadata();
 records.push({file,width:actual.width,height:actual.height,sourcePng:input,sourceSha256:sha(original),sha256:sha(bytes)});
}
const sourceFiles={};
for(const file of ['src/templates/collection/definitions/night-signal-duo.ts','src/templates/collection/apply.ts','src/composition/DecorationRenderer.tsx','src/composition/MediaShell.tsx','src/composition/CompositionRenderer.tsx','src/composition/ButtonRenderer.tsx','src/composition/types.ts','src/App.tsx'])sourceFiles[file]=sha(await fs.readFile(path.join(root,file)));
const samples=JSON.parse(await fs.readFile(path.join(root,'public/designed/examples/collection/night-samples.json'),'utf8'));
await fs.writeFile(path.join(output,'night-signal-provenance.json'),JSON.stringify({templateId:'night-signal-duo',method:'Resized from real browser-triggered PNG downloads, not imagegen output',sourceDirectory:path.resolve(source),baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeHadChanges:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),sourceFiles,sampleSources:samples.records,records},null,2));
console.log(JSON.stringify({output,records}));
