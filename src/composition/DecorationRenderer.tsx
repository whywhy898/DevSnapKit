import type { ShapeObject } from './types';
export function DecorationRenderer({ object }: { object: ShapeObject }) {
  if (object.shape === 'mark') return <svg width="100%" height="100%" viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="M22 2 40 12v20L22 42 4 32V12Z" fill={object.fill}/><path d="M14 13v17l16-9v10M14 23l16-9" stroke={object.stroke || '#ffdc38'} strokeWidth="4" strokeLinejoin="round" /></svg>;
  return <div style={{ position: 'absolute', inset: 0, borderRadius: object.shape === 'ellipse' || object.shape === 'halo' ? '50%' : object.radius || 0,
    border: object.stroke ? `${object.strokeWidth ?? 1}px solid ${object.stroke}` : undefined, boxShadow: object.shadow,
    background: object.shape === 'halo' ? `radial-gradient(ellipse, ${object.fill}, transparent 70%)` : object.shape === 'grid'
      ? `linear-gradient(${object.fill} 1px,transparent 1px),linear-gradient(90deg,${object.fill} 1px,transparent 1px)` : object.fill,
    backgroundSize: object.shape === 'grid' ? '80px 80px' : undefined }} />;
}
