import type { CanvasTextDocument, TextCanvasSize } from './types';
import './text.css';
import { textLayoutStyle, TextRunContent } from './textPresentation';

export { textFontFamily } from './textPresentation';

/** Plain DOM text in logical canvas pixels. Its height is intrinsic, never stored. */
export function CanvasTextLayerRenderer({ document, size, editingId }: { document: CanvasTextDocument; size: TextCanvasSize; editingId?: string | null }) {
  return <div data-canvas-text-layer style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}>
    {document.layers.filter(layer => layer.content.trim()).map(layer => <div key={layer.id}
      data-canvas-text={layer.id}
      data-trailing-newline={layer.content.endsWith('\n') ? 'true' : undefined}
      style={{ ...textLayoutStyle(layer), position: 'absolute', left: layer.centerX * size.width, top: layer.centerY * size.height,
        width: layer.widthRatio * size.width, transform: 'translate(-50%, -50%)',
        visibility: layer.id === editingId ? 'hidden' : 'visible',
      }}><TextRunContent layer={layer} /></div>)}
  </div>;
}
