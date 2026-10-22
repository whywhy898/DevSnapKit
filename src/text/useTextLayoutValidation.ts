import { useLayoutEffect, useEffect, useRef, useState } from 'react';
import type { EditorSnapshot } from '../useHistory';
import type { useEditorHistory } from '../useHistory';
import type { TextCanvasSize } from './types';
import { textBoxIssue, textHorizontalExtent } from './geometry';
import { getCanonicalDimensions } from '../canvasDimensions';

type History = ReturnType<typeof useEditorHistory>;
type Record = { snapshot: EditorSnapshot; size: TextCanvasSize; valid: boolean; navigation: number };
type Anchor = { size: TextCanvasSize; aspectRatioId: string; customCanvasSize: TextCanvasSize; commitId: number; action: string };
export type CanvasSizingAction = Anchor & { active: boolean; valid: boolean };
const sizeKeys = ['aspectRatioId', 'imageSrc', 'secondarySrc', 'layoutMode', 'duoLayout', 'padding', 'windowTheme', 'cornerStyle', 'layoutPreset'] as const;
const sizingChanged = (a: EditorSnapshot, b: EditorSnapshot) => sizeKeys.some(key => a[key] !== b[key]) || a.customCanvasSize.width !== b.customCanvasSize.width || a.customCanvasSize.height !== b.customCanvasSize.height;

/** Layout and recovery are derived UI state, deliberately absent from snapshots. */
export function useTextLayoutValidation(root: React.RefObject<HTMLDivElement>, snapshot: EditorSnapshot, size: TextCanvasSize, history: History,
  auto: TextCanvasSize, restoreSize: (aspectId: string, custom: TextCanvasSize) => void, finish: () => boolean, sizingAction: React.MutableRefObject<CanvasSizingAction | null>) {
  const [issues, setIssues] = useState<{ [id: string]: string }>({});
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const previous = useRef<Record>();
  const origin = useRef<Anchor | null>(null);
  const [, fontsChanged] = useState(0);
  useEffect(() => { const update = () => fontsChanged(n => n + 1); document.fonts.addEventListener('loadingdone', update); return () => document.fonts.removeEventListener('loadingdone', update); }, []);
  useLayoutEffect(() => {
    // A hidden Mockup session keeps its last reliable layout and recovery anchor.
    if (!root.current || !root.current.getClientRects().length || root.current.offsetWidth <= 0 || root.current.offsetHeight <= 0) return;
    const nodes = new Map(Array.from(root.current?.querySelectorAll<HTMLElement>('[data-canvas-text]') ?? []).map(node => [node.dataset.canvasText!, node]));
    const previewScale = root.current.getBoundingClientRect().width / root.current.offsetWidth;
    const next: { [id: string]: string } = {};
    for (const layer of snapshot.textDocument.layers) {
      const node = nodes.get(layer.id);
      const issue = textBoxIssue(layer, size, node ? Math.max(node.offsetHeight, node.scrollHeight) : 0, node?.offsetHeight ?? 0,
        node && layer.content.trim() ? textHorizontalExtent(node, previewScale) : undefined);
      if (issue) next[layer.id] = issue;
    }
    setIssues(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    const valid = !Object.keys(next).length, before = previous.current;
    const navigated = before && before.navigation !== history.navigationRevision;
    const changedSize = before && (before.size.width !== size.width || before.size.height !== size.height);
    if (navigated) origin.current = null;
    if (before && !navigated && sizingChanged(before.snapshot, snapshot)) {
      // Record the originating snapshot action now, BEFORE an asynchronous image
      // decode/natural-scene measurement. A later text commit must never acquire
      // that action's identity merely because it is latest when Auto catches up.
      let commitId = -1;
      if (!history.isInTransaction()) { history.flush(before.snapshot); history.flush(snapshot); commitId = history.getCommitId(); }
      if (sizingAction.current?.active) {
        if (sizingAction.current.valid && !anchor) origin.current = sizingAction.current;
      } else if (before.valid && !anchor) {
        const action = before.snapshot.selectedPreset !== snapshot.selectedPreset ? 'preset change' : before.snapshot.imageSrc !== snapshot.imageSrc || before.snapshot.secondarySrc !== snapshot.secondarySrc ? 'image change' : 'size change';
        origin.current = { size: before.size, aspectRatioId: before.snapshot.aspectRatioId, customCanvasSize: before.snapshot.customCanvasSize, commitId, action };
      }
    }
    if (navigated || valid) {
      if (anchor) setAnchor(null);
      if ((changedSize && !sizingAction.current?.active) || navigated) origin.current = null;
    } else if (!anchor && changedSize && before.valid) {
      // No known originating commit means a new size-only restore, never blind Undo.
      setAnchor(origin.current ?? { size: before.size, aspectRatioId: before.snapshot.aspectRatioId, customCanvasSize: before.snapshot.customCanvasSize, commitId: -1, action: 'size change' });
      origin.current = null;
    }
    previous.current = { snapshot, size, valid, navigation: history.navigationRevision };
  });
  let recovery: { label: string; restore: () => void } | null = null;
  if (anchor && Object.keys(issues).length) {
    const originalSize = getCanonicalDimensions(anchor.aspectRatioId, 1, 0, 0, auto.width, auto.height, anchor.customCanvasSize.width, anchor.customCanvasSize.height);
    const reusable = originalSize.width === anchor.size.width && originalSize.height === anchor.size.height;
    const direct = history.isCurrentCommit(anchor.commitId);
    const target = `${anchor.size.width}×${anchor.size.height}`;
    recovery = { label: direct ? `Undo ${anchor.action}, restore to ${target}` : `Restore to ${target}${reusable ? '' : ' (Custom)'}`, restore: () => {
      if (!finish()) return;
      // Recheck identity and value at activation, never blindly undo a newer edit.
      if (history.undoCommit(anchor.commitId)) { setAnchor(null); return; }
      history.beginTransaction(snapshot);
      const aspectRatioId = reusable ? anchor.aspectRatioId : 'custom';
      const customCanvasSize = reusable ? anchor.customCanvasSize : anchor.size;
      restoreSize(aspectRatioId, customCanvasSize);
      history.commitTransaction({ ...snapshot, aspectRatioId, customCanvasSize });
      setAnchor(null);
    } };
  }
  return { issues, recovery };
}
