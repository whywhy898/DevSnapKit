import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'package.json'));
const out=path.join(root,'public/designed/examples/collection');
const fontPath='public/poster/fonts/manrope-latin.woff2';
const font=await fs.readFile(path.join(root,fontPath));
const license=path.join(path.dirname(require.resolve('@fontsource-variable/manrope/package.json')),'LICENSE');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text=(x,y,value,size=18,weight=400,color='#292c26',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${escape(value)}</text>`;
const rect=(x,y,w,h,fill,rx=0,stroke)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke?` stroke="${stroke}"`:''}/>`;
const line=(x1,y1,x2,y2,color='#e9e9e4')=>`<path d="M${x1} ${y1}H${x2}" fill="none" stroke="${color}"/>`;
const orbit=(x,y,r=14)=>`<g><circle cx="${x}" cy="${y}" r="${r}" fill="#20241d"/><path d="M${x+3} ${y-r+1}a${r-1} ${r-1} 0 0 1 0 ${2*r-2}" fill="none" stroke="#fff" stroke-width="2"/><circle cx="${x+4}" cy="${y}" r="${r}" fill="none" stroke="#20241d" stroke-width="1"/></g>`;
const avatar=(x,y,label,fill='#ebe7f0',r=16)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="2"/>${text(x,y+5,label,13,600,'#35322f','text-anchor="middle"')}`;
const icon=(x,y,kind,color='#35382f',scale=1)=>{
 const symbols={home:'M2 10L12 2l10 8v12h-7v-8H9v8H2z',folder:'M2 6h7l3 3h10v12H2z',note:'M4 2h12l5 5v16H4z M8 10h9 M8 14h9 M8 18h6',tasks:'M3 3h19v19H3z M7 12l4 4 7-9',inbox:'M3 7h18l2 13H1z M2 15h6l2 3h4l2-3h6',search:'M16 16l7 7 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',settings:'M12 4l2-3 4 2v4l4 2v5l-4 2v4l-4 2-2-3-4 1-3-3 1-4-3-2 1-4 4-1 1-4z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',bell:'M5 16V9a7 7 0 0 1 14 0v7l3 3H2z M9 22h6',leaf:'M5 21c0-9 4-16 15-18 1 10-5 17-15 18z M4 22L15 10',code:'M9 5L2 12l7 7 M17 5l7 7-7 7 M15 2l-4 20'};
 return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${symbols[kind]}"/></g>`;
};
const shell=(w,h,title,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title><desc>Self-authored fictional demonstration interface. Initial-letter avatars only. No actual customers, endorsements or business results. Browser chrome is rendered separately by DevSnapKit.</desc><defs><style>@font-face{font-family:PaperDemo;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900;font-style:normal}text{font-family:PaperDemo,Arial,sans-serif}</style></defs>${body}</svg>`;

let main=rect(0,0,1000,668,'#ffffff')+rect(0,0,190,668,'#fbfbf8');
main+=`<path d="M190 0v668" stroke="#e8e9e4"/>`;
main+=orbit(37,39,13)+text(61,46,'folio',27,750);
for(const [index,[label,kind]]of [['Home','home'],['Projects','folder'],['Notes','note'],['Tasks','tasks'],['Inbox','inbox']].entries()){
 const top=101+index*52;
 if(!index)main+=rect(10,top,168,44,'#eef5d8',9);
 main+=icon(24,top+10,kind,!index?'#6f8b21':'#363b31',.85)+text(58,top+29,label,19,500);
}
main+=line(20,397,170,397)+icon(24,430,'search','#40443b',.85)+text(58,449,'Search',18,500)+icon(24,482,'settings','#40443b',.85)+text(58,501,'Settings',18,500);
main+=rect(220,17,526,44,'#fafaf8',9,'#e8e8e3')+icon(237,29,'search','#94978d',.7)+text(266,45,'Search anything...',16,400,'#8c9086');
main+=icon(824,27,'bell','#74796e',.85)+avatar(924,40,'J','#e9e5ef',19)+`<path d="M962 37l5 5 5-5" fill="none" stroke="#74796e" stroke-width="2"/>`;
main+=text(220,132,'Your workspace',38,750)+text(220,167,'Turn ideas into progress, together.',19,400,'#8c9184');
main+=rect(808,106,164,48,'#eaf3ca',10)+text(830,137,'+',27,500)+text(858,136,'New project',16,600);
main+=rect(220,204,116,35,'#eff5dd',7)+text(240,228,'All projects',16,600)+text(365,228,'Active',16,500,'#7d8278')+text(441,228,'Archived',16,500,'#7d8278')+text(845,228,'Sort: Recent',14,400,'#7d8278');
const projects=[
 ['Website Redesign','A cleaner, calmer home for your ideas.','leaf','#f0f7df','#789921',['J','M','R'],'Updated 2h ago'],
 ['Content Library','Notes, drafts and resources in one place.','note','#faf3e5','#8b6e31',['A','K','+1'],'Updated 1d ago'],
 ['Product Roadmap',"From ideas to what’s next.",'code','#f0e9fb','#66537c',['T','S','L'],'Updated 3d ago'],
];
projects.forEach(([title,subtitle,kind,bg,color,letters,updated],i)=>{
 const y=262+i*119;
 main+=rect(220,y,752,104,'#fff',12,'#e8e9e4')+rect(237,y+28,48,48,bg,11)+icon(249,y+40,kind,color,.95);
 main+=text(305,y+44,title,20,700)+text(305,y+72,subtitle,14,400,'#90958a');
 letters.forEach((letter,j)=>main+=avatar(704+j*23,y+48,letter,['#efe8d8','#e7e2ed','#e9e6ed'][j],16));
 for(let n=0;n<5;n++)main+=rect(807+n*9,y+63-[12,25,33,20,15][n],5,[12,25,33,20,15][n],n%2?'#d2e7a0':'#e1edbd',1);
 main+=text(862,y+53,updated,11,400,'#92988b');main+=text(960,y+56,'···',18,700,'#777c72','text-anchor="end"');
});

let detail=rect(0,0,480,318,'#fff');
detail+=`<path d="M25 39l-7 7 7 7" fill="none" stroke="#40463a" stroke-width="2" stroke-linecap="round"/>`;
detail+=rect(47,26,40,40,'#edf5d7',9)+icon(56,35,'leaf','#799c21',.85)+text(101,43,'Website redesign',22,700)+text(101,65,'A cleaner, calmer home for your ideas.',12,400,'#9a9e92')+text(445,45,'···',25,700,'#7e8376');
detail+=rect(24,92,65,30,'#eff5dc',6)+text(37,113,'Tasks',14,650)+text(113,113,'Notes',14,400,'#888f81')+text(180,113,'Files',14,400,'#888f81')+text(280,112,'2 / 3',12,500,'#8f9686');
detail+=rect(324,104,110,6,'#e9ece2',3)+rect(324,104,73,6,'#839f34',3)+line(24,136,456,136);
['Design new homepage','Build component library','Launch and iterate'].forEach((label,i)=>{
 const y=165+i*55;
 detail+=rect(25,y-14,22,22,i<2?'#8cae36':'#fff',4,i<2?'#8cae36':'#9ca48f');
 if(i<2)detail+=`<path d="M30 ${y-3}l5 5 8-10" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
 detail+=text(62,y+3,label,15,500)+avatar(399,y-2,['J','M','R'][i],'#e9e5ed',17)+text(442,y+5,'⋮',22,700,'#8b9282');
 if(i<2)detail+=line(24,y+26,456,y+26,'#f0f1eb');
});

await fs.mkdir(out,{recursive:true});
const records=[];
for(const [file,width,height,body,title]of [
 ['folio-workspace.svg',1000,668,main,'Illustrative folio workspace overview'],
 ['folio-task-detail.svg',480,318,detail,'Illustrative folio task detail'],
]){const bytes=Buffer.from(shell(width,height,title,body));await fs.writeFile(path.join(out,file),bytes);records.push({file,width,height,sha256:createHash('sha256').update(bytes).digest('hex')});}
await fs.copyFile(license,path.join(out,'Manrope-OFL.txt'));
await fs.writeFile(path.join(out,'paper-samples.json'),JSON.stringify({generator:'scripts/build-paper-samples.mjs',provenance:'Self-authored SVG illustration of fictional UI; no website capture or third-party photography',font:{source:fontPath,license:'Manrope-OFL.txt',sha256:createHash('sha256').update(font).digest('hex')},records},null,2));
console.log(JSON.stringify({output:out,records}));
