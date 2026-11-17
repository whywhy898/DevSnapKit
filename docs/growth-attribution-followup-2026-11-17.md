# Growth attribution follow-up — 2026-11-17

## Outcome and scope

Base: `0878bd3`, branch `feat/growth-seo`, current `shotcraft-growth`
worktree. This follow-up supersedes earlier result documents for this task's
status; the pre-existing untracked `docs/growth-seo.result.md` is preserved.

The local counting contract and actual D1 stats-handler behavior are verified.
**The source of the historical second deployed visit is not established.**
Do not describe this change as a proven fix for that particular occurrence.

Only production-code change: three lines in `public/seo/attribution.js` add
document-scoped visit deduplication. No admin handler, backend architecture,
payment implementation, feedback configuration, or privacy content changed.
Feedback remains off; existing positive feedback tests use isolated fixtures.
No real payment, deployment, push, main merge, or other worktree operation ran.
No local credential/configuration files were opened. Build dotenv loading
remains disabled by the existing `envDir: false` setting.

## Investigation and source evidence

Reported QA URL:
`https://a0a92bfc.devsnapkit.pages.dev/?utm_source=codexbot-browser&utm_medium=qa-browser&utm_campaign=qa-attr-20261117-a0a92bfc-browser`

The supplied D1 observation is two visits one second apart, one editor open and
one export, with the same session/path/UTM and `env=preview`. Original HTTP
payloads, request initiators and full-document navigation records are absent.
Matching session/path/UTM cannot distinguish another full load from another
caller or transport/backend behavior. There is no time-window/session dedupe
on the server: a real reload must remain countable.

| Path | Verified role |
| --- | --- |
| `index.html` attribution script and module entry | Loads the shared classic runtime before `src/main.tsx`. |
| All 20 instrumented static SEO HTML entries | Load that same runtime with `defer`; one automatic visit per document. |
| `public/seo/attribution.js` initializer | Existing global guard prevents duplicate runtime installation. The sole automatic `track('visit')` is at the end of this initializer. |
| `public/seo/hero-entry.js`, `open()` | Retains the local File, uses `history.pushState` to add `editor=1` while retaining UTM, dispatches `dsk:open-editor`. It sends no analytics request and creates no document. |
| `src/main.tsx`, `openStudio()` | Existing `studioStarted` guard dynamically imports React once; supports query/class entry, the editor event, and pending-order recovery on bare root. No visit call. |
| `src/studio.tsx` / `src/App.tsx` mount effect | React StrictMode wrapper; App calls `trackEvent('page_view')`. |
| `src/telemetry.ts`, `trackEvent()` | Delegates to the shared runtime; no independent transport. |
| `public/seo/attribution.js`, `track()` alias table | Maps React `page_view` and legacy `seo_editor_open` to `editor_open`, with existing editor-open deduplication. Exports remain separate events for each successful action. |
| `public/seo/landing.js` | Presentation, theme, comparison and floating CTA logic; no event sender. |
| Static terms/privacy HTML | No attribution runtime; not a second visit emitter. No instrumentation was added to legal pages. |
| `scripts/version-seo-assets.mjs` | Rewrites built asset URLs with content hashes; does not add an emitter. |
| `functions/api/event.ts` and `functions/api/telemetry/event.ts` | One handler invocation writes once; the legacy URL re-exports the same handler. |
| `functions/lib/growth.ts`, `writeEvent()` | Analytics Engine success returns; otherwise D1 fallback performs one insert. This source audit does not verify deployed Analytics Engine behavior. |

### Baseline reproduction, before changing the runtime

The existing built artifact produced exactly:

1. Root landing: `visit`.
2. One hero image selection in the same document: `editor_open`; no visit.
3. One real Free PNG download: `export`; no visit.
4. Actual editor reload into a new document: `visit`, `editor_open`.

The first three stages have the same generated document ID; reload has a new
document ID. All five requests retain the landing UTM and session, with path
`/`. Server-side capture reads the actual Blob/beacon body bytes rather than
depending on Puppeteer `postData()`, which can omit beacon bodies. CDP captures
request initiator stacks, loader IDs and frame IDs.

Baseline evidence:
`scratch/growth-followup/baseline-0878bd3-visit-requests.json`.
The captured runtime URL is `/seo/attribution.js?v=d2b437b6ae`;
SHA-256 of `0878bd3:public/seo/attribution.js` is
`d2b437b6ae40ec4ff2c6d88e15f1b295c7fa72b65e1d1da142d1f3b245257e64`.
The visit stack originates in its initializer; editor/export stacks go through
the compiled React telemetry delegate.

### Confirmed gap and minimal hardening

Unlike `editor_open`, the public `track('visit')` operation had no document
guard. A deterministic test calling the real runtime again emitted extra visits:
`visit, visit, visit, editor_open, visit, export, export` instead of
`visit, editor_open, export, export`. This demonstrates a counting-contract gap,
**not evidence of a second caller in the original deployed QA session**.

The minimal hardening adds a closure-local `visited` boolean and sets it before
transport, so any later caller through this runtime is ignored in the same
document. It is deliberately absent from sessionStorage: full reload recreates
the closure and counts again. Landing attribution/session persistence and
editor/export logic are unchanged. Failed telemetry remains best effort.
This guard does not dedupe independent forged/replayed HTTP requests or a
separate runtime that bypasses this API.

