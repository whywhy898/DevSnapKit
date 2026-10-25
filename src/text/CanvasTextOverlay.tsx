import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasTextDocument, CanvasTextLayer, TextCanvasSize, TextReplacementRange } from './types';
import { textLayoutStyle, TextRunContent } from './textPresentation';
import { replaceTextContent } from './document';
import { useRichTextSelection } from './useRichTextSelection';
import { nearestTextHit } from './hitTesting';
export { textLayoutStyle } from './textPresentation';

interface Props {
  document: CanvasTextDocument; size: TextCanvasSize; activeId: string | null; editingId: string | null;
  draft: string; light: boolean; onEdit: (id: string) => void; onChange: (value: string, composing?: boolean, replacement?: TextReplacementRange, inputType?: string) => void;
  onDone: () => boolean; onCancel: () => void; onDeselect: () => void;
  issues: Record<string, string>;
  recoveryMessage?: string;
  compositionHitTargets?: boolean;
  onArtworkHit?: (id: string) => void;
  onGestureStart: (id: string, kind: 'move' | 'left' | 'right', scale: number) => number | false;
  onGestureMove: (x: number, y: number) => void;
  onGestureActive: (token: number) => boolean;
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
      {document.layers.map(layer => <div key={layer.id}>{editingId === layer.id ? <InlineText {...props} layer={layer} /> : <TextHit {...props} layer={layer} index={document.layers.indexOf(layer)} />}
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
function TextHit(props: Props & { layer: CanvasTextLayer; index: number }) {
  const { layer, size, activeId, compositionHitTargets } = props;
  const onEdit = useRef(props.onEdit); onEdit.current = props.onEdit;
  const onArtworkHit = useRef(props.onArtworkHit); onArtworkHit.current = props.onArtworkHit;
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setTarget(compositionHitTargets ? window.document.querySelector<HTMLElement>(`[data-composition-text="${CSS.escape(layer.id)}"]`) : null); }, [compositionHitTargets, layer.id]);
  const issue = props.issues[layer.id], selected = activeId === layer.id;
  const hit = useMemo(() => <button type="button" aria-label={`Edit text ${props.index + 1}`} data-export-ignore="true" data-text-editor-ui data-text-hit={layer.id} onClick={event => {
      if (!event.detail) { onEdit.current(layer.id); return; }
      const stage = event.currentTarget.closest('[data-canvas-stage]'), candidates = [], seen = new Set<string>();
      const elements = window.document.elementsFromPoint(event.clientX, event.clientY);
      for (const node of elements) {
        const button = node.closest<HTMLElement>('[data-text-hit]'), id = button?.dataset.textHit;
        if (id && stage?.contains(button!)) {
          const glyph = stage.querySelector<HTMLElement>(`[data-canvas-text="${CSS.escape(id)}"]`) || button!.querySelector<HTMLElement>('span');
          if (glyph && !seen.has(id)) { seen.add(id); candidates.push({ id, rect: glyph.getBoundingClientRect() }); }
        } else if (node.closest('[data-composition-object]')) break;
      }
      const text = nearestTextHit(candidates, event.clientX, event.clientY), actual = candidates.find(item => item.id === text)?.rect;
      const onGlyph = actual && event.clientX >= actual.left && event.clientX <= actual.right && event.clientY >= actual.top && event.clientY <= actual.bottom;
      if (!onGlyph && onArtworkHit.current) {
        // Padded targets must not steal clicks from a visible image or CTA.
        for (const node of elements) {
          const media = node.closest('[data-media-surface]'), object = node.closest<HTMLElement>('[data-composition-object]');
          const id = media ? (media.closest<HTMLElement>('[data-scene-slot]')?.dataset.sceneSlot === '2' ? 'secondary' : object?.dataset.compositionObject || 'main') : object?.dataset.compositionObject;
          if (id && (media || !['main', 'secondary'].includes(id))) { onArtworkHit.current(id); return; }
        }
      }
      onEdit.current(text || layer.id);
    }}
    aria-invalid={!!props.issues[layer.id]} title={props.issues[layer.id]} style={{ ...textLayoutStyle(layer), position: 'absolute',
      left: `clamp(calc(var(--text-hit-size) / var(--canvas-preview-scale, 1) / 2), ${layer.centerX * size.width}px, calc(${size.width}px - var(--text-hit-size) / var(--canvas-preview-scale, 1) / 2))`,
      top: `clamp(calc(var(--text-hit-size) / var(--canvas-preview-scale, 1) / 2), ${layer.centerY * size.height}px, calc(${size.height}px - var(--text-hit-size) / var(--canvas-preview-scale, 1) / 2))`,
      width: layer.widthRatio * size.width, minWidth: 'calc(var(--text-hit-size) / var(--canvas-preview-scale, 1))', transform: 'translate(-50%, -50%)', minHeight: `max(${layer.fontSize * Math.max(1.25, layer.lineHeight ?? 1.25)}px, calc(var(--text-hit-size) / var(--canvas-preview-scale, 1)))`, background: 'transparent', color: 'transparent', cursor: 'text', pointerEvents: 'auto', zIndex: 41,
      outline: props.issues[layer.id] ? '3px solid #F87171' : activeId === layer.id ? '2px solid #FFFFFF' : 'none', boxShadow: activeId === layer.id ? '0 0 0 4px #111827' : undefined, textDecoration: 'none' }}>
      <span style={{ visibility: 'hidden', display: 'block', width: layer.widthRatio * size.width }}><TextRunContent layer={layer} marker /></span></button>, [layer, size.width, size.height, props.index, issue, selected]);
  // Keep hit testing in the same stacking context as the artwork it edits.
  // Covered text remains accessible through Objects, without blocking media.
  return compositionHitTargets ? target && createPortal(hit, target) : hit;
}
function TextHandles(props: Props & { layer: CanvasTextLayer }) {
  const start = useRef<{ x: number; y: number; pointerId: number; token: number } | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const { layer, size } = props;
  const runMetrics = JSON.stringify(layer.runs);
  const [boxHeight, setBoxHeight] = useState(layer.fontSize * (layer.lineHeight ?? 1.25));
  useLayoutEffect(() => {
    const box = container.current?.parentElement?.querySelector<HTMLElement>('[data-text-edit-layout]')
      || window.document.querySelector<HTMLElement>(`#studio-canvas [data-canvas-text="${CSS.escape(layer.id)}"]`);
    if (!box) return;
    const update = () => setBoxHeight(box.offsetHeight);
    update(); const observer = new ResizeObserver(update); observer.observe(box); return () => observer.disconnect();
  }, [layer.id, layer.content, runMetrics, layer.widthRatio, layer.font, layer.fontSize, layer.weight, layer.italic, layer.lineHeight, layer.letterSpacing, layer.textTransform, size.width, props.editingId]);
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
  const pendingInput = useRef<{ value: string; start: number; end: number; inputType: string }>();
  const composition = useRef<TextReplacementRange>();
  const visualReplacement = useRef<TextReplacementRange>();
  const capture = (node: HTMLTextAreaElement, inputType: string) => { pendingInput.current = { value: node.value, start: node.selectionStart, end: node.selectionEnd, inputType }; };
  useLayoutEffect(() => {
    const node = input.current; if (!node) return;
    // React's before-input polyfill omits some deletion events; use the native event.
    const before = (event: Event) => capture(node, (event as InputEvent).inputType);
    node.addEventListener('beforeinput', before); return () => node.removeEventListener('beforeinput', before);
  }, []);
  const changed = (value: string, nativeInputType?: string) => {
    let replacement = composition.current;
    const pending = pendingInput.current; pendingInput.current = undefined;
    const inputType = nativeInputType || pending?.inputType;
    // An invalid draft may differ from the saved document. Its DOM offsets are
    // not replacement offsets in that document, so use the deterministic diff.
    if (!replacement && pending && pending.value === layer.content && !pending.inputType.startsWith('history')) {
      let { start, end } = pending;
      if (start === end && pending.inputType.startsWith('delete')) {
        const removed = Math.max(0, pending.value.length - value.length);
        if (pending.inputType.endsWith('Backward')) start -= removed; else end += removed;
      }
      const prefix = pending.value.slice(0, start), suffix = pending.value.slice(end);
      if (start >= 0 && end <= pending.value.length && value.length >= prefix.length + suffix.length && value.startsWith(prefix) && value.endsWith(suffix)) replacement = { start, end };
    }
    visualReplacement.current = replacement; onChange(value, undefined, replacement, inputType);
  };
  const minimum = layer.fontSize * (layer.lineHeight ?? 1.25);
  const [height, setHeight] = useState(minimum);
  const [layoutHeight, setLayoutHeight] = useState(minimum);
  const rich = layer.runs !== undefined;
  const visual = rich ? { ...layer, content: draft, runs: draft === layer.content ? layer.runs : replaceTextContent(layer, draft, composition.current ?? visualReplacement.current) } : { ...layer, content: draft };
  const selection = useRichTextSelection(input, measure, rich, draft, layer);
  useLayoutEffect(() => { input.current?.focus({ preventScroll: true }); input.current?.select(); }, [layer.id]);
  useLayoutEffect(() => {
    const node = measure.current; if (!node) return;
    const update = () => {
      setLayoutHeight(Math.max(minimum, node.offsetHeight));
      setHeight(Math.max(minimum, node.offsetHeight, node.scrollHeight));
    };
    update(); const observer = new ResizeObserver(update); observer.observe(node); return () => observer.disconnect();
  }, [draft, layer]);
  const style = textLayoutStyle(layer);
  return <div data-text-edit-layout style={{ position: 'absolute', left: layer.centerX * size.width, top: layer.centerY * size.height, width: layer.widthRatio * size.width,
    height: layoutHeight, transform: 'translate(-50%, -50%)', pointerEvents: 'auto' }}
    onPointerDown={selection.onPointerDown} onPointerMove={selection.onPointerMove} onPointerUp={selection.onPointerUp} onPointerCancel={selection.onPointerUp}>
    <div ref={measure} aria-hidden data-text-rich-mirror={rich ? '' : undefined} style={{ ...style, visibility: rich ? 'visible' : 'hidden', width: '100%', position: 'absolute', pointerEvents: rich ? 'auto' : 'none', userSelect: 'none' }}><TextRunContent layer={visual} marker /></div>
    {rich && selection.selection.map((box, index) => <div key={index} data-text-rich-selection style={{ position: 'absolute', ...box, pointerEvents: 'none', background: '#6366f1', opacity: .35 }} />)}
    {rich && selection.caret && <div data-text-rich-caret style={{ position: 'absolute', ...selection.caret, width: 1.5, minHeight: layer.fontSize, background: layer.color, pointerEvents: 'none' }} />}
    <textarea ref={input} aria-label="Text content" data-text-rich-input={rich ? '' : undefined} value={draft} rows={1} spellCheck={false}
      style={{ ...style, display: 'block', width: '100%', height, resize: 'none', overflow: 'hidden', borderRadius: 0,
        background: rich ? 'transparent' : light ? 'rgba(255,255,255,.55)' : 'rgba(15,23,42,.55)', outline: '2px solid #FFFFFF', boxShadow: '0 0 0 4px #111827', caretColor: rich ? 'transparent' : layer.color, color: rich ? 'transparent' : style.color, pointerEvents: rich ? 'none' : 'auto', appearance: 'none' }}
      onSelect={selection.sync}
      onChange={event => changed(event.target.value, (event.nativeEvent as InputEvent).inputType)}
      onCompositionStart={event => { composition.current = event.currentTarget.value === layer.content ? { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd } : undefined; onChange(event.currentTarget.value, true, composition.current); }}
      onCompositionEnd={event => { const replacement = composition.current; composition.current = undefined; pendingInput.current = undefined; visualReplacement.current = replacement; onChange(event.currentTarget.value, false, replacement); }}
      onBlur={event => { if (!(event.relatedTarget as HTMLElement | null)?.closest('[data-text-editor-ui]')) onDone(); }}
      onKeyDown={event => {
        event.stopPropagation(); selection.onKeyDown(event);
        if (!event.nativeEvent.isComposing && !event.defaultPrevented && (event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter' || event.key.length === 1)) capture(event.currentTarget, event.key === 'Backspace' ? 'deleteContentBackward' : event.key === 'Delete' ? 'deleteContentForward' : 'insertText');
        if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.preventDefault(); onCancel(); }
      }} />
  </div>;
}
