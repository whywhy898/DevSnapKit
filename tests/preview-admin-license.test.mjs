import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const require = createRequire(import.meta.url), ts = require('typescript');
const root = path.resolve(import.meta.dirname, '..'), cache = new Map();
function load(file) {
  const p = path.resolve(root, file);
  if (cache.has(p)) return cache.get(p).exports;
  const m = {exports: {}}; cache.set(p, m);
  const js = ts.transpileModule(fs.readFileSync(p, 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
  new Function('require', 'module', 'exports', 'crypto', js)(name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(p), name + '.ts'))) : require(name), m, m.exports, webcrypto);
  return m.exports;
}
const handler = load('functions/api/verify-license.ts').onRequestPost;
const api = load('src/license.ts');
const secret = 'qa-license-signing-secret-long-enough';
const key = 'DSK-ADMIN-' + 'A1'.repeat(32);
const origin = 'https://devsnapkit.com';
const env = {DSK_SERVER_SECRET: secret, DSK_ADMIN_PRO_KEY: key, DSK_ADMIN_PRO_ORIGINS: origin + ', https://mockup-templates-v1.devsnapkit.pages.dev'};
const post = (licenseKey = key, bindings = env, url = origin, headers = {}) => handler({request: new Request(url + '/api/verify-license', {method: 'POST', headers, body: JSON.stringify({licenseKey})}), env: bindings});

test('configured administrator credential unlocks Pro through the real backend', async () => {
  const res = await post('  ' + key.toLowerCase() + '  ');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  const data = await res.json();
  assert.equal(data.valid, true); assert.equal(data.serverVerified, true);
  assert.equal(data.tier, 'pro_lifetime'); assert.ok(data.proFeatures.includes('premium_templates'));
});
test('administrator activation does not depend on the customer signing secret', async () => {
  const {DSK_SERVER_SECRET, ...bindings} = env;
  assert.equal((await (await post(key, bindings)).json()).valid, true);
});
for (const [label, bindings] of [
  ['no administrator configuration', {DSK_SERVER_SECRET: secret}],
  ['missing key', {...env, DSK_ADMIN_PRO_KEY: undefined}],
  ['missing origins', {...env, DSK_ADMIN_PRO_ORIGINS: undefined}],
  ['weak credential', {...env, DSK_ADMIN_PRO_KEY: 'short'}],
  ['wildcard origins', {...env, DSK_ADMIN_PRO_ORIGINS: '*'}],
  ['origin containing a path', {...env, DSK_ADMIN_PRO_ORIGINS: origin + '/editor'}],
]) test('administrator fails closed: ' + label, async () => {
  const res = await post(key, bindings); const data = await res.json();
  assert.equal(data.valid, false); assert.ok(!JSON.stringify(data).includes(key));
});
for (const url of ['http://devsnapkit.com', 'https://devsnapkit.com.evil.example', 'https://other.devsnapkit.pages.dev', 'https://www.devsnapkit.com']) {
  test('exact HTTPS origin enforcement: ' + url, async () => {
    const res = await post(key, env, url, {Origin: origin, 'X-Forwarded-Host': 'devsnapkit.com'});
    assert.equal((await res.json()).valid, false);
  });
}
test('preview origin can be enabled explicitly', async () => {
  assert.equal((await (await post(key, env, 'https://mockup-templates-v1.devsnapkit.pages.dev')).json()).valid, true);
});
test('wrong and rotated credentials are denied', async () => {
  assert.equal((await (await post(key.replace(/A/g, 'B'))).json()).valid, false);
  const next = {...env, DSK_ADMIN_PRO_KEY: 'DSK-ADMIN-' + 'B2'.repeat(32)};
  assert.equal((await (await post(key, next)).json()).valid, false);
  assert.equal((await (await post(next.DSK_ADMIN_PRO_KEY, next)).json()).valid, true);
});
test('retired public preview credential is never an exception', async () => {
  const retired = ['DSK', 'BOSS', '2026', 'PRO1'].join('-');
  assert.equal((await (await post(retired, env, 'https://mockup-templates-v1.devsnapkit.pages.dev')).json()).valid, false);
});
test('customer keys remain compatible even if administrator config is invalid', async () => {
  const customer = await load('functions/lib/security.ts').generateSignedKey('QA-paid-order', secret);
  assert.equal((await (await post(customer, {...env, DSK_ADMIN_PRO_KEY: 'short'})).json()).valid, true);
  assert.equal((await (await post(customer.slice(0, -1) + (customer.endsWith('A') ? 'B' : 'A'))).json()).valid, false);
});
for (const body of [null, [], {}, {licenseKey: 123}, {licenseKey: ''}, {licenseKey: '  '}]) test('malformed body is rejected: ' + JSON.stringify(body), async () => {
  const res = await handler({request: new Request(origin, {method: 'POST', body: JSON.stringify(body)}), env});
  assert.equal(res.status, 400); assert.equal((await res.json()).valid, false);
});
test('invalid JSON and oversized keys are rejected without reflecting input', async () => {
  for (const body of ['not-json', JSON.stringify({licenseKey: 'X'.repeat(257)})]) {
    const res = await handler({request: new Request(origin, {method: 'POST', body}), env});
    assert.equal(res.status, 400); assert.equal((await res.json()).valid, false);
  }
});
test('browser always asks the backend and rejects errors or non-boolean valid flags', async () => {
  const previous = globalThis.fetch; let calls = 0;
  try {
    for (const [status, valid, expected] of [[200, true, true], [403, true, false], [503, true, false], [200, 'true', false], [200, false, false]]) {
      globalThis.fetch = async (url, options) => {
        calls++; assert.equal(url, '/api/verify-license');
        assert.equal(JSON.parse(options.body).licenseKey, key);
        return new Response(JSON.stringify({valid, tier: 'pro_lifetime'}), {status});
      };
      assert.equal((await api.verifyLicenseWithServer(key)).valid, expected);
    }
    assert.equal(calls, 5);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await api.verifyLicenseWithServer(key)).valid, false);
  } finally { globalThis.fetch = previous; }
});
test('saved local Pro flag cannot unlock a failed verification on mount', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const mount = app.slice(app.indexOf('// Check saved license status'), app.indexOf('// Check URL parameters'));
  assert.ok(!mount.includes("getItem('devsnapkit_pro_unlocked')"));
});
