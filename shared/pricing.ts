export interface ProPricing {
  currency: 'USD';
  amount: string;
  /**
   * When changing price, replace this with the old current amount and set
   * acceptedUntil to the change time + 24 hours as an ISO timestamp (UTC).
   * Update amount/displayPrice together. Only the current price and this one
   * previous price are accepted; the previous price expires automatically.
   * Omit when no previous price needs a grace period. Keep referenceId stable.
   */
  previousPrice?: { amount: string; acceptedUntil: string };
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
  displayPrice: '$1',
  productName: 'DevSnapKit Pro',
  description: 'DevSnapKit Pro Lifetime Pass',
  referenceId: 'DSK_PRO_LIFETIME',
  compareAtPrice: '$29',
};
