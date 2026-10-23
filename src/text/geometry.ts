import type { CanvasTextLayer, TextCanvasSize } from './types';

export function moveTextByScreenDelta(position: { centerX: number; centerY: number }, delta: { x: number; y: number }, context: { previewScale: number; canvasWidth: number; canvasHeight: number }) {
  const values = [position.centerX, position.centerY, delta.x, delta.y, context.previewScale, context.canvasWidth, context.canvasHeight];
  if (!values.every(Number.isFinite) || context.previewScale <= 0 || context.canvasWidth <= 0 || context.canvasHeight <= 0) throw new Error('Coordinates, scale and canvas dimensions must be finite and valid.');
  return { centerX: position.centerX + delta.x / context.previewScale / context.canvasWidth, centerY: position.centerY + delta.y / context.previewScale / context.canvasHeight };
}
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
export type TextHorizontalExtent = { left: number; right: number };
export type TextMovementLayout = { height: number; positionedHeight: number; horizontal: TextHorizontalExtent };
/** Clamp translation using the same logical extents as preview/export validation.
 * An already oversized axis has no feasible translation; preserve it rather than
 * silently shrinking text or jumping between contradictory limits. */
export function clampTextPosition(layer: Pick<CanvasTextLayer, 'centerX' | 'centerY' | 'widthRatio'>, position: { centerX: number; centerY: number }, size: TextCanvasSize, layout: TextMovementLayout) {
  const halfWidth = layer.widthRatio * size.width / 2;
  const minX = halfWidth - layout.horizontal.left, maxX = size.width + halfWidth - layout.horizontal.right;
  const minY = layout.positionedHeight / 2, maxY = size.height - layout.height + layout.positionedHeight / 2;
  const clamp = (value: number, min: number, max: number, original: number) => {
    // CSS positions/transforms quantize to layout subpixels. A two-subpixel
    // inset keeps fractional boxes inside after that rounding, at every zoom.
    const inset = Math.min(1 / 32, Math.max(0, (max - min) / 2));
    min += inset; max -= inset;
    const target = min <= max ? Math.max(min, Math.min(max, value)) : original;
    // Transformed DOM rects vary by tiny floating-point fractions between paints.
    // Repeated pushes against an edge must remain a no-op in document/history.
    return Math.abs(target - original) < .001 ? original : target;
  };
  return { centerX: clamp(position.centerX * size.width, minX, maxX, layer.centerX * size.width) / size.width,
    centerY: clamp(position.centerY * size.height, minY, maxY, layer.centerY * size.height) / size.height };
}
/** Native line fragments include indivisible graphemes overflowing either edge.
 * Coordinates remain relative to the positioned CSS box, in logical pixels. */
export function textHorizontalExtent(node: HTMLElement, previewScale: number): TextHorizontalExtent {
  if (!Number.isFinite(previewScale) || previewScale <= 0) return { left: NaN, right: NaN };
  const box = node.getBoundingClientRect();
  const extent = { left: 0, right: box.width / previewScale };
  const range = node.ownerDocument.createRange();
  range.selectNodeContents(node);
  for (const fragment of range.getClientRects()) {
    extent.left = Math.min(extent.left, (fragment.left - box.left) / previewScale);
    extent.right = Math.max(extent.right, (fragment.right - box.left) / previewScale);
  }
  return extent;
}
export function textBoxIssue(layer: Pick<CanvasTextLayer, 'centerX' | 'centerY' | 'widthRatio' | 'content'>, size: TextCanvasSize, height: number, positionedHeight = height, horizontal?: TextHorizontalExtent): string | null {
  if (!layer.content.trim()) return null;
  const width = layer.widthRatio * size.width, x = layer.centerX * size.width, y = layer.centerY * size.height;
  const left = horizontal?.left ?? 0, right = horizontal?.right ?? width;
  if (![width, height, positionedHeight, x, y, left, right].every(Number.isFinite)) return 'Invalid text layout.';
  if (width < Math.min(64, size.width) - 1) return 'Text width is too narrow. Widen the box or restore the previous size.';
  // translateY(-50%) uses the CSS offset box, not its larger scroll extent.
  // Extra font overflow extends below that origin; it is not symmetric padding.
  const top = y - positionedHeight / 2;
  if (x - width / 2 + left < -1 || x - width / 2 + right > size.width + 1 || top < -1 || top + height > size.height + 1) return 'Text is outside the canvas. Move it, reduce its size, or restore the previous canvas size.';
  return null;
}
