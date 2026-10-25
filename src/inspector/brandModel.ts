import type { CompositionDocument, ObjectFrame } from '../composition/types';
import { moveCompositionObject } from '../composition/document';

/** The existing dedicated template mark never consumes a screenshot slot. */
export function templateLogo(doc: CompositionDocument | null | undefined) {
  return doc?.objects.find(node => node.kind === 'shape' && node.shape === 'mark');
}

export function moveTemplateLogo(doc: CompositionDocument, patch: Partial<ObjectFrame>, size: { width: number; height: number }) {
  const mark = templateLogo(doc);
  return mark ? moveCompositionObject(doc, mark.id, patch, size) : doc;
}

/** Size is a percentage of canvas height in both normal and template layouts. */
export function resizeTemplateLogo(doc: CompositionDocument, percent: number, size: { width: number; height: number }) {
  const mark = templateLogo(doc);
  if (!mark || !Number.isFinite(percent) || percent <= 0) return doc;
  const heightRatio = percent / 100;
  return moveTemplateLogo(doc, {
    heightRatio,
    widthRatio: mark.frame.widthRatio * heightRatio / mark.frame.heightRatio,
  }, size);
}
