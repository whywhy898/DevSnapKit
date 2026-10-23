import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {launchBrowser, preparePage, clickButton, downloadPng, legacyPosterUrl} from './helpers/browser.mjs';

const directory = path.resolve('../../output/devsnapkit/poster-v1/export');
const fixture = name => path.resolve(`tests/fixtures/poster-v1/${name}.png`);
async function capture(page, filename) {
  const result=await downloadPng(page,path.join(directory,'downloads',`${Date.now()}-${filename}`),filename,()=>clickButton(page,'Download PNG'));
  const canonical=path.join(directory,filename);await fs.copyFile(result.path,canonical);
  return {...result,path:canonical};
}
async function fill(page, label, value) {
  const input = await page.$(`textarea[aria-label="${label}"]`);
  assert.ok(input, `Missing ${label} text control`);
  await input.focus(); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control');
  await page.keyboard.type(value); await page.keyboard.press('Tab');
}
async function upload(page, role, name) {
  const input = await page.$(`input[aria-label="Replace ${role}"]`);
  await input.uploadFile(fixture(name));
  await page.waitForFunction(role => document.querySelector(`[data-poster-role="${role}"] img`)?.src.startsWith('blob:'),{},role);
  await page.waitForFunction(() => !document.querySelector('.poster-controls [disabled]'));
  await page.evaluate(async () => {await document.fonts.ready;await Promise.all([...document.querySelectorAll('[data-poster-artwork] img')].map(i => i.decode()));});
}

async function compareRegions(preview, output) {
  const a = await sharp(preview).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const b = await sharp(output).resize(1600,1200).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(a.info.width,1600);assert.equal(a.info.height,1200);
  const regions = {headline:{x:75,y:220,w:470,h:530},main:{x:540,y:195,w:1000,h:820},detail:{x:75,y:790,w:460,h:280},footer:{x:75,y:1090,w:1450,h:80}};
  const results = {};
  for(const [name,r] of Object.entries(regions)) {
    let best = {error:Infinity,dx:0,dy:0};
    for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++) {
      let error=0,count=0;
      for(let y=r.y;y<r.y+r.h;y+=3)for(let x=r.x;x<r.x+r.w;x+=3)for(let c=0;c<3;c++) {
        error+=Math.abs(a.data[(y*1600+x)*4+c]-b.data[((y+dy)*1600+x+dx)*4+c]);count++;
      }
      error/=count;if(error<best.error)best={error,dx,dy};
    }
    results[name]=best;
    assert.ok(Math.abs(best.dx)<=2&&Math.abs(best.dy)<=2,`${name}: preview/export shift exceeds 2 logical pixels: ${JSON.stringify(best)}`);
    assert.ok(best.error<12,`${name}: preview/export regional difference too high: ${best.error}`);
  }
  return results;
}

test('Honey raw uploads, editable fields, own preview matching and multiple aspect downloads', {timeout:180000}, async()=>{
  const browser=await launchBrowser();const downloads=[];
  try {
    const page=await preparePage(browser,legacyPosterUrl(process.env.TEST_UI_URL||'http://127.0.0.1:5179/?editor=1'),{viewport:{width:2200,height:1650,deviceScaleFactor:1}});
    await page.waitForSelector('[data-poster-artwork]');
    await upload(page,'main','honey-main');await upload(page,'detail','honey-detail');
    for(const [label,value] of [['Brand','HoneyWeRank'],['Headline','Be the\nbrand AI'],['Highlight','recommends.'],['Description','Content. Publishing. Backlinks.\nA sweeter way to get discovered.'],['CTA label','Join the waitlist'],['Website','honeywerank.com'],['Browser title','honeywerank.com'],['Badge','JOIN THE WAITLIST'],['Eyebrow','YOUR NEXT CHAPTER IN DISCOVERY'],['Detail heading','Publish content. Build authority.'],['Detail label','HOW IT WORKS · ILLUSTRATIVE WORKFLOW'],['Example data disclosure','Product preview · Dashboard contains illustrative sample data']]) await fill(page,label,value);
    await fs.mkdir(directory,{recursive:true});
    await page.addStyleTag({content:'[data-poster-selection]{visibility:hidden!important}'});
    const artwork=await page.$('[data-poster-artwork]');
    const preview=path.join(directory,'honey-preview-1600x1200.png');await artwork.screenshot({path:preview});
    for(const ratio of [1,2]) {
      await page.select('select[aria-label="Poster export size"]',String(ratio));
      const result=await capture(page,`honey-${1600*ratio}x${1200*ratio}.png`);
      const meta=await sharp(result.path).metadata();assert.equal(meta.width,1600*ratio);assert.equal(meta.height,1200*ratio);
      downloads.push({...result,width:meta.width,height:meta.height});
    }
    const comparisons=await compareRegions(preview,downloads[0].path);
    const comparisons2x=await compareRegions(preview,downloads[1].path);
    for(const name of ['landscape','square','phone','ultrawide']) {
      await upload(page,'main',name);
      await page.select('select[aria-label="Poster export size"]','1');
      const result=await capture(page,`${name}-1600x1200.png`);
      const geometry=await page.evaluate(()=>{const node=document.querySelector('[data-poster-role="main"]'),img=node.querySelector('img'),imageBox=img.getBoundingClientRect();return {width:img.offsetWidth,height:img.offsetHeight,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,imageBox:{x:imageBox.x,y:imageBox.y,width:imageBox.width,height:imageBox.height},objectFit:getComputedStyle(img).objectFit};});
      assert.ok(Math.abs(geometry.width/geometry.height-geometry.naturalWidth/geometry.naturalHeight)<.01,`${name}: main screenshot changed aspect ratio`);
      downloads.push({...result,name,geometry});
    }
    await fill(page,'Browser title','x');
    await page.select('select[aria-label="Style text area"]','browserTitle');
    const size=await page.$('input[aria-label="Font size"]');await size.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.type('160');await page.keyboard.press('Tab');
    await page.waitForFunction(()=>[...document.querySelectorAll('[role="status"]')].some(e=>e.textContent.includes('browserTitle')));
    const browserTitleOverflow=await page.evaluate(()=>{const main=document.querySelector('[data-poster-role="main"]'),chrome=main.firstElementChild.firstElementChild,title=main.querySelector('[data-poster-text="browserTitle"]');return{chromeHeight:chrome.offsetHeight,titleHeight:title.clientHeight,titleScrollHeight:title.scrollHeight};});
    assert.equal(browserTitleOverflow.chromeHeight,49);assert.ok(browserTitleOverflow.titleScrollHeight>browserTitleOverflow.titleHeight);
    await clickButton(page,'Download PNG');await page.waitForFunction(()=>[...document.querySelectorAll('[role="alert"]')].some(e=>e.textContent.includes('browserTitle')));
    await page.screenshot({path:path.join(directory,'browser-title-overflow-blocked.png')});
    const result={browser:await browser.version(),downloads,comparisons,comparisons2x,browserTitleOverflow};
    await fs.writeFile(path.join(directory,'results.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  }finally{await browser.close();}
});
