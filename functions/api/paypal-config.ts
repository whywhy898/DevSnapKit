import { paymentConfig, paymentFailure, type PayPalEnv } from '../lib/paypal';

export const onRequestGet = async ({ env }: { env: PayPalEnv }) => {
  try {
    const { clientId, mode } = paymentConfig(env);
    return new Response(JSON.stringify({ clientId, mode }), { headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*',
    } });
  } catch (error) { return paymentFailure(error); }
};

export const onRequestOptions = async () => new Response(null, { status: 204, headers: {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
} });
