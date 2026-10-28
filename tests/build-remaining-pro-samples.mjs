import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {launchBrowser} from './helpers/browser.mjs';
const root=path.resolve(import.meta.dirname,'..');
const fixtures=path.join(root,'tests/fixtures/remaining-pro');
const dest=path.join(root,'public/designed/examples/collection');
const concepts=path.resolve(root,'../../output/devsnapkit/template-collection-2026-10-27/remaining-pro-concepts');
const jobs=[
 ['01-feature-spotlight-v2.html','motive-board','main'],['01-feature-spotlight-v2.html','motive-rules','secondary'],
 ['02-web-mobile-v3.html','sidea-web','main'],['02-web-mobile-v3.html','sidea-mobile','secondary'],
 ['03-metric-focus.html','north-overview','main'],['03-metric-focus.html','north-audience','secondary'],
 ['04-before-after.html','outline-before','main'],['04-before-after.html','outline-after','secondary'],
];
await fs.mkdir(fixtures,{recursive:true});await fs.mkdir(dest,{recursive:true});
if(process.argv.includes('--seed'))for(const source of new Set(jobs.map(j=>j[0]))){let html=await fs.readFile(path.join(concepts,source),'utf8');html=html.replaceAll('file:///D:/workspace/MarkMoney/node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2','__MANROPE__').replaceAll('file:///D:/workspace/MarkMoney/apps/shotcraft/public/poster/fonts/Gelasio-Italic.ttf','__GELASIO_ITALIC__').replaceAll('file:///D:/workspace/MarkMoney/apps/shotcraft/public/poster/fonts/Gelasio.ttf','__GELASIO__');await fs.writeFile(path.join(fixtures,source),html);}
const fontFiles=[['Manrope','manrope-latin.woff2','Manrope-OFL.txt'],['Gelasio','Gelasio.ttf','Gelasio-OFL.txt']];
const fonts=await Promise.all(fontFiles.map(async([family,file,license])=>({family,file:'public/poster/fonts/'+file,license:'public/poster/fonts/'+license,licenseType:'SIL OFL 1.1',sha256:createHash('sha256').update(await fs.readFile(path.join(root,'public/poster/fonts',file))).digest('hex')})));
const fontData=async(file,type)=>`data:font/${type};base64,${(await fs.readFile(file)).toString('base64')}`;
const embedded=[await fontData(path.join(root,fonts[0].file),'woff2'),await fontData(path.join(root,fonts[1].file),'ttf'),await fontData(path.join(root,'public/poster/fonts/Gelasio-Italic.ttf'),'ttf')];
const browser=await launchBrowser();const samples=[];
try{for(const[source,id,slot]of jobs){const original=await fs.readFile(path.join(fixtures,source));const html=original.toString().replaceAll('__MANROPE__',embedded[0]).replaceAll('__GELASIO__',embedded[1]).replaceAll('__GELASIO_ITALIC__',embedded[2]);
 const page=await browser.newPage();await page.setViewport({width:1920,height:1920,deviceScaleFactor:2});await page.setRequestInterception(true);page.on('request',r=>/^(file:|data:|about:)/.test(r.url())?r.continue():r.abort());await page.setContent(html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
 const logical=await page.evaluate(({slot,id})=>{const parent=document.querySelector(`[data-slot="${slot}"]`);const ui=parent.querySelector('.ui');const color=getComputedStyle(ui||parent).color;const typography=n=>{const s=getComputedStyle(n);return[s.fontSize,s.fontFamily,s.fontWeight,s.color]};const originalSmall=ui?.querySelector('small');const expectedSmall=originalSmall?typography(originalSmall):null;const content=document.createElement('div');content.id='sample';let width,height;
  if(ui){content.className='ui';width=ui.clientWidth;height=ui.clientHeight;content.append(...[...ui.childNodes].map(n=>n.cloneNode(true)));}
  else if(id==='sidea-mobile'){width=parent.clientWidth;height=parent.clientHeight-parent.querySelector('.status').offsetHeight;for(const cls of ['.mobilenav','.mobilebody'])content.append(parent.querySelector(cls).cloneNode(true));}
  else{width=parent.clientWidth;height=parent.clientHeight-parent.querySelector('.chrome').offsetHeight;for(const cls of ['.webnav','.webbody'])content.append(parent.querySelector(cls).cloneNode(true));}
  content.style.cssText=`width:${width}px;height:${height}px;overflow:hidden;position:relative;font-family:Manrope;color:${color};background:${id.startsWith('sidea')?'#f7f4ed':'#fff'}`;document.body.replaceChildren(content);document.body.style.cssText='margin:0;padding:0;background:white';if(expectedSmall&&JSON.stringify(expectedSmall)!==JSON.stringify(typography(content.querySelector('small'))))throw Error('Extraction changed small text typography');return{width,height};},{slot,id});
 await page.evaluate(()=>document.fonts.ready);const file=id+'.png';await(await page.$('#sample')).screenshot({path:path.join(dest,file)});const png=await fs.readFile(path.join(dest,file));samples.push({id,file,width:png.readUInt32BE(16),height:png.readUInt32BE(20),logical,sha256:createHash('sha256').update(png).digest('hex'),source:'tests/fixtures/remaining-pro/'+source,sourceSHA256:createHash('sha256').update(original).digest('hex'),sourceKind:'original native UI rendered to PNG',chromeIncluded:false,uiTypographyMatched:true,fonts});await page.close();
}}finally{await browser.close()}
await fs.writeFile(path.join(dest,'remaining-pro-samples.json'),JSON.stringify({method:'Two distinct app screens per concept; removed device and browser chrome before native Chrome capture at 2x',samples},null,2));console.log(JSON.stringify(samples.map(s=>({id:s.id,width:s.width,height:s.height}))));
