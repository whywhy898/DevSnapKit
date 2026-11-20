import {
  fulfillOrder,
  fulfillOrderFromTransaction,
  paymentConfig,
  paymentFailure,
  paymentResponse,
  readCheckout,
  readTransactionById,
  readTransactionByOrderId,
  requirePaymentStorage,
  validatePurchase,
  validCheckoutId,
  type CreemEnv,
} from '../lib/creem';

const isOrderId = (id: string) => /^ord_[A-Za-z0-9]{6,64}$/i.test(id);
const isTransactionId = (id: string) => /^tran_[A-Za-z0-9]{6,64}$/i.test(id);

function txNotPaidResponse(tx: any) {
  const status = String(tx?.status || '').toLowerCase();
  const unpaid = !tx || ['pending', 'expired', 'canceled', 'cancelled', 'voided', 'failed'].includes(status);
  return paymentResponse(
    {
      success: false,
      unpaid,
      pending: !unpaid,
      error: unpaid
        ? 'This checkout has not been paid.'
        : 'Creem is still processing this payment. No key is issued until it completes.',
    },
    202
  );
}

export const onRequestPost = async ({ request, env }: { request: Request; env: CreemEnv }) => {
  try {
    requirePaymentStorage(env);
    paymentConfig(env);
    const body: any = await request.json().catch(() => ({}));
    const rawCheckoutId = typeof body.checkoutId === 'string' ? body.checkoutId.trim() : '';
    const rawOrderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const primaryId = rawCheckoutId || rawOrderId;
    if (!validCheckoutId(primaryId)) {
      return paymentResponse({ success: false, error: 'Valid Creem checkoutId is required.' }, 400);
    }

    if (isOrderId(primaryId)) {
      const tx = await readTransactionByOrderId(env, primaryId);
      if (!tx || String(tx?.status || '').toLowerCase() !== 'paid') {
        return txNotPaidResponse(tx);
      }
      const record = await fulfillOrderFromTransaction(env, tx);
      return paymentResponse({
        success: true,
        status: 'COMPLETED',
        licenseKey: record.licenseKey,
        orderId: record.orderId,
        transactionId: record.txnId,
      });
    }

    if (isTransactionId(primaryId)) {
      const tx = await readTransactionById(env, primaryId);
      if (String(tx?.status || '').toLowerCase() !== 'paid') {
        return txNotPaidResponse(tx);
      }
      const record = await fulfillOrderFromTransaction(env, tx);
      return paymentResponse({
        success: true,
        status: 'COMPLETED',
        licenseKey: record.licenseKey,
        orderId: record.orderId,
        transactionId: record.txnId,
      });
    }

    const checkout = await readCheckout(env, primaryId);
    const checkoutStatus = String(checkout?.status || '').toLowerCase();
    const orderStatus = String(checkout?.order?.status || '').toLowerCase();

    if (!['completed', 'paid'].includes(checkoutStatus) || orderStatus !== 'paid') {
      if (rawOrderId && isOrderId(rawOrderId)) {
        const tx = await readTransactionByOrderId(env, rawOrderId);
        if (tx && String(tx?.status || '').toLowerCase() === 'paid') {
          const record = await fulfillOrderFromTransaction(env, tx, primaryId);
          return paymentResponse({
            success: true,
            status: 'COMPLETED',
            licenseKey: record.licenseKey,
            orderId: record.orderId,
            transactionId: record.txnId,
          });
        }
      }
      const unpaid =
        ['pending', 'expired', 'canceled', 'cancelled', 'voided'].includes(checkoutStatus) &&
        !['paid', 'processing', 'pending_settlement'].includes(orderStatus);
      return paymentResponse(
        {
          success: false,
          unpaid,
          pending: !unpaid,
          error: unpaid
            ? 'This checkout has not been paid.'
            : 'Creem is still processing this payment. No key is issued until it completes.',
        },
        202
      );
    }

    validatePurchase(checkout, env);
    const record = await fulfillOrder(env, checkout);
    return paymentResponse({
      success: true,
      status: 'COMPLETED',
      licenseKey: record.licenseKey,
      orderId: record.orderId,
      transactionId: record.txnId,
    });
  } catch (error) {
    return paymentFailure(error);
  }
};

export const onRequestOptions = async () => paymentResponse({}, 200);
