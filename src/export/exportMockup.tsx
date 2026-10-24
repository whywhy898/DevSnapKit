import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { toCanvas } from 'html-to-image';
import { MockupArtwork, type MockupArtworkProps } from '../MockupArtwork';
import { textBoxIssue, textHorizontalExtent } from '../text/geometry';
import { validateText } from '../text/document';
import { artworkFontCSS, createArtworkPreparationStats, prepareArtworkImages, stableArtworkLayout } from './prepareArtworkExport';

export interface MockupExportTarget {
  width: number; height: number; outputWidth: number; outputHeight: number;
  format: 'png' | 'webp' | 'jpeg'; id?: string; label?: string;
}
const noop = () => {};

/** Copy artwork inputs independently of selection and editing UI. */
export function freezeArtworkProps(props: MockupArtworkProps): MockupArtworkProps {
  return { ...props, templateContext: props.templateContext ? structuredClone(props.templateContext) : null, textDocument: structuredClone(props.textDocument), canvasLogicalSize: { ...props.canvasLogicalSize },
    gradient: { ...props.gradient }, zoomStyle: { ...props.zoomStyle }, canvasRef: null, emptySlot: null, editingTextId: null,
    onReplace: noop, onReplaceSecondary: noop, handleNaturalSceneSize: noop, preview: false };
}

export function exportTargetLabel(target: MockupExportTarget) {
  return `${target.label || target.id || 'Canvas'} (${target.width}×${target.height})`;
}

/** Keep target DOM layouts, not canvas bitmaps, through the frozen export.
 * Every target is checked before rasterize can expose the first file. Resource
 * preparation is shared; each target retains its own readiness and layout. */
export async function prepareMockupExport(input: MockupArtworkProps, requested: readonly MockupExportTarget[], parent: HTMLElement, resolveBlob?: (url: string) => Blob | undefined) {
  const props = freezeArtworkProps(input);
  const targets = requested.map(target => Object.freeze({ ...target }));
  if (!targets.length) throw new Error('Select at least one canvas size.');
  for (const target of targets) {
    if (![target.width, target.height, target.outputWidth, target.outputHeight].every(x => Number.isFinite(x) && x > 0)) throw new Error(`${exportTargetLabel(target)}: export dimensions are invalid.`);
  }
  if (!props.imageSrc) throw new Error('Main screenshot is required. Upload a screenshot and try again.');
  if (props.layoutMode === 'duo' && !props.secondarySrc) throw new Error('Second screenshot is required. Upload it or switch to Single.');
  const host = document.createElement('div');
  // Only the host is offset; artwork roots retain their normal local origin.
  Object.assign(host.style, { position: 'absolute', left: '-100000px', top: '0', pointerEvents: 'none', '--canvas-preview-scale': '1' });
  host.setAttribute('aria-hidden', 'true'); parent.appendChild(host);
  const root = createRoot(host);
  let disposed = false;
  const dispose = () => { if (!disposed) { disposed = true; flushSync(() => root.unmount()); host.remove(); } };
  const metrics = { resources: createArtworkPreparationStats(), preparationMs: 0, targets: targets.map(target => ({ id: target.id, width: target.width, height: target.height, outputWidth: target.outputWidth, outputHeight: target.outputHeight, layoutMs: 0, rasterMs: 0 })) };
  const preparationStart = performance.now();
  try {
    flushSync(() => root.render(<>{targets.map((target, index) => <div key={index} data-export-target={index} style={{ position: 'relative', width: target.width, height: target.height }}>
      <MockupArtwork {...props} preview={false} canvasRef={null} canvasLogicalSize={{ width: target.width, height: target.height }}
        effectivePaddingX={Math.min(props.padding, Math.max(0, (target.width - 120) / 2))}
        effectivePaddingY={Math.min(props.padding, Math.max(0, (target.height - 120) / 2))} handleNaturalSceneSize={noop} />
    </div>)}</>));
    await prepareArtworkImages(host, resolveBlob, metrics.resources);
    const fontEmbedCSS = await artworkFontCSS(host, undefined, metrics.resources);
    metrics.preparationMs = performance.now() - preparationStart;
    const artworks = [...host.querySelectorAll<HTMLElement>('[data-export-target] > [data-canvas-root]')];
    const issues: string[] = [];
    for (let index = 0; index < targets.length; index++) {
      const start = performance.now(), target = targets[index], artwork = artworks[index];
      await stableArtworkLayout(artwork);
      for (let layerIndex = 0; layerIndex < props.textDocument.layers.length; layerIndex++) {
        const layer = props.textDocument.layers[layerIndex];
        let issue = '';
        try { validateText(layer); } catch (error) { issue = (error as Error).message; }
        if (!issue && layer.content.trim()) {
          const node = [...artwork.querySelectorAll<HTMLElement>('[data-canvas-text]')].find(node => node.dataset.canvasText === layer.id);
          issue = node ? textBoxIssue(layer, target, Math.max(node.offsetHeight, node.scrollHeight), node.offsetHeight, textHorizontalExtent(node, 1)) ?? '' : 'Text layout is missing.';
        }
        if (issue) issues.push(`${exportTargetLabel(target)} — Text ${layerIndex + 1} “${layer.content.slice(0, 32) || layer.id}”: ${issue}`);
      }
      metrics.targets[index].layoutMs = performance.now() - start;
    }
    if (issues.length) throw new Error(`Export blocked. Fix the named text or deselect that size and try again.\n${issues.join('\n')}`);
    return { targets, metrics, dispose,
      async rasterize(index: number): Promise<Blob> {
        if (disposed) throw new Error('The export session has ended. Please try again.');
        const target = targets[index], artwork = artworks[index];
        if (!target || !artwork) throw new Error('Unknown export target.');
        const start = performance.now();
        try {
        const { width, height, outputWidth, outputHeight, format } = target;
        const raw = await toCanvas(artwork, { width, height, canvasWidth: outputWidth, canvasHeight: outputHeight,
      pixelRatio: 1, skipAutoScale: true, fontEmbedCSS, cacheBust: false,
      style: { transform: 'none', transformOrigin: 'top left', margin: '0' },
      filter: node => !(node instanceof HTMLElement && (node.dataset.exportIgnore === 'true' || node.classList.contains('media-hover-overlay'))),
    });
    if (raw.width !== outputWidth || raw.height !== outputHeight) throw new Error('Requested export size could not be allocated. Choose a smaller size.');
    if (format === 'jpeg' && props.bgType === 'transparent') {
      const ctx = raw.getContext('2d'); if (!ctx) throw new Error('Could not prepare JPEG.');
      ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, raw.width, raw.height);
    }
        const blob = await new Promise<Blob>((resolve, reject) => raw.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image could not be encoded. Try a smaller size.')), `image/${format}`, format === 'png' ? undefined : .92));
        if (blob.type !== `image/${format}`) throw new Error(`${format.toUpperCase()} encoding is not supported in this browser. Choose PNG.`);
        return blob;
        } finally { metrics.targets[index].rasterMs = performance.now() - start; }
      },
    };
  } catch (error) { dispose(); throw error; }
}

/** Compatible single-target entry point. */
export async function exportMockup(props: MockupArtworkProps, target: MockupExportTarget, parent: HTMLElement, resolveBlob?: (url: string) => Blob | undefined): Promise<Blob> {
  const session = await prepareMockupExport(props, [target], parent, resolveBlob);
  try { return await session.rasterize(0); } finally { session.dispose(); }
}
