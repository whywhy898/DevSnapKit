// Cloudflare Pages Function: /api/telemetry/event
// Ingests anonymous client-side telemetry events (page views, exports, clicks) into D1 and KV

interface Env {
  DB?: any;                    // Cloudflare D1 database binding
  DSK_KV?: any;                // Cloudflare KV binding
  DSK_ORDERS?: any;            // Legacy KV binding
  ALLOW_PREVIEW_TELEMETRY?: string;
}

const MAX_BODY_BYTES = 4096;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_WRITES = 60;
const RATE_LIMIT_MAX_BUCKETS = 5_000;

const ALLOWED_EVENTS = new Set([
  'page_view',
  'seo_landing_view',
  'seo_editor_open',
  'upload_image',
  'upload_logo',
  'media_slot_add',
  'media_slot_replace',
  'preset_change',
  'theme_change',
  'bg_type_change',
  'export_image',
  'copy_image',
  'pro_modal_open',
  'checkout_click',
]);

const ipBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(request: Request): boolean {
  const now = Date.now();
  for (const [key, bucket] of ipBuckets) {
    if (bucket.resetAt <= now) ipBuckets.delete(key);
  }
  const ip = request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
  const existing = ipBuckets.get(ip);
  if (existing) {
    existing.count += 1;
    return existing.count > RATE_LIMIT_MAX_WRITES;
  }
  if (ipBuckets.size >= RATE_LIMIT_MAX_BUCKETS) {
    return true;
  }
  ipBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  return false;
}

function isProductionTelemetryHost(request: Request, env: Env): boolean {
  if (env.ALLOW_PREVIEW_TELEMETRY === 'true') return true;
  try {
    const host = new URL(request.url).hostname.toLowerCase();
    return host === 'devsnapkit.com' || host === 'www.devsnapkit.com';
  } catch {
    return false;
  }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ ok: false, error: 'Payload too large' }), {
        status: 413,
        headers: corsHeaders,
      });
    }

    let rawText = '';
    if (request.body) {
      const reader = request.body.getReader();
      const decoder = new TextDecoder();
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_BODY_BYTES) {
          await reader.cancel().catch(() => {});
          return new Response(JSON.stringify({ ok: false, error: 'Payload too large' }), {
            status: 413,
            headers: corsHeaders,
          });
        }
        rawText += decoder.decode(value, { stream: true });
      }
      rawText += decoder.decode();
    }

    let body: any = {};
    try {
      body = rawText ? JSON.parse(rawText) : {};
    } catch {
      body = {};
    }
    const { event, sessionId, path, referrer, device, browser, metadata } = body || {};

    if (!event || typeof event !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Event type required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!ALLOWED_EVENTS.has(event)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'untracked_event' }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (!isProductionTelemetryHost(request, env)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'non_production_host' }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (isRateLimited(request)) {
      return new Response(JSON.stringify({ ok: false, error: 'Rate limit exceeded' }), {
        status: 429,
        headers: corsHeaders,
      });
    }

    const cfCountry = request.headers.get('cf-ipcountry') || 'XX';
    const cleanSession = (typeof sessionId === 'string' && sessionId ? sessionId : 'anon_' + Math.random().toString(36).substring(2, 10)).slice(0, 64);
    const cleanPath = (typeof path === 'string' && path ? path : '/').slice(0, 128);
    const cleanReferrer = (typeof referrer === 'string' ? referrer : '').slice(0, 256);
    const cleanDevice = device === 'mobile' ? 'mobile' : device === 'tablet' ? 'tablet' : 'desktop';
    const metaJson = metadata ? JSON.stringify(metadata).slice(0, 1024) : null;
    const today = new Date().toISOString().split('T')[0];

    // 1. Insert into Cloudflare D1 if bound
    if (env.DB) {
      try {
        await env.DB.prepare(`
          INSERT INTO events (event_type, session_id, path, referrer, country, device_type, browser, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          event,
          cleanSession,
          cleanPath,
          cleanReferrer,
          cfCountry,
          cleanDevice,
          (typeof browser === 'string' ? browser : '').slice(0, 64),
          metaJson
        ).run();
      } catch (dbErr: any) {
        console.error('[D1 Ingest Error]', dbErr);
      }
    }

    // 2. Also record in KV for fast counters
    const kv = env.DSK_KV || env.DSK_ORDERS;
    if (kv) {
      try {
        const statsKey = `stats:${today}`;
        const existingRaw = await kv.get(statsKey);
        const stats = existingRaw ? JSON.parse(existingRaw) : { pv: 0, uv: 0, exports: 0, pro_modal: 0, sessions: {} };

        if (event === 'page_view') {
          stats.pv = (stats.pv || 0) + 1;
          if (!stats.sessions) stats.sessions = {};
          if (!stats.sessions[cleanSession]) {
            stats.sessions[cleanSession] = 1;
            stats.uv = Object.keys(stats.sessions).length;
          }
        } else if (event === 'export_image' || event === 'copy_image') {
          stats.exports = (stats.exports || 0) + 1;
        } else if (event === 'pro_modal_open') {
          stats.pro_modal = (stats.pro_modal || 0) + 1;
        }

        // Limit stored sessions in KV to 1000 per day to conserve size
        if (stats.sessions && Object.keys(stats.sessions).length > 1000) {
          stats.sessions = {};
        }

        await kv.put(statsKey, JSON.stringify(stats), { expirationTtl: 86400 * 90 }); // keep 90 days
      } catch (kvErr: any) {
        console.error('[KV Ingest Error]', kvErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, country: cfCountry }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
