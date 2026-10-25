import type { CanvasTextDocument, TextCanvasSize } from './types';
import { memo } from 'react';
import './text.css';
import { textLayoutStyle, TextRunContent } from './textPresentation';

export { textFontFamily } from './textPresentation';

/** Plain DOM text in logical canvas pixels. Its height is intrinsic, never stored. */
type Props = { document: CanvasTextDocument; size: TextCanvasSize; editingId?: string | null };
export const CanvasTextLayerRenderer = memo(function CanvasTextLayerRenderer({ document, size, editingId }: Props) {
  return <div data-canvas-text-layer style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}>
    {document.layers.filter(layer => layer.content.trim()).map(layer => <div key={layer.id}
      data-canvas-text={layer.id}
      data-trailing-newline={layer.content.endsWith('\n') ? 'true' : undefined}
      style={{ ...textLayoutStyle(layer), position: 'absolute', left: layer.centerX * size.width, top: layer.centerY * size.height,
        width: layer.widthRatio * size.width, transform: 'translate(-50%, -50%)',
        visibility: layer.id === editingId ? 'hidden' : 'visible',
      }}><TextRunContent layer={layer} /></div>)}
  </div>;
}, (before, after) => before.size.width === after.size.width && before.size.height === after.size.height && before.editingId === after.editingId
  && before.document.layers.length === after.document.layers.length && before.document.layers.every((layer, index) => layer === after.document.layers[index]));
