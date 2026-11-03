import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const root=path.resolve(import.meta.dirname,'..');
const source=process.argv[2];
if(!source)throw Error('Pass a completed native NEXT browser output directory');
const results=JSON.parse(await fs.readFile(path.join(source,'results.json'),'utf8'));
if(!results.passed)throw Error('Passing browser verification required');
const file=path.resolve(source,'default-duo-1x.png');
const original=await fs.readFile(file),meta=await sharp(original).metadata();
if(meta.width!==1080||meta.height!==1920)throw Error('NEXT native export must be1080x1920');
const hash=b=>createHash('sha256').update(b).digest('hex');
const destination=path.join(root,'public/designed/collection');
const records=[];
for(const [name,width]of [['next-stage.webp',480],['next-stage-preview.webp',1080]]){
 const bytes=await sharp(original).resize({width}).webp({quality:94}).toBuffer();
 const m=await sharp(bytes).metadata();
 if(m.exif||m.xmp||m.icc)throw Error('Unexpected embedded metadata');
 await fs.writeFile(path.join(destination,name),bytes);
 records.push({file:name,width:m.width,height:m.height,sha256:hash(bytes)});
}
const sources={};
for(const name of ['src/templates/collection/definitions/next-stage.ts','src/templates/collection/apply.ts','src/composition/CompositionRenderer.tsx','src/composition/MediaShell.tsx'])sources[name]=hash(await fs.readFile(path.join(root,name)));
await fs.writeFile(path.join(destination,'next-stage-provenance.json'),JSON.stringify({templateId:'next-stage',method:'Resized from actual browser-triggered editor PNG download; simulated valid license',sourceFile:file,sourceSha256:hash(original),width:1080,height:1920,sources,records,simulatedLicense:true,realPayment:false},null,2)+'\n');
console.log('NEXT native PNG ->480px thumbnail and1080px preview; metadata absent');
