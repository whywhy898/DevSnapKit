export type MediaSlot = 'main' | 'secondary';
export interface ObjectFrame { centerX: number; centerY: number; widthRatio: number; heightRatio: number; rotation: number }
export interface GraphicBase { id: string; name: string; frame: ObjectFrame; hidden?: boolean; opacity?: number }
export interface ButtonObject extends GraphicBase {
  kind: 'button'; text: string; color: string; fill: string; fontSize: number;
  radius: number; padding: number; autoWidth: boolean; arrow: boolean; border?: string;
}
export interface ShapeObject extends GraphicBase {
  kind: 'shape'; shape: 'rect' | 'ellipse' | 'line' | 'halo' | 'grid' | 'mark';
  fill: string; stroke?: string; strokeWidth?: number; radius?: number; shadow?: string;
}
export type GraphicObject = ButtonObject | ShapeObject;
export interface CompositionDocument {
  version: 1; mediaLayout: 'independent' | 'legacy'; templateId?: 'editorial-honey' | 'spotlight-launch';
  placements: Record<MediaSlot, ObjectFrame>;
  detailVisible: boolean; detailFit: 'contain' | 'cover'; detailAlign: 'center' | 'top' | 'bottom' | 'left' | 'right';
  detailRadius: number; detailBorder: string; detailShadow: string;
  objects: GraphicObject[]; decorations: ShapeObject[]; order: string[]; hiddenIds: string[];
  allowBleed: boolean;
  knownTextIds?: string[];
}
