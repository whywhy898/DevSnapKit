// DevSnapKit License Key System & Server Verification

export interface LicenseVerificationResult {
  valid: boolean;
  reason?: string;
  tier?: string;
  token?: string;
}

/**
 * Syntax only. Entitlement is always decided by the server.
 */
export function validateKeyFormat(rawKey: string): boolean {
  if (!rawKey) return false;
  const clean = rawKey.trim().toUpperCase();
  return /^DSK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clean)
    || /^DSK-ADMIN-[A-Z0-9]{32,128}$/.test(clean);
}

/**
 * Validates a license key with the server edge API.
 */
export async function verifyLicenseWithServer(licenseKey: string): Promise<LicenseVerificationResult> {
  const cleanKey = licenseKey.trim().toUpperCase();
  if (!validateKeyFormat(cleanKey)) {
    return { valid: false, reason: 'Invalid license key format. Paste your complete license key.' };
  }

  try {
    const res = await fetch('/api/verify-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: cleanKey }),
    });

    const data = await res.json();
    if (res.ok && data?.valid === true) {
      return {
        valid: true,
        tier: data.tier || 'pro_lifetime',
      };
    } else {
      return { valid: false, reason: data?.error || 'License key is invalid or verification failed.' };
    }
  } catch (err: any) {
    return { valid: false, reason: 'Unable to reach verification server. Please check your internet connection.' };
  }
}

/**
 * Claims a Pro license key using a confirmed PayPal Order ID or Transaction ID.
 */
export async function claimLicenseViaApi(orderId: string): Promise<{ success: boolean; licenseKey?: string; error?: string }> {
  try {
    const res = await fetch('/api/claim-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, licenseKey: data.licenseKey };
    }
    return { success: false, error: data.error || 'Failed to claim license.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error claiming license.' };
  }
}
