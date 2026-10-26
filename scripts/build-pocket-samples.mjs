import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'public/designed/examples/collection');
const fontPath='public/poster/fonts/manrope-latin.woff2',font=await fs.readFile(path.join(root,fontPath));
const paper='#FBF5EF',ink='#34242D',muted='#968178',coral='#CA7662',pale='#F0DDD2',line='#EFE3DA';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const t=(x,y,s,size=16,weight=400,color=ink,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${esc(s)}</text>`;
const rect=(x,y,w,h,color,rx=0,stroke)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${color}"${stroke?` stroke="${stroke}"`:''}/>`;
const circle=(x,y,r,fill,stroke)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="1.4"`:''}/>`;
const rule=(x,y,w)=>`<path d="M${x} ${y}h${w}" fill="none" stroke="${line}"/>`;
const check=(x,y)=>`<path d="M${x-5} ${y}l4 4 7-8" fill="none" stroke="${paper}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
const icon=(x,y,kind,color=muted)=>{
 const paths={home:'M2 11l9-8 9 8v10h-6v-7H8v7H2z',calendar:'M3 5h17v16H3z M3 10h17 M7 2v6 M16 2v6',bars:'M4 20v-6 M10 20V7 M16 20V2',person:'M7 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0 M3 22v-2a8 8 0 0 1 16 0v2',focus:'M3 11a8 8 0 1 0 16 0 8 8 0 0 0-16 0 M7 11a4 4 0 1 0 8 0 4 4 0 0 0-8 0'};
 return `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[kind]}"/></g>`;
};
const nav=active=>rule(22,735,352)+['Today','Calendar',active==='Focus'?'Focus':'Insights',active==='Focus'?'Insights':'More'].map((label,i)=>{const x=49+i*98,c=label===active?coral:muted;return icon(x-11,750,['home','calendar',active==='Focus'?'focus':'bars',active==='Focus'?'bars':'person'][i],c)+t(x,790,label,11,label===active?650:450,c,'text-anchor="middle"');}).join('');
const shell=(label,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="396" height="810" viewBox="0 0 396 810" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><desc>Self-authored fictional demonstration app screen. Names, dates, tasks and progress are illustrative. Device chrome is rendered separately by DevSnapKit. No website capture, customer information or third-party photography.</desc><defs><style>@font-face{font-family:PocketDemo;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900}text{font-family:PocketDemo,Arial,sans-serif}</style></defs>${rect(0,0,396,810,paper)}${body}</svg>`;

let today=t(24,43,'morrow',23,700,ink,'letter-spacing="-1"')+circle(353,34,18,coral)+t(353,40,'+',24,400,paper,'text-anchor="middle"');
today+=t(24,84,'Tue, 16 Apr',13,500,coral)+t(24,126,'Good morning',34,700,ink,'letter-spacing="-1.7"')+t(24,151,'A calmer day is a brighter day.',13,400,muted);
['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach((label,i)=>{const x=31+i*55.5;today+=t(x,190,label,11,450,muted,'text-anchor="middle"');if(i===1)today+=circle(x,217,17,coral);today+=t(x,222,15+i,13,i===1?650:450,i===1?paper:ink,'text-anchor="middle"');if([0,1,3,4].includes(i))today+=circle(x,244,1.8,coral);});
today+=rule(24,264,348);
const schedule=[['9:00','10:00','Deep work','Product strategy',true],['10:30','11:15','Team sync','Weekly update',false],['13:00','14:00','Lunch break','Time to recharge',false],['14:30','16:00','Design review','App screens',false],['16:30','17:00','Plan tomorrow','Wrap up and notes',false]];
schedule.forEach(([start,end,title,detail,done],i)=>{const y=297+i*81;today+=t(23,y,start,12,500)+t(23,y+19,end,10,400,muted)+`<path d="M85 ${y-13}v54" stroke="${i===0?coral:'#D7BCAD'}" stroke-width="2" stroke-linecap="round"/>`+t(100,y,title,17,600)+t(100,y+23,detail,12,400,muted)+circle(354,y+1,11,done?coral:'none',done?undefined:'#D9BFB0');if(done)today+=check(354,y+1);if(i<schedule.length-1)today+=rule(99,y+45,275);});
today+=t(24,718,'A little room for what matters.',11,400,muted)+nav('Today');

let focus=t(24,43,'morrow',23,700,ink,'letter-spacing="-1"')+circle(354,34,16,'#F4E9E1')+t(354,39,'···',18,650,ink,'text-anchor="middle"');
focus+=t(24,109,'Focus',36,700,ink,'letter-spacing="-1.6"')+t(24,138,'One thing at a time.',14,400,muted);
const circumference=2*Math.PI*115;
focus+=`<circle cx="198" cy="301" r="115" fill="none" stroke="${pale}" stroke-width="12"/><circle cx="198" cy="301" r="115" fill="none" stroke="${coral}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${circumference*.72} ${circumference}" transform="rotate(-90 198 301)"/>`;
focus+=t(198,307,'25:00',45,500,ink,'text-anchor="middle" letter-spacing="-2"')+t(198,337,'Focus time',13,400,muted,'text-anchor="middle"');
focus+=rect(75,445,153,45,coral,22)+t(151.5,473,'Start focus',14,650,paper,'text-anchor="middle"')+rect(244,445,76,45,'#F2E7DE',22)+t(282,473,'Reset',12,550,muted,'text-anchor="middle"');
focus+=rule(24,521,348)+t(24,551,'Today’s focus',17,600)+t(372,551,'3 tasks',11,400,muted,'text-anchor="end"');
['Write project brief','Work on main feature','Review notes'].forEach((label,i)=>{const y=584+i*45;focus+=circle(35,y,10,i===0?coral:'none',i===0?undefined:'#D9BFB0');if(i===0)focus+=check(35,y);focus+=t(56,y+5,label,13,450)+`<path d="M358 ${y-3}h10m-10 4h10m-10 4h10" stroke="#C9AEA0" stroke-width="1" stroke-linecap="round"/>`;});
focus+=nav('Focus');

await fs.mkdir(out,{recursive:true});const records=[];
for(const [file,label,body]of [['morrow-today.svg','Illustrative morrow daily planner',today],['morrow-focus.svg','Illustrative morrow focus timer',focus]]){const bytes=Buffer.from(shell(label,body));await fs.writeFile(path.join(out,file),bytes);records.push({file,width:396,height:810,sha256:createHash('sha256').update(bytes).digest('hex')});}
await fs.writeFile(path.join(out,'pocket-samples.json'),JSON.stringify({generator:'scripts/build-pocket-samples.mjs',provenance:'Self-authored fictional SVG app content; no device capture, third-party photography or customer data',font:{source:fontPath,license:'Manrope-OFL.txt',sha256:createHash('sha256').update(font).digest('hex')},records},null,2));
console.log(JSON.stringify({output:out,records}));
