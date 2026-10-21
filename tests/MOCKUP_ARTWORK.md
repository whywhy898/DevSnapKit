# Artwork extraction contract

`CanvasStage` remains owned by `App`. `MockupArtwork` returns the original `#studio-canvas` div directly, retaining its ref, classes, dimensions, padding, preview scale and export attributes. It adds no DOM wrapper.

The child order stays: transparent preview hint → image background → ambient glow → grain → `FittedScene` → logo → QR → brand badge. `DeviceComposition` remains the direct child of `FittedScene`. The stage, camera, fit, origin, projection and device ancestors keep the same order.

The typed props combine artwork fields from `EditorSnapshot` with the existing gradient, logical canvas size, effective padding, phone classification, zoom style, resolved Pro state and generated QR image. The parent supplies the canvas ref, natural-size callback, replace callbacks and rendered empty secondary slot. `MockupArtwork` owns no state, effects, file input, license logic, history or export logic.

Background inputs include mode, preset/custom gradient colors and angle, solid color, pattern, image source/fit/blur/opacity and both VFX settings. Scene inputs include mode, duo layout, frame, images/names/title, frame visibility, corners/shadows, projection, camera and padding. Brand inputs include Pro visibility, logo placement/scale/opacity, QR placement/scale and badge content.

Exact preview and actual-download RGBA comparisons across the 20 no-text fixtures are the extraction acceptance gate. `mockup-artwork.test.mjs` independently checks the returned root and layer hierarchy. `mockup-pixel-diff.test.mjs` confirms the comparator detects one changed channel, including RGB beneath zero alpha.
