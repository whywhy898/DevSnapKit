import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loader() {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const localRequire = name => name.startsWith('.')
      ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')))
      : require(name);
    new Function('require', 'module', 'exports', 'crypto', code)(localRequire, module, module.exports, webcrypto);
    return module.exports;
  }
  return load;
}
const orderId = 'ORDER1234567890123', captureId = 'CAPTURE12345678901';
const signingSecret = 'test-only-signing-secret-at-least-32-characters';
const headers = {
  'content-type': 'application/json', 'paypal-transmission-id': 'TRANSMISSION-TEST',
  'paypal-transmission-time': '2026-10-23T06:00:00Z', 'paypal-transmission-sig': 'signed-test',
  'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs/TEST', 'paypal-auth-algo': 'SHA256withRSA',
};
function canonical(status = 'COMPLETED') {
  return {
    id: orderId, status, intent: 'CAPTURE', payer: { email_address: 'buyer@example.test' },
    purchase_units: [{ reference_id: 'DSK_PRO_LIFETIME', amount: { value: '1.00', currency_code: 'USD' },
      payee: { merchant_id: 'OUR-MERCHANT' }, payments: { captures: [{ id: captureId, status: 'COMPLETED',
        final_capture: true, amount: { value: '1.00', currency_code: 'USD' }, payee: { merchant_id: 'OUR-MERCHANT' } }] } }],
  };
}
function event(type = 'PAYMENT.CAPTURE.COMPLETED') {
  return { id: 'EVENT-TEST', event_type: type, resource: type === 'CHECKOUT.ORDER.APPROVED'
    ? { id: orderId } : { id: captureId, status: 'COMPLETED', supplementary_data: { related_ids: { order_id: orderId } } } };
}
function setup(t, options = {}) {
  const load = loader();
  const sql = new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync(path.join(root, 'd1/schema.sql'), 'utf8'));
  t.after(() => sql.close());
  let writes = 0;
  const DB = { prepare(query) {
    let args = [];
    return { bind(...values) { args = values; return this; },
      async first() { return sql.prepare(query).get(...args) || null; },
      async run() { if (options.dbFailure) throw new Error('database unavailable');
        const result = sql.prepare(query).run(...args); writes += Number(result.changes);
        return { success: true, meta: { changes: Number(result.changes) } }; },
    };
  } };
  const env = { PAYPAL_CLIENT_ID: 'client-test', PAYPAL_CLIENT_SECRET: 'secret-test', PAYPAL_MODE: 'live',
    PAYPAL_WEBHOOK_ID: 'webhook-test', DSK_SERVER_SECRET: signingSecret, DB, NOTIFICATION_EMAIL: 'owner@example.test',
    NOTIFICATION_WEBHOOK: 'https://notify.example.test/payment' };
  const calls = []; let orderReads = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    url = String(url); calls.push({ url, ...init });
    if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'token-test' });
    if (url.endsWith('/verify-webhook-signature')) return Response.json({ verification_status: options.signature || 'SUCCESS' }, { status: options.verifyHttp || 200 });
    if (url.endsWith('/v2/checkout/orders')) return Response.json({ id: orderId }, { status: 201 });
    if (url === 'https://notify.example.test/payment') return Response.json({ ok: true });
    if (url.endsWith('/capture')) {
      if (options.alreadyCaptured) return Response.json({ details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] }, { status: 422 });
      return Response.json(options.capture || options.order || canonical());
    }
    if (url.endsWith('/v2/checkout/orders/' + orderId)) {
      const sequence = options.orderSequence;
      return Response.json(sequence ? sequence[Math.min(orderReads++, sequence.length - 1)] : options.order || canonical());
    }
    throw new Error('Unexpected request: ' + url);
  };
  t.after(() => { globalThis.fetch = oldFetch; });
  function webhook(body = event(), overrideHeaders = headers, bindings = env) {
    const file = path.join(root, 'functions/api/paypal-webhook.ts');
    assert.ok(fs.existsSync(file), 'PayPal webhook handler must exist');
    return load('functions/api/paypal-webhook.ts').onRequestPost({ env: bindings,
      request: new Request('https://qa.invalid/api/paypal-webhook', { method: 'POST', headers: overrideHeaders, body: JSON.stringify(body) }) });
  }
  const capture = (bindings = env) => load('functions/api/paypal-capture-order.ts').onRequestPost({ env: bindings,
    request: new Request('https://qa.invalid/api/paypal-capture-order', { method: 'POST', body: JSON.stringify({ orderId }) }) });
  return { env, calls, sql, load, webhook, capture, count: () => sql.prepare('SELECT COUNT(*) n FROM orders').get().n,
    writes: () => writes, notifications: () => calls.filter(c => c.url === 'https://notify.example.test/payment').length };
}

