import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { launchBrowser, clickButton, downloadPng } from '../tests/helpers/browser.mjs';
import { startSeoServer } from '../tests/helpers/seo-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.env.TEXT_COMPARISON_OUTPUT || 'D:/workspace/MarkMoney/output/devsnapkit/text-hero-controls-2026-10-30';
await fs.mkdir(output, { recursive: true });
const server = await startSeoServer(() => ({}));
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('devsnapkit_welcome_seen', '1'));
  await page.goto(`${server.origin}/?editor=1&tool=text`, { waitUntil: 'networkidle0' });
  const chooser = page.waitForFileChooser();
  await page.click('button[title="Upload screenshot from computer"]');
  await (await chooser).accept([path.join(root, 'public/seo/examples/text-source.png')]);
  await page.waitForFunction(() => [...document.querySelectorAll('#studio-canvas img')].some(image => image.complete && image.naturalWidth === 1120));
  await clickButton(page, 'Canvas');
  await clickButton(page, 'Solid');
  await page.click('aside.studio-inspector button[title="Soft Gray"]');
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.$$eval('[data-canvas-text]', nodes => nodes.length), 0);
  await page.click('[data-inspector-tabs] button:last-child');
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(node => node.getClientRects().length && /^Download (?:[124]x|4K)/.test(node.textContent.trim()));
    if (button) button.dataset.comparisonDownload = '';
  });
  const download = await downloadPng(page, output, 'before-text-download.png', () => page.click('[data-comparison-download]'));
  const source = await fs.readFile(download.path);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const target = path.join(root, 'public/seo/examples/text-before-caption.png');
  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toFile(target);
  assert.ok(data.equals(await sharp(target).ensureAlpha().raw().toBuffer()));
  const meta = await sharp(target).metadata();
  assert.ok(!meta.exif && !meta.xmp && !meta.iptc && !meta.icc);
  const bytes = await fs.readFile(target), chunks=[];
  for(let offset=8;offset+12<=bytes.length;){const size=bytes.readUInt32BE(offset);chunks.push(bytes.toString('ascii',offset+4,offset+8));offset+=size+12;}
  assert.ok(chunks.every(type=>['IHDR','IDAT','IEND','pHYs'].includes(type)));
  const after = await sharp(path.join(root, 'public/seo/examples/text-result.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, after.info.width); assert.equal(info.height, after.info.height);
  // Independent browser exports can vary by a handful of antialiased corner
  // pixels. A real shift of the weather cards changes thousands of pixels.
  const bottom = Math.floor(info.height * .16) * info.width * info.channels;
  let rasterEdgeDifferencePixels=0, maxDifference=0;
  for(let i=bottom;i<data.length;i+=info.channels){let difference=0;for(let c=0;c<info.channels;c++)difference=Math.max(difference,Math.abs(data[i+c]-after.data[i+c]));if(difference)rasterEdgeDifferencePixels++;maxDifference=Math.max(maxDifference,difference);}
  assert.ok(rasterEdgeDifferencePixels<=128 && maxDifference<=32, 'Same canvas, source placement, scale and background below the headline.');
  const report = { passed:true, file:'text-before-caption.png', width:info.width, height:info.height, sha256:createHash('sha256').update(bytes).digest('hex'), method:'Actual studio 2x PNG download using the same source and Soft Gray canvas, without a text object.', alignedBelowHeadline:true, rasterEdgeDifferencePixels, maxDifference, imageChunks:chunks };
  const manifestPath=path.join(root,'public/seo/examples/landing-examples.json');
  const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  manifest.examples.find(item=>item.page==='add-text-to-image').comparisonBefore={file:report.file,width:report.width,height:report.height,sha256:report.sha256,method:report.method};
  await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  await fs.writeFile(path.join(output,'comparison.json'), JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); await server.close(); }
