import { PaymentError, paymentFailure, paymentResponse, paypalRequest, paypalToken,
  requirePaymentStorage, type PayPalEnv } from '../lib/paypal';

export const onRequestPost = async ({ env }: { request: Request; env: PayPalEnv }) => {
  try {
    requirePaymentStorage(env);
    const session = await paypalToken(env);
    const { response, data } = await paypalRequest(session, '/v2/checkout/orders', {
      method: 'POST', headers: { 'PayPal-Request-Id': crypto.randomUUID() },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: 'DSK_PRO_LIFETIME',
        description: 'DevSnapKit Pro Lifetime Pass', amount: { currency_code: 'USD', value: '1.00' } }],
      application_context: { brand_name: 'DevSnapKit', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' } }),
    });
    if (!response.ok || !data.id) throw new PaymentError('PayPal checkout could not be started. Please retry or contact support@devsnapkit.com.');
    return paymentResponse({ id: data.id });
  } catch (error) { return paymentFailure(error); }
};

export const onRequestOptions = async () => paymentResponse({}, 200);
