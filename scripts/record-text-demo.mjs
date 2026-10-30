import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, clickButton, finishTextEditing, downloadPng } from '../tests/helpers/browser.mjs';
import { startSeoServer } from '../tests/helpers/seo-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(process.env.TEXT_DEMO_OUTPUT || 'D:/workspace/MarkMoney/output/devsnapkit/text-demo-video-2026-10-30');
await fs.mkdir(output, { recursive: true });
const server = await startSeoServer(() => ({}));
const browser = await launchBrowser();
const page = await browser.newPage();
page.setDefaultTimeout(20000);
const result = { source: 'Actual local DevSnapKit build', browser: await browser.version(), viewport: { width: 1600, height: 900 }, marks: [], actions: [], errors: [] };
let recorder;
let started;
let pointer = { x: 720, y: 820 };
let dragging = false;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const seconds = () => (performance.now() - started) / 1000;
async function box(selector) {
  const element = await page.waitForSelector(selector, { visible: true });
  await element.evaluate(node => node.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  const rect = await element.boundingBox();
  assert.ok(rect, selector);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, width: rect.width, height: rect.height };
}
async function tween(target, duration = 600) {
  const from = { ...pointer };
  const frames = Math.ceil(duration / 20);
  for (let i = 1; i <= frames; i++) {
    const t = i / frames, ease = t * t * (3 - 2 * t);
    pointer = { x: from.x + (target.x - from.x) * ease, y: from.y + (target.y - from.y) * ease };
    await page.mouse.move(pointer.x, pointer.y);
    await pause(duration / frames);
  }
}
async function move(target, duration = 600) {
  // Use the clear strip above the canvas for long traversals. This avoids
  // triggering the unrelated image-hover affordance while moving to controls.
  const crossesCanvas = Math.hypot(pointer.x - target.x, pointer.y - target.y) > 350 && Math.min(pointer.x, target.x) < 1120;
  if (!dragging && crossesCanvas) {
    await tween({ x: pointer.x, y: 120 }, duration * .25);
    await tween({ x: target.x, y: 120 }, duration * .45);
    await tween(target, duration * .3);
  } else await tween(target, duration);
}
async function ripple() {
  await page.evaluate(() => {
    const ring = document.querySelector('[data-demo-click]');
    ring.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: .85 }, { transform: 'translate(-50%,-50%) scale(1.8)', opacity: 0 }], { duration: 420, easing: 'ease-out' });
  });
}
async function click(selector, duration = 550) {
  const target = await box(selector);
  await move(target, duration);
  await ripple();
  await page.mouse.click(target.x, target.y);
  result.actions.push({ at: seconds(), action: 'click', selector, target });
  await pause(250);
}
async function mark(name, caption, zoom = 1, target = { x: 800, y: 450 }) {
  result.marks.push({ at: seconds(), name, caption, zoom, x: target.x / 1600, y: target.y / 900 });
}
async function field(label, value) {
  const selector = `[aria-label="${label}"]`;
  const target = await box(selector);
  await mark(`field-${label}`, 'Choose a size that reads clearly.', 1.65, target);
  await click(selector);
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.type(value, { delay: 160 });
  await page.keyboard.press('Enter');
  await pause(650);
}

