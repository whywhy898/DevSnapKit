export interface ProPricing {
  currency: 'USD';
  amount: string;
  /**
   * Amounts in this currency valid for fulfillment; must include the current amount.
   * When changing price, keep the previous amount here for a grace period so
   * in-flight checkouts still verify, then remove it.
   */
  acceptedAmounts: string[];
  displayPrice: string;
  productName: string;
  description: string;
  referenceId: string;
  compareAtPrice?: string;
}

/** Current offer. Keep referenceId stable so past/in-flight purchases remain identifiable. */
export const proPricing: ProPricing = {
  currency: 'USD',
  amount: '1.00',
  acceptedAmounts: ['1.00'],
  displayPrice: '$1',
  productName: 'DevSnapKit Pro',
  description: 'DevSnapKit Pro Lifetime Pass',
  referenceId: 'DSK_PRO_LIFETIME',
  compareAtPrice: '$29',
};
