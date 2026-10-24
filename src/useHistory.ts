import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { EditorHistory } from './editorHistory';
import type { CanvasTextDocument } from './text/types';
import { WindowTheme } from './MockupUnit';
import { CornerStyle, LayoutPreset } from './stylePresets';
import { DuoLayoutType } from './DuoThumbnail';
import type { PrimaryMediaOrigin, TemplateContext } from './templates/types';

export interface EditorSnapshot {
  templateContext?: TemplateContext | null;
  primaryMediaOrigin?: PrimaryMediaOrigin;
  textDocument: CanvasTextDocument;
  gradientId: string;
  selectedPreset: string;
  imageSrc: string;
  imageName: string;
  windowTheme: WindowTheme;
  windowTitle: string;
  padding: number;
  roundedCorners: number;
  shadowLevel: string;
  shadowOpacity: number;
  activeCuratedLayout: string;
  cornerStyle: CornerStyle;
  layoutPreset: LayoutPreset;
  aspectRatioId: string;
  customCanvasSize: { width: number; height: number };
  secondarySrc: string | null;
  secondaryName: string;
  layoutMode: 'single' | 'duo';
  duoLayout: DuoLayoutType;
  bgType: string;
  solidColor: string;
  isCustomGradient: boolean;
  customGradColor1: string;
  customGradColor2: string;
  customGradAngle: number;
  selectedPattern: string;
  vfxNoise: boolean;
  vfxNoiseOpacity: number;
  vfxGlow: boolean;
  vfxGlowColor: string;
  vfxGlowOpacity: number;
  customBrandWatermark: string;
  logoDataUrl: string | null;
  logoPos: string;
  logoScale: number;
  logoOpacity: number;
  qrUrl: string;
  qrPos: string;
  qrScale: number;
  // F3
  bgImageSrc: string | null;
  bgImageBlur: number;
  bgImageOpacity: number;
  bgImageFit: 'cover' | 'contain';
  // F4
  hideMockup: boolean;
  // F7 Shots-aligned Mockup Zoom & Pan (Camera Dolly)
  mockupZoom: number;
  mockupOffsetX: number;
  mockupOffsetY: number;
  // F7 In-Frame Image Crop & Pan
  imageZoom: number;
  imageOffsetX: number;
  imageOffsetY: number;
}

export function useEditorHistory(
  currentSnapshot: EditorSnapshot,
  onRestore: (snapshot: EditorSnapshot) => void,
  maxHistory: number = 50
) {
  const history = useRef<EditorHistory<EditorSnapshot>>();
  history.current ??= new EditorHistory(currentSnapshot, maxHistory);
  const latest = useRef(currentSnapshot); latest.current = currentSnapshot;
  const restore = useRef(onRestore); restore.current = onRestore;
  const awaiting = useRef<EditorSnapshot | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [, refresh] = useState(0);
  const [navigationRevision, setNavigationRevision] = useState(0);
  const notify = useCallback(() => refresh(n => n + 1), []);
  const stopTimer = useCallback(() => { clearTimeout(timer.current); }, []);
  const apply = useCallback((snapshot: EditorSnapshot, navigation = false) => {
    awaiting.current = history.current!.equal(snapshot, latest.current) ? null : snapshot;
    latest.current = snapshot;
    restore.current(snapshot);
    if (navigation) setNavigationRevision(n => n + 1);
    notify();
  }, [notify]);
  // Acknowledge the actual restored render, never a guessed timeout window.
  useLayoutEffect(() => {
    if (awaiting.current && history.current!.equal(awaiting.current, currentSnapshot)) awaiting.current = null;
  }, [currentSnapshot]);
  useEffect(() => {
    stopTimer();
    if (awaiting.current || history.current!.inTransaction) return;
    timer.current = setTimeout(() => { history.current!.flush(latest.current); notify(); }, 400);
    return stopTimer;
  }, [currentSnapshot, stopTimer, notify]);
  const flush = useCallback((snapshot = latest.current) => { stopTimer(); history.current!.flush(snapshot); notify(); }, [stopTimer, notify]);
  const beginTransaction = useCallback((snapshot = latest.current) => { stopTimer(); history.current!.beginTransaction(snapshot); notify(); }, [stopTimer, notify]);
  const commitTransaction = useCallback((snapshot = latest.current) => { stopTimer(); history.current!.commitTransaction(snapshot); notify(); }, [stopTimer, notify]);
  const cancelTransaction = useCallback(() => { stopTimer(); apply(history.current!.cancelTransaction()); }, [stopTimer, apply]);
  const undo = useCallback(() => { stopTimer(); apply(history.current!.undo(latest.current), true); }, [stopTimer, apply]);
  const redo = useCallback(() => {
    const h = history.current!;
    if (h.inTransaction || !h.canRedo || !h.equal(h.current, latest.current)) return;
    stopTimer(); apply(h.redo(), true);
  }, [stopTimer, apply]);
  const undoCommit = useCallback((id: number) => {
    const target = history.current!.undoCommit(id, latest.current);
    if (!target) return false;
    stopTimer(); apply(target, true); return true;
  }, [stopTimer, apply]);
  // Explicit commands enter history before restoring React state. Immediate
  // navigation therefore works even before the restored render is acknowledged.
  const applyCommand = useCallback((snapshot: EditorSnapshot) => {
    const h = history.current!;
    if (awaiting.current || h.inTransaction || h.equal(latest.current, snapshot)) return false;
    // A command is an explicit restoration, like Undo/Redo. Size validation
    // must not re-record its before/after snapshots as a separate size edit.
    stopTimer(); h.flush(latest.current); h.flush(snapshot); apply(snapshot, true); return true;
  }, [stopTimer, apply]);
  const pending = !history.current.equal(history.current.current, currentSnapshot);
  return { canUndo: history.current.canUndo || pending, canRedo: history.current.canRedo && !pending,
    historyCount: history.current.count, historyIndex: history.current.index,
    undo, redo, flush, beginTransaction, commitTransaction, cancelTransaction, applyCommand,
    undoCommit, getCommitId: () => history.current!.currentCommitId,
    navigationRevision,
    isCurrentCommit: (id: number) => !history.current!.inTransaction && history.current!.currentCommitId === id && history.current!.equal(history.current!.current, latest.current),
    getCommittedSnapshot: () => history.current!.current,
    getLatestSnapshot: () => latest.current,
    getPreviousSnapshot: () => history.current!.previous,
    isInTransaction: () => history.current!.inTransaction };
}
