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
const { proPricing } = loader()('shared/pricing.ts');

function loader() {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const localRequire = name =>
      name.startsWith('.')
        ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')))
        : require(name);
    new Function('require', 'module', 'exports', 'crypto', code)(localRequire, module, module.exports, webcrypto);
    return module.exports;
  }
  return load;
}

const checkoutId = 'ch_1QyIQDw9cbFWdA1ry5Qc6I';
const orderId = 'ord_4aDwWXjMLpes4Kj4XqNnUA';
const productId = 'prod_dsk_pro_test';
const webhookSecret = 'whsec_test_only_secret_32_characters_long';
const signingSecret = 'test-only-signing-secret-at-least-32-characters';

async function signPayload(rawBody, secret = webhookSecret) {
  const enc = new TextEncoder();
  const key = await webcrypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await webcrypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
}

function canonicalCheckout(status = 'completed', orderStatus = 'paid') {
  const amountCents = Math.round(Number(proPricing.amount) * 100);
  return {
    id: checkoutId,
    object: 'checkout',
    mode: 'live',
    status,
    product: productId,
    customer: { email: 'buyer@example.test', name: 'Test Buyer' },
    metadata: { referenceId: proPricing.referenceId },
    order: {
      id: orderId,
      object: 'order',
      product: productId,
      currency: proPricing.currency,
      amount: amountCents,
      amount_paid: amountCents,
      amount_due: 0,
      status: orderStatus,
      created_at: '2026-11-19T06:00:00Z',
    },
  };
}

function eventPayload(eventType = 'checkout.completed', overrides = {}) {
  return {
    id: 'evt_5WHHcZPv7VS0YUsberIuOz',
    eventType,
    created_at: 1795068000000,
    object: {
      id: checkoutId,
      object: 'checkout',
      status: 'paid',
      product: { id: productId },
      order: { id: orderId, status: 'paid' },
      ...overrides,
    },
  };
}

