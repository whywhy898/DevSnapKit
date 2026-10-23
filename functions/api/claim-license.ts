// Cloudflare Pages Function: /api/claim-license
// Claims a Pro license key ONLY for verified payments confirmed by PayPal
import { ConfigurationError, generateSignedKey, requireSecret } from '../lib/security';
export { generateSignedKey } from '../lib/security';

interface Env {
  DSK_SERVER_SECRET?: string;
  DB?: any;
  DSK_KV?: any;
  DSK_ORDERS?: any;
}

// In-memory set of confirmed PayPal transactions on this edge instance
export const confirmedTransactions = new Set<string>();

export function markTransactionVerified(txId: string) {
  if (txId && typeof txId === 'string') {
    confirmedTransactions.add(txId.trim().toUpperCase());
  }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  try {
    const secret = requireSecret(env, 'DSK_SERVER_SECRET');
    const body: any = await request.json().catch(() => ({}));
    const { orderId, payerEmail } = body;

    // Type checking: ensure string inputs
    if (orderId && typeof orderId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'orderId must be a valid string' }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (payerEmail && typeof payerEmail !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'payerEmail must be a valid string' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Reject empty requests
    if (typeof orderId !== 'string' || !orderId.trim()) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PayPal Order ID or Transaction ID is required. Email alone cannot retrieve a license.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanTx = (orderId || '').trim().toUpperCase();
    let seed = cleanTx;

    // STRICT CHECK: Is this transaction verified by PayPal?
    let isDbVerified = false;

    // 1. Check in Cloudflare D1 if bound
    if (env.DB) {
      try {
        const query = "SELECT txn_id, status FROM orders WHERE status = 'COMPLETED' AND (order_id = ? OR txn_id = ?)";
        const res = await env.DB.prepare(query).bind(cleanTx, cleanTx).first();
        if (res?.status === 'COMPLETED') {
          isDbVerified = true;
          seed = res.txn_id || cleanTx;
        }
      } catch (dbErr) {
        console.error('[D1 License Check Error]', dbErr);
      }
    }

    // 2. Check in KV if bound
    let isKvVerified = false;
    const kv = env.DSK_KV || env.DSK_ORDERS;
    if (kv && cleanTx) {
      const record = await kv.get(`order:${cleanTx}`);
      if (record) {
        try {
          const order = JSON.parse(record);
          isKvVerified = order?.status === 'COMPLETED' || order?.paymentStatus === 'Completed';
          if (isKvVerified && !isDbVerified) seed = order.txnId || cleanTx;
        } catch { /* Invalid records are not payment proof. */ }
      }
    }

    // 3. Check in confirmed transactions registry
    const isIpnVerified = cleanTx && confirmedTransactions.has(cleanTx);

    // If transaction is NOT confirmed by PayPal, STRICTLY REJECT!
    if (!isDbVerified && !isKvVerified && !isIpnVerified) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Purchase could not be verified. Check your PayPal Order ID or Transaction ID, or contact support@devsnapkit.com.'
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Generate signed key for verified transaction
    const licenseKey = await generateSignedKey(seed, secret);

    return new Response(
      JSON.stringify({
        success: true,
        licenseKey,
        claimedAt: new Date().toISOString(),
        tier: 'pro_lifetime'
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal server error' }),
      { status: err instanceof ConfigurationError ? 503 : 500, headers: corsHeaders }
    );
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
