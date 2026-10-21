import { useEffect, useRef, useState } from 'react';
import type { EditorSnapshot } from '../useHistory';
import type { CanvasTextDocument, CanvasTextLayer, TextCanvasSize, TextFont } from './types';
import { addText, changeTextFont, deleteText, initialTextColor, updateText } from './document';

type History = {
  beginTransaction: (snapshot?: EditorSnapshot) => void;
  commitTransaction: (snapshot?: EditorSnapshot) => void;
  cancelTransaction: () => void;
};
type Session = { id: string; kind: 'content' | 'fontSize' | 'color'; value: string; composing: boolean; error: string };

/** Ephemeral editor state never enters the document or history. */
export function useCanvasTextEditor(snapshot: EditorSnapshot, setDocument: (doc: CanvasTextDocument) => void, size: TextCanvasSize, history: History) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState('');
  const latest = useRef(snapshot); latest.current = snapshot;
  const liveSession = useRef(session);
  const saveSession = (next: Session | null) => { liveSession.current = next; setSession(next); };
  const active = snapshot.textDocument.layers.find(layer => layer.id === activeId);
  useEffect(() => {
    if (activeId && !snapshot.textDocument.layers.some(layer => layer.id === activeId)) { setActiveId(null); saveSession(null); }
  }, [snapshot.textDocument, activeId]);
  const applyDocument = (doc: CanvasTextDocument) => { latest.current = { ...latest.current, textDocument: doc }; setDocument(doc); };
  const finish = () => {
    const current = liveSession.current;
    if (!current) return true;
    if (current.composing || current.error) { setMessage(current.composing ? 'Finish composing text before continuing.' : current.error); return false; }
    history.commitTransaction(latest.current); saveSession(null); setMessage(''); return true;
  };
  const cancel = () => { if (!liveSession.current) return; saveSession(null); history.cancelTransaction(); setMessage(''); };
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
      } else {
        const patch = current.kind === 'fontSize' ? { fontSize: value.trim() === '' ? NaN : Number(value) } : { color: value };
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
  const styleStart = (kind: 'fontSize' | 'color') => {
    if (liveSession.current?.kind === kind) return true;
    if (!finish() || !activeId) return false;
    const layer = latest.current.textDocument.layers.find(layer => layer.id === activeId); if (!layer) return false;
    history.beginTransaction(latest.current);
    saveSession({ id: activeId, kind, value: String(layer[kind]), composing: false, error: '' });
    return true;
  };
  const changeStyle = (kind: 'fontSize' | 'color', value: string) => {
    if (!styleStart(kind) || liveSession.current?.kind !== kind || liveSession.current.id !== activeId) return;
    change(value);
  };
  const finishStyle = (kind: 'fontSize' | 'color') => liveSession.current?.kind === kind ? finish() : true;
  const style = (patch: Partial<CanvasTextLayer> | TextFont) => {
    if (!finish() || !activeId) return;
    const layer = latest.current.textDocument.layers.find(layer => layer.id === activeId); if (!layer) return;
    const next = typeof patch === 'string' ? changeTextFont(layer, patch) : { ...layer, ...patch };
    history.beginTransaction(latest.current); applyDocument(updateText(latest.current.textDocument, activeId, next)); history.commitTransaction(latest.current);
    setMessage(typeof patch === 'string' && (next.weight !== layer.weight || next.italic !== layer.italic) ? 'Font adjusted: Gelasio supports up to 700; Manrope uses normal style.' : '');
  };
  const guard = (event: React.SyntheticEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-text-editor-ui]')) return;
    if (!finish()) { event.preventDefault(); event.stopPropagation(); }
  };
  useEffect(() => {
    if (!snapshot.textDocument.layers.length) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [snapshot.textDocument]);
  return { activeId, active, session, message, setMessage, editingId: session?.kind === 'content' ? session.id : null,
    edit, add, remove, select, finish, cancel, change, styleStart, changeStyle, finishStyle, style, guard };
}
