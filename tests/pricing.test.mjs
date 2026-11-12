import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url), ts = require('typescript');
const root = fileURLToPath(new URL('../', import.meta.url));
const secret = 'pricing-test-only-secret-at-least-32-characters';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const changedAt = '2030-04-05T12:00:00Z';
const priceChange = Date.parse(changedAt);
const expiry = priceChange + 24 * 60 * 60 * 1000;
const priceEnv = { PRICE_CHANGED_AT: changedAt };
function loader(pricingOverride = {}, now = Date.now) {
  class ClockDate extends Date { static now() { return now(); } }
  const cache = new Map();
  function load(file) {
    let filename = path.resolve(root, file);
    if (!path.extname(filename)) filename = ['.ts', '.tsx'].map(ext => filename + ext).find(fs.existsSync);
    assert.ok(filename && fs.existsSync(filename), `Expected shared pricing implementation: ${file}`);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} }; cache.set(filename, mod);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    new Function('require', 'module', 'exports', 'Date', code)(name => name.startsWith('.')
      ? load(path.resolve(path.dirname(filename), name)) : require(name), mod, mod.exports, ClockDate);
    if (filename === path.join(root, 'shared/pricing.ts')) {
      mod.exports.proPricing = { ...mod.exports.proPricing, ...pricingOverride };
    }
    return mod.exports;
  }
  return load;
}
function database(t) {
  const sql = new DatabaseSync(':memory:'); sql.exec(read('d1/schema.sql')); t.after(() => sql.close());
  return { sql, DB: { prepare(query) {
    let args = [];
    return { bind(...values) { args = values; return this; },
      async first() { return sql.prepare(query).get(...args) || null; },
      async all() { return { results: sql.prepare(query).all(...args) }; },
      async run() { return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } }; },
    };
  } } };
}
function order(amount = loader()('shared/pricing.ts').proPricing.amount) {
  return { id: 'ORDER1234567890123', intent: 'CAPTURE', status: 'COMPLETED',
    purchase_units: [{ reference_id: 'DSK_PRO_LIFETIME', description: 'DevSnapKit Pro Lifetime Pass',
      amount: { currency_code: 'USD', value: amount }, payee: { merchant_id: 'OUR-MERCHANT' },
      payments: { captures: [{ id: 'CAPTURE12345678901', status: 'COMPLETED', final_capture: true,
        amount: { currency_code: 'USD', value: amount }, payee: { merchant_id: 'OUR-MERCHANT' } }] } }],
  };
}

test('one config defines the early-bird offer, 24-hour grace period and stable product identity', () => {
  const { proPricing } = loader()('shared/pricing.ts');
  assert.equal(proPricing.amount, '9.90'); assert.equal(proPricing.currency, 'USD');
  assert.deepEqual(proPricing.previousPrice, { amount: '1.00', graceHours: 24 });
  assert.equal('acceptedAmounts' in proPricing, false);
  assert.equal(proPricing.displayPrice, '$9.9'); assert.equal('compareAtPrice' in proPricing, false);
  assert.equal(proPricing.productName, 'DevSnapKit Pro');
  assert.equal(proPricing.description, 'DevSnapKit Pro Lifetime Pass');
  assert.equal(proPricing.referenceId, 'DSK_PRO_LIFETIME');
});

test('the previous price expires 24 hours after the deployment timestamp', () => {
  for (const timestamp of [changedAt, '2032-08-09T01:02:03.456Z', '2032-08-09T01:02:03+00:00']) {
    const start = Date.parse(timestamp), end = start + 24 * 60 * 60 * 1000;
    for (const now of [start, end - 1, end, end + 1]) {
      const { validatePurchase } = loader({}, () => now)('functions/lib/paypal.ts');
      const env = { PRICE_CHANGED_AT: timestamp };
      assert.doesNotThrow(() => validatePurchase(order('9.90'), env));
      assert.throws(() => validatePurchase(order('0.01'), env), error => error.status === 422);
      if (now < end) assert.doesNotThrow(() => validatePurchase(order('1.00'), env));
      else assert.throws(() => validatePurchase(order('1.00'), env), error => error.status === 422);
    }
  }
});

for (const timestamp of [undefined, '', 'invalid', '0', '2030-04-05', '2030-04-05T12:00:00',
  '2030-04-05T12:00:00+01:00', '2030-02-30T12:00:00Z']) {
  test(`missing/invalid PRICE_CHANGED_AT ${JSON.stringify(timestamp)} fails closed and warns`, t => {
    const warnings = [];
    t.mock.method(console, 'warn', message => warnings.push(message));
    const { validatePurchase } = loader({}, () => priceChange)('functions/lib/paypal.ts');
    const env = { PRICE_CHANGED_AT: timestamp };
    assert.throws(() => validatePurchase(order('1.00'), env), error => error.status === 422);
    assert.ok(warnings.some(message => /PRICE_CHANGED_AT/.test(message)));
    assert.doesNotThrow(() => validatePurchase(order('9.90'), env));
    assert.throws(() => validatePurchase(order('0.01'), env), error => error.status === 422);
  });
}

