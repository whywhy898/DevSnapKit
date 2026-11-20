import { ConfigurationError } from '../lib/security';
import {
  fulfillOrder,
  paymentConfig,
  paymentFailure,
  paymentResponse,
  readCheckout,
  requirePaymentStorage,
  validCheckoutId,
  verifyCreemWebhookSignature,
  type CreemEnv,
} from '../lib/creem';

export const onRequestPost = async ({ request, env }: { request: Request; env: CreemEnv }) => {
  try {
    requirePaymentStorage(env);
    const webhookSecret = env.CREEM_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      throw new ConfigurationError('Creem webhook verification is not configured.');
    }
    paymentConfig(env);

    const signature = request.headers.get('creem-signature');
    if (!signature) {
      return paymentResponse({ success: false, error: 'Missing Creem signature header.' }, 400);
    }
    if (Number(request.headers.get('content-length') || 0) > 131072) {
      return paymentResponse({ success: false }, 413);
    }
    const raw = await request.text();
    if (raw.length > 131072) {
      return paymentResponse({ success: false }, 413);
    }

    if (!(await verifyCreemWebhookSignature(raw, signature, webhookSecret))) {
      return paymentResponse({ success: false, error: 'Invalid Creem signature.' }, 401);
    }

    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      return paymentResponse({ success: false, error: 'Invalid JSON.' }, 400);
    }
    if (!event?.id || !event?.eventType || !event?.object) {
      return paymentResponse({ success: false, error: 'Malformed Creem webhook event.' }, 400);
    }

    if (event.eventType !== 'checkout.completed') {
      return paymentResponse({ received: true, ignored: true });
    }

    const checkoutId = typeof event.object?.id === 'string' ? event.object.id.trim() : '';
    const orderId = typeof event.object?.order?.id === 'string' ? event.object.order.id.trim() : '';
    if (!validCheckoutId(checkoutId) || !validCheckoutId(orderId)) {
      return paymentResponse({ success: false }, 422);
    }

    const checkout = await readCheckout(env, checkoutId);
    await fulfillOrder(env, checkout, orderId);
    return paymentResponse({ received: true });
  } catch (error) {
    return paymentFailure(error);
  }
};
