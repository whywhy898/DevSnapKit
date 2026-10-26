import type { ObjectFrame } from '../../composition/types';

export function frameFromRect(
  canvas: { width: number; height: number },
  rect: { x: number; y: number; width: number; height: number },
  rotation = 0,
): ObjectFrame {
  const numbers = [canvas.width, canvas.height, rect.x, rect.y, rect.width, rect.height, rotation];
  if (!numbers.every(Number.isFinite) || canvas.width <= 0 || canvas.height <= 0 || rect.width <= 0 || rect.height <= 0) {
    throw new Error('Template geometry requires finite coordinates and positive dimensions');
  }
  return {
    centerX: (rect.x + rect.width / 2) / canvas.width,
    centerY: (rect.y + rect.height / 2) / canvas.height,
    widthRatio: rect.width / canvas.width,
    heightRatio: rect.height / canvas.height,
    rotation,
  };
}
