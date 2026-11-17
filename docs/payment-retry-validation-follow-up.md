# Payment retry validation follow-up — 2026-11-17

TesterBot should **not sign off real sandbox payment retry yet**. Local simulated checks pass. The historical 202/404 responses and deployed backend/account provenance remain unverified.

## Scope and revision evidence

Started by reading `docs/payment-retry-review.md` and branch state. The worktree was clean on `fix/payment-retry`, HEAD `22274d3828ab41594045d4c628783dffae8cd1ea`. All changes and evidence belong to this worktree. No push, deploy, main merge, real payment, remote order creation/capture, or remote POST was performed.

Sanitized read-only public observations are retained in `docs/evidence/payment-retry/public-metadata.json`. At 01:26 UTC on November 17, both the immutable deployment `https://d1121014.devsnapkit.pages.dev` and alias `https://fix-payment-retry.devsnapkit.pages.dev` returned HTTP 200 with `mode: sandbox` from GET `/api/paypal-config`. Both returned HTML HTTP 404 for GET `/build-revision.json`; neither index exposed a revision meta tag. No revision handler was found in the reviewed source. The deployment identifier `d1121014` is not a Git SHA, and the reported `22274d3` is not independently attested backend revision evidence.

Stronger but limited frontend evidence: both public URLs returned byte-identical copies of this checkout's locally built entry and payment-bearing studio bundles:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `/assets/index-DvX8ttxZ.js` | 2,182 | `280770075956fd8e91688721b971b0d266952ca7aeaee401a289ce8f5534e9ab` |
| `/assets/studio-DQW1rbDx.js` | 653,141 | `744d57dcc153b20c0b84a45c343faeeff7fbb539386f8ad8842fb18e6817e5ea` |

These frontend byte matches do not establish a unique Git commit, the deployed Pages Functions bundle, runtime bindings, merchant identity, or the environment in which an old order originated. No provider order requests were made to verify those claims.

The build now emits static `/build-revision.json` through `scripts/build-revision.mjs`. It accepts only explicitly supplied full lowercase 40-character `BUILD_REVISION` or `CF_PAGES_COMMIT_SHA`. Conflicting or malformed nonempty inputs fail the build. Without an input, it emits `revision: null, source: unavailable`. The field `verification: build-input-only` deliberately identifies the limited authority of the value. It does not infer a SHA from an alias, branch, deployment ID or local HEAD, enumerate environment variables, or include runtime configuration. A build runner must associate the supplied SHA with a checked-out source tree and deployment manifest. Even a valid full SHA can be supplied incorrectly; the indicator is not cryptographic attestation or proof of the deployed Functions bundle.

This change is local and has not been deployed. **A new endpoint cannot retroactively prove the revision of the existing immutable deployment.** For a future clean build, an operator can supply a verified checkout SHA as a build input; in PowerShell:

```powershell
git status --short
# Continue only after confirming the intended source tree is clean and reviewed.
$env:BUILD_REVISION = (git rev-parse HEAD).Trim()
try { npm run build } finally { Remove-Item Env:BUILD_REVISION }
```

No credentials, keys, `.env` files or `wrangler.toml` were inspected. One scope deviation: `vite.config.ts` was read while identifying the existing build setup; it contained build plugin/port settings. No runtime payment/account bindings were inspected. Package scripts and ignore rules were read/edited to wire up the authorized build/test work.

## One authoritative mode in source, with deployment limits

The relevant code path is:

```text
GET paypal-config -> paymentConfig(env) -> public {clientId, mode}
POST paypal-create-order -> paypalToken(env) -> paymentConfig(env)
    -> OAuth POST selected-host/v1/oauth2/token
    -> paypalRequest(session) -> POST selected-host/v2/checkout/orders
POST paypal-capture-order -> paypalToken(env) -> paymentConfig(env)
    -> OAuth POST selected-host/v1/oauth2/token
    -> completedOrder -> readOrder -> GET selected-host/v2/checkout/orders/{id}
    -> if APPROVED, POST selected-host/v2/checkout/orders/{id}/capture
    -> canonical GET on the same selected host
```

