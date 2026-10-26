import type { ShapeObject } from './types';
export function DecorationRenderer({ object }: { object: ShapeObject }) {
  if (object.shape === 'mark' && object.markVariant === 'orbit') return <svg width="100%" height="100%" viewBox="0 0 44 44" fill="none" aria-hidden="true"><circle cx="22" cy="22" r="21" fill={object.fill}/><path d="M29 8a15 15 0 1 0 0 28A20 20 0 0 1 29 8Z" fill={object.stroke || '#F6F3EC'}/></svg>;
  if (object.shape === 'mark') return <svg width="100%" height="100%" viewBox="0 0 44 44" fill="none" aria-hidden="true"><rect x="3" y="3" width="38" height="38" rx="10" fill={object.fill}/><path d="M16 11v21h8a6 6 0 0 0 0-12h-8m0 0h8" stroke={object.stroke || '#ffdc38'} strokeWidth="4" strokeLinejoin="round" /></svg>;
  return <div style={{ position: 'absolute', inset: 0, borderRadius: object.shape === 'ellipse' || object.shape === 'halo' ? '50%' : object.radius || 0,
    border: object.stroke ? `${object.strokeWidth ?? 1}px solid ${object.stroke}` : undefined, boxShadow: object.shadow,
    filter: typeof object.blur === 'number' && Number.isFinite(object.blur) ? `blur(${Math.max(0, object.blur)}px)` : undefined,
    background: object.shape === 'halo' ? `radial-gradient(ellipse, ${object.fill}, transparent 70%)` : object.shape === 'grid'
      ? `linear-gradient(${object.fill} 1px,transparent 1px),linear-gradient(90deg,${object.fill} 1px,transparent 1px)` : object.fill,
    backgroundSize: object.shape === 'grid' ? '80px 80px' : undefined }} />;
}
