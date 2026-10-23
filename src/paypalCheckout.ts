type PaymentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const pendingKey = 'devsnapkit_pending_paypal_order';
const isOrder = (id: string) => /^[A-Z0-9]{10,32}$/.test(id);

export function readPendingOrder(storage?: PaymentStorage): string {
  try { const id = (storage || localStorage).getItem(pendingKey) || ''; return isOrder(id) ? id : ''; }
  catch { return ''; }
}

export function rememberPendingOrder(id: string, storage?: PaymentStorage) {
  try { const target = storage || localStorage; if (isOrder(id)) target.setItem(pendingKey, id); else target.removeItem(pendingKey); }
  catch { /* Storage restrictions must not break checkout. */ }
}

export function savePurchasedLicense(key: string, storage?: PaymentStorage) {
  try {
    const target = storage || localStorage;
    target.setItem('devsnapkit_pro_unlocked', 'true');
    target.setItem('devsnapkit_license_key', key);
    target.removeItem(pendingKey);
  } catch { /* The UI still displays the server-verified key for copying. */ }
}

function waitForRetry(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}

export async function recoverPayPalLicense(orderId: string, signal: AbortSignal, options: {
  fetch?: typeof fetch; wait?: (ms: number, signal: AbortSignal) => Promise<void>; attempts?: number;
} = {}): Promise<string | null> {
  if (!isOrder(orderId) || signal.aborted) return null;
  const request = options.fetch || fetch, wait = options.wait || waitForRetry;
  for (let i = 0; i < (options.attempts ?? 60) && !signal.aborted; i++) {
    try {
      const response = await request('/api/claim-license', { method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
      const data = await response.json();
      if (!signal.aborted && response.ok && data.success === true
        && typeof data.licenseKey === 'string' && /^DSK-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(data.licenseKey)) return data.licenseKey;
    } catch { if (signal.aborted) return null; }
    if (i + 1 < (options.attempts ?? 60)) await wait(3000, signal);
  }
  return null;
}
