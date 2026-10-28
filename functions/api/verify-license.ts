// Cloudflare Pages Function: /api/verify-license
// Authenticates a license key using HMAC-SHA256 signature verification
import { ConfigurationError, licenseCheck, requireSecret } from '../lib/security';
import { CAPABILITY_POLICY_VERSION, FREE_FEATURES, PRO_FEATURES } from '../../shared/productCapabilities';
import { verifyAdminProKey, type AdminProEnv } from '../lib/admin-pro';

interface Env extends AdminProEnv {
  DSK_SERVER_SECRET?: string;
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
    const body: any = await request.json().catch(() => ({}));
    const licenseKey = body?.licenseKey;

    // Type validation: return 400 for non-strings or missing keys
    if (typeof licenseKey !== 'string' || !licenseKey.trim() || licenseKey.length > 256) {
      return new Response(
        JSON.stringify({ valid: false, error: 'License key is required and must be a valid string' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const clean = licenseKey.trim().toUpperCase();
    const adminPro = await verifyAdminProKey(request, env, clean);
    const match = clean.match(/^DSK-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
    if (!adminPro && !match) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid license key.' }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Customer licenses retain their existing signature verification.
    const customerValid = adminPro || (match && match[3] === await licenseCheck(
      requireSecret(env, 'DSK_SERVER_SECRET'), match[1], match[2]));
    if (!customerValid) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Invalid license key or cryptographic signature mismatch.' 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // A signed customer license or a server-configured administrator credential.
    return new Response(
      JSON.stringify({
        valid: true,
        licenseKey: clean,
        tier: 'pro_lifetime',
        serverVerified: true,
        freeFeatures: FREE_FEATURES,
        proFeatures: PRO_FEATURES,
        capabilityPolicyVersion: CAPABILITY_POLICY_VERSION,
        // Legacy clients consume all available features here, including free
        // features, the old badge alias, and the existing legal entitlement.
        unlockedFeatures: [...FREE_FEATURES, ...PRO_FEATURES, 'custom_watermark', 'commercial_rights'],
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ valid: false, error: err.message || 'Server verification failed' }),
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
