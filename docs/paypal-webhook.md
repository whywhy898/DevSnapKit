# PayPal payment recovery

This fixes missing production PayPal credentials and adds a verified, durable recovery path for the existing $1 USD lifetime purchase. It does not change pricing or the license format.

- Store the existing matching Live Client ID and Secret as production secrets. Never bundle the Secret in the browser.
- Receive `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED` at `/api/paypal-webhook`. Verify PayPal's transmission signature using the configured webhook ID before processing any event.
- Fetch the canonical order with the merchant's server credentials. Require one DevSnapKit purchase unit, 1 USD, matching payee and a completed matching capture before issuance. An approved event may recover a lost browser callback using an idempotent capture request.
- Browser capture and Webhook share validation and fulfillment. D1's unique order ID arbitrates concurrent delivery. Persist the signed key before reporting success; failures return retryable errors. Replays reuse the same key and do not duplicate orders or notifications.
- Remember an unfinished order locally. Poll the existing receipt claim endpoint so a returning buyer can recover the key after the webhook completes. Display checkout errors instead of hiding them in the console.
- Test invalid signatures, missing configuration, wrong amount/currency/product/payee, pending payments, duplicate and concurrent delivery, already captured orders, persistence failures and browser recovery. No real purchases are needed for automated verification.
- Deploy only after tests pass; register the Live endpoint with PayPal and configure its ID as a production secret. Verify the active deployment, unsigned-request rejection and the matching Live application. A real completed buyer transaction remains the final end-to-end confirmation.
