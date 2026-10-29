# SEO entry attribution

The four existing tool pages share `/seo/attribution.js` with the studio. No new analytics vendor or database migration is needed. The authenticated admin overview includes **SEO entry → first export · 30 days**.

## Collected context

`sessionStorage.dsk_attribution_v1` stores an anonymous session ID, first allowlisted tool-page path, original referrer hostname, an increasing event sequence and last activity time. After 30 minutes without tracked activity a new session starts. Subsequent related-page navigation and studio reloads retain the first entry within that session.

Events carry the context in existing `metadata`:

| Field | Meaning |
|---|---|
| `seo_entry` | One of `/screenshot-beautifier/`, `/og-image-generator/`, `/product-hunt-image-maker/`, `/add-text-to-image/` |
| `entry_referrer` | Original referrer hostname or `direct`, without path/query/fragment |
| `event_sequence` | Positive integer assigned and saved before transport; reserved against caller overrides |
| `attribution_storage` | `session` when context can be persisted; `memory` when browser storage is unavailable |

The runtime adds `seo_landing_view` on a tool page and `seo_editor_open` on an editor CTA. Existing studio upload, generated export, copy, upgrade and checkout events receive the same context. Upload image/logo filenames are removed. Image bytes, full referral URLs and arbitrary query parameters are not added to analytics.

`sendBeacon` is best effort. If it declines or throws, a keepalive fetch is attempted. Serialization, storage and synchronous network failures cannot throw into the product.

## Report definition

- Uses server `created_at` for a rolling 30-day eligibility window.
- Uses validated per-session client sequence for operation order, because concurrent beacons can arrive at D1 in another order.
- Deduplicates by first entry and anonymous session, starting from an observed landing event.
- Stages: landing → editor CTA → own-image upload → successful image generation/download or clipboard copy.
- A successful second-image upload (`media_slot_add/replace`, slot 2, positive file size) also satisfies upload.
- Pro batch exports emit successful `export_image` events only after a real output blob exists. Multiple output files count as one session in the funnel, while the general export event counter can count each generated file.
- Upgrade-modal and checkout-click sessions are auxiliary entered-session counts. They do not imply a paid order. Payment processing and order statistics are unchanged.
- Missing/failing D1 is explicitly unavailable, not zero conversion. Historical events without the new valid context are not backfilled.

The table compares entry pages across **all channels**, not only organic search. Search Console remains the separate source for Google queries, impressions, clicks and index coverage. It was not connected or inspected by this code change.

Anonymous sessions are not people. Cross-device, private browsing, new tabs and blocked storage can prevent continuity. Memory-only events are excluded from the joined funnel; the editor still works. Beacon loss can still undercount: this is product telemetry, not payment accounting or a guarantee that a browser download reached disk.

## Verification

Run from this repository:

```text
npm run build
npm run test:seo
npm run test:seo:attribution:browser
node --test tests/security.test.mjs tests/security-ui.test.mjs tests/preview-admin-license.test.mjs tests/paypal-webhook.test.mjs tests/paypal-recovery.test.mjs
```

The browser runner serves the actual production build on a temporary loopback server and receives real beacon POST bodies. It uses local fixture responses for admin data and Pro verification; it does not call production telemetry, charge a payment or use production credentials. It checks four landing entries on desktop/mobile, actual uploaded screenshots and PNG downloads, storage denial, second-slot-only Pro batch export, and available/unavailable admin states. SQL tests execute real SQLite and the actual ingestion handler.

Default browser evidence directory: `D:/workspace/MarkMoney/output/devsnapkit/seo-attribution-2026-10-29`. Optional `SEO_TEST_SLUG` or `SEO_BATCH_ONLY` variables limit diagnosis; full acceptance requires running without those variables.

After deployment, open the existing authenticated admin overview to observe **new** data. No historical conversion results are implied by the empty initial report.
