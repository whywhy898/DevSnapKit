// Cloudflare Pages Function: /api/admin/auth
// Authenticates admin dashboard access using a secure secret key

interface Env {
  ADMIN_SECRET?: string;
}

const DEFAULT_ADMIN_SECRET = 'devsnapkit_admin_2026';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  try {
    const body: any = await request.json().catch(() => ({}));
    const { secret } = body;

    const expectedSecret = env.ADMIN_SECRET || DEFAULT_ADMIN_SECRET;

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

    // Success! Generate simple session token
    const token = btoa(`${expectedSecret}:${Date.now()}`);

    return new Response(JSON.stringify({
      success: true,
      token,
      expiresIn: 86400 * 7,
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