function setup(t, options = {}) {
  const load = loader();
  const sql = new DatabaseSync(':memory:');
  sql.exec(fs.readFileSync(path.join(root, 'd1/schema.sql'), 'utf8'));
  t.after(() => sql.close());

  let writes = 0;
  const DB = {
    prepare(query) {
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
          if (options.dbFailure) throw new Error('database unavailable');
          const result = sql.prepare(query).run(...args);
          writes += Number(result.changes);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
    },
  };

  const env = {
    CREEM_API_KEY: options.apiKey || 'creem_live_test_key',
    CREEM_WEBHOOK_SECRET: webhookSecret,
    CREEM_PRODUCT_ID: productId,
    CREEM_MODE: options.mode || 'live',
    DSK_SERVER_SECRET: signingSecret,
    DB,
    NOTIFICATION_EMAIL: 'owner@example.test',
    NOTIFICATION_WEBHOOK: 'https://notify.example.test/payment',
  };

  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    calls.push({ url, ...init });
    if (url.endsWith('/v1/checkouts')) {
      return Response.json({ id: checkoutId, checkout_url: `https://checkout.creem.io/${checkoutId}`, status: 'pending' });
    }
    if (url.includes(`/v1/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`)) {
      if (options.checkoutHttp && options.checkoutHttp !== 200) {
        return Response.json({ error: 'upstream error' }, { status: options.checkoutHttp });
      }
      return Response.json(options.checkout || canonicalCheckout());
    }
    if (url.includes(`/v1/transactions/search?order_id=${encodeURIComponent(orderId)}`)) {
      if (options.transactionSearch) return Response.json(options.transactionSearch);
      const amountCents = Math.round(Number(proPricing.amount) * 100);
      return Response.json({
        items: [
          {
            id: 'tran_x7G5R2aujLyKVsqtWF6RD',
            object: 'transaction',
            amount: amountCents,
            amount_paid: amountCents,
            currency: proPricing.currency,
            type: 'payment',
            tax_amount: 0,
            status: 'paid',
            refunded_amount: null,
            order: orderId,
            created_at: 1795077877428,
            mode: options.mode || 'live',
          },
        ],
      });
    }
    if (url.includes('/v1/transactions?transaction_id=tran_x7G5R2aujLyKVsqtWF6RD')) {
      if (options.transactionById) return Response.json(options.transactionById);
      const amountCents = Math.round(Number(proPricing.amount) * 100);
      return Response.json({
        id: 'tran_x7G5R2aujLyKVsqtWF6RD',
        object: 'transaction',
        amount: amountCents,
        amount_paid: amountCents,
        currency: proPricing.currency,
        type: 'payment',
        tax_amount: 0,
        status: 'paid',
        refunded_amount: null,
        order: orderId,
        created_at: 1795077877428,
        mode: options.mode || 'live',
      });
    }
    if (url === 'https://notify.example.test/payment') {
      return Response.json({ ok: true });
    }
    throw new Error('Unexpected request: ' + url);
  };
  t.after(() => {
    globalThis.fetch = oldFetch;
  });

  async function webhook(body = eventPayload(), overrideHeaders, bindings = env) {
    const file = path.join(root, 'functions/api/creem-webhook.ts');
    assert.ok(fs.existsSync(file), 'Creem webhook handler must exist');
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    const headers = overrideHeaders ?? {
      'content-type': 'application/json',
      'creem-signature': await signPayload(raw, bindings.CREEM_WEBHOOK_SECRET || webhookSecret),
    };
    return load('functions/api/creem-webhook.ts').onRequestPost({
      env: bindings,
      request: new Request('https://qa.invalid/api/creem-webhook', { method: 'POST', headers, body: raw }),
    });
  }

  const verifyCheckout = (bindings = env, id = checkoutId) =>
    load('functions/api/creem-verify-checkout.ts').onRequestPost({
      env: bindings,
      request: new Request('https://qa.invalid/api/creem-verify-checkout', {
        method: 'POST',
        body: JSON.stringify({ checkoutId: id }),
      }),
    });

  return {
    env,
    calls,
    sql,
    load,
    webhook,
    verifyCheckout,
    count: () => sql.prepare('SELECT COUNT(*) n FROM orders').get().n,
    writes: () => writes,
    notifications: () => calls.filter(c => c.url === 'https://notify.example.test/payment').length,
  };
}

test('signed completed event durably issues a claimable license for mixed-case Creem IDs', async t => {
  const s = setup(t);
  assert.equal((await s.webhook()).status, 200);
  assert.equal(s.count(), 1);
  const row = s.sql.prepare('SELECT * FROM orders').get();
  assert.equal(row.order_id, checkoutId);
  assert.equal(row.txn_id, orderId);
  assert.match(row.license_key, /^DSK-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);

  const verify = s.load('functions/api/verify-license.ts').onRequestPost;
  const verifyRes = await verify({
    env: s.env,
    request: new Request('https://qa.invalid', { method: 'POST', body: JSON.stringify({ licenseKey: row.license_key }) }),
  });
  assert.equal((await verifyRes.json()).valid, true);

  for (const lookupId of [checkoutId, orderId, checkoutId.toLowerCase(), orderId.toUpperCase()]) {
    const claimRes = await s.load('functions/api/claim-license.ts').onRequestPost({
      env: s.env,
      request: new Request('https://qa.invalid', { method: 'POST', body: JSON.stringify({ orderId: lookupId }) }),
    });
    assert.equal(claimRes.status, 200);
    assert.equal((await claimRes.json()).licenseKey, row.license_key);
  }
});

test('unsigned webhook event is rejected with 400 without any provider call', async t => {
  const s = setup(t);
  const res = await s.webhook(eventPayload(), { 'content-type': 'application/json' });
  assert.equal(res.status, 400);
  assert.equal(s.calls.length, 0);
  assert.equal(s.count(), 0);
});