`functions/lib/paypal.ts:paymentConfig` normalizes `env.PAYPAL_MODE`, defaults to `live`, rejects values other than `live` or `sandbox`, and selects `https://api-m.paypal.com` or `https://api-m.sandbox.paypal.com`. `paypalToken` retains this `baseUrl` in the session; `paypalRequest` constructs all subsequent provider URLs from it. Both handlers import this same implementation. Browser input does not select the server host. The frontend loads the SDK with the server's public client ID; the public mode string itself is not used to select the backend host.

New tests in `tests/paypal-webhook.test.mjs` exercise the real config/create/capture handlers in each server mode using synthetic bindings and a fully replaced `fetch`. They submit the opposite mode and an untrusted base URL in request bodies and assert these six provider calls, in order, all use the expected server host:

| Method | Provider route | Count |
| --- | --- | ---: |
| POST | `/v1/oauth2/token` | 2 |
| POST | `/v2/checkout/orders` | 1 |
| GET | `/v2/checkout/orders/ORDER1234567890123` | 2 |
| POST | `/v2/checkout/orders/ORDER1234567890123/capture` | 1 |

The capture asserts `PayPal-Request-Id: dsk-capture-ORDER1234567890123`; fulfillment creates one in-memory database order. Every provider request and notification in these tests is mocked. This proves the reviewed source uses one resolver when supplied the same bindings. It does **not** independently verify that both deployed handlers match this source or receive identical bindings, that the merchant/client ID matches the old order, or that an old sandbox/live/account mismatch caused the reported failure.

## Local-only browser harness and exact reproduction

`tests/payment-retry-browser.test.mjs` serves this checkout's `dist` from a new random port bound to `127.0.0.1`. The server rejects non-GET requests and has no payment backend. The harness creates a fresh browser context per scenario, stubs the PayPal SDK in that context, intercepts every API request, and aborts unexpected APIs and external origins. Google Fonts is intentionally blocked; the SDK script receives an empty local response; telemetry POST receives a mocked 204. DNS for external hosts is additionally disabled in the test browser. The URL and origin are constructed locally; there is no remote URL argument, production bypass parameter, deployed mock route, unsigned license hook, or app-source dependency on the harness. The older PayPal browser suite now also aborts unrecognized external requests.

From this worktree in PowerShell, with installed dependencies and local Chrome/Edge:

```powershell
npm run test:paypal:retry:browser > test-payment-retry-browser.log 2>&1
npm run test:build-revision > test-payment-retry-revision.log 2>&1
npm run test:paypal > test-payment-retry-paypal.log 2>&1
npm run test:pricing > test-payment-retry-pricing.log 2>&1
npm run test:paypal:browser > test-payment-retry-existing-browser.log 2>&1
Remove-Item Env:TEST_UI_URL -ErrorAction SilentlyContinue
npm run test:security > test-payment-retry-security.log 2>&1
git diff --check
```

The first command builds the actual checkout, including TypeScript checking, then runs the focused browser suite. Use `$LASTEXITCODE` after each command to check its exit status. A direct rerun after a fresh build is `node --test tests/payment-retry-browser.test.mjs`. The security command intentionally leaves the unrelated admin UI test without `TEST_UI_URL`; it is reported as skipped rather than silently targeting a remote site. `BROWSER_EXECUTABLE` can specify an installed local browser; no PayPal credentials are needed.

Evidence is written locally under `test_evidence_payment_retry/` (git-ignored):

