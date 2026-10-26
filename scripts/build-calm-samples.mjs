import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'public/designed/examples/collection'),fontPath='public/poster/fonts/manrope-latin.woff2',font=await fs.readFile(path.join(root,fontPath));
const ink='#214C43',muted='#7C8E83',accent='#7C9C88',edge='#E2E9E2',pale='#F1F5F0';
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const t=(x,y,value,size=18,weight=400,color=ink,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${escape(value)}</text>`;
const rect=(x,y,w,h,fill,rx=0,stroke)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke?` stroke="${stroke}"`:''}/>`;
const circle=(x,y,r,fill,stroke)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${stroke?` stroke="${stroke}"`:''}/>`;
const rule=(x,y,w)=>`<path d="M${x} ${y}h${w}" stroke="${edge}" fill="none"/>`;
const check=(x,y)=>`<path d="M${x} ${y}l5 5 9-11" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
const icon=(x,y,kind,color=muted)=>{const paths={note:'M4 2h13l5 5v19H4z M9 11h8 M9 16h8 M9 21h5',board:'M3 3h23v23H3z M11 3v23 M19 3v23',folder:'M2 7h10l3 4h13v15H2z',search:'M19 19l8 8 M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0'};return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="${paths[kind]}"/></g>`;};
function sidebar(active){let body=rect(0,0,150,834,'#F6F8F4')+`<path d="M150 0v834" stroke="${edge}"/>`+t(24,49,'moss',25,750,ink,'letter-spacing="-1"')+t(24,100,'STUDIO',11,650,muted,'letter-spacing="1.5"');for(const [i,[label,kind]]of [['Notes','note'],['Board','board'],['Files','folder']].entries()){const y=122+i*57;if(label===active)body+=rect(12,y,126,44,'#E5EEDF',7);body+=icon(22,y+8,kind,label===active?ink:muted)+t(60,y+29,label,16,label===active?650:450,label===active?ink:muted);}body+=rule(24,326,102)+t(24,365,'PROJECTS',10,700,muted,'letter-spacing="1.2"');for(const [i,label]of ['Product studio','Website notes','Next ideas'].entries())body+=circle(29,401+i*39,3,i===0?accent:'#BBCABC')+t(42,406+i*39,label,12,450,muted);body+=rule(24,755,102)+circle(37,789,14,'#DFEADD')+t(37,794,'A',12,650,ink,'text-anchor="middle"')+t(61,794,'Studio team',12,550);return body;}
function header(title,subtitle){return t(178,51,title,29,700,ink,'letter-spacing="-1"')+t(178,82,subtitle,13,450,muted)+rule(150,108,650);}
const shell=(label,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="834" viewBox="0 0 800 834" role="img" aria-label="${escape(label)}"><title>${escape(label)}</title><desc>Self-authored fictional product interface for illustration. All project content, names and task status are illustrative. No website capture, real customer data or third-party photography. Device chrome is rendered separately by DevSnapKit.</desc><defs><style>@font-face{font-family:CalmDemo;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900}text{font-family:CalmDemo,Arial,sans-serif}</style></defs>${rect(0,0,800,834,'#FFFFFF')}${body}</svg>`;

let notes=sidebar('Notes')+header('Project notes','Product studio / A little room for better work');
notes+=rect(176,132,598,616,'#FFFFFF',9,edge)+t(200,168,'PROJECT BRIEF',11,700,accent,'letter-spacing="1.7"');
notes+=t(200,218,'A quieter way to work.',30,750,ink,'letter-spacing="-1.2"')+t(200,258,'Make space for thoughtful work.',17,400,'#657A6D')+t(200,286,'Keep the useful details close.',17,400,'#657A6D')+rule(200,314,548);
notes+=t(200,354,'What we are making',19,650)+t(200,389,'One calm place for our next product story.',16,400,muted);
['A clear first impression','A focused product story','A launch everyone can follow'].forEach((label,i)=>{const y=433+i*44;notes+=rect(201,y-15,18,18,'none',3,'#B9CDBD');if(i<2)notes+=check(203,y-9);notes+=t(234,y,label,17,450);});
notes+=rect(200,565,548,76,pale,7)+`<path d="M216 582v42" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`+t(236,598,'Good work starts with clarity.',20,550)+t(236,622,'A shared note for the studio.',13,400,muted);
notes+=rule(200,672,548)+circle(214,710,13,'#DFEADD')+t(214,715,'A',11,650,ink,'text-anchor="middle"')+circle(237,710,13,'#E9E8DC','#FFFFFF')+t(237,715,'B',11,650,ink,'text-anchor="middle"')+t(265,715,'Shared with the studio team',13,450,muted);
notes+=t(178,790,'All changes saved',12,450,muted)+t(774,790,'Illustrative workspace',11,400,muted,'text-anchor="end"');

let board=sidebar('Board')+header('Project board','Product studio / From first thought to next step');
board+=rect(178,132,110,31,'#E5EEDF',6)+t(193,153,'Spring edition',12,650)+t(774,153,'6 tasks',12,450,muted,'text-anchor="end"');
for(const [index,[label,fill]]of [['In progress','#F5F7F2'],['Ready to share','#F0F5F0']].entries()){
 const x=178+index*308;board+=rect(x,190,288,559,fill,8)+circle(x+19,216,3,index===0?'#B7AF87':accent)+t(x+33,221,label,15,650)+t(x+267,221,'3',12,550,muted,'text-anchor="end"');
 const tasks=index===0?[['Product outline','Writing','Keep the essential ideas.'],['Interface notes','Design','Give each screen some air.'],['Final review','Planning','Check the details together.']]:[['Launch checklist','Planning','A considered first impression.'],['Design foundations','Design','A few useful shared rules.'],['Project handoff','Writing','Leave the next step clear.']];
 tasks.forEach(([title,tag,description],i)=>{const y=245+i*155;board+=rect(x+12,y,264,139,'#FFFFFF',7,edge)+rect(x+27,y+15,tag==='Design'?63:tag==='Writing'?65:72,23,index===0?'#F0F1E7':'#E8F0E3',4)+t(x+38,y+31,tag,10,550,'#758366')+t(x+27,y+68,title,18,650,ink,'letter-spacing="-.3"')+t(x+27,y+94,description,12,400,muted)+circle(x+39,y+119,10,i===1?'#E8E6DA':'#E1EBDE')+t(x+39,y+123,['A','B','C'][i],9,650,ink,'text-anchor="middle"')+t(x+259,y+123,index===0?'Draft':'Reviewed',10,450,muted,'text-anchor="end"');});
}
board+=t(178,790,'Every step, a little clearer.',12,450,muted)+t(774,790,'Illustrative workspace',11,400,muted,'text-anchor="end"');

await fs.mkdir(output,{recursive:true});const records=[];
for(const [file,title,body]of [['calm-workspace.svg','Illustrative moss project notes',notes],['calm-detail.svg','Illustrative moss project board',board]]){const bytes=Buffer.from(shell(title,body));await fs.writeFile(path.join(output,file),bytes);records.push({file,width:800,height:834,sha256:createHash('sha256').update(bytes).digest('hex')});}
await fs.writeFile(path.join(output,'calm-samples.json'),JSON.stringify({generator:'scripts/build-calm-samples.mjs',provenance:'Self-authored fictional SVG app content, no third-party website capture, photography or customer data',font:{source:fontPath,license:'Manrope-OFL.txt',sha256:createHash('sha256').update(font).digest('hex')},records},null,2));console.log(JSON.stringify({output,records}));
