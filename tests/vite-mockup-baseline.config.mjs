import { mergeConfig } from 'vite';
import base from './vite-poster.config.mjs';

// Test-only state driver. Production source, renderer and download path stay intact.
export default mergeConfig(base, {
  plugins: [{
    name: 'mockup-baseline-state-driver',
    enforce: 'pre',
    transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/App.tsx')) return;
      const anchor = '  const { canUndo, canRedo, undo, redo, flush, beginTransaction, commitTransaction, cancelTransaction } = useEditorHistory(currentSnapshot, handleRestoreSnapshot);';
      if (!source.includes(anchor)) throw new Error('Baseline state driver anchor missing');
      return source.replace(anchor, `${anchor}
  useEffect(() => {
    (window as any).__mockupBaseline = {
      snapshot: currentSnapshot,
      apply: (patch: Partial<EditorSnapshot>, extras: any = {}) => {
        handleRestoreSnapshot({ ...currentSnapshot, ...patch });
        setGradient(GRADIENTS[extras.gradientIndex ?? 0]);
        setIsProUnlocked(Boolean(extras.pro));
        setQrDataUrl(extras.qrDataUrl ?? null);
      },
    };
  });
`);
    },
  }],
});
