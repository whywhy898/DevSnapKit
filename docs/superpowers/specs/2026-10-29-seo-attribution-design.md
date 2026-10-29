# SEO entry attribution and focused landing copy

User approval: the user approved the preceding DevSnapKit assessment and requested execution of the prioritized changes. This document concretizes that approved scope.

## Scope and design

Use the existing anonymous telemetry endpoint and D1 metadata column. A shared, small classic browser script is loaded before the editor entry and before the static landing interactions. It owns an anonymous session ID, an allowlisted first SEO landing path, the original referrer hostname, and a 30-minute inactivity expiry in sessionStorage. Do not store image contents, arbitrary query strings, URL fragments, emails, or campaign text. A rejected storage write degrades to page-local memory; those events do not enter the joined session funnel.

The four landing pages emit `seo_landing_view` and their editor links emit `seo_editor_open`. Existing editor events automatically receive the same attribution metadata. The first SEO entry persists across related-page visits and editor refreshes; a new expired session starts clean. Returning from an allowlisted same-origin landing can recover the source if storage is unavailable. Analytics failure must never interrupt navigation, editing, uploads, or export.

An authenticated admin report groups stable anonymous sessions over the last 30 days by their first SEO entry. Its ordered stages are landing, editor open, own-image upload, and generated export/copy. Persist a validated increasing event sequence before transport, and use it for user-operation order even when beacons arrive out of order; server time only limits the 30-day window. Count each session once per stage; require each preceding stage, exclude malformed metadata and unknown entry paths, and do not mistake checkout clicks for payments. A real secondary-slot upload counts, and each actual Pro batch output generates a successful export event. Pro and checkout interest are auxiliary entered-session counts. Report unavailable when D1 is absent or the query fails, rather than fabricate zero success. No order schema or payment flow changes.

Refine existing landing H1 and editor CTA copy to explain the actual task. Add one relevant contextual link per page using existing CSS and preserve all editor query presets, Free/Pro claims, demos and layout. No new pages or visual redesign.

## Acceptance

- All four landing-to-editor flows preserve first-entry identity through actual image upload and generated export, with no image data in events.
- Refresh and related-page navigation retain context; 30-minute expiry resets it. Invalid saved state and denied storage cannot break the app.
- Event transport falls back when sendBeacon declines or throws, and never throws into product code.
- Real SQLite fixtures verify cohort deduplication, ordered stages, expired-window exclusion, corrupt metadata and absent-D1 status.
- Desktop and mobile browser verification checks all four presets, actual upload/export, links, event payloads and admin rendering.
- Existing SEO, security regression tests and the production build pass.
