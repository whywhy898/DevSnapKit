# Pocket browser acceptance

Run serially from `apps/shotcraft` after product edits finish:

```powershell
node tests/run-pocket-template-browser.mjs
node tests/run-pocket-export-browser.mjs
```

The runners start separate local baseline servers on 5283 and 5287. `POCKET_ORIGIN` points either runner at an existing server. `POCKET_OUTPUT` sets template evidence; `POCKET_EXPORT_OUTPUT` sets separate export evidence. Defaults create timestamped directories under `output/devsnapkit/template-collection-2026-10-26/a2-pocket`.

Template coverage: exact four gallery entries and tiers; free/invalid license gates; real activation UI with a local API fixture; active draft/document/history preservation; free preview Escape/focus; authored 1080×1920 frames; two content-only 396×810 sources inside separate native phone hardware; Undo/Redo; hide/show source retention; independent fit, move, resize, Restore/Reset; one user upload without inserted demo; two long user phones and long plus square; replace-main SHA-256 source preservation; 1x/2x real PNG downloads and preview/export object/screen/hardware geometry within two logical pixels; secondary resource failure/retry and pending decode cancellation; 360/390/430 light/dark previews.

Export coverage: genuine WebP/JPEG files, 4K dimensions read from the visible export label, and genuine ClipboardItem PNG captured by an explicit local sink at 2160×3840. The portrait layout deliberately rejects an OG plus Custom batch atomically: the alert must name Twitter / OG, the Pocket title, and its out-of-canvas bounds; zero complete or partial downloads may appear, and document/history must remain intact. Another aspect needs an independent layout. This expected scope rejection is saved as JSON and a screenshot.

The runner then deselects OG and retries through the same UI with compatible Story plus Custom presets. It asserts two distinct actual PNG files, each 1080×1920. These are two preset downloads with identical dimensions; this does not promise different output sizes or a landscape Pocket composition. No alternate renderer, automatic title shrink/reflow, validator bypass, or PDF substitute is used.

`results.json` records completed scenarios and failures. First-failure screenshots, detailed failure metadata, downloads, geometry, snapshots, and fixture source hashes remain on disk. These tests use simulated license responses, self-authored local upload fixtures, and a clipboard sink; they do not exercise payment, deployment, physical phones, or cross-application OS clipboard pasting.
