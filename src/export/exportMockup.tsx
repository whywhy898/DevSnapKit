import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { toCanvas } from 'html-to-image';
import { MockupArtwork, type MockupArtworkProps } from '../MockupArtwork';
import { textBoxIssue } from '../text/geometry';
import { validateText } from '../text/document';
import { artworkFontCSS, prepareArtworkImages, stableArtworkLayout } from './prepareArtworkExport';

export interface MockupExportTarget { width: number; height: number; outputWidth: number; outputHeight: number; format: 'png' | 'webp' | 'jpeg' }
const noop = () => {};

/** A single frozen renderer input can be reused for every target in a batch. */
export function freezeArtworkProps(props: MockupArtworkProps): MockupArtworkProps {
  return { ...props, textDocument: structuredClone(props.textDocument), canvasLogicalSize: { ...props.canvasLogicalSize },
    gradient: { ...props.gradient }, zoomStyle: { ...props.zoomStyle }, canvasRef: null,
    onReplace: noop, onReplaceSecondary: noop, handleNaturalSceneSize: noop, preview: false };
}

export async function exportMockup(props: MockupArtworkProps, target: MockupExportTarget, parent: HTMLElement, resolveBlob?: (url: string) => Blob | undefined): Promise<Blob> {
  const { width, height, outputWidth, outputHeight, format } = target;
  if (![width, height, outputWidth, outputHeight].every(x => Number.isFinite(x) && x > 0)) throw new Error('Export dimensions are invalid.');
  if (!props.imageSrc) throw new Error('Main screenshot is required. Upload a screenshot and try again.');
  if (props.layoutMode === 'duo' && !props.secondarySrc) throw new Error('Second screenshot is required. Upload it or switch to Single.');
  const host = document.createElement('div');
  // Offset the HOST only. The artwork itself must retain a local (0,0) origin.
  Object.assign(host.style, { position: 'absolute', left: '-100000px', top: '0', width: `${width}px`, height: `${height}px`, pointerEvents: 'none', '--canvas-preview-scale': '1' });
  host.setAttribute('aria-hidden', 'true'); parent.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<MockupArtwork {...props} preview={false} canvasRef={null}
      canvasLogicalSize={{ width, height }} effectivePaddingX={Math.min(props.padding, (width - 120) / 2)}
      effectivePaddingY={Math.min(props.padding, (height - 120) / 2)} handleNaturalSceneSize={noop} />));
    const artwork = host.firstElementChild as HTMLElement;
    await prepareArtworkImages(artwork, resolveBlob);
    const fontEmbedCSS = await artworkFontCSS(artwork);
    await stableArtworkLayout(artwork);
    for (const layer of props.textDocument.layers) {
      try { validateText(layer); } catch (error) { throw new Error(`Text “${layer.content.slice(0, 32) || layer.id}”: ${(error as Error).message}`); }
      if (!layer.content.trim()) continue;
      const node = [...artwork.querySelectorAll<HTMLElement>('[data-canvas-text]')].find(node => node.dataset.canvasText === layer.id);
      const issue = node ? textBoxIssue(layer, { width, height }, Math.max(node.offsetHeight, node.scrollHeight)) : 'Text layout is missing.';
      if (issue) throw new Error(`Text “${layer.content.slice(0, 32)}”: ${issue}`);
    }
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
    return await new Promise<Blob>((resolve, reject) => raw.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image could not be encoded. Try a smaller size.')), `image/${format}`, format === 'png' ? undefined : .92));
  } finally { flushSync(() => root.unmount()); host.remove(); }
}
