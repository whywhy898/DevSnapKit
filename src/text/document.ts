import type { CanvasTextDocument, CanvasTextLayer, TextCanvasSize, TextFont } from './types';

// R3 candidate guardrails; performance provenance is recorded with the review evidence.
export const TEXT_LIMITS = { layers: 20, codepoints: 1000 } as const;
export const emptyTextDocument = (): CanvasTextDocument => ({ version: 1, layers: [] });
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
