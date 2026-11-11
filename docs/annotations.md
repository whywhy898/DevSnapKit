# Annotations

Elements → Annotations adds an arrow, rectangle outline, or 35% filled highlight. All three are free. Select an annotation on the canvas or in Elements; drag its body or Move handle to reposition it. Rectangles and highlights resize independently in both axes with the corner handle. Arrow start/end handles change either endpoint independently, including crossing, horizontal, and vertical directions. Five preset colors and Thin/Medium/Thick strokes are available; highlights keep a fill without a stroke.

Delete/Backspace deletes the selected annotation unless focus is in an input, textarea, select, or editable content. The inspector also offers Delete annotation. Existing Undo/Redo records each add, style change, delete, and completed pointer gesture. Deleting during a drag closes that gesture as one deletion; Undo restores its baseline. Escape/pointer cancellation restores a gesture's baseline.

Implementation: annotations are shape objects in `CompositionDocument.objects`, with an annotation discriminator, normalized frame/endpoints, and a reference canvas width for stroke scaling. `annotations.ts` owns immutable operations, validation, and SVG geometry. `AnnotationRenderer` runs inside the existing `CompositionRenderer` for both preview and detached exports, preserving drawing order and single/duo screenshot layouts. Logical export sizes scale geometry and strokes; the existing rasterizer scales all artwork again for 1x/2x output. Selection controls stay outside exported artwork. Export/license policy and the mobile bottom bar are unchanged.

Tests: `node --test tests/annotations.test.mjs`; browser interactions and pixel checks via `node tests/run-editor-onboarding-browser.mjs tests/annotations-ui.test.mjs`. The browser test renders single/duo PNGs at 1x, 2x, and an arbitrary logical size and checks annotation pixels. Out of scope: freehand drawing, labels inside boxes, saved styles, and rotation.

## Delivery report

Changed files:

- `src/App.tsx`, `src/MockupArtwork.tsx`, `src/editor-evolution.css`: Elements tab, selection, gestures, keyboard deletion, and history integration.
- `src/composition/annotations.ts`, `types.ts`, `document.ts`: immutable annotation operations, normalized endpoints, stroke scaling, and validation.
- `src/composition/AnnotationControls.tsx`, `annotations.css`, `CompositionOverlay.tsx`: contrasting preset controls, move/resize controls, and independent arrow endpoint handles.
- `src/composition/AnnotationRenderer.tsx`, `CompositionRenderer.tsx`, `src/export/exportMockup.tsx`: shared SVG preview/export rendering and export callback isolation. Legacy screenshot geometry and Duo upload placeholders remain intact when adding the first annotation.
- `tests/annotations.test.mjs`, `tests/annotations-ui.test.mjs`: model, history, cancellation, all three gesture types, typing guards, deletion during a drag, and scaled PNG pixel checks.
- `tests/app-pair-template.test.mjs`, `next-stage.test.mjs`, `night-template.test.mjs`, `premium-trio.test.mjs`, `remaining-pro-templates.test.mjs`: corrected obsolete catalog-count expectations to the existing 19 entries (8 Free, 11 Pro). These five failures were reproduced against HEAD before updating expectations; template tiers and access rules were not changed.
- `docs/annotations.md`: feature, implementation, and verification notes.

Final verification:

| Check | Result |
| --- | --- |
| All non-browser unit tests, 60 files | 444 passed, 0 failed, 0 skipped |
| Annotation browser tests | 2 passed, including six native PNG exports |
| Onboarding browser tests | 12 passed |
| `npm run test:seo` | 119 passed |
| `npm run test:scenes` | 12 passed |
| `npm run build` | Passed; Vite reports a bundle-size warning |
| `git diff --check` | Passed |

After the final build, `public/terms/index.html` and `public/privacy/index.html` were restored with `git checkout --` using a temporary index because the repository index is read-only in this environment. Both match HEAD and are absent from the final diff. No commits were created. `wrangler.toml`, `.env*`, pricing/payment code, and the mobile bottom bar were not changed.

No known annotation-specific defects remain. Highlights stay at 35% opacity without an outline; stroke width affects arrows and rectangle outlines. The existing export/license restrictions still apply to output sizes.
