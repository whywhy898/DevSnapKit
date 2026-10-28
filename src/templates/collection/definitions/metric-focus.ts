import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1920, height: 1080 };
const frame = (x: number, y: number, width: number, height: number) => frameFromRect(canvas, { x, y, width, height });
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 400, italic: false, color: '#22231F', align: 'left', lineHeight: 1.2, ...extra,
} });
const noShadow = { x: 0, y: 0, blur: 0, color: '#00000000' };

export const METRIC_FOCUS: CuratedTemplateBlueprint = {
  id: 'metric-focus', version: 1, name: 'Metric Focus', tier: 'pro', canvas, allowBleed: false,
  examples: {
    main: { sampleId: 'north-overview', src: '/designed/examples/collection/north-overview.png', name: 'north-overview.png' },
    secondary: { sampleId: 'north-audience', src: '/designed/examples/collection/north-audience.png', name: 'north-audience.png' },
  },
  placements: { main: frame(64, 480, 1052, 500), secondary: frame(1240, 520, 616, 460) },
  singlePlacement: frame(64, 450, 1052, 530),
  mediaPresentation: {
    main: { frame: 'browser-light', fit: 'contain', align: 'center', title: 'north.example / overview', shadow: noShadow },
    secondary: { frame: 'plain', fit: 'contain', align: 'center', title: 'Audience detail', shadow: noShadow },
  },
  text: [
    text('brand', 'north', 64, 40, 280, 33, 27, { weight: 800, letterSpacing: -1 }),
    text('eyebrow', 'INSIGHTS / VOL. 04', 400, 49, 420, 19, 15, { weight: 700, letterSpacing: 2.4 }),
    text('badge', 'OCTOBER 2026', 880, 49, 236, 19, 15, { weight: 700, letterSpacing: 2.4 }),
    text('website', 'north.example', 1440, 45, 416, 20, 16, { color: '#FFFFFF', align: 'right' }),
    text('headline', 'Make the\nsignal clear.', 58, 142, 1058, 276, 138, { weight: 800, lineHeight: 1, letterSpacing: -7 }),
    text('metric', '24.8k', 1229, 161, 627, 194, 194, { weight: 800, lineHeight: 1, letterSpacing: -12, color: '#FFFFFF' }),
    text('metric-label', 'TOTAL VISITS / EXAMPLE DATA', 1246, 389, 610, 22, 17, { weight: 700, letterSpacing: 2.72, color: '#C8D7FF' }),
    text('disclosure', 'Illustrative analytics demo', 65, 1023, 1051, 17, 13, { color: '#767D88', letterSpacing: .13 }),
    text('annotation', 'A CLOSER LOOK AT THE SAME MONTH', 1243, 1023, 613, 17, 13, { color: '#C8D7FF', weight: 700, letterSpacing: 2.08 }),
  ],
  decorations: [
    { id: 'north-panel', name: 'Cobalt metric panel', kind: 'shape', shape: 'rect', frame: frame(1180, 0, 740, 1080), fill: '#224BCD' },
    { id: 'north-rule', name: 'Overview header rule', kind: 'shape', shape: 'rect', frame: frame(64, 96, 1052, 1), fill: '#292C32' },
    { id: 'north-metric-rule', name: 'Metric header rule', kind: 'shape', shape: 'rect', frame: frame(1240, 96, 616, 1), fill: '#8CA7FA' },
  ],
};
