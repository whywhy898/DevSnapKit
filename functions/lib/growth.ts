// Shared with legacy telemetry, feedback and verified PayPal fulfillment.
export interface GrowthEnv {
  DB?: any;
  FEEDBACK_ENABLED?: string;
  ADMIN_SECRET?: string;
  EVENTS?: { writeDataPoint(point: { indexes: string[]; blobs: string[]; doubles: number[] }): void };
}
export type GrowthEvent = 'visit' | 'editor_open' | 'export' | 'payment';
export type Attribution = { sessionId: string; path: string; utm_source: string; utm_medium: string; utm_campaign: string; ref: string };
export const eventNames = new Set<unknown>(['visit', 'editor_open', 'export', 'payment']);
export function requestEnvironment(request: Request): 'production' | 'preview' | 'dev' {
  const host = new URL(request.url).hostname.toLowerCase();
  if (host === 'devsnapkit.com' || host === 'www.devsnapkit.com') return 'production';
  if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) return 'dev';
  // Unknown hosts must never contaminate production metrics.
  return 'preview';
}
export function simulateFailure(request: Request) {
  return requestEnvironment(request) !== 'production' && new URL(request.url).searchParams.get('simulate_api_fail') === '1';
}

// Best effort, per-isolate rate limiting. IPs exist only in this bounded transient
// map, are never logged or written to D1/Analytics Engine, and expire in a minute.
const buckets = new Map<string, { count: number; until: number }>();
export function rateLimited(request: Request) {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
  const key = request.headers.get('CF-Connecting-IP') || 'local';
  const bucket = buckets.get(key);
  if (bucket) return ++bucket.count > 30;
  // Bound memory without evicting active buckets and allowing a limiter bypass.
  if (buckets.size >= 10000) return true;
  buckets.set(key, { count: 1, until: now + 60000 });
  return false;
}
export class InputError extends Error { constructor(public status = 400) { super('Invalid input'); } }
export function stringField(body: Record<string, unknown>, key: string, max: number, fallback = '') {
  const value = body[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new InputError();
  return value.trim();
}
export function attribution(body: Record<string, unknown>): Attribution {
  const path = stringField(body, 'path', 512, '/');
  if (!path.startsWith('/') || /[?#]/.test(path)) throw new InputError();
  return { sessionId: stringField(body, 'sessionId', 64), path,
    utm_source: stringField(body, 'utm_source', 120), utm_medium: stringField(body, 'utm_medium', 120),
    utm_campaign: stringField(body, 'utm_campaign', 120), ref: stringField(body, 'ref', 120) };
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('Content-Length') || 0) > 8192) throw new InputError(413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError();
  let size = 0, raw = ''; const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new InputError(413); }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError();
    return body;
  } catch (error) { throw error instanceof InputError ? error : new InputError(); }
}
export function emptyResponse(status = 204) {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function paymentEnvironment(request: Request, mode: string) {
  const environment = requestEnvironment(request);
  return mode === 'sandbox' && environment === 'production' ? 'preview' : environment;
}
export async function writeEvent(env: GrowthEnv, request: Request, event: GrowthEvent, data: Attribution, orderId?: string, environment = requestEnvironment(request)) {
  try {
    if (env.EVENTS) {
      env.EVENTS.writeDataPoint({ indexes: [environment],
        blobs: [environment, event, data.utm_source, data.utm_medium, data.utm_campaign, data.ref, data.sessionId, data.path], doubles: [1] });
      return;
    }
  } catch { /* Fall back to existing D1 when Analytics Engine is unavailable. */ }
  if (!env.DB) return;
  try {
    const { sessionId, path, ...tags } = data;
    await env.DB.prepare(`INSERT INTO events (event_type, session_id, path, metadata) VALUES (?, ?, ?, ?)`)
      .bind(event, sessionId, path, JSON.stringify({ ...tags, env: environment, ...(orderId ? { order_id: orderId } : {}) })).run();
  } catch { /* Analytics never changes product or payment success. */ }
}

export async function recordPayment(env: GrowthEnv, request: Request, orderId: string, mode: string) {
  let data = attribution({});
  try {
    const saved = await env.DB?.prepare('SELECT attribution FROM checkout_attribution WHERE order_id = ?').bind(orderId).first();
    if (saved?.attribution) data = attribution(JSON.parse(saved.attribution));
  } catch { /* Older orders have no attribution. */ }
  await writeEvent(env, request, 'payment', data, orderId, paymentEnvironment(request, mode));
}

export async function readGrowthFunnel(db: any, environment = 'production') {
  if (!db) return { available: false, env: environment, rows: [] };
  try {
    const result = await db.prepare(`SELECT COALESCE(NULLIF(json_extract(metadata, '$.utm_source'), ''), 'direct') AS utm_source,
      SUM(event_type = 'visit') AS visit, SUM(event_type = 'editor_open') AS editor_open,
      SUM(event_type = 'export') AS export, SUM(event_type = 'payment') AS payment
      FROM events WHERE json_valid(metadata) AND json_extract(metadata, '$.env') = ?
      AND created_at >= datetime('now', '-30 days')
      AND event_type IN ('visit', 'editor_open', 'export', 'payment') GROUP BY utm_source ORDER BY visit DESC`).bind(environment).all();
    return { available: true, env: environment, windowDays: 30, rows: result.results || [] };
  } catch { return { available: false, env: environment, rows: [] }; }
}
