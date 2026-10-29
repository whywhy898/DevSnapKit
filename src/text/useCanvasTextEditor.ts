import { useEffect, useRef, useState } from 'react';
import type { EditorSnapshot } from '../useHistory';
import type { CanvasTextDocument, CanvasTextLayer, TextCanvasSize, TextFont, TextRunStyle, TextReplacementRange } from './types';
import { addText, changeTextFont, deleteText, initialTextColor, updateText, emphasizeTextRange } from './document';
import { clampTextPosition, geometryPatch, moveTextByScreenDelta, resizeTextByScreenDelta, textHorizontalExtent, type GeometryField, type TextMovementLayout } from './geometry';

type History = {
  beginTransaction: (snapshot?: EditorSnapshot) => void;
  commitTransaction: (snapshot?: EditorSnapshot) => void;
  cancelTransaction: () => void;
};
type Field = 'fontSize' | 'color' | 'lineHeight' | 'letterSpacing' | GeometryField;
type Session = { id: string; kind: 'content' | Field; value: string; composing: boolean; error: string };
type Gesture = { token: number; id: string; kind: 'move' | 'left' | 'right' | 'keyboard'; layer: CanvasTextLayer; size: TextCanvasSize; scale: number; layout: TextMovementLayout };

/** Ephemeral editor state never enters the document or history. */
export function useCanvasTextEditor(snapshot: EditorSnapshot, setDocument: (doc: CanvasTextDocument) => void, size: TextCanvasSize, history: History, root: React.RefObject<HTMLDivElement>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState('');
  const gesture = useRef<Gesture | null>(null);
  const nextGestureToken = useRef(0);
  const [gesturing, setGesturing] = useState(false);
  const latest = useRef(snapshot); latest.current = snapshot;
  const liveSession = useRef(session);
  const compositionRange = useRef<TextReplacementRange>();
  // Native textarea undo groups input on its own. Retain observed run snapshots
  // so a native history event can restore styles that no surviving glyph owns.
  const contentHistory = useRef<{ entries: CanvasTextLayer[]; index: number }>();
  const saveSession = (next: Session | null) => { liveSession.current = next; setSession(next); };
  const active = snapshot.textDocument.layers.find(layer => layer.id === activeId);
  useEffect(() => {
    if (activeId && !snapshot.textDocument.layers.some(layer => layer.id === activeId)) { setActiveId(null); saveSession(null); }
  }, [snapshot.textDocument, activeId]);
  const applyDocument = (doc: CanvasTextDocument) => { latest.current = { ...latest.current, textDocument: doc }; setDocument(doc); };
  const finish = () => {
    if (gesture.current) { gesture.current = null; setGesturing(false); history.commitTransaction(latest.current); }
    const current = liveSession.current;
    if (!current) return true;
    if (current.composing || current.error) { setMessage(current.composing ? 'Finish composing text before continuing.' : current.error); return false; }
    history.commitTransaction(latest.current); compositionRange.current = undefined; contentHistory.current = undefined; saveSession(null); setMessage(''); return true;
  };
  const cancel = () => { if (!liveSession.current && !gesture.current) return; gesture.current = null; compositionRange.current = undefined; contentHistory.current = undefined; setGesturing(false); saveSession(null); history.cancelTransaction(); setMessage(''); };
  const edit = (id: string) => {
    if (liveSession.current?.id === id && liveSession.current.kind === 'content') return;
    if (!finish()) return;
    const layer = latest.current.textDocument.layers.find(layer => layer.id === id); if (!layer) return;
    setActiveId(id); history.beginTransaction(latest.current);
    contentHistory.current = { entries: [layer], index: 0 };
    saveSession({ id, kind: 'content', value: layer.content, composing: false, error: '' }); setMessage('');
  };
  const change = (value: string, composing = liveSession.current?.composing ?? false, replacement?: TextReplacementRange, inputType?: string) => {
    const current = liveSession.current; if (!current) return;
    let error = '';
    try {
      if (current.kind === 'content') {
        if (composing && !current.composing) compositionRange.current = replacement;
        if (!composing) {
          const before = latest.current.textDocument.layers.find(layer => layer.id === current.id);
          const journal = contentHistory.current;
          let target = -1;
          if (before && journal) {
            journal.entries[journal.index] = before;
            const direction = inputType === 'historyUndo' ? -1 : inputType === 'historyRedo' ? 1 : 0;
            if (direction) for (let index = journal.index + direction; index >= 0 && index < journal.entries.length; index += direction) {
              if (journal.entries[index].content === value) { target = index; break; }
            }
          }
          const restored = target >= 0 ? journal!.entries[target] : undefined;
          const patch = restored && (before?.runs || restored.runs) ? { runs: restored.runs ?? [{ text: restored.content }] } : { content: value };
          const next = updateText(latest.current.textDocument, current.id, patch, current.composing ? compositionRange.current ?? replacement : replacement);
          if (journal && target >= 0) journal.index = target;
          else if (journal && next !== latest.current.textDocument) {
            journal.entries.splice(journal.index + 1);
            journal.entries.push(next.layers.find(layer => layer.id === current.id)!); journal.index++;
          }
          if (next !== latest.current.textDocument) applyDocument(next);
          compositionRange.current = undefined;
        }
      } else if (!composing) {
        const patch = ['fontSize', 'lineHeight', 'letterSpacing'].includes(current.kind) ? { [current.kind]: value.trim() === '' ? NaN : Number(value) } : current.kind === 'color' ? { color: value } : geometryPatch(current.kind as GeometryField, value, size);
        applyDocument(updateText(latest.current.textDocument, current.id, patch));
      }
    } catch (e) { error = (e as Error).message; }
    saveSession({ ...current, value, composing, error }); setMessage(error);
  };
  const select = (id: string | null) => { if (finish()) { setActiveId(id); setMessage(''); } };
  const add = () => {
    if (!finish()) return;
    try {
      const canvas = root.current, bounds = canvas?.getBoundingClientRect();
      const scale = canvas && bounds && canvas.offsetWidth ? bounds.width / canvas.offsetWidth : 0;
      const occupied = canvas && bounds && scale > 0 ? Array.from(canvas.querySelectorAll<HTMLElement>('[data-canvas-text]')).map(node => {
        const rect = node.getBoundingClientRect(), horizontal = textHorizontalExtent(node, scale);
        return { left: (rect.left - bounds.left) / scale + horizontal.left, top: (rect.top - bounds.top) / scale,
          width: horizontal.right - horizontal.left, height: Math.max(rect.height / scale, node.offsetHeight, node.scrollHeight) };
      }) : undefined;
      const source = latest.current.primaryMediaOrigin;
      const lightStarter = source?.kind === 'builtin' && source.sampleId === 'workspace' && !latest.current.compositionDocument && latest.current.bgType === 'gradient';
      const next = addText(latest.current.textDocument, size, lightStarter ? '#111827' : initialTextColor(latest.current.bgType, latest.current.solidColor), crypto.randomUUID(), occupied);
      history.beginTransaction(latest.current); applyDocument(next); history.commitTransaction(latest.current);
      edit(next.layers[next.layers.length - 1].id);
    } catch (e) { setMessage((e as Error).message); }
  };
  const remove = () => {
    if (!activeId || !finish()) return;
    history.beginTransaction(latest.current); applyDocument(deleteText(latest.current.textDocument, activeId));
    history.commitTransaction(latest.current); setActiveId(null); setMessage('');
  };
  const styleStart = (kind: Field) => {
    if (liveSession.current?.kind === kind) return true;
    if (!finish() || !activeId) return false;
    const layer = latest.current.textDocument.layers.find(layer => layer.id === activeId); if (!layer) return false;
    history.beginTransaction(latest.current);
    const value = kind === 'x' ? layer.centerX * size.width : kind === 'y' ? layer.centerY * size.height : kind === 'width' ? layer.widthRatio * size.width : kind === 'lineHeight' ? layer.lineHeight ?? 1.25 : kind === 'letterSpacing' ? layer.letterSpacing ?? 0 : layer[kind];
    saveSession({ id: activeId, kind, value: String(value), composing: false, error: '' });
    return true;
  };
  const changeStyle = (kind: Field, value: string) => {
    if (!styleStart(kind) || liveSession.current?.kind !== kind || liveSession.current.id !== activeId) return;
    change(value);
  };
  const finishStyle = (kind: Field) => liveSession.current?.kind === kind ? finish() : true;
  const beginGesture = (id: string, kind: Gesture['kind'], scale = 1) => {
    if (!finish()) return false;
    const layer = latest.current.textDocument.layers.find(item => item.id === id); if (!layer) return false;
    const node = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-canvas-text]') ?? []).find(item => item.dataset.canvasText === id);
    if (layer.content.trim() && (!node || !node.offsetWidth)) { setMessage('Text layout is not ready. Try moving it again.'); return false; }
    const canvas = root.current;
    const previewScale = canvas && canvas.offsetWidth ? canvas.getBoundingClientRect().width / canvas.offsetWidth : scale;
    const minimumHeight = layer.fontSize * (layer.lineHeight ?? 1.25);
    const positionedHeight = node ? node.getBoundingClientRect().height / previewScale : minimumHeight;
    const layout = node ? { height: Math.max(positionedHeight, node.offsetHeight, node.scrollHeight), positionedHeight, horizontal: textHorizontalExtent(node, previewScale) }
      : { height: minimumHeight, positionedHeight: minimumHeight, horizontal: { left: 0, right: layer.widthRatio * size.width } };
    setActiveId(id); history.beginTransaction(latest.current);
    const token = ++nextGestureToken.current;
    gesture.current = { token, id, kind, layer, scale, size, layout }; setGesturing(true); setMessage(''); return token;
  };
  const moveGesture = (x: number, y: number) => {
    const current = gesture.current; if (!current) return;
    try {
      const patch = current.kind === 'left' || current.kind === 'right'
        ? resizeTextByScreenDelta(current.layer, x, current.kind, current.scale, current.size)
        : clampTextPosition(current.layer, moveTextByScreenDelta(current.layer, { x, y }, { previewScale: current.scale, canvasWidth: current.size.width, canvasHeight: current.size.height }), current.size, current.layout);
      applyDocument(updateText(latest.current.textDocument, current.id, patch)); setMessage('');
    } catch (error) { setMessage((error as Error).message); }
  };
  const nudge = (key: string, shift: boolean) => {
    if (!activeId) return false;
    if (gesture.current?.kind !== 'keyboard' && !beginGesture(activeId, 'keyboard')) return true;
    const layer = latest.current.textDocument.layers.find(item => item.id === activeId); if (!layer) return true;
    const step = shift ? 10 : 1;
    try { applyDocument(updateText(latest.current.textDocument, activeId, clampTextPosition(layer, moveTextByScreenDelta(layer,
      { x: key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0, y: key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0 },
      { previewScale: 1, canvasWidth: size.width, canvasHeight: size.height }), size, gesture.current!.layout))); }
    catch (error) { setMessage((error as Error).message); }
    return true;
  };
  const endKeyboard = () => { if (gesture.current?.kind === 'keyboard') finish(); };
  const style = (patch: Partial<CanvasTextLayer> | TextFont) => {
    if (!finish() || !activeId) return;
    const layer = latest.current.textDocument.layers.find(layer => layer.id === activeId); if (!layer) return;
    try {
      const next = typeof patch === 'string' ? changeTextFont(layer, patch) : { ...layer, ...patch };
      const doc = updateText(latest.current.textDocument, activeId, next);
      history.beginTransaction(latest.current); applyDocument(doc); history.commitTransaction(latest.current);
      setMessage(typeof patch === 'string' && (next.weight !== layer.weight || next.italic !== layer.italic) ? 'Font adjusted: Gelasio supports up to 700; Manrope uses normal style.' : '');
    } catch (error) { setMessage((error as Error).message); }
  };
  const emphasize = (style: TextRunStyle) => {
    const current = liveSession.current;
    if (!current || current.kind !== 'content') { setMessage('Edit text and select a range to emphasize.'); return; }
    if (current.composing || current.error) { setMessage(current.error || 'Finish composing text before applying emphasis.'); return; }
    // The overlay is a sibling of the export artwork, deliberately outside its root.
    const selector = 'textarea[aria-label="Text content"]';
    const input = root.current?.parentElement?.querySelector<HTMLTextAreaElement>(selector) ?? root.current?.querySelector<HTMLTextAreaElement>(selector);
    if (!input || input.selectionStart === input.selectionEnd) { setMessage('Select the text to emphasize first.'); return; }
    try {
      const next = emphasizeTextRange(latest.current.textDocument, current.id, input.selectionStart, input.selectionEnd, style);
      if (next !== latest.current.textDocument) applyDocument(next);
      input.focus({ preventScroll: true }); setMessage('');
    } catch (error) { setMessage((error as Error).message); }
  };
  const guard = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLElement;
    if (gesture.current && !target.closest('[data-text-gesture]')) finish();
    if (target.closest('[data-text-editor-ui]')) return;
    if (!finish()) { event.preventDefault(); event.stopPropagation(); }
  };
  useEffect(() => {
    if (!snapshot.textDocument.layers.length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [snapshot.textDocument]);
  return { activeId, active, session, message, setMessage, size, gesturing, editingId: session?.kind === 'content' ? session.id : null,
    beginGesture, moveGesture, nudge, endKeyboard, hasGesture: (token?: number) => token === undefined ? !!gesture.current : gesture.current?.token === token,
    edit, add, remove, select, finish, cancel, change, styleStart, changeStyle, finishStyle, style, emphasize, guard };
}