test('invalid creem-signature is rejected with 401 without provider lookup', async t => {
  const s = setup(t);
  const res = await s.webhook(eventPayload(), {
    'content-type': 'application/json',
    'creem-signature': '0'.repeat(64),
  });
  assert.equal(res.status, 401);
  assert.equal(s.count(), 0);
  assert.equal(s.calls.length, 0);
});

for (const name of ['CREEM_WEBHOOK_SECRET', 'CREEM_API_KEY', 'CREEM_PRODUCT_ID', 'DSK_SERVER_SECRET', 'DB']) {
  test('webhook fails closed with 503 without ' + name, async t => {
    const s = setup(t);
    const env = { ...s.env };
    delete env[name];
    assert.equal((await s.webhook(eventPayload(), undefined, env)).status, 503);
    assert.equal(s.calls.length, 0);
  });
}

for (const name of ['CREEM_API_KEY', 'CREEM_PRODUCT_ID', 'DSK_SERVER_SECRET', 'DB']) {
  test('verify-checkout fails closed with 503 without ' + name, async t => {
    const s = setup(t);
    const env = { ...s.env };
    delete env[name];
    assert.equal((await s.verifyCheckout(env)).status, 503);
    assert.equal(s.calls.length, 0);
  });
}

for (const [name, mutate] of [
  ['wrong amount', c => { c.order.amount = 1; c.order.amount_paid = 1; }],
  ['mismatched amount_paid', c => { c.order.amount_paid = 100; }],
  ['wrong currency', c => { c.order.currency = 'EUR'; }],
  ['wrong product', c => { c.product = 'prod_OTHER'; c.order.product = 'prod_OTHER'; }],
  ['wrong metadata referenceId', c => { c.metadata.referenceId = 'OTHER_REF'; }],
  ['unpaid order status', c => { c.order.status = 'pending'; }],
  ['mismatched order id', c => { c.order.id = 'ord_different123'; }],
]) {
  test(name + ' cannot receive a webhook license', async t => {
    const checkout = canonicalCheckout();
    mutate(checkout);
    const s = setup(t, { checkout });
    assert.equal((await s.webhook()).status, 422);
    assert.equal(s.count(), 0);
    assert.equal(s.notifications(), 0);
  });
}

test('VAT/tax-inclusive MoR checkout is accepted and records net product revenue', async t => {
  const baseCents = Math.round(Number(proPricing.amount) * 100);
  const taxCents = 198;
  const checkout = canonicalCheckout();
  checkout.order.sub_total = baseCents;
  checkout.order.tax_amount = taxCents;
  checkout.order.discount_amount = 0;
  checkout.order.amount = baseCents + taxCents;
  checkout.order.amount_paid = baseCents + taxCents;
  const s = setup(t, { checkout });
  assert.equal((await s.webhook()).status, 200);
  assert.equal(s.count(), 1);
  const row = s.sql.prepare('SELECT amount FROM orders').get();
  assert.equal(row.amount, proPricing.amount);
});

test('repeated and concurrent verify-checkout and webhook delivery keep one row and one key', async t => {
  const s = setup(t);
  const replies = await Promise.all([s.webhook(), s.webhook(), s.verifyCheckout(), s.webhook()]);
  assert.ok(replies.every(r => r.status === 200));
  assert.equal(s.count(), 1);
  assert.equal(s.writes(), 1);
  assert.equal(s.notifications(), 1);
  const key = s.sql.prepare('SELECT license_key FROM orders').get().license_key;
  assert.equal((await replies[2].json()).licenseKey, key);
  assert.equal((await (await s.verifyCheckout()).json()).licenseKey, key);
});

test('failed durable persistence returns retryable 503 status and no success key', async t => {
  const s = setup(t, { dbFailure: true });
  assert.equal((await s.webhook()).status, 503);
  const r = await s.verifyCheckout();
  assert.equal(r.status, 503);
  assert.equal((await r.json()).success, false);
  assert.equal(s.count(), 0);
});

