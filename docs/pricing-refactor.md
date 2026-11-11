# Shared Pro pricing

The single offer config is `shared/pricing.ts`: `currency: 'USD'`, `amount: '1.00'`, `displayPrice: '$1'`, product name/description, stable `referenceId: 'DSK_PRO_LIFETIME'`, and optional `compareAtPrice: '$29'`. The current text, price spans, classes, and appearance are preserved. Removing or emptying `compareAtPrice` hides the strikethrough span.

Payment verification reads canonical PayPal order details through the existing authenticated order lookup. It checks the stable product reference and positive USD order amount, then compares the completed capture against that order's own amount using exact integer cents. It never compares payment amounts with today's configured offer. This permits in-flight and historical purchases at a different price. Existing order/capture status, single-unit/single-capture, capture ID, final-capture, merchant, persistence, and license checks remain in place. License format, signing, validation, and activation code are unchanged.

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
