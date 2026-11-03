# Premium Template Trio Implementation Plan

> For agentic workers: use subagent-driven-development for the implementation unit and independent specification and quality reviews. Execute this approved batch without further design approval prompts.

**Goal:** Add Violet Launch, Electric Pair and Peach Editorial as three native editable templates matching the approved concepts.
**Architecture:** Add declarative blueprints, six self-authored sample screens, existing catalog/application registry entries and actual-browser export previews. Keep the renderer and the original 12 entries unchanged.
**Tech Stack:** Existing TypeScript composition data, SVG sample sources, Node test runner, Puppeteer browser checks and Sharp for preview encoding.

Approved on 2026-11-03 by the user: all three concepts are good and can be produced together. Visual brief: D:/workspace/MarkMoney/output/devsnapkit/premium-template-concepts-2026-11-03/design-brief.md. Reference PNGs sit beside that brief. Worktree: D:/workspace/MarkMoney/apps/shotcraft-worktrees/premium-trio; branch codex/premium-template-trio. Native worktree creation cannot select this nested repository, so git fallback was used outside the source checkout.

## Task 1 — New template contracts and baseline

Files: tests/premium-trio.test.mjs; docs/superpowers/specs/2026-11-03-premium-template-trio.md.

- [x] Verify the original checkout is clean and create the isolated branch.
- [x] Run the current catalog/access/groups/remaining-template baseline: 30 passed, 0 failed.
- [x] Add integration contracts for all three IDs, preserving uploads, brand data, editability, authored single-image layouts, restore/reset and complete undo/redo.
- [x] Run node --test --test-reporter=tap tests/premium-trio.test.mjs and confirm failures are missing-template failures.

The contract invokes the existing public factory directly:
```js
const next=buildCuratedSnapshot(before,'violet-launch','trio');
assert.equal(next.compositionDocument.templateId,'violet-launch');
assert.deepEqual(next.customCanvasSize,{width:1920,height:1080});
history.flush(next);
assert.deepEqual(history.undo(next),before);
```

## Task 2 — Complete native composition and source samples

Create:
- src/templates/collection/definitions/violet-launch.ts
- src/templates/collection/definitions/electric-pair.ts
- src/templates/collection/definitions/peach-editorial.ts
- scripts/build-premium-trio-samples.mjs
- public/designed/examples/collection/trio-studio-library.svg
- public/designed/examples/collection/trio-studio-detail.svg
- public/designed/examples/collection/trio-workspace-overview.svg
- public/designed/examples/collection/trio-workspace-activity.svg
- public/designed/examples/collection/trio-journal-home.svg
- public/designed/examples/collection/trio-journal-article.svg
- public/designed/examples/collection/premium-trio-samples.json

Modify src/templates/collection/types.ts, apply.ts, catalog.ts and existing tests with fixed original count assumptions. Keep first 12 ordering and tiers unchanged. Reuse existing shared premium access policy for Pro additions; final tier follows the user's pending preference, defaulting to existing Pro if unanswered after other work.

- [x] Implement all three approved compositions using native text and decorations, exactly two replaceable screenshot slots and explicit singlePlacement.
- [x] Use the geometry and palette in the approved brief; no poster CTA and no decorative arrows.
- [x] Make six original example SVG screens with embedded existing licensed Manrope/Gelasio fonts; use .example domains, neutral fictional labels and initial avatars.
- [x] For journal imagery prefer native stylized desert artwork; do not reuse a full generated poster as a screenshot. Record authored vector nature honestly.
- [x] Generate deterministic samples and a source/size/license manifest.
- [x] Register all three in catalog and factory without changing old definitions, restored documents or premium feature IDs.
- [x] Run the new integration contracts and the existing template/access/groups tests; all pass.
- [x] Run the TypeScript/build check. Review the diff before committing explicit files.

## Task 3 — Real editor verification and previews

Create tests/run-premium-trio-browser.mjs, scripts/build-premium-trio-previews.mjs, tests/premium-trio-browser.md. Evidence goes to D:/workspace/MarkMoney/output/devsnapkit/premium-template-implementation-2026-11-03.

- [x] Use tests/vite-mockup-baseline.config.mjs and the existing helpers/browser.mjs to run the actual editor on a dedicated free port.
- [x] For each new template apply through the gallery, check two decoded independent images, edit headline through Inspector, Undo/Redo, hide/reveal secondary and verify authored single layout.
- [x] Test independent main/secondary upload replacement and template switch preservation.
- [x] Exercise free preview without document mutations and the existing Pro gate for Pro IDs, plus valid-license fixtures; do not alter real licensing or payments.
- [x] Download actual PNG at 1x and 2x, plus single image, confirming exact target sizes; compare preview/export geometry. Check actual WebP/JPEG downloads.
- [x] Check 390px gallery preview and desktop composition. Capture actual default PNGs and snapshots.
- [x] Generate catalog thumbnails at width 480 and full-size preview WebP from the actual downloaded default PNGs only; save provenance and source hashes.
- [x] Visually inspect all three native PNGs; repair text wrapping/overlap and rerun affected scenarios.
- [x] Run updated legacy browser/template regression and build once after final modifications.
- [x] Independent spec review, then independent quality review; resolve findings and rerun affected checks.
- [x] Commit explicit implementation/evidence source files. Leave the worktree and local review server available; do not merge or deploy without a separate instruction.

## Completion evidence

Report actual template PNGs, review URL, branch and commit, focused regression totals, build result and remaining limitations. Original generated concepts and actual native output must stay clearly identified. PNG deliveries must have no EXIF/XMP/C2PA file metadata; verify actual output structure before delivery.
