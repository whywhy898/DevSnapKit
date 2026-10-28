import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1200, height: 630 };
const frame = (x: number, y: number, width: number, height: number, rotation = 0) => frameFromRect(canvas, { x, y, width, height }, rotation);
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 400, italic: false, color: '#22231F', align: 'left', lineHeight: 1.2, ...extra,
} });

export const FEATURE_SPOTLIGHT: CuratedTemplateBlueprint = {
  id: 'feature-spotlight', version: 1, name: 'Feature Spotlight', tier: 'pro', canvas, allowBleed: false,
  examples: {
    main: { sampleId: 'motive-board', src: '/designed/examples/collection/motive-board.png', name: 'motive-board.png' },
    secondary: { sampleId: 'motive-rules', src: '/designed/examples/collection/motive-rules.png', name: 'motive-rules.png' },
  },
  placements: { main: frame(396, 104, 750, 348, -2), secondary: frame(628, 350, 510, 230, 3) },
  singlePlacement: frame(400, 125, 780, 430, -2),
  mediaPresentation: {
    main: { frame: 'browser-light', fit: 'contain', align: 'center', title: 'motive.example / projects', shadow: { x: 8, y: 8, blur: 0, color: '#D1CABA', referenceWidth: 750 } },
    secondary: { frame: 'browser-light', fit: 'contain', align: 'center', title: 'motive.example / automations', shadow: { x: 8, y: 8, blur: 0, color: '#D1CABA', referenceWidth: 510 } },
  },
  text: [
    text('brand', 'motive', 40, 34, 310, 26, 21, { color: '#FFF8EC', weight: 700, letterSpacing: -.7 }),
    text('badge', 'FEATURE / 01', 40, 107, 310, 14, 11, { color: '#F8D2BF', weight: 700, letterSpacing: 1.76 }),
    text('headline', 'Less\nbusywork.', 40, 160, 360, 156.56, 76, { color: '#FFF8EC', weight: 800, lineHeight: 1.03, letterSpacing: -4 }),
    text('description', 'Plan it once.\nKeep the work moving.', 42, 372, 310, 58, 20, { color: '#FFF0DF', lineHeight: 1.45 }),
    text('eyebrow', 'TOOLS FOR THE WAY YOU WORK', 456, 34, 430, 16, 12, { color: '#3F3F37', weight: 700, letterSpacing: 1.92 }),
    text('website', 'motive.example', 930, 34, 222, 17, 13, { align: 'right' }),
    text('disclosure', 'Illustrative workflow demo', 42, 586, 310, 16, 13, { color: '#F4D2BF', letterSpacing: .13 }),
  ],
  decorations: [{ id: 'motive-panel', name: 'Red feature panel', kind: 'shape', shape: 'rect', frame: frame(0, 0, 420, 630), fill: '#CF3F2E' }],
};
