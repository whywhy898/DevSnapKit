import { ArrowUpRight } from 'lucide-react';
import type { ButtonObject } from './types';
export function ButtonRenderer({ object }: { object: ButtonObject }) {
  return <div data-composition-text={object.id} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: object.labelAlign === 'center' ? 'center' : 'space-between', gap: 28,
    width: object.autoWidth ? 'max-content' : '100%', minHeight: '100%', maxWidth: object.autoWidth ? undefined : '100%', boxSizing: 'border-box',
    padding: object.padding, background: object.fill, color: object.color, border: object.border || 'none', borderRadius: object.radius,
    fontFamily: '"Poster Manrope", sans-serif', fontSize: object.fontSize, fontWeight: 700, lineHeight: 1.3 }}>
    <span data-composition-label style={{ minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{object.text}</span>
    {object.arrow && <ArrowUpRight width={object.fontSize} height={object.fontSize} style={{ flexShrink: 0 }} aria-hidden="true" />}
  </div>;
}
