# Shared Pro pricing

The single offer config is `shared/pricing.ts`: `currency: 'USD'`, `amount: '9.90'`, `displayPrice: '$9.9'`, stable product identity, and `previousPrice: { amount: '1.00', graceHours: 24 }`. Public copy and structured offers advertise the current price with an early-bird label.

Payment verification accepts the current price at all times. The previous price is accepted only while `now < Date.parse(PRICE_CHANGED_AT) + graceHours * 60 * 60 * 1000`; it is rejected at the exact expiry boundary. Browser capture, webhook, and IPN paths use this same server validator. The completed capture must match its order's amount using exact integer cents. Other amount rejection and all existing status, merchant, capture, persistence, and license checks remain unchanged.

## Release configuration

Right before deploying the price change, set `PRICE_CHANGED_AT` to the actual ISO 8601 UTC release timestamp for **both preview and production**. Use:

```sh
wrangler pages secret put PRICE_CHANGED_AT
```

Enter the release timestamp when prompted, and select the intended Pages project/environment. Repeat for preview and production. Alternatively, set the `PRICE_CHANGED_AT` environment variable in the Pages project's Preview and Production settings before deploying each environment. Do not edit `wrangler.toml` or local `.env*` files.

Use a UTC timestamp such as `2030-04-05T12:00:00Z`; fractional seconds and `+00:00` are supported. A missing, empty, malformed, non-UTC, or impossible timestamp disables previous-price acceptance and logs a warning when that price is checked. Current-price purchases remain accepted, and one-cent and other unconfigured amounts remain rejected.

Preserve this timestamp on later deployments so redeploying does not restart the grace period. For the next price change, update the shared current/previous amounts and set a new release timestamp. Keep the product reference ID stable.

Clock-injected pricing tests cover different release timestamps, within-window acceptance, exact/after-expiry rejection, missing/invalid configuration and warnings, current-price acceptance, one-cent rejection, and capture/webhook/IPN fulfillment.

## Changed files

- `shared/pricing.ts`: shared offer and stable product identity.
- `functions/api/paypal-create-order.ts`: configured amount, currency, description, and product reference.
- `functions/lib/paypal.ts`: order-relative payment verification and shared identity/currency.
- `functions/api/admin/stats.ts`: configured amount/currency defaults; stored historical amounts remain authoritative.
- `src/App.tsx`: configured header price, PayPal SDK currency, and modal price component.
- `src/ProPrice.tsx`: identical modal price markup with optional comparison price.
- `src/productCopy.ts`: configured price, currency, and product title in copy.
- `src/index.css`: remove the price literal from a comment; no style changes.
- `package.json`: add `test:pricing` using `node --test`.
- `tests/pricing.test.mjs`: 28 tests covering consumers, duplicate literals, historical pricing, activation, invalid purchases, and comparison-price markup.
- `tests/paypal-webhook.test.mjs`: the invalid approved-order fixture now uses a wrong product identifier, since a different positive order price is valid.
- `tests/seo-guide-pages.test.mjs`: follow the shared config when asserting the advertised price.
- `tests/seo-cache-versioning.test.mjs`: explicitly target this checkout for the nested build and normalize the Windows directory path, avoiding sibling workspace-name conflicts.
- `docs/superpowers/plans/2026-11-11-shared-pricing.md`: completed implementation checklist.
- `docs/pricing-refactor.md`: this summary.

## Static HTML exceptions

These pages are served directly from `public/` without TypeScript module imports. Their price literals remain unchanged:

- `public/cleanshot-alternative/index.html`
- `public/iphone-mockup-generator/index.html`
- `public/linkedin-post-image-size/index.html`
- `public/macbook-mockup-generator/index.html`
- `public/pika-style-alternative/index.html`
- `public/screely-alternative/index.html`
- `public/shotgenio-alternative/index.html`
- `public/shots-so-alternative/index.html`
- `public/xnapper-alternative/index.html`

The remaining `$142,850.00` and `-$15.00` in `src/templates.ts` are unrelated sample-dashboard data. No exact Pro price literals remain in `src/` or `functions/`.

## Verification results

| Check | Result |
| --- | --- |
| `npm run test:security` | Pass: 28 passed, 1 existing browser test skipped |
| `npm run test:seo` | Pass: 119 passed |
| `npm run test:pricing` | Pass: 28 passed |
| `npm run test:paypal` | Pass: 35 passed |
| `node --test tests/product-copy.test.mjs` | Pass: 4 passed |
| `npm run build` | Pass: TypeScript, Vite, legal pages, SEO asset versioning |
| Functions `tsc --noEmit` with strict checking and bundler module resolution | Pass: changed Functions entrypoints and their imported modules |
| `wrangler pages functions build functions --outdir dist/functions-check` | Pass: Worker compiled successfully |
| `git diff --check` | Pass |
| Independent code review | No actionable findings |

Top-level npm runs used an explicit checkout prefix because this workspace has a sibling package with the same name. The production build emits Vite's chunk-size advisory. No deployment or commit was made. `wrangler.toml`, environment files, secrets, and license code have no changes. Generated legal HTML was verified byte-identical to HEAD.