try {
  await page.setViewport({ ...result.viewport, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.evaluateOnNewDocument(() => localStorage.setItem('devsnapkit_welcome_seen', '1'));
  page.on('pageerror', error => result.errors.push(error.message));
  await page.goto(`${server.origin}/?editor=1&tool=text`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#studio-canvas');
  const chooser = page.waitForFileChooser();
  await page.click('button[title="Upload screenshot from computer"]');
  await (await chooser).accept([path.join(root, 'public/seo/examples/text-original.png')]);
  await page.waitForFunction(() => [...document.querySelectorAll('#studio-canvas img')].some(image => image.complete && image.naturalWidth > 0 && /^(blob:|data:image\/png)/.test(image.src)));
  // Choose an actual light canvas preset so the newly created text has strong
  // contrast from the very first typed character, including over a white UI.
  await clickButton(page, 'Canvas');
  await clickButton(page, 'Solid');
  await page.click('aside.studio-inspector button[title="Soft Gray"]');
  await clickButton(page, 'Text');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '*{cursor:none!important}[data-demo-cursor]{position:fixed;width:28px;height:34px;z-index:2147483646;pointer-events:none;filter:drop-shadow(0 2px 2px #10203855)}[data-demo-click]{position:fixed;width:32px;height:32px;border:3px solid #6d55ed;border-radius:50%;z-index:2147483645;pointer-events:none;opacity:0}';
    document.head.append(style);
    const cursor = document.createElement('div'); cursor.dataset.demoCursor = '';
    cursor.innerHTML = '<svg width="28" height="34" viewBox="0 0 28 34"><path d="M4 2v25l6-6 5 10 5-3-5-10h9Z" fill="#17243b" stroke="white" stroke-width="2.5" stroke-linejoin="round"/></svg>';
    const ring = document.createElement('div'); ring.dataset.demoClick = '';
    document.body.append(cursor, ring);
    document.addEventListener('mousemove', event => {
      cursor.style.left = event.clientX - 4 + 'px'; cursor.style.top = event.clientY - 2 + 'px';
      ring.style.left = event.clientX + 'px'; ring.style.top = event.clientY + 'px';
    });
  });
  await page.mouse.move(pointer.x, pointer.y);
  await page.screenshot({ path: path.join(output, 'before.png') });
  recorder = await page.screencast({ path: path.join(output, 'raw.mp4'), format: 'mp4', fps: 30, quality: 16 });
  started = performance.now();
  await mark('original', 'A screenshot. A little more context.');
  await pause(1700);
  const add = '[data-canvas-text-controls] button[aria-label="Add another text"]';
  const addTarget = await box(add);
  await mark('add', 'Click Add text to create a caption.', 1.5, addTarget);
  await pause(650);
  await click(add);
  const text = await box('[aria-label="Text content"]');
  await mark('type', 'Write the headline your screenshot needs.', 1.2, text);
  await move(text, 450);
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.type('Understand CSS grid.', { delay: 95 });
  await pause(900);
  await finishTextEditing(page);
  await pause(300);
  const font = await box('[aria-label="Text font"]');
  await mark('font', 'Pick a typeface. Make it your own.', 1.7, font);
  await pause(550);
  await click('[aria-label="Text font"]');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await pause(900);
  await field('Text size', '42');
  await page.$eval('aside.studio-inspector', node => { node.scrollTop = 0; });
  const drag = await page.evaluate(() => {
    const canvas = document.querySelector('#studio-canvas').getBoundingClientRect();
    const glyph = document.querySelector('[data-canvas-text]').getBoundingClientRect();
    const handle = document.querySelector('[aria-label="Move text"]');
    if (!handle) return { labels: [...document.querySelectorAll('[data-text-editor-ui] button')].map(node => node.getAttribute('aria-label')) };
    const h = handle.getBoundingClientRect();
    return { from: { x: h.x + h.width / 2, y: h.y + h.height / 2 }, to: { x: h.x + h.width / 2 + canvas.x + canvas.width / 2 - (glyph.x + glyph.width / 2), y: h.y + h.height / 2 + canvas.y + canvas.height * 44 / 816 - (glyph.y + glyph.height / 2) }, focus: { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 } };
  });
  assert.ok(drag.from, 'Real Move text handle: ' + JSON.stringify(drag));
  await mark('move', 'Move the caption into clear space.', 1.05, drag.focus);
  await pause(850);
  await move(drag.from, 550);
  await ripple();
  await page.mouse.down();
  dragging = true;
  await move(drag.to, 1500);
  await page.mouse.up();
  dragging = false;
  result.actions.push({ at: seconds(), action: 'drag', ...drag });
  await pause(1000);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-canvas-text]')].some(node => node.textContent === 'Understand CSS grid.'));
  const exportTab = '[data-inspector-tabs] button:last-child';
  const exportTarget = await box(exportTab);
  await mark('export', 'Open Export and download your image.', 1.5, exportTarget);
  await pause(600);
  await click(exportTab);
  const downloadSelector = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(node => node.getClientRects().length && /^Download (?:[124]x|4K)/.test(node.textContent.trim()));
    if (button) button.dataset.demoDownload = '';
    return button ? '[data-demo-download]' : null;
  });
  assert.ok(downloadSelector, 'Visible actual Download button');
  const downloadTarget = await box(downloadSelector);
  await mark('download', 'Your screenshot and words, ready to share.', 1.55, downloadTarget);
  await pause(700);
  result.download = await downloadPng(page, output, 'actual-export.png', () => click(downloadSelector));
  await pause(650);
  await mark('done', 'Your screenshot and words, ready to share.');
  result.recordedDuration = seconds();
  await recorder.stop(); recorder = null;
  await page.screenshot({ path: path.join(output, 'after.png') });
  result.text = await page.$eval('[data-canvas-text]', node => ({ text: node.textContent, style: node.getAttribute('style') }));
  result.events = server.events.map(event => ({ event: event.event, seoEntry: event.metadata?.seo_entry }));
  assert.deepEqual(result.errors, []);
  assert.ok(server.events.some(event => event.event === 'export_image'));
  result.passed = true;
} catch (error) {
  result.passed = false; result.error = error.stack;
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  result.diagnostics = await page.evaluate(() => document.body.innerText.slice(-5000)).catch(() => '');
  process.exitCode = 1;
} finally {
  if (recorder) await recorder.stop().catch(() => {});
  await browser.close();
  await server.close();
  await fs.writeFile(path.join(output, 'recording.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, duration: result.recordedDuration, error: result.error?.split('\n')[0], output }));
}