test('public copy and structured offers advertise the configured price without retired Pro prices', () => {
  const { proPricing } = loader()('shared/pricing.ts');
  const files = ['index.html'];
  function scan(dir) {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) scan(file);
      else if (/\.(?:tsx?|jsx?|json|html|md|mjs)$/.test(file)) files.push(file);
    }
  }
  for (const dir of ['public', 'src', 'functions', 'scripts']) scan(dir);
  for (const file of files) assert.doesNotMatch(read(file), /\$(?:1(?:\.00)?|29)(?![\d.])/, file);
  const html = read('index.html');
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const paidOffer = schema.offers.find(offer => offer.price !== '0');
  assert.equal(paidOffer.price, proPricing.amount);
  assert.equal(paidOffer.priceCurrency, proPricing.currency);
  assert.ok(html.includes(proPricing.displayPrice));
});

test('src and functions contain no duplicate Pro price literals or identifiers', () => {
  const offenders = [];
  function scan(dir) {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) scan(file);
      else if (/\.(?:tsx?|jsx?|css|json|html)$/.test(file)) {
        // Ignore unrelated sample-dashboard amounts such as $142,850.00 and -$15.00.
        const matches = read(file).match(/(?<![\d.])1\.00(?![\d.])|\$(?:1|29)(?![\d.,])|DSK_PRO_LIFETIME|DevSnapKit Pro Lifetime Pass/g);
        // Legal licensing terms retain their independently authored product name.
        if (matches && file !== 'src/legal/legalContent.json') offenders.push({ file, matches });
      }
    }
  }
  scan('src'); scan('functions'); assert.deepEqual(offenders, []);
});

