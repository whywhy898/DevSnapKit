import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from '../tests/helpers/browser.mjs';
import { startSeoServer } from '../tests/helpers/seo-server.mjs';

const remote = process.argv.find(arg => arg.startsWith('--origin='))?.slice(9);
const output = path.resolve(process.env.TEXT_DEMO_CHECK_OUTPUT || 'D:/workspace/MarkMoney/output/devsnapkit/text-demo-video-2026-10-30/browser');
await fs.mkdir(output, { recursive: true });
const server = remote ? null : await startSeoServer(() => ({}));
const origin = remote || server.origin;
const browser = await launchBrowser();
const result = { origin, cases: [], errors: [], blockedTelemetry: 0 };
let activePage;
try {
  for (const config of [{ width: 1440 }, { width: 390 }, { width: 390, dark: true, reducedMotion: true }, { width: 320, noScript: true }]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage(); activePage = page;
    page.setDefaultTimeout(20000);
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    page.on('pageerror', error => result.errors.push(error.message));
    await page.setViewport({ width: config.width, height: 1000, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: config.dark ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: config.reducedMotion ? 'reduce' : 'no-preference' }]);
    if (config.noScript) await page.setJavaScriptEnabled(false);
    if (remote) {
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url().includes('/api/telemetry/event')) {
          result.blockedTelemetry++;
          return request.respond({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        }
        return request.continue();
      });
    }
    await page.goto(`${origin}/add-text-to-image/`, { waitUntil: 'networkidle0' });
    const initial = await page.evaluate(() => {
      const video = document.querySelector('.guide-demo video');
      const rect = video.getBoundingClientRect();
      return { autoplay: video.autoplay, paused: video.paused, preload: video.preload, controls: video.controls, inline: video.playsInline, videoCSSWidth: rect.width, videoCSSHeight: rect.height, labelled: !!document.getElementById(video.getAttribute('aria-labelledby'))?.textContent, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert.equal(initial.autoplay, false);
    assert.equal(initial.paused, true);
    assert.equal(initial.preload, 'none');
    assert.equal(initial.controls, !!config.noScript);
    assert.equal(initial.inline, true);
    assert.equal(initial.labelled, true);
    assert.equal(initial.overflow, false);
    assert.ok(Math.abs(initial.videoCSSWidth / initial.videoCSSHeight - 16 / 9) < .02);
    assert.equal(requests.filter(url => url.endsWith('add-text-demo.mp4')).length, 0, 'No video bytes requested before playback.');
    await page.$eval('.guide-demo', node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.screenshot({ path: path.join(output, `poster-${config.width}${config.dark ? '-dark' : config.noScript ? '-no-script' : ''}.png`), fullPage: false });
    if (!config.noScript) {
      await page.focus('[data-demo-play]');
      await page.keyboard.press('Space');
      await page.waitForFunction(() => { const v = document.querySelector('video'); return !v.paused && v.currentTime > .4 && v.readyState >= 2; });
      const media = await page.$eval('video', video => ({ width: video.videoWidth, height: video.videoHeight, duration: video.duration, error: video.error?.message }));
      assert.equal(media.width, 1280); assert.equal(media.height, 720);
      assert.ok(media.duration > 20 && media.duration < 45);
      assert.equal(media.error, undefined);
      await page.$eval('video', video => { video.pause(); video.textTracks[0].mode = 'showing'; });
      await page.waitForFunction(() => document.querySelector('video').textTracks[0].cues?.length > 0);
      const cues = await page.$eval('video', video => [...video.textTracks[0].cues].map(cue => ({ start: cue.startTime, end: cue.endTime, text: cue.text })));
      assert.ok(cues.every((cue, index) => cue.start < cue.end && (!index || cue.start >= cues[index - 1].end - .005)));
      const seeks = [];
      for (const at of config.width === 1440 ? [3, 7, 12, 18, 25, media.duration - 1] : [7, media.duration - 1]) {
        await page.$eval('video', (video, at) => new Promise((resolve, reject) => {
          video.addEventListener('seeked', resolve, { once: true });
          video.addEventListener('error', reject, { once: true });
          video.currentTime = at;
        }), at);
        assert.ok(await page.$eval('video', (video, at) => Math.abs(video.currentTime - at) < .1 && video.readyState >= 2, at));
        seeks.push(at);
      }
      await page.screenshot({ path: path.join(output, `played-${config.width}${config.dark ? '-dark' : ''}.png`), fullPage: false });
      // Keyboard can also resume and pause the same player.
      await page.focus('video'); await page.keyboard.press('Space');
      await page.waitForFunction(() => !document.querySelector('video').paused);
      await page.keyboard.press('Space');
      await page.waitForFunction(() => document.querySelector('video').paused);
      await page.$eval('video', video => { video.currentTime = video.duration - .1; });
      await page.$eval('video', video => video.play());
      await page.waitForFunction(() => document.querySelector('video').ended && !document.querySelector('[data-demo-play]').hidden);
      assert.match(await page.$eval('[data-demo-play]', node => node.getAttribute('aria-label')), /^Replay/);
      await page.focus('[data-demo-play]'); await page.keyboard.press('Space');
      await page.waitForFunction(() => { const v = document.querySelector('video'); return !v.paused && v.currentTime > .1 && v.currentTime < 2; });
      await page.$eval('video', video => video.pause());
      result.cases.push({ ...config, ...initial, media, cues: cues.length, seeks });
    } else result.cases.push({ ...config, ...initial, staticFallback: true });
    await context.close();
  }
  // A failed media request must retain native controls and an actionable fallback.
  {
    const context = await browser.createBrowserContext();
    const page = await context.newPage(); activePage = page;
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: 390, height: 1000 });
    await page.setRequestInterception(true);
    let failMedia = true;
    page.on('request', request => {
      if (failMedia && request.url().endsWith('/seo/video/add-text-demo.mp4')) return request.respond({ status: 404, body: '' });
      if (remote && request.url().includes('/api/telemetry/event')) { result.blockedTelemetry++; return request.respond({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
      return request.continue();
    });
    await page.goto(`${origin}/add-text-to-image/`, { waitUntil: 'networkidle0' });
    await page.click('[data-demo-play]');
    await page.waitForSelector('[data-demo-status]:not([hidden])');
    assert.equal(await page.$eval('video', video => video.controls && video.tabIndex === 0), true);
    assert.ok(await page.$('.demo-footer a[href="/seo/video/add-text-demo.mp4"]'));
    failMedia = false;
    await page.click('[data-demo-play]');
    await page.waitForFunction(() => { const video = document.querySelector('video'); return !video.paused && video.currentTime > .1 && document.querySelector('[data-demo-status]').hidden; });
    result.cases.push({ width: 390, failedMediaFallback: true, retryRecovered: true });
    await context.close();
  }
  const range = await fetch(`${origin}/seo/video/add-text-demo.mp4`, { headers: { Range: 'bytes=0-1023' } });
  const bytes = Buffer.from(await range.arrayBuffer());
  assert.equal(range.status, 206);
  assert.equal(bytes.length, 1024);
  assert.match(range.headers.get('content-range'), /^bytes 0-1023\//);
  assert.ok(range.headers.get('content-type').includes('video/mp4'));
  const captions = await fetch(`${origin}/seo/video/add-text-demo.en.vtt`);
  assert.equal(captions.status, 200);
  assert.ok(captions.headers.get('content-type').includes('text/vtt'));
  assert.ok((await captions.text()).startsWith('WEBVTT'));
  assert.deepEqual(result.errors, []);
  result.range = { status: range.status, bytes: bytes.length, contentRange: range.headers.get('content-range') };
  result.passed = true;
} catch (error) {
  result.passed = false; result.error = error.stack; process.exitCode = 1;
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
} finally {
  await browser.close(); await server?.close();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, cases: result.cases.length, error: result.error?.split('\n')[0], output }));
}
