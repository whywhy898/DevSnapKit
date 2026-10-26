import type { CompositionDocument } from '../../composition/types';

/** Resolve saved geometry without mutating the canonical duo placements or sources. */
export function resolveMediaPlacements(doc: CompositionDocument): CompositionDocument['placements'] {
  if (doc.mediaLayout !== 'independent' || doc.adaptiveMediaLayout !== 'auto' || !doc.singlePlacement
    || (doc.detailVisible && !doc.hiddenIds.includes('secondary'))) return doc.placements;
  return { ...doc.placements, main: doc.singlePlacement };
}

/** Called inside the existing media gesture update, so its undo remains one step. */
export function materializeMediaPlacements(doc: CompositionDocument): CompositionDocument {
  if (doc.mediaLayout !== 'independent' || doc.adaptiveMediaLayout !== 'auto') return doc;
  return { ...doc, placements: resolveMediaPlacements(doc), adaptiveMediaLayout: 'manual' };
}
