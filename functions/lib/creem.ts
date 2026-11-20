import { ConfigurationError, generateSignedKey, requireSecret } from './security';
import { sendOrderNotification, type NotifyEnv } from '../api/notify';
import { markTransactionVerified } from '../api/claim-license';
import { proPricing } from '../../shared/pricing';

export interface CreemEnv extends NotifyEnv {
  CREEM_API_KEY?: string;
  CREEM_WEBHOOK_SECRET?: string;
  CREEM_PRODUCT_ID?: string;
  CREEM_MODE?: string;
  PRICE_CHANGED_AT?: string;
  DSK_SERVER_SECRET?: string;
  DB?: any;
}

export class PaymentError extends Error {
  constructor(message: string, public status = 503) {
    super(message);
  }
}

export function paymentConfig(env: CreemEnv) {
  const apiKey = env.CREEM_API_KEY?.trim();
  const productId = env.CREEM_PRODUCT_ID?.trim();
  const inferredMode = apiKey?.startsWith('creem_test_') ? 'test' : 'live';
  const mode = (env.CREEM_MODE || inferredMode).trim().toLowerCase();
  if (!apiKey || !productId || !['live', 'test'].includes(mode)) {
    throw new ConfigurationError('Creem server credentials are not configured. Please contact support@devsnapkit.com.');
  }
  return {
    apiKey,
    productId,
    mode,
    baseUrl: mode === 'live' ? 'https://api.creem.io' : 'https://test-api.creem.io',
  };
}

export function isTestModeEnv(env: CreemEnv): boolean {
  return (
    env.CREEM_MODE?.trim().toLowerCase() === 'test' ||
    Boolean(env.CREEM_API_KEY?.trim().startsWith('creem_test_'))
  );
}

export function requirePaymentStorage(env: CreemEnv) {
  requireSecret(env, 'DSK_SERVER_SECRET');
  if (!env.DB && !isTestModeEnv(env)) {
    throw new ConfigurationError('Payment storage is unavailable. Please contact support@devsnapkit.com.');
  }
}

export function validCheckoutId(id: unknown): id is string {
  return typeof id === 'string' && /^(?:(?:ch|chk|ord|tx|tran)_[A-Za-z0-9]{6,64}|[A-Z0-9]{10,32})$/i.test(id.trim());
}

export async function creemRequest(env: CreemEnv, endpoint: string, init: RequestInit = {}) {
  const config = paymentConfig(env);
  const response = await fetch(config.baseUrl + endpoint, {
    ...init,
    signal: AbortSignal.timeout(15000),
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  let data: any = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return { response, data, config };
}

function equalHexSignature(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export async function verifyCreemWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) return false;
  const received = signatureHeader.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(received)) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
  return equalHexSignature(expected, received);
}

export async function readCheckout(env: CreemEnv, checkoutId: string) {
  const cleanId = checkoutId.trim();
  const { response, data } = await creemRequest(env, `/v1/checkouts?checkout_id=${encodeURIComponent(cleanId)}`);
  if (!response.ok) {
    throw new PaymentError(
      'Could not verify the Creem checkout. Please retry or contact support@devsnapkit.com.',
      response.status === 404 ? 404 : 503
    );
  }
  if (data?.id !== cleanId) {
    throw new PaymentError('Creem checkout does not match this purchase.', 422);
  }
  return data;
}

export async function readTransactionByOrderId(env: CreemEnv, orderId: string) {
  const cleanOrderId = orderId.trim();
  const { response, data } = await creemRequest(
    env,
    `/v1/transactions/search?order_id=${encodeURIComponent(cleanOrderId)}`
  );
  if (!response.ok) {
    throw new PaymentError(
      'Could not verify the Creem order. Please retry or contact support@devsnapkit.com.',
      response.status === 404 ? 404 : 503
    );
  }
  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  const matching = items.filter(item => extractId(item?.order) === cleanOrderId);
  if (matching.length === 0) return null;
  if (
    matching.some(
      item =>
        String(item?.type || '').toLowerCase() === 'refund' ||
        String(item?.status || '').toLowerCase() === 'refunded' ||
        (typeof item?.refunded_amount === 'number' && item.refunded_amount > 0)
    )
  ) {
    throw new PaymentError('This Creem order has been refunded and cannot receive a license.', 422);
  }
  return (
    matching.find(item => String(item?.type || '').toLowerCase() === 'payment' && String(item?.status || '').toLowerCase() === 'paid') ||
    matching.find(item => String(item?.type || '').toLowerCase() === 'payment') ||
    matching[0]
  );
}

