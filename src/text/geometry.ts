import type { CanvasTextLayer, TextCanvasSize } from './types';

export function moveTextByScreenDelta(position: { centerX: number; centerY: number }, delta: { x: number; y: number }, context: { previewScale: number; canvasWidth: number; canvasHeight: number }) {
  const values = [position.centerX, position.centerY, delta.x, delta.y, context.previewScale, context.canvasWidth, context.canvasHeight];
  if (!values.every(Number.isFinite) || context.previewScale <= 0 || context.canvasWidth <= 0 || context.canvasHeight <= 0) throw new Error('Coordinates, scale and canvas dimensions must be finite and valid.');
  return { centerX: position.centerX + delta.x / context.previewScale / context.canvasWidth, centerY: position.centerY + delta.y / context.previewScale / context.canvasHeight };
}
export function creationOffset(n: number) { return { x: 24 * (n % 5), y: 24 * Math.floor(n / 5) }; }
export type GeometryField = 'x' | 'y' | 'width';
export function geometryPatch(field: GeometryField, draft: string, size: TextCanvasSize) {
  const value = draft.trim() === '' ? NaN : Number(draft);
  const max = field === 'y' ? size.height : size.width, min = field === 'width' ? Math.min(64, size.width) : 0;
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Text ${field} must be a finite number between ${min} and ${max} logical px. Draft not applied.`);
  return field === 'x' ? { centerX: value / size.width } : field === 'y' ? { centerY: value / size.height } : { widthRatio: value / size.width };
}
export function resizeTextByScreenDelta(layer: Pick<CanvasTextLayer, 'centerX' | 'widthRatio'>, delta: number, edge: 'left' | 'right', scale: number, size: TextCanvasSize) {
  if (!Number.isFinite(delta) || !Number.isFinite(scale) || scale <= 0) throw new Error('Preview scale must be finite and positive.');
  const logicalDelta = delta / scale;
  const width = layer.widthRatio * size.width + logicalDelta * (edge === 'right' ? 1 : -1);
  const centerX = layer.centerX + logicalDelta / 2 / size.width;
  geometryPatch('width', String(width), size); geometryPatch('x', String(centerX * size.width), size);
  return { centerX, widthRatio: width / size.width };
}
export function textBoxIssue(layer: Pick<CanvasTextLayer, 'centerX' | 'centerY' | 'widthRatio' | 'content'>, size: TextCanvasSize, height: number): string | null {
  if (!layer.content.trim()) return null;
  const width = layer.widthRatio * size.width, x = layer.centerX * size.width, y = layer.centerY * size.height;
  if (![width, height, x, y].every(Number.isFinite)) return 'Invalid text layout.';
  if (width < Math.min(64, size.width) - 1) return 'Text width is too narrow. Widen the box or restore the previous size.';
  if (x - width / 2 < -1 || x + width / 2 > size.width + 1 || y - height / 2 < -1 || y + height / 2 > size.height + 1) return 'Text is outside the canvas. Move it, reduce its size, or restore the previous canvas size.';
  return null;
}