test('unknown signed events are acknowledged without orders or API calls', async t => {
  const s = setup(t);
  const res = await s.webhook(eventPayload('subscription.active'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { received: true, ignored: true });
  assert.equal(s.count(), 0);
  assert.equal(s.calls.length, 0);
});

for (const status of ['pending', 'expired', 'canceled']) {
  test('verify-checkout reports unpaid ' + status + ' checkout as safe to discard', async t => {
    const checkout = canonicalCheckout(status, 'pending');
    const s = setup(t, { checkout });
    const res = await s.verifyCheckout();
    assert.equal(res.status, 202);
    const data = await res.json();
    assert.equal(data.unpaid, true);
    assert.equal(data.pending, false);
    assert.equal(s.count(), 0);
  });
}

test('processing checkout must not be reported as safe to discard', async t => {
  const checkout = canonicalCheckout('completed', 'pending');
  const s = setup(t, { checkout });
  const res = await s.verifyCheckout();
  assert.equal(res.status, 202);
  const data = await res.json();
  assert.notEqual(data.unpaid, true);
  assert.equal(data.pending, true);
  assert.equal(s.count(), 0);
});

test('checkout creation sends configured product, success_url, and metadata using mode endpoint', async t => {
  const s = setup(t, { mode: 'test', apiKey: 'creem_test_key' });
  const handler = s.load('functions/api/creem-create-checkout.ts').onRequestPost;
  const res = await handler({
    env: s.env,
    request: new Request('https://devsnapkit.com/api/creem-create-checkout', { method: 'POST' }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: checkoutId, checkoutUrl: `https://checkout.creem.io/${checkoutId}` });
  const req = s.calls.find(c => c.url === 'https://test-api.creem.io/v1/checkouts');
  assert.ok(req);
  assert.equal(req.headers['x-api-key'], 'creem_test_key');
  const body = JSON.parse(req.body);
  assert.equal(body.product_id, productId);
  assert.equal(body.success_url, 'https://devsnapkit.com/?editor=1&creem_return=1');
  assert.equal(body.metadata.referenceId, proPricing.referenceId);
  assert.equal(body.metadata.amount, proPricing.amount);
  assert.equal(body.metadata.currency, proPricing.currency);
  assert.ok(body.request_id);
  assert.equal(s.count(), 0);
});

test('admin stats exclude Creem test mode orders and PayPal sandbox orders while keeping them claimable', async t => {
  const s = setup(t, { mode: 'test', apiKey: 'creem_test_key' });
  const testCheckout = canonicalCheckout();
  testCheckout.mode = 'test';
  testCheckout.customer.email = 'tester@example.com';

  const { fulfillOrder } = s.load('functions/lib/creem.ts');
  const testRecord = await fulfillOrder(s.env, testCheckout);

  // Legacy PayPal sandbox order
  s.sql.prepare(
    "INSERT INTO orders (order_id, txn_id, payer_email, amount, currency, status, license_key, created_at, raw_payload) VALUES (?, ?, ?, ?, 'USD', 'COMPLETED', ?, ?, ?)"
  ).run('PAYPAL_SANDBOX_1', '10F119622N91', 'sb-47rzbb53078110@personal.example.com', '9.90', 'DSK-1111-2222-3333', '2026-11-12T09:59:00Z', '{}');

  // Real live order
  s.sql.prepare(
    "INSERT INTO orders (order_id, txn_id, payer_email, amount, currency, status, license_key, created_at, raw_payload) VALUES (?, ?, ?, ?, 'USD', 'COMPLETED', ?, ?, ?)"
  ).run('PAYPAL_REAL_1', '55152330YF21', 'jackeeyu520@gmail.com', '1.00', 'DSK-9B88-AAAA-BBBB', '2026-10-23T15:41:42Z', '{"mode":"live"}');

  // Test order remains claimable for QA testing
  const claimRes = await s.load('functions/api/claim-license.ts').onRequestPost({
    env: s.env,
    request: new Request('https://qa.invalid/api/claim-license', {
      method: 'POST',
      body: JSON.stringify({ orderId: testCheckout.id }),
    }),
  });
  assert.equal(claimRes.status, 200);
  assert.equal((await claimRes.json()).licenseKey, testRecord.licenseKey);

  // Admin stats only count and list the real live order
  const adminSecret = 'admin-secret-for-stats-test-at-least-32-chars';
  const { createAdminToken } = s.load('functions/lib/security.ts');
  const token = await createAdminToken(adminSecret);
  const statsRes = await s.load('functions/api/admin/stats.ts').onRequestGet({
    env: { ...s.env, ADMIN_SECRET: adminSecret },
    request: new Request('https://devsnapkit.com/api/admin/stats?refresh=1', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  });
  assert.equal(statsRes.status, 200);
  const stats = await statsRes.json();
  assert.equal(stats.overview.totalOrders, 1);
  assert.equal(stats.overview.totalRevenue, 1);
  assert.equal(stats.recentOrders.length, 1);
  assert.equal(stats.recentOrders[0].payerEmail, 'jackeeyu520@gmail.com');
});

test('telemetry skips checkout_click when CREEM_MODE is test', async t => {
  const s = setup(t, { mode: 'test', apiKey: 'creem_test_key' });
  const res = await s.load('functions/api/telemetry/event.ts').onRequestPost({
    env: s.env,
    request: new Request('https://devsnapkit.com/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'checkout_click', sessionId: 'sess_test_1', path: '/?editor=1' }),
    }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, skipped: 'test_mode' });
  assert.equal(s.sql.prepare('SELECT COUNT(*) n FROM events').get().n, 0);
});

test('preview test mode without D1 binding creates checkout, verifies payment, and claims license without writing to DB', async t => {
  const s = setup(t, { mode: 'test', apiKey: 'creem_test_key' });
  const noDbEnv = { ...s.env };
  delete noDbEnv.DB;

  const createRes = await s.load('functions/api/creem-create-checkout.ts').onRequestPost({
    env: noDbEnv,
    request: new Request('https://creem-test.devsnapkit.pages.dev/api/creem-create-checkout', { method: 'POST' }),
  });
  assert.equal(createRes.status, 200);
  const created = await createRes.json();
  assert.equal(created.id, checkoutId);

  const verifyRes = await s.verifyCheckout(noDbEnv, checkoutId);
  assert.equal(verifyRes.status, 200);
  const verified = await verifyRes.json();
  assert.equal(verified.success, true);
  assert.match(verified.licenseKey, /^DSK-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);

  const webhookRes = await s.webhook(eventPayload(), undefined, noDbEnv);
  assert.equal(webhookRes.status, 200);

  // Clear in-memory cache on this test's module instance to verify stateless Test Mode claim fallback via Creem API
  const claimMod = s.load('functions/api/claim-license.ts');
  claimMod.confirmedTransactions.clear();
  const claimRes = await claimMod.onRequestPost({
    env: noDbEnv,
    request: new Request('https://creem-test.devsnapkit.pages.dev/api/claim-license', {
      method: 'POST',
      body: JSON.stringify({ orderId: checkoutId }),
    }),
  });
  assert.equal(claimRes.status, 200);
  assert.equal((await claimRes.json()).licenseKey, verified.licenseKey);

  // Also verify claiming by ord_ and tran_ produces the exact same license key
  for (const lookupId of [orderId, 'tran_x7G5R2aujLyKVsqtWF6RD', checkoutId]) {
    claimMod.confirmedTransactions.clear();
    const res = await claimMod.onRequestPost({
      env: noDbEnv,
      request: new Request('https://creem-test.devsnapkit.pages.dev/api/claim-license', {
        method: 'POST',
        body: JSON.stringify({ orderId: lookupId }),
      }),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).licenseKey, verified.licenseKey);
  }
  assert.equal(s.count(), 0);
  assert.equal(s.notifications(), 0);
});

test('real Creem order payload with amount_due equal to order total or null fields is accepted', async t => {
  const amountCents = Math.round(Number(proPricing.amount) * 100);
  for (const mutate of [
    c => { c.order.amount_due = amountCents; c.order.amount_paid = amountCents; c.order.tax_amount = 0; c.order.discount_amount = 0; },
    c => { c.order.amount_due = null; c.order.amount_paid = null; c.order.sub_total = null; c.order.tax_amount = null; },
    c => {
      c.order.amount = amountCents;
      c.order.sub_total = amountCents;
      c.order.tax_amount = 198;
      c.order.discount_amount = 0;
      c.order.amount_due = amountCents + 198;
      c.order.amount_paid = amountCents + 198;
    },
    c => {
      // Tax-inclusive product (e.g. $9.90 total with VAT included inside the price)
      const includedTax = 165;
      c.order.amount = amountCents;
      c.order.sub_total = amountCents - includedTax;
      c.order.tax_amount = includedTax;
      c.order.discount_amount = 0;
      c.order.amount_due = amountCents;
      c.order.amount_paid = amountCents;
    },
  ]) {
    const checkout = canonicalCheckout();
    mutate(checkout);
    const s = setup(t, { checkout });
    const res = await s.verifyCheckout();
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.match(data.licenseKey, /^DSK-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
    const row = s.sql.prepare('SELECT amount FROM orders').get();
    assert.equal(row.amount, proPricing.amount);
  }
});

test('verify-checkout rejects partial payment when amount_paid is less than amount_due', async t => {
  const amountCents = Math.round(Number(proPricing.amount) * 100);
  const checkout = canonicalCheckout();
  checkout.order.amount_due = amountCents;
  checkout.order.amount_paid = Math.floor(amountCents / 2);
  const s = setup(t, { checkout });
  assert.equal((await s.verifyCheckout()).status, 422);
  assert.equal(s.count(), 0);
});

test('verify-checkout verifies paid ord_ and tran_ IDs and falls back to orderId when checkout is still pending', async t => {
  const pendingCheckout = canonicalCheckout('pending', 'pending');
  const s = setup(t, { checkout: pendingCheckout });

  // Fallback to orderId when checkoutId is still pending
  const fallbackRes = await s.load('functions/api/creem-verify-checkout.ts').onRequestPost({
    env: s.env,
    request: new Request('https://qa.invalid/api/creem-verify-checkout', {
      method: 'POST',
      body: JSON.stringify({ checkoutId, orderId }),
    }),
  });
  assert.equal(fallbackRes.status, 200);
  const fallbackData = await fallbackRes.json();
  assert.equal(fallbackData.success, true);

  // Direct ord_ verification yields the exact same key
  const ordRes = await s.verifyCheckout(s.env, orderId);
  assert.equal(ordRes.status, 200);
  assert.equal((await ordRes.json()).licenseKey, fallbackData.licenseKey);

  // Direct tran_ verification yields the exact same key
  const tranRes = await s.verifyCheckout(s.env, 'tran_x7G5R2aujLyKVsqtWF6RD');
  assert.equal(tranRes.status, 200);
  assert.equal((await tranRes.json()).licenseKey, fallbackData.licenseKey);
});

test('verify-checkout rejects refunded order transactions with 422', async t => {
  const amountCents = Math.round(Number(proPricing.amount) * 100);
  const s = setup(t, {
    transactionSearch: {
      items: [
        {
          id: 'tran_x7G5R2aujLyKVsqtWF6RD',
          object: 'transaction',
          amount: amountCents,
          amount_paid: amountCents,
          currency: proPricing.currency,
          type: 'payment',
          tax_amount: 0,
          status: 'paid',
          refunded_amount: amountCents,
          order: orderId,
        },
      ],
    },
  });
  assert.equal((await s.verifyCheckout(s.env, orderId)).status, 422);
  assert.equal(s.count(), 0);
});
