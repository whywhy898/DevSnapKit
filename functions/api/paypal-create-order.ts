import { PaymentError, paymentFailure, paymentResponse, paypalRequest, paypalToken,
  requirePaymentStorage, type PayPalEnv } from '../lib/paypal';
import { proPricing } from '../../shared/pricing';
import { attribution, InputError, readBody } from '../lib/growth';

export const onRequestPost = async ({ request, env }: { request: Request; env: PayPalEnv }) => {
  try {
    requirePaymentStorage(env);
    const context = attribution(request.body ? await readBody(request) : {});
    const session = await paypalToken(env);
    const { response, data } = await paypalRequest(session, '/v2/checkout/orders', {
      method: 'POST', headers: { 'PayPal-Request-Id': crypto.randomUUID() },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: proPricing.referenceId,
        description: proPricing.description, amount: { currency_code: proPricing.currency, value: proPricing.amount } }],
      application_context: { brand_name: 'DevSnapKit', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' } }),
    });
    if (!response.ok || !data.id) throw new PaymentError('PayPal checkout could not be started. Please retry or contact support@devsnapkit.com.');
    try {
      await env.DB.prepare('INSERT OR IGNORE INTO checkout_attribution (order_id, attribution) VALUES (?, ?)')
        .bind(data.id, JSON.stringify(context)).run();
    } catch { /* Checkout remains available before the optional migration is applied. */ }
    return paymentResponse({ id: data.id });
  } catch (error) { return error instanceof InputError ? paymentResponse({ success: false, error: 'Invalid attribution.' }, error.status) : paymentFailure(error); }
};

export const onRequestOptions = async () => paymentResponse({}, 200);
