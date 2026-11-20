// Cloudflare Pages Function: /api/claim-license
// Claims a Pro license key ONLY for verified payments confirmed by Creem
import { ConfigurationError, generateSignedKey, requireSecret } from '../lib/security';
import {
  isTestModeEnv,
  readCheckout,
  readTransactionById,
  readTransactionByOrderId,
  validatePaidTransaction,
  validatePurchase,
  type CreemEnv,
} from '../lib/creem';
export { generateSignedKey } from '../lib/security';

interface Env extends CreemEnv {
  DSK_KV?: any;
  DSK_ORDERS?: any;
}

// In-memory set of confirmed Creem transactions on this edge instance
export const confirmedTransactions = new Set<string>();
const confirmedSeeds = new Map<string, string>();

export function markTransactionVerified(txId: string, canonicalSeed?: string) {
  if (txId && typeof txId === 'string') {
    const normalized = txId.trim().toUpperCase();
    confirmedTransactions.add(normalized);
    if (canonicalSeed && typeof canonicalSeed === 'string' && canonicalSeed.trim()) {
      confirmedSeeds.set(normalized, canonicalSeed.trim().toUpperCase());
    }
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
          error: 'Creem Order ID, Checkout ID, or Transaction ID is required. Email alone cannot retrieve a license.'
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanTx = (orderId || '').trim().toUpperCase();
    let seed = cleanTx;

    // STRICT CHECK: Is this transaction verified by Creem?
    let isDbVerified = false;

    // 1. Check in Cloudflare D1 if bound
    if (env.DB) {
      try {
        const query = "SELECT txn_id, status FROM orders WHERE status = 'COMPLETED' AND (UPPER(order_id) = ? OR UPPER(txn_id) = ?)";
        const res = await env.DB.prepare(query).bind(cleanTx, cleanTx).first();
        if (res?.status === 'COMPLETED') {
          isDbVerified = true;
          seed = String(res.txn_id || cleanTx).trim().toUpperCase();
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
          if (isKvVerified && !isDbVerified) seed = String(order.txnId || cleanTx).trim().toUpperCase();
        } catch { /* Invalid records are not payment proof. */ }
      }
    }

    // 3. Check in confirmed transactions registry
    const isIpnVerified = Boolean(cleanTx && confirmedTransactions.has(cleanTx));
    if (isIpnVerified && !isDbVerified && !isKvVerified) {
      seed = confirmedSeeds.get(cleanTx) || cleanTx;
    }

    // 4. Stateless fallback in Test Mode when Preview has no D1 bound
    let isTestApiVerified = false;
    const rawId = orderId.trim();
    if (!isDbVerified && !isKvVerified && !isIpnVerified && !env.DB && isTestModeEnv(env)) {
      try {
        if (/^ch(?:k)?_[A-Za-z0-9]{6,64}$/i.test(rawId)) {
          const checkout = await readCheckout(env, rawId);
          validatePurchase(checkout, env);
          const checkoutStatus = String(checkout?.status || '').toLowerCase();
          const orderStatus = String(checkout?.order?.status || '').toLowerCase();
          if (['completed', 'paid'].includes(checkoutStatus) && orderStatus === 'paid' && typeof checkout?.order?.id === 'string') {
            isTestApiVerified = true;
            seed = checkout.order.id.trim().toUpperCase();
            markTransactionVerified(checkout.id, checkout.order.id);
            markTransactionVerified(checkout.order.id, checkout.order.id);
          }
        } else if (/^ord_[A-Za-z0-9]{6,64}$/i.test(rawId)) {
          const tx = await readTransactionByOrderId(env, rawId);
          if (tx && String(tx?.status || '').toLowerCase() === 'paid') {
            validatePaidTransaction(tx, env);
            const canonicalOrderId = typeof tx.order === 'string' ? tx.order.trim() : rawId;
            isTestApiVerified = true;
            seed = canonicalOrderId.toUpperCase();
            markTransactionVerified(canonicalOrderId, canonicalOrderId);
            if (typeof tx.id === 'string' && tx.id.trim()) {
              markTransactionVerified(tx.id.trim(), canonicalOrderId);
            }
          }
        } else if (/^tran_[A-Za-z0-9]{6,64}$/i.test(rawId)) {
          const tx = await readTransactionById(env, rawId);
          if (tx && String(tx?.status || '').toLowerCase() === 'paid') {
            validatePaidTransaction(tx, env);
            const canonicalOrderId = typeof tx.order === 'string' ? tx.order.trim() : '';
            if (canonicalOrderId) {
              isTestApiVerified = true;
              seed = canonicalOrderId.toUpperCase();
              markTransactionVerified(canonicalOrderId, canonicalOrderId);
              markTransactionVerified(rawId, canonicalOrderId);
            }
          }
        }
      } catch {
        /* Unverified or unpaid test checkout falls through to 403. */
      }
    }

    // If transaction is NOT confirmed by Creem, STRICTLY REJECT!
    if (!isDbVerified && !isKvVerified && !isIpnVerified && !isTestApiVerified) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Purchase could not be verified. Check your Creem Order ID or Checkout ID, or contact support@devsnapkit.com.'
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
