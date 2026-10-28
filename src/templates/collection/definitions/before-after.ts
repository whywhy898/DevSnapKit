import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1080, height: 1080 };
const frame = (x: number, y: number, width: number, height: number) => frameFromRect(canvas, { x, y, width, height });
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 400, italic: false, color: '#22231F', align: 'left', lineHeight: 1.2, ...extra,
} });
const noShadow = { x: 0, y: 0, blur: 0, color: '#00000000' };

export const BEFORE_AFTER: CuratedTemplateBlueprint = {
  id: 'before-after', version: 1, name: 'Before & After', tier: 'pro', canvas, allowBleed: false,
  examples: {
    main: { sampleId: 'outline-before', src: '/designed/examples/collection/outline-before.png', name: 'outline-before.png' },
    secondary: { sampleId: 'outline-after', src: '/designed/examples/collection/outline-after.png', name: 'outline-after.png' },
  },
  placements: { main: frame(56, 314, 452, 590), secondary: frame(572, 314, 452, 590) },
  singlePlacement: frame(166, 314, 748, 590),
  mediaPresentation: {
    main: { frame: 'browser-light', fit: 'contain', align: 'center', title: 'outline.example / workspace', shadow: noShadow },
    secondary: { frame: 'browser-light', fit: 'contain', align: 'center', title: 'outline.example / workspace', shadow: noShadow },
  },
  text: [
    text('brand', 'outline', 56, 35, 400, 23, 18, { weight: 800, color: '#F0F0DF' }),
    text('eyebrow', 'WORKSPACE STUDY / 01', 600, 41, 424, 15, 11, { weight: 700, letterSpacing: 1.76, align: 'right' }),
    text('headline', 'THEN.', 47, 105, 461, 155, 155, { weight: 800, lineHeight: 1, letterSpacing: -9, color: '#F1F0E1' }),
    text('after-heading', 'NOW.', 558, 105, 466, 155, 155, { weight: 800, lineHeight: 1, letterSpacing: -9, color: '#242A26' }),
    text('before-label', '01 / BEFORE', 58, 274, 450, 16, 12, { weight: 700, letterSpacing: 1.92, color: '#AEB8A5' }),
    text('after-label', '02 / AFTER', 573, 274, 451, 16, 12, { weight: 700, letterSpacing: 1.92, color: '#66775C' }),
    text('description', 'Same content.', 57, 944, 451, 33, 26, { letterSpacing: -.8, color: '#EFF0DE' }),
    text('after-caption', 'Clearer hierarchy.', 574, 944, 450, 33, 26, { letterSpacing: -.8, color: '#28362E' }),
    text('disclosure', 'Illustrative comparison demo', 57, 1028, 451, 15, 11, { letterSpacing: .11, color: '#AEB8A5' }),
    text('website', 'outline.example', 650, 1028, 374, 15, 12, { letterSpacing: .12, color: '#66775C', align: 'right' }),
  ],
  decorations: [{ id: 'outline-panel', name: 'Charcoal before panel', kind: 'shape', shape: 'rect', frame: frame(0, 0, 540, 1080), fill: '#242A26' }],
};
