# Screenshot Text Video Implementation Plan

> Implement inline. The user approved the reference-derived direction and recording plus website integration. Use the existing isolated worktree and existing browser helpers.

**Goal:** Publish a genuine, clearly directed add-text tutorial video on the existing landing page.

**Architecture:** Real local browser recording plus controlled post-production camera/caption overlays, encoded as web MP4. Static semantic video markup and page-scoped styles; no editor behavior changes.

- [x] Verify recording support and existing UI controls, and record a repeatable real add-text/export flow.
- [x] Edit with slow cursor, controlled camera focus and readable result holds; encode and visually verify the video, captions and poster.
- [x] Add the video to `public/add-text-to-image/index.html` with scoped responsive styles and accessible, user-controlled playback.
- [x] Verify actual media playback/seeking/captions, desktop/mobile accessibility and the existing tool/export flow; run SEO checks and production build.
- [ ] Review the diff, record provenance and validation, commit, merge and publish; verify the production page and media. Release completion is recorded in the parent workspace acceptance notes.
