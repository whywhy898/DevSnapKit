import type { CompositionDocument, GraphicObject, ShapeObject } from './types';

export type AnnotationKind = 'arrow' | 'rectangle' | 'highlight';
export type AnnotationGesture = boolean | 'start' | 'end';
type Size = { width: number; height: number };
type Point = { x: number; y: number };
export const ANNOTATION_COLORS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#ffffff'] as const;
export const ANNOTATION_WIDTHS = { thin: 2, medium: 4, thick: 8 } as const;
export type AnnotationObject = ShapeObject & { annotation: AnnotationKind; referenceWidth: number };
export function isAnnotation(node: GraphicObject | undefined): node is AnnotationObject {
  return node?.kind === 'shape' && node.annotation !== undefined;
}

export function addAnnotation(doc: CompositionDocument, kind: AnnotationKind, id: string, size: Size): CompositionDocument {
  if (doc.order.includes(id) || [...doc.objects, ...doc.decorations].some(node => node.id === id)) throw new Error('Duplicate annotation identity');
  const previous = doc.objects.filter(isAnnotation).at(-1);
  const cascade = (center: number, ratio: number, extent: number) => {
    const next = center + 24 / extent;
    return next + ratio / 2 <= 1 ? Math.max(ratio / 2, next) : ratio / 2;
  };
  const node: AnnotationObject = { id, kind: 'shape', annotation: kind, name: kind === 'arrow' ? 'Arrow' : kind === 'rectangle' ? 'Rectangle' : 'Highlight',
    shape: kind === 'arrow' ? 'line' : 'rect', fill: kind === 'highlight' ? ANNOTATION_COLORS[1] : 'transparent',
    stroke: kind === 'highlight' ? 'none' : ANNOTATION_COLORS[0], strokeWidth: kind === 'rectangle' ? ANNOTATION_WIDTHS.thick : ANNOTATION_WIDTHS.medium, opacity: kind === 'highlight' ? .35 : 1,
    referenceWidth: size.width, frame: { centerX: previous ? cascade(previous.frame.centerX, .3, size.width) : .5,
      centerY: previous ? cascade(previous.frame.centerY, .18, size.height) : .5, widthRatio: .3, heightRatio: .18, rotation: 0 },
    ...(kind === 'arrow' ? { start: { x: 0, y: 1 }, end: { x: 1, y: 0 } } : {}) };
  return { ...doc, objects: [...doc.objects, node], order: [...doc.order, id] };
}

export function annotationEndpoints(node: AnnotationObject, size: Size) {
  const { frame } = node, left = (frame.centerX - frame.widthRatio / 2) * size.width, top = (frame.centerY - frame.heightRatio / 2) * size.height;
  const point = (p: Point) => ({ x: left + p.x * frame.widthRatio * size.width, y: top + p.y * frame.heightRatio * size.height });
  return { start: point(node.start ?? { x: 0, y: 1 }), end: point(node.end ?? { x: 1, y: 0 }) };
}

export function moveAnnotationEndpoint(doc: CompositionDocument, id: string, endpoint: 'start' | 'end', point: Point, size: Size): CompositionDocument {
  const node = doc.objects.find(item => item.id === id);
  if (!isAnnotation(node) || node.annotation !== 'arrow' || ![point.x, point.y].every(Number.isFinite)) throw new Error('Invalid annotation endpoint');
  const ends = annotationEndpoints(node, size);
  ends[endpoint] = { x: Math.max(0, Math.min(size.width, point.x)), y: Math.max(0, Math.min(size.height, point.y)) };
  // A one-pixel minimum keeps horizontal, vertical and coincident endpoints finite.
  const width = Math.max(1, Math.abs(ends.end.x - ends.start.x)), height = Math.max(1, Math.abs(ends.end.y - ends.start.y));
  const cx = (ends.start.x + ends.end.x) / 2, cy = (ends.start.y + ends.end.y) / 2;
  const unit = (value: number) => Math.max(0, Math.min(1, value));
  const local = (p: Point) => ({ x: unit((p.x - cx + width / 2) / width), y: unit((p.y - cy + height / 2) / height) });
  return { ...doc, objects: doc.objects.map(item => item.id === id ? { ...node,
    frame: { centerX: cx / size.width, centerY: cy / size.height, widthRatio: width / size.width, heightRatio: height / size.height, rotation: 0 },
    start: local(ends.start), end: local(ends.end) } : item) };
}

