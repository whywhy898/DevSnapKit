// Cloudflare Pages Function: /api/admin/auth
// Authenticates admin dashboard access using a secure secret key
import { ADMIN_SESSION_SECONDS, ConfigurationError, createAdminToken, requireSecret } from '../../lib/security';

interface Env {
  ADMIN_SECRET?: string;
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  try {
    const expectedSecret = requireSecret(env, 'ADMIN_SECRET');
    const body: any = await request.json().catch(() => ({}));
    const { secret } = body;

    if (!secret || typeof secret !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'Secret key required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (secret.trim() !== expectedSecret.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid admin secret key' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = await createAdminToken(expectedSecret);

    return new Response(JSON.stringify({
      success: true,
      token,
      expiresIn: ADMIN_SESSION_SECONDS,
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
