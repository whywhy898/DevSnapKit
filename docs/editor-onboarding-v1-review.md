# Editor onboarding v1 — implementation and verification

Branch: `feat/editor-onboarding-v1`. No push or deployment was performed.

## Commits and worktree

No commits were created. Native Git staging failed with:

`fatal: Unable to create 'D:/workspace/MarkMoney/apps/shotcraft/.git/index.lock': Permission denied`

The managed filesystem grants read access to `.git`; it prevents index/ref writes. Changes are preserved in the worktree, so the requested clean worktree and logical commits could not be completed. No alternate Git write mechanism was used.

Suggested logical commits once Git writes are available:

1. `fix(editor): place new text in free screenshot margins` — placement, composition space reservation, and text regressions.
2. `fix(editor): remove welcome and clarify export access` — direct CTA entry, resolution labels, free batch lock, and label fixtures.
3. `fix(editor): standardize dialog keyboard and focus behavior` — shared Modal, related dialogs, and browser regression coverage.

## Tester-visible changes

1. Open the homepage and click **Create Your First Mockup**; also test **Add text to a screenshot** on /add-text-to-image/ and the floating studio card on /og-image-generator/. The editor opens immediately without a welcome overlay, including a fresh browser with neither legacy welcome flag. Payment-return links still open license recovery, title/theme links still prefill, legal links still open their dialog, and /admin keeps its routing.
2. In the editor, click **Add text** in the canvas toolbar or Elements → Text. The new box goes above the screenshot when usable space exists. Other free outer margins are considered before overlapping existing text. If necessary, regular padding increases; independent composition media is fitted below a reserved header. Small canvases use a fitting placeholder size. The placeholder **Text** is focused and selected, so typing replaces it. Existing text keeps its placement.
3. Open **Export**, or the canvas **Download** menu. Resolution options identify Free vs Pro; actual dimensions remain visible. The exceptions below use **Free QHD** and **Pro 3.2K**, including corresponding download labels. For a free user, batch checkboxes are unchecked and locked, with a lock icon and upgrade hint. Clicking the area, a checkbox, or its upgrade button opens Pro. Keyboard activation works too. Verified Pro users retain the previous four default batch sizes and normal selection/export behavior.
4. Open Pro, focus its license field, and press **Esc**. It closes and restores focus to its opener. Repeat with license activation, purchase success, shortcuts, and legal dialogs. Tab stays in the active dialog. Pro → claim transitions and stacked claim/legal dialogs preserve sensible focus; development-mode cleanup cannot override restored focus.

## Real export limits found

Entitlement checks gate the scale-4 preset and batch export behind server-verified Pro. Free users have 1x and the existing 2x preset. These are presets, not a universal pixel-count ceiling; Pro also retains the free presets.

| Aspect | Free 1x | Free higher preset | Pro higher preset |
| --- | --- | --- | --- |
| Auto / Custom | Logical canvas size | Twice each logical dimension | 3840px longest edge, aspect preserved |
| OG / Twitter | 1200×630 | 2400×1260 | 3840×2016 |
| 16:9 | 1920×1080 | **2560×1440, Free QHD** | 3840×2160 |
| 4:3 | 1200×900 | 2400×1800 | **3200×2400, Pro 3.2K** |
| Square | 1080×1080 | 2160×2160 | 3840×3840 |
| Instagram post | 1080×1350 | 2160×2700 | 3072×3840 |
| Instagram story | 1080×1920 | 2160×3840 | 2160×3840 |
| LinkedIn | 1200×627 | 2400×1254 | 3840×2006 |
| YouTube | 1280×720 | 2560×1440 | 3840×2160 |

The higher free option is labeled **Free 2x** except 16:9, which is truthfully **Free QHD**. Pro is **Pro 4K** except 4:3, which is **Pro 3.2K**. Free can already reach a 3840px edge for Instagram stories; custom 2x exports can exceed the Pro 4K preset dimensions. No entitlement or rendering limits were changed.

Sources in the repo: src/license.ts, App's single/batch export admission checks, and src/canvasDimensions.ts.

## Verification

Final requested checks:

