import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1600, height: 1200 };
const frame = (x: number, y: number, width: number, height: number) => frameFromRect(canvas, { x, y, width, height });
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 400, italic: false, color: '#EDF1E9', align: 'left', lineHeight: 1.2, ...extra,
} });

export const NIGHT_SIGNAL_DUO: CuratedTemplateBlueprint = {
  id: 'night-signal-duo', version: 1, name: 'Night Signal Duo', tier: 'pro', canvas,
  examples: {
    main: { sampleId: 'signal-overview', src: '/designed/examples/collection/signal-overview.svg', name: 'signal-overview.svg' },
    secondary: { sampleId: 'signal-release', src: '/designed/examples/collection/signal-release.svg', name: 'signal-release.svg' },
  },
  placements: { main: frame(96, 370, 1193, 693), secondary: frame(1065, 632, 465, 432) },
  singlePlacement: frame(185, 370, 1230, 714),
  mediaPresentation: {
    main: { frame: 'browser-dark', fit: 'contain', align: 'center', title: 'signal.example' },
    secondary: { frame: 'browser-dark', fit: 'contain', align: 'center', title: 'Release checklist' },
  },
  text: [
    text('brand', 'signal', 96, 40, 210, 42, 32, { weight: 800, letterSpacing: -1.2 }),
    text('eyebrow', 'PRODUCT UPDATE / 01', 1130, 51, 375, 24, 16, { weight: 600, letterSpacing: 2, color: '#D9F58B', align: 'right' }),
    text('headline', 'Less noise.\nMore perspective.', 96, 110, 1320, 196, 98, { weight: 800, lineHeight: 1, letterSpacing: -5 }),
    text('description', 'Your workspace, seen from every angle.', 96, 306, 1180, 46, 30, { color: '#A8B2AA', letterSpacing: -.6 }),
    text('website', 'signal.example', 1110, 1112, 300, 28, 21, { align: 'right', weight: 600, color: '#D9F58B' }),
    text('disclosure', 'Illustrative product demo', 1050, 1148, 360, 22, 15, { align: 'right', color: '#909B93' }),
  ],
  cta: { id: 'cta', name: 'Call to action', kind: 'button', frame: frame(70, 1110, 225, 50), referenceSize: { width: 225, height: 50 }, text: 'Explore signal', fontSize: 21, color: '#101513', fill: '#D9F58B', radius: 8, padding: 10, autoWidth: false, arrow: false, labelAlign: 'center' },
  decorations: [
    { id: 'night-glow', name: 'Upper right glow', kind: 'shape', shape: 'ellipse', frame: frame(1080, -90, 440, 440), fill: '#D9F58B', opacity: .10, blur: 360 },
    { id: 'night-rule', name: 'Footer rule', kind: 'shape', shape: 'line', frame: frame(96, 1098, 1408, 1), fill: '#334038' },
  ],
};

export const NIGHT_BRAND_MARK = { id: 'brand-mark', name: 'Brand mark', kind: 'shape' as const, shape: 'mark' as const, markVariant: 'orbit' as const, frame: frame(56, 47, 28, 28), fill: '#D9F58B', stroke: '#101513' };
