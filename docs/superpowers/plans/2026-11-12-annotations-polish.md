# Annotations polish

Implement the four requested changes on `feat/annotations-polish`, keeping the existing editor and checkout structure.

1. Add regression tests for cascaded placement, wrapping, default Box visibility and endpoint-only arrow selection in `tests/annotations.test.mjs`. Extend `tests/annotations-ui.test.mjs` to exercise the toolbar shortcut, focus, both themes and screenshots. Extend the held-response checkout browser test to verify duplicate clicks and retry availability.
2. Add an Annotate toolbar action in `src/App.tsx` that finishes editing, opens the existing annotations section, scrolls it into view and focuses its first tool. Offset new annotations 24 logical pixels from the previous annotation, wrapping each axis inside the canvas, in `src/composition/annotations.ts`. Use the thick preset for new Boxes.
3. Remove the outline, shadow and Move button for arrows in `src/composition/CompositionOverlay.tsx`; retain both endpoint handles and all other selection UI. Preserve the existing pending-payment disabled state, add an explicit discard handler guard and expose its busy state.
4. Run all requested security, pricing, PayPal, SEO, scene and annotation checks plus the build. Run browser regressions with a local Vite server and built checkout UI. Save light/dark screenshots under `scratch/annotations-polish-evidence/`. Restore the two generated legal pages after the build, review the diff and commit without pushing or deploying.

Do not access `wrangler.toml` or `.env.local`. Keep all work on the checked-out feature branch.
