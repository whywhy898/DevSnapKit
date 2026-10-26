import type { ButtonObject, MediaSlot, ObjectFrame, ShapeObject, SlotPresentation } from '../../composition/types';
import type { CanvasTextLayer, TextCanvasSize } from '../../text/types';

export type { SlotFrame, SlotPresentation } from '../../composition/types';

/** Stable identifiers describe the collection; availability is decided by the catalog. */
export type CuratedTemplateId =
  | 'editorial-honey'
  | 'paper-launch-duo'
  | 'calm-split'
  | 'app-pair'
  | 'night-signal-duo'
  | 'pocket-flow-duo'
  | 'studio-bridge'
  | 'feature-spotlight'
  | 'editorial-story'
  | 'code-preview'
  | 'metric-focus'
  | 'before-after';

export type CuratedTextRole =
  | 'brand'
  | 'badge'
  | 'eyebrow'
  | 'headline'
  | 'description'
  | 'website'
  | 'disclosure'
  | 'credit';

export interface CuratedTextDefinition {
  role: CuratedTextRole;
  layer: Omit<CanvasTextLayer, 'id'>;
}

export interface CuratedMediaExample {
  sampleId: string;
  src: string;
  name: string;
}

/** Explicit template data, independent of applying or restoring editor snapshots. */
export interface CuratedTemplateBlueprint {
  id: CuratedTemplateId;
  version: 1;
  name: string;
  tier: 'free' | 'pro';
  canvas: TextCanvasSize;
  examples: Record<MediaSlot, CuratedMediaExample>;
  placements: Record<MediaSlot, ObjectFrame>;
  /** Main screenshot placement used when an adaptive template has no visible secondary. */
  singlePlacement?: ObjectFrame;
  mediaPresentation: Record<MediaSlot, SlotPresentation>;
  text: CuratedTextDefinition[];
  cta: ButtonObject;
  decorations: ShapeObject[];
}
