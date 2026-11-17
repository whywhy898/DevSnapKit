# Payment retry review — 2026-11-17

Follow-up validation and sandbox handoff: [payment-retry-validation-follow-up.md](payment-retry-validation-follow-up.md). It adds local-only browser evidence and a future build revision indicator; it does not establish historical backend deployment provenance or diagnose the original 202/404.

## Scope and result

Work was performed only in `D:/workspace/MarkMoney/.worktrees/shotcraft-payment-retry`, branch `fix/payment-retry`, starting clean at `bcf21d3d6be0e60d0f2c218a806cacbab6c212f8` (annotations-polish). The queued task's scheduling/branch instructions were superseded by the user's instruction to start here.

The historical POST 404 blocker is **not diagnosed or resolved**. No old order ID, response body, or creation provenance was supplied. The patch fixes separately reproduced unsafe discard decisions. Unknown and intermediate results intentionally continue blocking another checkout, preserving payment/license recovery.

No credentials, `.env` files, or `wrangler.toml` were inspected. No remote POST, capture, order creation, real payment, production change, push, deployment, or merge was performed. All mutation flows in tests use mocked HTTP and in-memory storage. Creem was outside the review scope. No other worktree was modified.

## Public read-only evidence

Both URLs were probed on 2026-11-17:

- https://feat-annotations-polish.devsnapkit.pages.dev
- https://66aadcce.devsnapkit.pages.dev

| Request | Result at both origins | Interpretation |
| --- | --- | --- |
| `GET /` | 200 HTML; 18,443 bytes; SHA-256 `4d98b72f30f87b16ad7fe05208a72de56fb205187821c0b6f771ce77fd752707` | Alias and known deployment currently serve the same entry HTML. |
| `OPTIONS /api/paypal-capture-order` | 200 JSON `{}`; `Cache-Control: no-store`; `Access-Control-Allow-Methods: POST, OPTIONS` | Matches the source OPTIONS handler; evidence of route presence at observation time. Does not exercise POST or its bindings. |
| `GET /api/paypal-capture-order` | 404 HTML; 3,360 bytes; SHA-256 `16c5621d1e41f8600824073fa3cbdbdb03b99f11760205ce26f3ed5bcdb72df7` | There is no source GET handler. This does not establish a missing POST route. |
| `GET /api/__payment_review_missing_route__` | Same 404 HTML bytes/hash | A missing route and unsupported GET are indistinguishable in this probe. |

An unmodified local build at `bcf21d3` was completed before source changes. Each following generated bundle returned HTTP 200 and was byte-identical at **both** public origins:

| Bundle | Bytes | SHA-256 |
| --- | ---: | --- |
| `index-CPbT1dVR.js` | 2,182 | `dfd58ae03d3d5ed1948a0b7bcb160d7303649216fdcdfd08c8f9e4d23f4f1acc` |
| `browser-DHoEOgjd.js` | 25,777 | `2cbac01acc733d9bba57ce5e4d3c09e83be99ebc371138514cede4c839ccad6f` |
| `studio-CXUno4rM.js` | 653,152 | `f7895ab4751e5cc1280ba389a8c200d82d04e854e55c52da8df134a255b0a324` |
| `studio-JG6PdHFl.css` | 165,371 | `826360a296a23899b39df2ff3b5332b8bce5cec89006aec8a179934a2cd5c110` |

This verifies the generated frontend JS/CSS against the baseline. It does not prove backend source identity, deployment settings, account identity, historical deployment contents, or old-order provenance. Local HTML was not claimed byte-identical to deployed HTML. The patch has not been deployed.

## Endpoint and state evidence

The reviewed POST handler validates storage and order ID, authenticates server-side, reads the order from the selected PayPal API host, validates purchase metadata, and may capture an APPROVED order with a stable `PayPal-Request-Id`. Consequently, neither Discard nor Recover is a purely read-only order check. They were never invoked remotely during this investigation.

In `functions/lib/paypal.ts`:

- `paymentConfig` chooses the sandbox or live host from runtime bindings; the source default is live. Runtime values were not inspected. Remembered browser orders store only the ID, with no creation mode/account/time provenance.
- `readOrder` converts an upstream order lookup 404 into application JSON HTTP 404: `success: false`, error `Could not verify the PayPal order. Please retry or contact support@devsnapkit.com.` Other non-success lookup statuses map to 503. No `unpaid` proof is returned.
- A mismatching order/purchase or a failed approved capture can produce 422. A 422 therefore cannot authorize discarding.
- Provider detail codes/debug IDs are not returned by this lookup failure path; its public response cannot distinguish invalid ID, unavailable resource in the selected context, or a possible mode/account mismatch. Existing server warning logs only the mapped status.
- `ORDER_ALREADY_CAPTURED` triggers a canonical reread. Verified fulfillment durably saves one order/key; repeated/concurrent deliveries are covered by existing tests.

The original old-order 404 could be route/platform HTML or the application's forwarded lookup JSON, among other failures not reproduced here. Today's OPTIONS response does not establish what happened historically. A sandbox/live mismatch is a hypothesis, not a finding. The earlier two 202 responses also remain unattributed. At baseline, 202 could indicate a noncompleted order or a pending capture; their original bodies are needed.

Official documentation was checked via bounded, read-only HTTP processing after Context7 CLI installation failed with network access denied and the documentation fetch/index tool was approval-blocked:

