import { mergeConfig } from 'vite';
import base from './vite-poster.config.mjs';
import { execFileSync } from 'node:child_process';
const sceneReferenceCommit = process.env.CANVAS_TEXT_SCENE_REFERENCE_COMMIT;
if (sceneReferenceCommit && !/^[a-f0-9]{40}$/.test(sceneReferenceCommit)) throw new Error('Scene reference requires an exact commit SHA');
const sceneReference = sceneReferenceCommit ? execFileSync('git', ['show', `${sceneReferenceCommit}:src/CanvasLayout.tsx`], { encoding: 'utf8' }) : null;

// Test-only state driver. Production source, renderer and download path stay intact.
export default mergeConfig(base, {
  plugins: [{
    name: 'mockup-baseline-state-driver',
    enforce: 'pre',
    transform(source, id) {
      const normalized = id.replaceAll('\\', '/');
      if (normalized.endsWith('/src/export/exportMockup.tsx')) return source.replace('return { targets, metrics, dispose,', '(window as any).__lastExportMetrics = metrics; return { targets, metrics, dispose,');
      if (normalized.endsWith('/src/CanvasLayout.tsx') && sceneReference) source = sceneReference;
      if (normalized.endsWith('/src/editorHistory.ts')) return source.replace('equal(a: T, b: T) { return equalValues(a, b); }', `equal(a: T, b: T) {
        const start = performance.now(); const result = equalValues(a, b);
        const perf = (window as any).__interactionPerf; if (perf?.active) perf.hotspots.history.push(performance.now() - start); return result;
      }`);
      if (normalized.endsWith('/src/CanvasLayout.tsx')) return source
        .replace('[children, basisWidth, projection, onNaturalSize]', process.env.CANVAS_TEXT_SKIP_REDUNDANT_SCENE ? '[basisWidth, projection, onNaturalSize]' : '[children, basisWidth, projection, onNaturalSize]')
        .replace('const measure = () => {', 'const measure = () => { const measureStart = performance.now(); try {')
        .replace('    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };', '    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };')
        .replace('    };\n    const schedule = () =>', `    } finally { const perf = (window as any).__interactionPerf; if (perf?.active) perf.hotspots.scene.push(performance.now() - measureStart); }
    };
    const schedule = () =>`);
      if (!id.replaceAll('\\', '/').endsWith('/src/App.tsx')) return;
      const anchor = source.match(/^  const \{ canUndo, canRedo, undo, redo, flush, beginTransaction, commitTransaction, cancelTransaction(?:, applyCommand)? \} = editorHistory;$/m)?.[0];
      if (!anchor) throw new Error('Baseline state driver anchor missing');
      return source.replace(anchor, `${anchor}
  useEffect(() => {
    (window as any).__mockupBaseline = {
      snapshot: currentSnapshot,
      artwork: () => artworkProps(),
      history: { count: editorHistory.historyCount, index: editorHistory.historyIndex, commitId: editorHistory.getCommitId(), inTransaction: editorHistory.isInTransaction(), canRedo: editorHistory.canRedo },
      holdNaturalSize: (hold: boolean) => {
        (window as any).__holdNaturalSize = hold;
        if (!hold && (window as any).__pendingNaturalSize) {
          setNaturalSceneSize((window as any).__pendingNaturalSize);
          (window as any).__pendingNaturalSize = null;
        }
      },
      apply: (patch: Partial<EditorSnapshot>, extras: any = {}) => {
        handleRestoreSnapshot({ ...currentSnapshot, ...patch });
        setGradient(GRADIENTS[extras.gradientIndex ?? 0]);
        setIsProUnlocked(Boolean(extras.pro));
        setQrDataUrl(extras.qrDataUrl ?? null);
      },
    };
  });
`).replace('    setNaturalSceneSize(prev => prev.width === size.width && prev.height === size.height ? prev : size);', `
    if ((window as any).__holdNaturalSize) { (window as any).__pendingNaturalSize = size; return; }
    setNaturalSceneSize(prev => prev.width === size.width && prev.height === size.height ? prev : size);`);
    },
  }],
});
