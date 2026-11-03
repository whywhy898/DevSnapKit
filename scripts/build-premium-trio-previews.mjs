import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),sharp=require('sharp');
const source=process.argv[2];if(!source)throw Error('Pass the actual passing browser output directory');
const results=JSON.parse(await fs.readFile(path.join(source,'results.json'),'utf8'));
if(!results.passed)throw Error('Passing actual browser run required');
const destination=path.join(root,'public/designed/collection'),hash=b=>createHash('sha256').update(b).digest('hex');
await fs.mkdir(destination,{recursive:true});
for(const c of results.templates){
 const sourceFile=path.join(source,c.id,'default-duo-1x.png'),original=await fs.readFile(sourceFile);
 const m=await sharp(original).metadata();if(m.width!==c.width||m.height!==c.height)throw Error('Incorrect native dimensions '+c.id);
 const records=[];
 for(const [name,width]of [[c.id+'.webp',480],[c.id+'-preview.webp',c.width]]){
  const bytes=await sharp(original).resize({width}).webp({quality:94}).toBuffer();await fs.writeFile(path.join(destination,name),bytes);
  const meta=await sharp(bytes).metadata();records.push({file:name,width:meta.width,height:meta.height,sha256:hash(bytes)});
 }
 const sources={};
 for(const name of ['src/templates/collection/definitions/'+c.id+'.ts','src/templates/collection/apply.ts','src/composition/CompositionRenderer.tsx','src/composition/MediaShell.tsx'])sources[name]=hash(await fs.readFile(path.join(root,name)));
 const manifest={templateId:c.id,method:'Resized from actual browser-triggered editor PNG download; simulated valid license; not a generated concept poster',sourceFile:path.resolve(sourceFile),sourceSha256:hash(original),width:c.width,height:c.height,sources,records,simulatedLicense:true,realPayment:false};
 await fs.writeFile(path.join(destination,c.id+'-provenance.json'),JSON.stringify(manifest,null,2));
 console.log(c.id+': native PNG -> thumbnail + full preview');
}