export function styleAnnotation(doc: CompositionDocument, id: string, patch: { color?: string; width?: keyof typeof ANNOTATION_WIDTHS }): CompositionDocument {
  if (patch.color && !ANNOTATION_COLORS.some(color => color === patch.color)) throw new Error('Invalid annotation color');
  if (patch.width && !(patch.width in ANNOTATION_WIDTHS)) throw new Error('Invalid annotation width');
  return { ...doc, objects: doc.objects.map(node => node.id === id && isAnnotation(node) ? { ...node,
    ...(patch.color ? node.annotation === 'highlight' ? { fill: patch.color } : { stroke: patch.color } : {}),
    ...(patch.width ? { strokeWidth: ANNOTATION_WIDTHS[patch.width] } : {}) } : node) };
}

export function deleteAnnotation(doc: CompositionDocument, id: string): CompositionDocument {
  return { ...doc, objects: doc.objects.filter(node => node.id !== id || !isAnnotation(node)), order: doc.order.filter(key => key !== id), hiddenIds: doc.hiddenIds.filter(key => key !== id) };
}

/** Clear annotation content and references without disturbing other artwork. */
export function clearAnnotations(doc: CompositionDocument): CompositionDocument {
  const ids = new Set([...doc.objects, ...doc.decorations].filter(isAnnotation).map(node => node.id));
  if (!ids.size) return doc;
  return { ...doc, objects: doc.objects.filter(node => !ids.has(node.id)), decorations: doc.decorations.filter(node => !ids.has(node.id)),
    order: doc.order.filter(id => !ids.has(id)), hiddenIds: doc.hiddenIds.filter(id => !ids.has(id)) };
}

/** Local SVG coordinates scale with logical canvas width; output pixel ratio scales the whole artwork again. */
export function annotationGeometry(node: AnnotationObject, size: Size) {
  const width = node.frame.widthRatio * size.width, height = node.frame.heightRatio * size.height;
  const strokeWidth = (node.strokeWidth ?? 4) * size.width / node.referenceWidth;
  const start = { x: (node.start?.x ?? 0) * width, y: (node.start?.y ?? 1) * height };
  const end = { x: (node.end?.x ?? 1) * width, y: (node.end?.y ?? 0) * height };
  const angle = Math.atan2(end.y - start.y, end.x - start.x), length = Math.min(Math.hypot(end.x - start.x, end.y - start.y), strokeWidth * 4);
  const head = [-1, 1].map(sign => ({ x: end.x - length * Math.cos(angle + sign * Math.PI / 6), y: end.y - length * Math.sin(angle + sign * Math.PI / 6) }));
  return { width, height, strokeWidth, start, end, head };
}

export function validateAnnotation(node: ShapeObject) {
  const point = (p: Point | undefined) => p && [p.x, p.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1);
  if (!['arrow', 'rectangle', 'highlight'].includes(node.annotation!) || !Number.isFinite(node.referenceWidth) || node.referenceWidth! <= 0
    || !Object.values(ANNOTATION_WIDTHS).some(width => width === node.strokeWidth) || node.frame.rotation !== 0
    || (node.annotation === 'highlight' ? !/^#[\da-f]{6}$/i.test(node.fill) || node.opacity !== .35 : !/^#[\da-f]{6}$/i.test(node.stroke ?? '') || node.opacity !== 1)
    || (node.annotation === 'arrow' && (!point(node.start) || !point(node.end)))) throw new Error('Invalid annotation geometry or style');
}
