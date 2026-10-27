import type { CompositionDocument, ObjectFrame } from './types';
import { materializeMediaPlacements, resolveMediaPlacements } from '../templates/collection/mediaLayout';
type Size = { width: number; height: number };

export function createIndependentComposition(): CompositionDocument {
  return { version: 1, mediaLayout: 'independent', placements: {
    main: { centerX: .55, centerY: .45, widthRatio: .7, heightRatio: .7, rotation: 0 },
    secondary: { centerX: .23, centerY: .8, widthRatio: .3, heightRatio: .22, rotation: 0 },
  }, detailVisible: false, detailFit: 'contain', detailAlign: 'center', detailRadius: 10,
    detailBorder: 'none', detailShadow: 'none', objects: [], decorations: [], order: ['main', 'secondary'], hiddenIds: [], allowBleed: false };
}

export function placementBounds(frame: ObjectFrame, size: Size) {
  const radians = frame.rotation * Math.PI / 180, w = frame.widthRatio * size.width, h = frame.heightRatio * size.height;
  const width = Math.abs(Math.cos(radians)) * w + Math.abs(Math.sin(radians)) * h;
  const height = Math.abs(Math.sin(radians)) * w + Math.abs(Math.cos(radians)) * h;
  const left = frame.centerX * size.width - width / 2, top = frame.centerY * size.height - height / 2;
  return { left, top, right: left + width, bottom: top + height, width, height };
}

export function compositionFrame(doc: CompositionDocument, id: string): ObjectFrame {
  if (id === 'main' || id === 'secondary') return resolveMediaPlacements(doc)[id];
  const node = [...doc.objects, ...doc.decorations].find(node => node.id === id);
  if (!node) throw new Error('Unknown composition object');
  return node.frame;
}

export function moveCompositionObject(doc: CompositionDocument, id: string, patch: Partial<ObjectFrame>, size: Size): CompositionDocument {
  if (id === 'main' || id === 'secondary') doc = materializeMediaPlacements(doc);
  const frame = { ...compositionFrame(doc, id), ...patch };
  if (!Object.values(frame).every(Number.isFinite) || frame.widthRatio <= 0 || frame.heightRatio <= 0) throw new Error('Invalid placement geometry');
  const decoration = doc.decorations.some(node => node.id === id), image = id === 'main' || id === 'secondary';
  if (!decoration && !(doc.allowBleed && image)) {
    const raw = placementBounds(frame, size), fit = Math.min(1, size.width / raw.width, size.height / raw.height);
    frame.widthRatio *= fit; frame.heightRatio *= fit;
    const b = placementBounds(frame, size), halfX = b.width / size.width / 2, halfY = b.height / size.height / 2;
    frame.centerX = halfX > .5 ? .5 : Math.max(halfX, Math.min(1 - halfX, frame.centerX));
    frame.centerY = halfY > .5 ? .5 : Math.max(halfY, Math.min(1 - halfY, frame.centerY));
  }
  return id === 'main' || id === 'secondary' ? { ...doc, placements: { ...doc.placements, [id]: frame } }
    : { ...doc, objects: doc.objects.map(node => node.id === id ? { ...node, frame } : node), decorations: doc.decorations.map(node => node.id === id ? { ...node, frame } : node) };
}

export function toggleCompositionObject(doc: CompositionDocument, id: string): CompositionDocument {
  if (id === 'secondary') return { ...doc, detailVisible: !doc.detailVisible };
  return { ...doc, hiddenIds: doc.hiddenIds.includes(id) ? doc.hiddenIds.filter(key => key !== id) : [...doc.hiddenIds, id] };
}

export function reorderCompositionObject(doc: CompositionDocument, id: string, direction: -1 | 1): CompositionDocument {
  const index = doc.order.indexOf(id); if (index < 0) throw new Error('Unknown composition object');
  const order = [...doc.order], next = Math.max(0, Math.min(order.length - 1, index + direction));
  [order[index], order[next]] = [order[next], order[index]]; return { ...doc, order };
}

export function duplicateCompositionObject(doc: CompositionDocument, id: string, nextId: string): CompositionDocument {
  if (id === 'main' || id === 'secondary' || id === 'brand') throw new Error('Fixed screenshot slots cannot be duplicated');
  const node = doc.objects.find(node => node.id === id); if (!node) throw new Error('Unknown composition object');
  if (node.kind === 'shape' && node.shape === 'mark') throw new Error('Fixed brand slot cannot be duplicated');
  if (doc.order.includes(nextId) || doc.objects.some(node => node.id === nextId)) throw new Error('Duplicate object identity');
  const below = node.frame.centerY + node.frame.heightRatio + .015;
  const above = node.frame.centerY - node.frame.heightRatio - .015;
  const centerY = below + node.frame.heightRatio / 2 <= 1 ? below : above - node.frame.heightRatio / 2 >= 0 ? above : Math.min(.9, node.frame.centerY + .03);
  const copy = { ...structuredClone(node), id: nextId, name: `${node.name} copy`, frame: { ...node.frame, centerX: Math.min(1 - node.frame.widthRatio / 2, node.frame.centerX + .015), centerY } };
  return { ...doc, objects: [...doc.objects, copy], order: [...doc.order, nextId] };
}

