# SEO Attribution Implementation Plan

> **For agentic workers:** Implement inline using executing-plans. The user has authorized execution of the prior assessment; no additional design approval is needed.

**Goal:** Attribute real editor usage to the existing four SEO entry pages and make the result visible in the admin dashboard.

**Architecture:** One shared browser runtime supplies best-effort anonymous first-entry context to landing and editor events. D1 aggregates existing JSON metadata into ordered session cohorts without schema changes. Existing public pages receive focused copy and contextual links.

**Tech Stack:** Vanilla browser JavaScript, React/TypeScript, existing Cloudflare Pages/D1 endpoint, Node test runner, SQLite and existing Puppeteer helper.

## Task 1: Shared attribution runtime

Files: create `tests/seo-attribution.test.mjs` and `public/seo/attribution.js`; modify `src/telemetry.ts`, `index.html`, four `public/*/index.html` landing files.

- [ ] Add VM-based behavioral tests that load the real browser script with sessionStorage and captured beacon payloads: first-entry retention, expiry, denied storage, invalid state, malicious paths/referrers, transport fallback and non-throwing telemetry.
- [ ] Run `node --test tests/seo-attribution.test.mjs`; confirm failure because attribution behavior is missing.
- [ ] Implement the shared runtime with `window.DevSnapKitAnalytics.track(event, metadata)`. Serialize only allowlisted SEO paths and referrer hostnames. Persist session context best-effort, using page memory after rejected writes.
- [ ] Make `src/telemetry.ts` retain its event union and delegate to the shared runtime; add `seo_landing_view` and `seo_editor_open` to that union.
- [ ] Load the runtime synchronously before `/src/main.tsx` in `index.html`, and deferred before `landing.js` in each static entry. Emit landing views and delegated editor clicks from the runtime.
- [ ] Re-run behavioral tests and existing SEO tests.

## Task 2: Ordered session cohort report

Files: create `functions/lib/seo-funnel.ts`, `tests/seo-funnel.test.mjs`, `src/SeoFunnel.tsx`; modify `functions/api/admin/stats.ts`, `src/AdminDashboard.tsx`.

- [ ] Add real SQLite tests with the existing events table shape. Seed a full journey, duplicates, incomplete/out-of-order journeys, an old journey, malformed JSON, memory-only storage and an unknown entry. Assert only stable in-window landing cohorts count and stages cannot exceed preceding stages.
- [ ] Run `node --test tests/seo-funnel.test.mjs`; confirm missing behavior fails.
- [ ] Implement a bounded 30-day SQL cohort query returning four allowlisted rows and availability. Isolate query failure from the rest of admin stats.
- [ ] Include `seoFunnel` in authenticated stats and render the four stages plus auxiliary upgrade/checkout interest in the overview, using a small dedicated component and an explicit unavailable state.
- [ ] Re-run cohort tests and admin/security regression tests.

## Task 3: Existing entry-page clarity

Files: four `public/*/index.html` landing files, existing SEO tests.

- [ ] Use task-specific H1 copy for screenshot styling, OG creation, launch-gallery composition and editable screenshot text.
- [ ] Rename editor CTAs to their corresponding task while preserving existing hrefs and entry presets.
- [ ] Add one contextual related-tool link to existing prose on each page. Keep current layout, demonstrations and product limitation statements.
- [ ] Run existing SEO page/asset tests; do not create tests that merely repeat copy literals.

## Task 4: Browser verification and delivery

Files: create `tests/run-seo-attribution-browser.mjs`; update package scripts and add `docs/seo-attribution.md` describing fields and limitations.

- [ ] Exercise actual landing views, editor clicks, uploads and generated image exports with intercepted telemetry on desktop and mobile. Assert common entry/session context and no image bytes, full referrer paths or arbitrary query values in payloads.
- [ ] Exercise the admin component against authenticated fixture responses, then storage-denied editor navigation and export.
- [ ] Run `npm run build`, SEO page/asset tests, new runtime/SQL tests, security tests, existing SEO entry browser checks and the new attribution browser runner. Save compact results and screenshots outside tracked product files.
- [ ] Review `git diff --check` and the complete diff, update completed plan items, commit to `codex/seo-attribution`, and report the verified result and deployment state.
