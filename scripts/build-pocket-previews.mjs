import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),sharp=require('sharp');
const source=process.argv[2];if(!source)throw new Error('Pass a passing real Pocket browser-export directory.');
const results=JSON.parse(await fs.readFile(path.join(source,'results.json'),'utf8'));if(!results.passed)throw new Error('The source export run must have passed.');
const original=await fs.readFile(path.join(source,'pocket-default-duo-1x.png')),meta=await sharp(original).metadata();if(meta.width!==1080||meta.height!==1920)throw new Error('Expected an actual 1080x1920 editor download.');
const output=path.join(root,'public/designed/collection'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');await fs.mkdir(output,{recursive:true});const records=[];
for(const [file,width]of [['pocket-flow-duo.webp',480],['pocket-flow-duo-preview.webp',1080]]){const bytes=await sharp(original).resize({width}).webp({quality:92}).toBuffer();await fs.writeFile(path.join(output,file),bytes);const dimensions=await sharp(bytes).metadata();records.push({file,width:dimensions.width,height:dimensions.height,sourcePng:'pocket-default-duo-1x.png',sourceSha256:sha(original),sha256:sha(bytes)});}
const sourceFiles={};for(const file of ['src/templates/collection/definitions/pocket-flow-duo.ts','src/templates/collection/apply.ts','src/composition/MediaShell.tsx','src/composition/CompositionRenderer.tsx','src/composition/ButtonRenderer.tsx','src/composition/types.ts','src/App.tsx'])sourceFiles[file]=sha(await fs.readFile(path.join(root,file)));
const samples=JSON.parse(await fs.readFile(path.join(root,'public/designed/examples/collection/pocket-samples.json'),'utf8'));
await fs.writeFile(path.join(output,'pocket-flow-provenance.json'),JSON.stringify({templateId:'pocket-flow-duo',method:'Resized from actual browser-triggered editor PNG downloads, not imagegen output',sourceDirectory:path.resolve(source),baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeHadChanges:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),sourceFiles,sampleSources:samples.records,records},null,2));console.log(JSON.stringify({output,records}));
