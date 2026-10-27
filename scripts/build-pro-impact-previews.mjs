import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),sharp=require('sharp'),source=process.argv[2],id=process.argv[3];
const size=id==='studio-bridge'?[1920,1080]:id==='editorial-story'?[1080,1350]:null;if(!source||!size)throw new Error('Pass actual passing PNG directory and studio-bridge/editorial-story ID');
if(!JSON.parse(await fs.readFile(path.join(source,'results.json'),'utf8')).passed)throw new Error('Passing source run required');
let filename=id+'-default-duo-1x.png';try{await fs.access(path.join(source,filename));}catch{filename='impact-default-duo-1x.png';}
const original=await fs.readFile(path.join(source,filename)),m=await sharp(original).metadata();if(m.width!==size[0]||m.height!==size[1])throw new Error('Actual native PNG dimensions required');
const output=path.join(root,'public/designed/collection'),sha=b=>createHash('sha256').update(b).digest('hex'),records=[];await fs.mkdir(output,{recursive:true});
for(const [file,width]of [[id+'.webp',480],[id+'-preview.webp',size[0]]]){const bytes=await sharp(original).resize({width}).webp({quality:92}).toBuffer();await fs.writeFile(path.join(output,file),bytes);const s=await sharp(bytes).metadata();records.push({file,width:s.width,height:s.height,sourcePng:filename,sourceSha256:sha(original),sha256:sha(bytes)});}
const sourceFiles={};for(const file of ['src/templates/collection/definitions/'+id+'.ts','src/templates/collection/apply.ts','src/templates/collection/types.ts','src/composition/types.ts','src/composition/MediaShell.tsx','src/composition/CompositionRenderer.tsx','src/text/document.ts','src/App.tsx'])sourceFiles[file]=sha(await fs.readFile(path.join(root,file)));
const samples=JSON.parse(await fs.readFile(path.join(root,'public/designed/examples/collection/pro-impact-samples.json'),'utf8'));
await fs.writeFile(path.join(output,id+'-provenance.json'),JSON.stringify({templateId:id,method:'Resized from actual editor PNG download with simulated valid license; original concept is not product output',sourceDirectory:path.resolve(source),baseCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),workingTreeHadChanges:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),sourceFiles,sampleManifest:samples,records},null,2));console.log(JSON.stringify({id,output,records}));
