import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1080, height: 1080 };
const frame = (x: number, y: number, width: number, height: number) => frameFromRect(canvas, { x, y, width, height });
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 400, italic: false, color: '#214C43', align: 'left', lineHeight: 1.2, ...extra,
} });

export const CALM_SPLIT: CuratedTemplateBlueprint = {
  id: 'calm-split', version: 1, name: 'Calm Split', tier: 'free', canvas,
  examples: {
    main: { sampleId: 'calm-workspace', src: '/designed/examples/collection/calm-workspace.svg', name: 'calm-workspace.svg' },
    secondary: { sampleId: 'calm-detail', src: '/designed/examples/collection/calm-detail.svg', name: 'calm-detail.svg' },
  },
  placements: { main: frame(64, 348, 464, 510), secondary: frame(552, 348, 464, 510) },
  mediaPresentation: {
    main: { frame: 'browser-light', fit: 'contain', align: 'center', title: 'Notes' },
    secondary: { frame: 'browser-light', fit: 'contain', align: 'center', title: 'Board' },
  },
  text: [
    text('brand', 'moss', 106, 46, 270, 40, 30, { weight: 800 }),
    text('eyebrow', 'SPACE TO THINK', 672, 54, 344, 20, 12, { align: 'right' }),
    text('headline', 'Two views.\nOne clear story.', 64, 130, 952, 174, 72, { weight: 800, lineHeight: 1.05, letterSpacing: -3 }),
    text('description', 'Bring the whole picture into focus.', 64, 910, 952, 38, 24, { color: '#61756A' }),
    // Reserve the default corner QR area; custom QR sizes and positions remain user controlled.
    text('website', 'moss.example', 600, 982, 312, 25, 18, { align: 'right', color: '#61756A' }),
    text('disclosure', 'Illustrative product demo', 600, 1010, 312, 18, 12, { align: 'right', color: '#61756A' }),
  ],
  cta: { id: 'cta', name: 'Call to action', kind: 'button', frame: frame(64, 982, 182, 48), referenceSize: { width: 182, height: 48 }, text: 'Explore moss', fontSize: 19, color: '#FFFFFF', fill: '#214C43', radius: 8, padding: 10, autoWidth: false, arrow: false, labelAlign: 'center' },
  decorations: [],
};

export const CALM_BRAND_MARK = { id: 'brand-mark', name: 'Brand mark', kind: 'shape' as const, shape: 'mark' as const, markVariant: 'orbit' as const, frame: frame(64, 52, 28, 28), fill: '#214C43', stroke: '#EEF2EE' };
