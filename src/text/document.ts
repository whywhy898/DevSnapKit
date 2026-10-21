import type { CanvasTextDocument, CanvasTextLayer, TextCanvasSize, TextFont } from './types';

// Interactive guardrails are measured by tests/canvas-text-geometry-perf.test.mjs:
// 1/5/10/20 boxes, 20/1000 codepoints, three actual handle/input runs, real upload,
// frame p95 <=33.4ms and event-to-paint-opportunity p95 <=100ms. Keep the raw
// before/after evidence in canvas-text-v1/geometry when changing these limits.
export const TEXT_LIMITS = { layers: 20, codepoints: 1000 } as const;
export const emptyTextDocument = (): CanvasTextDocument => ({ version: 1, layers: [] });
/** Choose once on creation; later user colors are retained verbatim. */
export function initialTextColor(backgroundType: string, solidColor: string): '#111827' | '#FFFFFF' {
  if (backgroundType !== 'solid') return '#FFFFFF';
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map(offset => {
      const s = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
    });
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  const bg = luminance(solidColor), dark = luminance('#111827');
  const darkContrast = (Math.max(bg, dark) + .05) / (Math.min(bg, dark) + .05);
  return darkContrast >= 1.05 / (bg + .05) ? '#111827' : '#FFFFFF';
}
export function validateText(layer: CanvasTextLayer) {
  if (!layer.id || typeof layer.content !== 'string') throw new Error('Text needs a stable id and plain content.');
  if (Array.from(layer.content).length > TEXT_LIMITS.codepoints) throw new Error('Maximum 1000 Unicode characters per text box. Draft not applied.');
  if (![layer.centerX, layer.centerY].every(Number.isFinite) || layer.centerX < 0 || layer.centerX > 1 || layer.centerY < 0 || layer.centerY > 1) throw new Error('Text position must be finite and inside the canvas.');
  if (!Number.isFinite(layer.widthRatio) || layer.widthRatio <= 0 || layer.widthRatio > 1) throw new Error('Text width must be finite and between 0 and 100%.');
  if (!Number.isFinite(layer.fontSize) || layer.fontSize < 8 || layer.fontSize > 160) throw new Error('Text size must be between 8 and 160 px.');
  if (!['manrope', 'gelasio'].includes(layer.font) || ![400, 600, 700, 800].includes(layer.weight) || (layer.font === 'gelasio' && layer.weight === 800) || (layer.font === 'manrope' && layer.italic)) throw new Error('Unsupported font weight or italic combination.');
  if (!/^#[\da-f]{6}$/i.test(layer.color)) throw new Error('Text color must be #RRGGBB.');
  if (!['left', 'center', 'right'].includes(layer.align)) throw new Error('Invalid text alignment.');
  return layer;
}
export function addText(doc: CanvasTextDocument, canvas: TextCanvasSize, color = '#FFFFFF', id = crypto.randomUUID()): CanvasTextDocument {
  if (doc.layers.length >= TEXT_LIMITS.layers) throw new Error('Maximum 20 text boxes. Delete a box before adding another.');
  if (doc.layers.some(x => x.id === id)) throw new Error('Text id already exists.');
  if (!Number.isFinite(canvas.width) || !Number.isFinite(canvas.height) || canvas.width < 32 || canvas.height <= 0) throw new Error('Canvas dimensions are invalid.');
  const n = doc.layers.length, width = Math.min(480, canvas.width - 32);
  const x = Math.min(canvas.width - width / 2, canvas.width / 2 + 24 * (n % 5));
  const y = Math.min(canvas.height - 30, Math.max(30, canvas.height * .2 + 24 * Math.floor(n / 5)));
  const layer: CanvasTextLayer = { id, content: 'Text', centerX: x / canvas.width, centerY: y / canvas.height, widthRatio: width / canvas.width, font: 'manrope', fontSize: 48, weight: 700, italic: false, color, align: 'center' };
  validateText(layer);
  return { ...doc, layers: [...doc.layers, layer] };
}
export function updateText(doc: CanvasTextDocument, id: string, patch: Partial<Omit<CanvasTextLayer, 'id'>>): CanvasTextDocument {
  if (!doc.layers.some(x => x.id === id)) throw new Error('Text box no longer exists.');
  return { ...doc, layers: doc.layers.map(layer => layer.id === id ? validateText({ ...layer, ...patch, id }) : layer) };
}
export function deleteText(doc: CanvasTextDocument, id: string): CanvasTextDocument {
  return { ...doc, layers: doc.layers.filter(layer => layer.id !== id) };
}
export function changeTextFont(layer: CanvasTextLayer, font: TextFont): CanvasTextLayer {
  return validateText({ ...layer, font, weight: font === 'gelasio' && layer.weight === 800 ? 700 : layer.weight, italic: font === 'manrope' ? false : layer.italic });
}
