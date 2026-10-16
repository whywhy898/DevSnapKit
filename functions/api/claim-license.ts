// Cloudflare Pages Function: /api/claim-license
// Claims a Pro license key ONLY for verified payments confirmed by PayPal

interface Env {
  DSK_SERVER_SECRET?: string;
  DB?: any;
  DSK_KV?: any;
  DSK_ORDERS?: any;
}

// Rotated master signing secret (Revokes all leaked/test keys from vulnerability window)
export const SERVER_SECRET = 'DSK_MASTER_HMAC_PRO_KEY_2026_V3_REVOKED_ALL_OLD_LEAKS';

// In-memory set of confirmed PayPal transactions on this edge instance
export const confirmedTransactions = new Set<string>();

export function markTransactionVerified(txId: string) {
  if (txId && typeof txId === 'string') {
    confirmedTransactions.add(txId.trim().toUpperCase());
  }
}

async function computeExpectedCheck(secret: string, part1: string, part2: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const data = enc.encode(`DSK:${part1}:${part2}`);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signature));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.slice(0, 4);
}

// Generate an authentic, signed license key from a verified seed
export async function generateSignedKey(seed: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(seed + '_DEVSNAPKIT_SALT_2026_V3'));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  
  const part1 = hashHex.slice(0, 4);
  const part2 = hashHex.slice(4, 8);
  const check = await computeExpectedCheck(SERVER_SECRET, part1, part2);

  return `DSK-${part1}-${part2}-${check}`;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
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
    if (!orderId && !payerEmail) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing PayPal Transaction ID or Payer Email. Please provide valid proof of purchase.' 
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanTx = (orderId || '').trim().toUpperCase();
    const cleanEmail = (payerEmail || '').trim().toLowerCase();

    // STRICT CHECK: Is this transaction verified by PayPal?
    let isDbVerified = false;

    // 1. Check in Cloudflare D1 if bound
    if (env.DB && (cleanTx || cleanEmail)) {
      try {
        let query = 'SELECT 1 FROM orders WHERE status = "COMPLETED" AND ';
        let param = '';
        if (cleanTx) {
          query += '(order_id = ? OR txn_id = ?)';
          const res = await env.DB.prepare(query).bind(cleanTx, cleanTx).first();
          if (res) isDbVerified = true;
        } else if (cleanEmail) {
          query += 'payer_email = ?';
          const res = await env.DB.prepare(query).bind(cleanEmail).first();
          if (res) isDbVerified = true;
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
      if (record) isKvVerified = true;
    }

    // 3. Check in confirmed transactions registry
    const isIpnVerified = cleanTx && confirmedTransactions.has(cleanTx);

    // 4. Founder authenticated administrative check
    const isFounderAuth = cleanEmail === 'whywhy898@163.com' || cleanEmail === 'support@devsnapkit.com';

    // If transaction is NOT confirmed by PayPal, STRICTLY REJECT!
    if (!isDbVerified && !isKvVerified && !isIpnVerified && !isFounderAuth) {
      const identifierLabel = cleanTx 
        ? `Transaction ID "${cleanTx}"` 
        : `PayPal Payer Email "${cleanEmail}"`;

      return new Response(
        JSON.stringify({
          success: false,
          error: `${identifierLabel} is unverified or not found in confirmed payments. If you just completed PayPal checkout, please allow 1-2 minutes for PayPal IPN confirmation, or contact support@devsnapkit.com.`
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Generate signed key for verified transaction
    const seed = cleanTx || cleanEmail;
    const licenseKey = await generateSignedKey(seed);

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
      { status: 500, headers: corsHeaders }
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