export function secondaryRequired(doc: CompositionDocument | null | undefined, layoutMode: 'single' | 'duo') {
  return doc?.mediaLayout === 'independent' ? doc.detailVisible && !doc.hiddenIds.includes('secondary') && doc.order.includes('secondary')
    : layoutMode === 'duo' && (!doc || (!doc.hiddenIds.includes('main') && doc.order.includes('main')));
}

export function boxOutsideCanvas(box: { left: number; top: number; right: number; bottom: number }, canvas: { left: number; top: number; right: number; bottom: number }) {
  return box.left < canvas.left - .5 || box.top < canvas.top - .5 || box.right > canvas.right + .5 || box.bottom > canvas.bottom + .5;
}

export function validateComposition(doc: CompositionDocument, textIds: readonly string[] = []): CompositionDocument {
  if (doc.version !== 1 || !['legacy', 'independent'].includes(doc.mediaLayout)) throw new Error('Unsupported composition');
  if (!doc.placements || Object.keys(doc.placements).sort().join(',') !== 'main,secondary') throw new Error('Exactly two fixed screenshot slot placements are required');
  if (!Array.isArray(doc.objects) || !Array.isArray(doc.decorations) || !Array.isArray(doc.order) || !Array.isArray(doc.hiddenIds)) throw new Error('Invalid composition collections');
  const nodes = [...doc.objects, ...doc.decorations], ids = nodes.map(node => node.id);
  if (new Set(ids).size !== ids.length || ids.some(id => ['main', 'secondary', 'brand'].includes(id))) throw new Error('Invalid object identity');
  const textNamespace = [...textIds, ...(doc.knownTextIds ?? [])];
  if (textNamespace.some(id => ['main', 'secondary', 'brand'].includes(id) || ids.includes(id))) throw new Error('Graphic/text identity collision');
  if (new Set(doc.order).size !== doc.order.length) throw new Error('Duplicate object order');
  // Registered text references may outlive a deliberately deleted text object;
  // they never resurrect content. Unknown references remain invalid.
  const known = new Set(['main', 'secondary', 'brand', ...ids, ...textIds, ...(doc.knownTextIds ?? [])]);
  if (doc.order.some(id => !known.has(id))) throw new Error('Unknown object order reference');
  for (const presentation of Object.values(doc.mediaPresentation ?? {})) {
    if (!presentation) continue;
    if (presentation.radius !== undefined && (!Number.isFinite(presentation.radius) || presentation.radius < 0 || presentation.radius > 128)) throw new Error('Invalid presentation radius');
    const shadow = presentation.shadow;
    if (shadow !== undefined && (!shadow || typeof shadow !== 'object' || Array.isArray(shadow)
      || Object.keys(shadow).some(key => !['x', 'y', 'blur', 'color', 'referenceWidth'].includes(key))
      || ![shadow.x, shadow.y, shadow.blur].every(Number.isFinite) || Math.abs(shadow.x) > 128 || Math.abs(shadow.y) > 128 || shadow.blur < 0 || shadow.blur > 128
      || typeof shadow.color !== 'string' || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(shadow.color)
      || (shadow.referenceWidth !== undefined && (!Number.isFinite(shadow.referenceWidth) || shadow.referenceWidth <= 0)))) throw new Error('Invalid presentation shadow');
  }
  for (const frame of [...Object.values(doc.placements), ...(doc.singlePlacement ? [doc.singlePlacement] : []), ...nodes.map(node => node.frame)]) {
    if (!frame || !(['centerX', 'centerY', 'widthRatio', 'heightRatio', 'rotation'] as const).every(key => Number.isFinite(frame[key])) || frame.widthRatio <= 0 || frame.heightRatio <= 0 || Math.abs(frame.rotation) > 180) throw new Error('Invalid placement geometry');
  }
  for (const node of nodes) {
    if (node.kind === 'button') {
      if (typeof node.text !== 'string' || Array.from(node.text).length > 1000 || !Number.isFinite(node.fontSize) || node.fontSize <= 0 || !Number.isFinite(node.padding) || node.padding < 0 || !Number.isFinite(node.radius) || node.radius < 0 || typeof node.autoWidth !== 'boolean' || typeof node.arrow !== 'boolean') throw new Error('Invalid button style or text');
    } else if (node.kind !== 'shape' || !['rect', 'ellipse', 'line', 'halo', 'grid', 'mark'].includes(node.shape)) throw new Error('Unsupported graphic object');
  }
  return doc;
}
