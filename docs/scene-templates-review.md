# Scene templates review

## Step 0: existing editor inventory (before implementation)

- `src/templates.ts` contains built-in screenshot samples (`MOCKUP_PRESETS`); these are media examples, not a second document format.
- `src/templates/catalog.ts`, `types.ts`, and `apply.ts` contain the older template model: canvas, background/style, media region, and headline/description roles. `TemplateContext` retains those roles in editor snapshots.
- The current gallery is `src/templates/TemplateMenu.tsx`, backed by `src/templates/collection/catalog.ts`. `collection/types.ts` defines `CuratedTemplateBlueprint`; `collection/apply.ts` converts a blueprint into an `EditorSnapshot`, preserving uploaded main screenshots, assigning stable text IDs and applying canvas, background, and placement together. Its existing access gate supports free templates.
- `src/composition/types.ts` and `document.ts` define the existing independent screenshot placements and composition document. `collection/geometry.ts` converts authored rectangles to normalized frames. Native browser/phone frames are rendered by the existing composition renderer and media shell.
- `src/text/document.ts` owns `CanvasTextDocument` creation, validation, updates, and phase-1 `addText` placement. That helper chooses free canvas margins outside supplied screenshot bounds and avoids occupied text. `useCanvasTextEditor.ts` uses the same model for Add text.
- `src/App.tsx` owns aspect presets and custom canvas sizes; `src/canvasDimensions.ts` resolves export dimensions. `src/themes.ts` and `src/stylePresets.ts` contain backgrounds and style presets. Scenes can use the existing free solid background path without changing export capabilities.
- `src/useHistory.ts` / `editorHistory.ts` record the complete editor snapshot. `handleApplyDesignedTemplate` decodes media, checks concurrent changes, and calls `editorHistory.applyCommand` once. Existing layout/style reset functions can consume additional curated blueprints.
- Phase-1 entry parameters are captured once in `App.tsx`. `index.html` already loads the editor for non-marketing query parameters and has no welcome overlay. `public/seo/attribution.js` recognizes editor links using `URL.searchParams`, so adding `scene` must preserve `editor=1` and existing query handling.
- Relevant public slugs: `product-hunt-image-maker`, `product-hunt-gallery-image-size`, `og-image-generator`, `twitter-x-post-image-size`, and `app-store-screenshot-generator`. Shared `public/seo/landing.js` builds its floating CTA from `data-studio-cta`.
- **App Store size: 1290 × 2796.** `public/app-store-screenshot-generator/index.html` gives a real export at **1290×2796** in its example caption and says to type **1290 × 2796** in its worked instructions. It also lists other accepted sizes; this implementation uses the site's demonstrated size exactly.

## Implementation plan

1. Add failing Node tests for free scene catalog entries, exact dimensions, existing document construction, title/subtitle placement, source preservation, undo/redo, strict URL parsing, and landing CTA destinations.
2. Define three scene blueprints inside the existing curated template collection. Generate their text using phase-1 `addText`, supplying screenshot bounds and the previously created title. Reuse existing native browser/phone samples and composition frames.
3. Register scenes in the existing catalog and snapshot builder as single-screenshot templates. Expose a clearly labeled Scenes group in the Templates gallery. Apply URL scenes once through the same template command; undo and later edits own the resulting state.
4. Update the five landing/guide pages' editor links and floating CTA data, preserving any other query parameters. Update the SEO fixture/parameter contract to include the supported scene values.
5. Run `npm run test:scenes`, `npm run test:seo`, the actual editor onboarding browser tests, relevant template/text regressions, and `npm run build`. Record results here. Do not change deployment configuration, environment files, secrets, or git state.

## Validation

- `npm run test:scenes`: **11 passed**, zero failures. Covers exact sizes, free access, existing document validity, title/subtitle bounds, source preservation, complete undo/redo, layout/style restore, strict URL values, all five landing CTA destinations, and scene gallery labels.
- `npm run test:scenes:browser`: **3 passed**, zero failures/skips. Uses the existing Vite browser harness and real editor UI. Checks all three scene URLs (including existing aspect/mode and attribution parameters), actual rendered text bounds, no welcome overlay, undo/redo without reapplying the URL scene, free gallery filtering/application, native preview Esc dismissal, real file uploads, preservation of placement/text on replacement, and invalid-scene fallback.
- `node tests/run-editor-onboarding-browser.mjs tests/scene-templates-ui.test.mjs tests/editor-onboarding-ui.test.mjs`: **10 passed** (the 3 scene cases plus all **7 phase-1 onboarding cases**), zero failures/skips. Includes CTA entry, Add text placement, Free/Pro resolution labels and batch gates, and modal Esc/focus behavior.
- `npm run test:seo`: **119 passed**, zero failures. Includes attribution, caption contrast, mobile floating CTA timing, guide contracts, and built asset versioning.
- Existing curated catalog/access/geometry, composition document, template grouping, and canvas text/history tests: **46 passed**. With scene unit tests included in the same regression run: **57 passed**.
- `npm run build`: **passed**, including TypeScript and Vite. The existing large-chunk advisory remains; there are no build errors.
- `git diff --check`: passed. No deployment configuration, environment files, secrets, export capability rules, commits, or git mutations were introduced.

### Test environment

The parent workspace also contains `apps/shotcraft-price` with the same package name. npm's automatic parent-workspace discovery consequently fails before some commands run. Validation invoked npm's installed CLI with `--prefix D:/workspace/MarkMoney/apps/shotcraft --workspaces=false`, running this checkout's normal scripts. The SEO cache test's nested build now explicitly uses `npm --prefix . --workspaces=false run build` for the same isolation. No sibling checkout or parent configuration was changed.

### Changed files

- `src/templates/collection/scenes.ts`: three ordinary curated blueprints and strict scene parameter lookup. Titles/subtitles use the phase-1 placement helper at a readable reference size, projected into the exact native canvas.
- `src/templates/collection/types.ts`, `catalog.ts`, `apply.ts`: register free scene entries and support single-screenshot blueprints while retaining dormant secondary source data for undo.
- `src/templates/SceneArtwork.tsx`, `TemplateMenu.tsx`, `TemplatePreview.tsx`: Scenes filter, labels, and previews using the existing composition, media-shell, and text renderers. Scene previews need no separate bitmap assets or rendering model.
- `src/App.tsx`: apply the URL scene once through the existing asynchronous template command and snapshot history.
- `src/text/document.ts`: explicitly type the existing text creation ID parameter as `string`, allowing stable template role IDs as well as generated UUIDs; placement behavior is unchanged.
- `public/{product-hunt-image-maker,product-hunt-gallery-image-size,og-image-generator,twitter-x-post-image-size,app-store-screenshot-generator}/index.html`: hero, closing, footer, and floating editor links include the matching scene, preserving prior query parameters.
- `tests/scene-templates.test.mjs`, `scene-templates-ui.test.mjs`: unit and browser scene coverage.
- `tests/run-editor-onboarding-browser.mjs`: optionally accepts test file arguments so scene tests reuse the existing server harness.
- `tests/curated-template-access.test.mjs`, `seo-landing-pages.test.mjs`, `seo-guide-pages.test.mjs`, `seo-cache-versioning.test.mjs`, `fixtures/seo-guides.json`: update the catalog count and supported CTA contracts; isolate the nested build from sibling workspaces.
- `package.json`: add `test:scenes` and `test:scenes:browser`.
- `docs/scene-templates-review.md`: pre-implementation inventory, plan, implementation notes, and verified results.
