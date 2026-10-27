# App Pair browser QA

Run from `D:/workspace/MarkMoney/apps/shotcraft`, serially:

```powershell
node tests/run-app-pair-template-browser.mjs
node tests/run-app-pair-export-browser.mjs
```

The main runner starts its own local server on 5303; override with `APP_PAIR_ORIGIN`. Set `APP_PAIR_OUTPUT` for its evidence directory. The export runner starts on 5307; `APP_PAIR_ORIGIN` and `APP_PAIR_EXPORT_OUTPUT` override its origin and evidence directory. Defaults write timestamped files below `output/devsnapkit/template-collection-2026-10-27/b2-app-pair/`.

These runners are authored checks, not a claim that browser QA has passed. Inspect each `results.json`, `failure.json`, screenshots, downloaded files, and geometry evidence after running. Assertion errors are saved in `errors` and produce a failed result and nonzero exit code.

The main runner checks six gallery entries in this order: Honey Free, Paper Free, Calm Free, App Pair Free, Night Pro, Pocket Pro. It exercises Free, rejected saved-key verification, and mock-valid saved-key verification; preview dismissal and focus restoration; one-step application history; Undo/Redo; two independent phone sources; equal 464×1050 placements at (64,580) and (552,580); original hardware; blue background and heading; absence of a poster CTA; and three rectangular footer accents.

It captures actual 1×1080×1920 and 2×2160×3840 PNGs for default duo, manually hidden secondary, one uploaded image, and two pairs of independent uploaded images. Hidden sources and manual geometry persist; edits and fits remain isolated per slot; Restore layout and Reset template use authored defaults. It verifies preflight decode cancellation and failure atomically, successful retry, and gallery previews at 360/390/430 in light and dark themes. Preview/export JSON compares media, native phone hardware, composition and text geometry within 2 logical pixels.

Free Brand evidence uses no saved key or simulated entitlement. It uploads the red fixture logo, exports real PNGs at both scales, checks the red mark pixels, decodes the QR URL from the actual 1×PNG, and checks the actual export QR rectangle against website and disclosure rectangles. Arbitrary custom QR placement is outside this default-placement assertion.

The export runner verifies actual Free WebP/JPEG signatures and 1080×1920 dimensions. Copy captures the genuine 2160×3840 PNG ClipboardItem payload in an explicit local sink; it does not test another application or the OS clipboard. Free 4K and batch actions must emit no files and preserve the document/history. It then activates through the real UI using a mock verification response, checks the actual 4K preset (2160×3840), and runs OG+Custom batch export. That batch may produce two genuine files (1200×630 and 1080×1920) or a genuine named bounds rejection with zero partial files and unchanged work. No OG outcome is assumed in advance. Story+Custom then must produce two distinct PNG files, both 1080×1920; this is a two-preset check, not two different output dimensions.

License responses and checkout/third-party traffic use local fixtures. These checks do not perform real payment or prove physical-device rendering. Main mixed-mode results include mock license scenarios; the separate Free Brand evidence explicitly records `simulatedLicense:false`.
