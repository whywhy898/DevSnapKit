/** Shared purchase copy; export presets retain their existing canvas-specific rules. */
export const productCopy = {
  title: 'Unlock DevSnapKit Pro',
  price: 'One-time payment of $1 USD. Lifetime Pro access. No recurring subscriptions.',
  freeBrand: 'Add your logo and a QR code. Included in Free.',
  free: 'Text, logo uploads and QR codes are included in Free.',
  tooltip: 'Pro: high-resolution export presets, batch export and premium gradient backgrounds — $1 lifetime.',
  activation: 'License Key Verified! DevSnapKit Pro is activated: high-resolution export presets, batch export and premium gradient backgrounds.',
  success: 'DevSnapKit Pro is active. High-resolution export presets, batch export and premium gradient backgrounds are unlocked for life.',
  benefits: [
    { title: 'High-resolution export presets', detail: 'Unlock the 4K preset. Check the final pixel dimensions shown before export.' },
    { title: 'Batch export', detail: 'Export multiple canvas sizes in one run.' },
    { title: 'Premium gradient backgrounds', detail: 'Unlock the premium gradient collection.' },
  ],
} as const;
