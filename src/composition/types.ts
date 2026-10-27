import type { CuratedTemplateId } from '../templates/collection/types';

export type MediaSlot = 'main' | 'secondary';
export type SlotFrame = 'plain' | 'browser-light' | 'browser-dark' | 'phone-light' | 'phone-dark';
export interface SlotPresentation {
  frame: SlotFrame;
  fit: 'contain' | 'cover';
  align: 'center' | 'top' | 'bottom' | 'left' | 'right';
  title?: string;
  /** Finite native shadow values; no arbitrary CSS or filters. */
  shadow?: { x: number; y: number; blur: number; color: string; referenceWidth?: number };
  /** Plain card corner radius, scaled with shadow.referenceWidth when present. */
  radius?: number;
}
export interface ObjectFrame { centerX: number; centerY: number; widthRatio: number; heightRatio: number; rotation: number }
export interface GraphicBase { id: string; name: string; frame: ObjectFrame; hidden?: boolean; opacity?: number }
export interface ButtonObject extends GraphicBase {
  /** Optional authored logical box for proportional content scaling on resized canvases. */
  referenceSize?: { width: number; height: number };
  labelAlign?: 'start' | 'center';
  kind: 'button'; text: string; color: string; fill: string; fontSize: number;
  radius: number; padding: number; autoWidth: boolean; arrow: boolean; border?: string;
}
export interface ShapeObject extends GraphicBase {
  /** Optional logical-pixel blur for native soft decorations. Legacy shapes stay unfiltered. */
  blur?: number;
  markVariant?: 'orbit';
  kind: 'shape'; shape: 'rect' | 'ellipse' | 'line' | 'halo' | 'grid' | 'mark';
  fill: string; stroke?: string; strokeWidth?: number; radius?: number; shadow?: string;
}
export type GraphicObject = ButtonObject | ShapeObject;
export interface CompositionDocument {
  version: 1; mediaLayout: 'independent' | 'legacy'; templateId?: CuratedTemplateId | 'spotlight-launch';
  /** Absent in legacy documents, which retain their original media rendering. */
  mediaPresentation?: Partial<Record<MediaSlot, SlotPresentation>>;
  adaptiveMediaLayout?: 'auto' | 'manual';
  singlePlacement?: ObjectFrame;
  placements: Record<MediaSlot, ObjectFrame>;
  detailVisible: boolean; detailFit: 'contain' | 'cover'; detailAlign: 'center' | 'top' | 'bottom' | 'left' | 'right';
  detailRadius: number; detailBorder: string; detailShadow: string;
  objects: GraphicObject[]; decorations: ShapeObject[]; order: string[]; hiddenIds: string[];
  allowBleed: boolean;
  knownTextIds?: string[];
}
