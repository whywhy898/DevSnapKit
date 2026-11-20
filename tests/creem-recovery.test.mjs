import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function load() {
  const file = path.join(root, 'src/creemCheckout.ts');
  assert.ok(fs.existsSync(file), 'Creem checkout recovery module must exist');
  const mod = { exports: {} };
  new Function(
    'module',
    'exports',
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
  )(mod, mod.exports);
  return mod.exports;
}

const checkoutId = 'ch_1QyIQDw9cbFWdA1ry5Qc6I';

test('webhook-completed payment is recovered after pending claim responses', async () => {
  const { recoverCreemLicense } = load();
  let count = 0;
  const key = await recoverCreemLicense(checkoutId, new AbortController().signal, {
    fetch: async () =>
      ++count < 3
        ? Response.json({ success: false }, { status: 403 })
        : Response.json({ success: true, licenseKey: 'DSK-AAAA-BBBB-CCCC' }),
    wait: async () => {},
    attempts: 4,
  });
  assert.equal(key, 'DSK-AAAA-BBBB-CCCC');
  assert.equal(count, 3);
});

test('an unverified purchase cannot become unlocked after retries', async () => {
  const { recoverCreemLicense } = load();
  let count = 0;
  const key = await recoverCreemLicense(checkoutId, new AbortController().signal, {
    fetch: async () => {
      count++;
      return Response.json({ success: false }, { status: 403 });
    },
    wait: async () => {},
    attempts: 3,
  });
  assert.equal(key, null);
  assert.equal(count, 3);
});

test('aborted or invalid recovery never makes a request', async () => {
  const { recoverCreemLicense } = load();
  const controller = new AbortController();
  controller.abort();
  let count = 0;
  const options = {
    fetch: async () => {
      count++;
      throw new Error('must not request');
    },
    wait: async () => {},
  };
  assert.equal(await recoverCreemLicense(checkoutId, controller.signal, options), null);
  assert.equal(await recoverCreemLicense('not an order', new AbortController().signal, options), null);
  assert.equal(count, 0);
});

test('storage failures do not prevent a verified license success dialog', () => {
  const { rememberPendingOrder, readPendingOrder, savePurchasedLicense } = load();
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.doesNotThrow(() => rememberPendingOrder(checkoutId, storage));
  assert.equal(readPendingOrder(storage), '');
  assert.doesNotThrow(() => savePurchasedLicense('DSK-AAAA-BBBB-CCCC', storage));
});

test('unfinished Creem checkout survives reload and is cleared only when fulfilled', () => {
  const { rememberPendingOrder, readPendingOrder, savePurchasedLicense } = load();
  const data = new Map();
  const storage = {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: k => data.delete(k),
  };
  rememberPendingOrder(checkoutId, storage);
  assert.equal(readPendingOrder(storage), checkoutId);
  savePurchasedLicense('DSK-AAAA-BBBB-CCCC', storage);
  assert.equal(readPendingOrder(storage), '');
  assert.equal(data.get('devsnapkit_license_key'), 'DSK-AAAA-BBBB-CCCC');
});

test('a browser that denies access to localStorage itself does not break recovery', () => {
  const { readPendingOrder, rememberPendingOrder, savePurchasedLicense } = load();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('storage denied'); },
  });
  try {
    assert.equal(readPendingOrder(), '');
    assert.doesNotThrow(() => rememberPendingOrder(checkoutId));
    assert.doesNotThrow(() => savePurchasedLicense('DSK-AAAA-BBBB-CCCC'));
  } finally {
    delete globalThis.localStorage;
  }
});

test('checking a pending checkout recovers a completed purchase through server verification', async () => {
  const { checkPendingCreemOrder } = load();
  const signal = new AbortController().signal;
  const result = await checkPendingCreemOrder(checkoutId, signal, {
    fetch: async (url, init) => {
      assert.equal(url, '/api/creem-verify-checkout');
      assert.equal(init.method, 'POST');
      assert.equal(init.signal, signal);
      assert.deepEqual(JSON.parse(init.body), { checkoutId });
      return Response.json({ success: true, status: 'COMPLETED', licenseKey: 'DSK-AAAA-BBBB-CCCC' });
    },
  });
  assert.deepEqual(result, { status: 'paid', licenseKey: 'DSK-AAAA-BBBB-CCCC' });
});

for (const [name, status, body] of [
  ['unpaid checkout', 202, { success: false, unpaid: true, pending: false }],
  ['unverified checkout', 403, { success: false }],
  ['nonmatching checkout', 422, { success: false }],
]) {
  test('checking a pending checkout allows discarding a server-confirmed ' + name, async () => {
    const { checkPendingCreemOrder } = load();
    assert.deepEqual(
      await checkPendingCreemOrder(checkoutId, new AbortController().signal, {
        fetch: async () => Response.json(body, { status }),
      }),
      { status: 'unpaid' }
    );
  });
}

