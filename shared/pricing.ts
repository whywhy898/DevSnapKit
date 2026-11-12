export interface ProPricing {
  currency: 'USD';
  amount: string;
  /**
   * When changing price, replace this with the old current amount and set
   * PRICE_CHANGED_AT in the server environment to the release time (ISO UTC).
   * Update amount/displayPrice together. Only the current price and this one
   * previous price are accepted; the previous price expires automatically.
   * Omit when no previous price needs a grace period. Keep referenceId stable.
   */
  previousPrice?: { amount: string; graceHours: number };
  displayPrice: string;
  productName: string;
  description: string;
  referenceId: string;
}

/** Current offer. Keep referenceId stable so past/in-flight purchases remain identifiable. */
export const proPricing: ProPricing = {
  currency: 'USD',
  amount: '9.90',
  previousPrice: { amount: '1.00', graceHours: 24 },
  displayPrice: '$9.9',
  productName: 'DevSnapKit Pro',
  description: 'DevSnapKit Pro Lifetime Pass',
  referenceId: 'DSK_PRO_LIFETIME',
};