- `build.json`: local HEAD, changed tracked paths, scoped untracked source paths, source file hashes, actual entry/payment bundle hashes and the build's revision indicator. Local HEAD describes the checkout base, not a claim that uncommitted changes were deployed.
- `summary.json`: every scenario, pass/fail, action attempts, exact method/route/status request counts, assertion count and screenshot filename.
- `<scenario>.json`: action timestamps/disabled state, request bodies, response fixture status/type/body, held/final UI storage states, assertion names and unexpected/page errors.
- `<scenario>.png`: 27 full-page screenshots from the real browser rendering the built app with simulated APIs.
- Root `test-payment-retry-*.log`: exact build/test output, including errors/warnings and pass/fail/skip counts. They are local artifacts, not source changes.

Synthetic order ID is `ORDER1234567890123`, new order ID `SECONDORDER1234567`, and synthetic license string `DSK-AAAA-BBBB-CCCC`. This key is format-valid UI data, **not a real signed license**. These tests do not exercise actual SDK debouncing, PayPal approval, real signature verification, external callbacks or deployed database writes. Server security tests separately exercise signed licenses with test-only secrets.

All browser fixture responses are intercepted before network dispatch:

| Method/route | Response fixture | Count/assertion |
| --- | --- | --- |
| GET `/api/paypal-config` | 200 `{clientId:"local-mock-client",mode:"sandbox"}` | One per page load. |
| GET `https://www.paypal.com/sdk/js?...` | 200 empty JavaScript | Mocked, never forwarded; one per page load. |
| POST `/api/claim-license` | Initially 403 `{success:false}`; on paid revisit 200 `{success:true,licenseKey:"DSK-AAAA-BBBB-CCCC"}` | Body contains the pending order ID. Exact polling counts are logged; revisits add exactly one successful claim. |
| POST `/api/paypal-capture-order` | 202 `{success:false,unpaid:true,pending:false,status:"VOIDED"}` | Only confirmed VOIDED plus Discard clears the pending order and enables checkout. Recover alone retains it. |
| POST `/api/paypal-capture-order` | 404 JSON `{success:false,error:"Could not verify the PayPal order. Please retry or contact support@devsnapkit.com."}` | Order retained, no key/notice/checkout. |
| POST `/api/paypal-capture-order` | 404 `text/html`, `<html>Not Found</html>` | Same conservative retention, distinct fixture. |
| POST `/api/paypal-capture-order` | 202 `{success:false,unpaid:false,pending:true,status:"APPROVED"}` | Order retained, actions retryable. This is a simulated response, not a claim about a normal approved capture. |
| POST `/api/paypal-capture-order` | 202 `{success:false}` | Unknown response retains order and blocks new checkout. |
| POST `/api/paypal-capture-order` | 200 `{success:true,status:"COMPLETED",licenseKey:"DSK-AAAA-BBBB-CCCC"}` | Paid fixture unlocks UI, clears fulfilled pending order, no new create. |
| POST `/api/paypal-create-order` | 200 `{id:"SECONDORDER1234567"}` | Zero in all 24 rapid-action matrix cases and both revisits; exactly one in the separate confirmed-VOIDED continuation. |
| POST `/api/telemetry/event` | 204 empty | Mocked background UI events; exact counts logged, no payment behavior. |

Every pending capture request body is exactly `{orderId:"ORDER1234567890123"}`. The single new-order capture uses `{orderId:"SECONDORDER1234567"}`. There are no real provider requests behind these app routes.

The 24-case matrix is 2 timings × 2 actions × 6 fixtures. Each case attempts the primary action three times, then the opposite action three times while the response remains held: **6 DOM click attempts, exactly 1 POST capture check and 0 creates**. Same-turn attempts have no intervening await; millisecond attempts use `setTimeout(1)` between attempts (timer scheduling is not claimed to be exact). Disabled-button attempts remain logged as attempts, not delivered handlers. All cases assert the pending order remains before the response, both controls are disabled while held, and checkout is hidden. The same-turn APPROVED discard additionally holds the response for at least five seconds and rechecks these invariants. Paid cases unlock from the response; unknown/404/APPROVED cases retain the original order; VOIDED only clears it on Discard.

