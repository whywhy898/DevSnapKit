import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { injectBeacon } from '../scripts/cf-beacon.mjs';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('beacon is absent without a token and injected once with a valid build token', () => {
  const html = '<html><head></head><body></body></html>';
  assert.equal(injectBeacon(html), html); assert.equal(injectBeacon(html, '"bad'), html);
  const result = injectBeacon(html, 'a'.repeat(32));
  assert.match(result, /https:\/\/static.cloudflareinsights.com\/beacon.min.js/);
  assert.equal(injectBeacon(result, 'a'.repeat(32)), result);
});
test('hero has a genuine before/after and accessible local image entry', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('hero-before-after') < html.indexOf('data-hero-drop'));
  for (const value of ['github-original.webp', 'github-styled.webp', 'for="hero-image"', 'type="file"', 'No watermark', 'Images never uploaded', 'Pro lifetime $9.9']) assert.ok(html.includes(value), value);
  const entry = read('public/seo/hero-entry.js');
  assert.match(entry, /dataTransfer\?\.files/); assert.match(entry, /DevSnapKitPendingImage = file/); assert.doesNotMatch(entry, /fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});

test('returning to the homepage resumes a persisted pending payment', () => {
  assert.match(read('src/main.tsx'), /\|\| readPendingOrder\(\)/);
});
test('export feedback and analytics run after the download click and never gate it', () => {
  const source = read('src/App.tsx');
  for (const method of ['const handleDownload', 'const handleBatchExport']) {
    const body = source.slice(source.indexOf(method), source.indexOf(method) + 4000);
    assert.ok(body.indexOf('link.click()') < body.indexOf('downloadStarted()'));
    assert.ok(body.indexOf('link.click()') < body.indexOf("trackEvent('export_image'"));
  }
  const card = read('src/ExportFeedback.tsx');
  assert.match(card, /sessionStorage\.getItem\(dismissedKey\)/); assert.match(card, /sessionStorage\.setItem\(dismissedKey/);
  assert.match(card, /window\.addEventListener\('dsk:download-started'/);
  assert.match(card, /maxLength=\{500\}/); assert.match(card, /deleted on request anytime/);
  assert.match(card, /catch \{ setStatus\('error'\)/); assert.doesNotMatch(card, /download=|\.click\(|prevent.*download/);
});
test('privacy source documents optional feedback D1 product updates and deletion contact', () => {
  const json = JSON.parse(read('src/legal/legalContent.json'));
  const section = json.privacy.sections.find(s => /Optional Email/.test(s.heading));
  const body = JSON.stringify(section);
  for (const phrase of ['Cloudflare D1', 'only for product updates', 'request deletion', 'support@devsnapkit.com']) assert.ok(body.includes(phrase), phrase);
});
