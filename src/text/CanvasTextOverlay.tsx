import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CanvasTextDocument, CanvasTextLayer, TextCanvasSize } from './types';
import { textFontFamily } from './CanvasTextLayerRenderer';

interface Props {
  document: CanvasTextDocument; size: TextCanvasSize; activeId: string | null; editingId: string | null;
  draft: string; light: boolean; onEdit: (id: string) => void; onChange: (value: string, composing?: boolean) => void;
  onDone: () => boolean; onCancel: () => void; onDeselect: () => void;
}
export function textLayoutStyle(layer: CanvasTextLayer): React.CSSProperties {
  return { fontFamily: `"${textFontFamily(layer.font)}"`, fontSize: layer.fontSize, fontWeight: layer.weight,
    fontStyle: layer.italic ? 'italic' : 'normal', fontSynthesis: 'none', lineHeight: 1.25, color: layer.color,
    textAlign: layer.align, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'normal',
    letterSpacing: 'normal', padding: 0, margin: 0, border: 0, boxSizing: 'border-box' };
}
export function CanvasTextOverlay(props: Props) {
  const { document, size, editingId, activeId } = props;
  const [dockTop, setDockTop] = useState<number>();
  useEffect(() => {
    if (!editingId) return;
    const viewport = window.visualViewport;
    if (!viewport) { setDockTop(undefined); return; }
    const place = () => setDockTop(Math.max(8, viewport.offsetTop + viewport.height - 60));
    place(); viewport.addEventListener('resize', place); viewport.addEventListener('scroll', place);
    return () => { viewport.removeEventListener('resize', place); viewport.removeEventListener('scroll', place); };
  }, [editingId]);
  return <div data-export-ignore="true" data-text-editor-ui style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
    <div style={{ position: 'absolute', width: size.width, height: size.height, transform: 'scale(var(--canvas-preview-scale, 1))', transformOrigin: 'top left', pointerEvents: 'none' }}>
      {document.layers.map(layer => editingId === layer.id ? <InlineText key={layer.id} {...props} layer={layer} /> : <button key={layer.id} type="button" aria-label={`Edit text ${document.layers.indexOf(layer) + 1}`}
        data-text-hit={layer.id} onClick={() => props.onEdit(layer.id)}
        style={{ ...textLayoutStyle(layer), position: 'absolute', left: layer.centerX * size.width, top: layer.centerY * size.height,
          width: layer.widthRatio * size.width, transform: 'translate(-50%, -50%)', minHeight: layer.fontSize * 1.25,
          background: 'transparent', color: 'transparent', cursor: 'text', pointerEvents: 'auto',
          outline: activeId === layer.id ? '2px solid #FFFFFF' : 'none', boxShadow: activeId === layer.id ? '0 0 0 4px #111827' : undefined, textDecoration: 'none' }}>
        {layer.content.trim() ? layer.content + (layer.content.endsWith('\n') ? '\u200b' : '') : '\u200b'}
      </button>)}
    </div>
    {editingId && <div data-text-edit-dock aria-label="Finish text editing" className="flex items-center gap-2 rounded-xl border border-slate-500 bg-slate-900 px-3 py-2 text-white shadow-lg"
      style={{ position: 'fixed', top: dockTop, bottom: dockTop === undefined ? 12 : undefined, left: '50%', transform: 'translateX(-50%)', zIndex: 80, pointerEvents: 'auto', maxWidth: 'calc(100vw - 24px)' }}>
      <span className="text-xs text-slate-300">Editing text</span>
      <button type="button" onPointerDown={event => event.preventDefault()} onClick={props.onDone} className="rounded-lg bg-indigo-600 px-3 py-1 text-sm">Done</button>
      <button type="button" data-text-cancel onPointerDown={event => event.preventDefault()} onClick={props.onCancel} className="rounded-lg border border-slate-500 px-3 py-1 text-sm">Cancel</button>
    </div>}
  </div>;
}
function InlineText({ layer, size, draft, light, onChange, onDone, onCancel }: Props & { layer: CanvasTextLayer }) {
  const input = useRef<HTMLTextAreaElement>(null), measure = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(layer.fontSize * 1.25);
  useLayoutEffect(() => { input.current?.focus({ preventScroll: true }); input.current?.select(); }, [layer.id]);
  useLayoutEffect(() => {
    const node = measure.current; if (!node) return;
    const update = () => setHeight(Math.max(layer.fontSize * 1.25, node.offsetHeight, node.scrollHeight));
    update(); const observer = new ResizeObserver(update); observer.observe(node); return () => observer.disconnect();
  }, [draft, layer]);
  const style = textLayoutStyle(layer);
  return <div style={{ position: 'absolute', left: layer.centerX * size.width, top: layer.centerY * size.height, width: layer.widthRatio * size.width,
    height, transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}>
    <div ref={measure} aria-hidden style={{ ...style, visibility: 'hidden', width: '100%', position: 'absolute', pointerEvents: 'none' }}>{draft + (draft.endsWith('\n') || !draft ? '\u200b' : '')}</div>
    <textarea ref={input} aria-label="Text content" value={draft} rows={1} spellCheck={false}
      style={{ ...style, display: 'block', width: '100%', height, resize: 'none', overflow: 'hidden', borderRadius: 0,
        background: light ? 'rgba(255,255,255,.55)' : 'rgba(15,23,42,.55)', outline: '2px solid #FFFFFF', boxShadow: '0 0 0 4px #111827', caretColor: layer.color, appearance: 'none' }}
      onChange={event => onChange(event.target.value)}
      onCompositionStart={event => onChange(event.currentTarget.value, true)}
      onCompositionEnd={event => onChange(event.currentTarget.value, false)}
      onBlur={event => { if (!(event.relatedTarget as HTMLElement | null)?.closest('[data-text-editor-ui]')) onDone(); }}
      onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onCancel(); } }} />
  </div>;
}
