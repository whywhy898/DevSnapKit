import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CanvasTextDocument, CanvasTextLayer, TextCanvasSize } from './types';
import { textFontFamily } from './CanvasTextLayerRenderer';

interface Props {
  document: CanvasTextDocument; size: TextCanvasSize; activeId: string | null; editingId: string | null;
  draft: string; light: boolean; onEdit: (id: string) => void; onChange: (value: string, composing?: boolean) => void;
  onDone: () => boolean; onCancel: () => void; onDeselect: () => void;
  issues: Record<string, string>;
  recoveryMessage?: string;
  onGestureStart: (id: string, kind: 'move' | 'left' | 'right', scale: number) => number | false;
  onGestureMove: (x: number, y: number) => void;
  onGestureActive: (token: number) => boolean;
}
export function textLayoutStyle(layer: CanvasTextLayer): React.CSSProperties {
  return { fontFamily: `"${textFontFamily(layer.font)}"`, fontSize: layer.fontSize, fontWeight: layer.weight,
    fontStyle: layer.italic ? 'italic' : 'normal', fontSynthesis: 'none', lineHeight: 1.25, color: layer.color,
    textAlign: layer.align, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'normal',
    letterSpacing: 'normal', padding: 0, margin: 0, border: 0, boxSizing: 'border-box' };
}
export function CanvasTextOverlay(props: Props) {
  const { document, size, editingId, activeId, recoveryMessage } = props;
  const recovery = useRef<HTMLDivElement>(null);
  const [dockTop, setDockTop] = useState<number>();
  useLayoutEffect(() => {
    if (!recoveryMessage) return;
    const viewport = window.visualViewport;
    const place = () => setDockTop(viewport ? Math.max(viewport.offsetTop + 8, viewport.offsetTop + viewport.height - (recovery.current?.getBoundingClientRect().height ?? 80) - 12) : undefined);
    place(); const observer = new ResizeObserver(place); if (recovery.current) observer.observe(recovery.current);
    viewport?.addEventListener('resize', place); viewport?.addEventListener('scroll', place);
    return () => { observer.disconnect(); viewport?.removeEventListener('resize', place); viewport?.removeEventListener('scroll', place); };
  }, [recoveryMessage]);
  return <div data-export-ignore="true" data-text-editor-ui style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
    <div data-text-logical-overlay style={{ position: 'absolute', width: size.width, height: size.height, transform: 'scale(var(--canvas-preview-scale, 1))', transformOrigin: 'top left', pointerEvents: 'none' }}>
      {document.layers.map(layer => <div key={layer.id}>{editingId === layer.id ? <InlineText {...props} layer={layer} /> : <button type="button" aria-label={`Edit text ${document.layers.indexOf(layer) + 1}`}
        data-text-hit={layer.id} onClick={() => props.onEdit(layer.id)}
        aria-invalid={!!props.issues[layer.id]} title={props.issues[layer.id]}
        style={{ ...textLayoutStyle(layer), position: 'absolute', left: layer.centerX * size.width, top: layer.centerY * size.height,
          width: layer.widthRatio * size.width, transform: 'translate(-50%, -50%)', minHeight: layer.fontSize * 1.25,
          background: 'transparent', color: 'transparent', cursor: 'text', pointerEvents: 'auto',
          outline: props.issues[layer.id] ? '3px solid #F87171' : activeId === layer.id ? '2px solid #FFFFFF' : 'none', boxShadow: activeId === layer.id ? '0 0 0 4px #111827' : undefined, textDecoration: 'none' }}>
        {layer.content.trim() ? layer.content + (layer.content.endsWith('\n') ? '\u200b' : '') : '\u200b'}
      </button>}
      {activeId === layer.id && <TextHandles {...props} layer={layer} />}
      </div>)}
    </div>
    {recoveryMessage && <div ref={recovery} data-text-edit-recovery aria-label="Recover text edit" className="rounded-xl border border-rose-400 bg-slate-900 px-3 py-3 text-white shadow-lg"
      style={{ position: 'fixed', top: dockTop, bottom: dockTop === undefined ? 12 : undefined, left: '50%', transform: 'translateX(-50%)', zIndex: 80, pointerEvents: 'auto', width: 'min(420px, calc(100vw - 24px))', maxWidth: 'calc(100vw - 24px)' }}>
      <p role="alert" className="text-xs leading-relaxed">{recoveryMessage}</p>
      <button type="button" data-text-cancel onPointerDown={event => event.preventDefault()} onClick={props.onCancel} className="mt-2 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-100">Discard changes</button>
    </div>}
  </div>;
}
function TextHandles(props: Props & { layer: CanvasTextLayer }) {
  const start = useRef<{ x: number; y: number; pointerId: number; token: number } | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const { layer, size } = props;
  const [boxHeight, setBoxHeight] = useState(layer.fontSize * 1.25);
  useLayoutEffect(() => {
    const box = container.current?.parentElement?.querySelector<HTMLElement>('[data-text-edit-layout], [data-text-hit]');
    if (!box) return;
    const update = () => setBoxHeight(box.offsetHeight);
    update(); const observer = new ResizeObserver(update); observer.observe(box); return () => observer.disconnect();
  }, [layer.content, layer.fontSize, layer.widthRatio, layer.font, layer.weight, layer.italic, props.editingId]);
  const handle = (kind: 'move' | 'left' | 'right', label: string, left: number, top: string) => <button type="button" data-text-gesture={kind}
    aria-label={label} title={kind === 'move' ? 'Drag to move. Arrow keys move 1 logical px; Shift moves 10 px.' : 'Drag to reflow text. Use Text width and Text x inputs for keyboard control.'}
    style={{ position: 'absolute', left, top, transform: 'translate(-50%, -50%)', minWidth: 36, minHeight: 36, padding: '4px 8px', border: '2px solid white', borderRadius: 6, background: '#312E81', color: 'white', font: '16px sans-serif', cursor: kind === 'move' ? 'move' : 'ew-resize', touchAction: 'none', pointerEvents: 'auto' }}
    onPointerDown={event => {
      if (event.button !== 0 || start.current) return;
      event.preventDefault(); event.stopPropagation();
      const logical = event.currentTarget.closest('[data-text-logical-overlay]') as HTMLElement;
      const scale = logical.getBoundingClientRect().width / size.width;
      const token = props.onGestureStart(layer.id, kind, scale); if (token === false) return;
      event.currentTarget.focus({ preventScroll: true }); start.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, token };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => { if (start.current?.pointerId === event.pointerId && props.onGestureActive(start.current.token)) { event.stopPropagation(); props.onGestureMove(event.clientX - start.current.x, event.clientY - start.current.y); } }}
    onPointerUp={event => { if (start.current?.pointerId === event.pointerId) { const token = start.current.token; start.current = null; if (props.onGestureActive(token)) props.onDone(); event.currentTarget.releasePointerCapture(event.pointerId); } }}
    onPointerCancel={event => { if (start.current?.pointerId === event.pointerId) { const token = start.current.token; start.current = null; if (props.onGestureActive(token)) props.onCancel(); } }}
    onLostPointerCapture={event => { if (start.current?.pointerId === event.pointerId) { const token = start.current.token; start.current = null; if (props.onGestureActive(token)) props.onCancel(); } }}
    onClick={event => event.stopPropagation()}>{kind === 'move' ? '↔ Move' : '↔'}</button>;
  useEffect(() => {
    const cancel = () => { if (start.current) { const token = start.current.token; start.current = null; if (props.onGestureActive(token)) props.onCancel(); } };
    window.addEventListener('scroll', cancel, true); window.addEventListener('blur', cancel);
    return () => { window.removeEventListener('scroll', cancel, true); window.removeEventListener('blur', cancel); };
  });
  return <div ref={container} style={{ position: 'absolute', left: layer.centerX * size.width, top: layer.centerY * size.height, width: layer.widthRatio * size.width, height: 0, pointerEvents: 'none', zIndex: 60 }}>
    {handle('move', 'Move text', 0, `${-boxHeight / 2 - 24}px`)}{handle('left', 'Text left width handle', -layer.widthRatio * size.width / 2, '0px')}{handle('right', 'Text right width handle', layer.widthRatio * size.width / 2, '0px')}
  </div>;
}
function InlineText({ layer, size, draft, light, onChange, onDone, onCancel }: Props & { layer: CanvasTextLayer }) {
  const input = useRef<HTMLTextAreaElement>(null), measure = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(layer.fontSize * 1.25);
  const [layoutHeight, setLayoutHeight] = useState(layer.fontSize * 1.25);
  useLayoutEffect(() => { input.current?.focus({ preventScroll: true }); input.current?.select(); }, [layer.id]);
  useLayoutEffect(() => {
    const node = measure.current; if (!node) return;
    const update = () => {
      setLayoutHeight(Math.max(layer.fontSize * 1.25, node.offsetHeight));
      setHeight(Math.max(layer.fontSize * 1.25, node.offsetHeight, node.scrollHeight));
    };
    update(); const observer = new ResizeObserver(update); observer.observe(node); return () => observer.disconnect();
  }, [draft, layer]);
  const style = textLayoutStyle(layer);
  return <div data-text-edit-layout style={{ position: 'absolute', left: layer.centerX * size.width, top: layer.centerY * size.height, width: layer.widthRatio * size.width,
    height: layoutHeight, transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}>
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
