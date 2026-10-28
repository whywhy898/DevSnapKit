// Cloudflare Pages Function: /api/verify-license
// Authenticates a license key using HMAC-SHA256 signature verification
import { ConfigurationError, licenseCheck, requireSecret } from '../lib/security';
import { CAPABILITY_POLICY_VERSION, FREE_FEATURES, PRO_FEATURES } from '../../shared/productCapabilities';

interface Env {
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
    const { licenseKey } = body;

    // Type validation: return 400 for non-strings or missing keys
    if (!licenseKey || typeof licenseKey !== 'string') {
      return new Response(
        JSON.stringify({ valid: false, error: 'License key is required and must be a valid string' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const clean = licenseKey.trim().toUpperCase();
    // Ported from preview-admin/00b9dce. This public test credential is valid
    // only on the selected preview origin; clients must still call this API.
    const previewAdmin = clean === 'DSK-BOSS-2026-PRO1'
      && new URL(request.url).origin === 'https://mockup-templates-v1.devsnapkit.pages.dev';
    const secret = previewAdmin ? null : requireSecret(env, 'DSK_SERVER_SECRET');
    const match = clean.match(/^DSK-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{4})$/);
    if (!match) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Malformed key format. Expected DSK-XXXX-XXXX-XXXX' }),
        { status: 200, headers: corsHeaders }
      );
    }

    const [, part1, part2, check] = match;

    // Cryptographically compute expected HMAC checksum of part1 and part2
    const expectedCheck = previewAdmin ? null : await licenseCheck(secret!, part1, part2);

    if (!previewAdmin && check !== expectedCheck) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Invalid license key or cryptographic signature mismatch.' 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // A signed customer key or the explicitly scoped preview credential.
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
