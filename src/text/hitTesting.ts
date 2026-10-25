type TextHit = { id: string; rect: { left: number; top: number; right: number; bottom: number } };
/** Candidates arrive front-to-back, already filtered by artwork occlusion. */
export function nearestTextHit(candidates: TextHit[], x: number, y: number): string | undefined {
  let closest: string | undefined, distance = Infinity;
  for (const { id, rect } of candidates) {
    const dx = Math.max(rect.left - x, 0, x - rect.right), dy = Math.max(rect.top - y, 0, y - rect.bottom);
    const next = dx * dx + dy * dy;
    if (next < distance) { closest = id; distance = next; }
  }
  return closest;
}
