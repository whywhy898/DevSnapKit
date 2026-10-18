import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts'))) : require(name);
  new Function('require', 'module', 'exports', 'crypto', js)(localRequire, module, module.exports, webcrypto);
  return module.exports;
}
const claim = load('functions/api/claim-license.ts');
const verify = load('functions/api/verify-license.ts');
const admin = load('functions/api/admin/auth.ts');
const stats = load('functions/api/admin/stats.ts');
const capture = load('functions/api/paypal-capture-order.ts');
const create = load('functions/api/paypal-create-order.ts');
const secret = 'qa-only-license-secret-32-bytes-or-longer';
const adminSecret = 'qa-only-admin-secret-32-bytes-or-longer';
const env = { DSK_SERVER_SECRET: secret, ADMIN_SECRET: adminSecret };
const post = (handler, body, bindings = env) => handler({ request: new Request('https://qa.invalid/api', { method: 'POST', body: JSON.stringify(body) }), env: bindings });
const getStats = (headers = {}, bindings = env, query = '') => stats.onRequestGet({ request: new Request('https://qa.invalid/api/admin/stats' + query, { headers }), env: bindings });
const paidDB = { prepare: () => ({ bind: () => ({ first: async () => ({ txn_id: 'CAPTURE-QA', status: 'COMPLETED', payer_email: 'buyer@example.com' }) }) }) };

