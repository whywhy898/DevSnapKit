// Cloudflare Pages Function: /api/verify-license
// Authenticates a license key using HMAC-SHA256 signature verification

interface Env {
  DSK_SERVER_SECRET?: string;
}

// Rotated master signing secret (Revokes all leaked/test keys from vulnerability window)
export const SERVER_SECRET = 'DSK_MASTER_HMAC_PRO_KEY_2026_V3_REVOKED_ALL_OLD_LEAKS';

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

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body: any = await request.json().catch(() => ({}));
    const { licenseKey } = body;

    // Type validation: return 400 for non-strings or missing keys
    if (!licenseKey || typeof licenseKey !== 'string') {
      return new Response(
        JSON.stringify({ valid: false, error: 'License key is required and must be a valid string' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const clean = licenseKey.trim().toUpperCase();
    const match = clean.match(/^DSK-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
    if (!match) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Malformed key format. Expected DSK-XXXX-XXXX-XXXX' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const [, part1, part2, check] = match;
    const secret = env?.DSK_SERVER_SECRET || SERVER_SECRET;

    // Cryptographically compute expected HMAC checksum of part1 and part2
    const expectedCheck = await computeExpectedCheck(secret, part1, part2);

    if (check !== expectedCheck) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Invalid license key or cryptographic signature mismatch.' 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Key is authentic and mathematically signed by our server
    return new Response(
      JSON.stringify({
        valid: true,
        licenseKey: clean,
        tier: 'pro_lifetime',
        serverVerified: true,
        unlockedFeatures: ['4k_export', 'webp_export', 'all_gradients', 'custom_watermark', 'commercial_rights'],
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ valid: false, error: err.message || 'Server verification failed' }),
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
