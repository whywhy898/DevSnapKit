import type { CompositionDocument } from './types';
import type { PointerEvent } from 'react';
import { useLayoutEffect, useState } from 'react';
import { compositionFrame } from './document';
import { frameStyle } from './CompositionRenderer';
import { isAnnotation, type AnnotationGesture } from './annotations';
export function CompositionOverlay({ document, selected, size, onStart, onMove, onEnd }: { document: CompositionDocument; selected: string | null; size: { width: number; height: number };
  onStart: (id: string, event: PointerEvent<HTMLElement>, resize?: AnnotationGesture) => void; onMove: (event: PointerEvent<HTMLElement>) => void; onEnd: (event: PointerEvent<HTMLElement>) => void }) {
  const [measuredWidth, setMeasuredWidth] = useState<number>();
  const autoWidth = document.objects.some(node => node.id === selected && node.kind === 'button' && node.autoWidth);
  useLayoutEffect(() => {
    if (!autoWidth || !selected) { setMeasuredWidth(undefined); return; }
    const node = window.document.querySelector<HTMLElement>(`#studio-canvas [data-composition-object="${CSS.escape(selected)}"]`);
    if (!node) return;
    const update = () => setMeasuredWidth(node.offsetWidth); update(); const observer = new ResizeObserver(update); observer.observe(node); return () => observer.disconnect();
  }, [autoWidth, selected]);
  if (!selected || document.hiddenIds.includes(selected) || (selected === 'secondary' && !document.detailVisible) || (selected === 'main' && document.mediaLayout === 'legacy')) return null;
  let frame; try { frame = compositionFrame(document, selected); } catch { return null; }
  if (autoWidth && measuredWidth) frame = { ...frame, widthRatio: measuredWidth / size.width };
  const node = document.objects.find(node => node.id === selected);
  const arrow = isAnnotation(node) && node.annotation === 'arrow' ? node : null;
  return <div data-export-ignore="true" data-text-editor-ui style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 60 }}>
    <div style={{ width: size.width, height: size.height, transform: 'scale(var(--canvas-preview-scale, 1))', transformOrigin: 'top left' }}>
      <div style={{ ...frameStyle(frame), ...(!arrow ? { outline: '2px solid #a5b4fc', boxShadow: '0 0 0 3px #1e1b4b66' } : {}), pointerEvents: 'none' }}>
        {!arrow && <button type="button" aria-label="Move selected object" style={{ position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto', touchAction: 'none', background: '#312e81', color: '#fff', padding: '4px 12px', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 13 }} onPointerDown={e => onStart(selected, e)} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd}>Move</button>}
        {arrow ? (['start', 'end'] as const).map(endpoint => <button key={endpoint} type="button" aria-label={`Arrow ${endpoint} endpoint`} style={{ position: 'absolute', left: `${arrow[endpoint]!.x * 100}%`, top: `${arrow[endpoint]!.y * 100}%`, transform: 'translate(-50%, -50%)', width: 'max(24px, calc(24px / var(--canvas-preview-scale, 1)))', height: 'max(24px, calc(24px / var(--canvas-preview-scale, 1)))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'transparent', border: 0, borderRadius: '50%', pointerEvents: 'auto', touchAction: 'none', cursor: 'crosshair' }} onPointerDown={e => onStart(selected, e, endpoint)} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd}>
          <span aria-hidden="true" style={{ width: 'max(10px, calc(10px / var(--canvas-preview-scale, 1)))', height: 'max(10px, calc(10px / var(--canvas-preview-scale, 1)))', boxSizing: 'border-box', border: 'max(1px, calc(1px / var(--canvas-preview-scale, 1))) solid #1e1b4b', borderRadius: '50%', boxShadow: '0 0 0 max(1px, calc(1px / var(--canvas-preview-scale, 1))) #fff', pointerEvents: 'none' }} />
        </button>)
          : !autoWidth && <button type="button" aria-label="Scale selected object" style={{ position: 'absolute', right: -9, bottom: -9, width: 18, height: 18, ...(isAnnotation(node) ? { right: 0, bottom: 0, transform: 'translate(50%, 50%)', width: 'max(24px, calc(24px / var(--canvas-preview-scale, 1)))', height: 'max(24px, calc(24px / var(--canvas-preview-scale, 1)))' } : {}), background: '#312e81', border: '2px solid #c7d2fe', borderRadius: 3, pointerEvents: 'auto', touchAction: 'none' }} onPointerDown={e => onStart(selected, e, true)} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd} />}
      </div>
    </div>
  </div>;
}
