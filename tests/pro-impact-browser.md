# Pro Impact browser QA

Run from `D:/workspace/MarkMoney/apps/shotcraft`. The runners use the existing Puppeteer Core, Sharp, installed Chrome/Edge, local baseline Vite harness, and existing local jsQR decoder fixture. They install no runtime dependencies and make no real payment or license claims.

```powershell
$env:IMPACT_TEMPLATE='studio-bridge'
node tests/run-pro-impact-browser.mjs
node tests/run-pro-impact-export-browser.mjs
$env:IMPACT_TEMPLATE='editorial-story'
node tests/run-pro-impact-browser.mjs
node tests/run-pro-impact-export-browser.mjs
```

Run serially. The main runner owns port 5313; export runner owns 5317. `IMPACT_ORIGIN` uses an already-running harness instead. `IMPACT_TEMPLATE` defaults to `studio-bridge`; unsupported values fail immediately. `IMPACT_OUTPUT` and `IMPACT_EXPORT_OUTPUT` override output directories. Defaults are timestamped beneath `D:/workspace/MarkMoney/output/devsnapkit/template-collection-2026-10-27/pro-impact/implementation/{id}/{browser,exports}/`.

The main runner checks eight gallery entries (four Free, four Pro), real full previews and Escape focus, Free and invalid-license blocking without document/history mutation, actual mock verification through license-key entry, explicit apply after activation, single apply history with Undo/Redo, and pending-resource cancellation/failure/retry atomicity. It checks manual independent media, allowBleed, Big Type headline order and measured 452px/-28.024px typography, Cover Story Gelasio 136px and italic runs, native hard shadows/radius, and absence of poster CTA objects. Screenshot-internal controls remain part of authored SVG artwork.

It downloads genuine PNGs at native 1x and 2x for default duo/single, one user image without demo injection, two independent authored fixture pairs, text edits, and moved/resized/rotated media. Geometry JSON records text, composition objects, media frame/screen/chrome, phone status/home/capsule, logo, and QR at preview and actual export; each rectangle must agree within two logical pixels. Shadows and radii must survive export exactly. Canonical SVG source SHA256 records and independent user source hashes accompany evidence. Restore/Reset and hidden-secondary source retention are checked through real Inspector controls. Gallery previews are captured at 360/390/430 pixels in both themes.

Logo/QR evidence is explicitly a **user-arranged QR variant**, not a claim of default clearance. It uploads a real logo, leaves QR at 9% bottom-left, measures original website/disclosure positions, and moves any intersecting footer text using real `Text x` Inspector fields. Full footer text remains intact. Before/after positions and each manual shift are recorded. Actual 1x/2x PNG QR crops must decode and the uploaded logo's red pixels must be present. No template blueprint is changed by this QA arrangement.

Each PNG independently measures actual media rectangles against canvas bounds before download. When media lies outside and allowBleed is enabled, its real crop-confirmation dialog must occur and be accepted. Per-PNG `.dialogs.json` stores measured bounds and dialogs; aggregate dialogs remain in `results.json`. Cover Story's actual headline spans must include both normal and italic Gelasio at 136px. Big Type's actual native browser and phone shadows must respectively be 16px/16px/0 at 960px and 12px/12px/0 at 308px.

The export runner tests the existing Free/invalid 4K gate before template admission, actual mock activation and saved-key validation, native WebP/JPEG, and visible-dimension 4K files: Big Type 3840x2160; Cover Story 3072x3840. Copy captures the actual ClipboardItem PNG through an explicit local sink, with current custom-canvas 2x dimensions; external OS clipboard interoperability is not claimed.

OG+Custom accepts either two real files at the expected dimensions or a named validation rejection with unchanged document/history and no files. A compatible native-ratio preset plus Custom must download two files; those presets intentionally can produce identical dimensions, which results report honestly. Intentional bleed confirmation dialogs are accepted and are distinct from export-validation failures.

Every run writes `results.json`; failures retain screenshot, stack, and completed scenarios. Main runs additionally write snapshots, actual export geometry, canonical-source hashes, typography/native-style evidence, and arranged-brand evidence. Passing syntax checks alone do not establish browser or visual success. Final visual approval remains the user's review of actual generated exports.
