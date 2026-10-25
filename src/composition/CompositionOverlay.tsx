import type { CompositionDocument } from './types';
import type { PointerEvent } from 'react';
import { useLayoutEffect, useState } from 'react';
import { compositionFrame } from './document';
import { frameStyle } from './CompositionRenderer';
export function CompositionOverlay({ document, selected, size, onStart, onMove, onEnd }: { document: CompositionDocument; selected: string | null; size: { width: number; height: number };
  onStart: (id: string, event: PointerEvent<HTMLElement>, resize?: boolean) => void; onMove: (event: PointerEvent<HTMLElement>) => void; onEnd: (event: PointerEvent<HTMLElement>) => void }) {
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
  return <div data-export-ignore="true" data-text-editor-ui style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 60 }}>
    <div style={{ width: size.width, height: size.height, transform: 'scale(var(--canvas-preview-scale, 1))', transformOrigin: 'top left' }}>
      <div style={{ ...frameStyle(frame), outline: '2px solid #a5b4fc', boxShadow: '0 0 0 3px #1e1b4b66', pointerEvents: 'none' }}>
        <button type="button" aria-label="Move selected object" style={{ position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto', touchAction: 'none', background: '#312e81', color: '#fff', padding: '4px 12px', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 13 }} onPointerDown={e => onStart(selected, e)} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd}>Move</button>
        {!autoWidth && <button type="button" aria-label="Scale selected object" style={{ position: 'absolute', right: -9, bottom: -9, width: 18, height: 18, background: '#312e81', border: '2px solid #c7d2fe', borderRadius: 3, pointerEvents: 'auto', touchAction: 'none' }} onPointerDown={e => onStart(selected, e, true)} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd} />}
      </div>
    </div>
  </div>;
}