test('order creation and copy read changed values from the shared config', async t => {
  const load = loader({ amount: '7.50', displayPrice: '$7.50', description: 'Configured pass' });
  const { DB } = database(t); const original = globalThis.fetch; let body;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'test-token' });
    body = JSON.parse(init.body); return Response.json({ id: 'ORDER1234567890123' });
  };
  t.after(() => { globalThis.fetch = original; });
  const response = await load('functions/api/paypal-create-order.ts').onRequestPost({
    env: { DB, DSK_SERVER_SECRET: secret, PAYPAL_CLIENT_ID: 'test', PAYPAL_CLIENT_SECRET: 'test' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(body.purchase_units[0], { reference_id: 'DSK_PRO_LIFETIME', description: 'Configured pass',
    amount: { value: '7.50', currency_code: 'USD' } });
  const { productCopy } = load('src/productCopy.ts');
  assert.equal(productCopy.price, 'One-time payment of $7.50 USD. Lifetime Pro access. No recurring subscriptions.');
  assert.match(productCopy.tooltip, /\$7\.50 lifetime/);
  const app = read('src/App.tsx');
  assert.match(app, /className="pro-price">\{proPricing\.displayPrice\}/);
  assert.match(app, /<ProPrice\s*\/>/);
  assert.match(app, /currency=\$\{(?:encodeURIComponent\()?proPricing\.currency/);
});

test('admin defaults use config while recorded historical amounts are preserved', async t => {
  const load = loader({ amount: '7.50' }); const { DB, sql } = database(t);
  sql.prepare("INSERT INTO orders (order_id, txn_id, amount, currency, status) VALUES (?, ?, ?, ?, 'COMPLETED')")
    .run('MISSING', 'MISSING-TXN', '', '');
  sql.prepare("INSERT INTO orders (order_id, txn_id, amount, currency, status) VALUES (?, ?, ?, ?, 'COMPLETED')")
    .run('HISTORICAL', 'OLD-TXN', '2.00', 'USD');
  const { createAdminToken } = load('functions/lib/security.ts');
  const token = await createAdminToken(secret);
  const response = await load('functions/api/admin/stats.ts').onRequestGet({ env: { DB, ADMIN_SECRET: secret },
    request: new Request('https://qa.invalid', { headers: { Authorization: `Bearer ${token}` } }) });
  assert.equal(response.status, 200); const data = await response.json();
  assert.equal(data.recentOrders.find(o => o.orderId === 'MISSING').amount, '7.50');
  assert.equal(data.recentOrders.find(o => o.orderId === 'MISSING').currency, 'USD');
  assert.equal(data.recentOrders.find(o => o.orderId === 'HISTORICAL').amount, '2.00');
});

for (const [configured, purchased, captured] of [['1.00', '7.50', '7.50'], ['7.50', '1.00', '01.0']]) {
  test(`fulfillment accepts previous ${purchased} before expiry after config becomes ${configured} and keeps license activation`, async t => {
    const load = loader({ amount: configured, previousPrice: { amount: purchased, graceHours: 24 } }, () => expiry - 1);
    const { DB, sql } = database(t);
    const purchase = order(purchased); purchase.purchase_units[0].payments.captures[0].amount.value = captured;
    assert.equal(load('functions/lib/paypal.ts').validatePurchase(purchase, priceEnv), purchase.purchase_units[0]);
    const result = await load('functions/lib/paypal.ts').fulfillOrder({ ...priceEnv, DB, DSK_SERVER_SECRET: secret }, purchase);
    assert.equal(result.amount, captured); assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n, 1);
    const response = await load('functions/api/verify-license.ts').onRequestPost({ env: { DSK_SERVER_SECRET: secret },
      request: new Request('https://qa.invalid', { method: 'POST', body: JSON.stringify({ licenseKey: result.licenseKey }) }) });
    assert.equal((await response.json()).valid, true);
  });
}

for (const [name, now, timestamp] of [
  ['at expiry', expiry, changedAt],
  ['after expiry', expiry + 1, changedAt],
  ['with a missing timestamp', priceChange, undefined],
  ['with an invalid timestamp', priceChange, 'invalid'],
]) {
  test(`previous price is rejected ${name} without persisting a license`, async t => {
    const load = loader({ amount: '7.50' }, () => now);
    const { DB, sql } = database(t); const purchase = order('1.00');
    const env = { DB, DSK_SERVER_SECRET: secret, PRICE_CHANGED_AT: timestamp };
    const { validatePurchase, fulfillOrder } = load('functions/lib/paypal.ts');
    assert.throws(() => validatePurchase(purchase, env), error => error.status === 422);
    await assert.rejects(() => fulfillOrder(env, purchase), error => error.status === 422);
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
  });
}

test('current price remains accepted after the previous price expires', async t => {
  const load = loader({ amount: '7.50' }, () => expiry + 1);
  const { DB } = database(t); const purchase = order('7.50');
  const { validatePurchase, fulfillOrder } = load('functions/lib/paypal.ts');
  assert.equal(validatePurchase(purchase, priceEnv), purchase.purchase_units[0]);
  assert.equal((await fulfillOrder({ ...priceEnv, DB, DSK_SERVER_SECRET: secret }, purchase)).amount, '7.50');
});

for (const [name, mutate] of [
  ['unaccepted one-cent order with matching capture', o => {
    o.purchase_units[0].amount.value = '0.01'; o.purchase_units[0].payments.captures[0].amount.value = '0.01';
  }],
  ['capture amount', o => { o.purchase_units[0].payments.captures[0].amount.value = '0.01'; }],
  ['order currency', o => { o.purchase_units[0].amount.currency_code = 'EUR'; }],
  ['capture currency', o => { o.purchase_units[0].payments.captures[0].amount.currency_code = 'EUR'; }],
  ['product identifier', o => { o.purchase_units[0].reference_id = 'OTHER_PRODUCT'; }],
  ['incomplete order', o => { o.status = 'APPROVED'; }],
  ['pending capture', o => { o.purchase_units[0].payments.captures[0].status = 'PENDING'; }],
  ['nonfinal capture', o => { o.purchase_units[0].payments.captures[0].final_capture = false; }],
  ['payee mismatch', o => { o.purchase_units[0].payments.captures[0].payee.merchant_id = 'OTHER'; }],
  ['missing merchant', o => { delete o.purchase_units[0].payee; }],
  ['multiple captures', o => { o.purchase_units[0].payments.captures.push(o.purchase_units[0].payments.captures[0]); }],
  ['multiple units', o => { o.purchase_units.push(o.purchase_units[0]); }],
  ...['0.00', '-1.00', 'NaN', '1e2', '7.501', '', 7.5, '7.50\n', ' 7.50', '7.50 '].map(value => [`invalid amount ${JSON.stringify(value)}`, o => {
    o.purchase_units[0].amount.value = value; o.purchase_units[0].payments.captures[0].amount.value = value;
  }]),
]) {
  test(`fulfillment rejects ${name} without persisting a license`, async t => {
    const load = loader(); const { DB, sql } = database(t); const purchase = order(); mutate(purchase);
    await assert.rejects(() => load('functions/lib/paypal.ts').fulfillOrder({ DB, DSK_SERVER_SECRET: secret }, purchase),
      error => error.status === 422);
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
  });
}

test('purchase validation compares current amounts in cents and rejects unaccepted positive prices', () => {
  const { validatePurchase } = loader()('functions/lib/paypal.ts');
  for (const amount of ['9.9', '9.90', '09.90']) assert.doesNotThrow(() => validatePurchase(order(amount), {}));
  for (const amount of ['0.01', '7.50']) assert.throws(() => validatePurchase(order(amount), {}), error => error.status === 422);
});

for (const endpoint of ['paypal-capture-order', 'paypal-webhook', 'paypal-ipn']) {
  for (const [name, now, timestamp, purchased, captured, expected] of [
    ['previous price before expiry', expiry - 1, changedAt, '1.00', '01.0', 200],
    ['previous price at expiry', expiry, changedAt, '1.00', '1.00', 422],
    ['previous price after expiry', expiry + 1, changedAt, '1.00', '1.00', 422],
    ['previous price with missing timestamp', priceChange, undefined, '1.00', '1.00', 422],
    ['previous price with invalid timestamp', priceChange, 'invalid', '1.00', '1.00', 422],
    ...[changedAt, undefined, 'invalid'].flatMap(timestamp => [
      [`current price with timestamp ${timestamp}`, expiry + 1, timestamp, '9.90', '9.90', 200],
      [`one-cent order with timestamp ${timestamp}`, priceChange, timestamp, '0.01', '0.01', 422],
    ]),
    ['mismatched capture at another accepted price', expiry - 1, changedAt, '9.90', '1.00', 422],
  ]) {
    test(`${endpoint} validates ${name} before making a license claimable`, async t => {
      const load = loader({}, () => now); const { DB, sql } = database(t);
      const purchase = order(purchased), unit = purchase.purchase_units[0], capture = unit.payments.captures[0];
      capture.amount.value = captured;
      const kv = new Map(); const original = globalThis.fetch;
      globalThis.fetch = async url => {
        url = String(url);
        if (url === 'https://ipnpb.paypal.com/cgi-bin/webscr') return new Response('VERIFIED');
        if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'test-token' });
        if (url.endsWith('/verify-webhook-signature')) return Response.json({ verification_status: 'SUCCESS' });
        if (url.endsWith(`/v2/payments/captures/${capture.id}`)) return Response.json({
          ...capture, supplementary_data: { related_ids: { order_id: purchase.id } },
        });
        if (url.endsWith(`/v2/checkout/orders/${purchase.id}`)) return Response.json(purchase);
        throw new Error(`Unexpected provider request: ${url}`);
      };
      t.after(() => { globalThis.fetch = original; });
      const env = { DB, DSK_SERVER_SECRET: secret, PRICE_CHANGED_AT: timestamp, PAYPAL_CLIENT_ID: 'test', PAYPAL_CLIENT_SECRET: 'test',
        PAYPAL_WEBHOOK_ID: 'test-webhook', DSK_ORDERS: { async put(key, value) { kv.set(key, value); },
          async get(key) { return kv.get(key) || null; } } };
      const body = endpoint === 'paypal-capture-order' ? JSON.stringify({ orderId: purchase.id }) : endpoint === 'paypal-ipn'
        ? new URLSearchParams({ payment_status: 'Completed', txn_id: capture.id, mc_gross: captured, mc_currency: 'USD' }).toString()
        : JSON.stringify({ id: 'EVENT-TEST', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {
          id: capture.id, supplementary_data: { related_ids: { order_id: purchase.id } },
        } });
      const headers = Object.fromEntries(['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id',
        'paypal-transmission-sig', 'paypal-transmission-time'].map(name => [name, 'test']));
      const response = await load(`functions/api/${endpoint}.ts`).onRequestPost({ env,
        request: new Request(`https://qa.invalid/api/${endpoint}`, { method: 'POST', headers, body }) });
      assert.equal(response.status, expected);
      assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n, expected === 200 ? 1 : 0);
      const claim = await load('functions/api/claim-license.ts').onRequestPost({ env,
        request: new Request('https://qa.invalid/api/claim-license', { method: 'POST', body: JSON.stringify({ orderId: capture.id }) }) });
      assert.equal(claim.status, expected === 200 ? 200 : 403);
    });
  }
}

test('Pro prices show a readable early-bird label and never show a strikethrough or deadline', () => {
  const load = loader(); const { ProPrice } = load('src/ProPrice.tsx');
  const markup = renderToStaticMarkup(createElement(ProPrice));
  assert.ok(markup.includes(load('shared/pricing.ts').proPricing.displayPrice));
  assert.match(markup, /text-slate-300[^>]*>Early bird<\/span>/);
  assert.doesNotMatch(markup, /line-through|<s[ >]|<del[ >]|deadline|2026-/i);
  const configured = renderToStaticMarkup(createElement(ProPrice, { pricing: { displayPrice: '$7.50' } }));
  assert.ok(configured.includes('$7.50'));
  const app = read('src/App.tsx');
  assert.match(app, /className="pro-early-bird">Early bird<\/span>/);
});