for (const email of ['support@devsnapkit.com', 'whywhy898@163.com', 'buyer@example.com']) {
  test('email alone cannot claim: ' + email, async () => {
    const res = await post(claim.onRequestPost, { payerEmail: email }, { ...env, DB: paidDB });
    assert.equal(res.status, 400); assert.equal((await res.json()).success, false);
  });
}
test('unconfirmed transaction cannot claim even with founder email', async () => {
  assert.equal((await post(claim.onRequestPost, { orderId: 'UNPAID', payerEmail: 'support@devsnapkit.com' })).status, 403);
});
test('confirmed transaction signs with the configured secret and verifies', async () => {
  const res = await post(claim.onRequestPost, { orderId: 'ORDER-QA' }, { ...env, DB: paidDB });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal((await (await post(verify.onRequestPost, { licenseKey: data.licenseKey })).json()).valid, true);
});
for (const [name, handler, body, binding] of [
  ['claim', claim.onRequestPost, { orderId: 'ORDER-QA' }, { DB: paidDB }],
  ['verify', verify.onRequestPost, { licenseKey: 'DSK-AAAA-BBBB-CCCC' }, {}],
  ['admin', admin.onRequestPost, { secret: 'devsnapkit_admin_2026' }, {}],
  ['capture', capture.onRequestPost, { orderId: 'ORDER-QA' }, {}],
  ['create', create.onRequestPost, {}, {}],
]) {
  test(name + ' rejects missing configuration', async () => {
    const original = globalThis.fetch; let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response('{}'); };
    try { assert.equal((await post(handler, body, binding)).status, 503); assert.equal(calls, 0); }
    finally { globalThis.fetch = original; }
  });
}
test('stats reject missing admin configuration', async () => {
  assert.equal((await getStats({ 'x-admin-secret': 'devsnapkit_admin_2026' }, {})).status, 503);
});
test('weak configured signing secret is rejected', async () => {
  assert.equal((await post(verify.onRequestPost, { licenseKey: 'DSK-AAAA-BBBB-CCCC' }, { DSK_SERVER_SECRET: 'short' })).status, 503);
});
test('admin login rejects wrong password', async () => {
  assert.equal((await post(admin.onRequestPost, { secret: 'wrong' })).status, 401);
});
test('admin session does not contain password and authorizes stats', async () => {
  const res = await post(admin.onRequestPost, { secret: adminSecret });
  assert.equal(res.status, 200); const data = await res.json();
  assert.ok(!Buffer.from(data.token, 'base64').toString().includes(adminSecret));
  assert.equal((await getStats({ Authorization: 'Bearer ' + data.token })).status, 200);
});
test('legacy password-containing token is rejected', async () => {
  const token = Buffer.from(adminSecret + ':' + Date.now()).toString('base64');
  assert.equal((await getStats({ Authorization: 'Bearer ' + token })).status, 401);
});
test('query string and raw password headers no longer authorize stats', async () => {
  assert.equal((await getStats({ 'x-admin-secret': adminSecret })).status, 401);
  assert.equal((await getStats({}, env, '?secret=' + encodeURIComponent(adminSecret))).status, 401);
});
test('tampered token is rejected', async () => {
  const { token } = await (await post(admin.onRequestPost, { secret: adminSecret })).json();
  assert.equal((await getStats({ Authorization: 'Bearer ' + token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A') })).status, 401);
});
test('expired token is rejected', async () => {
  const { token } = await (await post(admin.onRequestPost, { secret: adminSecret })).json();
  const now = Date.now; Date.now = () => now() + 8 * 86400 * 1000;
  try { assert.equal((await getStats({ Authorization: 'Bearer ' + token })).status, 401); }
  finally { Date.now = now; }
});
test('capture issues a key accepted by configured verifier without real payment', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => String(url).includes('/oauth2/token')
    ? new Response(JSON.stringify({ access_token: 'qa-token' }))
    : new Response(JSON.stringify({ status: 'COMPLETED', payer: { email_address: 'buyer@example.com' }, purchase_units: [{ payments: { captures: [{ id: 'CAPTURE-QA', amount: { value: '1.00', currency_code: 'USD' } }] } }] }));
  try {
    const res = await post(capture.onRequestPost, { orderId: 'ORDER-QA' }, { ...env, PAYPAL_CLIENT_ID: 'qa-client', PAYPAL_CLIENT_SECRET: 'qa-secret', PAYPAL_MODE: 'sandbox' });
    assert.equal(res.status, 200); const data = await res.json();
    assert.equal((await (await post(verify.onRequestPost, { licenseKey: data.licenseKey })).json()).valid, true);
  } finally { globalThis.fetch = original; }
});

test('Order ID and Capture ID recover the same key', async () => {
  const bindings = { ...env, DB: paidDB };
  const a = await (await post(claim.onRequestPost, { orderId: 'ORDER-QA' }, bindings)).json();
  const b = await (await post(claim.onRequestPost, { orderId: 'CAPTURE-QA' }, bindings)).json();
  const expected = await claim.generateSignedKey('CAPTURE-QA', secret);
  assert.equal(a.licenseKey, expected); assert.equal(b.licenseKey, expected);
});
for (const record of ['not-json', JSON.stringify({ status: 'PENDING' }), JSON.stringify({ status: 'REFUNDED' })]) {
  test('KV presence alone is not payment proof: ' + record, async () => {
    const res = await post(claim.onRequestPost, { orderId: 'KV-UNPAID' }, { ...env, DSK_KV: { get: async () => record } });
    assert.equal(res.status, 403);
  });
}
test('completed KV purchase can recover a verifiable key', async () => {
  const res = await post(claim.onRequestPost, { orderId: 'KV-PAID' }, { ...env, DSK_KV: { get: async () => JSON.stringify({ status: 'COMPLETED', txnId: 'KV-CAPTURE' }) } });
  assert.equal(res.status, 200);
  const { licenseKey } = await res.json();
  assert.equal((await (await post(verify.onRequestPost, { licenseKey })).json()).valid, true);
});
test('license signed by another secret is rejected', async () => {
  const licenseKey = await claim.generateSignedKey('ROTATION-QA', 'another-independent-secret-32-characters');
  assert.equal((await (await post(verify.onRequestPost, { licenseKey })).json()).valid, false);
});
test('blank and short admin configuration is rejected', async () => {
  for (const value of ['   ', 'short']) {
    assert.equal((await post(admin.onRequestPost, { secret: value }, { ADMIN_SECRET: value })).status, 503);
  }
});

test('stats delete rejects unauthorized request', async () => {
  const res = await stats.onRequestDelete({ request: new Request('https://qa.invalid/api/admin/stats', { method: 'DELETE' }), env });
  assert.equal(res.status, 401);
});

test('stats delete clears D1 events and KV stats with valid admin token', async () => {
  let executedSql = '';
  const deletedKeys = [];
  const mockDB = { prepare: (sql) => ({ run: async () => { executedSql = sql; return { success: true }; } }) };
  const mockKV = {
    list: async () => ({ keys: [{ name: 'stats:2026-10-17' }, { name: 'stats:2026-10-18' }] }),
    delete: async (name) => { deletedKeys.push(name); }
  };
  const { token } = await (await post(admin.onRequestPost, { secret: adminSecret })).json();
  const res = await stats.onRequestDelete({
    request: new Request('https://qa.invalid/api/admin/stats', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token }
    }),
    env: { ...env, DB: mockDB, DSK_KV: mockKV }
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.d1Cleared, true);
  assert.equal(data.kvClearedCount, 2);
  assert.ok(executedSql.includes('DELETE FROM events'));
  assert.deepEqual(deletedKeys, ['stats:2026-10-17', 'stats:2026-10-18']);
});

