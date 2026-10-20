export type MediaRole = 'main' | 'detail' | 'logo';
export type ImageRole = 'main' | 'detail';
export type Placement = { centerX: number; centerY: number; scale: number };
export type TextStyle = { font: 'manrope' | 'gelasio'; size: number; weight: 400 | 600 | 700 | 800; italic: boolean; color: string };
export type TextFields = {
  brand: string; badge: string; eyebrow: string; headlineLead: string; headlineHighlight: string;
  description: string; cta: string; website: string; browserTitle: string;
  detailHeading: string; detailLabel: string; disclosure: string;
};
export type PosterDocument = {
  version: 1; templateId: 'editorial-honey'; fields: TextFields;
  textStyles: Partial<Record<keyof TextFields, TextStyle>>;
  assets: Record<MediaRole, string | null>;
  assetSizes: Partial<Record<MediaRole, { width: number; height: number }>>;
  placements: Record<ImageRole, Placement>;
  detailFit: 'contain' | 'cover'; detailAlign: 'center' | 'top' | 'bottom' | 'left' | 'right';
  detailVisible: boolean;
};
export const POSTER_WIDTH = 1600;
export const POSTER_HEIGHT = 1200;
