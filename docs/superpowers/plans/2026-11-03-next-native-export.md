# NEXT Native Export Implementation Plan

> For agentic workers: use subagent-driven-development for the implementation unit, followed by independent spec and quality reviews.

**Goal:** Produce a real editable NEXT proof and browser-downloaded native PNG at 1080x1920 and 2160x3840.
**Architecture:** Add one authoring-only blueprint and two sample screens to the current factory. Leave published catalog and entitlement policy intact. Load the document through the existing test-only state driver and use the shipped canvas renderer and download buttons.
**Tech Stack:** Existing TypeScript composition model, SVG UI, separate PNG artwork, Node tests, Puppeteer and Sharp.

Worktree: D:/workspace/MarkMoney/apps/shotcraft-worktrees/next-native, codex/next-native-export, base95b7e83. Native worktree tool previously cannot select this nested repository; git fallback used. Baseline29 catalog/access/trio/geometry checks passed. Approved proof requirements are in docs/superpowers/specs/2026-11-03-next-native-export.md.

## 1. Contract
- [x] Add tests/next-stage.test.mjs and run node --test --test-reporter=tap tests/next-stage.test.mjs, observing missing-ID failures before production implementation.
- [x] Verify native headline layer precedes both media in order, independent sources and branding survive, single fallback is authored, restore/reset/history preserve edits, and unpublished NEXT cannot pass catalog-based access checks.

Contract entry:
```js
const n=buildCuratedSnapshot(before,'next-stage','next-proof');
assert.deepEqual(n.customCanvasSize,{width:1080,height:1920});
assert.equal(n.textDocument.layers.find(t=>t.id===n.templateContext.textRoles.headline).content,'N\nE\nX\nT');
```

## 2. Native proof and samples
Create src/templates/collection/definitions/next-stage.ts, scripts/build-next-stage-samples.mjs, tests/next-stage-samples.test.mjs and public/designed/examples/next-stage/{album-cover.png,tone-player.svg,tone-collection.svg,samples.json}.
Modify src/templates/collection/types.ts and apply.ts to support factory-only next-stage; do not modify catalog.ts, access.ts, renderer or pricing.

- [x] Native charcoal background, lime four-line headline, ivory top-right/footer copy, two dark shells with opposite rotations and one thin ellipse.
- [x] Main dark player and light collection independently authored with embedded licensed font and separate artwork; no duplicated phone chrome within screenshots.
- [x] Generate one square album artwork separately with image_gen, re-encode/verify no file metadata; root owns artwork. Source generation must be documented in sample manifest.
- [x] Embed artwork in SVG samples for predictable decode/export. Use same cover as a logically shared album across screens, with distinct screen contents.
- [x] Narrow LF attributes for hashed new SVG/JSON, deterministic generation, license and source hashes.
- [x] Run new contracts plus existing29 baseline; build passes.

## 3. Actual export and visual correction
Create tests/run-next-native-browser.mjs. Root owns this runner, artwork cleanup and output review page.

- [x] Start QA-configured Vite from the isolated worktree on5391. Apply factory-built native document using the existing __mockupBaseline test driver, with a simulated Pro fixture for canonical export settings.
- [x] Confirm current gallery remains15 and NEXT is not publicly listed; this is not an entitlement bypass in shipped code.
- [x] Download default duo at1x/2x, author single at1x, edited-headline output, and independent-upload variants using normal Export/Download controls.
- [x] Compare preview/export element geometry; assert native headline is below devices and not a baked background.
- [x] Verify user text edit/Undo, hidden-secondary source retention, independent main/secondary replacement and restore/reset.
- [x] View actual PNG and correct geometry/screen sizing once evidence identifies an issue.
- [x] Check output metadata and save snapshots, geometry, source hashes and results.
- [x] Independent spec review, then code-quality review; fix important findings and rerun affected checks.
- [x] Commit explicit proof files on isolated branch and provide native PNG + local concept comparison, leaving source checkout and published catalog unchanged.
