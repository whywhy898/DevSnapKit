# First-screen controls and alignment correction

The user reported the hero copy extending left of the brand, a duplicate header CTA, missing entry autoplay, the wrong control corners, native video progress controls, and a separately inset before/after comparison.

Changes:

- Hero uses the same 1280px container as the header and sections; comparison fills its section width instead of being independently centred at 980px.
- The header Open studio CTA is removed. The hero CTA remains.
- Enhanced playback controls are top left. Expand is bottom right; opening uses a rounded, dimmed native dialog, with playback top left and close top right. The duplicate collapse control is hidden in the dialog. There is no visible video footer or native timeline in the enhanced player.
- Player and page-specific CSS URLs carry version `20261030-2`. Production inspection found both unversioned URLs served with `public, max-age=14400, must-revalidate`, allowing a new document to reuse the previous manual-play script for four hours. The versioned URLs avoid that mixed release. Future edits to these unbundled assets must update the URL version.
- The comparison's before image is a genuine studio download before adding text. It now matches the after image's 2400×1376 canvas and placement. Below the headline, independent exports differ only at 86 antialiased corner pixels (maximum channel difference 23), with no image movement. The source screenshot link remains the original 1120×560 capture. Provenance and PNG hashes are recorded in the example manifest.

Validation:

- Production build and all 26 SEO tests pass.
- Eight browser scenarios pass: desktop sizes, mobile, reduced motion/dark, no script, autoplay refusal, failed video retry, and a simulated previously cached player URL. The normal entry actually plays muted without native controls. The stale unversioned player is never requested.
- Browser checks verify shared left edges, identical before/after image rectangles, new control corners, removed header CTA, first-screen visibility, replay, Escape/focus/time preservation and mobile landscape expansion.
- Playwright captures and interaction checks are in `D:/workspace/MarkMoney/output/devsnapkit/text-hero-controls-2026-10-30/`.
- The new comparison image is pixel-reencoded; decoded equality, PNG chunks and absence of EXIF/XMP/C2PA-style ancillary metadata are verified by its capture script.

Independent review confirms desktop, portrait and landscape alignment, player corners, no native timeline and a correctly sized dialog. Its one P3 finding (an error message referencing the removed visible video link) has been corrected to offer only retry and written steps. Publication is recorded after production verification. This correction does not modify the recorded video or editor runtime.
