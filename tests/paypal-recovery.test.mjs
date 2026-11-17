import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load() {
  const file = path.join(root, 'src/paypalCheckout.ts');
  assert.ok(fs.existsSync(file), 'Checkout recovery module must exist');
  const mod = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(mod, mod.exports);
  return mod.exports;
}
test('webhook-completed payment is recovered after pending claim responses', async () => {
  const { recoverPayPalLicense } = load(); let count = 0;
  const key = await recoverPayPalLicense('ORDER1234567890123', new AbortController().signal, {
    fetch: async url => url === '/api/paypal-capture-order' ? Response.json({ success: false, pending: true }, { status: 202 })
      : ++count < 3 ? Response.json({ success: false }, { status: 403 })
      : Response.json({ success: true, licenseKey: 'DSK-AAAA-BBBB-CCCC' }),
    wait: async () => {}, attempts: 4,
  });
  assert.equal(key, 'DSK-AAAA-BBBB-CCCC'); assert.equal(count, 3);
});
test('an unverified purchase cannot become unlocked after retries', async () => {
  const { recoverPayPalLicense } = load(); let count = 0;
  const key = await recoverPayPalLicense('ORDER1234567890123', new AbortController().signal, {
    fetch: async url => { if (url === '/api/claim-license') count++; return Response.json({ success: false }, { status: 403 }); },
    wait: async () => {}, attempts: 3,
  });
  assert.equal(key, null); assert.equal(count, 3);
});
test('aborted or invalid recovery never makes a request', async () => {
  const { recoverPayPalLicense } = load(); const controller = new AbortController(); controller.abort();
  let count = 0; const options = { fetch: async () => { count++; throw new Error('must not request'); }, wait: async () => {} };
  assert.equal(await recoverPayPalLicense('ORDER1234567890123', controller.signal, options), null);
  assert.equal(await recoverPayPalLicense('not an order', new AbortController().signal, options), null); assert.equal(count, 0);
});
test('storage failures do not prevent a verified license success dialog', () => {
  const { rememberPendingOrder, readPendingOrder, savePurchasedLicense } = load();
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.doesNotThrow(() => rememberPendingOrder('ORDER1234567890123', storage));
  assert.equal(readPendingOrder(storage), ''); assert.doesNotThrow(() => savePurchasedLicense('DSK-AAAA-BBBB-CCCC', storage));
});
test('unfinished order survives reload and is cleared only when fulfilled', () => {
  const { rememberPendingOrder, readPendingOrder, savePurchasedLicense } = load(); const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  rememberPendingOrder('ORDER1234567890123', storage); assert.equal(readPendingOrder(storage), 'ORDER1234567890123');
  savePurchasedLicense('DSK-AAAA-BBBB-CCCC', storage); assert.equal(readPendingOrder(storage), '');
  assert.equal(data.get('devsnapkit_license_key'), 'DSK-AAAA-BBBB-CCCC');
});
test('a browser that denies access to localStorage itself does not break recovery', () => {
  const { readPendingOrder, rememberPendingOrder, savePurchasedLicense } = load();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage denied'); } });
  try {
    assert.equal(readPendingOrder(), '');
    assert.doesNotThrow(() => rememberPendingOrder('ORDER1234567890123'));
    assert.doesNotThrow(() => savePurchasedLicense('DSK-AAAA-BBBB-CCCC'));
  } finally { delete globalThis.localStorage; }
});

test('checking a pending order recovers a completed purchase through server capture', async () => {
  const { checkPendingPayPalOrder } = load();
  assert.equal(typeof checkPendingPayPalOrder, 'function');
  const signal = new AbortController().signal;
  const result = await checkPendingPayPalOrder('ORDER1234567890123', signal, {
    fetch: async (url, init) => {
      assert.equal(url, '/api/paypal-capture-order');
      assert.equal(init.method, 'POST');
      assert.equal(init.signal, signal);
      assert.deepEqual(JSON.parse(init.body), { orderId: 'ORDER1234567890123' });
      return Response.json({ success: true, status: 'COMPLETED', licenseKey: 'DSK-AAAA-BBBB-CCCC' });
    },
  });
  assert.deepEqual(result, { status: 'paid', licenseKey: 'DSK-AAAA-BBBB-CCCC' });
});

for (const [name, status, body] of [
  ['expired order', 202, { success: false, terminalUnpaid: true, unpaid: true, pending: false, status: 'EXPIRED' }],
  ['voided order', 202, { success: false, terminalUnpaid: true, unpaid: true, pending: false, status: 'VOIDED' }],
]) {
  test('checking a pending order allows discarding a server-confirmed ' + name, async () => {
    const { checkPendingPayPalOrder } = load();
    assert.equal(typeof checkPendingPayPalOrder, 'function');
    assert.deepEqual(await checkPendingPayPalOrder('ORDER1234567890123', new AbortController().signal, {
      fetch: async () => Response.json(body, { status }),
    }), { status: 'unpaid' });
  });
}

