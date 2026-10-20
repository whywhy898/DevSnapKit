export type Size = { width: number; height: number };
export type Placement = { centerX: number; centerY: number; scale: number };
export type Validation = { ok: true } | { ok: false; reason: string };
export const POSTER_CANVAS: Size = { width: 1600, height: 1200 };

function positive(value: number) { return Number.isFinite(value) && value > 0; }
function validSize(size: Size) { return positive(size.width) && positive(size.height); }

export function toLogicalDelta(delta: { x: number; y: number }, previewScale: number) {
  if (!positive(previewScale) || !Number.isFinite(delta.x) || !Number.isFinite(delta.y)) throw new Error('Preview scale and pointer coordinates must be finite.');
  return { x: delta.x / previewScale, y: delta.y / previewScale };
}

export function scaleRect<T extends Size>(base: T, scale: number): T {
  if (!validSize(base) || !positive(scale)) throw new Error('Size and scale must be positive finite numbers.');
  return { ...base, width: base.width * scale, height: base.height * scale };
}

export function fitRect(image: Size, region: Size): Size {
  if (!validSize(image) || !validSize(region)) throw new Error('Image dimensions must be positive finite numbers.');
  return scaleRect(image, Math.min(region.width / image.width, region.height / image.height));
}

/** MockupUnit browser chrome is 49 logical pixels; fit its complete rotated frame. */
export function fittedMainBox(image: Size, region: Size = { width: 950, height: 800 }, degrees = -3) {
  if (!validSize(image) || !validSize(region) || !Number.isFinite(degrees)) throw new Error('Image dimensions must be positive finite numbers.');
  const angle = degrees * Math.PI / 180, cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
  const aspect = image.height / image.width, chromeHeight = 49;
  const width = Math.min(1000, (region.width - chromeHeight * sin) / (cos + aspect * sin), (region.height - chromeHeight * cos) / (sin + aspect * cos));
  if (!positive(width)) throw new Error('Browser region is too small.');
  return { width, height: width * aspect + chromeHeight, chromeHeight };
}

export function getScaleBounds(base: Size, role: 'main' | 'detail', canvas: Size = POSTER_CANVAS) {
  if (!validSize(base) || !validSize(canvas)) throw new Error('Dimensions must be positive finite numbers.');
  const longEdge = Math.max(base.width, base.height);
  return { minScale: Math.max(0.1, (role === 'main' ? 240 : 120) / longEdge), maxScale: Math.min(4, 2 * Math.max(canvas.width, canvas.height) / longEdge) };
}

export function validatePlacement(placement: Placement, base: Size, role: 'main' | 'detail' = 'main', canvas: Size = POSTER_CANVAS): Validation {
  if (![placement.centerX, placement.centerY, placement.scale].every(Number.isFinite)) return { ok: false, reason: 'X, Y and scale must be finite numbers.' };
  if (!validSize(base) || !validSize(canvas)) return { ok: false, reason: 'Image dimensions are invalid.' };
  const { minScale, maxScale } = getScaleBounds(base, role, canvas);
  if (placement.scale < minScale || placement.scale > maxScale) return { ok: false, reason: `Scale must be between ${minScale.toFixed(3)} and ${maxScale.toFixed(3)}.` };
  if (placement.centerX < 0 || placement.centerX > canvas.width || placement.centerY < 0 || placement.centerY > canvas.height) return { ok: false, reason: 'The image center must stay inside the canvas.' };
  return { ok: true };
}

export function clampCenter(placement: Placement, canvas: Size = POSTER_CANVAS): Placement {
  if (![placement.centerX, placement.centerY, placement.scale].every(Number.isFinite) || !validSize(canvas)) throw new Error('Placement must be finite.');
  return { ...placement, centerX: Math.max(0, Math.min(canvas.width, placement.centerX)), centerY: Math.max(0, Math.min(canvas.height, placement.centerY)) };
}

export function rotatedBounds(size: Size, degrees = 0): Size {
  if (!validSize(size) || !Number.isFinite(degrees)) throw new Error('Bounds must be finite.');
  const angle = degrees * Math.PI / 180;
  return { width: Math.abs(size.width * Math.cos(angle)) + Math.abs(size.height * Math.sin(angle)), height: Math.abs(size.width * Math.sin(angle)) + Math.abs(size.height * Math.cos(angle)) };
}

/** Tests artwork geometry only: shadows and decorations never enter crop validation. */
export function isPlacementClipped(placement: Placement, base: Size, canvas: Size = POSTER_CANVAS, degrees = 0) {
  const box = rotatedBounds(scaleRect(base, placement.scale), degrees);
  return placement.centerX - box.width / 2 < 0 || placement.centerX + box.width / 2 > canvas.width || placement.centerY - box.height / 2 < 0 || placement.centerY + box.height / 2 > canvas.height;
}
