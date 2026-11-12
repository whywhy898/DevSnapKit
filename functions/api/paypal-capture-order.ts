import { completedOrder, fulfillOrder, paymentFailure, paymentResponse,
  paypalToken, requirePaymentStorage, validOrderId, type PayPalEnv } from '../lib/paypal';

export const onRequestPost = async ({ request, env }: { request: Request; env: PayPalEnv }) => {
  try {
    requirePaymentStorage(env);
    const body: any = await request.json().catch(() => ({}));
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    if (!validOrderId(orderId)) return paymentResponse({ success: false, error: 'Valid PayPal orderId is required.' }, 400);
    const session = await paypalToken(env);
    const order = await completedOrder(env, session, orderId, true, true);
    const captures = order?.purchase_units?.[0]?.payments?.captures;
    if (!order || order.status !== 'COMPLETED' || captures?.some((capture: any) => capture.status === 'PENDING')) {
      const unpaid = ['CREATED', 'SAVED', 'PAYER_ACTION_REQUIRED', 'VOIDED'].includes(order?.status)
        && !captures?.some((capture: any) => ['PENDING', 'COMPLETED'].includes(capture.status));
      return paymentResponse({ success: false, unpaid, pending: !unpaid,
        error: unpaid ? 'This order has not been paid.' : 'PayPal is still processing this payment. No key is issued until it completes.' }, 202);
    }
    const record = await fulfillOrder(env, order);
    return paymentResponse({ success: true, status: 'COMPLETED', licenseKey: record.licenseKey,
      orderId: record.orderId, transactionId: record.txnId });
  } catch (error) { return paymentFailure(error); }
};

export const onRequestOptions = async () => paymentResponse({}, 200);
