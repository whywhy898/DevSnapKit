import { ArrowUpRight } from 'lucide-react';
import type { ButtonObject } from './types';
export function ButtonRenderer({ object, contentScale = 1 }: { object: ButtonObject; contentScale?: number }) {
  const scale = Number.isFinite(contentScale) && contentScale > 0 ? Math.min(1, contentScale) : 1;
  return <div data-composition-text={object.id} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: object.labelAlign === 'center' ? 'center' : 'space-between', gap: 28 * scale,
    width: object.autoWidth ? 'max-content' : '100%', minHeight: '100%', maxWidth: object.autoWidth ? undefined : '100%', boxSizing: 'border-box',
    padding: object.padding * scale, background: object.fill, color: object.color, border: object.border || 'none', borderRadius: object.radius * scale,
    fontFamily: '"Poster Manrope", sans-serif', fontSize: object.fontSize * scale, fontWeight: 700, lineHeight: 1.3 }}>
    <span data-composition-label style={{ minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{object.text}</span>
    {object.arrow && <ArrowUpRight width={object.fontSize * scale} height={object.fontSize * scale} style={{ flexShrink: 0 }} aria-hidden="true" />}
  </div>;
}
