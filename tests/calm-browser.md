# Calm Split browser acceptance

Run from `apps/shotcraft` after the Calm assets, registry entry, thumbnail, and core tests are ready. Each runner starts the isolated baseline Vite configuration unless an origin override is supplied.

```powershell
node tests/run-calm-template-browser.mjs
node tests/run-calm-export-browser.mjs
```

`CALM_ORIGIN` overrides the browser origin; default ports are 5293 (template) and 5297 (export). `CALM_OUTPUT` and `CALM_EXPORT_OUTPUT` select evidence directories. Default output is under `output/devsnapkit/template-collection-2026-10-27/b1-calm/`, with a fresh timestamp for each run. Reuse an existing origin only for the corresponding isolated baseline server.

The template runner checks the ordered five-card gallery, Free/invalid-key/Pro access, preview decoding and focus restoration, single-command history, native browser frames, canonical independent 800×834 sources, equal authored geometry, independent fits, move/resize and restore/reset, hidden-secondary preservation, and replacement isolation. It downloads genuine 1080×1080 and 2160×2160 PNGs for default duo/single, a main-only user upload, and two independent uploaded fixture pairs in duo/single modes. Named preview objects are compared with the actual export host at a maximum tolerance of 2 logical pixels. Additional checks cover failed secondary preflight, retry, held request cancellation, and six mobile width/theme combinations.

Free Logo/QR verification uploads the existing self-authored red SVG fixture, keeps opacity at 1, locates red mark pixels in the downloaded PNG, and decodes its QR crop to the entered URL. The QR decoder uses the existing QA-only `output/devsnapkit/whole-card-free-brand/tools/node_modules/jsqr` dependency and its retained license; it is not a production dependency.

The export runner begins with a genuinely Free session, validates actual WebP/JPEG downloads and the real 2160×2160 PNG clipboard payload captured by a local sink, and verifies that paid 4K/batch actions leave the document/history unchanged with no downloads. It then uses the actual activation form with a local verification response fixture, checks 4K dimensions against the visible product label, observes the genuine OG/Custom batch outcome: either two real PNGs at 1200×630 and 1080×1080, or a named bounds error with zero partial downloads and unchanged work. It then exports Custom/Square as two distinct preset files with identical 1080×1080 dimensions, including recovery after a rejection. Successful existing OG batch placement does not imply a separately authored OG template.

License verification, checkout endpoints and external telemetry are isolated test fixtures. No real purchase, deployment, physical-device testing, or cross-application OS clipboard claim is made. Failure screenshots/JSON remain in their run directory. Syntax validation alone does not establish browser acceptance.
