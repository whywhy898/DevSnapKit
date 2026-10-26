import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1080, height: 1920 };
const frame = (x: number, y: number, width: number, height: number) => frameFromRect(canvas, { x, y, width, height });
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 400, italic: false, color: '#34242D', align: 'left', lineHeight: 1.2, ...extra,
} });

export const POCKET_FLOW_DUO: CuratedTemplateBlueprint = {
  id: 'pocket-flow-duo', version: 1, name: 'Pocket Flow Duo', tier: 'pro', canvas,
  examples: {
    main: { sampleId: 'morrow-today', src: '/designed/examples/collection/morrow-today.svg', name: 'morrow-today.svg' },
    secondary: { sampleId: 'morrow-focus', src: '/designed/examples/collection/morrow-focus.svg', name: 'morrow-focus.svg' },
  },
  placements: { main: frame(85, 535, 460, 1000), secondary: frame(557, 665, 445, 1015) },
  mediaPresentation: {
    main: { frame: 'phone-light', fit: 'contain', align: 'center', title: 'Today' },
    secondary: { frame: 'phone-light', fit: 'contain', align: 'center', title: 'Focus' },
  },
  text: [
    text('brand', 'morrow', 122, 54, 300, 48, 38, { weight: 800, letterSpacing: -1.5 }),
    text('eyebrow', 'A LITTLE SPACE FOR YOUR DAY', 76, 124, 925, 28, 20, { weight: 600, letterSpacing: 2.2 }),
    text('headline', 'Make time\nfor what matters.', 76, 172, 935, 245, 120, { weight: 800, lineHeight: 1.02, letterSpacing: -6 }),
    text('description', 'Plan clearly. Move gently.', 76, 435, 925, 58, 42, { letterSpacing: -1.1 }),
    text('website', 'morrow.example', 76, 1820, 928, 40, 26, { align: 'center', weight: 600, letterSpacing: -.5 }),
    text('disclosure', 'Illustrative app demo', 76, 1870, 928, 26, 18, { align: 'center' }),
  ],
  cta: { id: 'cta', name: 'Call to action', kind: 'button', frame: frame(335, 1720, 410, 75), referenceSize: { width: 410, height: 75 }, text: 'Find your flow', fontSize: 32, color: '#FBF5EF', fill: '#34242D', radius: 38, padding: 12, autoWidth: false, arrow: false, labelAlign: 'center' },
  decorations: [
    { id: 'pocket-arc-top', name: 'Upper peach arc', kind: 'shape', shape: 'ellipse', frame: frame(650, -440, 900, 1050), fill: 'transparent', stroke: '#CA7662', strokeWidth: 1, opacity: .28 },
    { id: 'pocket-arc-bottom', name: 'Lower peach arc', kind: 'shape', shape: 'ellipse', frame: frame(-450, 1170, 1300, 1150), fill: 'transparent', stroke: '#CA7662', strokeWidth: 1, opacity: .28 },
  ],
};

export const POCKET_BRAND_MARK = { id: 'brand-mark', name: 'Brand mark', kind: 'shape' as const, shape: 'mark' as const, markVariant: 'orbit' as const, frame: frame(76, 62, 34, 34), fill: '#CA7662', stroke: '#F4E4D6' };
