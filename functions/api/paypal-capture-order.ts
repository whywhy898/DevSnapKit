import { completedOrder, fulfillOrder, paymentFailure, paymentResponse,
  paypalToken, requirePaymentStorage, validOrderId, type PayPalEnv } from '../lib/paypal';

export const onRequestPost = async ({ request, env }: { request: Request; env: PayPalEnv }) => {
  try {
    requirePaymentStorage(env);
    const body: any = await request.json().catch(() => ({}));
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    if (!validOrderId(orderId)) return paymentResponse({ success: false, error: 'Valid PayPal orderId is required.' }, 400);
    const session = await paypalToken(env);
    const order = await completedOrder(env, session, orderId, true);
    if (!order) return paymentResponse({ success: false, pending: true, error: 'PayPal is still processing this payment. No key is issued until it completes.' }, 202);
    const record = await fulfillOrder(env, order);
    return paymentResponse({ success: true, status: 'COMPLETED', licenseKey: record.licenseKey,
      orderId: record.orderId, transactionId: record.txnId });
  } catch (error) { return paymentFailure(error); }
};

export const onRequestOptions = async () => paymentResponse({}, 200);
