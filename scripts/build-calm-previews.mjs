import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),sharp=require('sharp'),source=process.argv[2];
if(!source)throw new Error('Pass a passing real Calm export directory.');const result=JSON.parse(await fs.readFile(path.join(source,'results.json'),'utf8'));if(!result.passed)throw new Error('The source run must have passed.');
const original=await fs.readFile(path.join(source,'calm-default-duo-1x.png')),metadata=await sharp(original).metadata();if(metadata.width!==1080||metadata.height!==1080)throw new Error('Expected actual 1080-square editor PNG.');
const output=path.join(root,'public/designed/collection'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');await fs.mkdir(output,{recursive:true});const records=[];
for(const [file,width]of [['calm-split.webp',480],['calm-split-preview.webp',1080]]){const bytes=await sharp(original).resize({width}).webp({quality:92}).toBuffer();await fs.writeFile(path.join(output,file),bytes);const size=await sharp(bytes).metadata();records.push({file,width:size.width,height:size.height,sourcePng:'calm-default-duo-1x.png',sourceSha256:sha(original),sha256:sha(bytes)});}
const sourceFiles={};for(const file of ['src/templates/collection/definitions/calm-split.ts','src/templates/collection/apply.ts','src/composition/MediaShell.tsx','src/composition/CompositionRenderer.tsx','src/composition/ButtonRenderer.tsx','src/App.tsx'])sourceFiles[file]=sha(await fs.readFile(path.join(root,file)));
const assets=JSON.parse(await fs.readFile(path.join(root,'public/designed/examples/collection/calm-samples.json'),'utf8'));
await fs.writeFile(path.join(output,'calm-split-provenance.json'),JSON.stringify({templateId:'calm-split',method:'Resized from actual Free editor-triggered PNG download; native design, not imagegen output',sourceDirectory:path.resolve(source),baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeHadChanges:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),sourceFiles,sampleSources:assets.records,records},null,2));console.log(JSON.stringify({output,records}));
