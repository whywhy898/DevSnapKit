// Cloudflare Pages Function: /api/admin/stats
// Returns aggregated metrics, traffic trends, and real-time orders for the Admin Dashboard
import { requireSecret, verifyAdminToken } from '../../lib/security';
import { readSeoFunnel, type SeoFunnelData } from '../../lib/seo-funnel';
import { proPricing } from '../../../shared/pricing';

interface Env {
  ADMIN_SECRET?: string;
  DB?: any;          // Cloudflare D1
  DSK_KV?: any;      // Cloudflare KV
  DSK_ORDERS?: any;  // Legacy KV
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL?: string;
}

const STATS_CACHE_TTL_MS = 60_000;
const STATS_MIN_REFRESH_MS = 10_000;

interface StatsCacheEntry {
  cachedAt: number;
  payload: Record<string, unknown>;
}

interface DbStatsState {
  generation: number;
  entry?: StatsCacheEntry;
  inFlight?: Promise<Record<string, unknown>>;
}

const dbStatsState = new WeakMap<object, DbStatsState>();

class D1QueryError extends Error {}

function getDbCacheKey(db: unknown): object | null {
  return db && (typeof db === 'object' || typeof db === 'function') ? (db as object) : null;
}

async function computeStatsPayload(env: Env): Promise<Record<string, unknown>> {
  const todayStr = new Date().toISOString().split('T')[0];
  let storageEngine: 'D1' | 'KV' | 'Standalone (Not Connected)' = 'Standalone (Not Connected)';

  const overview = {
    todayPv: 0,
    todayUv: 0,
    todayUploads: 0,
    todayTrials: 0,
    todayExports: 0,
    todayOrders: 0,
    todayRevenue: 0,
    totalPv: 0,
    totalUv: 0,
    totalUploads: 0,
    totalTrials: 0,
    totalExports: 0,
    totalOrders: 0,
    totalRevenue: 0,
    conversionRate: '0.00%',
  };

  let dailyTrends: Array<{
    date: string;
    pv: number;
    uv: number;
    uploads: number;
    trials: number;
    exports: number;
    orders: number;
    revenue: number;
  }> = [];

  let recentOrders: Array<{
    orderId: string;
    txnId: string;
    payerEmail: string;
    amount: string;
    currency: string;
    status: string;
    licenseKey: string;
    createdAt: string;
  }> = [];

  let topCountries: Array<{ country: string; count: number }> = [];
  let topReferrers: Array<{ referrer: string; count: number }> = [];
  let recentVisits: Array<{
    id: number;
    event_type: string;
    session_id: string;
    path: string;
    referrer: string;
    country: string;
    device_type: string;
    browser: string;
    created_at: string;
  }> = [];

  let seoFunnel: SeoFunnelData = {
    available: false,
    windowDays: 30,
    rows: [
      { entry: '/screenshot-beautifier/', label: 'Screenshot beautifier', landings: 0, editorOpens: 0, uploads: 0, exports: 0, proOpens: 0, checkoutClicks: 0 },
      { entry: '/og-image-generator/', label: 'OG image generator', landings: 0, editorOpens: 0, uploads: 0, exports: 0, proOpens: 0, checkoutClicks: 0 },
      { entry: '/product-hunt-image-maker/', label: 'Product Hunt images', landings: 0, editorOpens: 0, uploads: 0, exports: 0, proOpens: 0, checkoutClicks: 0 },
      { entry: '/add-text-to-image/', label: 'Text on screenshots', landings: 0, editorOpens: 0, uploads: 0, exports: 0, proOpens: 0, checkoutClicks: 0 },
    ],
  };

  // --- 1. Query Cloudflare D1 if available ---
  if (env.DB) {
    storageEngine = 'D1';

    try {
      // Consolidated Today + All-Time event metrics (1 scan instead of 2)
      const eventStats = await env.DB.prepare(`
        SELECT
          COUNT(CASE WHEN event_type = 'page_view' THEN 1 END) as total_pv,
          COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) as total_uv,
          COUNT(CASE WHEN event_type IN ('upload_image', 'upload_logo') THEN 1 END) as total_uploads,
          COUNT(CASE WHEN event_type IN ('preset_change', 'theme_change', 'bg_type_change') THEN 1 END) as total_trials,
          COUNT(CASE WHEN event_type IN ('export_image', 'copy_image') THEN 1 END) as total_exports,
          COUNT(CASE WHEN created_at >= date('now', 'start of day') AND event_type = 'page_view' THEN 1 END) as today_pv,
          COUNT(DISTINCT CASE WHEN created_at >= date('now', 'start of day') AND event_type = 'page_view' THEN session_id END) as today_uv,
          COUNT(CASE WHEN created_at >= date('now', 'start of day') AND event_type IN ('upload_image', 'upload_logo') THEN 1 END) as today_uploads,
          COUNT(CASE WHEN created_at >= date('now', 'start of day') AND event_type IN ('preset_change', 'theme_change', 'bg_type_change') THEN 1 END) as today_trials,
          COUNT(CASE WHEN created_at >= date('now', 'start of day') AND event_type IN ('export_image', 'copy_image') THEN 1 END) as today_exports
        FROM events
      `).first();

      if (eventStats) {
        overview.todayPv = Number(eventStats.today_pv || 0);
        overview.todayUv = Number(eventStats.today_uv || 0);
        overview.todayUploads = Number(eventStats.today_uploads || 0);
        overview.todayTrials = Number(eventStats.today_trials || 0);
        overview.todayExports = Number(eventStats.today_exports || 0);
        overview.totalPv = Number(eventStats.total_pv || 0);
        overview.totalUv = Number(eventStats.total_uv || 0);
        overview.totalUploads = Number(eventStats.total_uploads || 0);
        overview.totalTrials = Number(eventStats.total_trials || 0);
        overview.totalExports = Number(eventStats.total_exports || 0);
      }

      // Consolidated Today + All-Time orders (1 scan instead of 2)
      const orderStats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_orders,
          COALESCE(SUM(CAST(amount AS REAL)), 0) as total_revenue,
          COUNT(CASE WHEN created_at >= date('now', 'start of day') THEN 1 END) as today_orders,
          COALESCE(SUM(CASE WHEN created_at >= date('now', 'start of day') THEN CAST(amount AS REAL) ELSE 0 END), 0) as today_revenue
        FROM orders
        WHERE status = 'COMPLETED'
      `).first();

      if (orderStats) {
        overview.todayOrders = Number(orderStats.today_orders || 0);
        overview.todayRevenue = Number(orderStats.today_revenue || 0);
        overview.totalOrders = Number(orderStats.total_orders || 0);
        overview.totalRevenue = Number(orderStats.total_revenue || 0);
      }

      if (overview.totalUv > 0) {
        overview.conversionRate = ((overview.totalOrders / overview.totalUv) * 100).toFixed(2) + '%';
      }

      // 14-Day Traffic & Event Trend (indexed by idx_events_created_at)
      const trendResults = await env.DB.prepare(`
        SELECT
          strftime('%Y-%m-%d', created_at) as day,
          COUNT(CASE WHEN event_type = 'page_view' THEN 1 END) as pv,
          COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) as uv,
          COUNT(CASE WHEN event_type IN ('upload_image', 'upload_logo') THEN 1 END) as uploads,
          COUNT(CASE WHEN event_type IN ('preset_change', 'theme_change', 'bg_type_change') THEN 1 END) as trials,
          COUNT(CASE WHEN event_type IN ('export_image', 'copy_image') THEN 1 END) as exports
        FROM events
        WHERE created_at >= date('now', '-14 days')
        GROUP BY day
        ORDER BY day ASC
      `).all();

      const orderTrendResults = await env.DB.prepare(`
        SELECT
          strftime('%Y-%m-%d', created_at) as day,
          COUNT(*) as orders_count,
          COALESCE(SUM(CAST(amount AS REAL)), 0) as day_revenue
        FROM orders
        WHERE status = 'COMPLETED' AND created_at >= date('now', '-14 days')
        GROUP BY day
      `).all();

      const orderTrendMap: Record<string, { orders: number; revenue: number }> = {};
      for (const row of orderTrendResults.results || []) {
        orderTrendMap[(row as any).day] = {
          orders: Number((row as any).orders_count || 0),
          revenue: Number((row as any).day_revenue || 0),
        };
      }

      dailyTrends = (trendResults.results || []).map((row: any) => ({
        date: row.day,
        pv: Number(row.pv || 0),
        uv: Number(row.uv || 0),
        uploads: Number(row.uploads || 0),
        trials: Number(row.trials || 0),
        exports: Number(row.exports || 0),
        orders: orderTrendMap[row.day]?.orders || 0,
        revenue: orderTrendMap[row.day]?.revenue || 0,
      }));

      // Top Countries (bounded to last 30 days via idx_events_created_at)
      const countryResults = await env.DB.prepare(`
        SELECT country, COUNT(*) as count
        FROM events
        WHERE created_at >= date('now', '-30 days')
          AND country IS NOT NULL AND country != 'XX' AND country != ''
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `).all();

      topCountries = (countryResults.results || []).map((row: any) => ({
        country: row.country,
        count: Number(row.count || 0),
      }));

      // Top Referrers (bounded to last 30 days via idx_events_created_at)
      const referrerResults = await env.DB.prepare(`
        SELECT referrer, COUNT(*) as count
        FROM events
        WHERE created_at >= date('now', '-30 days')
          AND referrer IS NOT NULL AND referrer != '' AND referrer != 'direct'
        GROUP BY referrer
        ORDER BY count DESC
        LIMIT 10
      `).all();

      topReferrers = (referrerResults.results || []).map((row: any) => ({
        referrer: row.referrer,
        count: Number(row.count || 0),
      }));

      // Recent 50 Orders
      const ordersRows = await env.DB.prepare(`
        SELECT order_id, txn_id, payer_email, amount, currency, status, license_key, created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 50
      `).all();

      recentOrders = (ordersRows.results || []).map((row: any) => ({
        orderId: row.order_id,
        txnId: row.txn_id || row.order_id,
        payerEmail: row.payer_email || 'anonymous',
        amount: row.amount || proPricing.amount,
        currency: row.currency || proPricing.currency,
        status: row.status || 'COMPLETED',
        licenseKey: row.license_key || 'N/A',
        createdAt: row.created_at,
      }));

      // Recent 20 Visits
      const visitsRows = await env.DB.prepare(`
        SELECT id, event_type, session_id, path, referrer, country, device_type, browser, created_at
        FROM events
        ORDER BY id DESC
        LIMIT 20
      `).all();

      recentVisits = (visitsRows.results as any) || [];
      seoFunnel = await readSeoFunnel(env.DB);
    } catch (d1Err: any) {
      console.error('[Admin D1 Query Error]', d1Err);
      throw new D1QueryError('Database query temporarily unavailable. Please retry manually later.');
    }
  }

  // --- 2. Fallback to KV if D1 not present or returned 0 orders ---
  const kv = env.DSK_KV || env.DSK_ORDERS;
  if (kv && (!env.DB || recentOrders.length === 0)) {
    if (storageEngine !== 'D1') storageEngine = 'KV';

    try {
      const rawRecent = await kv.get('orders_recent');
      if (rawRecent) {
        const list = JSON.parse(rawRecent);
        recentOrders = list;
        overview.totalOrders = list.length;
        overview.totalRevenue = list.reduce((acc: number, item: any) => acc + (parseFloat(item.amount) || 0), 0);
      }

      const rawTodayStats = await kv.get(`stats:${todayStr}`);
      if (rawTodayStats) {
        const tStats = JSON.parse(rawTodayStats);
        overview.todayPv = tStats.pv || 0;
        overview.todayUv = tStats.uv || 0;
        overview.todayExports = tStats.exports || 0;
      }
    } catch (kvErr: any) {
      console.error('[Admin KV Query Error]', kvErr);
    }
  }

  // If no daily trends data yet (e.g. fresh install today), populate today's point
  if (dailyTrends.length === 0) {
    dailyTrends = [{
      date: todayStr,
      pv: overview.todayPv,
      uv: overview.todayUv,
      uploads: overview.todayUploads,
      trials: overview.todayTrials,
      exports: overview.todayExports,
      orders: overview.todayOrders,
      revenue: overview.todayRevenue,
    }];
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    system: {
      storageEngine,
      isD1Connected: !!env.DB,
      isKvConnected: !!kv,
      isEmailConfigured: !!env.RESEND_API_KEY,
      notificationRecipient: env.NOTIFICATION_EMAIL || 'whywhy898@163.com',
    },
    overview,
    dailyTrends,
    recentOrders,
    topCountries,
    topReferrers,
    recentVisits,
    seoFunnel,
  };
}

export const onRequestGet = async ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  let secret: string;
  try { secret = requireSecret(env, 'ADMIN_SECRET'); }
  catch {
    return new Response(JSON.stringify({ success: false, error: 'Admin access is not configured.' }), { status: 503, headers: corsHeaders });
  }
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ') || !await verifyAdminToken(authorization.slice(7).trim(), secret)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    const forceRefresh = new URL(request.url).searchParams.get('refresh') === '1';
    const dbKey = getDbCacheKey(env.DB);

    if (dbKey) {
      let state = dbStatsState.get(dbKey);
      if (!state) {
        state = { generation: 0 };
        dbStatsState.set(dbKey, state);
      }

      const now = Date.now();
      if (state.entry) {
        const ageMs = now - state.entry.cachedAt;
        const canServeCached = (!forceRefresh && ageMs < STATS_CACHE_TTL_MS) ||
          (forceRefresh && ageMs < STATS_MIN_REFRESH_MS);
        if (canServeCached) {
          return new Response(JSON.stringify({
            ...state.entry.payload,
            cached: true,
            cacheAgeSeconds: Math.max(0, Math.floor(ageMs / 1000)),
          }), {
            status: 200,
            headers: corsHeaders,
          });
        }
      }

      if (state.inFlight) {
        const payload = await state.inFlight;
        return new Response(JSON.stringify({
          ...payload,
          cached: true,
          cacheAgeSeconds: 0,
        }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      const startGen = state.generation;
      const promise = computeStatsPayload(env);
      state.inFlight = promise;
      try {
        const payload = await promise;
        if (state.generation === startGen) {
          state.entry = { cachedAt: Date.now(), payload };
        }
        return new Response(JSON.stringify({
          ...payload,
          cached: false,
          cacheAgeSeconds: 0,
        }), {
          status: 200,
          headers: corsHeaders,
        });
      } finally {
        if (state.inFlight === promise) {
          state.inFlight = undefined;
        }
      }
    }

    const payload = await computeStatsPayload(env);
    return new Response(JSON.stringify({
      ...payload,
      cached: false,
      cacheAgeSeconds: 0,
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err: any) {
    if (err instanceof D1QueryError) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 503,
        headers: corsHeaders,
      });
    }
    return new Response(JSON.stringify({ success: false, error: err?.message || 'Failed to load admin statistics.' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

export const onRequestDelete = async ({ request, env }: { request: Request; env: Env }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  let secret: string;
  try { secret = requireSecret(env, 'ADMIN_SECRET'); }
  catch {
    return new Response(JSON.stringify({ success: false, error: 'Admin access is not configured.' }), { status: 503, headers: corsHeaders });
  }
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ') || !await verifyAdminToken(authorization.slice(7).trim(), secret)) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    let d1Cleared = false;
    let kvClearedCount = 0;

    // 1. Delete all events from D1 and invalidate cached stats
    if (env.DB) {
      await env.DB.prepare('DELETE FROM events').run();
      const dbKey = getDbCacheKey(env.DB);
      if (dbKey) {
        const state = dbStatsState.get(dbKey);
        if (state) {
          state.generation += 1;
          state.entry = undefined;
          state.inFlight = undefined;
        }
        dbStatsState.delete(dbKey);
      }
      d1Cleared = true;
    }

    // 2. Delete all stats keys from KV if bound
    const kv = env.DSK_KV || env.DSK_ORDERS;
    if (kv && kv.list) {
      try {
        const listRes = await kv.list({ prefix: 'stats:' });
        if (listRes?.keys) {
          for (const key of listRes.keys) {
            await kv.delete(key.name);
            kvClearedCount++;
          }
        }
      } catch (kvErr) {
        console.error('[Admin KV Clear Error]', kvErr);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'All visit and telemetry records have been cleared successfully.',
      d1Cleared,
      kvClearedCount,
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
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

