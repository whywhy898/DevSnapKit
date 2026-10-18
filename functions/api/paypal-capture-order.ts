// Cloudflare Pages Function: /api/paypal-capture-order
// Captures an approved PayPal order and automatically issues a cryptographic Pro License Key

import { generateSignedKey, markTransactionVerified } from './claim-license';
import { sendOrderNotification } from './notify';
import { ConfigurationError, requireSecret } from '../lib/security';

interface Env {
  DSK_SERVER_SECRET?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
  DB?: any;
  DSK_KV?: any;
  DSK_ORDERS?: any;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL?: string;
  NOTIFICATION_WEBHOOK?: string;
}

const DEFAULT_LIVE_CLIENT_ID = 'BAARzZRspqTb44bEcI4aH5JRqSMkgSa9szEFlZHQ0-dDqoFWhfew3IOfjB-Y00Sv7ARiWYMdy13b8JywXk';
const DEFAULT_LIVE_SECRET = '';

async function getPayPalAccessToken(clientId: string, clientSecret: string, baseUrl: string): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain PayPal access token: ${response.status} - ${errorText}`);
  }

  const data: any = await response.json();
  return data.access_token;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    // Validate issuance configuration before making any request that can charge a buyer.
    const signingSecret = requireSecret(env, 'DSK_SERVER_SECRET');
    const body: any = await request.json().catch(() => ({}));
    const { orderId } = body;

    if (!orderId || typeof orderId !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'Valid PayPal orderId is required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const clientId = env.PAYPAL_CLIENT_ID || DEFAULT_LIVE_CLIENT_ID;
    const clientSecret = env.PAYPAL_CLIENT_SECRET || DEFAULT_LIVE_SECRET;
    const mode = (env.PAYPAL_MODE || 'live').toLowerCase();
    const baseUrl = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    const accessToken = await getPayPalAccessToken(clientId, clientSecret, baseUrl);

    // Capture the payment with PayPal REST API
    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId.trim())}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData: any = await captureRes.json();

    if (!captureRes.ok || captureData.status !== 'COMPLETED') {
      return new Response(JSON.stringify({
        success: false,
        error: captureData.message || captureData.details?.[0]?.description || 'PayPal capture failed or status is not COMPLETED'
      }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Capture succeeded! Extract transaction and payer info
    const captureDetails = captureData.purchase_units?.[0]?.payments?.captures?.[0];
    const txnId = captureDetails?.id || orderId.trim();
    const payerEmail = captureData.payer?.email_address || '';
    const amountVal = captureDetails?.amount?.value || '1.00';
    const currencyVal = captureDetails?.amount?.currency_code || 'USD';
    const nowIso = new Date().toISOString();

    // Mark verified in edge storage so claim-license will also recognize it
    markTransactionVerified(orderId.trim());
    if (txnId) markTransactionVerified(txnId);

    // Issue cryptographic license key
    const licenseKey = await generateSignedKey(txnId, signingSecret);

    const orderRecord = {
      orderId: orderId.trim(),
      txnId,
      payerEmail,
      amount: amountVal,
      currency: currencyVal,
      status: 'COMPLETED',
      licenseKey,
      createdAt: nowIso,
    };

    // 1. Persist to Cloudflare D1 if configured
    if (env.DB) {
      try {
        await env.DB.prepare(`
          INSERT INTO orders (order_id, txn_id, payer_email, amount, currency, status, license_key, created_at, raw_payload)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          orderId.trim(),
          txnId,
          payerEmail,
          amountVal,
          currencyVal,
          'COMPLETED',
          licenseKey,
          nowIso,
          JSON.stringify(captureData).slice(0, 4000)
        ).run();
      } catch (dbErr: any) {
        console.error('[D1 Order Save Error]', dbErr);
      }
    }

    // 2. Persist to Cloudflare KV if configured
    const kv = env.DSK_KV || env.DSK_ORDERS;
    if (kv) {
      try {
        await kv.put(`order:${txnId}`, JSON.stringify(orderRecord));
        await kv.put(`order:${orderId.trim()}`, JSON.stringify(orderRecord));

        // Append to recent orders list
        const recentRaw = await kv.get('orders_recent');
        const recentList = recentRaw ? JSON.parse(recentRaw) : [];
        recentList.unshift(orderRecord);
        await kv.put('orders_recent', JSON.stringify(recentList.slice(0, 100)));
      } catch (kvErr: any) {
        console.error('[KV Order Save Error]', kvErr);
      }
    }

    // 3. Dispatch alert to founder email (whywhy898@163.com) and webhook
    try {
      await sendOrderNotification({
        orderId: orderId.trim(),
        txnId,
        payerEmail,
        amount: amountVal,
        currency: currencyVal,
        licenseKey,
        timestamp: nowIso,
      }, env);
    } catch (notifyErr: any) {
      console.error('[Notification Dispatch Error]', notifyErr);
    }

    return new Response(JSON.stringify({
      success: true,
      status: 'COMPLETED',
      licenseKey,
      orderId: orderId.trim(),
      transactionId: txnId,
      payerEmail,
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message || 'Internal server error capturing PayPal payment' }), {
      status: err instanceof ConfigurationError ? 503 : 500,
      headers: corsHeaders,
    });
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
