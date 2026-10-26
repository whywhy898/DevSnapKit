import type { CuratedTemplateBlueprint, CuratedTextDefinition } from '../types';
import type { CanvasTextLayer } from '../../../text/types';
import { frameFromRect } from '../geometry';

const canvas = { width: 1200, height: 630 };
const frame = (x: number, y: number, width: number, height: number, rotation = 0) => frameFromRect(canvas, { x, y, width, height }, rotation);
const text = (role: CuratedTextDefinition['role'], content: string, x: number, y: number, width: number, height: number, fontSize: number, extra: Partial<CanvasTextLayer> = {}): CuratedTextDefinition => ({ role, layer: {
  content, centerX: (x + width / 2) / canvas.width, centerY: (y + height / 2) / canvas.height, widthRatio: width / canvas.width,
  font: 'manrope', fontSize, weight: 400, italic: false, color: '#23251F', align: 'left', lineHeight: 1.2, ...extra,
} });

export const PAPER_LAUNCH_DUO: CuratedTemplateBlueprint = {
  id: 'paper-launch-duo', version: 1, name: 'Paper Launch Duo', tier: 'free', canvas,
  examples: {
    main: { sampleId: 'folio-workspace', src: '/designed/examples/collection/folio-workspace.svg', name: 'folio-workspace.svg' },
    secondary: { sampleId: 'folio-task-detail', src: '/designed/examples/collection/folio-task-detail.svg', name: 'folio-task-detail.svg' },
  },
  placements: { main: frame(534, 96, 634, 454), secondary: frame(455, 385, 266, 200) },
  singlePlacement: frame(512, 96, 640, 480),
  mediaPresentation: {
    main: { frame: 'browser-light', fit: 'contain', align: 'center', title: 'folio.example' },
    secondary: { frame: 'browser-light', fit: 'contain', align: 'center', title: 'Task detail' },
  },
  text: [
    text('brand', 'folio', 98, 68, 210, 38, 30, { weight: 800, letterSpacing: -1.3 }),
    text('eyebrow', 'A LITTLE SPACE FOR BIG IDEAS', 60, 169, 430, 18, 12, { weight: 700, letterSpacing: 2, color: '#777B68' }),
    text('headline', 'A little less busy.\nA lot more done.', 60, 207, 435, 142, 60, { weight: 800, lineHeight: 1.06, letterSpacing: -3.5 }),
    text('description', 'Your projects, notes and next steps.\nTogether in one calmer workspace.', 60, 355, 385, 50, 21, { color: '#777B70', lineHeight: 1.2, letterSpacing: -.4 }),
    text('website', 'folio.example', 60, 560, 300, 26, 20, { weight: 600, letterSpacing: -.6 }),
  ],
  cta: { id: 'cta', name: 'Call to action', kind: 'button', frame: frame(60, 420, 172, 52), text: 'Meet folio', fontSize: 17, color: '#F6F3EC', fill: '#24261F', radius: 26, padding: 18, autoWidth: false, arrow: false },
  decorations: [
    { id: 'paper-orbit', name: 'Lime orbit', kind: 'shape', shape: 'ellipse', frame: frame(485, 31, 790, 560, -17), fill: 'transparent', stroke: '#D1D89B', strokeWidth: 1 },
    { id: 'paper-orbit-bottom', name: 'Lower lime orbit', kind: 'shape', shape: 'ellipse', frame: frame(700, 320, 610, 400, -17), fill: 'transparent', stroke: '#D1D89B', strokeWidth: 1 },
  ],
};

export const PAPER_BRAND_MARK = { id: 'brand-mark', name: 'Brand mark', kind: 'shape' as const, shape: 'mark' as const, markVariant: 'orbit' as const, frame: frame(60, 72, 28, 28), fill: '#24261F', stroke: '#F6F3EC' };