for (const [name, response] of [
  ['unapproved order', () => Response.json({ success: false, unpaid: true, pending: false, status: 'CREATED' }, { status: 202 })],
  ['unverified order', () => Response.json({ success: false }, { status: 403 })],
  ['nonmatching order', () => Response.json({ success: false }, { status: 422 })],
  ['unverified terminal marker', () => Response.json({ success: false, terminalUnpaid: true, status: 'VOIDED' }, { status: 422 })],
  ['contradictory terminal marker', () => Response.json({ success: false, terminalUnpaid: true, pending: true, status: 'VOIDED' }, { status: 202 })],
  ['nonterminal marker', () => Response.json({ success: false, terminalUnpaid: true, unpaid: true, pending: false, status: 'APPROVED' }, { status: 202 })],
  ['network error', () => { throw new TypeError('Failed to fetch'); }],
  ['server failure', () => Response.json({ success: false, unpaid: true }, { status: 503 })],
  ['pending capture', () => Response.json({ success: false, pending: true }, { status: 202 })],
  ['missing license', () => Response.json({ success: true, status: 'COMPLETED' })],
  ['invalid license', () => Response.json({ success: true, licenseKey: 'unverified' })],
  ['unknown result', () => Response.json({ success: false })],
  ['invalid JSON', () => new Response('unavailable')],
  ['rate limit', () => Response.json({ success: false }, { status: 429 })],
]) {
  test('checking a pending order keeps it for retry after ' + name, async () => {
    const { checkPendingPayPalOrder } = load();
    assert.equal(typeof checkPendingPayPalOrder, 'function');
    assert.deepEqual(await checkPendingPayPalOrder('ORDER1234567890123', new AbortController().signal, {
      fetch: async () => response(),
    }), { status: 'retry' });
  });
}

test('invalid or aborted status checks cannot authorize discarding an order', async () => {
  const { checkPendingPayPalOrder } = load();
  assert.equal(typeof checkPendingPayPalOrder, 'function');
  const controller = new AbortController(); controller.abort();
  let count = 0;
  const options = { fetch: async () => { count++; return Response.json({ unpaid: true }); } };
  assert.deepEqual(await checkPendingPayPalOrder('ORDER1234567890123', controller.signal, options), { status: 'retry' });
  assert.deepEqual(await checkPendingPayPalOrder('invalid', new AbortController().signal, options), { status: 'retry' });
  assert.equal(count, 0);
});

test('a status check aborted during the request cannot authorize discarding', async () => {
  const { checkPendingPayPalOrder } = load();
  assert.equal(typeof checkPendingPayPalOrder, 'function');
  const controller = new AbortController();
  assert.deepEqual(await checkPendingPayPalOrder('ORDER1234567890123', controller.signal, {
    fetch: async () => { controller.abort(); return Response.json({ unpaid: true }, { status: 202 }); },
  }), { status: 'retry' });
});

for (const status of ['EXPIRED', 'VOIDED']) {
  test('claim polling stops early after verified terminal ' + status, async () => {
    const { recoverPayPalLicense } = load(); const calls = []; let waits = 0;
    const key = await recoverPayPalLicense('ORDER1234567890123', new AbortController().signal, {
      fetch: async url => { calls.push(url); return url === '/api/claim-license'
        ? Response.json({ success: false }, { status: 403 })
        : Response.json({ success: false, terminalUnpaid: true, unpaid: true, pending: false, status }, { status: 202 }); },
      wait: async () => { waits++; },
    });
    assert.equal(key, null);
    assert.deepEqual(calls, ['/api/claim-license', '/api/paypal-capture-order']);
    assert.equal(waits, 0);
  });
}

test('claim polling recovers a stored order after the payment tab closed before the webhook', async () => {
  const { rememberPendingOrder, readPendingOrder, recoverPayPalLicense, savePurchasedLicense } = load();
  const data = new Map(); const storage = { getItem: k => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  rememberPendingOrder('ORDER1234567890123', storage);
  const calls = [];
  const key = await recoverPayPalLicense(readPendingOrder(storage), new AbortController().signal, {
    fetch: async (url, init) => { calls.push(url); assert.equal(JSON.parse(init.body).orderId, 'ORDER1234567890123');
      return url === '/api/claim-license' ? Response.json({ success: false }, { status: 403 })
        : Response.json({ success: true, status: 'COMPLETED', licenseKey: 'DSK-AAAA-BBBB-CCCC' }); },
    wait: async () => { assert.fail('verified capture should recover immediately'); },
  });
  assert.equal(key, 'DSK-AAAA-BBBB-CCCC');
  assert.deepEqual(calls, ['/api/claim-license', '/api/paypal-capture-order']);
  savePurchasedLicense(key, storage); assert.equal(readPendingOrder(storage), '');
});

for (const [name, response] of [
  ...['CREATED', 'SAVED', 'PAYER_ACTION_REQUIRED', 'APPROVED'].map(status => [status,
    () => Response.json({ success: false, status, unpaid: true, pending: false }, { status: 202 })]),
  ...[403, 422, 429, 503].map(status => ['HTTP ' + status, () => Response.json({ success: false }, { status })]),
  ['network failure', () => { throw new TypeError('offline'); }],
  ['invalid JSON', () => new Response('unavailable')],
]) {
  test('claim polling keeps the default retry cadence after ' + name, async () => {
    const { recoverPayPalLicense } = load(); let claims = 0, checks = 0; const waits = [];
    const signal = new AbortController().signal;
    const key = await recoverPayPalLicense('ORDER1234567890123', signal, {
      fetch: async url => { if (url === '/api/claim-license') { claims++; return Response.json({ success: false }, { status: 403 }); }
        checks++; return response(); },
      wait: async (ms, actualSignal) => { waits.push(ms); assert.equal(actualSignal, signal); },
    });
    assert.equal(key, null); assert.equal(claims, 60); assert.equal(checks, 60);
    assert.deepEqual(waits, Array(59).fill(3000));
  });
}
