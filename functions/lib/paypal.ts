import { ConfigurationError, generateSignedKey, requireSecret } from './security';
import { sendOrderNotification, type NotifyEnv } from '../api/notify';

export interface PayPalEnv extends NotifyEnv {
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
  PAYPAL_WEBHOOK_ID?: string;
  DSK_SERVER_SECRET?: string;
  DB?: any;
}

export class PaymentError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

export function paymentConfig(env: PayPalEnv) {
  const clientId = env.PAYPAL_CLIENT_ID?.trim(), secret = env.PAYPAL_CLIENT_SECRET?.trim();
  const mode = (env.PAYPAL_MODE || 'live').trim().toLowerCase();
  if (!clientId || !secret || !['live', 'sandbox'].includes(mode)) {
    throw new ConfigurationError('PayPal server credentials are not configured. Please contact support@devsnapkit.com.');
  }
  return { clientId, secret, mode, baseUrl: mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com' };
}

export function requirePaymentStorage(env: PayPalEnv) {
  requireSecret(env, 'DSK_SERVER_SECRET');
  if (!env.DB) throw new ConfigurationError('Payment storage is unavailable. Please contact support@devsnapkit.com.');
}

export function validOrderId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Z0-9]{10,32}$/.test(id);
}

export async function paypalToken(env: PayPalEnv) {
  const config = paymentConfig(env);
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Basic ${btoa(`${config.clientId}:${config.secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data: any = await response.json();
  if (!response.ok || typeof data.access_token !== 'string') throw new PaymentError('PayPal authentication failed. Please contact support@devsnapkit.com.');
  return { ...config, token: data.access_token };
}

type Session = Awaited<ReturnType<typeof paypalToken>>;
export async function paypalRequest(session: Session, endpoint: string, init: RequestInit = {}) {
  const response = await fetch(session.baseUrl + endpoint, {
    ...init, signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const data: any = await response.json();
  return { response, data };
}

export async function readOrder(session: Session, orderId: string) {
  const { response, data } = await paypalRequest(session, `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  if (!response.ok) throw new PaymentError('Could not verify the PayPal order. Please retry or contact support@devsnapkit.com.', response.status === 404 ? 404 : 503);
  if (data.id !== orderId) throw new PaymentError('PayPal order does not match this purchase.', 422);
  return data;
}

function oneDollar(amount: any) {
  return amount?.currency_code === 'USD' && typeof amount.value === 'string' && /^0*1(?:\.0{1,2})?$/.test(amount.value);
}

export function validatePurchase(order: any) {
  const units = order?.purchase_units;
  if (order?.intent !== 'CAPTURE' || !Array.isArray(units) || units.length !== 1
    || units[0].reference_id !== 'DSK_PRO_LIFETIME' || !oneDollar(units[0].amount)
    || typeof units[0].payee?.merchant_id !== 'string' || !units[0].payee.merchant_id) {
    throw new PaymentError('This PayPal order does not match the DevSnapKit $1 USD purchase.', 422);
  }
  return units[0];
}

export async function completedOrder(_env: PayPalEnv, session: Session, orderId: string, allowCapture: boolean) {
  let order = await readOrder(session, orderId);
  validatePurchase(order);
  if (order.status === 'APPROVED' && allowCapture) {
    const { response, data } = await paypalRequest(session, `/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST', headers: { 'PayPal-Request-Id': `dsk-capture-${orderId}` }, body: '{}',
    });
    if (!response.ok) {
      if (data.details?.some((detail: any) => detail.issue === 'ORDER_ALREADY_CAPTURED')) order = await readOrder(session, orderId);
      else throw new PaymentError('PayPal has not completed the payment. Retry with PayPal or contact support@devsnapkit.com.', response.status >= 500 ? 503 : 422);
    } else {
      // GET provides canonical purchase/payee fields omitted by minimal capture responses.
      order = await readOrder(session, orderId);
      if (order.status !== 'COMPLETED' && data.id === orderId) {
        order = { ...order, status: data.status, payer: data.payer || order.payer,
          purchase_units: order.purchase_units.map((unit: any, i: number) => ({ ...unit, payments: data.purchase_units?.[i]?.payments || unit.payments })) };
      }
    }
  }
  if (order.status !== 'COMPLETED') return null;
  validatePurchase(order);
  if (allowCapture && order.purchase_units[0].payments?.captures?.some((capture: any) => capture.status === 'PENDING')) return null;
  return order;
}

export async function fulfillOrder(env: PayPalEnv, order: any, expectedCaptureId?: string) {
  requirePaymentStorage(env);
  const unit = validatePurchase(order);
  const captures = unit.payments?.captures;
  const capture = Array.isArray(captures) && captures.length === 1 ? captures[0] : null;
  if (order.status !== 'COMPLETED' || !capture || capture.status !== 'COMPLETED'
    || typeof capture.id !== 'string' || !capture.id || !oneDollar(capture.amount)
    || capture.final_capture === false || (expectedCaptureId && capture.id !== expectedCaptureId)
    || (capture.payee?.merchant_id && capture.payee.merchant_id !== unit.payee.merchant_id)) {
    throw new PaymentError('PayPal has not confirmed a matching completed capture.', 422);
  }
  const licenseKey = await generateSignedKey(capture.id, requireSecret(env, 'DSK_SERVER_SECRET'));
  const record = { orderId: order.id, txnId: capture.id, payerEmail: order.payer?.email_address || '',
    amount: capture.amount.value, currency: 'USD', status: 'COMPLETED', licenseKey,
    createdAt: capture.create_time || new Date().toISOString() };
  let inserted: any, stored: any;
  try {
    inserted = await env.DB.prepare(`INSERT INTO orders
      (order_id, txn_id, payer_email, amount, currency, status, license_key, created_at, raw_payload)
      VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)
      ON CONFLICT(order_id) DO UPDATE SET txn_id=excluded.txn_id, payer_email=excluded.payer_email,
        amount=excluded.amount, currency=excluded.currency, status=excluded.status,
        license_key=excluded.license_key, raw_payload=excluded.raw_payload
      WHERE orders.status='PENDING'`).bind(record.orderId, record.txnId, record.payerEmail,
        record.amount, record.currency, record.licenseKey, record.createdAt, JSON.stringify(order).slice(0, 4000)).run();
    stored = await env.DB.prepare('SELECT txn_id, status, license_key FROM orders WHERE order_id = ?').bind(record.orderId).first();
  } catch {
    throw new PaymentError('Payment confirmation is being saved. Please retry or recover your key using the PayPal receipt.');
  }
  if (!stored || stored.status !== 'COMPLETED' || stored.txn_id !== record.txnId || stored.license_key !== licenseKey) {
    throw new PaymentError('The saved payment requires support review. Please contact support@devsnapkit.com.');
  }
  // D1's unique order ID selects one winner across webhook and browser requests.
  if (Number(inserted.meta?.changes) === 1) {
    try { await sendOrderNotification({ ...record, timestamp: record.createdAt }, env); }
    catch { console.warn('[Payment] Merchant notification failed; confirmed order is saved.'); }
  }
  return record;
}

export function paymentResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  } });
}

export function paymentFailure(error: unknown) {
  const status = error instanceof ConfigurationError ? 503 : error instanceof PaymentError ? error.status : 503;
  const message = error instanceof ConfigurationError || error instanceof PaymentError ? error.message
    : 'Payment verification is temporarily unavailable. Please retry or contact support@devsnapkit.com.';
  console.warn(`[Payment] Request failed (${status}).`);
  return paymentResponse({ success: false, error: message }, status);
}
