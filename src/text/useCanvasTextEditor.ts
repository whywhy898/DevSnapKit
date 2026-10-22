import { useEffect, useRef, useState } from 'react';
import type { EditorSnapshot } from '../useHistory';
import type { CanvasTextDocument, CanvasTextLayer, TextCanvasSize, TextFont } from './types';
import { addText, changeTextFont, deleteText, initialTextColor, updateText } from './document';
import { clampTextPosition, geometryPatch, moveTextByScreenDelta, resizeTextByScreenDelta, textHorizontalExtent, type GeometryField, type TextMovementLayout } from './geometry';

type History = {
  beginTransaction: (snapshot?: EditorSnapshot) => void;
  commitTransaction: (snapshot?: EditorSnapshot) => void;
  cancelTransaction: () => void;
};
type Field = 'fontSize' | 'color' | GeometryField;
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
    history.commitTransaction(latest.current); saveSession(null); setMessage(''); return true;
  };
  const cancel = () => { if (!liveSession.current && !gesture.current) return; gesture.current = null; setGesturing(false); saveSession(null); history.cancelTransaction(); setMessage(''); };
  const edit = (id: string) => {
    if (liveSession.current?.id === id && liveSession.current.kind === 'content') return;
    if (!finish()) return;
    const layer = latest.current.textDocument.layers.find(layer => layer.id === id); if (!layer) return;
    setActiveId(id); history.beginTransaction(latest.current);
    saveSession({ id, kind: 'content', value: layer.content, composing: false, error: '' }); setMessage('');
  };
  const change = (value: string, composing = liveSession.current?.composing ?? false) => {
    const current = liveSession.current; if (!current) return;
    let error = '';
    try {
      if (current.kind === 'content') {
        if (!composing) applyDocument(updateText(latest.current.textDocument, current.id, { content: value }));
      } else if (!composing) {
        const patch = current.kind === 'fontSize' ? { fontSize: value.trim() === '' ? NaN : Number(value) } : current.kind === 'color' ? { color: value } : geometryPatch(current.kind, value, size);
        applyDocument(updateText(latest.current.textDocument, current.id, patch));
      }
    } catch (e) { error = (e as Error).message; }
    saveSession({ ...current, value, composing, error }); setMessage(error);
  };
  const select = (id: string | null) => { if (finish()) { setActiveId(id); setMessage(''); } };
  const add = () => {
    if (!finish()) return;
    try {
      const next = addText(latest.current.textDocument, size, initialTextColor(latest.current.bgType, latest.current.solidColor));
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
    const value = kind === 'x' ? layer.centerX * size.width : kind === 'y' ? layer.centerY * size.height : kind === 'width' ? layer.widthRatio * size.width : layer[kind];
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
    const positionedHeight = node ? node.getBoundingClientRect().height / previewScale : layer.fontSize * 1.25;
    const layout = node ? { height: Math.max(positionedHeight, node.offsetHeight, node.scrollHeight), positionedHeight, horizontal: textHorizontalExtent(node, previewScale) }
      : { height: layer.fontSize * 1.25, positionedHeight: layer.fontSize * 1.25, horizontal: { left: 0, right: layer.widthRatio * size.width } };
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
    const next = typeof patch === 'string' ? changeTextFont(layer, patch) : { ...layer, ...patch };
    history.beginTransaction(latest.current); applyDocument(updateText(latest.current.textDocument, activeId, next)); history.commitTransaction(latest.current);
    setMessage(typeof patch === 'string' && (next.weight !== layer.weight || next.italic !== layer.italic) ? 'Font adjusted: Gelasio supports up to 700; Manrope uses normal style.' : '');
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
    edit, add, remove, select, finish, cancel, change, styleStart, changeStyle, finishStyle, style, guard };
}
