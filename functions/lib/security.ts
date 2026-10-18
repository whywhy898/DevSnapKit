interface SecurityEnv {
  DSK_SERVER_SECRET?: string;
  ADMIN_SECRET?: string;
}

export class ConfigurationError extends Error {}

export function requireSecret(env: SecurityEnv, name: keyof SecurityEnv): string {
  const value = env[name]?.trim();
  if (!value || value.length < 32) {
    throw new ConfigurationError(`${name} must be configured with at least 32 characters on the server.`);
  }
  return value;
}

async function hmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function equalSignature(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export async function licenseCheck(secret: string, part1: string, part2: string): Promise<string> {
  return (await hmac(secret, `DSK:${part1}:${part2}`)).slice(0, 4);
}

export async function generateSignedKey(seed: string, secret: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed + '_DEVSNAPKIT_SALT_2026_V3'));
  const hex = Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  const part1 = hex.slice(0, 4), part2 = hex.slice(4, 8);
  return `DSK-${part1}-${part2}-${await licenseCheck(secret, part1, part2)}`;
}

export const ADMIN_SESSION_SECONDS = 7 * 86400;

export async function createAdminToken(secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ sub: 'admin', iat: now, exp: now + ADMIN_SESSION_SECONDS }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${payload}.${await hmac(secret, `admin-session:${payload}`)}`;
}

export async function verifyAdminToken(token: string, secret: string): Promise<boolean> {
  if (token.length > 1024) return false;
  const match = token.match(/^([A-Za-z0-9_-]+)\.([A-F0-9]{64})$/);
  if (!match) return false;
  const [, payload, signature] = match;
  if (!equalSignature(signature, await hmac(secret, `admin-session:${payload}`))) return false;
  try {
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payload.length % 4) % 4)));
    const now = Math.floor(Date.now() / 1000);
    return decoded.sub === 'admin' && Number.isInteger(decoded.iat) && Number.isInteger(decoded.exp)
      && decoded.iat <= now && decoded.exp > now && decoded.exp - decoded.iat === ADMIN_SESSION_SECONDS;
  } catch { return false; }
}