The new `tests/growth-visit-browser.test.mjs` executes the actual built HTML,
static runtime, hero entry, lazy module entry and compiled React together. It
checks same-document upload/export, reload, all 20 static SEO entries and each
full-page CTA navigation, direct editor/tool/return-query boot, pending-order
boot with local API fixtures, and the authenticated admin login screen.
Its final capture contains 49 checkpoints and 74 event requests:
47 visits, 26 editor opens and one export. Many full documents are intentional
in this broad test; each full-document entry contributes exactly one visit.
Requests and initiators: `scratch/growth-followup/visit-requests.json`.

## D1 report acceptance: actual handler

`tests/growth-api.test.mjs` imports/transpiles the real
`functions/api/admin/stats.ts` and its real dependencies. It supplies an
in-memory SQLite database behind D1's `prepare/bind/first/all` interface and
runs the production handler's SQL. It does not substitute copied funnel SQL.
Authentication uses a generated test-only token and the real token verifier;
no deployed admin secret or token is read.

Fixtures have distinct production/preview/dev counts on a shared campaign,
plus environment-exclusive campaign rows. Malformed/untagged/unknown-env
metadata, an expired production event and an unsupported legacy event are
included to catch accidental inclusion.

Verified authenticated handler selections:

| Request | Selected growth funnel |
| --- | --- |
| `/api/admin/stats` with no env query | production |
| `?env=production` | production |
| Exact `?env=preview`, exact `?env=dev` | preview, dev respectively |
| Empty, `all`, `Preview`, `staging`, `preview%20`, or `environment=preview` | production |
| No env query on preview-host or localhost requests | production |

For the shared campaign, the default handler returns production counts
`visit=2, editor_open=1, export=1, payment=1`, excluding the tagged preview/dev
counts. It includes only the production-exclusive campaign. Explicit preview/dev
requests include only their respective fixtures. The funnel retains its 30-day
window; the separate all-time overview remains production and includes its old
production visit. Responses retain `Cache-Control: no-store`.

Six absent/forged-token requests across default/preview/dev choices return 401;
missing admin configuration returns 503. There are zero D1 reads before these
authorization rejections. No production handler or authentication change was
needed. Exact test requests/responses, without tokens:
`scratch/growth-followup/admin-handler-responses.json`.

### What these tests do not prove

These are local tests of the real handler against SQLite, not calls to deployed
Cloudflare D1 or authenticated production/preview admin responses. They do not
verify the deployed revision, bindings, migration state, live records, edge
runtime or that an existing deployed admin session can access these responses.
The browser admin fixture checks UI behavior only; it is not the handler proof.
**Authenticated runtime-admin access remains an acceptance gap.** No public
admin/data/debug endpoint was added to work around authentication.

Analytics Engine remains explicitly **unverified** and is not a completion
requirement for this D1-only acceptance.

## Verification

Evidence root: `scratch/growth-followup/`. Logs and exact command/timing/exit
records are in `verification.json`. Earlier failed fixture runs are retained in
`initial-verification.json` and `initial-*.log` where applicable.

| Final check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Security, including browser admin token-storage test | 29 | 0 | 0 |
| SEO + attribution + growth client/API/handler tests | 138 | 0 | 0 |
| PayPal webhook/recovery | 86 | 0 | 0 |
| Pricing regression suite | 81 | 0 | 0 |
| Growth browser, including new coexisting-path test | 3 | 0 | 0 |
| PayPal browser | 3 | 0 | 0 |
| **Node test total** | **340** | **0** | **0** |

`npm run build` passes (legal generation, sitemap, TypeScript, Vite, SEO asset
versioning). Legacy SEO browser runner final results are recorded below after
their final rerun. Independent review found no production blocker; its
secondary-upload readiness concern was fixed with an actual decoded-image
assertion before export.

Fixture corrections preserve the current event contract and actual product
behavior: both telemetry URLs are collected locally; feedback readiness is
false; scene URLs/dimensions match existing scene presets; deliberate fixture
navigations accept before-unload discard prompts; hidden mobile CTA lazy
thumbnails are not required to load while invisible; secondary image readiness
uses DOM decoding rather than retired upload telemetry. These are test-only
changes. Legacy SEO attribution now asserts one visit for the static document,
one for its full-page editor navigation, none for upload/export, and one on
editor reload, with landing UTM/session retained.

## Remaining closure work and commit status

1. Establish the historical second emitter/source from the original request
   URL/body and Initiator stack, together with document navigation records and
   deployed asset identity. This session's public asset fetch was rejected with
   `MCP tool call requires approval, but approval policy is never`; no bypass
   was attempted. No root cause is inferred from timing alone.
2. With an existing authorized admin session, verify the deployed authenticated
   `/api/admin/stats` response without an env query and the explicit env choices.
   Local handler evidence does not close that runtime-access gap.
3. Feature-branch commit status and final legacy-browser counts are recorded
   after verification below. No push/deploy/main merge is authorized or performed.

### Commit blocker

No new commit was created. Native Git first reported a repository ownership
mismatch. A command-local `safe.directory` override (no global configuration
change) resolved that check, but staging the exact nine intended code/test
files failed:

```text
fatal: Unable to create 'D:/workspace/MarkMoney/apps/shotcraft/.git/worktrees/shotcraft-growth/index.lock': Permission denied
```

That Git metadata directory is outside this session's writable worktree root.
Approval policy is `never`; no alternate index, Git-directory relocation,
context-mode mutation or other permission bypass was attempted. Changes and
this report remain reviewable in the worktree. Proposed feature-only commit:
`fix: bound growth visits to document lifetime and verify D1 reports`.

Build-generated `public/terms/index.html` may appear modified solely from line
endings with no content diff. It is excluded from this follow-up. Intentional
privacy updates and the pre-existing untracked result document are preserved.