for (const [name, response] of [
  ['network error', () => { throw new TypeError('Failed to fetch'); }],
  ['server failure', () => Response.json({ success: false, unpaid: true }, { status: 503 })],
  ['pending settlement', () => Response.json({ success: false, pending: true }, { status: 202 })],
  ['missing license', () => Response.json({ success: true, status: 'COMPLETED' })],
  ['invalid license', () => Response.json({ success: true, licenseKey: 'unverified' })],
  ['unknown result', () => Response.json({ success: false })],
  ['invalid JSON', () => new Response('unavailable')],
  ['rate limit', () => Response.json({ success: false }, { status: 429 })],
]) {
  test('checking a pending checkout keeps it for retry after ' + name, async () => {
    const { checkPendingCreemOrder } = load();
    assert.deepEqual(
      await checkPendingCreemOrder(checkoutId, new AbortController().signal, {
        fetch: async () => response(),
      }),
      { status: 'retry' }
    );
  });
}

test('invalid or aborted status checks cannot authorize discarding a checkout', async () => {
  const { checkPendingCreemOrder } = load();
  const controller = new AbortController();
  controller.abort();
  let count = 0;
  const options = { fetch: async () => { count++; return Response.json({ unpaid: true }); } };
  assert.deepEqual(await checkPendingCreemOrder(checkoutId, controller.signal, options), { status: 'retry' });
  assert.deepEqual(await checkPendingCreemOrder('invalid', new AbortController().signal, options), { status: 'retry' });
  assert.equal(count, 0);
});

test('a status check aborted during the request cannot authorize discarding', async () => {
  const { checkPendingCreemOrder } = load();
  const controller = new AbortController();
  assert.deepEqual(
    await checkPendingCreemOrder(checkoutId, controller.signal, {
      fetch: async () => {
        controller.abort();
        return Response.json({ unpaid: true }, { status: 202 });
      },
    }),
    { status: 'retry' }
  );
});

test('verifyCreemReturn retries through post-redirect settlement lag and sends orderId when available', async () => {
  const { verifyCreemReturn } = load();
  const orderId = 'ord_4aDwWXjMLpes4Kj4XqNnUA';
  const bodies = [];
  let count = 0;
  const result = await verifyCreemReturn(checkoutId, new AbortController().signal, {
    orderId,
    attempts: 4,
    delayMs: 1,
    wait: async () => {},
    fetch: async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      count++;
      if (count === 1) return Response.json({ success: false, unpaid: true, pending: false }, { status: 202 });
      if (count === 2) return Response.json({ success: false, unpaid: false, pending: true }, { status: 202 });
      return Response.json({ success: true, status: 'COMPLETED', licenseKey: 'DSK-AAAA-BBBB-CCCC' });
    },
  });
  assert.deepEqual(result, { status: 'paid', licenseKey: 'DSK-AAAA-BBBB-CCCC' });
  assert.equal(count, 3);
  assert.deepEqual(bodies[0], { checkoutId, orderId });
});

test('verifyCreemReturn stops with unpaid when order never settles after retries', async () => {
  const { verifyCreemReturn } = load();
  let count = 0;
  const result = await verifyCreemReturn(checkoutId, new AbortController().signal, {
    attempts: 3,
    delayMs: 1,
    wait: async () => {},
    fetch: async () => {
      count++;
      return Response.json({ success: false, unpaid: true, pending: false }, { status: 202 });
    },
  });
  assert.deepEqual(result, { status: 'unpaid' });
  assert.equal(count, 3);
});

test('recoverCreemLicense waits initialDelayMs and applies stepped backoff without rapid polling', async () => {
  const { recoverCreemLicense } = load();
  const delays = [];
  let count = 0;
  const key = await recoverCreemLicense(checkoutId, new AbortController().signal, {
    initialDelayMs: 3000,
    attempts: 4,
    wait: async ms => { delays.push(ms); },
    fetch: async () => {
      count++;
      return Response.json({ success: false }, { status: 403 });
    },
  });
  assert.equal(key, null);
  assert.equal(count, 4);
  assert.deepEqual(delays, [3000, 3000, 3000, 5000]);
});

test('confirmed unpaid marker clears when a new checkout starts or a license is saved', () => {
  const { rememberPendingOrder, markPendingOrderUnpaid, readConfirmedUnpaidOrder, savePurchasedLicense } = load();
  const data = new Map();
  const storage = {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: k => data.delete(k),
  };
  rememberPendingOrder(checkoutId, storage);
  markPendingOrderUnpaid(checkoutId, storage);
  assert.equal(readConfirmedUnpaidOrder(storage), checkoutId);
  rememberPendingOrder('ch_NEWCHECKOUT987654', storage);
  assert.equal(readConfirmedUnpaidOrder(storage), '');
  markPendingOrderUnpaid('ch_NEWCHECKOUT987654', storage);
  savePurchasedLicense('DSK-AAAA-BBBB-CCCC', storage);
  assert.equal(readConfirmedUnpaidOrder(storage), '');
});
