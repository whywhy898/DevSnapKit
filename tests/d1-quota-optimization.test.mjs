import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import * as lucideIcons from 'lucide-react';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function createTsLoader(extraGlobals = {}) {
  const cache = new Map();
  function load(relative) {
    let filename = path.resolve(root, relative);
    if (!path.extname(filename)) {
      filename = ['.ts', '.tsx'].map(ext => filename + ext).find(fs.existsSync);
    }
    assert.ok(filename && fs.existsSync(filename), `Missing module: ${relative}`);
    if (cache.has(filename)) return cache.get(filename).exports;

    const mod = { exports: {} };
    cache.set(filename, mod);
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;

    const localRequire = name => {
      if (name === 'lucide-react') return lucideIcons;
      if (extraGlobals.requireOverrides && name in extraGlobals.requireOverrides) {
        return extraGlobals.requireOverrides[name];
      }
      if (name.startsWith('.')) {
        return load(path.relative(root, path.resolve(path.dirname(filename), name)));
      }
      return require(name);
    };

    const fn = new Function(
      'require',
      'module',
      'exports',
      ...Object.keys(extraGlobals.sandbox || {}),
      js,
    );
    fn(localRequire, mod, mod.exports, ...Object.values(extraGlobals.sandbox || {}));
    return mod.exports;
  }
  return load;
}

const loadServer = createTsLoader();
const { readSeoFunnel } = loadServer('functions/lib/seo-funnel.ts');
const statsHandler = loadServer('functions/api/admin/stats.ts');
const telemetryHandler = loadServer('functions/api/telemetry/event.ts');
const { createAdminToken } = loadServer('functions/lib/security.ts');

const adminSecret = 'qa-only-admin-secret-at-least-32-characters';

function createSqliteD1(t) {
  const sql = new DatabaseSync(':memory:');
  t.after(() => sql.close());
  sql.exec(fs.readFileSync(path.join(root, 'd1/schema.sql'), 'utf8'));

  let prepareCount = 0;
  const capturedSql = [];
  const DB = {
    get prepareCount() {
      return prepareCount;
    },
    resetCount() {
      prepareCount = 0;
    },
    capturedSql,
    prepare(query) {
      prepareCount += 1;
      capturedSql.push(query);
      let args = [];
      return {
        bind(...values) {
          args = values;
          return this;
        },
        async first() {
          return sql.prepare(query).get(...args) || null;
        },
        async all() {
          return { results: sql.prepare(query).all(...args) };
        },
        async run() {
          const info = sql.prepare(query).run(...args);
          return { success: true, meta: { changes: info.changes } };
        },
      };
    },
  };
  return { sql, DB };
}

test('1. readSeoFunnel uses indexed date range (no correlated subquery) and evaluates <= 100 recent rows across 1100 total rows', async t => {
  const { sql, DB } = createSqliteD1(t);

  const insertOld = sql.prepare(
    `INSERT INTO events (event_type, session_id, path, country, referrer, metadata, created_at)
     VALUES (?, ?, ?, 'JP', 'old.example', ?, datetime('now', '-45 days'))`,
  );
  const insertRecent = sql.prepare(
    `INSERT INTO events (event_type, session_id, path, country, referrer, metadata, created_at)
     VALUES (?, ?, ?, 'US', 'google.com', ?, datetime('now', '-1 hour'))`,
  );

  sql.exec('BEGIN');
  for (let i = 0; i < 1000; i++) {
    insertOld.run(
      'seo_landing_view',
      `s_old_${i}`,
      '/og-image-generator/',
      JSON.stringify({
        seo_entry: '/og-image-generator/',
        attribution_storage: 'session',
        event_sequence: 1,
      }),
    );
  }

  const funnelTypes = ['seo_landing_view', 'seo_editor_open', 'upload_image', 'export_image', 'pro_modal_open', 'checkout_click'];
  for (let i = 1; i <= 100; i++) {
    const eventType = i <= funnelTypes.length ? funnelTypes[i - 1] : funnelTypes[i % funnelTypes.length];
    insertRecent.run(
      eventType,
      's_heavy_session_01',
      '/og-image-generator/',
      JSON.stringify({
        seo_entry: '/og-image-generator/',
        attribution_storage: 'session',
        event_sequence: i,
      }),
    );
  }
  sql.exec('COMMIT');

  let jsonValidCalls = 0;
  // Exact 1-arg UDF overrides SQLite json_valid(metadata) to count evaluated rows.
  sql.function('json_valid', _val => {
    jsonValidCalls += 1;
    return 1;
  });

  const result = await readSeoFunnel(DB);
  assert.equal(result.available, true);
  assert.equal(result.windowDays, 30);

  const ogRow = result.rows.find(r => r.entry === '/og-image-generator/');
  assert.deepEqual(
    { ...ogRow, label: undefined },
    {
      entry: '/og-image-generator/',
      label: undefined,
      landings: 1,
      editorOpens: 1,
      uploads: 1,
      exports: 1,
      proOpens: 1,
      checkoutClicks: 1,
    },
  );

  assert.ok(jsonValidCalls > 0 && jsonValidCalls <= 100, `Expected <= 100 row evaluations, got ${jsonValidCalls}`);

  const executedQuery = DB.capturedSql[0];
  assert.ok(executedQuery, 'Expected readSeoFunnel to prepare SQL query');
  const eqp = sql.prepare('EXPLAIN QUERY PLAN ' + executedQuery).all();
  const details = eqp.map(row => row.detail).join('\n');
  assert.match(details, /idx_events_created_at/);
  assert.doesNotMatch(details, /CORRELATED SCALAR SUBQUERY/);
});

