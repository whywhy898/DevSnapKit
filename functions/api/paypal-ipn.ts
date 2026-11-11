// Cloudflare Pages Function: /api/paypal-ipn
// Handles incoming PayPal Instant Payment Notification (IPN) webhooks

import { markTransactionVerified } from './claim-license';
import { completedOrder, fulfillOrder, PaymentError, paymentFailure, paypalRequest, paypalToken,
  requirePaymentStorage, validOrderId, type PayPalEnv } from '../lib/paypal';

interface Env extends PayPalEnv {
  DSK_ORDERS?: any;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
    requirePaymentStorage(env);
    const rawBody = await request.text();
    const params = new URLSearchParams(rawBody);

    // Prepare validation payload for PayPal
    const verifyPayload = 'cmd=_notify-validate&' + rawBody;

    // Post back to PayPal to validate authenticity
    const paypalVerifyRes = await fetch('https://ipnpb.paypal.com/cgi-bin/webscr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DevSnapKit-IPN-Verifier/1.0',
      },
      body: verifyPayload,
    });

    const verifyStatus = await paypalVerifyRes.text();
    if (!paypalVerifyRes.ok) throw new PaymentError('PayPal IPN verification is temporarily unavailable.');

    if (verifyStatus.trim() === 'VERIFIED') {
      const paymentStatus = params.get('payment_status');
      const txnId = params.get('txn_id');
      const mcGross = params.get('mc_gross');
      const payerEmail = params.get('payer_email');
      const receiverEmail = params.get('receiver_email') || params.get('business');

      console.log(`[PayPal IPN VERIFIED] Tx: ${txnId}, Email: ${payerEmail}, Status: ${paymentStatus}, Gross: ${mcGross}, Receiver: ${receiverEmail}`);

      if (txnId && paymentStatus === 'Completed') {
        if (!validOrderId(txnId)) throw new PaymentError('Invalid PayPal capture ID.', 422);
        const session = await paypalToken(env);
        const { response, data } = await paypalRequest(session, `/v2/payments/captures/${encodeURIComponent(txnId)}`);
        if (!response.ok) throw new PaymentError('Could not verify the PayPal capture.');
        const orderId = data.supplementary_data?.related_ids?.order_id;
        if (data.id !== txnId || !validOrderId(orderId)) {
          throw new PaymentError('PayPal capture does not match this purchase.', 422);
        }
        const order = await completedOrder(env, session, orderId, false);
        if (!order) throw new PaymentError('Completed payment is not yet available from PayPal.');
        // IPN authenticity alone is not proof of the product, accepted price, or matching capture.
        const record = await fulfillOrder(env, order, txnId);
        markTransactionVerified(txnId);

        if (env.DSK_ORDERS) {
          await env.DSK_ORDERS.put(`order:${txnId}`, JSON.stringify({
            txnId,
            payerEmail: record.payerEmail,
            mcGross: record.amount,
            paymentStatus,
            verifiedAt: new Date().toISOString(),
          }));
        }
      }

      return new Response('OK', { status: 200 });
    } else {
      console.warn(`[PayPal IPN INVALID] Response: ${verifyStatus}`);
      return new Response('INVALID', { status: 400 });
    }
  } catch (err: any) {
    console.error('[PayPal IPN Error]', err);
    return paymentFailure(err);
  }
};
