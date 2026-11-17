# Growth and SEO preview operations

No resources were created and no deployment was performed. Configuration was not
inspected. Confirm these bindings in the preview environment before enabling the
features below; this list describes code requirements, not observed bindings.

| Name | Type | Purpose |
| --- | --- | --- |
| `DB` | Existing Cloudflare D1 binding | Payments, fallback events, optional feedback and checkout attribution. Start with `d1/schema.sql` for a new database; apply `d1/migrations/0001_growth_feedback.sql` to the existing database. |
| `EVENTS` | Optional Workers Analytics Engine dataset binding | Preferred event store. Dataset name in the example query is `devsnapkit_events`; change the SQL identifier to the actual dataset name. Without this binding, events use `DB`; without either, event ingestion returns 204 and discards events. |
| `VITE_CF_BEACON_TOKEN` | Optional public build variable | A 32-character hex Cloudflare Web Analytics token. Omit it to inject no beacon. Vite dotenv loading is disabled; supply public build values explicitly through the build environment. |
| `FEEDBACK_ENABLED` | Server variable, literal `true` | Explicit operator opt-in, absent/off by default. Set only after migration, support mailbox and deletion workflow have been checked. |
| `ADMIN_SECRET` | Existing server secret, at least 32 characters | Existing admin authentication and authenticated feedback deletion. Required before feedback can be enabled. |
| `DSK_SERVER_SECRET` | Existing server secret, at least 32 characters | Existing payment license signing. |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Existing PayPal server credentials | Existing order verification and capture; use matching sandbox credentials on preview. |
| `PAYPAL_MODE` | Existing server variable (`sandbox` or `live`) | Selects PayPal API and classifies verified payments. Preview should use `sandbox`. |
| `PAYPAL_WEBHOOK_ID` | Existing PayPal webhook verification configuration | Required for the existing signed webhook route. Browser recovery can verify a completed order even if its webhook is delayed. |

Pricing and `PRICE_CHANGED_AT` grace-window behavior are unchanged. No new email
delivery provider is needed for these changes. No Creem integration or www
redirect is included.

## Feedback activation and deletion

Collection is disabled until `FEEDBACK_ENABLED=true`, a usable `DB`, a valid
`ADMIN_SECRET`, and the feedback table are available. The client checks
`GET /api/feedback` and never opens the form when readiness is false/unavailable;
the POST independently checks configuration and requires a successful D1 insert.
Migration failure cannot produce a success response. No email/message is stored
by the analytics endpoint.

Before opting in, confirm that `support@devsnapkit.com` is monitored and that an
operator can authenticate with the existing admin route and execute deletion.
Mailbox delivery and remote bindings have not been verified in this task.

For a request, privately locate matching rows in D1 by the supplied email or
feedback text, confirm the requester/record, and delete each matching record via
`DELETE /api/admin/feedback` with the existing admin Bearer token and JSON
`{"id":"the-exact-record-id"}`. The response reports the deleted count. Missing
or invalid tokens are rejected. The route works even after collection is turned
off. There is deliberately no public search/list endpoint. Do not log submitted
emails, messages or admin tokens. D1 backups/retention require the operator's
normal database retention process; the deletion route removes active table rows.

## Analytics meaning and limits

Only `visit`, `editor_open`, `export`, and `payment` are accepted. The legacy
telemetry URL aliases the same contract; older event names return 400. Historical
SEO cohort code/data is retained, but new events use the four-event funnel.

Host-derived environment labels prevent client-supplied `env` values from changing
classification. **They are not authentication or proof of a human visit.** Public
visit/editor/export counts and campaign tags can be forged. This feature does not
provide a globally enforced anti-abuse system. The approximate 30/minute limiter
uses an expiring, bounded in-memory IP map per isolate; isolates, regions, cold
starts and independently bundled routes do not share counters. IPs are not saved
to D1 or Analytics Engine by this code. Expired map entries are cleaned on a later
request or isolate teardown; a one-minute window is not a guaranteed physical
memory-deletion deadline.

`payment` cannot be submitted through public event ingestion. It is emitted only
after server verification of a matching completed PayPal capture, durable order
storage and the D1 unique-order insert/update winner. Duplicate browser captures
and webhooks do not double-count. Sandbox payments on a production hostname are
tagged preview; they cannot enter the production funnel or revenue aggregates.
The stored order payload includes server-derived mode/environment. Production
admin order/revenue figures include only explicit live/production records;
unclassified historical orders and old KV aggregates are excluded until an
operator audits their provenance. The order records remain available for support.
Analytics is best effort: a failed write after fulfillment is not replayed, so an
event may be lost. This favors avoiding duplicate payment counts over delivery
guarantees; the orders table remains the payment record of truth.

`scripts/growth-funnel-analytics-engine.sql` reports a sample-weighted 30-day funnel
by source, production by default. The authenticated admin `growthFunnel` reads D1
events, with optional `?env=preview` or `?env=dev`. When `EVENTS` is configured,
event writes go there rather than being duplicated in D1; use the dataset query
for a complete event funnel. Production admin headline statistics use classified
D1 events; old upload/trial counters are no longer emitted by the four-event
client. No bindings means no metrics, not measured zero traffic.

## Recovery and QA

Pending PayPal order references persist in localStorage across tab closure. A
return to the bare homepage also opens recovery. Only a server-confirmed EXPIRED
or VOIDED order without pending/completed capture evidence stops claim polling;
HTTP 403/422, CREATED/APPROVED/unknown states and request failures preserve it.
Explicit user cancellation/abort stops the current poll. The normal retry budget
is 60 attempts at three seconds; exhaustion retains the pending reference for a
future recovery attempt. Successful recovery stores the verified license key.

The hero uses existing before/after images and keeps picked/dropped image Files
only in document memory while opening the editor. The export card runs after the
browser download click. API failures never gate export. The preview-only
`simulate_api_fail=1` switch is ignored on production hosts.

`node --test tests/growth-browser.test.mjs` serves the built files locally, mocks
configured feedback readiness, forces event/feedback POST failures, verifies real
downloads and saves light/dark evidence at 1440 and 390 pixels to
`scratch/growth-seo-evidence/`. This is local UI evidence, not proof of configured
remote persistence. `npm run test:paypal:browser` also verifies real tab closure
and a new tab returning to `/` using the persisted order.

Privacy was intentionally updated in `src/legal/legalContent.json` and regenerated
in `public/privacy/index.html`; keep both. Sitemap dates follow individual source
commit dates, with today's UTC date for uncommitted changes. Unchanged generated
terms output must not be restored over intentional legal source changes.