test('2. stats handler preserves full payload, WeakMap 60s cache + 10s refresh cooldown, DELETE invalidation, 30d bounds, OPTIONS 204, and safe 503', async t => {
  const { sql, DB } = createSqliteD1(t);
  const token = await createAdminToken(adminSecret);

  sql.prepare(
    `INSERT INTO events (event_type, session_id, path, country, referrer, metadata, created_at)
     VALUES ('page_view', 's_old_country', '/', 'JP', 'ancient.example', '{}', datetime('now', '-45 days'))`,
  ).run();
  sql.prepare(
    `INSERT INTO events (event_type, session_id, path, country, referrer, metadata, created_at)
     VALUES ('page_view', 's_recent_1', '/og-image-generator/', 'US', 'google.com', '{}', datetime('now', '-1 hour'))`,
  ).run();
  sql.prepare(
    `INSERT INTO events (event_type, session_id, path, country, referrer, metadata, created_at)
     VALUES ('export_image', 's_recent_1', '/', 'US', 'google.com', '{}', datetime('now', '-30 minutes'))`,
  ).run();
  sql.prepare(
    `INSERT INTO orders (order_id, txn_id, payer_email, amount, currency, status, license_key, created_at)
     VALUES ('ORDER1234567890', 'TXN1234567890', 'buyer@example.com', '9.90', 'USD', 'COMPLETED', 'DSK-1111-2222-3333', datetime('now', '-10 minutes'))`,
  ).run();

  const callGet = (suffix = '') =>
    statsHandler.onRequestGet({
      env: { DB, ADMIN_SECRET: adminSecret },
      request: new Request('https://devsnapkit.com/api/admin/stats' + suffix, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    });

  // First GET executes D1 queries
  const res1 = await callGet('');
  assert.equal(res1.status, 200);
  const body1 = await res1.json();
  assert.equal(body1.success, true);
  assert.equal(body1.cached, false);
  assert.equal(body1.system.isD1Connected, true);
  assert.equal(body1.overview.totalPv, 2);
  assert.equal(body1.overview.totalUv, 2);
  assert.equal(body1.overview.todayPv, 1);
  assert.equal(body1.overview.totalExports, 1);
  assert.equal(body1.overview.totalOrders, 1);
  assert.equal(body1.overview.totalRevenue, 9.9);
  assert.equal(body1.overview.todayOrders, 1);
  assert.equal(body1.overview.conversionRate, '50.00%');
  assert.ok(body1.dailyTrends.length >= 1);
  assert.equal(body1.recentOrders.length, 1);
  assert.equal(body1.recentVisits.length, 3);
  assert.equal(body1.seoFunnel.available, true);
  // Bounded 30-day topCountries / topReferrers must exclude 45-day-old JP / ancient.example
  assert.deepEqual(body1.topCountries, [{ country: 'US', count: 2 }]);
  assert.deepEqual(body1.topReferrers, [{ referrer: 'google.com', count: 2 }]);

  const firstQueryCount = DB.prepareCount;
  assert.ok(firstQueryCount <= 9, `Expected consolidated query count <= 9, got ${firstQueryCount}`);

  // Second GET within 60s hits WeakMap cache with 0 D1 queries
  DB.resetCount();
  const res2 = await callGet('');
  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  assert.equal(body2.cached, true);
  assert.equal(DB.prepareCount, 0);

  // ?refresh=1 within 10s cooldown still returns cached response with 0 D1 queries
  const resCool = await callGet('?refresh=1');
  assert.equal(resCool.status, 200);
  assert.equal((await resCool.json()).cached, true);
  assert.equal(DB.prepareCount, 0);

  // Advance Date.now by 11s -> ?refresh=1 bypasses cache
  const realNow = Date.now;
  Date.now = () => realNow() + 11_000;
  try {
    const resFresh = await callGet('?refresh=1');
    assert.equal(resFresh.status, 200);
    const bodyFresh = await resFresh.json();
    assert.equal(bodyFresh.cached, false);
    assert.ok(DB.prepareCount > 0);
  } finally {
    Date.now = realNow;
  }

  // DELETE invalidates WeakMap cache
  const delRes = await statsHandler.onRequestDelete({
    env: { DB, ADMIN_SECRET: adminSecret },
    request: new Request('https://devsnapkit.com/api/admin/stats', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
  });
  assert.equal(delRes.status, 200);
  DB.resetCount();
  const afterDel = await callGet('');
  assert.equal(afterDel.status, 200);
  const afterDelBody = await afterDel.json();
  assert.equal(afterDelBody.cached, false);
  assert.equal(afterDelBody.overview.totalPv, 0);
  assert.ok(DB.prepareCount > 0);

  // OPTIONS returns 204
  const optRes = await statsHandler.onRequestOptions();
  assert.equal(optRes.status, 204);

  // D1 query failure returns 503 without leaking internal error details or faking zeros
  const failingDB = {
    prepare() {
      return {
        bind() { return this; },
        async first() { throw new Error('D1_ERROR: code 7500 shard-99'); },
        async all() { throw new Error('D1_ERROR: code 7500 shard-99'); },
      };
    },
  };
  const failRes = await statsHandler.onRequestGet({
    env: { DB: failingDB, ADMIN_SECRET: adminSecret },
    request: new Request('https://devsnapkit.com/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  });
  assert.equal(failRes.status, 503);
  const failText = await failRes.text();
  assert.doesNotMatch(failText, /D1_ERROR|7500|shard-99/);
  const failBody = JSON.parse(failText);
  assert.equal(failBody.success, false);
  assert.equal(failBody.overview, undefined);
});

test('3. telemetry/event.ts guards preview hosts, enforces event allowlist, 4KB limit, and 60/min rate limit', async () => {
  let dbWrites = 0;
  const mockDB = {
    prepare() {
      return {
        bind() { return this; },
        async run() {
          dbWrites += 1;
          return { success: true };
        },
      };
    },
  };

  const postEvent = (url, body, { env = { DB: mockDB }, ip = '203.0.113.1', headers = {} } = {}) =>
    telemetryHandler.onRequestPost({
      env,
      request: new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': ip,
          ...headers,
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    });

  // Preview and localhost skip with 0 D1 writes
  for (const skipUrl of [
    'https://a80095cf.devsnapkit.pages.dev/api/telemetry/event',
    'http://localhost:8788/api/telemetry/event',
  ]) {
    const res = await postEvent(skipUrl, { event: 'page_view', sessionId: 's_123' }, { ip: '203.0.113.2' });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.ok, true);
    assert.equal(json.skipped, 'non_production_host');
  }
  assert.equal(dbWrites, 0);

  // Explicit ALLOW_PREVIEW_TELEMETRY='true' permits preview writes
  const previewAllowed = await postEvent(
    'https://a80095cf.devsnapkit.pages.dev/api/telemetry/event',
    { event: 'page_view', sessionId: 's_123' },
    { env: { DB: mockDB, ALLOW_PREVIEW_TELEMETRY: 'true' }, ip: '203.0.113.3' },
  );
  assert.equal(previewAllowed.status, 200);
  assert.equal(dbWrites, 1);

  // Production hosts allow writes
  for (const prodUrl of [
    'https://devsnapkit.com/api/telemetry/event',
    'https://www.devsnapkit.com/api/telemetry/event',
  ]) {
    const res = await postEvent(prodUrl, { event: 'export_image', sessionId: 's_123' }, { ip: '203.0.113.4' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  }
  assert.equal(dbWrites, 3);

  // Noisy/unknown events dropped with 0 D1 writes
  for (const noisy of ['zoom_change', 'undo_action']) {
    const res = await postEvent('https://devsnapkit.com/api/telemetry/event', { event: noisy, sessionId: 's_123' }, { ip: '203.0.113.5' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).skipped, 'untracked_event');
  }
  assert.equal(dbWrites, 3);

  // >4 KB payload rejected with 413 and 0 D1 writes
  const largeBody = JSON.stringify({ event: 'page_view', sessionId: 's_123', metadata: { pad: 'x'.repeat(4200) } });
  const largeRes = await postEvent('https://devsnapkit.com/api/telemetry/event', largeBody, { ip: '203.0.113.6' });
  assert.equal(largeRes.status, 413);
  assert.equal(dbWrites, 3);

  // 60/min rate limit per IP: 60 succeed, 61st returns 429 with 0 writes
  const writesBeforeRateTest = dbWrites;
  for (let i = 0; i < 60; i++) {
    const res = await postEvent('https://devsnapkit.com/api/telemetry/event', { event: 'page_view', sessionId: `s_${i}` }, { ip: '203.0.113.99' });
    assert.equal(res.status, 200);
  }
  assert.equal(dbWrites, writesBeforeRateTest + 60);

  const limitedRes = await postEvent('https://devsnapkit.com/api/telemetry/event', { event: 'page_view', sessionId: 's_61' }, { ip: '203.0.113.99' });
  assert.equal(limitedRes.status, 429);
  assert.equal(dbWrites, writesBeforeRateTest + 60);
});

test('4. src/telemetry.ts drops noisy events, dedupes high-frequency trial events per session, and keeps core funnel events', () => {
  const sent = [];
  const loadClient = createTsLoader({
    sandbox: {
      window: {
        DevSnapKitAnalytics: {
          track(event, metadata) {
            sent.push({ event, metadata });
          },
        },
      },
    },
  });
  const { trackEvent } = loadClient('src/telemetry.ts');

  trackEvent('zoom_change', { zoom: 120 });
  trackEvent('undo_action', { trigger: 'keyboard' });
  trackEvent('poster_open');

  trackEvent('preset_change', { preset: 'p1' });
  trackEvent('preset_change', { preset: 'p2' });
  trackEvent('theme_change', { theme: 't1' });
  trackEvent('theme_change', { theme: 't2' });
  trackEvent('bg_type_change', { type: 'gradient' });
  trackEvent('bg_type_change', { type: 'solid' });

  trackEvent('page_view');
  trackEvent('upload_image', { size: 100 });
  trackEvent('export_image', { format: 'png' });
  trackEvent('export_image', { format: 'png' });
  trackEvent('copy_image');
  trackEvent('pro_modal_open');
  trackEvent('checkout_click');

  assert.deepEqual(
    sent.map(item => item.event),
    [
      'preset_change',
      'theme_change',
      'bg_type_change',
      'page_view',
      'upload_image',
      'export_image',
      'export_image',
      'copy_image',
      'pro_modal_open',
      'checkout_click',
    ],
  );
});

function createDashboardHarness({ savedToken = null, failStats = false } = {}) {
  const slots = [];
  const effects = [];
  const storage = new Map();
  if (savedToken !== null) storage.set('devsnapkit_admin_token', savedToken);

  const intervals = [];
  const timeouts = [];
  const fetchCalls = [];
  const fetchQueue = [];
  let cursor = 0;

  const sameDeps = (a, b) =>
    Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));

  const react = {
    Fragment: Symbol.for('react.fragment'),
    useRef(initialValue) {
      const i = cursor++;
      return (slots[i] ??= { current: initialValue });
    },
    useState(initialValue) {
      const i = cursor++;
      if (!(i in slots)) {
        slots[i] = { value: typeof initialValue === 'function' ? initialValue() : initialValue };
      }
      const setState = next => {
        slots[i].value = typeof next === 'function' ? next(slots[i].value) : next;
      };
      return [slots[i].value, setState];
    },
    useEffect(fn, deps) {
      const i = cursor++;
      const prev = slots[i];
      if (!prev || !sameDeps(prev.deps, deps)) {
        effects.push(() => {
          prev?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
      }
    },
  };

  const jsxFactory = (type, props, key) => ({ type, props: props || {}, key });
  const jsxRuntime = { Fragment: react.Fragment, jsx: jsxFactory, jsxs: jsxFactory };

  const localStorageMock = {
    getItem: key => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: key => storage.delete(key),
  };

  const fetchMock = (url, init = {}) => {
    const entry = { url: String(url), method: init.method || 'GET', headers: init.headers || {} };
    fetchCalls.push(entry);
    if (fetchQueue.length > 0) {
      return fetchQueue.shift()(entry);
    }
    if (entry.url === '/api/admin/auth') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, token: 'qa-fresh-token' }) });
    }
    if (failStats) {
      return Promise.reject(new Error('offline network error'));
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        timestamp: new Date().toISOString(),
        cached: false,
        system: { storageEngine: 'D1', isD1Connected: true, isKvConnected: false, isEmailConfigured: false, notificationRecipient: '' },
        overview: { todayPv: 1, todayUv: 1, todayUploads: 0, todayTrials: 0, todayExports: 1, todayOrders: 0, todayRevenue: 0, totalPv: 1, totalUv: 1, totalUploads: 0, totalTrials: 0, totalExports: 1, totalOrders: 0, totalRevenue: 0, conversionRate: '0.00%' },
        dailyTrends: [],
        recentOrders: [],
        topCountries: [],
        topReferrers: [],
        recentVisits: [],
      }),
    });
  };

  const absDashboard = path.resolve(root, 'src/AdminDashboard.tsx');
  const moduleCache = new Map();
  function loadTsx(absPath) {
    if (moduleCache.has(absPath)) return moduleCache.get(absPath).exports;
    const mod = { exports: {} };
    moduleCache.set(absPath, mod);
    const js = ts.transpileModule(fs.readFileSync(absPath, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const context = {
      module: mod,
      exports: mod.exports,
      localStorage: localStorageMock,
      fetch: fetchMock,
      AbortController,
      navigator: { clipboard: { writeText: async () => {} } },
      setInterval(fn, ms) {
        const id = intervals.length + 1;
        intervals.push({ id, fn, ms, cleared: false });
        return id;
      },
      clearInterval(id) {
        const item = intervals.find(x => x.id === id);
        if (item) item.cleared = true;
      },
      setTimeout(fn, ms) {
        const id = timeouts.length + 1;
        timeouts.push({ id, fn, ms, cleared: false });
        return id;
      },
      clearTimeout(id) {
        const item = timeouts.find(x => x.id === id);
        if (item) item.cleared = true;
      },
      require(name) {
        if (name === 'react') return { default: react, ...react };
        if (name === 'react/jsx-runtime') return jsxRuntime;
        if (name === 'lucide-react') return lucideIcons;
        if (name.startsWith('.')) {
          const target = path.resolve(path.dirname(absPath), name);
          const resolved = ['.tsx', '.ts'].map(ext => target + ext).find(fs.existsSync);
          assert.ok(resolved, `Missing relative module: ${name}`);
          return loadTsx(resolved);
        }
        return require(name);
      },
    };
    vm.runInNewContext(js, context);
    return mod.exports;
  }

  const AdminDashboard = loadTsx(absDashboard).default;
  let tree = null;
  function render() {
    cursor = 0;
    tree = AdminDashboard({});
    while (effects.length) effects.shift()();
    return tree;
  }

  function findElement(node, predicate) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
      for (const child of node) {
        const found = findElement(child, predicate);
        if (found) return found;
      }
      return null;
    }
    if (predicate(node)) return node;
    if (node.props && 'children' in node.props) return findElement(node.props.children, predicate);
    return null;
  }

  function collectText(node, out = []) {
    if (node == null || typeof node === 'boolean') return out;
    if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out; }
    if (Array.isArray(node)) { for (const c of node) collectText(c, out); return out; }
    if (typeof node === 'object') {
      if (typeof node.type === 'function') return collectText(node.type(node.props || {}), out);
      if (node.props && 'children' in node.props) collectText(node.props.children, out);
    }
    return out;
  }

  render();
  return {
    render,
    intervals,
    timeouts,
    fetchCalls,
    enqueueFetch: fn => fetchQueue.push(fn),
    statsCalls: () => fetchCalls.filter(c => c.url.includes('/api/admin/stats')),
    authCalls: () => fetchCalls.filter(c => c.url.includes('/api/admin/auth')),
    find: pred => findElement(tree, pred),
    text: () => collectText(tree).join(' '),
  };
}

