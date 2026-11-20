import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
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
    new Function('require', 'module', 'exports', 'Date', 'crypto', code)(name => name.startsWith('.')
      ? load(path.resolve(path.dirname(filename), name)) : require(name), mod, mod.exports, ClockDate, webcrypto);
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
  return {
    id: 'ch_1QyIQDw9cbFWdA1ry5Qc6I',
    object: 'checkout',
    status: 'completed',
    product: 'prod_test_dsk',
    metadata: { referenceId: 'DSK_PRO_LIFETIME' },
    customer: { email: 'buyer@example.test' },
    order: {
      id: 'ord_4aDwWXjMLpes4Kj4XqNnUA',
      object: 'order',
      product: 'prod_test_dsk',
      currency: 'USD',
      amount,
      amount_paid: amount,
      amount_due: 0,
      status: 'paid',
    },
  };
}

async function signCreemWebhook(rawBody, webhookSecret) {
  const enc = new TextEncoder();
  const key = await webcrypto.subtle.importKey('raw', enc.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await webcrypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
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
      const { validatePurchase } = loader({}, () => now)('functions/lib/creem.ts');
      const env = { PRICE_CHANGED_AT: timestamp };
      assert.doesNotThrow(() => validatePurchase(order('9.90'), env));
      assert.doesNotThrow(() => validatePurchase(order(990), env));
      assert.throws(() => validatePurchase(order('0.01'), env), error => error.status === 422);
      assert.throws(() => validatePurchase(order(1), env), error => error.status === 422);
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
    const { validatePurchase } = loader({}, () => priceChange)('functions/lib/creem.ts');
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
    body = JSON.parse(init.body);
    return Response.json({ id: 'ch_1QyIQDw9cbFWdA1ry5Qc6I', checkout_url: 'https://checkout.creem.io/ch_1QyIQDw9cbFWdA1ry5Qc6I' });
  };
  t.after(() => { globalThis.fetch = original; });
  const response = await load('functions/api/creem-create-checkout.ts').onRequestPost({
    request: new Request('https://devsnapkit.com/api/creem-create-checkout', { method: 'POST' }),
    env: { DB, DSK_SERVER_SECRET: secret, CREEM_API_KEY: 'creem_test_key', CREEM_PRODUCT_ID: 'prod_test_dsk', CREEM_MODE: 'test' },
  });
  assert.equal(response.status, 200);
  assert.equal(body.product_id, 'prod_test_dsk');
  assert.deepEqual(body.metadata, { referenceId: 'DSK_PRO_LIFETIME', description: 'Configured pass', amount: '7.50', currency: 'USD' });
  const { productCopy } = load('src/productCopy.ts');
  assert.equal(productCopy.price, 'One-time payment of $7.50 USD. Lifetime Pro access. No recurring subscriptions.');
  assert.match(productCopy.tooltip, /\$7\.50 lifetime/);
  const app = read('src/App.tsx');
  assert.match(app, /className="pro-price">\{proPricing\.displayPrice\}/);
  assert.match(app, /<ProPrice\s*\/>/);
  assert.match(app, /proPricing\.currency/);
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
    const purchase = order(purchased); purchase.order.amount_paid = captured;
    assert.equal(load('functions/lib/creem.ts').validatePurchase(purchase, priceEnv), purchase);
    const result = await load('functions/lib/creem.ts').fulfillOrder({ ...priceEnv, DB, DSK_SERVER_SECRET: secret }, purchase);
    assert.equal(result.amount, purchased); assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n, 1);
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
    const { validatePurchase, fulfillOrder } = load('functions/lib/creem.ts');
    assert.throws(() => validatePurchase(purchase, env), error => error.status === 422);
    await assert.rejects(() => fulfillOrder(env, purchase), error => error.status === 422);
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
  });
}

test('current price remains accepted after the previous price expires', async t => {
  const load = loader({ amount: '7.50' }, () => expiry + 1);
  const { DB } = database(t); const purchase = order('7.50');
  const { validatePurchase, fulfillOrder } = load('functions/lib/creem.ts');
  assert.equal(validatePurchase(purchase, priceEnv), purchase);
  assert.equal((await fulfillOrder({ ...priceEnv, DB, DSK_SERVER_SECRET: secret }, purchase)).amount, '7.50');
});

