import type { TextFields, TextStyle } from './types';

const base: TextStyle = { font: 'manrope', size: 23, weight: 400, italic: false, color: '#242313' };
/** Exact initial CSS metrics, shared so changing only color never changes layout. */
export const DEFAULT_TEXT_STYLES: Record<keyof TextFields, TextStyle> = {
  brand: { ...base, size: 31, weight: 800 },
  badge: { ...base, size: 14, weight: 700 },
  eyebrow: { ...base, size: 12, weight: 800, color: '#8d711e' },
  headlineLead: { ...base, size: 73, weight: 800 },
  headlineHighlight: { ...base, font: 'gelasio', size: 78, italic: true },
  description: { ...base, size: 23, color: '#746f56' },
  cta: { ...base, size: 19, weight: 700, color: '#fffdf0' },
  website: { ...base, size: 24, weight: 800 },
  browserTitle: { ...base, size: 11, color: '#cbd5e1' },
  detailHeading: { ...base, size: 17, weight: 800 },
  detailLabel: { ...base, size: 10, weight: 700, color: '#8c7c45' },
  disclosure: { ...base, size: 13, color: '#756743' },
};