test('5. AdminDashboard removes 30s polling & auto-retry, keeps single initial load, and guards overlapping manual refresh clicks', async () => {
  const source = fs.readFileSync(path.join(root, 'src/AdminDashboard.tsx'), 'utf8');
  assert.doesNotMatch(source, /setInterval\s*\(/);
  assert.doesNotMatch(source, /Auto \(30s\)/);
  assert.doesNotMatch(source, /setTimeout\s*\(\s*r\s*=>\s*setTimeout\s*\(\s*r\s*,\s*1500\s*\)|1500/);

  // Saved token mount -> single initial /api/admin/stats call, zero intervals, zero retry timers
  const saved = createDashboardHarness({ savedToken: 'qa-saved-token' });
  await new Promise(r => setImmediate(r));
  saved.render();
  assert.equal(saved.statsCalls().length, 1);
  assert.equal(saved.intervals.length, 0);
  assert.equal(saved.timeouts.filter(t => t.ms === 1500).length, 0);
  assert.ok(saved.text().includes('Manual Refresh'));

  // Overlapping manual refresh clicks -> synchronous isFetchingRef blocks duplicate request
  let resolveSlow;
  saved.enqueueFetch(() => new Promise(resolve => { resolveSlow = resolve; }));
  const refreshBtn = saved.find(n => n.type === 'button' && n.props?.title === 'Refresh Data');
  assert.ok(refreshBtn, 'Expected manual Refresh Data button');
  const p1 = refreshBtn.props.onClick();
  const p2 = refreshBtn.props.onClick();
  assert.equal(saved.statsCalls().length, 2, 'Synchronous overlapping click must not fire duplicate request');
  assert.equal(saved.statsCalls()[1].url, '/api/admin/stats?refresh=1');
  resolveSlow({
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      timestamp: new Date().toISOString(),
      cached: false,
      system: { storageEngine: 'D1', isD1Connected: true, isKvConnected: false, isEmailConfigured: false, notificationRecipient: '' },
      overview: { todayPv: 2, todayUv: 1, todayUploads: 0, todayTrials: 0, todayExports: 1, todayOrders: 0, todayRevenue: 0, totalPv: 2, totalUv: 1, totalUploads: 0, totalTrials: 0, totalExports: 1, totalOrders: 0, totalRevenue: 0, conversionRate: '0.00%' },
      dailyTrends: [],
      recentOrders: [],
      topCountries: [],
      topReferrers: [],
      recentVisits: [],
    }),
  });
  await Promise.all([p1, p2]);

  // Login without saved token -> /api/admin/auth + 1 initial /api/admin/stats, 0 intervals
  const login = createDashboardHarness({ savedToken: null });
  assert.equal(login.statsCalls().length, 0);
  const input = login.find(n => n.type === 'input' && n.props?.type === 'password');
  input.props.onChange({ target: { value: 'qa-secret-input' } });
  login.render();
  const form = login.find(n => n.type === 'form' && typeof n.props?.onSubmit === 'function');
  await form.props.onSubmit({ preventDefault() {} });
  await new Promise(r => setImmediate(r));
  login.render();
  assert.equal(login.authCalls().length, 1);
  assert.equal(login.statsCalls().length, 1);
  assert.equal(login.intervals.length, 0);

  // Failed manual refresh schedules 0 retry timers and shows error
  const failed = createDashboardHarness({ savedToken: 'qa-saved-token', failStats: true });
  await new Promise(r => setImmediate(r));
  failed.render();
  assert.equal(failed.statsCalls().length, 1);
  assert.equal(failed.timeouts.filter(t => t.ms === 1500).length, 0);
  assert.ok(failed.text().includes('Failed to fetch dashboard data'));
});
