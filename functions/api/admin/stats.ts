// Cloudflare Pages Function: /api/admin/stats
// Returns aggregated metrics, traffic trends, and real-time orders for the Admin Dashboard
import { requireSecret, verifyAdminToken } from '../../lib/security';

interface Env {
  ADMIN_SECRET?: string;
  DB?: any;          // Cloudflare D1
  DSK_KV?: any;      // Cloudflare KV
  DSK_ORDERS?: any;  // Legacy KV
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL?: string;
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
    const todayStr = new Date().toISOString().split('T')[0];
    let storageEngine: 'D1' | 'KV' | 'Standalone (Not Connected)' = 'Standalone (Not Connected)';

    let overview = {
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

    // --- 1. Query Cloudflare D1 if available ---
    if (env.DB) {
      storageEngine = 'D1';

      try {
        // Today metrics
        const todayStats = await env.DB.prepare(`
          SELECT 
            COUNT(CASE WHEN event_type = 'page_view' THEN 1 END) as pv,
            COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) as uv,
            COUNT(CASE WHEN event_type IN ('upload_image', 'upload_logo') THEN 1 END) as uploads,
            COUNT(CASE WHEN event_type IN ('preset_change', 'theme_change', 'bg_type_change') THEN 1 END) as trials,
            COUNT(CASE WHEN event_type IN ('export_image', 'copy_image') THEN 1 END) as exports
          FROM events
          WHERE created_at >= date('now', 'start of day')
        `).first();

        if (todayStats) {
          overview.todayPv = Number(todayStats.pv || 0);
          overview.todayUv = Number(todayStats.uv || 0);
          overview.todayUploads = Number(todayStats.uploads || 0);
          overview.todayTrials = Number(todayStats.trials || 0);
          overview.todayExports = Number(todayStats.exports || 0);
        }

        // Today Orders
        const todayOrderStats = await env.DB.prepare(`
          SELECT 
            COUNT(*) as count,
            COALESCE(SUM(CAST(amount AS REAL)), 0) as revenue
          FROM orders
          WHERE status = 'COMPLETED' AND created_at >= date('now', 'start of day')
        `).first();

        if (todayOrderStats) {
          overview.todayOrders = Number(todayOrderStats.count || 0);
          overview.todayRevenue = Number(todayOrderStats.revenue || 0);
        }

        // All-Time Totals
        // UV must use the same definition as the today/trend blocks (distinct sessions that
        // sent a page_view). Counting every session_id made total UV exceed total PV whenever a
        // non-page_view event arrived without its page_view row.
        const totalStats = await env.DB.prepare(`
          SELECT 
            COUNT(CASE WHEN event_type = 'page_view' THEN 1 END) as total_pv,
            COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN session_id END) as total_uv,
            COUNT(CASE WHEN event_type IN ('upload_image', 'upload_logo') THEN 1 END) as total_uploads,
            COUNT(CASE WHEN event_type IN ('preset_change', 'theme_change', 'bg_type_change') THEN 1 END) as total_trials,
            COUNT(CASE WHEN event_type IN ('export_image', 'copy_image') THEN 1 END) as total_exports
          FROM events
        `).first();

        if (totalStats) {
          overview.totalPv = Number(totalStats.total_pv || 0);
          overview.totalUv = Number(totalStats.total_uv || 0);
          overview.totalUploads = Number(totalStats.total_uploads || 0);
          overview.totalTrials = Number(totalStats.total_trials || 0);
          overview.totalExports = Number(totalStats.total_exports || 0);
        }

        // All-Time Orders
        const totalOrderStats = await env.DB.prepare(`
          SELECT 
            COUNT(*) as count,
            COALESCE(SUM(CAST(amount AS REAL)), 0) as revenue
          FROM orders
          WHERE status = 'COMPLETED'
        `).first();

        if (totalOrderStats) {
          overview.totalOrders = Number(totalOrderStats.count || 0);
          overview.totalRevenue = Number(totalOrderStats.revenue || 0);
        }

        if (overview.totalUv > 0) {
          overview.conversionRate = ((overview.totalOrders / overview.totalUv) * 100).toFixed(2) + '%';
        }

        // 14-Day Traffic & Event Trend
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

        // Top Countries
        const countryResults = await env.DB.prepare(`
          SELECT country, COUNT(*) as count
          FROM events
          WHERE country IS NOT NULL AND country != 'XX' AND country != ''
          GROUP BY country
          ORDER BY count DESC
          LIMIT 10
        `).all();

        topCountries = (countryResults.results || []).map((row: any) => ({
          country: row.country,
          count: Number(row.count || 0),
        }));

        // Top Referrers
        const referrerResults = await env.DB.prepare(`
          SELECT referrer, COUNT(*) as count
          FROM events
          WHERE referrer IS NOT NULL AND referrer != '' AND referrer != 'direct'
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
          amount: row.amount || '1.00',
          currency: row.currency || 'USD',
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
      } catch (d1Err: any) {
        console.error('[Admin D1 Query Error]', d1Err);
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

    return new Response(JSON.stringify({
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};
