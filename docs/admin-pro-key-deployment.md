# Administrator Pro key configuration

The editor uses the existing Key dialog and `/api/verify-license`. Only server configuration grants the administrator entitlement. The retired public preview key is no longer a special credential.

## Cloudflare Pages configuration

In the `devsnapkit` Pages project, configure these for the environment being deployed:

| Name | Type | Value |
| --- | --- | --- |
| `DSK_ADMIN_PRO_KEY` | Encrypted Secret | A newly generated administrator key; never a `VITE_` variable |
| `DSK_ADMIN_PRO_ORIGINS` | Server environment variable | Comma-separated exact HTTPS origins, without trailing slashes, paths or wildcards |
| `DSK_SERVER_SECRET` | Existing encrypted Secret | Keep the current customer signing secret unchanged |

Production example origins: `https://devsnapkit.com,https://www.devsnapkit.com`. Include only domains where activation is intended. Preview example: `https://mockup-templates-v1.devsnapkit.pages.dev`. Configure Preview and Production independently, preferably with different keys. A new preview branch needs its own exact origin in the Preview setting. Adding a Secret requires a new deployment to take effect.

Generate the key locally using a cryptographically secure random source. An example JavaScript expression is `'DSK-ADMIN-' + randomBytes(32).toString('hex').toUpperCase()` with `randomBytes` from `node:crypto`. The accepted syntax is `DSK-ADMIN-` plus 32–128 alphanumeric characters. Do not reuse the previously shared test key or put a real key in Git, scripts, URLs or build variables.

For local Pages testing, put these bindings in the ignored `.dev.vars` file; production does not read that file. The administrator origin policy requires HTTPS, including in local tests. Ordinary `vite preview` does not run Pages Functions.

After configuration, deploy the branch to Preview, then activate through the editor's Key dialog. Verify reload preserves Pro through another backend request; a wrong key is denied; a different preview origin is denied. Rotate/remove the Secret and redeploy, then reload to verify the old key no longer activates. Existing sessions are rechecked on page load, not continuously revoked in an already open tab.

## Verification performed locally

Run `node --test tests/preview-admin-license.test.mjs tests/security.test.mjs tests/paypal-webhook.test.mjs tests/paypal-recovery.test.mjs`, `npm run build`, then `node --test tests/admin-pro-browser.test.mjs`.

The browser test uses the built editor and real verification handler in a local HTTP adapter with a simulated canonical HTTPS URL. This verifies the application flow, not the remote Cloudflare Secret settings. Live Preview verification remains a deployment step.

The product renders/exports in the browser. This change removes shipped administrator credentials and makes the normal activation flow server-verified; it does not make a user's local JavaScript runtime tamper-proof. The stored license key remains readable to that browser, as with existing customer keys.

Reference: https://developers.cloudflare.com/pages/functions/bindings/#secrets
