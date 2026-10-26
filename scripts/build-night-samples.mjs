import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public/designed/examples/collection');
const fontPath = 'public/poster/fonts/manrope-latin.woff2';
const font = await fs.readFile(path.join(root, fontPath));
const ink = '#F1F3EA', muted = '#87948B', lime = '#D9F58B', edge = '#2B3831';
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const t = (x,y,value,size=18,weight=400,color=ink,extra='') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${esc(value)}</text>`;
const box = (x,y,w,h,fill,rx=0,stroke) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke ? ` stroke="${stroke}"` : ''}/>`;
const rule = (x,y,w) => `<path d="M${x} ${y}h${w}" fill="none" stroke="${edge}"/>`;
const dot = (x,y,color=lime,r=4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`;
const avatar = (x,y,label,color='#314B40') => dot(x,y,color,15)+t(x,y+5,label,12,650,ink,'text-anchor="middle"');
const check = (x,y) => `<path d="M${x} ${y}l5 5 9-11" fill="none" stroke="${lime}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
const mark = (x,y) => `<g fill="none" stroke="${lime}" stroke-width="2.3" stroke-linecap="round"><path d="M${x} ${y+15}v-4m6 7V${y+5}m6 15V${y}m6 18V${y+7}"/></g>`;
const shell = (w,h,label,body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><desc>Self-authored fictional demonstration UI. All names, dates, metrics and activity are illustrative, not customer results. Initial-letter avatars. Browser chrome is rendered separately by DevSnapKit.</desc><defs><style>@font-face{font-family:NightDemo;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900}text{font-family:NightDemo,Arial,sans-serif}</style></defs>${body}</svg>`;

let main = box(0,0,1200,670,'#14201B')+box(0,0,204,670,'#111B16');
main += `<path d="M204 0v670" stroke="${edge}"/>`+mark(25,28)+t(57,48,'signal',25,750);
main += t(24,96,'WORKSPACE',10,700,muted,'letter-spacing="1.8"');
for(const [i,label] of ['Overview','Projects','Releases','Activity','Team'].entries()) {
  const y=116+i*47;
  if(i===0)main+=box(12,y,180,40,'#25362B',7);
  main+=box(25,y+13,13,13,'none',3,i===0?lime:muted)+t(52,y+27,label,15,i===0?650:450,i===0?lime:muted);
}
main += rule(24,388,156)+t(24,424,'PINNED PROJECTS',10,700,muted,'letter-spacing="1.4"');
for(const [i,label] of ['Product studio','Website refresh','Design system'].entries())main+=dot(30,455+i*33,['#D9F58B','#C5B8D4','#8BC5B2'][i],3)+t(45,460+i*33,label,13,450,'#A7B5AA');
main += rule(24,604,156)+avatar(39,637,'J')+t(65,642,'Jamie Lee',14,550)+t(182,642,'⋮',21,500,muted);
main += t(240,37,'Workspace / Overview',13,450,muted)+t(1164,37,'Mon, 12 May',13,450,muted,'text-anchor="end"')+rule(204,62,996);
main += t(240,111,'A clear view of what’s next.',29,700)+t(240,142,'Your projects, progress and priorities in one place.',15,450,muted);
main += box(1024,93,140,39,'#25362B',6,edge)+t(1046,118,'This month',13,550,'#CAD8CE');
const stats=[['Active projects','08','2 ready for review'],['Tasks completed','124','Across your workspace'],['Team focus','86%','Illustrative sample data']];
stats.forEach(([label,value,note],i)=>{const x=240+i*315;main+=box(x,176,294,116,'#19271F',8,edge)+t(x+19,202,label,13,500,muted)+t(x+18,248,value,35,700)+t(x+19,274,note,11,450,muted);});
main += t(240,331,'Active projects',18,650)+t(1164,331,'View all projects',12,500,'#C8D8B4','text-anchor="end"')+rule(240,351,924);
main += t(256,377,'PROJECT',10,700,muted,'letter-spacing="1"')+t(650,377,'STATUS',10,700,muted,'letter-spacing="1"')+t(850,377,'PROGRESS',10,700,muted,'letter-spacing="1"')+t(1090,377,'OWNER',10,700,muted,'letter-spacing="1"');
const projects=[['Product studio','Spring release', 'In progress',72,'J'],['Website refresh','A simpler first impression','In review',90,'M'],['Design system','Shared foundations','In progress',48,'A']];
projects.forEach(([title,subtitle,status,progress,initial],i)=>{const y=414+i*74;main+=box(256,y-14,31,31,['#35462A','#384039','#30443D'][i],6)+t(272,y+7,['P','W','D'][i],13,700,lime,'text-anchor="middle"')+t(302,y,title,15,600)+t(302,y+22,subtitle,11,450,muted)+dot(659,y+3,status==='In review'?'#D9F58B':'#81B59B',3)+t(671,y+8,status,12,500,'#B9CBBE')+box(850,y,121,5,'#2E3E32',2)+box(850,y,121*progress/100,5,lime,2)+t(987,y+8,progress+'%',11,500,muted)+avatar(1112,y+3,initial);if(i<2)main+=rule(240,y+42,924);});
main += rule(240,620,924)+dot(246,644,'#81B59B',3)+t(259,648,'All changes saved',11,450,muted)+t(1164,648,'Illustrative workspace · No real customer data',10,400,muted,'text-anchor="end"');

let detail=box(0,0,600,534,'#17241D');
detail+=box(26,27,38,38,'#2D4128',8)+mark(34,35)+t(82,44,'Spring release',22,700)+t(82,66,'PRODUCT STUDIO / RELEASE 01',10,650,muted,'letter-spacing="1.2"');
detail+=rule(26,88,548)+t(26,124,'Ready when you are.',26,700)+t(26,153,'A few small steps. One thoughtful launch.',14,450,muted);
detail+=t(26,191,'RELEASE CHECKLIST',10,750,muted,'letter-spacing="1.4"')+t(574,191,'3 of 5 complete',11,550,'#C8D8B4','text-anchor="end"');
detail+=box(26,208,548,5,'#2E3E32',2)+box(26,208,329,5,lime,2);
const tasks=[['Finalize the core experience','Design',true,'J'],['Review every screen','Product',true,'M'],['Prepare release notes','Writing',true,'A'],['Run the final checks','Engineering',false,'R'],['Share it with the team','Launch',false,'J']];
tasks.forEach(([label,tag,done,initial],i)=>{const y=247+i*48;detail+=box(28,y-11,19,19,done?'#2F472D':'none',4,done?'#62864D':'#506257');if(done)detail+=check(30,y-3);detail+=t(62,y+4,label,14,done?500:600,done?'#ADBEAF':ink)+t(470,y+3,tag,10,500,muted,'text-anchor="end"')+avatar(548,y-1,initial);if(i<4)detail+=rule(62,y+23,512);});
detail+=rule(26,489,548)+dot(31,513,'#81B59B',3)+t(43,517,'Illustrative release plan',10,450,muted)+t(574,517,'signal.example',10,500,muted,'text-anchor="end"');

await fs.mkdir(out,{recursive:true});
const records=[];
for(const [file,width,height,body,label] of [
  ['signal-overview.svg',1200,670,main,'Illustrative signal workspace overview'],
  ['signal-release.svg',600,534,detail,'Illustrative signal release checklist'],
]) {
  const bytes=Buffer.from(shell(width,height,label,body));
  await fs.writeFile(path.join(out,file),bytes);
  records.push({file,width,height,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await fs.writeFile(path.join(out,'night-samples.json'),JSON.stringify({generator:'scripts/build-night-samples.mjs',provenance:'Self-authored fictional SVG UI; no website capture, third-party photography or customer data',font:{source:fontPath,license:'Manrope-OFL.txt',sha256:createHash('sha256').update(font).digest('hex')},records},null,2));
console.log(JSON.stringify({output:out,records}));
