import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relativeDir = 'public/designed/examples/next-stage';
const out = path.join(root, relativeDir);
const artworkPath = `${relativeDir}/album-cover.png`;
const provenancePath = `${relativeDir}/album-cover-provenance.json`;
const fontPath = 'public/poster/fonts/manrope-latin.woff2';
const fontLicense = 'public/poster/fonts/Manrope-OFL.txt';
const readRequired = async file => {
  try { return await fs.readFile(path.join(root, file)); }
  catch (error) { throw new Error(`NEXT samples require asset: ${file}. Supply the approved artwork and existing licensed font before building.`, {cause: error}); }
};
const [artwork, font, provenanceRaw] = await Promise.all([readRequired(artworkPath), readRequired(fontPath), readRequired(provenancePath)]);
const provenance = JSON.parse(provenanceRaw.toString('utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const image = `data:image/png;base64,${artwork.toString('base64')}`;
const ink = '#F4F0DB', lime = '#D5FF38', muted = '#B7B9A8', dark = '#11160F';
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const text = (x, y, content, size = 15, weight = 500, fill = ink, extra = '') => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" ${extra}>${esc(content)}</text>`;
const rect = (x,y,width,height,fill,rx=0,extra='') => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" ${extra}/>`;
const line = (x,y,width,color) => `<path d="M${x} ${y}h${width}" stroke="${color}" fill="none"/>`;
const more = (x,y,color=ink) => [0,6,12].map(dx=>`<circle cx="${x+dx}" cy="${y}" r="1.6" fill="${color}"/>`).join('');
const stroke = (d,color=ink,width=1.8) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const shell = (label,body,defs='') => `<svg xmlns="http://www.w3.org/2000/svg" width="410" height="722" viewBox="0 0 410 722" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title><desc>Self-authored fictional Sample tone app UI with generated abstract album artwork. Device chrome is supplied separately by DevSnapKit. Names, playlists and playback data are illustrative.</desc><defs><style>@font-face{font-family:ToneDemo;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900}text{font-family:ToneDemo,Arial,sans-serif}</style>${defs}</defs>${body}</svg>\n`;

let player = rect(0,0,410,722,dark);
player += stroke('M27 28l9 9 9-9') + text(205,37,'Sample tone',19,700,ink,'text-anchor="middle" letter-spacing="-.6"') + more(366,30);
player += `<image href="${image}" x="28" y="78" width="354" height="354" preserveAspectRatio="xMidYMid slice" clip-path="url(#player-cover)"/>`;
player += text(28,478,'A new perspective',27,800,ink,'letter-spacing="-1.1"');
player += stroke('M365 460c-6-9-18-2-11 7l12 12 12-12c7-9-6-16-12-7z',ink,1.7);
player += text(29,505,'Sample tone',14,500,muted) + text(122,505,'·',14,500,muted) + text(135,505,'Album / Vol. 03',14,500,muted);
for (let i=0;i<56;i++) {
  // Pure integer arithmetic gives a stable, asymmetric waveform with no random seed.
  const envelope = i<12 ? 5+i*2 : i<30 ? 21 : i<43 ? 27-(i-30) : 11;
  const height = Math.max(4, Math.round(envelope * (.28 + ((i*17+9)%19)/22)));
  player += rect(29+i*6.35,552-height/2,2.25,height,i<29?lime:'#52594A',1.1,`data-wave="${i}"`);
}
player += text(29,594,'1:24',12,500,muted) + text(382,594,'3:56',12,500,muted,'text-anchor="end"');
player += rect(29,608,353,3.2,'#41483B',1.6) + rect(29,608,143,3.2,lime,1.6) + `<circle cx="172" cy="609.6" r="6" fill="${ink}"/>`;
player += stroke('M31 662h5c6 0 9-16 15-16h6m-4-4 4 4-4 4M31 646h5c2 0 4 3 6 7m6 6c1 2 3 3 5 3h4m-4-4 4 4-4 4',muted,1.7);
player += `<path d="M112 646v20m1-10 19-10v20z" fill="${ink}" stroke="${ink}" stroke-width="2"/>`;
player += `<circle cx="205" cy="655" r="31" fill="${ink}"/>` + rect(196,644,6,22,dark,1) + rect(208,644,6,22,dark,1);
player += `<path d="M298 646v20m-1-10-19-10v20z" fill="${ink}" stroke="${ink}" stroke-width="2"/>`;
player += stroke('M350 649h25l-5-5m5 5-5 5M378 662h-25l5 5m-5-5 5-5',muted,1.7);

let collection = rect(0,0,410,722,'#F3ECD6');
collection += stroke('M35 22l-8 9 8 9','#1B2117') + text(205,37,'Sample tone',18,700,'#1B2117','text-anchor="middle" letter-spacing="-.65"') + more(367,30,'#1B2117');
collection += text(28,115,'Your collection',30,800,'#171D13','letter-spacing="-1.4"') + text(29,144,'3 playlists  ·  24 tracks',14,500,'#686C5C');
collection += line(28,177,354,'#D3D0BA');
const playlists = [
  {name:'Morning focus',meta:'8 tracks  ·  28 min',y:199,position:'xMinYMin',transform:'translate(0 0)'},
  {name:'Creative flow',meta:'10 tracks  ·  37 min',y:353,position:'xMaxYMid',transform:'rotate(90 84 409)'},
  {name:'Deep listen',meta:'6 tracks  ·  24 min',y:507,position:'xMidYMax',transform:'rotate(180 84 563)'},
];
let collectionDefs = '';
playlists.forEach((p,i)=>{
  collectionDefs += `<clipPath id="playlist-${i}">${rect(28,p.y,112,112,'#FFFFFF',13)}</clipPath>`;
  // Each thumbnail uses the exact shared artwork, enlarged and cropped differently.
  const size = [154,190,236][i], x = [9,-39,-71][i], y = [p.y-22,p.y-28,p.y-59][i];
  collection += `<g data-playlist="${i}" clip-path="url(#playlist-${i})"><image href="${image}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="${p.position} slice" transform="${p.transform}"/></g>`;
  collection += text(158,p.y+43,p.name,20,750,'#1B2117','letter-spacing="-.8"') + text(158,p.y+70,p.meta,13,500,'#686C5C') + more(364,p.y+52,'#1B2117');
  if (i<2) collection += line(28,p.y+132,354,'#D3D0BA');
});
collection += text(29,687,'CURATED FOR A DIFFERENT PERSPECTIVE',8.5,650,'#828570','letter-spacing="1.2"');

await fs.mkdir(out, {recursive:true});
const samples = [];
for (const [id, body, defs] of [
  ['tone-player', player, '<clipPath id="player-cover"><rect x="28" y="78" width="354" height="354" rx="15"/></clipPath>'],
  ['tone-collection', collection, collectionDefs],
]) {
  const file = `${id}.svg`, bytes = Buffer.from(shell(`Sample tone — ${id === 'tone-player' ? 'player' : 'collection'}`, body, defs));
  await fs.writeFile(path.join(out,file), bytes);
  samples.push({id,file,width:410,height:722,sourceKind:'self-authored fictional app UI',sha256:sha(bytes)});
}
const manifest = {
  generator:'scripts/build-next-stage-samples.mjs',
  provenance:'Self-authored fictional app UI. Album imagery is generated artwork, embedded unchanged. No website capture, real artist brand, customer data or licensing guarantee.',
  source:{kind:'native authoring proof',template:'src/templates/collection/definitions/next-stage.ts'},
  artwork:{file:artworkPath,sourceKind:'generated abstract artwork',width:1254,height:1254,sha256:sha(artwork),provenance:provenancePath,provenanceSha256:sha(provenanceRaw),generation:provenance},
  font:{file:fontPath,family:'Manrope',license:fontLicense,sha256:sha(font)},
  samples,
};
await fs.writeFile(path.join(out,'samples.json'), JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output:out,samples},null,2));
