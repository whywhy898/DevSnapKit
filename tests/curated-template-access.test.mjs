import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTypeScriptLoader } from './helpers/load-typescript.mjs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const load = createTypeScriptLoader(fileURLToPath(new URL('../', import.meta.url)));
test('curated application denies unknown IDs and gates Night/Pocket while Honey and Paper stay free', () => {
  const { canApplyCuratedTemplate } = load('src/templates/collection/access.ts');
  for (const unlocked of [false, true]) {
    for (const id of ['editorial-honey', 'paper-launch-duo', 'calm-split', 'app-pair']) assert.equal(canApplyCuratedTemplate(id, unlocked), true, id);
    for (const id of ['unknown', '', '__proto__', 'studio-bridge']) assert.equal(canApplyCuratedTemplate(id, unlocked), false, id);
    assert.equal(canApplyCuratedTemplate('night-signal-duo', unlocked), unlocked);
    assert.equal(canApplyCuratedTemplate('pocket-flow-duo', unlocked), unlocked);
  }
});
test('premium templates add one ability without changing free branding or existing paid IDs', () => {
  const policy = load('shared/productCapabilities.ts');
  assert.equal(policy.CAPABILITY_POLICY_VERSION, 2);
  assert.deepEqual(Array.from(policy.PRO_FEATURES), ['4k_export', 'batch_export', 'all_gradients', 'premium_templates']);
  for (const ability of ['canvas_text', 'brand_logo', 'qr_code', 'png_export', 'webp_export', 'jpeg_export', 'legacy_brand_badge', 'custom_watermark']) {
    assert.equal(policy.canUse(ability, false), true);
  }
});
test('gallery lists only implemented designs with complete-image preview and separate application controls', () => {
  const { TemplateMenu } = load('src/templates/TemplateMenu.tsx');
  const html = renderToStaticMarkup(createElement(TemplateMenu, { onApply() {}, onDesignedApply() {}, disabled: false, busy: false }));
  assert.equal((html.match(/<article/g) || []).length, 6);
  for (const name of ['Editorial Honey', 'Paper Launch Duo', 'Calm Split', 'App Pair', 'Night Signal Duo', 'Pocket Flow Duo']) {
    assert.ok(html.includes(`Apply ${name} template`), name);
    assert.ok(html.includes(`Preview ${name} template`), name);
  }
  assert.equal((html.match(/object-contain/g) || []).length, 6);
  for (const size of ['1600 × 1200', '1200 × 630', '1080 × 1080', '1080 × 1920']) assert.ok(html.includes(size), size);
  assert.match(html, />Pro</);
  assert.doesNotMatch(html, /Studio Bridge|Basic layouts|Apply Minimal|Apply Split/);
});
test('template browsing participates in the text editor focus boundary before authorization', () => {
  const { TemplateMenu } = load('src/templates/TemplateMenu.tsx');
  const html = renderToStaticMarkup(createElement(TemplateMenu, { onApply() {}, disabled: false, busy: false }));
  assert.match(html, /data-text-editor-ui/);
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /<button\s+data-template-trigger\s+data-text-editor-ui/);
  assert.match(app, /closest\('\[data-template-trigger\], \[data-template-gallery\], \[data-template-preview\], \[data-template-dismiss\]'\)/);
  const preview = fs.readFileSync(new URL('../src/templates/TemplatePreview.tsx', import.meta.url), 'utf8');
  assert.match(preview, /<dialog data-template-preview data-text-editor-ui/);
});
test('gallery dismissal invalidates only its request and stale completion cannot release newer admission', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /const dismissTemplateGallery = \(\) => \{\s*templateRequest\.current\+\+;/);
  assert.match(app, /if \(e\.key === 'Escape' && showDemoTemplatesMenu\) \{[^}]*dismissTemplateGallery\(\); return;/);
  assert.match(app, /finally \{ if \(request === templateRequest\.current\) \{ applyingTemplate\.current = false; setPreparingTemplate\(false\); \} \}/);
  assert.match(app, /showDemoTemplatesMenu \? dismissTemplateGallery\(\) : setShowDemoTemplatesMenu\(true\)/);
});