export async function readTransactionById(env: CreemEnv, transactionId: string) {
  const cleanId = transactionId.trim();
  const { response, data } = await creemRequest(
    env,
    `/v1/transactions?transaction_id=${encodeURIComponent(cleanId)}`
  );
  if (!response.ok) {
    throw new PaymentError(
      'Could not verify the Creem transaction. Please retry or contact support@devsnapkit.com.',
      response.status === 404 ? 404 : 503
    );
  }
  if (data?.id !== cleanId) {
    throw new PaymentError('Creem transaction does not match this purchase.', 422);
  }
  return data;
}

function centsFromAmount(value: unknown): bigint | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? BigInt(value) : null;
  }
  if (typeof value === 'string') {
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
    const [whole, fraction = ''] = value.split('.');
    const cents = BigInt(whole + fraction.padEnd(2, '0'));
    return cents > 0n ? cents : null;
  }
  return null;
}

function parseNonNegativeCents(value: unknown): bigint | null {
  if (value === 0 || value === '0' || value === '0.00') return 0n;
  return centsFromAmount(value);
}

function formatCentsToAmount(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

function acceptedPurchaseCents(cents: bigint | null, env: CreemEnv): boolean {
  if (cents === null) return false;
  const currentCents = centsFromAmount(proPricing.amount);
  if (currentCents !== null && cents === currentCents) return true;
  const previous = proPricing.previousPrice;
  const previousCents = previous ? centsFromAmount(previous.amount) : null;
  if (!previous || previousCents === null || cents !== previousCents) return false;

  const changedAt = env.PRICE_CHANGED_AT;
  const changedAtMs = typeof changedAt === 'string' ? Date.parse(changedAt) : NaN;
  // Require an explicit UTC timestamp and reject dates that Date.parse normalizes (e.g. February 30).
  if (
    !changedAt ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(changedAt) ||
    !Number.isFinite(changedAtMs) ||
    new Date(changedAtMs).toISOString().slice(0, 19) !== changedAt.slice(0, 19)
  ) {
    console.warn('[Payment] PRICE_CHANGED_AT is missing or invalid; previous price is disabled.');
    return false;
  }
  return Date.now() < changedAtMs + previous.graceHours * 60 * 60 * 1000;
}

function extractId(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object' && typeof (raw as any).id === 'string') return (raw as any).id.trim();
  return '';
}

function resolveValidatedBaseCents(checkout: any, env: CreemEnv): bigint {
  const mismatchMessage = `This Creem checkout does not match the ${proPricing.productName} ${proPricing.currency} purchase.`;
  const failMismatch = (reason: string): never => {
    console.warn(`[Payment] Creem checkout validation mismatch (${reason}).`);
    throw new PaymentError(mismatchMessage, 422);
  };

  const checkoutProductId = extractId(checkout?.product);
  const orderProductId = extractId(checkout?.order?.product);
  if (checkoutProductId && orderProductId && checkoutProductId !== orderProductId) {
    failMismatch('product_mismatch');
  }
  const productId = checkoutProductId || orderProductId;
  const expectedProductId = env.CREEM_PRODUCT_ID?.trim();
  if (expectedProductId && productId !== expectedProductId) {
    failMismatch('unexpected_product');
  }

  if (
    checkout?.metadata?.referenceId !== undefined &&
    checkout?.metadata?.referenceId !== null &&
    checkout.metadata.referenceId !== proPricing.referenceId
  ) {
    failMismatch('reference_mismatch');
  }

  const order = checkout?.order;
  const currency = typeof order?.currency === 'string' ? order.currency.toUpperCase() : '';
  if (currency !== proPricing.currency) {
    failMismatch('currency_mismatch');
  }

  const amountCents = centsFromAmount(order?.amount);
  if (amountCents === null) {
    failMismatch('invalid_amount');
  }

  const hasDiscount = order?.discount_amount !== undefined && order?.discount_amount !== null;
  if (hasDiscount) {
    const discountCents = parseNonNegativeCents(order.discount_amount);
    if (discountCents === null || discountCents !== 0n) {
      failMismatch('unexpected_discount');
    }
  }

  const hasTax = order?.tax_amount !== undefined && order?.tax_amount !== null;
  let taxCents = 0n;
  if (hasTax) {
    const parsedTax = parseNonNegativeCents(order.tax_amount);
    if (parsedTax === null) {
      failMismatch('invalid_tax');
    }
    taxCents = parsedTax;
  }

  const hasSubTotal = order?.sub_total !== undefined && order?.sub_total !== null;
  let subTotalCents: bigint | null = null;
  if (hasSubTotal) {
    subTotalCents = centsFromAmount(order.sub_total);
    if (subTotalCents === null) {
      failMismatch('invalid_sub_total');
    }
  }

  let baseCents = amountCents;
  let expectedTotalCents = amountCents;
  if (taxCents > 0n) {
    if (subTotalCents !== null) {
      if (amountCents === subTotalCents + taxCents) {
        // Supports both tax-exclusive (sub_total = price, amount = price + tax)
        // and tax-inclusive (amount = price, sub_total = price - tax).
        baseCents = acceptedPurchaseCents(subTotalCents, env) ? subTotalCents : amountCents;
        expectedTotalCents = amountCents;
      } else if (amountCents === subTotalCents) {
        baseCents = subTotalCents;
        expectedTotalCents = subTotalCents + taxCents;
      } else {
        failMismatch('tax_total_mismatch');
      }
    } else if (amountCents > taxCents && acceptedPurchaseCents(amountCents - taxCents, env)) {
      baseCents = amountCents - taxCents;
      expectedTotalCents = amountCents;
    } else if (acceptedPurchaseCents(amountCents, env)) {
      baseCents = amountCents;
      expectedTotalCents = amountCents + taxCents;
    } else {
      failMismatch('unaccepted_taxed_amount');
    }
  } else if (subTotalCents !== null && subTotalCents !== amountCents) {
    failMismatch('sub_total_mismatch');
  }

  const hasAmountDue = order?.amount_due !== undefined && order?.amount_due !== null;
  if (hasAmountDue) {
    const dueCents = parseNonNegativeCents(order.amount_due);
    // Creem returns amount_due equal to the total order amount due (e.g. amount or sub_total + tax),
    // while 0 represents zero remaining balance in settled fixtures.
    if (dueCents === null || (dueCents !== 0n && dueCents !== expectedTotalCents)) {
      failMismatch('amount_due_mismatch');
    }
  }

  const hasAmountPaid = order?.amount_paid !== undefined && order?.amount_paid !== null;
  if (hasAmountPaid) {
    const paidCents = centsFromAmount(order.amount_paid);
    const validPaid =
      paidCents !== null &&
      (paidCents === expectedTotalCents || (taxCents > 0n && subTotalCents === null && paidCents === amountCents));
    if (!validPaid) {
      failMismatch('amount_paid_mismatch');
    }
  }

  if (!acceptedPurchaseCents(baseCents, env)) {
    failMismatch('unaccepted_amount');
  }
  return baseCents;
}

export function validatePurchase(checkout: any, env: CreemEnv) {
  resolveValidatedBaseCents(checkout, env);
  return checkout;
}

export function validatePaidTransaction(tx: any, env: CreemEnv): bigint {
  const mismatchMessage = `This Creem transaction does not match the ${proPricing.productName} ${proPricing.currency} purchase.`;
  const failMismatch = (reason: string): never => {
    console.warn(`[Payment] Creem transaction validation mismatch (${reason}).`);
    throw new PaymentError(mismatchMessage, 422);
  };

  if (String(tx?.status || '').toLowerCase() !== 'paid') {
    failMismatch('tx_not_paid');
  }
  if (tx?.type !== undefined && String(tx.type).toLowerCase() !== 'payment') {
    failMismatch('tx_not_payment');
  }
  if (tx?.refunded_amount !== undefined && tx?.refunded_amount !== null && tx.refunded_amount !== 0) {
    failMismatch('tx_refunded');
  }
  const currency = typeof tx?.currency === 'string' ? tx.currency.toUpperCase() : '';
  if (currency !== proPricing.currency) {
    failMismatch('tx_currency_mismatch');
  }
  const amountCents = centsFromAmount(tx?.amount);
  if (amountCents === null) {
    failMismatch('tx_invalid_amount');
  }

  let taxCents = 0n;
  if (tx?.tax_amount !== undefined && tx?.tax_amount !== null) {
    const parsedTax = parseNonNegativeCents(tx.tax_amount);
    if (parsedTax === null) failMismatch('tx_invalid_tax');
    taxCents = parsedTax;
  }

  if (tx?.amount_paid !== undefined && tx?.amount_paid !== null) {
    const paidCents = centsFromAmount(tx.amount_paid);
    const validPaid =
      paidCents !== null &&
      (paidCents === amountCents || (taxCents > 0n && paidCents === amountCents + taxCents));
    if (!validPaid) failMismatch('tx_amount_paid_mismatch');
  }

  let baseCents = amountCents;
  if (taxCents > 0n) {
    if (amountCents > taxCents && acceptedPurchaseCents(amountCents - taxCents, env)) {
      baseCents = amountCents - taxCents;
    } else if (acceptedPurchaseCents(amountCents, env)) {
      baseCents = amountCents;
    } else {
      failMismatch('tx_unaccepted_taxed_amount');
    }
  } else if (!acceptedPurchaseCents(baseCents, env)) {
    failMismatch('tx_unaccepted_amount');
  }

  if (!extractId(tx?.order)) {
    failMismatch('tx_missing_order');
  }
  return baseCents;
}

async function persistFulfilledRecord(
  env: CreemEnv,
  record: {
    orderId: string;
    txnId: string;
    payerEmail: string;
    amount: string;
    currency: string;
    status: string;
    licenseKey: string;
    createdAt: string;
  },
  rawObject: any,
  isTestOrder: boolean
) {
  markTransactionVerified(record.orderId, record.txnId);
  markTransactionVerified(record.txnId, record.txnId);

  if (!env.DB) {
    return record;
  }

  const { mode: _rawMode, ...objectWithoutMode } = rawObject && typeof rawObject === 'object' ? rawObject : {};
  const payloadToStore = JSON.stringify({
    mode: isTestOrder ? 'test' : (rawObject?.mode || 'live'),
    ...objectWithoutMode,
  }).slice(0, 4000);

  let inserted: any;
  let stored: any;
  try {
    inserted = await env.DB.prepare(`INSERT INTO orders
      (order_id, txn_id, payer_email, amount, currency, status, license_key, created_at, raw_payload)
      VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?)
      ON CONFLICT(order_id) DO UPDATE SET txn_id=excluded.txn_id, payer_email=excluded.payer_email,
        amount=excluded.amount, currency=excluded.currency, status=excluded.status,
        license_key=excluded.license_key, raw_payload=excluded.raw_payload
      WHERE orders.status='PENDING'`)
      .bind(
        record.orderId,
        record.txnId,
        record.payerEmail,
        record.amount,
        record.currency,
        record.licenseKey,
        record.createdAt,
        payloadToStore
      )
      .run();
    stored = await env.DB.prepare('SELECT txn_id, status, license_key FROM orders WHERE order_id = ?')
      .bind(record.orderId)
      .first();
  } catch {
    throw new PaymentError('Payment confirmation is being saved. Please retry or recover your key using your Creem Order ID.');
  }

  if (!stored || stored.status !== 'COMPLETED' || stored.txn_id !== record.txnId || stored.license_key !== record.licenseKey) {
    throw new PaymentError('The saved payment requires support review. Please contact support@devsnapkit.com.');
  }

  // D1's unique order ID selects one winner across webhook and browser requests.
  if (Number(inserted.meta?.changes) === 1) {
    try {
      await sendOrderNotification({ ...record, timestamp: record.createdAt }, env);
    } catch {
      console.warn('[Payment] Merchant notification failed; confirmed order is saved.');
    }
  }
  return record;
}

export async function fulfillOrder(env: CreemEnv, checkout: any, expectedOrderId?: string) {
  requirePaymentStorage(env);
  const baseCents = resolveValidatedBaseCents(checkout, env);
  const order = checkout?.order;
  const orderId = typeof checkout?.id === 'string' ? checkout.id.trim() : '';
  const txnId = typeof order?.id === 'string' ? order.id.trim() : '';
  const checkoutStatus = String(checkout?.status || '').toLowerCase();
  const orderStatus = String(order?.status || '').toLowerCase();

  if (
    !['completed', 'paid'].includes(checkoutStatus) ||
    orderStatus !== 'paid' ||
    !orderId ||
    !txnId ||
    (expectedOrderId && txnId !== expectedOrderId.trim())
  ) {
    throw new PaymentError('Creem has not confirmed a matching paid order.', 422);
  }

  const licenseKey = await generateSignedKey(txnId.toUpperCase(), requireSecret(env, 'DSK_SERVER_SECRET'));
  const payerEmail =
    typeof checkout?.customer?.email === 'string'
      ? checkout.customer.email.trim()
      : typeof order?.customer_email === 'string'
        ? order.customer_email.trim()
        : '';

  const record = {
    orderId,
    txnId,
    payerEmail,
    amount: formatCentsToAmount(baseCents),
    currency: proPricing.currency,
    status: 'COMPLETED',
    licenseKey,
    createdAt: typeof order?.created_at === 'string' && order.created_at ? order.created_at : new Date().toISOString(),
  };

  const rawMode = (env.CREEM_MODE || (env.CREEM_API_KEY?.trim().startsWith('creem_test_') ? 'test' : 'live')).trim().toLowerCase();
  const isTestOrder =
    rawMode === 'test' ||
    String(checkout?.mode || '').toLowerCase() === 'test' ||
    String(order?.mode || '').toLowerCase() === 'test';

  return persistFulfilledRecord(env, record, checkout, isTestOrder);
}

export async function fulfillOrderFromTransaction(env: CreemEnv, tx: any, checkoutIdHint?: string) {
  requirePaymentStorage(env);
  const baseCents = validatePaidTransaction(tx, env);
  const txnId = extractId(tx?.order);
  const orderId = (checkoutIdHint && checkoutIdHint.trim()) || txnId;
  const licenseKey = await generateSignedKey(txnId.toUpperCase(), requireSecret(env, 'DSK_SERVER_SECRET'));
  const createdAt =
    typeof tx?.created_at === 'string' && tx.created_at
      ? tx.created_at
      : typeof tx?.created_at === 'number' && Number.isFinite(tx.created_at)
        ? new Date(tx.created_at).toISOString()
        : new Date().toISOString();

  const record = {
    orderId,
    txnId,
    payerEmail: typeof tx?.customer?.email === 'string' ? tx.customer.email.trim() : '',
    amount: formatCentsToAmount(baseCents),
    currency: proPricing.currency,
    status: 'COMPLETED',
    licenseKey,
    createdAt,
  };

  if (typeof tx?.id === 'string' && tx.id.trim()) {
    markTransactionVerified(tx.id.trim(), txnId);
  }

  const rawMode = (env.CREEM_MODE || (env.CREEM_API_KEY?.trim().startsWith('creem_test_') ? 'test' : 'live')).trim().toLowerCase();
  const isTestOrder = rawMode === 'test' || String(tx?.mode || '').toLowerCase() === 'test';

  return persistFulfilledRecord(env, record, tx, isTestOrder);
}

export function paymentResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export function paymentFailure(error: unknown) {
  const status = error instanceof ConfigurationError ? 503 : error instanceof PaymentError ? error.status : 503;
  const message =
    error instanceof ConfigurationError || error instanceof PaymentError
      ? error.message
      : 'Payment verification is temporarily unavailable. Please retry or contact support@devsnapkit.com.';
  console.warn(`[Payment] Request failed (${status}).`);
  return paymentResponse({ success: false, error: message }, status);
}
