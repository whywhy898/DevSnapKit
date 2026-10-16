// Cloudflare Pages Function: /api/paypal-config
// Returns the PayPal Client ID and Environment Mode (sandbox/live)

interface Env {
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
}

const DEFAULT_LIVE_CLIENT_ID = 'BAARzZRspqTb44bEcI4aH5JRqSMkgSa9szEFlZHQ0-dDqoFWhfew3IOfjB-Y00Sv7ARiWYMdy13b8JywXk';

export const onRequestGet = async ({ env }: { env: Env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  const clientId = env.PAYPAL_CLIENT_ID || DEFAULT_LIVE_CLIENT_ID;
  const mode = (env.PAYPAL_MODE || 'live').toLowerCase();

  return new Response(JSON.stringify({
    clientId,
    mode,
  }), {
    status: 200,
    headers: corsHeaders,
  });
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
