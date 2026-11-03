import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Original fictional interfaces. No screenshots, external artwork or device chrome.
const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'public/designed/examples/collection');
const fonts=await Promise.all(['manrope-latin.woff2','Gelasio.ttf'].map(async file=>({file,bytes:await fs.readFile(path.join(root,'public/poster/fonts',file))})));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const t=(x,y,value,size=16,weight=400,color='#151429',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${esc(value)}</text>`;
const r=(x,y,w,h,color,rx=0,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${color}" ${extra}/>`;
const c=(x,y,radius,color)=>`<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}"/>`;
const line=(x,y,w,color='#DDD9E9')=>`<path d="M${x} ${y}h${w}" stroke="${color}" fill="none"/>`;
const icon=(x,y,kind,color='#80768F',scale=1)=>{
 const paths={grid:'M1 1h8v8H1z M14 1h8v8h-8z M1 14h8v8H1z M14 14h8v8h-8z',search:'M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0 M16 16l7 7',layers:'M1 7l11-6 11 6-11 6z M1 12l11 6 11-6 M1 17l11 6 11-6',plus:'M12 2v20 M2 12h20',folder:'M1 5h8l3 4h11v13H1z',user:'M17 6a5 5 0 1 0-10 0 5 5 0 0 0 10 0 M2 23v-3a10 10 0 0 1 20 0v3',activity:'M1 13h5l4-10 5 19 4-9h5',home:'M1 10l11-9 11 9 M5 9v14h14V9 M10 23v-8h5v8',menu:'M2 5h20 M2 12h20 M2 19h20'};
 return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[kind]}"/></g>`;
};
const abstract=(x,y,w,h,variant=0)=>`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice"><rect width="400" height="240" fill="url(#purple${variant%2})"/><ellipse cx="${100+variant*30}" cy="220" rx="235" ry="165" fill="url(#silk)" transform="rotate(-24 100 220)"/><ellipse cx="355" cy="100" rx="145" ry="230" fill="url(#petal)" transform="rotate(32 355 100)"/><path d="M0 180Q150 80 290 240H0" fill="#9D36F0" opacity=".45"/></svg>`;
const defs=`<linearGradient id="purple0" x2="1" y2="1"><stop stop-color="#5B17B6"/><stop offset="1" stop-color="#200A57"/></linearGradient><linearGradient id="purple1" x2="1" y2="1"><stop stop-color="#B35CF0"/><stop offset="1" stop-color="#4D14B3"/></linearGradient><linearGradient id="silk" x2=".7" y2="1"><stop stop-color="#D091FF"/><stop offset=".52" stop-color="#982CE8"/><stop offset="1" stop-color="#3E0F8E"/></linearGradient><linearGradient id="petal" x2="1" y2="1"><stop stop-color="#F0BEFF"/><stop offset=".6" stop-color="#B443ED"/><stop offset="1" stop-color="#6425BD"/></linearGradient><linearGradient id="chart" x2="0" y2="1"><stop stop-color="#0DD7E6" stop-opacity=".38"/><stop offset="1" stop-color="#0DD7E6" stop-opacity="0"/></linearGradient>`;
const shell=(width,height,label,bg,body,serif=false)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><desc>Original fictional ${serif?'journal interface with a self-authored vector desert illustration':'product interface'}. No customer data, website capture or third-party photos. Device and browser chrome are supplied separately by DevSnapKit.</desc><defs><style>@font-face{font-family:TrioSans;src:url(data:font/woff2;base64,${fonts[0].bytes.toString('base64')}) format('woff2');font-weight:100 900}@font-face{font-family:TrioSerif;src:url(data:font/ttf;base64,${fonts[1].bytes.toString('base64')}) format('truetype');font-weight:400 700}text{font-family:${serif?'TrioSerif,Georgia,serif':'TrioSans,Arial,sans-serif'}}</style>${defs}</defs>${r(0,0,width,height,bg)}${body}</svg>`;

const studioHeader=(dark=false)=>{
 const ink=dark?'#FFFFFF':'#171326';
 return r(24,20,32,32,'#A45BEF',9)+icon(30,26,'layers',dark?'#E3CDFF':'#6324AC',.8)+t(66,43,'Sample studio',20,800,ink,'letter-spacing="-.5"')+icon(313,24,'search',ink,.8)+t(365,43,'···',24,700,ink);
};
const studioNav=(active,dark=false)=>line(24,649,348,dark?'#342545':'#E5E1EC')+[['Library','grid'],['Create','plus'],['Projects','folder'],['Profile','user']].map(([label,kind],i)=>{
 const x=48+i*97,color=active===label?'#963BF0':dark?'#B7A4CE':'#777087';
 return icon(x-7,668,kind,color,.85)+t(x+3,710,label,10.5,active===label?750:500,color,'text-anchor="middle"');
}).join('');
let library=studioHeader()+t(24,104,'Image library',32,800,'#171326','letter-spacing="-1.4"')+t(24,132,'42 items · 12.4 MB',14,500,'#777087');
library+=[['All',24,50],['Images',82,78],['Illustrations',168,114],['Assets',290,82]].map(([label,x,w],i)=>r(x,151,w,34,i===0?'#DBB4FB':'#F0ECF8',17)+t(x+w/2,173,label,12,600,i===0?'#5825A2':'#655B7A','text-anchor="middle"')).join('');
const assets=[['Launch cover.jpg','1920 × 1080 · 1.8 MB'],['Hero abstract.png','1440 × 1024 · 1.2 MB'],['Background.jpg','2560 × 1440 · 3.6 MB'],['Pattern.png','1024 × 1024 · 0.9 MB']];
assets.forEach(([label,detail],i)=>{const y=211+i*104;library+=abstract(24,y,118,78,i)+t(158,y+26,label,15,750,'#171326','letter-spacing="-.4"')+t(158,y+50,detail,11.5,450,'#777087')+t(358,y+24,'···',20,700,'#777087')+line(24,y+91,348);});
library+=studioNav('Library');
let detail=studioHeader(true)+abstract(24,91,348,225)+t(24,358,'Launch visual',29,750,'#FFFFFF','letter-spacing="-.8"')+t(24,386,'1920 × 1080 · 3.6 MB',14,400,'#B5A7CA')+line(24,411,348,'#342545')+t(24,447,'Layers',17,750,'#FFFFFF')+t(372,447,'4 layers',12,400,'#A792C0','text-anchor="end"');
[['Overlay','#76469B'],['Shape','#AF4DF0'],['Gradient','#6823C2'],['Background','#190C30']].forEach(([label,color],i)=>{const y=467+i*42;detail+=icon(25,y+9,'layers','#B6A4CB',.6)+r(56,y,28,28,color,5)+t(98,y+20,label,14,500,'#F6F1FF')+line(337,y+10,18,'#A792C0')+line(337,y+15,18,'#A792C0')+line(337,y+20,18,'#A792C0');});
detail+=studioNav('Projects',true);

const ink='#F3F6FC',muted='#8E9BB1',panel='#151F30',edge='#273247';
const chart=(x,y,w,h)=>{
 const pts=[[0,.83],[.08,.7],[.16,.74],[.24,.5],[.32,.57],[.4,.36],[.48,.45],[.56,.3],[.64,.39],[.72,.15],[.8,.23],[.9,.09],[1,0]].map(([a,b])=>[x+a*w,y+b*h]);
 const d='M'+pts.map(p=>p.join(' ')).join('L');
 return [0,.25,.5,.75,1].map(a=>line(x,y+a*h,w,edge)).join('')+`<path d="${d}L${x+w} ${y+h}H${x}Z" fill="url(#chart)"/><path d="${d}" fill="none" stroke="#20E5EA" stroke-width="4" stroke-linejoin="round"/>`+c(x+w,y,5,'#B9FFFF');
};
let workspace=r(0,0,235,744,'#0B1422')+r(27,28,32,32,'#165DFA',8)+icon(33,34,'layers','#C4EBFF',.8)+t(70,50,'Sample workspace',17,750,ink);
[['Overview','home'],['Projects','layers'],['Activity','activity'],['Team','user'],['Settings','grid']].forEach(([label,kind],i)=>{const y=109+i*53;workspace+=(i===0?r(17,y-28,201,43,'#203862',8):'')+icon(33,y-16,kind,i===0?'#48F2F4':muted,.8)+t(68,y,label,15,i===0?700:450,ink);});
workspace+=t(28,700,'workspace.example',12,400,muted)+c(33,643,15,'#395671')+t(33,648,'A',13,700,'#E7F2FF','text-anchor="middle"')+t(57,649,'Alex Morgan',12,550,ink);
workspace+=t(266,54,'Overview',32,750,ink,'letter-spacing="-.9"')+t(266,81,'Your product at a glance.',15,400,muted)+r(958,26,174,38,panel,19)+t(1045,51,'Last 30 days',13,600,ink,'text-anchor="middle"');
[['Active users','24,891','+18.4%'],['Total events','1,062,340','+27.1%']].forEach(([label,value,growth],i)=>{const x=266+i*443;workspace+=r(x,111,423,109,panel,13)+r(x+18,132,58,58,'#253248',9)+icon(x+34,149,i?'activity':'user','#B4C2DA',1)+t(x+94,143,label,14,450,muted)+t(x+94,183,value,29,750,ink)+t(x+405,181,growth,15,650,'#15DFC3','text-anchor="end"');});
workspace+=r(266,241,866,279,panel,13)+t(286,272,'Usage',18,750,ink);
[30,25,20,15,10].forEach((value,i)=>workspace+=t(287,310+i*40,value+'K',11,400,muted));
workspace+=chart(333,298,768,164)+t(333,494,'Jan 1',11,400,muted)+t(544,494,'Jan 8',11,400,muted)+t(748,494,'Jan 15',11,400,muted)+t(941,494,'Jan 22',11,400,muted)+t(1101,494,'Jan 29',11,400,muted,'text-anchor="end"');
workspace+=r(266,539,866,181,panel,13)+t(286,570,'Top projects',18,750,ink)+t(286,598,'Project',11,500,muted)+t(830,598,'Active users',11,500,muted)+t(1033,598,'Events',11,500,muted);
[['Web app','12,340','512,900','#9264F5'],['Mobile app','8,421','372,180','#0DC4D7'],['API','4,130','177,260','#11C9AA']].forEach(([label,users,events,color],i)=>{const y=628+i*35;workspace+=line(286,y-19,826,edge)+r(287,y-12,22,22,color,5)+icon(291,y-8,'layers','#FFFFFF',.55)+t(322,y+4,label,13,550,ink)+t(830,y+4,users,13,600,ink)+t(1033,y+4,events,13,600,ink);});
let activity=r(24,20,30,30,'#165DFA',8)+icon(30,26,'layers','#D7FFFF',.75)+t(64,41,'Sample workspace',17,750,ink)+t(24,109,'Your activity',30,750,ink,'letter-spacing="-.8"')+t(24,138,'Last 30 days',14,400,muted);
[30,20,10].forEach((v,i)=>activity+=t(24,192+i*62,v+'K',11,400,muted));
activity+=chart(66,179,306,151)+t(66,359,'Jan 1',11,400,muted)+t(190,359,'Jan 15',11,400,muted)+t(372,359,'Jan 29',11,400,muted,'text-anchor="end"');
[['Active users','24,891','+18.4%','user'],['Total events','1,062,340','+27.1%','activity'],['Projects','3','All systems live','layers']].forEach(([label,value,growth,kind],i)=>{const y=397+i*79;activity+=line(24,y,348,edge)+r(24,y+17,43,43,'#253248',8)+icon(34,y+27,kind,'#B4C2DA',.9)+t(82,y+32,label,14,500,ink)+t(82,y+55,value,16,750,ink)+t(372,y+55,growth,12,600,'#19D5C1','text-anchor="end"');});
activity+=line(24,646,348,edge)+[['Overview','home'],['Projects','layers'],['Activity','activity'],['Team','user']].map(([label,kind],i)=>icon(37+i*94,667,kind,i===0?'#20E5EA':muted,.85)+t(49+i*94,710,label,10,500,i===0?'#20E5EA':muted,'text-anchor="middle"')).join('');

// Vector landscape, authored here from simple paths; this is deliberately not a photograph.
const desert=(x,y,w,h)=>`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 600 260" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#F5C1A0"/><stop offset="1" stop-color="#F6DFBF"/></linearGradient><linearGradient id="dune" x2=".8" y2="1"><stop stop-color="#CA7048"/><stop offset="1" stop-color="#914E38"/></linearGradient></defs><rect width="600" height="260" fill="url(#sky)"/><circle cx="460" cy="54" r="23" fill="#F9DEB2"/><path d="M0 119L73 81 151 107 230 87 315 111 401 91 503 120 600 89V260H0Z" fill="#D6A18A"/><path d="M0 152L101 113 191 143 272 114 385 159 476 126 600 143V260H0Z" fill="#BC8265"/><path d="M0 198Q95 130 201 180T394 158T600 170V260H0Z" fill="url(#dune)"/><path d="M0 257Q133 154 274 213T600 177V260H0Z" fill="#DE8654"/><path d="M130 260Q240 190 391 224T600 198V260Z" fill="#AD5838"/><path d="M0 213Q103 159 202 190 M269 207Q432 163 600 186 M142 250Q246 206 348 236 M382 248Q510 208 600 220" fill="none" stroke="#F3AD72" stroke-width="2" opacity=".7"/></svg>`;
let journal=t(30,48,'Sample journal',27,700,'#211C17','letter-spacing="-.8"')+t(344,47,'Articles',11,500)+t(412,47,'Essays',11,500)+t(472,47,'About',11,500)+icon(548,30,'search','#211C17',.7)+line(30,70,540,'#D9CDBE')+desert(30,94,540,235);
journal+=t(30,365,'A CURATED PUBLICATION',10,700,'#4A4038','letter-spacing="2"')+t(30,405,'Ideas, people, and places',31,700,'#211C17','letter-spacing="-1"')+t(30,440,'that shape our time.',31,700,'#211C17','letter-spacing="-1"')+t(30,475,'Long-form stories, thoughtful perspectives,',16,400,'#42392F')+t(30,499,'and a closer look at the world around us.',16,400,'#42392F');
[['The quiet power of open spaces','How landscapes give us room to think.','MAR 10'],['Small changes, lasting impact','Everyday choices for a thoughtful life.','MAR 05'],['A slower way to see the world','What we discover when we take our time.','FEB 27']].forEach(([title,summary,date],i)=>{const y=536+i*59;journal+=line(30,y,540,'#D9CDBE')+t(30,y+25,title,19,700,'#211C17','letter-spacing="-.3"')+t(30,y+46,summary,12,400,'#42392F')+t(570,y+42,date,9,600,'#635044','letter-spacing="1" text-anchor="end"');});
let article=t(24,39,'Sample journal',24,700,'#211C17','letter-spacing="-.7"')+icon(354,22,'menu','#211C17',.7)+line(24,58,352,'#D9CDBE')+t(24,85,'PLACES',9,700,'#42392F','letter-spacing="1.6"')+t(24,116,'The quiet power of',26,700,'#211C17','letter-spacing="-.8"')+t(24,145,'open spaces',26,700,'#211C17','letter-spacing="-.8"')+t(24,168,'MAR 10  ·  6 MIN READ',9,600,'#635044','letter-spacing="1.4"')+desert(24,189,352,164);
['Open spaces have a way of quieting the noise.','They give us room to breathe, to think, and','to notice what matters.','','Away from the rush, perspectives shift. The','horizon feels wider, and everyday concerns','find their place.','','A little space can become a powerful','source of clarity.'].forEach((value,i)=>{article+=t(24,380+i*11.7,value,11,400,'#42392F');});

const screens=[
 ['trio-studio-library.svg',396,730,'Sample studio image library','#FCFBFF',library,false],
 ['trio-studio-detail.svg',396,730,'Sample studio launch visual detail','#1B102C',detail,false],
 ['trio-workspace-overview.svg',1160,744,'Sample workspace desktop overview','#101927',workspace,false],
 ['trio-workspace-activity.svg',396,730,'Sample workspace mobile activity','#101927',activity,false],
 ['trio-journal-home.svg',600,722,'Sample journal publication home','#FBF4E7',journal,true],
 ['trio-journal-article.svg',400,504,'Sample journal article on open spaces','#FBF4E7',article,true],
];
await fs.mkdir(output,{recursive:true});
const records=[];
for(const [file,width,height,label,bg,body,serif] of screens){
 const bytes=Buffer.from(shell(width,height,label,bg,body,serif));await fs.writeFile(path.join(output,file),bytes);
 records.push({file,width,height,sha256:hash(bytes),source:'scripts/build-premium-trio-samples.mjs',license:'Original self-authored demo content; bundled with DevSnapKit',...(serif?{illustration:'Original vector desert illustration made from SVG paths, gradients and circles; not a photograph'}:{})});
}
await fs.writeFile(path.join(output,'premium-trio-samples.json'),JSON.stringify({generator:'scripts/build-premium-trio-samples.mjs',provenance:'Original fictional interfaces, geometric artwork, charts and initial-letter avatars; no third-party screenshots, photos or customer data. Device and browser chrome excluded. All domains use .example.',fonts:fonts.map(({file,bytes},i)=>({source:'public/poster/fonts/'+file,license:i?'Gelasio-OFL.txt':'Manrope-OFL.txt',sha256:hash(bytes)})),records},null,2)+'\n');
console.log(JSON.stringify({output,records}));