The other three cases are:

1. Close tab with a pending order and no key, open a new tab at the same local origin without reseeding storage, receive one completed claim: **0 action attempts, 0 captures, 0 creates**.
2. After a same-turn triple Discard receives JSON 404, close and revisit; receive one completed claim: **3 action attempts, 1 original check, 0 new captures and 0 creates**. The 404 was never cleared as unpaid.
3. Confirm VOIDED, then click one mocked SDK checkout: **4 action attempts (3 Discard + 1 checkout), 1 create, 2 app capture POSTs (1 old check + 1 new order), successful simulated license**. It does not test rapid SDK create callbacks.

## Results and limits

| Command | Pass | Fail | Skip | Result |
| --- | ---: | ---: | ---: | --- |
| `npm run test:security` with `TEST_UI_URL` unset | 28 | 0 | 1 | Exit 0; 29 registered. |
| `npm run test:pricing` | 81 | 0 | 0 | Exit 0. |
| `npm run test:paypal` | 74 | 0 | 0 | Exit 0. |
| `npm run test:paypal:browser` | 2 | 0 | 0 | Exit 0; existing 21 scenarios. |
| `npm run test:paypal:retry:browser` | 27 | 0 | 0 | Build + focused browser tests. |
| `npm run test:build-revision` | 2 | 0 | 0 | Exit 0. |

Total: **214 passed, 0 failed, 1 skipped; 215 registered tests**. The skipped test is `admin UI stores only a token and removes legacy saved passwords` in `tests/security-ui.test.mjs`, gated by absent `TEST_UI_URL`.

Sanitized result snapshot: `docs/evidence/payment-retry/verification.json`. The final focused browser run began `2026-11-17T01:42:25.351Z` and recorded **151 action attempts, 354 assertions, 27 screenshots**, including a measured 5,003 ms response hold. All screenshots were programmatically checked: PNG chunks contain only IHDR/IDAT/IEND, with no embedded EXIF, XMP or C2PA chunks. `git diff --check` exited 0. The locally emitted build revision is explicitly null/unavailable because no SHA was supplied.

The build retains the existing large-chunk warning. Revision tests were first observed failing (0 pass, 2 fail) because the generator was absent, then passing after implementation. The browser harness's first isolation run failed 25 cases because the app requested Google Fonts and local telemetry; those requests were blocked, not sent to payment services. The harness now explicitly blocks the known font and mocks telemetry instead of treating expected background traffic as a payment failure; all 27 final cases pass. No payment UI behavior was changed by this follow-up.

A separate read-only code review found no critical or important issues. Its minor evidence suggestion was incorporated: the build manifest now records the payment-bearing studio bundle, scoped source hashes and untracked paths as well as the entry bootstrap. The reviewer did not independently rerun tests or make network calls.

Commit creation is blocked by the native filesystem boundary: Git cannot create `D:/workspace/MarkMoney/apps/shotcraft/.git/worktrees/shotcraft-payment-retry/index.lock`, which is outside the writable worktree. A per-command `safe.directory` option resolves ownership checking without changing global Git configuration, but cannot grant filesystem writes. No attempt was made to bypass this denial. **No new commit hash exists from this follow-up**; the changes remain local for review. The starting/current HEAD remains `22274d3828ab41594045d4c628783dffae8cd1ea`.

## What TesterBot needs for a real sandbox check

The following is a handoff checklist, not authorization to start a payment. An authorized operator can keep all credentials in their own environment; do not paste tokens, client secrets, signing secrets or buyer credentials into the evidence.

