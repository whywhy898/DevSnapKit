/** Shared access policy; independent of React and stored composition content. */
export const CAPABILITY_POLICY_VERSION = 1;

export const FREE_FEATURES = [
  'canvas_text',
  'brand_logo',
  'qr_code',
  'png_export',
  'webp_export',
  'jpeg_export',
  'legacy_brand_badge',
] as const;

export const PRO_FEATURES = [
  // Historical API identifier for 4x output scaling.
  '4k_export',
  'batch_export',
  'all_gradients',
] as const;

export type Capability = typeof FREE_FEATURES[number] | typeof PRO_FEATURES[number];

/** Legacy API spelling is normalized here, without rewriting stored content. */
export function canUse(feature: Capability | 'custom_watermark', isProUnlocked: boolean): boolean {
  const canonical = feature === 'custom_watermark' ? 'legacy_brand_badge' : feature;
  return (FREE_FEATURES as readonly string[]).includes(canonical)
    || (isProUnlocked && (PRO_FEATURES as readonly string[]).includes(canonical));
}
