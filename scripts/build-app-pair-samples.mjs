import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'public/designed/examples/collection');
const fontPath='public/poster/fonts/manrope-latin.woff2',font=await fs.readFile(path.join(root,fontPath));
const ink='#203B59',assist='#557DA7',blue='#A8C8E5',apricot='#EDC5A3',cream='#F4E5C5',line='#E4ECF3';
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text=(x,y,value,size=16,weight=400,color=ink,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}" ${extra}>${esc(value)}</text>`;
const rect=(x,y,w,h,fill,rx=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const rule=(x,y,w)=>`<path d="M${x} ${y}h${w}" fill="none" stroke="${line}"/>`;
const circle=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const icon=(x,y,kind,color=assist)=>{
 const paths={library:'M3 3h6v21H3z M12 3h6v21h-6z M22 3l5 20',notes:'M4 2h18v23H4z M9 9h8 M9 14h8 M9 19h5',saved:'M5 2h16v24l-8-6-8 6z',search:'M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0 M18 18l7 7'};
 return `<g transform="translate(${x} ${y})" stroke="${color}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" fill="none"><path d="${paths[kind]}"/></g>`;
};
const nav=active=>rule(24,774,348)+[['Library','library'],['Notes','notes'],['Saved','saved']].map(([label,kind],i)=>{
 const x=82+i*116,color=active===label?ink:assist;
 return icon(x-13,790,kind,color)+text(x,834,label,11,active===label?700:450,color,'text-anchor="middle"');
}).join('');
const header=()=>text(24,47,'shelf',25,750,ink,'letter-spacing="-1"')+icon(345,24,'search');
const shell=(label,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="396" height="858" viewBox="0 0 396 858" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><desc>Self-authored fictional reading app interface. All book titles, summaries and notes are original illustrative content. No customer data, website capture or third-party photography. Device chrome is rendered separately by DevSnapKit.</desc><defs><style>@font-face{font-family:ShelfDemo;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900}text{font-family:ShelfDemo,Arial,sans-serif}</style></defs>${rect(0,0,396,858,'#FFFFFF')}${body}</svg>`;

let library=header()+text(24,111,'Your library',34,750,ink,'letter-spacing="-1.3"')+text(24,142,'Books worth keeping close.',14,450,assist);
library+=rect(24,168,79,32,ink,16)+text(63.5,189,'All books',12,650,'#FFFFFF','text-anchor="middle"')+text(128,189,'Reading',12,500,assist)+text(227,189,'Finished',12,500,assist)+text(372,189,'3 books',11,450,assist,'text-anchor="end"');
const books=[
 {title:'The art of noticing',lines:['The art of','noticing'],tag:'IN PROGRESS',detail:'Small wonders, every day.',color:blue,cover:['THE ART OF','NOTICING'],notes:'4 notes'},
 {title:'A slower kind of work',lines:['A slower kind','of work'],tag:'TO READ',detail:'Make room for what matters.',color:apricot,cover:['A SLOWER','KIND OF WORK'],notes:'2 notes'},
 {title:'Notes on everyday things',lines:['Notes on','everyday things'],tag:'FINISHED',detail:'The familiar, seen anew.',color:cream,cover:['NOTES ON','EVERYDAY','THINGS'],notes:'6 notes'},
];
books.forEach((book,i)=>{
 const y=225+i*178;
 library+=`<g aria-label="${esc(book.title)}">`+rect(24,y,114,151,book.color,3)+`<path d="M32 ${y}v151" stroke="${ink}" stroke-opacity=".16"/>`;
 book.cover.forEach((part,j)=>{library+=text(41,y+24+j*14,part,9.2,750,ink,'letter-spacing=".3"');});
 if(i===0)library+=circle(82,y+103,28,ink)+circle(94,y+96,22,blue)+`<path d="M50 ${y+135}h61" stroke="${ink}" stroke-width="1"/>`;
 if(i===1)library+=rect(42,y+77,77,15,ink)+rect(42,y+100,57,15,ink)+rect(42,y+123,37,8,ink);
 if(i===2)library+=circle(64,y+107,21,ink)+rect(88,y+86,27,42,ink)+circle(101.5,y+86,13.5,cream);
 library+=text(157,y+15,book.tag,9,700,assist,'letter-spacing="1.1"');
 book.lines.forEach((part,j)=>{library+=text(157,y+49+j*26,part,20,700,ink,'letter-spacing="-.5"');});
 library+=text(157,y+103,book.detail,11,450,assist)+icon(157,y+124,'notes',assist).replace('stroke-width="1.7"','stroke-width="1.4"').replace(`translate(157 ${y+124})`,`translate(157 ${y+124}) scale(.55)`)+text(179,y+136,book.notes,11,500,assist)+'</g>';
 if(i<2)library+=rule(157,y+162,215);
});
library+=nav('Library');

let notes=header()+text(24,111,'Reading notes',32,750,ink,'letter-spacing="-1.2"')+text(24,142,'The art of noticing',14,500,assist);
notes+=rect(24,171,348,68,blue,8)+rect(40,186,27,38,ink,2)+circle(53.5,205,8,blue)+text(83,196,'YOUR READING SPACE',9,700,ink,'letter-spacing="1.1"')+text(83,220,'A place for your thoughts.',17,650);
notes+=text(24,280,'Book summary',12,700,assist,'letter-spacing=".5"')+text(24,319,'Pay attention to',28,700,ink,'letter-spacing="-.9"')+text(24,354,'the ordinary.',28,700,ink,'letter-spacing="-.9"');
['A familiar street. A quiet conversation.','The small things we pass each day can','become the ideas we carry with us.'].forEach((part,i)=>{notes+=text(24,389+i*23,part,14,450,assist);});
notes+=rule(24,452,348)+text(24,486,'My notes',20,700,ink,'letter-spacing="-.4"')+text(372,485,'2 notes',11,500,assist,'text-anchor="end"');
notes+=rect(24,509,348,86,'#F2F6FA',7)+`<path d="M39 526v51" stroke="${blue}" stroke-width="3"/>`+text(53,537,'A thought to keep',15,700)+text(53,562,'Notice one thing you usually miss.',12,450,assist)+text(53,581,'CHAPTER 01',8.5,700,assist,'letter-spacing="1"');
notes+=rect(24,608,348,86,'#FCF6EE',7)+`<path d="M39 625v51" stroke="${apricot}" stroke-width="3"/>`+text(53,636,'A small practice',15,700)+text(53,661,'Leave a little room for curiosity.',12,450,assist)+text(53,680,'CHAPTER 03',8.5,700,assist,'letter-spacing="1"');
notes+=rect(24,713,348,43,ink,7)+text(198,740,'Add a note',14,650,'#FFFFFF','text-anchor="middle"')+nav('Notes');

await fs.mkdir(output,{recursive:true});
const records=[];
for(const [file,label,body]of [['shelf-library.svg','Illustrative shelf reading library',library],['shelf-notes.svg','Illustrative shelf reading notes',notes]]){
 const bytes=Buffer.from(shell(label,body));
 await fs.writeFile(path.join(output,file),bytes);
 records.push({file,width:396,height:858,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await fs.writeFile(path.join(output,'app-pair-samples.json'),JSON.stringify({generator:'scripts/build-app-pair-samples.mjs',provenance:'Self-authored fictional SVG reading app content; original geometric book covers, summaries and notes; no website capture, third-party photography or customer data',font:{source:fontPath,license:'Manrope-OFL.txt',sha256:createHash('sha256').update(font).digest('hex')},records},null,2));
console.log(JSON.stringify({output,records}));
