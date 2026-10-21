import type { CanvasTextDocument, TextCanvasSize } from './types';
import './text.css';

export const textFontFamily = (font: 'manrope' | 'gelasio') => font === 'manrope' ? 'Poster Manrope' : 'Poster Gelasio';

/** Plain DOM text in logical canvas pixels. Its height is intrinsic, never stored. */
export function CanvasTextLayerRenderer({ document, size }: { document: CanvasTextDocument; size: TextCanvasSize }) {
  return <div data-canvas-text-layer style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}>
    {document.layers.filter(layer => layer.content.trim()).map(layer => <div key={layer.id}
      data-canvas-text={layer.id}
      style={{ position: 'absolute', left: layer.centerX * size.width, top: layer.centerY * size.height,
        width: layer.widthRatio * size.width, transform: 'translate(-50%, -50%)',
        fontFamily: `"${textFontFamily(layer.font)}"`, fontSize: layer.fontSize, fontWeight: layer.weight,
        fontStyle: layer.italic ? 'italic' : 'normal', fontSynthesis: 'none', lineHeight: 1.25,
        color: layer.color, textAlign: layer.align, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        letterSpacing: 'normal', padding: 0, margin: 0, border: 0,
      }}>{layer.content}</div>)}
  </div>;
}
