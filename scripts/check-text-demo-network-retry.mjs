import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from '../tests/helpers/browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const bytes = await fs.readFile(path.join(root, 'public/seo/video/add-text-demo.mp4'));
const playerScript = await fs.readFile(path.join(root, 'public/seo/text-demo.js'), 'utf8');
let healthy = false;
let requests = 0;
let browser;
const server = http.createServer((request, response) => {
  requests++;
  if (healthy) {
    response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length });
    response.end(bytes); return;
  }
  if (requests > 1) { response.writeHead(500); response.end(); return; }
  // Start real playback, then fail the transfer and Chrome's range retry.
  response.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length });
  response.write(bytes.subarray(0, 400000));
  setTimeout(() => response.destroy(), 1000);
});
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await launchBrowser();
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.setContent(`<div data-demo-slot><div data-demo-frame><video data-demo-player controls preload="none"><source src="http://127.0.0.1:${server.address().port}/video.mp4" type="video/mp4"></video><button data-demo-play><span data-demo-icon>Play</span></button><button data-demo-expand>Expand</button></div></div><dialog data-demo-dialog><button data-demo-close>Close</button><div data-demo-expanded-slot></div></dialog><p data-demo-status hidden></p>`);
  await page.addScriptTag({ content: playerScript });
  await page.click('[data-demo-play]');
  await page.waitForFunction(() => document.querySelector('video').error);
  const state = () => page.$eval('video', video => ({ error: video.error?.code ?? null, network: video.networkState, ready: video.readyState, paused: video.paused, currentTime: video.currentTime }));
  const before = await state();
  const requestsBefore = requests;
  assert.equal(before.error, 2);
  assert.equal(before.network, 1, 'Midstream failures can retain NETWORK_IDLE.');
  await page.waitForSelector('[data-demo-play]:not([hidden])');
  healthy = true;
  await page.click('[data-demo-play]');
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return !video.error && !video.paused && video.currentTime > .3;
  }, { timeout: 5000 });
  const after = await state();
  assert.ok(requests > requestsBefore, 'Retry must request the restored MP4.');
  assert.equal(after.error, null);
  assert.equal(after.paused, false);
  assert.ok(after.currentTime > .3);
  console.log(JSON.stringify({ passed: true, before, after, requestsBefore, requests }));
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
