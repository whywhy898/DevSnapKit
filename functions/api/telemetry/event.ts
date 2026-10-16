// Cloudflare Pages Function: /api/telemetry/event
// Ingests anonymous client-side telemetry events (page views, exports, clicks) into D1 and KV

interface Env {
  DB?: any;          // Cloudflare D1 database binding
  DSK_KV?: any;      // Cloudflare KV binding
  DSK_ORDERS?: any;  // Legacy KV binding
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
    const { event, sessionId, path, referrer, device, browser, metadata } = body;

    if (!event || typeof event !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Event type required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const cfCountry = request.headers.get('cf-ipcountry') || 'XX';
    const userAgent = request.headers.get('user-agent') || '';
    const cleanSession = (sessionId || 'anon_' + Math.random().toString(36).substring(2, 10)).slice(0, 64);
    const cleanPath = (path || '/').slice(0, 128);
    const cleanReferrer = (referrer || '').slice(0, 256);
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
          (browser || '').slice(0, 64),
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
