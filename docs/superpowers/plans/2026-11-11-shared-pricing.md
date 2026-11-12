# Shared Pro Pricing Implementation Plan

> **For agentic workers:** Execute this plan task-by-task in the current session. Do not commit.

**Goal:** Centralize the current $1 Pro price without changing visuals or existing license activation.

**Architecture:** A dependency-free `shared/pricing.ts` exports the current offer and stable product reference. Checkout creation uses this offer; verification compares the completed capture with the canonical PayPal order's own positive USD amount. A small modal price component preserves the existing markup and supports an absent comparison price.

**Tech Stack:** TypeScript, React, Vite, Cloudflare Pages Functions, node:test.

### Task 1: Regression coverage

- [x] Add `tests/pricing.test.mjs` covering config consumers, stray price literals, historical order amounts, invalid purchases, and comparison-price rendering.
- [x] Run the tests before implementation and confirm the intended failures.

### Task 2: Shared configuration and consumers

- [x] Create `shared/pricing.ts` with currency, amount, display price, product name/description, stable reference ID, and optional compareAtPrice.
- [x] Update creation, verification, stats, App, productCopy, and the CSS comment. Preserve classes, text, license code, and static public pages.
- [x] Extract modal price spans to `src/ProPrice.tsx` and render comparison only when populated.
- [x] Add `test:pricing`; align the existing approved-order security fixture with order-relative pricing.

### Task 3: Verification

- [x] Run security, SEO, pricing, PayPal, and product-copy tests.
- [x] Run the production build, Functions TypeScript check, and Pages Functions bundle build.
- [x] Review the final diff and list static price pages. Leave wrangler.toml, environment files, secrets, and license validation untouched.
