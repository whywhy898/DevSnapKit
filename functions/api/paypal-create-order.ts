// Cloudflare Pages Function: /api/paypal-create-order
// Creates a PayPal checkout order using PayPal Orders v2 REST API

interface Env {
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
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
    const clientId = env.PAYPAL_CLIENT_ID || DEFAULT_LIVE_CLIENT_ID;
    const clientSecret = env.PAYPAL_CLIENT_SECRET || DEFAULT_LIVE_SECRET;
    const mode = (env.PAYPAL_MODE || 'live').toLowerCase();
    const baseUrl = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    const accessToken = await getPayPalAccessToken(clientId, clientSecret, baseUrl);

    // Create an order for $1 USD
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: 'DSK_PRO_LIFETIME',
          description: 'DevSnapKit Pro Lifetime Pass',
          amount: {
            currency_code: 'USD',
            value: '1.00',
          },
        },
      ],
      application_context: {
        brand_name: 'DevSnapKit',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    };

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderRes.ok) {
      const err = await orderRes.text();
      return new Response(JSON.stringify({ error: `PayPal order creation failed: ${err}` }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const orderData: any = await orderRes.json();
    return new Response(JSON.stringify({ id: orderData.id }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error creating PayPal order' }), {
      status: 500,
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