for (const [name, mutate] of [
  ['unaccepted one-cent order with matching payment', o => {
    o.order.amount = '0.01'; o.order.amount_paid = '0.01';
  }],
  ['mismatched amount_paid', o => { o.order.amount_paid = '0.01'; }],
  ['order currency', o => { o.order.currency = 'EUR'; }],
  ['product identifier', o => { o.product = 'OTHER_PRODUCT'; o.order.product = 'OTHER_PRODUCT'; }],
  ['metadata referenceId', o => { o.metadata.referenceId = 'OTHER_PRODUCT'; }],
  ['incomplete checkout', o => { o.status = 'pending'; }],
  ['unpaid order', o => { o.order.status = 'pending'; }],
  ['amount due remaining', o => { o.order.amount_due = 100; }],
  ...['0.00', '-1.00', 'NaN', '1e2', '7.501', '', 7.5, 0, -100, '7.50\n', ' 7.50', '7.50 '].map(value => [`invalid amount ${JSON.stringify(value)}`, o => {
    o.order.amount = value; o.order.amount_paid = value;
  }]),
]) {
  test(`fulfillment rejects ${name} without persisting a license`, async t => {
    const load = loader(); const { DB, sql } = database(t); const purchase = order(); mutate(purchase);
    await assert.rejects(() => load('functions/lib/creem.ts').fulfillOrder({ DB, DSK_SERVER_SECRET: secret, CREEM_PRODUCT_ID: 'prod_test_dsk' }, purchase),
      error => error.status === 422);
    assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n, 0);
  });
}

test('purchase validation compares current amounts in cents and rejects unaccepted positive prices', () => {
  const { validatePurchase } = loader()('functions/lib/creem.ts');
  for (const amount of ['9.9', '9.90', '09.90', 990]) assert.doesNotThrow(() => validatePurchase(order(amount), {}));
  for (const amount of ['0.01', '7.50', 1, 750]) assert.throws(() => validatePurchase(order(amount), {}), error => error.status === 422);
});

for (const endpoint of ['creem-verify-checkout', 'creem-webhook']) {
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
    ['mismatched amount_paid at another accepted price', expiry - 1, changedAt, '9.90', '1.00', 422],
  ]) {
    test(`${endpoint} validates ${name} before making a license claimable`, async t => {
      const load = loader({}, () => now); const { DB, sql } = database(t);
      const purchase = order(purchased);
      purchase.order.amount_paid = captured;
      const original = globalThis.fetch;
      globalThis.fetch = async url => {
        url = String(url);
        if (url.includes(`/v1/checkouts?checkout_id=${encodeURIComponent(purchase.id)}`)) return Response.json(purchase);
        throw new Error(`Unexpected provider request: ${url}`);
      };
      t.after(() => { globalThis.fetch = original; });
      const webhookSecret = 'whsec_pricing_test_secret_32_characters';
      const env = { DB, DSK_SERVER_SECRET: secret, PRICE_CHANGED_AT: timestamp, CREEM_API_KEY: 'creem_test_key',
        CREEM_PRODUCT_ID: 'prod_test_dsk', CREEM_WEBHOOK_SECRET: webhookSecret, CREEM_MODE: 'test' };
      const body = endpoint === 'creem-verify-checkout'
        ? JSON.stringify({ checkoutId: purchase.id })
        : JSON.stringify({ id: 'evt_test', eventType: 'checkout.completed', object: { id: purchase.id, order: { id: purchase.order.id } } });
      const headers = endpoint === 'creem-webhook'
        ? { 'content-type': 'application/json', 'creem-signature': await signCreemWebhook(body, webhookSecret) }
        : { 'content-type': 'application/json' };
      const response = await load(`functions/api/${endpoint}.ts`).onRequestPost({ env,
        request: new Request(`https://qa.invalid/api/${endpoint}`, { method: 'POST', headers, body }) });
      assert.equal(response.status, expected);
      assert.equal(sql.prepare('SELECT COUNT(*) n FROM orders').get().n, expected === 200 ? 1 : 0);
      const claim = await load('functions/api/claim-license.ts').onRequestPost({ env,
        request: new Request('https://qa.invalid/api/claim-license', { method: 'POST', body: JSON.stringify({ orderId: purchase.order.id }) }) });
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