test('signed completed event durably issues a claimable existing-format license', async t => {
  const s = setup(t); assert.equal((await s.webhook()).status, 200); assert.equal(s.count(), 1);
  const row = s.sql.prepare('SELECT * FROM orders').get(); assert.equal(row.txn_id, captureId);
  const verify = s.load('functions/api/verify-license.ts').onRequestPost;
  const response = await verify({ env: s.env, request: new Request('https://qa.invalid', { method: 'POST', body: JSON.stringify({ licenseKey: row.license_key }) }) });
  assert.equal((await response.json()).valid, true);
  const claim = await s.load('functions/api/claim-license.ts').onRequestPost({ env: s.env,
    request: new Request('https://qa.invalid', { method: 'POST', body: JSON.stringify({ orderId }) }) });
  assert.equal((await claim.json()).licenseKey, row.license_key);
});
test('verification sends the full event and all required PayPal transmission fields', async t => {
  const s = setup(t); await s.webhook();
  const body = JSON.parse(s.calls.find(x => x.url.endsWith('/verify-webhook-signature')).body);
  assert.deepEqual(body.webhook_event, event()); assert.equal(body.webhook_id, 'webhook-test');
  assert.equal(body.transmission_id, headers['paypal-transmission-id']); assert.equal(body.transmission_sig, headers['paypal-transmission-sig']);
  assert.equal(body.transmission_time, headers['paypal-transmission-time']); assert.equal(body.auth_algo, 'SHA256withRSA');
  assert.equal(body.cert_url, headers['paypal-cert-url']);
});
test('unsigned event is rejected without any provider call', async t => {
  const s = setup(t); assert.equal((await s.webhook(event(), {})).status, 400); assert.equal(s.calls.length, 0); assert.equal(s.count(), 0);
});
test('failed signature cannot charge or issue a license', async t => {
  const s = setup(t, { signature: 'FAILURE' }); assert.equal((await s.webhook()).status, 401);
  assert.equal(s.count(), 0); assert.equal(s.calls.some(x => /\/orders\//.test(x.url)), false);
});
test('verification service failure is retryable', async t => {
  const s = setup(t, { verifyHttp: 503 }); assert.equal((await s.webhook()).status, 503); assert.equal(s.count(), 0);
});
for (const name of ['PAYPAL_WEBHOOK_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_CLIENT_ID', 'DSK_SERVER_SECRET', 'DB']) {
  test('webhook fails closed without ' + name, async t => {
    const s = setup(t); const env = { ...s.env }; delete env[name];
    assert.equal((await s.webhook(event(), headers, env)).status, 503); assert.equal(s.calls.length, 0);
  });
}
for (const [name, mutate] of [
  ['wrong amount', o => { o.purchase_units[0].amount.value = '0.01'; }],
  ['wrong currency', o => { o.purchase_units[0].amount.currency_code = 'EUR'; }],
  ['wrong product', o => { o.purchase_units[0].reference_id = 'OTHER_PRODUCT'; }],
  ['wrong capture amount', o => { o.purchase_units[0].payments.captures[0].amount.value = '0.01'; }],
  ['mismatched payee', o => { o.purchase_units[0].payments.captures[0].payee.merchant_id = 'OTHER-MERCHANT'; }],
  ['uncompleted capture', o => { o.purchase_units[0].payments.captures[0].status = 'PENDING'; }],
  ['different capture', o => { o.purchase_units[0].payments.captures[0].id = 'OTHER-CAPTURE'; }],
]) {
  test(name + ' cannot receive a webhook license', async t => {
    const order = canonical(); mutate(order); const s = setup(t, { order });
    assert.equal((await s.webhook()).status, 422); assert.equal(s.count(), 0); assert.equal(s.notifications(), 0);
  });
}
test('signed approved event recovers a lost browser callback with idempotent capture', async t => {
  const order = canonical('APPROVED'); delete order.purchase_units[0].payments;
  const s = setup(t, { order, capture: canonical() }); assert.equal((await s.webhook(event('CHECKOUT.ORDER.APPROVED'))).status, 200);
  assert.equal(s.count(), 1); assert.equal(s.calls.find(x => x.url.endsWith('/capture')).headers['PayPal-Request-Id'], 'dsk-capture-' + orderId);
});
test('bad approved order must not be captured', async t => {
  const order = canonical('APPROVED'); order.purchase_units[0].amount.value = '99.00';
  const s = setup(t, { order }); assert.equal((await s.webhook(event('CHECKOUT.ORDER.APPROVED'))).status, 422);
  assert.equal(s.calls.some(x => x.url.endsWith('/capture')), false);
});
test('repeated and concurrent frontend/webhook delivery keep one row and one key', async t => {
  const s = setup(t); const replies = await Promise.all([s.webhook(), s.webhook(), s.capture(), s.webhook()]);
  assert.ok(replies.every(r => r.status === 200)); assert.equal(s.count(), 1); assert.equal(s.writes(), 1); assert.equal(s.notifications(), 1);
  const key = s.sql.prepare('SELECT license_key FROM orders').get().license_key;
  assert.equal((await replies[2].json()).licenseKey, key); assert.equal((await (await s.capture()).json()).licenseKey, key);
});
test('already captured order is recovered without duplicate charging', async t => {
  const s = setup(t, { alreadyCaptured: true }); const r = await s.capture(); assert.equal(r.status, 200);
  assert.equal(s.count(), 1); assert.equal(s.calls.filter(x => x.url.endsWith('/capture')).length, 0);
});
test('failed durable persistence returns retryable status and no success key', async t => {
  const s = setup(t, { dbFailure: true }); assert.equal((await s.webhook()).status, 503);
  const r = await s.capture(); assert.equal(r.status, 503); assert.equal((await r.json()).success, false); assert.equal(s.count(), 0);
});
test('unknown signed events are acknowledged without orders or charges', async t => {
  const s = setup(t); assert.equal((await s.webhook(event('PAYMENT.CAPTURE.PENDING'))).status, 200);
  assert.equal(s.count(), 0); assert.equal(s.calls.some(x => /\/orders\//.test(x.url)), false);
});
test('server capture refuses absent PayPal secret before requesting a token', async t => {
  const s = setup(t); const env = { ...s.env }; delete env.PAYPAL_CLIENT_SECRET;
  assert.equal((await s.capture(env)).status, 503); assert.equal(s.calls.length, 0);
});
test('concurrent provider capture is recovered after ORDER_ALREADY_CAPTURED', async t => {
  const approved = canonical('APPROVED'); delete approved.purchase_units[0].payments;
  const s = setup(t, { alreadyCaptured: true, orderSequence: [approved, canonical()] });
  assert.equal((await s.capture()).status, 200); assert.equal(s.count(), 1);
  assert.equal(s.calls.filter(x => x.url.endsWith('/capture')).length, 1);
});
test('pending provider capture returns processing without issuing a key', async t => {
  const pending = canonical(); pending.purchase_units[0].payments.captures[0].status = 'PENDING';
  const s = setup(t, { order: pending }); const r = await s.capture();
  assert.equal(r.status, 202); assert.equal((await r.json()).pending, true); assert.equal(s.count(), 0);
});
test('minimal capture response uses the canonical order metadata', async t => {
  const approved = canonical('APPROVED'); delete approved.purchase_units[0].payments;
  const minimal = { id: orderId, status: 'COMPLETED', purchase_units: [{ payments: canonical().purchase_units[0].payments }] };
  const s = setup(t, { order: approved, capture: minimal });
  assert.equal((await s.capture()).status, 200); assert.equal(s.count(), 1);
});
test('public config refuses to display checkout without server credentials', async t => {
  const s = setup(t); const handler = s.load('functions/api/paypal-config.ts').onRequestGet;
  const env = { ...s.env }; delete env.PAYPAL_CLIENT_SECRET;
  assert.equal((await handler({ env })).status, 503);
  const data = await (await handler({ env: s.env })).json();
  assert.deepEqual(data, { clientId: 'client-test', mode: 'live' });
});
test('creation uses server credentials and the unchanged one-dollar CAPTURE purchase', async t => {
  const s = setup(t); const r = await s.load('functions/api/paypal-create-order.ts').onRequestPost({ env: s.env });
  assert.equal(r.status, 200); assert.equal((await r.json()).id, orderId);
  const request = s.calls.find(x => x.url.endsWith('/v2/checkout/orders'));
  const body = JSON.parse(request.body); assert.equal(body.intent, 'CAPTURE');
  assert.deepEqual(body.purchase_units[0].amount, { value: '1.00', currency_code: 'USD' });
  assert.equal(body.purchase_units[0].reference_id, 'DSK_PRO_LIFETIME');
  assert.ok(request.headers['PayPal-Request-Id']); assert.equal(s.count(), 0);
});
