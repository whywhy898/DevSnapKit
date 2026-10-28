// Server-only administrator activation. Never import this module from src/.
export interface AdminProEnv {
  DSK_ADMIN_PRO_KEY?: string;
  DSK_ADMIN_PRO_ORIGINS?: string;
}

const ADMIN_KEY_FORMAT = /^DSK-ADMIN-[A-Z0-9]{32,128}$/;

export async function verifyAdminProKey(request: Request, env: AdminProEnv, candidate: string): Promise<boolean> {
  const configured = env.DSK_ADMIN_PRO_KEY?.trim().toUpperCase();
  if (!configured || !ADMIN_KEY_FORMAT.test(configured) || !ADMIN_KEY_FORMAT.test(candidate)) return false;

  // Trust the actual destination URL, never Origin or forwarded-host headers.
  const destination = new URL(request.url);
  if (destination.protocol !== 'https:') return false;
  const origins = (env.DSK_ADMIN_PRO_ORIGINS || '').split(',').map(value => value.trim());
  if (!origins.includes(destination.origin)) return false;

  // Compare fixed-size digests without exposing early character mismatches.
  const encoder = new TextEncoder();
  const [expected, actual] = await Promise.all([configured, candidate].map(value =>
    crypto.subtle.digest('SHA-256', encoder.encode(value))));
  const a = new Uint8Array(expected), b = new Uint8Array(actual);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
