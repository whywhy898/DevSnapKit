# Screenshot text demo video

## Purpose and provenance

The user requested a real adding-text demonstration inspired by their recording of Chrome What's New, and explicitly asked to add it to the existing promotional page. The reference's editing grammar is camera focus, clear pointer motion, one visible action at a time and a final result hold. No Google footage, UI, copy, or music is reused.

The published video is an actual local DevSnapKit studio capture, using `public/seo/examples/text-original.png` (the existing MDN CSS documentation example). Before recording, the studio is set to the real Soft Gray canvas preset for readable contrast. The script creates a text box, types “Understand CSS grid.”, selects Gelasio, sets 42 px, moves the text with the genuine Move handle, and downloads a real PNG. The finished image comes from that download. No fabricated application state, fake export, Pro fixture, account, or payment is involved.

The recording uses existing Puppeteer browser helpers, ffmpeg, and Sharp. Its visible cursor and click ring are recording-only overlays outside the artwork export root. Camera moves and short step labels are post-production. A clear strip above the canvas is used for long pointer traversals to reduce incidental image-hover noise. There is no narration or audio track. Full static instructions and image comparisons remain on the page.

## Published assets

| Asset | Specification | SHA-256 |
| --- | --- | --- |
| /seo/video/add-text-demo.mp4 | 32 s; H.264; 1280 × 720; 30 fps; yuv420p; faststart; 2,511,301 bytes | 822f72f183bd0eafb4c8c900949a8b90bd1cabe3eea381ce0e0d4e7d7b033b21 |
| /seo/video/add-text-demo-poster.webp | 1280 × 720; lossless; 122,988 bytes | 42b2b9647e796847bf77c142199cb753aab66bb3ae139cfb0fdc826e4936dd3e |
| /seo/video/add-text-demo.en.vtt | English caption track; 9 cues; 642 bytes | 144f46e772bb3185a5806798c5dfea6bf2a516e69d48417c8babd8d15a509d0a |

Actual exported PNG: 2400 × 1632; SHA-256 `5bdcbb3df6256376042ff4f21f0a6e86f859dee97268828f606246141d9b6f8d`.

The VTT byte count and checksum above describe its normalized LF source. Windows Git checkouts can use CRLF (670 bytes in the release checkout), without changing caption text or timing. Binary video and poster checksums are identical across checkouts.

The poster is decoded to pixels and losslessly re-encoded without copied metadata. Its decoded pixels match and its only WebP chunk is VP8L, with no EXIF/XMP/C2PA or other ancillary chunks. No claim about pixel-level watermark removal or external provenance is made.

## Page behavior

The video sits before the existing illustrated steps on `/add-text-to-image/`. It retains one H1, the existing canonical and editor preset. Responsive 16:9 layout reserves space. `preload="none"` and no autoplay mean the MP4 is not requested until visitors choose to play. A visible, keyboard-accessible play button progressively enhances the native player; without JavaScript, native controls remain. Once started, native controls support pause, seeking, full screen and the optional English caption track. Replay has a small central button, leaving the native controls accessible.

An unavailable child `<source>` can leave Chrome's play promise pending, so the script handles source errors as well as media errors. Retry restores playback by reloading on either a media error or NETWORK_NO_SOURCE. A midstream network failure can otherwise retain NETWORK_IDLE and a sticky error. The tests reproduce both failure types and actual recovery. The visible error message preserves native controls and the direct MP4 fallback link.

## Reproduction

Run `npm run build` first, then:

```sh
node scripts/record-text-demo.mjs
node scripts/render-text-demo.mjs
node scripts/check-text-demo-frames.mjs
npm run build
node scripts/check-text-demo-browser.mjs
node scripts/check-text-demo-network-retry.mjs
npm run test:seo
```

`TEXT_DEMO_OUTPUT` changes the recording/render evidence directory. Default: `D:/workspace/MarkMoney/output/devsnapkit/text-demo-video-2026-10-30/`. Recording runs only against the private loopback fixture, not production. The scene timing JSON, raw video, real PNG download, edit filter and review frames are retained there. They are not deployed. Re-recorded timing and hashes can vary; rerun render, frame review and playback checks before replacing a published asset.

`TEXT_DEMO_CHECK_OUTPUT` changes playback acceptance output. For live checks:

```sh
node scripts/check-text-demo-browser.mjs --origin=https://devsnapkit.com
```

Live tests intercept custom telemetry POSTs, and their failed-media case intercepts only that test browser's media response. They do not change production files or create synthetic funnel rows.

## Validation

The final video decodes in ffmpeg and selected frames were visually reviewed across all steps, including the real final PNG. Browser checks cover desktop/mobile, dark/reduced-motion, JavaScript-disabled native fallback, keyboard start/pause/replay, actual decoding/seeking, captions, deferred media fetch, and failed-source recovery. The separate network test reproduces a transfer ending after metadata loads, then confirms a restored server is requested again and real playback resumes. Existing SEO checks and the original illustrated guide's upload/text/export acceptance remain required.

No editor runtime, payment or database behavior was changed. No ranking or traffic improvement is claimed; the intent is to help visitors understand and try the tool. The existing bundle-size warning remains unrelated to the small page-specific player enhancement.
