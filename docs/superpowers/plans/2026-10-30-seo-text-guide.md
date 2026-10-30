# Screenshot Text Guide Implementation Plan

> Implement inline using executing-plans. The user has authorized the existing-page optimization; the design records the already approved direction. No sub-agent delegation is needed.

**Goal:** Make the existing text landing page answer how to write on a screenshot with a verified illustrated walkthrough.

**Architecture:** Static HTML plus scoped CSS and losslessly encoded actual editor captures. Keep the app behavior, canonical, and analytics unchanged.

**Tech stack:** Existing HTML/CSS, Puppeteer browser helpers, Sharp asset encoding, Vite build, existing SEO tests.

- [ ] Verify current baseline, editor controls and example export using the existing isolated worktree.
- [ ] Capture genuine upload/edit/export illustrations and record provenance; verify metadata and lossless pixel preservation.
- [ ] Update `public/add-text-to-image/index.html`, add `public/seo/text-guide.css`, and update that sitemap entry's lastmod.
- [ ] Verify existing SEO suites, production build, desktop/mobile guide readability, editor preset and actual text export. Use existing tests and a focused browser acceptance runner; do not add tests that merely assert marketing copy.
- [ ] Review final diff for unsupported claims, broken links, accessibility and unrelated changes. Record validation.
- [ ] Commit, merge to main and release through the established production workflow, then verify the live page while suppressing synthetic telemetry.