- [PayPal Orders errors](https://developer.paypal.com/api/rest/reference/orders/v2/errors/) describes `RESOURCE_NOT_FOUND` / `INVALID_RESOURCE_ID` as a resource lookup failure, without proving this old request's cause.
- [PayPal's Orders v2 OpenAPI specification](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/checkout_orders_v2.json) lists CREATED, SAVED, APPROVED, VOIDED, COMPLETED, and PAYER_ACTION_REQUIRED. The patch uses a conservative VOIDED-only discard policy.

## Patch

- `src/paypalCheckout.ts`: removed unconditional 403/422 → unpaid conversion. Discard authorization now requires an HTTP-success JSON response with `success: false`, `unpaid: true`, `pending: false`, and `status: VOIDED`. HTML/JSON 404, unknown, contradictory, malformed, aborted, and failure responses remain retryable.
- `functions/api/paypal-capture-order.ts`: reports unpaid only for VOIDED with no capture evidence (absent or empty captures). Includes canonical order status in the noncompleted response. CREATED, SAVED, PAYER_ACTION_REQUIRED, APPROVED failures, and unknown capture states preserve recovery.
- Tests cover provider failures in both mock environments, client response classification, duplicate capture recovery, rapid clicks, delayed response, retry/re-enable, and paid license recovery across tab closure.

Behavioral consequence: CREATED/SAVED/PAYER_ACTION_REQUIRED orders that previously could be discarded now remain pending. This is intentional under the requirement to preserve intermediate states. It is not a new escape hatch for the reported old order. Another checkout stays blocked until authoritative terminal-unpaid evidence or verified paid recovery is available.

The verification, pricing, canonical capture, signed-license generation, durable fulfillment, claim polling, and provider idempotency logic were not weakened.

## Verification

Test-first reproduction: new assertions failed on the original source for blanket 403/422 discard, intermediate statuses, absent terminal status in the response, and a VOIDED order with an unknown capture. The focused suite then passed after the minimal source patch.

| Command | Passed | Failed | Skipped | Result |
| --- | ---: | ---: | ---: | --- |
| `npm run test:security -- --test-reporter=tap` | 28 | 0 | 1 | Exit 0; 29 registered tests. |
| `npm run test:pricing -- --test-reporter=tap` | 81 | 0 | 0 | Exit 0. |
| `npm run test:paypal -- --test-reporter=tap` | 72 | 0 | 0 | Exit 0. |
| `npm run test:paypal:browser -- --test-reporter=tap` | 2 | 0 | 0 | Exit 0; two top-level tests run 21 mocked scenarios. |
| `npm run build` | — | — | — | Exit 0, before patch and after patch. Existing large-chunk warning remains. |
| `git diff --check` | — | — | — | Exit 0. |

Totals: **183 passed, 0 failed, 1 skipped; 184 registered tests**. The reporter argument followed the script's test paths, so npm runs displayed the default reporter; counts above are from the actual summaries. A separate direct `node --test --test-reporter=tap tests/paypal-webhook.test.mjs tests/paypal-recovery.test.mjs` run also reported 72/0/0.

An independent read-only safety review found no critical or important issues in the scoped patch and independently reran the mocked webhook/recovery tests successfully. Its browser/build assessment relied on the recorded runs above.

The security skip is `admin UI stores only a token and removes legacy saved passwords` in `tests/security-ui.test.mjs`, gated on absent `TEST_UI_URL`. It was not represented as executed. Local PayPal browser tests ran successfully without requiring access to the preview browser.

Browser coverage includes five checkout/recovery scenarios and sixteen pending-order scenarios. The pending actions request triple clicks at 1 ms intervals, hold the response until assertions finish, and verify one request per action window plus mutual disabling of Recover/Discard. A processing case additionally holds the response for five seconds. Network/503/404 HTML/404 JSON/unknown/approved/403/422 failures retain the order and hide checkout; actions re-enable for recovery/retry. VOIDED permits restart, while a paid result recovers the verified key. A closed tab is replaced with a new page at the same local origin and recovers via mocked claims without another capture.

Not executed: remote POST/capture/order creation, actual sandbox/live payment, the historical old-order reproduction, remote browser checkout, environment/account provenance inspection, and deployment/backend binding verification. These omissions are intentional or require the missing diagnostics below.

## Required missing diagnostics

For the original failing request, provide a sanitized existing Network record (do not replay capture): exact URL/deployment hostname, method, timestamp/timezone, status, Content-Type, response body, redirect chain if any, and correlation headers such as `cf-ray`. Exclude cookies, authorization headers, credentials, and personal payment data.

The order ID and existing order-creation record are needed to correlate the same order. Record creation timestamp, deployment, sandbox/live context, and whether creation and lookup used the same merchant/account context; an authorized operator can confirm context without disclosing credentials. Include original SDK approval/cancel/close sequence and any existing provider order/capture statuses or receipt evidence. Existing sanitized provider diagnostics (`name`, `details[].issue`, `debug_id`) would help if available; the current app lookup response does not preserve them. Obtain the original two 202 bodies as well. A fresh order or a new payment would not identify the historical failure.

## Repository delivery

The tested patch remains local and uncommitted. After verification, staging the five payment source/test files and this report failed: native Git could not create `D:/workspace/MarkMoney/apps/shotcraft/.git/worktrees/shotcraft-payment-retry/index.lock` (permission denied). That linked-worktree metadata directory is outside this session's writable root, and approvals are disabled. No attempt was made to bypass that restriction. No commit hash is claimed. Final HEAD remains `bcf21d3d6be0e60d0f2c218a806cacbab6c212f8` on `fix/payment-retry`.

Build-generated `public/privacy/index.html` and `public/terms/index.html` can appear modified in status because Git cannot refresh the index; both were checked byte-identical to HEAD and have no content diff. Only the payment source/tests and this report contain intended changes.
