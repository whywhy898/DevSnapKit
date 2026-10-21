# Mockup artwork baseline

Run `node tests/run-mockup-baseline.mjs` from the app directory. The test server uses port 5199 and the production CSP. Captures live outside the repository in `../../output/devsnapkit/canvas-text-v1/baseline/`.

Set `MOCKUP_BASELINE_PHASE` to choose an output subdirectory. Set `MOCKUP_BASELINE_REFERENCE` to a previous phase to compare all captures with decoded RGBA equality. A changed channel in even one pixel fails. No alignment, threshold, blur, cropping of differences, or pixel normalization is applied. Both the rendered canvas preview and the PNG captured from the real browser download stream are compared.

The 20 deterministic cases cover single/duo layouts × browser/iPhone frames × solid/preset gradient/custom gradient/texture/alpha backgrounds. Camera zoom/pan, projection, padding, shadows, glow, grain, logo, QR and brand badge vary across them. QR is generated from a fixed fixture URL. `MOCKUP_BASELINE_CASES` optionally selects comma-separated case IDs for diagnosis; acceptance runs must leave it unset.

The isolated Vite config exposes the existing snapshot restore callback and fixture-only brand/gradient state setters. It does not replace or alter the renderer or export implementation. It is never used by production builds. Browser controls freeze DPR, viewport, random seed, Date.now, font hinting, color profile and raster settings. Captures wait for font readiness, every artwork image to decode, animation frames and layout settlement. CSS transitions and animations are disabled only in the test page.

Chromium's default GPU raster path produced differences in repeated unchanged captures, including single-channel differences in blur and text antialiasing. The baseline deliberately rejects those; software rasterization plus fixed font hinting gives exact repeated output. Keep those flags when reproducing this gate.

Reports contain per-case paths and exact pixel differences. Metadata records browser version, source hashes, Git HEAD, dirty state and full fixture configuration. Generated PNGs and reports must not be committed.
