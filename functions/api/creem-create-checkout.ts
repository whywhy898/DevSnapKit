import {
  creemRequest,
  paymentConfig,
  PaymentError,
  paymentFailure,
  paymentResponse,
  requirePaymentStorage,
  type CreemEnv,
} from '../lib/creem';
import { proPricing } from '../../shared/pricing';

export const onRequestPost = async ({ request, env }: { request: Request; env: CreemEnv }) => {
  try {
    requirePaymentStorage(env);
    const config = paymentConfig(env);
    const successUrl = new URL('/?editor=1&creem_return=1', request.url).href;
    const { response, data } = await creemRequest(env, '/v1/checkouts', {
      method: 'POST',
      body: JSON.stringify({
        product_id: config.productId,
        request_id: crypto.randomUUID(),
        success_url: successUrl,
        metadata: {
          referenceId: proPricing.referenceId,
          description: proPricing.description,
          amount: proPricing.amount,
          currency: proPricing.currency,
        },
      }),
    });

    if (!response.ok || typeof data?.id !== 'string' || typeof data?.checkout_url !== 'string') {
      throw new PaymentError('Creem checkout could not be started. Please retry or contact support@devsnapkit.com.');
    }

    return paymentResponse({ id: data.id, checkoutUrl: data.checkout_url });
  } catch (error) {
    return paymentFailure(error);
  }
};

export const onRequestOptions = async () => paymentResponse({}, 200);
