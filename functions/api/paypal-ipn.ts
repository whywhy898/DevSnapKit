// Cloudflare Pages Function: /api/paypal-ipn
// Handles incoming PayPal Instant Payment Notification (IPN) webhooks

import { markTransactionVerified } from './claim-license';

interface Env {
  DSK_SERVER_SECRET?: string;
  DSK_ORDERS?: any;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  try {
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

    if (verifyStatus.trim() === 'VERIFIED') {
      const paymentStatus = params.get('payment_status');
      const txnId = params.get('txn_id');
      const mcGross = params.get('mc_gross');
      const payerEmail = params.get('payer_email');
      const receiverEmail = params.get('receiver_email') || params.get('business');

      console.log(`[PayPal IPN VERIFIED] Tx: ${txnId}, Email: ${payerEmail}, Status: ${paymentStatus}, Gross: ${mcGross}, Receiver: ${receiverEmail}`);

      if (txnId && paymentStatus === 'Completed') {
        markTransactionVerified(txnId);

        if (env.DSK_ORDERS) {
          await env.DSK_ORDERS.put(`order:${txnId}`, JSON.stringify({
            txnId,
            payerEmail,
            mcGross,
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
    return new Response('Error processing IPN', { status: 500 });
  }
};
