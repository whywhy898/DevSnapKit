import { ConfigurationError } from '../lib/security';
import { completedOrder, fulfillOrder, PaymentError, paymentFailure, paymentResponse,
  paypalRequest, paypalToken, requirePaymentStorage, validOrderId, type PayPalEnv } from '../lib/paypal';

export const onRequestPost = async ({ request, env }: { request: Request; env: PayPalEnv }) => {
  try {
    requirePaymentStorage(env);
    if (!env.PAYPAL_WEBHOOK_ID?.trim()) throw new ConfigurationError('PayPal webhook verification is not configured.');
    const names = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time'];
    if (names.some(name => !request.headers.get(name))) return paymentResponse({ success: false, error: 'Missing PayPal signature headers.' }, 400);
    if (Number(request.headers.get('content-length') || 0) > 131072) return paymentResponse({ success: false }, 413);
    const raw = await request.text();
    if (raw.length > 131072) return paymentResponse({ success: false }, 413);
    let event: any;
    try { event = JSON.parse(raw); } catch { return paymentResponse({ success: false, error: 'Invalid JSON.' }, 400); }
    if (!event?.id || !event?.event_type || !event?.resource) return paymentResponse({ success: false }, 400);
    const session = await paypalToken(env);
    const { response, data } = await paypalRequest(session, '/v1/notifications/verify-webhook-signature', {
      method: 'POST', body: JSON.stringify({
        auth_algo: request.headers.get('paypal-auth-algo'), cert_url: request.headers.get('paypal-cert-url'),
        transmission_id: request.headers.get('paypal-transmission-id'), transmission_sig: request.headers.get('paypal-transmission-sig'),
        transmission_time: request.headers.get('paypal-transmission-time'), webhook_id: env.PAYPAL_WEBHOOK_ID.trim(), webhook_event: event,
      }),
    });
    if (!response.ok) throw new PaymentError('PayPal signature verification is temporarily unavailable.');
    if (data.verification_status !== 'SUCCESS') return paymentResponse({ success: false, error: 'Invalid PayPal signature.' }, 401);
    const approved = event.event_type === 'CHECKOUT.ORDER.APPROVED';
    if (!approved && event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') return paymentResponse({ received: true, ignored: true });
    const orderId = approved ? event.resource.id : event.resource.supplementary_data?.related_ids?.order_id;
    if (!validOrderId(orderId) || (!approved && typeof event.resource.id !== 'string')) return paymentResponse({ success: false }, 422);
    const order = await completedOrder(env, session, orderId, approved);
    if (!order) {
      if (!approved) throw new PaymentError('Completed capture is not yet available from PayPal.');
      return paymentResponse({ received: true, pending: true });
    }
    await fulfillOrder(env, order, approved ? undefined : event.resource.id);
    return paymentResponse({ received: true });
  } catch (error) { return paymentFailure(error); }
};
