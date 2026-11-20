type PaymentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const pendingKey = 'devsnapkit_pending_creem_checkout';
const unpaidKey = 'devsnapkit_unpaid_creem_checkout';
const isCheckoutId = (id: string) => /^(?:(?:ch|chk|ord|tx|tran)_[A-Za-z0-9]{6,64}|[A-Z0-9]{10,32})$/i.test(id.trim());

export function readPendingOrder(storage?: PaymentStorage): string {
  try {
    const id = ((storage || localStorage).getItem(pendingKey) || '').trim();
    return isCheckoutId(id) ? id : '';
  } catch {
    return '';
  }
}

export function readConfirmedUnpaidOrder(storage?: PaymentStorage): string {
  try {
    const id = ((storage || localStorage).getItem(unpaidKey) || '').trim();
    return isCheckoutId(id) ? id : '';
  } catch {
    return '';
  }
}

export function markPendingOrderUnpaid(id: string, storage?: PaymentStorage) {
  try {
    const target = storage || localStorage;
    const clean = id.trim();
    if (isCheckoutId(clean)) target.setItem(unpaidKey, clean);
    else target.removeItem(unpaidKey);
  } catch {
    /* Storage restrictions must not break checkout. */
  }
}

export function rememberPendingOrder(id: string, storage?: PaymentStorage) {
  try {
    const target = storage || localStorage;
    const clean = id.trim();
    if (isCheckoutId(clean)) {
      target.setItem(pendingKey, clean);
      if ((target.getItem(unpaidKey) || '').trim() !== clean) {
        target.removeItem(unpaidKey);
      }
    } else {
      target.removeItem(pendingKey);
      target.removeItem(unpaidKey);
    }
  } catch {
    /* Storage restrictions must not break checkout. */
  }
}

export function savePurchasedLicense(key: string, storage?: PaymentStorage) {
  try {
    const target = storage || localStorage;
    target.setItem('devsnapkit_pro_unlocked', 'true');
    target.setItem('devsnapkit_license_key', key);
    target.removeItem(pendingKey);
    target.removeItem(unpaidKey);
  } catch {
    /* The UI still displays the server-verified key for copying. */
  }
}

function waitForRetry(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}

type PendingOrderCheck = { status: 'paid'; licenseKey: string } | { status: 'unpaid' | 'retry' };

export async function checkPendingCreemOrder(
  checkoutId: string,
  signal: AbortSignal,
  options: { fetch?: typeof fetch; orderId?: string } = {}
): Promise<PendingOrderCheck> {
  const cleanId = checkoutId.trim();
  if (!isCheckoutId(cleanId) || signal.aborted) return { status: 'retry' };
  const payload: { checkoutId: string; orderId?: string } = { checkoutId: cleanId };
  const cleanOrderId = options.orderId?.trim() || '';
  if (cleanOrderId && cleanOrderId !== cleanId && isCheckoutId(cleanOrderId)) {
    payload.orderId = cleanOrderId;
  }
  try {
    const response = await (options.fetch || fetch)('/api/creem-verify-checkout', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (signal.aborted) return { status: 'retry' };
    if (
      response.ok &&
      data?.success === true &&
      typeof data.licenseKey === 'string' &&
      /^DSK-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(data.licenseKey)
    ) {
      return { status: 'paid', licenseKey: data.licenseKey };
    }
    if (
      response.status === 403 ||
      response.status === 422 ||
      (response.ok && data?.success === false && data.unpaid === true && data.pending === false)
    ) {
      return { status: 'unpaid' };
    }
  } catch {
    /* An unavailable check is never proof that the order is unpaid. */
  }
  return { status: 'retry' };
}

export async function verifyCreemReturn(
  checkoutId: string,
  signal: AbortSignal,
  options: {
    fetch?: typeof fetch;
    wait?: (ms: number, signal: AbortSignal) => Promise<void>;
    orderId?: string;
    attempts?: number;
    delayMs?: number;
  } = {}
): Promise<PendingOrderCheck> {
  const cleanId = checkoutId.trim();
  if (!isCheckoutId(cleanId) || signal.aborted) return { status: 'retry' };
  const wait = options.wait || waitForRetry;
  const attempts = options.attempts ?? 8;
  const delayMs = options.delayMs ?? 2000;
  let lastResult: PendingOrderCheck = { status: 'retry' };

  for (let i = 0; i < attempts && !signal.aborted; i++) {
    lastResult = await checkPendingCreemOrder(cleanId, signal, {
      fetch: options.fetch,
      orderId: options.orderId,
    });
    if (signal.aborted) return { status: 'retry' };
    if (lastResult.status === 'paid') return lastResult;
    if (i + 1 < attempts) await wait(delayMs, signal);
  }
  return signal.aborted ? { status: 'retry' } : lastResult;
}

const recoveryBackoffMs = [3000, 3000, 5000, 5000, 8000, 10000, 15000, 15000, 20000, 20000, 30000];

export async function recoverCreemLicense(
  checkoutId: string,
  signal: AbortSignal,
  options: {
    fetch?: typeof fetch;
    wait?: (ms: number, signal: AbortSignal) => Promise<void>;
    attempts?: number;
    initialDelayMs?: number;
  } = {}
): Promise<string | null> {
  const cleanId = checkoutId.trim();
  if (!isCheckoutId(cleanId) || signal.aborted) return null;
  const request = options.fetch || fetch;
  const wait = options.wait || waitForRetry;
  const maxAttempts = options.attempts ?? 12;
  if (options.initialDelayMs && options.initialDelayMs > 0) {
    await wait(options.initialDelayMs, signal);
    if (signal.aborted) return null;
  }
  for (let i = 0; i < maxAttempts && !signal.aborted; i++) {
    try {
      const response = await request('/api/claim-license', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: cleanId }),
      });
      const data = await response.json();
      if (
        !signal.aborted &&
        response.ok &&
        data.success === true &&
        typeof data.licenseKey === 'string' &&
        /^DSK-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(data.licenseKey)
      ) {
        return data.licenseKey;
      }
    } catch {
      if (signal.aborted) return null;
    }
    if (i + 1 < maxAttempts) {
      const delay = recoveryBackoffMs[Math.min(i, recoveryBackoffMs.length - 1)];
      await wait(delay, signal);
    }
  }
  return null;
}