| Command | Result |
| --- | --- |
| npm run test:seo | PASS — 111 |
| npm run test:security | PASS — 28; 1 existing browser-only test skipped without TEST_UI_URL |
| npm run test:license | PASS — 53 |
| npm run test:paypal | PASS — 35 |
| npm run test:poster:v1 | PASS — 6 |
| npm run test:canvas-text:v1 | PASS — 26 |
| node tests/run-editor-onboarding-browser.mjs | PASS — 7 browser regressions |
| npm run build | PASS — TypeScript + Vite; existing >500kB chunk warning |
| git diff --check | PASS |

The broader existing text browser suite completed 63 cases: 57 initially passed and 6 failed. Five failed cases subsequently passed focused reruns: two multiline recovery fixtures, repeated-text margin packing, the actual headline pixel region, and a navigation timeout. There was no final full-suite rerun after those focused fixes.

One broader test remains failing: **T5 actual Set controls export 200×200, 8000×200 and 200×8000 ... visible 8/160 text**, at the assertion **Font 8 has real visible pixels**. It also failed when Vite served the original text document and editor hook from HEAD, while keeping the other current modules. It appears unrelated to the placement change; it has not been suppressed or weakened. Full-run evidence is in scratch/editor-onboarding/text-browser.log.

Build-generated public/terms/index.html and public/privacy/index.html were byte-identical to HEAD. No restoration was needed.

An independent read-only review found the composition header and stacked-focus edge cases; both have regressions and were fixed. Final review found no remaining important issues in the reviewed changes.

## Open questions / remaining work

- Enable normal Git writes to .git to create the logical commits and finish with a clean worktree.
- Investigate the existing 8px export pixel assertion separately. The six requested test commands and the seven new browser regressions pass.
- No remaining product-design questions.

## Files changed (48)

Test-file changes mostly update old resolution labels; text browser tests also accept an output root inside the workspace. The text runner can save a long-run report.

- docs/editor-onboarding-v1-review.md
- docs/plans/2026-11-11-editor-onboarding-v1.md
- src/App.tsx
- src/LegalModals.tsx
- src/Modal.tsx
- src/WelcomeOverlay.tsx
- src/composition/document.ts
- src/text/document.ts
- src/text/useCanvasTextEditor.ts
- tests/canvas-text-geometry-perf.test.mjs
- tests/canvas-text-geometry-ui.test.mjs
- tests/canvas-text-movement-ui.test.mjs
- tests/canvas-text-output-perf.test.mjs
- tests/canvas-text-output-ui.test.mjs
- tests/canvas-text-polish-ui.test.mjs
- tests/canvas-text-ux-ui.test.mjs
- tests/canvas-text-v1-export.test.mjs
- tests/canvas-text-v1-ui.test.mjs
- tests/canvas-text-v1.test.mjs
- tests/editor-onboarding-ui.test.mjs
- tests/mockup-export-baseline.test.mjs
- tests/run-app-pair-export-browser.mjs
- tests/run-app-pair-template-browser.mjs
- tests/run-brand-free-browser.mjs
- tests/run-brand-permissions-browser.mjs
- tests/run-calm-export-browser.mjs
- tests/run-calm-template-browser.mjs
- tests/run-canvas-text-browser.mjs
- tests/run-designed-templates-browser.mjs
- tests/run-designed-templates-ux.mjs
- tests/run-editor-onboarding-browser.mjs
- tests/run-editor-ui-evolution-browser.mjs
- tests/run-mockup-baseline.mjs
- tests/run-mockup-templates-browser.mjs
- tests/run-next-native-browser.mjs
- tests/run-night-export-browser.mjs
- tests/run-night-template-browser.mjs
- tests/run-paper-launch-browser.mjs
- tests/run-pocket-export-browser.mjs
- tests/run-pocket-template-browser.mjs
- tests/run-pocket-text-browser.mjs
- tests/run-premium-trio-browser.mjs
- tests/run-pro-impact-browser.mjs
- tests/run-pro-impact-export-browser.mjs
- tests/run-product-copy-browser.mjs
- tests/run-remaining-pro-browser.mjs
- tests/run-template-export-composition.mjs
- tests/run-whole-card-browser.mjs

