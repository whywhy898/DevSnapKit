# Creem Payment Setup Guide (DevSnapKit Pro)

DevSnapKit uses **Creem** (`https://api.creem.io/v1` for production, `https://test-api.creem.io/v1` for test mode) as its sole checkout and webhook payment provider, while issuing signed `DSK-XXXX-XXXX-XXXX` license keys from your own Cloudflare Pages backend and D1 database.

## 1. Create the Product in Creem Dashboard

Since you have not created a product in Creem yet, start in **Test Mode** first (toggle **Test Mode** on in the Creem Dashboard) to verify end-to-end checkout before switching to Live Mode.

1. Go to **Products -> Create Product**.
2. Configure the product:
   - **Name**: `DevSnapKit Pro`
   - **Description**: `DevSnapKit Pro Lifetime Pass`
   - **Billing Type**: **One-time payment** (not a recurring subscription)
   - **Price**: `9.90` **USD** (matches `shared/pricing.ts`)
3. Save the product and copy its **Product ID** (`prod_...`).

> **Note:** Create separate products in Test Mode (`prod_...`) and Live Mode (`prod_...`) and configure the matching `CREEM_PRODUCT_ID` for Preview vs. Production environments.

## 2. Configure the Webhook Endpoint

1. In the Creem Dashboard, go to **Developers -> Webhooks -> Add Endpoint**.
2. Set the **Endpoint URL**:
   - Production: `https://devsnapkit.com/api/creem-webhook`
   - Preview (optional): `https://<your-preview-subdomain>.devsnapkit.pages.dev/api/creem-webhook`
3. Subscribe to event:
   - `checkout.completed`
4. Save and copy the **Webhook Signing Secret** (`CREEM_WEBHOOK_SECRET`).

## 3. Generate Your API Key

1. Go to **Developers -> API Keys**.
2. Copy your **API Key** (`creem_test_...` for Test Mode, or `creem_...` for Production Live Mode).

## 4. Configure Cloudflare Pages Secrets

Run these commands inside `apps/shotcraft` (never commit real keys to `wrangler.toml` or git):

```sh
npx wrangler pages secret put CREEM_API_KEY
npx wrangler pages secret put CREEM_WEBHOOK_SECRET
npx wrangler pages secret put CREEM_PRODUCT_ID
npx wrangler pages secret put CREEM_MODE
```

Recommended values:
- **Production**:
  - `CREEM_API_KEY`: `creem_...` (Live API key)
  - `CREEM_WEBHOOK_SECRET`: Live webhook secret
  - `CREEM_PRODUCT_ID`: Live `prod_...` ID for the `$9.90 USD` one-time product
  - `CREEM_MODE`: `live`
- **Preview / Local `.dev.vars`**:
  - `CREEM_API_KEY`: `creem_test_...` (Test API key)
  - `CREEM_WEBHOOK_SECRET`: Test webhook secret
  - `CREEM_PRODUCT_ID`: Test `prod_...` ID
  - `CREEM_MODE`: `test`

Ensure existing core secrets remain configured:
- `DSK_SERVER_SECRET` (>= 32 chars, signs `DSK-XXXX-XXXX-XXXX` keys)
- `ADMIN_SECRET` (>= 32 chars, protects `/admin` and `/api/admin/stats`)
- Cloudflare D1 binding `DB` (initialized with `d1/schema.sql`)

## 5. Pre-Launch Verification Checklist

1. Run local automated tests:
   - `npm run test:security`
   - `npm run test:pricing`
   - `npm run test:creem`
   - `npm run test:seo`
   - `npm run test:license`
   - `npm run build`
2. Deploy to Cloudflare Pages (`npx wrangler pages deploy dist`).
3. Verify unsigned requests to `POST https://devsnapkit.com/api/creem-webhook` return `400` and invalid signatures return `401`.
4. Complete one test checkout in Test Mode, confirm:
   - The popup/redirect returns to `/?editor=1&creem_return=1&checkout_id=...`
   - The Pro Modal / original editor tab unlocks immediately with a `DSK-XXXX-XXXX-XXXX` key
   - D1 `orders` table records `order_id = ch_...` and `txn_id = ord_...`
   - Resend email notification (if configured) arrives
   - Claiming the license via `Claim via Order ID` works with both `ord_...` and `ch_...`.
