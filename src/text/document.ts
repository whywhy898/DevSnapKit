import type { CanvasTextDocument, CanvasTextLayer, TextCanvasSize, TextFont, TextRun, TextRunStyle, TextReplacementRange } from './types';

// Interactive guardrails are measured by tests/canvas-text-geometry-perf.test.mjs:
// 1/5/10/20 boxes, 20/1000 codepoints, three actual handle/input runs, real upload,
// frame p95 <=33.4ms and event-to-paint-opportunity p95 <=100ms. Keep the raw
// before/after evidence in canvas-text-v1/geometry when changing these limits.
export const TEXT_LIMITS = { layers: 20, codepoints: 1000 } as const;
export const emptyTextDocument = (): CanvasTextDocument => ({ version: 1, layers: [] });
const runStyleKeys = ['font', 'weight', 'italic', 'color', 'highlightColor'] as const;
/** Drop empty runs and merge adjacent identical styles, with no arbitrary HTML/CSS. */
export function normalizeTextRuns(runs: readonly TextRun[]): TextRun[] {
  if (!Array.isArray(runs)) throw new Error('Text runs must be a finite array.');
  const result: TextRun[] = [];
  for (const run of runs) {
    if (!run || typeof run.text !== 'string' || Object.keys(run).some(key => key !== 'text' && !runStyleKeys.includes(key as typeof runStyleKeys[number]))) throw new Error('Unsupported text run style.');
    const normalized: TextRun = { text: run.text };
    for (const key of runStyleKeys) if (run[key] !== undefined) Object.assign(normalized, { [key]: run[key] });
    const previous = result[result.length - 1];
    if (!normalized.text) continue;
    if (previous && runStyleKeys.every(key => previous[key] === normalized[key])) previous.text += normalized.text;
    else result.push(normalized);
  }
  return result;
}
export function textContent(layer: Pick<CanvasTextLayer, 'content' | 'runs'>): string {
  return layer.runs ? layer.runs.map(run => run.text).join('') : layer.content;
}
/** Codepoints are the diff units; DOM range APIs still use UTF-16 offsets. */
function runCharacters(layer: CanvasTextLayer): TextRun[] {
  return (layer.runs ?? [{ text: layer.content }]).flatMap(run => Array.from(run.text, text => ({ ...run, text })));
}
export function replaceTextContent(layer: CanvasTextLayer, content: string, replacement?: TextReplacementRange): TextRun[] {
  const before = runCharacters(layer), after = Array.from(content);
  let start = 0, end = 0;
  if (replacement) {
    const previous = textContent(layer), { start: from, end: to } = replacement;
    const splitsPair = (at: number) => at > 0 && /[\uD800-\uDBFF]/.test(previous[at - 1]) && /[\uDC00-\uDFFF]/.test(previous[at] ?? '');
    if (![from, to].every(Number.isInteger) || from < 0 || to < from || to > previous.length || splitsPair(from) || splitsPair(to)) throw new Error('Text replacement range must preserve Unicode codepoints.');
    const prefix = previous.slice(0, from), suffix = previous.slice(to);
    if (content.length < prefix.length + suffix.length || !content.startsWith(prefix) || !content.endsWith(suffix)) throw new Error('Text replacement range does not match the input.');
    start = Array.from(prefix).length; end = Array.from(suffix).length;
  } else {
    while (start < before.length && start < after.length && before[start].text === after[start]) start++;
    while (end < before.length - start && end < after.length - start && before[before.length - 1 - end].text === after[after.length - 1 - end]) end++;
  }
  const replacing = before.length - start - end > 0;
  const inherited = before[replacing ? start : Math.max(0, start - 1)] ?? before[start] ?? { text: '' };
  return normalizeTextRuns([...before.slice(0, start), ...after.slice(start, after.length - end).map(text => ({ ...inherited, text })), ...before.slice(before.length - end)]);
}
/** Expand partial surrogate selections outward, preserving whole Unicode codepoints. */
export function emphasizeTextRange(doc: CanvasTextDocument, id: string, start: number, end: number, style: TextRunStyle): CanvasTextDocument {
  const layer = doc.layers.find(item => item.id === id);
  if (!layer) throw new Error('Text box no longer exists.');
  if (![start, end].every(Number.isFinite)) throw new Error('Text selection must be finite.');
  if (Object.keys(style).some(key => !runStyleKeys.includes(key as typeof runStyleKeys[number]))) throw new Error('Unsupported text run style.');
  if (start === end) return doc;
  const low = Math.max(0, Math.min(start, end)), high = Math.max(start, end);
  let offset = 0;
  const runs = normalizeTextRuns(runCharacters(layer).map(run => {
    const from = offset; offset += run.text.length;
    return from < high && offset > low ? { ...run, ...style } : run;
  }));
  return updateText(doc, id, { runs, content: runs.map(run => run.text).join('') });
}
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
  if (layer.lineHeight !== undefined && (!Number.isFinite(layer.lineHeight) || layer.lineHeight < .5 || layer.lineHeight > 3)) throw new Error('Text line height must be between 0.5 and 3.');
  if (layer.letterSpacing !== undefined && (!Number.isFinite(layer.letterSpacing) || layer.letterSpacing < -10 || layer.letterSpacing > 40)) throw new Error('Text letter spacing must be between -10 and 40 px.');
  if (layer.textTransform !== undefined && !['none', 'uppercase'].includes(layer.textTransform)) throw new Error('Invalid text transform.');
  if (layer.runs !== undefined) {
    const runs = normalizeTextRuns(layer.runs);
    if (runs.map(run => run.text).join('') !== layer.content) throw new Error('Text content projection must match its authoritative runs.');
    for (const run of layer.runs) {
      const font = run.font === undefined ? layer.font : run.font, weight = run.weight === undefined ? layer.weight : run.weight, italic = run.italic === undefined ? layer.italic : run.italic;
      if (!['manrope', 'gelasio'].includes(font) || ![400, 600, 700, 800].includes(weight) || typeof italic !== 'boolean' || (font === 'gelasio' && weight === 800) || (font === 'manrope' && italic)) throw new Error('Unsupported text run font style.');
      for (const color of [run.color, run.highlightColor]) if (color !== undefined && !/^#[\da-f]{6}$/i.test(color)) throw new Error('Text run color must be #RRGGBB.');
    }
    const frozenRuns = Object.freeze(runs.map(run => Object.freeze(run))), projection = runs.map(run => run.text).join('');
    return Object.freeze(Object.defineProperty({ ...layer, runs: frozenRuns }, 'content', { enumerable: true, configurable: false, get: () => projection }));
  }
  return layer;
}
export type TextCreationBox = { left: number; top: number; width: number; height: number };
/** Prefer free layout space; never move older text to make a new box fit. */
function creationPosition(canvas: TextCanvasSize, width: number, occupied: TextCreationBox[]) {
  const height = Math.min(60, canvas.height), gap = 16;
  const minX = Math.min(gap, (canvas.width - width) / 2), maxX = canvas.width - width - minX;
  const minY = Math.min(gap, (canvas.height - height) / 2), maxY = canvas.height - height - minY;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const preferred = { left: (canvas.width - width) / 2, top: clamp(canvas.height * .2 - height / 2, minY, maxY) };
  const xs = new Set([preferred.left, minX, maxX]), ys = new Set([preferred.top, minY, maxY]);
  for (const box of occupied) {
    xs.add(clamp(box.left + box.width + gap, minX, maxX)); xs.add(clamp(box.left - width - gap, minX, maxX));
    ys.add(clamp(box.top + box.height + gap, minY, maxY)); ys.add(clamp(box.top - height - gap, minY, maxY));
  }
  const candidates = [...ys].flatMap(top => [...xs].map(left => {
    const overlap = occupied.reduce((sum, box) => sum + Math.max(0, Math.min(left + width + gap, box.left + box.width) - Math.max(left - gap, box.left)) * Math.max(0, Math.min(top + height + gap, box.top + box.height) - Math.max(top - gap, box.top)), 0);
    const distance = (left - preferred.left) ** 2 + (top - preferred.top) ** 2;
    return { left, top, overlap, distance };
  }));
  candidates.sort((a, b) => a.overlap - b.overlap || a.distance - b.distance || b.top - a.top);
  const best = candidates[0];
  return { x: best.left + width / 2, y: best.top + height / 2 };
}
export function addText(doc: CanvasTextDocument, canvas: TextCanvasSize, color = '#FFFFFF', id = crypto.randomUUID(), measured?: TextCreationBox[]): CanvasTextDocument {
  if (doc.layers.length >= TEXT_LIMITS.layers) throw new Error('Maximum 20 text boxes. Delete a box before adding another.');
  if (doc.layers.some(x => x.id === id)) throw new Error('Text id already exists.');
  if (!Number.isFinite(canvas.width) || !Number.isFinite(canvas.height) || canvas.width < 32 || canvas.height <= 0) throw new Error('Canvas dimensions are invalid.');
  const width = Math.min(480, canvas.width - 32);
  const occupied = measured ?? doc.layers.filter(layer => layer.content.trim()).map(layer => {
    const height = layer.fontSize * (layer.lineHeight ?? 1.25) * layer.content.split('\n').length;
    return { left: (layer.centerX - layer.widthRatio / 2) * canvas.width, top: layer.centerY * canvas.height - height / 2, width: layer.widthRatio * canvas.width, height };
  });
  const { x, y } = creationPosition(canvas, width, occupied);
  const layer: CanvasTextLayer = { id, content: 'Text', centerX: x / canvas.width, centerY: y / canvas.height, widthRatio: width / canvas.width, font: 'manrope', fontSize: 48, weight: 700, italic: false, color, align: 'center' };
  validateText(layer);
  return { ...doc, layers: [...doc.layers, layer] };
}
export function updateText(doc: CanvasTextDocument, id: string, patch: Partial<Omit<CanvasTextLayer, 'id'>>, replacement?: TextReplacementRange): CanvasTextDocument {
  if (!doc.layers.some(x => x.id === id)) throw new Error('Text box no longer exists.');
  const layers = doc.layers.map(layer => {
    if (layer.id !== id) return layer;
    const next = { ...layer, ...patch, id };
    if (patch.runs !== undefined) {
      const projection = patch.runs.map(run => run.text).join('');
      if (patch.content !== undefined && patch.content !== projection) throw new Error('Text content projection must match its authoritative runs.');
      next.content = projection;
    } else if (layer.runs && patch.content !== undefined && patch.content !== layer.content) next.runs = replaceTextContent(layer, patch.content, replacement);
    const validated = validateText(next);
    return JSON.stringify(validated) === JSON.stringify(layer) ? layer : validated;
  });
  return layers.every((layer, index) => layer === doc.layers[index]) ? doc : { ...doc, layers };
}
export function deleteText(doc: CanvasTextDocument, id: string): CanvasTextDocument {
  return { ...doc, layers: doc.layers.filter(layer => layer.id !== id) };
}
export function changeTextFont(layer: CanvasTextLayer, font: TextFont): CanvasTextLayer {
  return validateText({ ...layer, font, weight: font === 'gelasio' && layer.weight === 800 ? 700 : layer.weight, italic: font === 'manrope' ? false : layer.italic });
}
