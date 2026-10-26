import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
const load = createTypeScriptLoader(fileURLToPath(new URL('../src/', import.meta.url)));
test('upgrade presents exactly four paid abilities and explicitly includes branding in Free', () => {
  assert.ok(fs.existsSync(new URL('../src/ProUpsellContent.tsx', import.meta.url)), 'focused upgrade content exists');
  const { ProUpsellContent } = load('ProUpsellContent.tsx');
  const html = renderToStaticMarkup(createElement(ProUpsellContent));
  assert.equal((html.match(/<li/g) || []).length, 4);
  for (const copy of ['Pro includes', 'Premium templates', 'High-resolution export presets', 'Batch export', 'Premium gradient backgrounds', 'Text, logo uploads and QR codes are included in Free.', 'final pixel dimensions']) assert.ok(html.includes(copy), copy);
  assert.doesNotMatch(html, /Dynamic QR|4x|3840|Logo.*Pro|WebP.*Pro|brand kit|cloud save/i);
});
test('dynamic sales and success surfaces use the shared copy', () => {
  const { productCopy } = load('productCopy.ts');
  assert.match(productCopy.price, /\$1 USD/);
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /productCopy\.price/);
  assert.match(app, /productCopy\.activation/);
  assert.match(app, /productCopy\.success/);
  assert.doesNotMatch(app, /Everything Included Forever|Dynamic QR Code on Every Visual|up to 3840px|Lifetime commercial access|All Pro features, 32 themes/);
});
test('static pages consistently describe Free branding and actual Pro abilities', () => {
  for (const page of ['og-image-generator', 'product-hunt-image-maker', 'add-text-to-image']) {
    const html = fs.readFileSync(new URL(`../public/${page}/index.html`, import.meta.url), 'utf8');
    assert.doesNotMatch(html, /Pro logo slot|logo slot is Pro|logo slot, batch export|batch export and the logo slot/);
    assert.match(html, /logo.*[Ff]ree|[Ff]ree.*logo/);
    assert.match(html, /premium templates/i);
  }
});
test('existing formats remain Free and no resolution implementation changes are required', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /exportScale === 4 && !isProUnlocked/);
  assert.doesNotMatch(app, /exportFormat === ['"]webp['"] && !isProUnlocked/);
});
