import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
const require = createRequire(import.meta.url), ts = require('typescript');
const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
export function load(relative, globals = {}) {
  const cache = new Map();
  function read(file) {
    if (!path.extname(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, { module, exports: module.exports, require: name => name.startsWith('.') ? read(path.resolve(path.dirname(file), name)) : require(name), Request, Response, URL, TextDecoder, TextEncoder, btoa, atob, crypto: globalThis.crypto, Date, Map, Set, console, ...globals });
    return module.exports;
  }
  return read(path.join(root, relative));
}
const request = (body, host = 'devsnapkit.com', ip = crypto.randomUUID(), suffix = '') => new Request(`https://${host}/api/event${suffix}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(body) });
const event = { event: 'visit', sessionId: 's_abcdefgh1234', path: '/', utm_source: 'newsletter' };
test('event endpoint allows exactly four known names, with payment restricted to the server', async () => {
  const { onRequestPost } = load('functions/api/event.ts');
  for (const name of ['visit', 'editor_open', 'export']) assert.equal((await onRequestPost({ request: request({ ...event, event: name }), env: {} })).status, 204);
  assert.equal((await onRequestPost({ request: request({ ...event, event: 'payment' }), env: {} })).status, 403);
  for (const name of ['unknown', 'page_view', '', null, 12]) assert.equal((await onRequestPost({ request: request({ ...event, event: name }), env: {} })).status, 400);
});
test('event fields are typed, bounded and payload-limited', async () => {
  const { onRequestPost } = load('functions/api/event.ts');
  for (const [key, value] of Object.entries({ sessionId: 'a'.repeat(65), path: 'a'.repeat(513), utm_source: 'x'.repeat(121), utm_medium: {}, utm_campaign: [], ref: 1 })) assert.equal((await onRequestPost({ request: request({ ...event, [key]: value }), env: {} })).status, 400, key);
  assert.equal((await onRequestPost({ request: request({ ...event, extra: 'x'.repeat(9000) }), env: {} })).status, 413);
});
test('host determines environment, client override is ignored and Analytics Engine takes precedence', async () => {
  const { onRequestPost } = load('functions/api/event.ts');
  for (const [host, expected] of [['devsnapkit.com', 'production'], ['www.devsnapkit.com', 'production'], ['branch.project.pages.dev', 'preview'], ['localhost:3001', 'dev'], ['127.0.0.1:3001', 'dev'], ['devsnapkit.com.evil.test', 'preview']]) {
    const points = [];
    await onRequestPost({ request: request({ ...event, env: 'forged' }, host), env: { EVENTS: { writeDataPoint: p => points.push(p) }, DB: { prepare() { throw Error('must not use D1'); } } } });
    assert.equal(points.length, 1); assert.equal(points[0].blobs[0], expected); assert.equal(points[0].blobs[1], 'visit'); assert.equal(points[0].blobs[2], 'newsletter');
    assert.ok(!JSON.stringify(points).includes('CF-Connecting-IP'));
  }
});
test('D1 fallback reuses events and strips IP and client metadata', async () => {
  const writes = [];
  const DB = { prepare(sql) { return { bind(...values) { return { run: async () => { writes.push({ sql, values }); } }; } }; } };
  const { onRequestPost } = load('functions/api/event.ts');
  await onRequestPost({ request: request({ ...event, env: 'production', metadata: { private: 'no' } }, 'branch.pages.dev', 'private-ip'), env: { DB } });
  assert.match(writes[0].sql, /INSERT INTO events/); assert.equal(JSON.parse(writes[0].values.at(-1)).env, 'preview');
  assert.ok(!JSON.stringify(writes).includes('private-ip')); assert.ok(!JSON.stringify(writes).includes('"private"'));
});
test('per-isolate limiter allows thirty requests per minute per IP and expires', async () => {
  let now = 100000;
  const api = load('functions/api/event.ts', { Date: class extends Date { static now() { return now; } } });
  for (let i = 0; i < 30; i++) assert.equal((await api.onRequestPost({ request: request(event, 'branch.pages.dev', 'same'), env: {} })).status, 204);
  assert.equal((await api.onRequestPost({ request: request(event, 'branch.pages.dev', 'same'), env: {} })).status, 429);
  now += 60001;
  assert.equal((await api.onRequestPost({ request: request(event, 'branch.pages.dev', 'same'), env: {} })).status, 204);
});

test('feedback uses the same thirty-per-minute per-isolate budget', async () => {
  const api = load('functions/api/feedback.ts');
  const env = { FEEDBACK_ENABLED: 'true', ADMIN_SECRET: 'test-only-admin-secret-at-least-32-characters',
    DB: { prepare() { return { bind() { return this; }, async run() {} }; } } };
  for (let i = 0; i < 30; i++) assert.equal((await api.onRequestPost({ request: request({ message: 'test' }, 'branch.pages.dev', 'feedback-ip'), env })).status, 204);
  assert.equal((await api.onRequestPost({ request: request({ message: 'test' }, 'branch.pages.dev', 'feedback-ip'), env })).status, 429);
});
test('failure switch is preview/dev only, storage exceptions never escape', async () => {
  const { onRequestPost } = load('functions/api/event.ts');
  for (const [host, status] of [['branch.pages.dev', 500], ['localhost', 500], ['devsnapkit.com', 204], ['www.devsnapkit.com', 204]]) assert.equal((await onRequestPost({ request: request(event, host, crypto.randomUUID(), '?simulate_api_fail=1'), env: {} })).status, status);
  assert.equal((await onRequestPost({ request: request(event), env: { EVENTS: { writeDataPoint() { throw Error('offline'); } } } })).status, 204);
});
test('feedback validates optional fields, stores server env and never stores IP', async () => {
  const { onRequestPost } = load('functions/api/feedback.ts');
  const writes = [], DB = { prepare(sql) { return { bind(...values) { return { run: async () => writes.push({ sql, values }) }; } }; } };
  const enabled = { DB, FEEDBACK_ENABLED: 'true', ADMIN_SECRET: 'test-only-admin-secret-at-least-32-characters' };
  for (const bad of [{ email: 'invalid' }, { email: 'a@b.test\nBcc:a@b.test' }, { email: 'a'.repeat(255) }, { message: 'x'.repeat(501) }, { message: {} }, {}]) assert.equal((await onRequestPost({ request: request(bad), env: enabled })).status, 400);
  for (const good of [{ email: 'reader@example.com' }, { message: 'More frames please' }, { email: '', message: 'Nice' }]) assert.equal((await onRequestPost({ request: request({ ...good, env: 'production' }, 'branch.pages.dev'), env: enabled })).status, 204);
  assert.equal(writes.length, 3); assert.equal(writes[0].values[1], 'preview'); assert.match(writes[0].sql, /INSERT INTO feedback/);
  assert.equal((await onRequestPost({ request: request({ message: 'test' }, 'devsnapkit.com', 'ip', '?simulate_api_fail=1'), env: enabled })).status, 204);
  assert.equal((await onRequestPost({ request: request({ message: 'test' }, 'branch.pages.dev', 'ip', '?simulate_api_fail=1'), env: { DB } })).status, 500);
  assert.equal((await onRequestPost({ request: request({ message: 'test' }), env: {} })).status, 503);
});

test('feedback is disabled without explicit operator opt-in and authenticated deletion configuration', async () => {
  const api = load('functions/api/feedback.ts');
  let writes = 0;
  const DB = { prepare() { return { bind() { return this; }, async run() { writes++; }, async first() { return null; } }; } };
  for (const env of [{ DB }, { DB, FEEDBACK_ENABLED: 'true' }, { FEEDBACK_ENABLED: 'true', ADMIN_SECRET: 'test-only-admin-secret-at-least-32-characters' }]) {
    assert.equal((await api.onRequestPost({ request: request({ message: 'private feedback' }), env })).status, 503);
    assert.deepEqual(await (await api.onRequestGet({ env })).json(), { enabled: false });
  }
  const env = { DB, FEEDBACK_ENABLED: 'true', ADMIN_SECRET: 'test-only-admin-secret-at-least-32-characters' };
  assert.deepEqual(await (await api.onRequestGet({ env })).json(), { enabled: true });
  assert.equal(writes, 0);
  env.DB = { prepare() { throw Error('migration missing'); } };
  assert.deepEqual(await (await api.onRequestGet({ env })).json(), { enabled: false });
});

test('feedback deletion requires admin authentication and deletes only an exact supplied record', async () => {
  const api = load('functions/api/admin/feedback.ts');
  const { createAdminToken } = load('functions/lib/security.ts');
  const secret = 'test-only-admin-secret-at-least-32-characters';
  const writes = [], DB = { prepare(sql) { return { bind(...args) { return { async run() { writes.push({ sql, args }); return { meta: { changes: 1 } }; } }; } }; } };
  const call = (body, token = '') => api.onRequestDelete({ env: { DB, ADMIN_SECRET: secret }, request: new Request('https://devsnapkit.com/api/admin/feedback', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(body) }) });
  assert.equal((await call({ id: 'record-1' })).status, 401); assert.equal(writes.length, 0);
  const token = await createAdminToken(secret);
  assert.equal((await call({}, token)).status, 400);
  assert.equal((await call({ id: 'record-1' }, token)).status, 200);
  assert.deepEqual(writes[0].args, ['record-1']); assert.match(writes[0].sql, /DELETE FROM feedback WHERE id = \?/);
});

test('production admin statistics exclude sandbox, preview and unclassified legacy payments and events', async t => {
  const sql = new DatabaseSync(':memory:'); t.after(() => sql.close());
  sql.exec(fs.readFileSync(path.join(root, 'd1/schema.sql'), 'utf8'));
  const DB = { prepare(query) { let args = []; return { bind(...values) { args = values; return this; },
    async first() { return sql.prepare(query).get(...args); }, async all() { return { results: sql.prepare(query).all(...args) }; } }; } };
  for (const [id, mode, env] of [['live-prod', 'live', 'production'], ['sandbox-prod', 'sandbox', 'preview'], ['live-preview', 'live', 'preview'], ['old', null, null]]) {
    sql.prepare("INSERT INTO orders (order_id, amount, status, raw_payload) VALUES (?, '9.90', 'COMPLETED', ?)")
      .run(id, JSON.stringify(mode ? { devsnapkit_payment: { mode, env } } : {}));
  }
  for (const env of ['production', 'preview', 'dev']) for (const event of ['visit', 'editor_open', 'export', 'payment']) {
    sql.prepare('INSERT INTO events (event_type, session_id, metadata) VALUES (?, ?, ?)').run(event, env, JSON.stringify({ env }));
  }
  const secret = 'test-only-admin-secret-at-least-32-characters';
  const token = await load('functions/lib/security.ts').createAdminToken(secret);
  const response = await load('functions/api/admin/stats.ts').onRequestGet({ env: { DB, ADMIN_SECRET: secret,
    DSK_KV: { async get() { return JSON.stringify([{ amount: '999' }]); } } },
    request: new Request('https://devsnapkit.com/api/admin/stats', { headers: { Authorization: 'Bearer ' + token } }) });
  assert.equal(response.status, 200); const data = await response.json();
  assert.equal(data.overview.totalOrders, 1); assert.equal(data.overview.totalRevenue, 9.9);
  assert.equal(data.overview.totalPv, 1); assert.equal(data.overview.totalExports, 1);
  assert.equal(data.recentOrders.length, 1); assert.equal(data.recentOrders[0].orderId, 'live-prod');
  assert.equal(data.growthFunnel.rows[0].payment, 1);
  sql.exec('DELETE FROM orders');
  const empty = await load('functions/api/admin/stats.ts').onRequestGet({ env: { DB, ADMIN_SECRET: secret,
    DSK_KV: { async get() { return JSON.stringify([{ amount: '999' }]); } } },
    request: new Request('https://devsnapkit.com/api/admin/stats', { headers: { Authorization: 'Bearer ' + token } }) });
  assert.equal((await empty.json()).overview.totalOrders, 0);
});
