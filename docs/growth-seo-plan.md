# Growth and SEO preview implementation

Branch: `feat/growth-seo`. Preview only; no deployment, push, production changes, or Cloudflare resource creation.

1. Correct public price and annotation claims without changing pricing or grace-window logic. Repair the four original H1s, derive their structured data from visible FAQs, add the annotation landing page and contextual links, and generate per-source sitemap dates from Git.
2. Retain the existing static homepage style, use the existing genuine original/export images as a before/after, and hand a locally selected File to the editor in the same document (no upload or persistent image storage).
3. Extend the existing attribution runtime and D1 events infrastructure for exactly visit, editor_open, export, and server-only payment. Validate bounded input, derive environment from host, share a transient per-IP rate limiter, prefer optional Analytics Engine, and expose production-default funnel queries.
4. Preserve order uniqueness for payment deduplication, save attribution when creating an order so webhooks retain it, and record payment only on the winning successful fulfillment.
5. Show optional feedback only after download starts. Use the existing DB binding with a migration; isolate telemetry and feedback failures from downloads. Add a non-production failure switch and regenerate privacy from its JSON source.
6. Run focused regression tests and every requested suite/build, review implementation, capture light/dark desktop/mobile browser evidence, and commit all intended files on the feature branch.

Data contract: no cookies, image uploads, IP persistence, or fingerprinting. Attribution consists only of utm_source, utm_medium, utm_campaign, ref, a random session ID and URL pathname. The feedback form explicitly explains optional product-update email and deletion through support@devsnapkit.com.

Sitemap dates refer to each tracked page source, with privacy/terms mapped to their legal source; uncommitted source changes use the current UTC date until committed. Analytics Engine funnel SQL uses the documented blob positions and sample weights; D1 admin reporting reads existing events metadata. Existing payment storage and credentials remain authoritative.