1. **Deployment provenance:** immutable URL, deployment ID and UTC time, reviewed full SHA, build input/indicator, Cloudflare build/deploy record linking that source to both assets and Functions bundle, and a non-secret operator attestation of sandbox mode and stable pseudonymous app/merchant identity. A public config GET and matching browser assets alone are insufficient.
2. **Known sandbox order provenance:** one newly created order from that same deployment/app/account context, its order ID, creation time, expected product/reference/amount/currency, expected scenario status, and an operator-controlled sandbox buyer approval. Use current source pricing, not the stale "one-dollar" text in an older test title. No actual approval or payment was initiated in this investigation.
3. **Correlated request evidence:** exact UTC, UI action count/timing and viewport, method, immutable host, full app route, non-secret request body, response status/content-type/body and request/trace ID for config/create/capture/claim. Redact credentials, cookies, Authorization, buyer PII and usable license keys. Include aborted/timed-out requests and distinguish app capture POSTs from upstream provider capture POSTs.
4. **Provider/backend evidence:** allowlisted outgoing API host, route/method/count/status, stable `PayPal-Request-Id`, provider error name/detail/debug ID if available, canonical final order/capture status, and the matching webhook event/signature-verification result. Existing lookup failures intentionally omit provider debug IDs from the public body; operator logs or additional separately reviewed redacted diagnostics may be needed. Do not dump raw provider payloads or bindings.
5. **Durable and revisit checks:** one completed capture mapped to one stored order/license, consistent fulfillment across webhook/client retry, signed license verification, closed-tab/reload recovery using the same original order, and zero extra creates while the original outcome is unknown or paid. Capture attempts may retry idempotently; the evidence must distinguish attempts from actual completed captures. A unique row alone does not prove only one charge across different order IDs.
6. **Controlled fixture scenarios:** verified terminal VOIDED with no captures; APPROVED/pending states; a known lookup 404 in the identified context; delayed/failed responses; completed payment with frontend callback lost. For a route-level HTML 404, supply the exact path/method/deployment context and response headers/body. Do not fabricate a terminal state by editing local storage or force a second payment just to complete a checklist. Backend fault injection would need a separately authorized isolated sandbox environment; no public bypass was added here.

The original two 202s and later 404 remain undiagnosed. Required historical evidence is the exact method/full route/UTC/status/content-type/body, original order ID and creation provenance, immutable deployment context, correlated provider lookup/capture response and debug ID if retained. Present-day GETs and local fixtures cannot reconstruct those missing facts. Sandbox/live/account mismatch remains a hypothesis.

## Unknown-order continuation and duplicate-payment risk

Retain the original pending order. Wait for verified claim/webhook recovery, or use Recover under appropriate operator/user authorization; **Recover and Discard both call the capture-capable POST handler**, so they can capture an APPROVED order rather than merely look it up. Support can reconcile the original order against its original mode/app/merchant using existing trusted dashboards/logs, recover a completed signed license, or establish a genuine terminal VOIDED/no-capture outcome. A future read-only status/reconciliation flow could improve this experience but must be authenticated/verified and cannot treat absence in one account as proof of nonpayment. None was added or invoked here.

When verification stays unavailable, checkout intentionally remains blocked. There is no safe inference from a lookup 404, 403, 422, timeout or 202 UNKNOWN to unpaid. Clearing storage, switching browser/profile or abandoning the old ID may enable a different order while the old order later captures; these are **not safe continuation recommendations**.

The pending-action guard covers one UI instance. Capture idempotency uses the same order ID, and database uniqueness covers duplicate fulfillment of that order. Create uses a fresh UUID per request; this follow-up does not establish cross-tab/device/buyer-wide checkout deduplication, or safety if a real SDK invokes create callbacks repeatedly. Different order IDs can still represent separate charges. Browser storage may be unavailable or cleared, older stored IDs lack mode/account/time provenance, and a delayed approval/webhook can outlive a page. The existing SDK cancellation path clears the pending ID without an independent terminal provider check; a late approval racing cancellation is another unvalidated window. No remaining-risk claim is a reproduction of the historical failure; real SDK/sandbox and correlated provider evidence are still required.
