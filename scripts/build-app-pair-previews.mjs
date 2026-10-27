import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),sharp=require('sharp'),source=process.argv[2];
if(!source)throw new Error('Pass a passing actual App Pair PNG run.');
const result=JSON.parse(await fs.readFile(path.join(source,'results.json'),'utf8'));if(!result.passed)throw new Error('Source run must pass.');
let sourcePng='appPair-default-duo-1x.png';try{await fs.access(path.join(source,sourcePng));}catch{sourcePng='app-pair-default-duo-1x.png';}
const original=await fs.readFile(path.join(source,sourcePng)),size=await sharp(original).metadata();if(size.width!==1080||size.height!==1920)throw new Error('Actual portrait PNG required.');
const output=path.join(root,'public/designed/collection'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');await fs.mkdir(output,{recursive:true});const records=[];
for(const [file,width]of [['app-pair.webp',480],['app-pair-preview.webp',1080]]){const bytes=await sharp(original).resize({width}).webp({quality:92}).toBuffer();await fs.writeFile(path.join(output,file),bytes);const m=await sharp(bytes).metadata();records.push({file,width:m.width,height:m.height,sourcePng,sourceSha256:sha(original),sha256:sha(bytes)});}
const sourceFiles={};for(const file of ['src/templates/collection/definitions/app-pair.ts','src/templates/collection/apply.ts','src/templates/collection/types.ts','src/composition/MediaShell.tsx','src/composition/CompositionRenderer.tsx','src/App.tsx'])sourceFiles[file]=sha(await fs.readFile(path.join(root,file)));
const samples=JSON.parse(await fs.readFile(path.join(root,'public/designed/examples/collection/app-pair-samples.json'),'utf8'));
await fs.writeFile(path.join(output,'app-pair-provenance.json'),JSON.stringify({templateId:'app-pair',method:'Resized from actual Free editor PNG download; no poster CTA; not imagegen output',sourceDirectory:path.resolve(source),baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeHadChanges:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),sourceFiles,sampleSources:samples.records,records},null,2));console.log(JSON.stringify({output,records}));
